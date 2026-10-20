<script setup>
// Chart teknikal: panel harga (candle, Bollinger, MA50, Parabolic SAR, volume, garis PTW & nilai wajar),
// lalu RSI dan MACD sebagai chart terpisah dengan sumbu waktu & crosshair yang disinkronkan.
// Lapisan struktur harga (pola, candlestick, divergensi, Fibonacci, volume profile, zona volume) digambar terpisah
// supaya bisa diganti tanpa membangun ulang chart.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts'
import { rpx } from '../../../lib/ta.js'
import { fmt, fmtDate } from '../../../lib/domain.js'

const props = defineProps({
  bars: { type: Array, required: true },
  ind: { type: Object, required: true },
  // [{ price, title, tone: 'ink' | 'good' }] → garis harga horizontal di panel utama.
  lines: { type: Array, default: () => [] },
  range: { type: Number, default: 120 },
  adv: { type: Object, default: null },      // analyzePatterns()
  lv: { type: Object, default: null },       // levels() untuk rentang chart
  layers: { type: Object, default: () => ({}) },
  sel: { type: String, default: null },      // id pola yang disorot
})

const elMain = ref(), elRsi = ref(), elMacd = ref()
const hover = ref(null)
const ov = ref({ w: 0, rects: [] })   // overlay SVG di atas panel harga: volume profile, zona volume, golden pocket
let charts = [], observer = null, resizer = null, raf = 0, retry = 0
let col = {}, candleS = null, rsiS = null, macdS = null
let layer = { series: [], plines: [] }

const alpha = (c, a) => /^#[0-9a-f]{6}$/i.test(c) ? c + Math.round(a * 255).toString(16).padStart(2, '0') : c
const priceFmt = p => p.toLocaleString('id-ID', { maximumFractionDigits: p < 200 ? 1 : 0 })

function dispose() {
  charts.forEach(c => c.remove())
  charts = []
  layer = { series: [], plines: [] }   // ikut hilang bersama chart
  candleS = rsiS = macdS = null
}

function build() {
  dispose()
  const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue('--' + n).trim()
  const good = v('good'), strong = v('strong'), A = v('viz-a'), Bc = v('viz-b'), C = v('viz-c')
  col = { good, strong, A, Bc, C, ink: v('ink'), ink2: v('ink-2') }
  const B = props.bars, I = props.ind, T = i => B[i].d
  // Nilai kosong (awal indikator) jadi whitespace supaya jumlah titik sama di semua chart → rentang logis selaras.
  const ser = arr => arr.map((x, i) => x == null ? { time: T(i) } : { time: T(i), value: x })
  const opts = (fmtFn, showTime) => ({
    autoSize: true,
    layout: { background: { color: v('sheet') }, textColor: v('ink-2'), fontFamily: v('f-data'), fontSize: 11 },
    grid: { vertLines: { color: v('rule-2') }, horzLines: { color: v('rule-2') } },
    rightPriceScale: { borderColor: v('rule'), minimumWidth: 64 },
    timeScale: { borderColor: v('rule'), visible: showTime },
    crosshair: { mode: CrosshairMode.Normal,
      vertLine: { color: v('ink-2'), labelBackgroundColor: v('ink') },
      horzLine: { color: v('ink-2'), labelBackgroundColor: v('ink') } },
    localization: { locale: 'id-ID', priceFormatter: fmtFn },
  })
  const line = (chart, data, color, o = {}) => {
    const s = chart.addLineSeries({ color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, ...o })
    s.setData(data)
    return s
  }

  // Panel utama.
  const main = createChart(elMain.value, opts(priceFmt, false))
  const candle = main.addCandlestickSeries({ upColor: good, downColor: strong, borderUpColor: good, borderDownColor: strong,
    wickUpColor: good, wickDownColor: strong, priceLineVisible: false })
  candle.setData(B.map(b => ({ time: b.d, open: b.o, high: b.h, low: b.l, close: b.c })))
  main.priceScale('right').applyOptions({ scaleMargins: { top: 0.06, bottom: 0.24 } })
  const vol = main.addHistogramSeries({ priceScaleId: 'vol', priceFormat: { type: 'volume' }, priceLineVisible: false, lastValueVisible: false })
  main.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
  vol.setData(B.map((b, i) => ({ time: b.d, value: b.v, color: alpha(b.c >= (B[i - 1]?.c ?? b.c) ? good : strong, 0.4) })))
  line(main, ser(I.bb.up), A)
  line(main, ser(I.bb.lo), A)
  line(main, ser(I.bb.mid), A, { lineStyle: LineStyle.Dashed })
  line(main, ser(I.ma50), C)
  line(main, I.sar.sar.map((x, i) => x == null ? { time: T(i) } : { time: T(i), value: x, color: I.sar.up[i] ? good : strong }),
    Bc, { lineVisible: false, pointMarkersVisible: true, pointMarkersRadius: 1.5 })
  for (const l of props.lines) {
    candle.createPriceLine({ price: l.price, title: l.title, color: l.tone === 'good' ? good : v('ink'),
      lineWidth: 1, lineStyle: l.tone === 'good' ? LineStyle.Dotted : LineStyle.Dashed, axisLabelVisible: true })
  }

  // RSI 14 dengan batas 30/70.
  const rc = createChart(elRsi.value, opts(p => p.toFixed(0), false))
  const rs = line(rc, ser(I.rsi), A, { lineWidth: 1.5,
    autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) })
  for (const p of [30, 70]) rs.createPriceLine({ price: p, color: v('rule'), lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false })

  // MACD 12/26/9.
  const mc = createChart(elMacd.value, opts(p => p.toLocaleString('id-ID', { maximumFractionDigits: 2 }), true))
  const hs = mc.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false })
  hs.setData(I.macd.h.map((x, i) => x == null ? { time: T(i) } : { time: T(i), value: x, color: alpha(x >= 0 ? good : strong, 0.5) }))
  const ms = line(mc, ser(I.macd.m), A, { lineWidth: 1.5 })
  line(mc, ser(I.macd.sg), Bc)

  charts = [main, rc, mc]
  candleS = candle; rsiS = rs; macdS = ms
  // Seri acuan + nilai per chart untuk menaruh crosshair sinkron.
  const anchor = [[candle, i => B[i].c], [rs, i => I.rsi[i] ?? 50], [ms, i => I.macd.m[i] ?? 0]]
  let syncing = false
  charts.forEach((c, k) => {
    c.timeScale().subscribeVisibleLogicalRangeChange(r => {
      if (!r || syncing) return
      syncing = true
      charts.forEach(o => o !== c && o.timeScale().setVisibleLogicalRange(r))
      syncing = false
    })
    c.subscribeCrosshairMove(p => {
      if (syncing) return
      syncing = true
      // Indeks logis = indeks bar karena semua seri berisi titik untuk tiap tanggal.
      const i = p.logical != null && p.logical >= 0 && p.logical < B.length ? Math.round(p.logical) : undefined
      hover.value = i ?? null
      charts.forEach((o, j) => {
        if (j === k) return
        if (i == null) o.clearCrosshairPosition()
        else o.setCrosshairPosition(anchor[j][1](i), B[i].d, anchor[j][0])
      })
      syncing = false
    })
  })
  applyRange()
  drawLayers()
  main.timeScale().subscribeVisibleLogicalRangeChange(queueOverlay)
}

