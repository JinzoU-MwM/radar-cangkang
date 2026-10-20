<script setup>
// Chart teknikal: panel harga (candle, Bollinger, MA50, Parabolic SAR, volume, garis PTW & nilai wajar),
// lalu RSI dan MACD sebagai chart terpisah dengan sumbu waktu & crosshair yang disinkronkan.
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
})

const elMain = ref(), elRsi = ref(), elMacd = ref()
const hover = ref(null)
let charts = [], observer = null

const alpha = (c, a) => /^#[0-9a-f]{6}$/i.test(c) ? c + Math.round(a * 255).toString(16).padStart(2, '0') : c
const priceFmt = p => p.toLocaleString('id-ID', { maximumFractionDigits: p < 200 ? 1 : 0 })

function dispose() {
  charts.forEach(c => c.remove())
  charts = []
}

function build() {
  dispose()
  const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue('--' + n).trim()
  const good = v('good'), strong = v('strong'), A = v('viz-a'), Bc = v('viz-b'), C = v('viz-c')
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
    macd: I.macd.m[i] != null ? I.macd.m[i].toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '–' }
})

onMounted(() => {
  build()
  // Tema berganti → warna dibaca ulang dan chart dibangun ulang.
  observer = new MutationObserver(build)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
})
onBeforeUnmount(() => { observer?.disconnect(); dispose() })
watch(() => [props.bars, props.ind, props.lines], build)
watch(() => props.range, applyRange)
</script>

<template>
  <div class="tc">
    <p class="read">
      <span class="cond d">{{ read.d }}</span>
      <span>O <b>{{ read.o }}</b></span><span>H <b>{{ read.h }}</b></span><span>L <b>{{ read.l }}</b></span><span>C <b>{{ read.c }}</b></span>
      <span>Vol <b>{{ read.v }}</b> lot</span><span>RSI <b>{{ read.rsi }}</b></span><span>MACD <b>{{ read.macd }}</b></span>
    </p>
    <div ref="elMain" class="pane main" role="img" aria-label="Chart candle harian dengan Bollinger, MA50, Parabolic SAR, dan volume"></div>
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
.main{height:360px}
.rsi{height:96px}
.macd{height:124px}
.lab{padding:6px 10px 0;border-top:1px solid var(--rule-2)}
@media (max-width:760px){.main{height:280px}}
</style>