function clearLayers() {
  for (const [c, s] of layer.series) c.removeSeries(s)
  for (const [s, l] of layer.plines) s.removePriceLine(l)
  layer = { series: [], plines: [] }
  candleS?.setMarkers([])
  rsiS?.setMarkers([])
  macdS?.setMarkers([])
}

// Seri garis lapisan: tidak ikut menentukan skala harga agar garis yang diperpanjang tidak memampatkan candle.
function seg(chart, pts, color, o = {}) {
  const B = props.bars
  const s = chart.addLineSeries({ color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    autoscaleInfoProvider: () => null, ...o })
  s.setData(pts.map(q => ({ time: B[q.i].d, value: q.p })))
  layer.series.push([chart, s])
  return s
}
function pline(series, price, title, color, style = LineStyle.Dashed) {
  layer.plines.push([series, series.createPriceLine({ price, title, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true })])
}

function drawLayers() {
  if (!candleS) return
  clearLayers()
  const A = props.adv, Lv = props.lv, L = props.layers, B = props.bars, [main, rc, mc] = charts
  const tone = b => b > 0 ? col.good : b < 0 ? col.strong : col.ink2
  const marks = [], rsiMarks = [], macdMarks = []
  const mark = (arr, i, bias, text, shape) => arr.push({ time: B[i].d, position: bias > 0 ? 'belowBar' : 'aboveBar', color: tone(bias),
    shape: shape || (bias > 0 ? 'arrowUp' : 'arrowDown'), text })

  if (A && L.pola) {
    // Bawaan: dua pola aktif terbaik (pola lengkap didahulukan); bila satu pola disorot, hanya pola itu.
    const rank = p => (p.status === 'forming' ? 0 : 100) + p.conf
    const shown = props.sel ? A.all.filter(p => p.id === props.sel) : [...A.active].sort((a, b) => rank(b) - rank(a)).slice(0, 2)
    for (const p of shown) {
      const c = tone(p.bias)
      seg(main, p.curve || p.pts, c, { lineWidth: 2 })
      for (const s of p.segs) seg(main, [{ i: s.i1, p: s.p1 }, { i: s.i2, p: s.p2 }], c, { lineStyle: LineStyle.Dashed })
      if (p.labels) p.pts.forEach((q, k) => mark(marks, q.i, q.t === 'L' ? 1 : -1, p.labels[k], 'circle'))
      mark(marks, p.start, p.bias, `${p.name} ${p.conf}%`, 'square')
      if (p.bo != null) mark(marks, p.bo, p.bias, p.bias > 0 ? 'Breakout' : 'Breakdown', 'circle')
      const nm = shown.length > 1 ? ' ' + p.name : ''
      pline(candleS, p.target, 'Target' + nm, col.good)
      pline(candleS, p.inv, 'Invalidasi' + nm, col.strong)
    }
  }
  if (A && L.candle) {
    A.candles.filter(k => k.bias !== 0 && (k.s >= 2 || k.conf >= 55)).slice(-14).forEach(k => mark(marks, k.i, k.bias, k.code))
  }
  if (A && L.div) {
    for (const d of A.divs) {
      const c = tone(d.bias), pts = [d.a, d.b]
      seg(main, pts, c, { lineWidth: 2, lineStyle: LineStyle.Dotted })
      const ic = d.ind === 'RSI' ? rc : mc
      seg(ic, [{ i: d.a.i, p: d.v1 }, { i: d.b.i, p: d.v2 }], c, { lineWidth: 2 })
      ;(d.ind === 'RSI' ? rsiMarks : macdMarks).push({ time: B[d.b.i].d, position: d.bias > 0 ? 'belowBar' : 'aboveBar', color: c, shape: 'circle', text: 'Div' })
    }
  }
  if (Lv && L.fib) {
    for (const f of Lv.fib) pline(candleS, f.p, 'Fib ' + f.lbl.replace('Ekstensi ', 'Ext '), col.Bc, f.ext ? LineStyle.Dashed : LineStyle.Dotted)
  }
  if (Lv && L.vp) {
    pline(candleS, Lv.vp.pocP, 'POC', col.ink, LineStyle.Solid)
    pline(candleS, Lv.vp.vah, 'VAH', col.ink2, LineStyle.SparseDotted)
    pline(candleS, Lv.vp.val, 'VAL', col.ink2, LineStyle.SparseDotted)
  }
  const byTime = (a, b) => a.time < b.time ? -1 : a.time > b.time ? 1 : 0
  candleS.setMarkers(marks.sort(byTime))
  rsiS.setMarkers(rsiMarks.sort(byTime))
  macdS.setMarkers(macdMarks.sort(byTime))
  queueOverlay()
}

// Overlay mengikuti skala harga: dihitung ulang setelah chart menggambar ulang (rentang geser / ukuran berubah).
function queueOverlay() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(drawOverlay)
}
function drawOverlay() {
  const main = charts[0]
  if (!main || !candleS) { ov.value = { w: 0, rects: [] }; return }
  const A = props.adv, Lv = props.lv, L = props.layers, ts = main.timeScale()
  // Lebar panel = lebar elemen − sumbu harga (timeScale().width() bernilai 0 karena sumbu waktu panel ini disembunyikan).
  const W = elMain.value.clientWidth - main.priceScale('right').width()
  // Tepat setelah dibuat, sumbu harga belum diukur: coba lagi di frame berikutnya, maksimal ~0,5 detik.
  if (W <= 0 || W === elMain.value.clientWidth) { if (++retry < 30) queueOverlay(); return }
  retry = 0
  const y = p => candleS.priceToCoordinate(p), rects = []
  const band = (lo, hi, x, w, cls, op) => {
    const y1 = y(hi), y2 = y(lo)
    if (y1 == null || y2 == null) return
    rects.push({ x, y: y1, w, h: Math.max(1, y2 - y1 - 1), cls, op })
  }
  if (Lv && L.fib) band(Math.min(...Lv.gp), Math.max(...Lv.gp), 0, W, 'gp')
  if (A && L.zona) {
    // Hanya zona terdekat per peran (support, di dalam, resistance) agar tidak menumpuk.
    const half = (ts.logicalToCoordinate(1) - ts.logicalToCoordinate(0)) / 2 || 0
    for (const r of ['support', 'inside', 'resistance']) {
      const z = A.zones.find(o => o.role === r)
      if (!z) continue
      const x = Math.max(0, (ts.logicalToCoordinate(z.i) ?? 0) - half)
      if (x < W) band(z.lo, z.hi, x, W - x, 'zn ' + r, (0.06 + z.str / 800).toFixed(2))
    }
  }
  if (Lv && L.vp) {
    // Histogram volume per harga menempel di tepi kanan panel, lebar maks. 18%.
    const vp = Lv.vp, mx = Math.max(...vp.vol) || 1
    vp.vol.forEach((v, k) => {
      const w = v / mx * W * 0.18
      band(vp.lo + k * vp.step, vp.lo + (k + 1) * vp.step, W - w, w, 'vp' + (k === vp.poc ? ' poc' : k >= vp.a && k <= vp.z ? ' va' : ''))
    })
  }
  ov.value = { w: W, rects }
}
function applyRange() {
  const ts = charts[0]?.timeScale(), n = props.bars.length
  if (!ts) return
  if (props.range >= n) ts.fitContent()
  else ts.setVisibleLogicalRange({ from: n - props.range, to: n + 1 })
}

// Bacaan bar yang disorot (bawaan: bar terakhir).
const read = computed(() => {
  const B = props.bars, i = hover.value ?? B.length - 1, b = B[i], I = props.ind
  return { d: fmtDate(b.d), o: rpx(b.o), h: rpx(b.h), l: rpx(b.l), c: rpx(b.c), v: fmt(b.v, 0),
    rsi: I.rsi[i] != null ? I.rsi[i].toFixed(0) : '–',
    macd: I.macd.m[i] != null ? I.macd.m[i].toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '–',
    cdl: props.adv?.candles.find(k => k.i === i) || null }
})

onMounted(() => {
  build()
  // Tema berganti → warna dibaca ulang dan chart dibangun ulang.
  observer = new MutationObserver(build)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  resizer = new ResizeObserver(queueOverlay)
  resizer.observe(elMain.value)
})
onBeforeUnmount(() => { observer?.disconnect(); resizer?.disconnect(); cancelAnimationFrame(raf); dispose() })
watch(() => [props.bars, props.ind, props.lines], build)
watch(() => props.range, applyRange)
watch(() => [props.adv, props.lv, props.sel, { ...props.layers }], drawLayers)
</script>

<template>
  <div class="tc">
    <p class="read">
      <span class="cond d">{{ read.d }}</span>
      <span>O <b>{{ read.o }}</b></span><span>H <b>{{ read.h }}</b></span><span>L <b>{{ read.l }}</b></span><span>C <b>{{ read.c }}</b></span>
      <span>Vol <b>{{ read.v }}</b> lot</span><span>RSI <b>{{ read.rsi }}</b></span><span>MACD <b>{{ read.macd }}</b></span>
      <span v-if="read.cdl" :class="read.cdl.bias > 0 ? 'c-good' : read.cdl.bias < 0 ? 'c-strong' : ''">Candlestick <b>{{ read.cdl.n }}</b> {{ read.cdl.conf }}%</span>
    </p>
    <div class="wrap">
      <div ref="elMain" class="pane main" role="img" aria-label="Chart candle harian dengan Bollinger, MA50, Parabolic SAR, volume, dan lapisan pola"></div>
      <svg v-if="ov.rects.length" class="ov" :width="ov.w" aria-hidden="true">
        <rect v-for="(r, k) in ov.rects" :key="k" :class="r.cls" :x="r.x" :y="r.y" :width="r.w" :height="r.h" :fill-opacity="r.op" />
      </svg>
    </div>
    <div class="lab lbl">RSI 14</div>
    <div ref="elRsi" class="pane rsi" role="img" aria-label="Chart RSI 14"></div>
    <div class="lab lbl">MACD 12/26/9</div>
    <div ref="elMacd" class="pane macd" role="img" aria-label="Chart MACD 12/26/9"></div>
  </div>
</template>

<style scoped>
.tc{border:1px solid var(--rule);background:var(--sheet)}
.read{display:flex;flex-wrap:wrap;gap:4px 14px;margin:0;padding:8px 10px;border-bottom:1px solid var(--rule-2);font-size:12.5px;color:var(--ink-2)}
.read b{font:700 14px var(--f-display);color:var(--ink)}
.read .d{font-weight:700;font-size:14px;color:var(--ink)}
.pane{width:100%}
.wrap{position:relative}
.ov{position:absolute;z-index:3;top:0;left:0;height:100%;overflow:hidden;pointer-events:none}
.ov .vp{fill:var(--viz-a);fill-opacity:.22}
.ov .vp.va{fill-opacity:.38}
.ov .vp.poc{fill:var(--ink);fill-opacity:.45}
.ov .gp{fill:var(--viz-b);fill-opacity:.1}
.ov .zn.support{fill:var(--good)} .ov .zn.resistance{fill:var(--strong)} .ov .zn.inside{fill:var(--warn)}
.read .c-good b,.read .c-good{color:var(--good)} .read .c-strong b,.read .c-strong{color:var(--strong)}
.main{height:360px}
.rsi{height:96px}
.macd{height:124px}
.lab{padding:6px 10px 0;border-top:1px solid var(--rule-2)}
@media (max-width:760px){.main{height:280px}}
</style>
