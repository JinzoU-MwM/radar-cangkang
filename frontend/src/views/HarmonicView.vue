<script setup>
// Harmonic Pattern (gaya TradingView): chart candlestick saham BEI dengan timeframe harian/mingguan/bulanan dan
// alat gambar otomatis di toolbar kiri. Setiap tombol menggambar alatnya dari swing harga terakhir tanpa perlu
// menarik garis: XABCD, Fib retracement, Trend-based fib extension, Elliott impulse, Long position, Short position.
// Logika di lib/harmonikAlat.js; candle dari /api/ohlc: tf=1y Stockbit berisi candle harian (1 tahun), tf=3y berisi
// candle mingguan (3 tahun) yang juga digabung menjadi bulanan.
// Berbeda dari bagian Harmonic Pattern di POV (materi + screening), yang tetap di sana.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createChart, CrosshairMode } from 'lightweight-charts'
import { api } from '../api.js'
import { store, toast } from '../store.js'
import { SKALA, TF, POLA, PEMBEDA, alasanPola, alasanX, diagramIdeal, konfirmasiD, cariElliott, cariXabcd, fibExtension, fibRetracement, kelompokBar, rencanaPosisi, swingXabcd } from '../lib/harmonikAlat.js'
import { ukuranPosisi } from '../lib/harmonikBelajar.js'

const route = useRoute(), router = useRouter()

// ------------------------------------------------------------------ data ----
let terakhir = ''
try { terakhir = localStorage.getItem('radar-cangkang.hp-kode') || '' } catch {}
const kode = ref(String(route.query.t || '').toUpperCase() || terakhir || store.items[0]?.ticker || 'BBCA')
watch(kode, t => { try { localStorage.setItem('radar-cangkang.hp-kode', t) } catch {} })
const tf = ref(TF.some(x => x.k === route.query.tf) ? route.query.tf : 'D')
const mentah = shallowRef([]), memuat = ref(false), err = ref('')
const cache = new Map()
const sumberTf = f => f === 'D' ? '1y' : '3y'
async function muat(t, f) {
  err.value = ''
  const k = t + '|' + sumberTf(f)
  if (cache.has(k)) { mentah.value = cache.get(k); return }
  memuat.value = true
  try {
    const j = await api.get('/api/ohlc', { ticker: t, tf: sumberTf(f) })
    const b = (j.bars || []).filter(x => x.c > 0)
    if (!b.length) throw new Error('Data harga kosong.')
    cache.set(k, b)
    if (kode.value === t && sumberTf(tf.value) === sumberTf(f)) mentah.value = b
  } catch (e) {
    if (kode.value === t) {
      mentah.value = []
      err.value = e.status === 503 ? 'Harga saham ini belum tersedia di versi publik.'
        : /401|Unauthorized|Token/i.test(e.message || '') ? 'Harga belum bisa diambil: token Stockbit di server ini kedaluwarsa.' : (e.message || String(e))
    }
  } finally { memuat.value = false }
}
watch(kode, () => { aktif.value = [] })
watch([kode, tf], ([t, f]) => { muat(t, f); router.replace({ query: { ...route.query, t, tf: f === 'D' ? undefined : f } }) }, { immediate: true })
const bars = computed(() => kelompokBar(mentah.value, tf.value === 'M' ? 'M' : 'D'))
const skala = computed(() => SKALA[tf.value])

// Cari kode/nama saham BEI.
const q = ref(''), kodeBei = ref(null), cariBuka = ref(false)
function bukaCari() {
  cariBuka.value = true
  if (kodeBei.value === null) {
    kodeBei.value = []
    api.get('/api/kode-bei').then(r => { kodeBei.value = r.kode || [] }, () => { kodeBei.value = [] })
  }
}
const saran = computed(() => {
  const x = q.value.trim().toLowerCase()
  const daftar = kodeBei.value?.length ? kodeBei.value : store.items.map(i => ({ t: i.ticker, nama: i.name || '' }))
  if (!x) return daftar.filter(k => store.items.some(i => i.ticker === k.t)).slice(0, 8)
  return daftar.filter(k => k.t.toLowerCase().startsWith(x) || (x.length >= 3 && (k.nama || '').toLowerCase().includes(x)))
    .sort((a, b) => (b.t.toLowerCase() === x) - (a.t.toLowerCase() === x) || a.t.localeCompare(b.t)).slice(0, 8)
})
const tutupCari = () => setTimeout(() => { cariBuka.value = false }, 150)
function pilih(t) {
  t = String(t || '').trim().toUpperCase()
  if (/^[A-Z]{4}$/.test(t)) kode.value = t
  q.value = ''; cariBuka.value = false
}
const nama = computed(() => (kodeBei.value || []).find(k => k.t === kode.value)?.nama || store.items.find(i => i.ticker === kode.value)?.name || '')

// --------------------------------------------------------------- analisa ----
const polaList = computed(() => bars.value.length ? cariXabcd(bars.value, skala.value, tf.value === 'D' ? 30 : 12) : [])
const pilihPola = ref(0)
watch(polaList, () => { pilihPola.value = 0 })
const xabcd = computed(() => polaList.value[pilihPola.value] || (bars.value.length ? swingXabcd(bars.value, skala.value) : null))
const polaAcuan = computed(() => xabcd.value?.pola ? xabcd.value : null)
// Konfirmasi pembalikan di D (candle, divergence RSI, struktur minor, volume); null bila D belum terbentuk.
const konf = computed(() => polaAcuan.value ? konfirmasiD(bars.value, polaAcuan.value) : null)
// Pola terpilih didahulukan untuk Long/Short bila arahnya cocok.
const urutPosisi = computed(() => polaAcuan.value ? [polaAcuan.value, ...polaList.value.filter(r => r !== polaAcuan.value)] : polaList.value)
const hasil = computed(() => {
  const b = bars.value
  if (!b.length) return {}
  return {
    xabcd: xabcd.value,
    fib: fibRetracement(b, polaAcuan.value, skala.value[2]),
    ext: fibExtension(b, polaAcuan.value, skala.value[2]),
    elliott: cariElliott(b, skala.value),
    long: rencanaPosisi(b, 'long', urutPosisi.value, skala.value[1]),
    short: rencanaPosisi(b, 'short', urutPosisi.value, skala.value[1]),
  }
})

// --------------------------------------------------------------- toolbar ----
const ALAT = [
  { k: 'xabcd', nama: 'XABCD pattern', pendek: 'XABCD' },
  { k: 'fib', nama: 'Fib retracement', pendek: 'Fib' },
  { k: 'ext', nama: 'Trend-based fib extension', pendek: 'Ext' },
  { k: 'elliott', nama: 'Elliott impulse wave (1-2-3-4-5)', pendek: 'Elliott' },
  { k: 'long', nama: 'Long position', pendek: 'Long' },
  { k: 'short', nama: 'Short position', pendek: 'Short' },
]
const aktif = ref([])   // urutan klik; panel kanan menampilkan yang terakhir di atas
function togel(k) {
  const i = aktif.value.indexOf(k)
  if (i >= 0) aktif.value = aktif.value.filter(x => x !== k)
  else { aktif.value = [...aktif.value, k]; nextTick(() => tampilkan(k)) }
}
const hapus = () => { aktif.value = [] }

// Panduan langkah: urutan klik dari pola sampai rencana posisi; langkah berikutnya ditandai di toolbar.
const arahPosisi = computed(() => polaAcuan.value?.arah === 'bearish' ? 'short' : 'long')
const LANGKAH = computed(() => [
  { k: 'xabcd', teks: 'Klik XABCD: lihat pola apa yang terbentuk, arahnya, PRZ, dan kenapa titik X dipilih.' },
  { k: 'fib', teks: 'Klik Fib: pastikan B dan D berada di rasio kunci kaki XA.' },
  { k: 'ext', teks: 'Klik Ext: cek proyeksi AB=CD bertemu di PRZ (makin banyak rasio berkumpul, makin kuat).' },
  { k: 'elliott', teks: 'Klik Elliott: konteks tren. Pola di akhir gelombang 2 atau 4 lebih layak daripada di akhir gelombang 5.' },
  { k: arahPosisi.value, teks: `Klik ${arahPosisi.value === 'long' ? 'Long' : 'Short'} (sesuai arah pola): entry, stop loss, take profit, R:R, dan jumlah lot.` },
])
const langkahBerikut = computed(() => bars.value.length ? LANGKAH.value.find(l => !aktif.value.includes(l.k))?.k || '' : '')
// Pop up langkah berikutnya, menempel di samping tombolnya di toolbar.
const toolEl = {}
const panduanTutup = ref(false)
try { panduanTutup.value = localStorage.getItem('radar-cangkang.hp-panduan') === '0' } catch {}
watch(panduanTutup, v => { try { localStorage.setItem('radar-cangkang.hp-panduan', v ? '0' : '1') } catch {} })
const popup = computed(() => {
  if (panduanTutup.value || !bars.value.length) return null
  const k = langkahBerikut.value
  if (!k) return selesai.value ? { selesai: true, top: (toolEl[arahPosisi.value]?.offsetTop ?? 200) } : null
  const n = LANGKAH.value.findIndex(l => l.k === k)
  return { k, n: n + 1, total: LANGKAH.value.length, teks: LANGKAH.value[n].teks, top: toolEl[k]?.offsetTop ?? 8 }
})
const selesai = computed(() => bars.value.length && !langkahBerikut.value)
// Likuiditas: rata-rata nilai transaksi per hari (volume Stockbit dalam lot = 100 lembar). Batas Rp1 miliar sama
// dengan screening Harmonic di POV: saham sepi membentuk swing yang kurang representatif.
const NILAI_MIN = 1e9
const nilaiHarian = computed(() => {
  const b = mentah.value
  if (!b.length) return null
  const xs = tf.value === 'D' ? b.slice(-20) : b.slice(-4)
  const rata = xs.reduce((a, x) => a + x.c * x.v * 100, 0) / xs.length
  return tf.value === 'D' ? rata : rata / 5
})
const sepi = computed(() => nilaiHarian.value != null && nilaiHarian.value < NILAI_MIN)
const fmtRp = v => v >= 1e9 ? 'Rp' + (v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' miliar' : 'Rp' + Math.round(v / 1e6).toLocaleString('id-ID') + ' juta'

const ringkasan = computed(() => {
  const x = hasil.value.xabcd, p = hasil.value[arahPosisi.value], e = hasil.value.elliott
  if (!p) return []
  const out = []
  out.push(x?.pola ? `Pola ${x.nama} ${x.arah}, ${STATUS[x.status]}.` : 'Belum ada pola harmonik yang cocok; rencana posisi memakai swing terakhir, jadi bobotnya lebih lemah.')
  if (x?.pola) out.push(konf.value ? `Konfirmasi di D ${konf.value.jumlah} dari ${konf.value.total} (${konf.value.label})${konf.value.jumlah < 2 ? ': belum cukup, tunggu candle pembalikan atau volume sebelum masuk' : ''}.`
    : 'D belum terbentuk: tunggu harga masuk PRZ dan muncul konfirmasi.')
  if (e) out.push(`Elliott: impuls ${e.naik ? 'naik' : 'turun'} (${e.status})${e.valid ? '' : ', aturan belum terpenuhi'}.`)
  if (!p.kosong) out.push(`${arahPosisi.value === 'long' ? 'Long' : 'Short'}: entry ${fmtH(p.entry)}, stop loss ${fmtH(p.stop)} (${fmtP(p.stopPct)}), TP1 ${fmtH(p.target[0])} (${fmtP(p.targetPct[0])}), TP2 ${fmtH(p.target[1])} (${fmtP(p.targetPct[1])}), R:R ${r2(p.rr[0])}–${r2(p.rr[1])}.`)
  if (!p.kosong && p.rr[1] != null) out.push(p.rr[1] >= 2 ? `R:R TP2 ${r2(p.rr[1])}: target sebanding dengan stop (minimal 2), layak dipertimbangkan.`
    : `R:R TP2 ${r2(p.rr[1])} di bawah 2: target tidak sebanding dengan stop. Tunggu entry lebih dekat ke D atau lewati.`)
  if (sepi.value) out.push(`Likuiditas rendah: rata-rata nilai transaksi sekitar ${fmtRp(nilaiHarian.value)} per hari (di bawah Rp1 miliar). Swing saham sepi kurang representatif dan rawan slippage.`)
  out.push('Masuk hanya setelah ada konfirmasi di PRZ (candle pembalikan, volume), dan pasang stop loss sejak awal.')
  return out
})
const kesimpulan = computed(() => selesai.value && ringkasan.value.length ? ringkasan.value : null)
const kartu = computed(() => [...aktif.value].reverse())

// ----------------------------------------------------------------- chart ----
const elChart = ref(), ver = ref(0)
let chart = null, candle = null, volume = null, observer = null, resizer = null, raf = 0
const legenda = ref(null)
const fmtH = p => p == null || !isFinite(p) ? '–' : Number(p).toLocaleString('id-ID', { maximumFractionDigits: p < 200 ? 1 : 0 })
const fmtR = v => v == null ? '–' : Number(v).toLocaleString('id-ID', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const fmtP = v => v == null ? '–' : (v > 0 ? '+' : '') + Number(v).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '%'
const fmtV = v => v >= 1e6 ? (v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' jt' : v >= 1e3 ? (v / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' rb' : fmtH(v)
const segar = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; ver.value++ }) }

function warna() {
  const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue('--' + n).trim()
  return { good: v('good'), strong: v('strong'), sheet: v('sheet'), ink: v('ink'), ink2: v('ink-2'), rule: v('rule'), rule2: v('rule-2'), font: v('f-data') }
}
const alpha = (c, a) => /^#[0-9a-f]{6}$/i.test(c) ? c + Math.round(a * 255).toString(16).padStart(2, '0') : c

function bangun() {
  chart?.remove()
  const w = warna()
  chart = createChart(elChart.value, {
    autoSize: true,
    layout: { background: { color: w.sheet }, textColor: w.ink2, fontFamily: w.font, fontSize: 11 },
    grid: { vertLines: { color: w.rule2 }, horzLines: { color: w.rule2 } },
    rightPriceScale: { borderColor: w.rule, minimumWidth: 64 },
    timeScale: { borderColor: w.rule, rightOffset: 12, barSpacing: 7 },
    crosshair: { mode: CrosshairMode.Normal, vertLine: { color: w.ink2, labelBackgroundColor: w.ink }, horzLine: { color: w.ink2, labelBackgroundColor: w.ink } },
    localization: { locale: 'id-ID', priceFormatter: fmtH },
  })
  candle = chart.addCandlestickSeries({ upColor: w.good, downColor: w.strong, borderUpColor: w.good, borderDownColor: w.strong,
    wickUpColor: w.good, wickDownColor: w.strong, autoscaleInfoProvider: skalaOtomatis() })
  chart.priceScale('right').applyOptions({ scaleMargins: { top: 0.08, bottom: 0.22 } })
  volume = chart.addHistogramSeries({ priceScaleId: 'vol', priceFormat: { type: 'volume' }, priceLineVisible: false, lastValueVisible: false })
  chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
  chart.timeScale().subscribeVisibleLogicalRangeChange(segar)
  chart.subscribeCrosshairMove(p => {
    const i = p?.logical
    legenda.value = i != null && i >= 0 && i < bars.value.length ? i : null
  })
  isiData(true)
}
function isiData(awal = false) {
  if (!chart) return
  const b = bars.value, w = warna()
  candle.setData(b.map(x => ({ time: x.d, open: x.o, high: x.h, low: x.l, close: x.c })))
  volume.setData(b.map((x, i) => ({ time: x.d, value: x.v, color: alpha(x.c >= (b[i - 1]?.c ?? x.o) ? w.good : w.strong, 0.45) })))
  if (awal || b.length) rentang(tf.value === 'M' ? 'all' : tf.value === 'W' ? '3y' : '1y')
  segar()
}
// Rentang tampil (tombol bawah, seperti TradingView).
const RENTANG = [{ k: '1m', t: '1M' }, { k: '3m', t: '3M' }, { k: '6m', t: '6M' }, { k: 'ytd', t: 'YTD' }, { k: '1y', t: '1Y' }, { k: '3y', t: '3Y' }, { k: 'all', t: 'Semua' }]
const rentangAktif = ref('1y')
function rentang(k) {
  const b = bars.value
  if (!chart || !b.length) return
  rentangAktif.value = k
  const akhir = new Date(b[b.length - 1].d + 'T00:00:00Z')
  const bulan = { '1m': 1, '3m': 3, '6m': 6, '1y': 12, '3y': 36 }[k]
  let batas = null
  if (bulan) { batas = new Date(akhir); batas.setUTCMonth(batas.getUTCMonth() - bulan) }
  else if (k === 'ytd') batas = new Date(Date.UTC(akhir.getUTCFullYear(), 0, 1))
  const s = batas ? batas.toISOString().slice(0, 10) : ''
  const i0 = Math.max(0, b.findIndex(x => x.d >= s))
  chart.timeScale().setVisibleLogicalRange({ from: Math.min(i0, b.length - 8), to: b.length - 1 + 12 })
}

// Skala harga otomatis ikut memuat gambar aktif (level penting), seperti TradingView saat alat dipasang.
let ekstra = []
function skalaOtomatis() {
  return orig => {
    const r = orig()
    if (!r || !ekstra.length) return r
    const [lo, hi] = [Math.min(...ekstra), Math.max(...ekstra)]
    return { ...r, priceRange: { minValue: Math.min(r.priceRange.minValue, lo), maxValue: Math.max(r.priceRange.maxValue, hi) } }
  }
}
function hargaPenting() {
  const h = hasil.value, out = []
  for (const k of aktif.value) {
    const x = h[k]
    if (!x) continue
    if (k === 'xabcd') out.push(...x.titik.map(t => t.p), ...(x.prz || []))
    if (k === 'fib') out.push(...x.level.filter(l => l.r <= 1).map(l => l.p))
    if (k === 'ext') out.push(...x.level.filter(l => l.r <= 1.27).map(l => l.p))
    if (k === 'elliott') out.push(...x.titik.map(t => t.p), ...(x.proyeksi || []).map(p => p.p))
    if ((k === 'long' || k === 'short') && !x.kosong) out.push(x.entry, x.stop, ...x.target)
  }
  return out.filter(v => v != null && isFinite(v))
}
watch([aktif, hasil], () => {
  ekstra = hargaPenting()
  candle?.applyOptions({ autoscaleInfoProvider: skalaOtomatis() })
  segar()
})
watch(bars, () => isiData(true))
watch(tf, () => { rentangAktif.value = tf.value === 'M' ? 'all' : tf.value === 'W' ? '3y' : '1y' })

// Geser tampilan agar gambar yang baru dipasang terlihat utuh.
function tampilkan(k) {
  const x = hasil.value[k], ts = chart?.timeScale()
  if (!x || !ts) return
  const idx = k === 'fib' ? [x.a.i, x.b.i] : k === 'long' || k === 'short' ? [x.i0 ?? bars.value.length - 1, x.pola?.titik?.[0]?.i ?? x.i0] : (x.titik || []).map(t => t.i)
  const r = ts.getVisibleLogicalRange()
  if (!r || !idx.length) return
  const lo = Math.min(...idx) - 8, hi = Math.max(...idx, bars.value.length - 1) + 12
  // XABCD dengan pola: pola dan candle terbaru di sisi kiri, ruang kosong di kanan untuk gambar pola ideal.
  if (k === 'xabcd' && x.pola) {
    const ujung = Math.max(...idx, bars.value.length - 1), awal = Math.min(...idx) - 6
    ts.setVisibleLogicalRange({ from: awal, to: ujung + Math.max(14, (ujung - awal) * 0.85) })
    return
  }
  // Gambar yang terlalu kecil di layar diperbesar (fokus ke pola); yang terpotong diperlebar.
  if ((k === 'xabcd' || k === 'elliott') && hi - lo < (r.to - r.from) * 0.3) ts.setVisibleLogicalRange({ from: lo - (hi - lo) * 0.4, to: hi })
  else if (lo < r.from || hi > r.to) ts.setVisibleLogicalRange({ from: Math.min(r.from, lo), to: Math.max(r.to, hi) })
}

onMounted(() => {
  bangun()
  observer = new MutationObserver(bangun)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  resizer = new ResizeObserver(segar)
  resizer.observe(elChart.value)
})
onBeforeUnmount(() => { observer?.disconnect(); resizer?.disconnect(); cancelAnimationFrame(raf); chart?.remove(); chart = null })

// --------------------------------------------------------- overlay gambar ----
// Koordinat dihitung ulang setiap kali chart digeser/diperbesar (ver), lalu digambar sebagai SVG di atas panel harga.
const panel = computed(() => {
  ver.value // eslint-disable-line no-unused-expressions
  if (!chart || !elChart.value) return { w: 0, h: 0 }
  return { w: Math.max(0, elChart.value.clientWidth - chart.priceScale('right').width()), h: Math.max(0, elChart.value.clientHeight - chart.timeScale().height()) }
})
const X = i => chart?.timeScale().logicalToCoordinate(i) ?? null
const Y = p => candle?.priceToCoordinate(p) ?? null
const ok = (...v) => v.every(z => z != null && isFinite(z))
const tengah = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const titikXY = ts => ts.map(t => ({ ...t, x: X(t.i), y: Y(t.p) }))
const r2 = v => v == null ? '' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: 3 })

const gambar = computed(() => {
  ver.value // eslint-disable-line no-unused-expressions
  const h = hasil.value, W = panel.value.w, out = {}
  if (!W) return out
  if (aktif.value.includes('xabcd') && h.xabcd) {
    const x = h.xabcd, p = titikXY(x.titik)
    if (p.every(t => ok(t.x, t.y))) {
      const [Xp, A, B, C, D] = p, r = x.rasio || {}
      const garis = [[Xp, B, r.b, 'AB/XA'], [A, C, r.c, 'BC/AB'], [B, D, r.e, 'CD/BC'], [Xp, D, r.d, 'AD/XA']]
      if (x.pola === 'cypher' || x.pola === 'shark') garis.splice(1, 1, [Xp, C, r.cx, 'XC/XA'])
      out.xabcd = {
        bull: x.arah === 'bullish',
        segi: [[Xp, A, B], [B, C, D]].map(s => s.map(t => `${t.x},${t.y}`).join(' ')),
        jalur: p.slice(0, 4).map(t => `${t.x},${t.y}`).join(' '),
        cd: { a: C, b: D, proyeksi: !!D.proyeksi },
        rasio: garis.filter(g => g[2] != null).map(([a, b, v, k]) => ({ a, b, m: tengah(a, b), teks: r2(v), k })),
        titik: p.map((t, j) => ({ ...t, atas: j === 0 ? t.p >= p[1].p : t.p >= (p[j - 1]?.p ?? 0) })),
        prz: x.prz && ok(Y(x.prz[0]), Y(x.prz[1])) ? { x1: C.x, x2: Math.min(W, D.x + Math.max(40, (D.x - C.x) * 0.6)), y1: Y(x.prz[1]), y2: Y(x.prz[0]) } : null,
        label: x.pola ? `${x.nama} ${x.arah}` : 'Swing terakhir (bukan pola)',
        tanda: (() => {
          const c = konf.value?.candle, b = c && bars.value[c.i]
          if (!b) return null
          const bull = x.arah === 'bullish', tx = X(c.i), ty = Y(bull ? b.l : b.h)
          return ok(tx, ty) ? { x: tx, y: bull ? ty + 8 : ty - 8, bull, nama: c.nama } : null
        })(),
      }
    }
  }
  for (const k of ['fib', 'ext']) {
    if (!aktif.value.includes(k) || !h[k]) continue
    const f = h[k], ujung = k === 'fib' ? [f.a, f.b] : f.titik
    const p = titikXY(ujung)
    if (!p.every(t => ok(t.x, t.y))) continue
    const x0 = k === 'fib' ? Math.min(p[0].x, p[1].x) : p[2].x
    out[k] = {
      jalur: p.map(t => `${t.x},${t.y}`).join(' '), titik: p, x0,
      level: f.level.map((l, j) => {
        const y2 = j + 1 < f.level.length ? Y(f.level[j + 1].p) : null
        return { ...l, y: Y(l.p), y2: ok(y2) ? y2 : null, j, kunci: [0.618, 0.786, 0.886, 1.27, 1.618].includes(l.r) }
      })
        .filter(l => ok(l.y)),
    }
  }
  if (aktif.value.includes('elliott') && h.elliott) {
    const e = h.elliott, p = titikXY(e.titik)
    if (p.every(t => ok(t.x, t.y))) {
      const t4 = p[4]
      out.elliott = {
        jalur: p.map(t => `${t.x},${t.y}`).join(' '),
        titik: p.map((t, j) => ({ ...t, atas: j === 0 ? t.p > p[1].p : t.p > p[j - 1].p })),
        proyeksi: t4 && e.proyeksi ? e.proyeksi.map(z => ({ ...z, y: Y(z.p), x1: t4.x, x2: Math.min(W, t4.x + 90) })).filter(z => ok(z.y)) : [],
      }
    }
  }
  for (const k of ['long', 'short']) {
    const s = h[k]
    if (!aktif.value.includes(k) || !s || s.kosong) continue
    const x1 = X(s.i0), x2r = X(s.i0 + Math.max(18, Math.round(bars.value.length * 0.04)))
    const ye = Y(s.entry), ys = Y(s.stop), yt = s.target.map(Y)
    if (!ok(x1, x2r, ye, ys, ...yt)) continue
    out[k] = { x1, x2: Math.min(W - 2, Math.max(x2r, x1 + 120)), ye, ys, yt, s }
  }
  return out
})

const info = computed(() => {
  const b = bars.value, i = legenda.value ?? b.length - 1, x = b[i]
  if (!x) return null
  const prev = b[i - 1]?.c
  return { ...x, ubah: prev ? x.c - prev : null, pct: prev ? (x.c / prev - 1) * 100 : null }
})
const tfNama = computed(() => TF.find(x => x.k === tf.value))
// Rekomendasi timeframe per gaya trading. Data server hanya candle harian ke atas (Stockbit), jadi scalping dan
// intraday ditandai belum tersedia; candle harian tetap dipakai sebagai peta area.
const GAYA = [
  { k: 'scalping', nama: 'Scalping', tf: null, saran: '1–5 menit, konfirmasi 15 menit', ket: 'Posisi menit sampai jam. Butuh candle menit (belum ada di sumber data ini). Pakai 1D di sini hanya untuk menandai PRZ dan support/resistance besar.' },
  { k: 'intraday', nama: 'Intraday', tf: null, saran: '15 menit–1 jam, konfirmasi 4 jam/1D', ket: 'Beli dan jual di hari yang sama. Candle intraday belum tersedia; pakai 1D sebagai arah dan area.' },
  { k: 'swing', nama: 'Swing', tf: 'D', saran: '1D, konfirmasi 1W', ket: 'Posisi beberapa hari sampai minggu. Pola harmonik di 1D, arah tren dicek di 1W.' },
  { k: 'invest', nama: 'Invest', tf: 'W', saran: '1W, konfirmasi 1M', ket: 'Posisi bulanan atau lebih. Pola di 1W dan 1M lebih jarang muncul tetapi lebih kuat (Carney: kaki lebih besar lebih signifikan).' },
]
const gaya = ref('')
const gayaAktif = computed(() => GAYA.find(g => g.k === gaya.value))
function pilihGaya(g) { gaya.value = gaya.value === g.k ? '' : g.k; if (g.tf && gaya.value) tf.value = g.tf }

// ----------------------------------------------------------- panel info ----
const STATUS = { prz: 'D sedang di PRZ', berbalik: 'sudah berbalik dari D', menuju: 'menuju PRZ (D masih proyeksi)', 'tidak cocok': 'rasio belum memenuhi pola mana pun' }
const IDEAL = k => {
  const p = POLA[k]
  if (!p) return {}
  const t = rg => rg[0] === rg[1] ? r2(rg[0]) : `${r2(rg[0])}–${r2(rg[1])}`
  return { b: p.b && t(p.b), c: p.c && t(p.c), cx: p.cx && t(p.cx), d: p.d && t(p.d), dc: p.dc && t(p.dc), e: p.e && t(p.e) }
}
const barisRasio = computed(() => {
  const x = hasil.value.xabcd
  if (!x) return []
  const id = IDEAL(x.pola), r = x.rasio || {}
  const semua = [['b', 'AB/XA (titik B)'], ['c', 'BC/AB (titik C)'], ['cx', 'XC/XA (C melewati A)'], ['d', 'AD/XA (titik D)'], ['dc', 'CD/XC'], ['e', 'CD/BC (proyeksi BC)']]
  // Tanpa pola: rasio dasar XABCD saja; dengan pola: rasio yang dipakai pola itu.
  return semua.filter(([k]) => r[k] != null && (x.pola ? id[k] : ['b', 'c', 'd', 'e'].includes(k))).map(([k, nm]) => [nm, r[k], id[k]])
})
// ------------------------------------------------- gambar pola ideal di ruang kosong chart ----
const insetTutup = ref(false)
const inset = computed(() => {
  const x = hasil.value.xabcd
  if (!aktif.value.includes('xabcd') || !x?.pola) return null
  return { nama: `${x.nama} ${x.arah}`, bull: x.arah === 'bullish', diagram: diagramIdeal(x.pola, x.arah), alasan: alasanPola(x),
    pembeda: PEMBEDA[x.pola], status: STATUS[x.status], prz: x.prz }
})
watch(() => hasil.value.xabcd?.kunci, () => { insetTutup.value = false })
const IW = 268, elInset = ref(), tinggiInset = ref(330)
watch([inset, ver], () => nextTick(() => { const h = elInset.value?.offsetHeight; if (h && Math.abs(h - tinggiInset.value) > 4) tinggiInset.value = h }))
// Sudut dengan candle (dan titik pola) paling sedikit yang tertutup kotak gambar.
const insetPos = computed(() => {
  ver.value // eslint-disable-line no-unused-expressions
  const { w, h } = panel.value, IH = tinggiInset.value
  if (!inset.value || !w || !chart) return null
  const kandidat = [8, (w - IW) / 2, w - IW - 8].flatMap(x => [52, h * 0.78 - IH].map(y => ({ x, y })))
    .filter(c => c.x >= 0 && c.y >= 0)
  if (!kandidat.length) return { x: 8, y: 52 }
  const r = chart.timeScale().getVisibleLogicalRange(), b = bars.value
  const kotak = []
  if (r) for (let i = Math.max(0, Math.floor(r.from)); i <= Math.min(b.length - 1, Math.ceil(r.to)); i++) {
    const x = X(i), y1 = Y(b[i].h), y2 = Y(b[i].l)
    // Candle terbaru (20 bar terakhir) paling penting dilihat: bobot lebih besar agar kotak menghindarinya.
    if (ok(x, y1, y2)) kotak.push({ x, y1, y2, berat: i >= b.length - 20 ? 4 : 1 })
  }
  for (const t of (gambar.value.xabcd?.titik || [])) kotak.push({ x: t.x, y1: t.y - 20, y2: t.y + 20, berat: 40 })
  const skor = c => kotak.reduce((s, k) => s + (k.x >= c.x && k.x <= c.x + IW && k.y2 >= c.y && k.y1 <= c.y + IH ? (k.berat || 1) : 0), 0)
  return kandidat.map(c => ({ ...c, s: skor(c) })).sort((a, b) => a.s - b.s)[0]
})
const DW = 236, DH = 130, DP = 18
const dx = v => DP + v * (DW - 2 * DP), dy = v => DP + v * (DH - 2 * DP)

const teksX = computed(() => alasanX(hasil.value.xabcd, bars.value))

const modal = ref(100000000), risiko = ref(1)
const lot = k => {
  const s = hasil.value[k]
  return s && !s.kosong ? ukuranPosisi({ modal: modal.value, risikoPct: risiko.value, entry: s.entry, stop: s.stop, target: s.target[1] }) : null
}
const jumlahPola = computed(() => polaList.value.length)

// ------------------------------------------------------------- unduh PDF ----
// Foto chart = kanvas lightweight-charts + overlay SVG (gaya dihitung lalu ditanam supaya warna token ikut).
const elOv = ref(), busyPdf = ref(false)
async function fotoChart() {
  if (!chart) return null
  const kanvas = chart.takeScreenshot(), svg = elOv.value
  if (svg) {
    const klon = svg.cloneNode(true), asal = svg.querySelectorAll('*'), salin = klon.querySelectorAll('*')
    const PROP = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-opacity', 'stroke-linejoin', 'opacity', 'font-family', 'font-size', 'font-weight', 'paint-order', 'text-anchor']
    asal.forEach((el, j) => { const cs = getComputedStyle(el); salin[j].setAttribute('style', PROP.map(p => `${p}:${cs.getPropertyValue(p)}`).join(';')) })
    klon.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const img = new Image()
    await new Promise((ok, gagal) => { img.onload = ok; img.onerror = gagal; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(klon)) })
    const sk = kanvas.width / elChart.value.clientWidth
    kanvas.getContext('2d').drawImage(img, 0, 0, panel.value.w * sk, panel.value.h * sk)
  }
  // JPEG (latar chart tidak transparan) jauh lebih kecil dari PNG untuk foto chart.
  return { url: kanvas.toDataURL('image/jpeg', 0.88), w: kanvas.width, h: kanvas.height, jenis: 'JPEG' }
}
async function unduh() {
  if (busyPdf.value || !bars.value.length) return
  busyPdf.value = true
  try {
    const [{ jsPDF }, P] = await Promise.all([import('jspdf'), import('../lib/harmonicViewPdf.js')])
    let foto = null
    try { foto = await fotoChart() } catch { foto = null }
    const x = hasil.value.xabcd
    const doc = P.harmonicViewPdf({
      t: kode.value, nama: nama.value, tfNama: tfNama.value.nama, bars: bars.value, hasil: hasil.value, foto,
      alatAktif: aktif.value.map(k => ALAT.find(a => a.k === k).nama), rasio: barisRasio.value,
      alasan: x?.pola ? alasanPola(x) : [], teksX: teksX.value, pembeda: PEMBEDA[x?.pola] || '', status: STATUS[x?.status] || '',
      kesimpulan: ringkasan.value, konf: konf.value, modal: modal.value, risiko: risiko.value, lot: { long: lot('long'), short: lot('short') },
    }, jsPDF)
    doc.save(P.harmonicViewPdfName(kode.value, tfNama.value.pendek))
  } catch (e) {
    toast('PDF gagal dibuat: ' + (e.message || e), true)
  } finally { busyPdf.value = false }
}
</script>

<template>
  <section class="hp">
    <header class="top">
      <div class="cari" @focusin="bukaCari" @focusout="tutupCari">
        <input v-model="q" :placeholder="kode" aria-label="Cari kode atau nama saham" @keydown.enter="pilih(saran[0]?.t || q)" />
        <ul v-if="cariBuka && saran.length" class="saran" role="listbox">
          <li v-for="s in saran" :key="s.t"><button type="button" @mousedown.prevent="pilih(s.t)"><b>{{ s.t }}</b> {{ s.nama }}</button></li>
        </ul>
      </div>
      <div class="tf" role="group" aria-label="Timeframe">
        <button v-for="x in TF" :key="x.k" type="button" :class="{ on: tf === x.k }" :aria-pressed="String(tf === x.k)" :title="x.nama" @click="tf = x.k">{{ x.pendek }}</button>
      </div>
      <div class="gaya" role="group" aria-label="Rekomendasi timeframe per gaya trading">
        <span class="small mute">Gaya:</span>
        <button v-for="g in GAYA" :key="g.k" type="button" :class="{ on: gaya === g.k, na: !g.tf }" :aria-pressed="String(gaya === g.k)" :title="`${g.nama}: ${g.saran}`" @click="pilihGaya(g)">{{ g.nama }}</button>
      </div>
      <button type="button" class="btn unduh" :disabled="busyPdf || !bars.length" title="Unduh analisa teknikal harmonic yang sedang tampil" @click="unduh">{{ busyPdf ? 'Menyiapkan PDF…' : 'Unduh analisa (PDF)' }}</button>
      <span class="judul">Harmonic Pattern</span>
      <p v-if="gayaAktif" class="gket small"><b>{{ gayaAktif.nama }}: {{ gayaAktif.saran }}.</b> {{ gayaAktif.ket }}</p>
      <span v-if="memuat" class="small mute">Memuat harga…</span>
    </header>

    <div class="body">
      <nav class="tools" aria-label="Alat gambar otomatis">
        <button v-for="a in ALAT" :key="a.k" :ref="el => { if (el) toolEl[a.k] = el }" type="button" class="tool" :class="{ on: aktif.includes(a.k), next: langkahBerikut === a.k }" :aria-pressed="String(aktif.includes(a.k))"
          :title="a.nama + ': gambar otomatis dari chart terakhir'" :disabled="!bars.length" @click="togel(a.k)">
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <template v-if="a.k === 'xabcd'"><path d="M2 17 6 5l4 8 4-6 5 10" /><circle cx="2" cy="17" r="1.4" /><circle cx="6" cy="5" r="1.4" /><circle cx="10" cy="13" r="1.4" /><circle cx="14" cy="7" r="1.4" /><circle cx="19" cy="17" r="1.4" /></template>
            <template v-else-if="a.k === 'fib'"><path d="M3 4h16M3 8.5h16M3 13h16M3 18h16" /><path d="M5 18 17 4" stroke-dasharray="2 2" /></template>
            <template v-else-if="a.k === 'ext'"><path d="M3 18l5-9 4 5" /><path d="M12 6h8M12 10h8M12 14h8" /><circle cx="3" cy="18" r="1.3" /><circle cx="8" cy="9" r="1.3" /><circle cx="12" cy="14" r="1.3" /></template>
            <template v-else-if="a.k === 'elliott'"><path d="M2 18l4-7 3 3 5-10 3 5 3-4" /><text x="1" y="8" font-size="6" fill="currentColor" stroke="none">1</text><text x="17" y="21" font-size="6" fill="currentColor" stroke="none">5</text></template>
            <template v-else-if="a.k === 'long'"><rect x="4" y="3" width="14" height="9" class="ig" /><rect x="4" y="12" width="14" height="6" class="is" /><path d="M2 12h18" /></template>
            <template v-else><rect x="4" y="4" width="14" height="6" class="is" /><rect x="4" y="10" width="14" height="9" class="ig" /><path d="M2 10h18" /></template>
          </svg>
          <span>{{ a.pendek }}</span>
        </button>
        <span class="sep"></span>
        <button type="button" class="tool" title="Hapus semua gambar" :disabled="!aktif.length" @click="hapus">
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 6h14M9 6V4h4v2M6 6l1 13h8l1-13" /></svg>
          <span>Hapus</span>
        </button>
      </nav>

      <div v-if="popup" class="popup" :style="{ top: popup.top + 'px' }" role="status" aria-live="polite">
        <template v-if="popup.selesai">
          <b>Selesai.</b> Kesimpulan dan rencana posisi ada di panel kanan. Tunggu konfirmasi di PRZ sebelum eksekusi.
          <div class="pa"><button type="button" class="mini" @click="panduanTutup = true">Tutup</button></div>
        </template>
        <template v-else>
          <span class="pn">Langkah {{ popup.n }} dari {{ popup.total }}</span>
          <p>{{ popup.teks }}</p>
          <div class="pa">
            <button type="button" class="mini utama" @click="togel(popup.k)">Jalankan</button>
            <button type="button" class="mini" @click="panduanTutup = true">Tutup panduan</button>
          </div>
        </template>
      </div>
      <div class="chartbox">
        <div ref="elChart" class="chart" @wheel.passive="segar" @pointermove="segar" @pointerup="segar" @dblclick="segar"></div>
        <div v-if="info" class="legend">
          <b>{{ kode }}</b><span v-if="nama" class="nm">{{ nama }}</span><span class="mute">· {{ tfNama.pendek }} · IDX</span>
          <span class="ohlc">O <i>{{ fmtH(info.o) }}</i> H <i>{{ fmtH(info.h) }}</i> L <i>{{ fmtH(info.l) }}</i> C <i>{{ fmtH(info.c) }}</i>
            <i v-if="info.ubah != null" :class="info.ubah >= 0 ? 'up' : 'dn'">{{ info.ubah >= 0 ? '+' : '' }}{{ fmtH(info.ubah) }} ({{ fmtP(info.pct) }})</i></span>
          <span class="vol">Vol <i>{{ fmtV(info.v) }} lot</i> · {{ String(info.d) }}</span>
        </div>
        <p v-if="err" class="err" role="alert">{{ err }}</p>
        <div v-if="inset && insetPos && !insetTutup" ref="elInset" class="inset" :style="{ left: insetPos.x + 'px', top: insetPos.y + 'px', width: IW + 'px' }" role="note" aria-label="Pola harmonik terdeteksi">
          <div class="ih"><b :class="inset.bull ? 'up' : 'dn'">{{ inset.nama }}</b><button type="button" class="ix" title="Sembunyikan gambar pola" aria-label="Sembunyikan gambar pola" @click="insetTutup = true">×</button></div>
          <svg :viewBox="`0 0 ${DW} ${DH}`" class="ideal" aria-hidden="true">
            <g v-for="(g, j) in inset.diagram.garis" :key="j">
              <line :x1="dx(g.a.x)" :y1="dy(g.a.y)" :x2="dx(g.b.x)" :y2="dy(g.b.y)" class="ig-r" />
              <text :x="(dx(g.a.x) + dx(g.b.x)) / 2" :y="(dy(g.a.y) + dy(g.b.y)) / 2 - 2" class="ig-rt">{{ g.teks }}</text>
            </g>
            <polyline :points="inset.diagram.titik.map(t => `${dx(t.x)},${dy(t.y)}`).join(' ')" class="ig-j" />
            <circle :cx="dx(1)" :cy="dy(inset.diagram.titik[4].y)" r="6" :class="inset.bull ? 'ig-dg' : 'ig-ds'" />
            <text v-for="(t, j) in inset.diagram.titik" :key="t.n" :x="dx(t.x) + (j === 4 ? 10 : 0)" :y="j === 4 ? dy(t.y) + 4 : t.y <= (inset.diagram.titik[j - 1]?.y ?? inset.diagram.titik[1].y) ? dy(t.y) - 6 : dy(t.y) + 13" class="ig-t">{{ t.n }}</text>
          </svg>
          <p class="ip">{{ teksX[0] }}</p>
          <p class="ip">Kenapa {{ inset.nama.split(' ').slice(0, -1).join(' ') }}: {{ inset.pembeda }}</p>
          <ul class="ia">
            <li v-for="a in inset.alasan" :key="a.teks" :class="a.ok ? 'up' : 'dn'">{{ a.ok ? '✓' : '≈' }} {{ a.teks }} <b>{{ fmtR(a.aktual) }}</b> <span>(ideal {{ a.ideal }})</span></li>
          </ul>
          <p v-if="konf" class="ip"><b>Konfirmasi {{ konf.jumlah }}/{{ konf.total }} ({{ konf.label }})</b>: {{ konf.cek.filter(c => c.ok).map(c => c.k === 'candle' ? c.nama : c.k === 'rsi' ? 'divergence RSI' : c.k === 'struktur' ? 'struktur minor tembus' : 'volume tinggi').join(', ') || 'belum ada' }}.</p>
          <p class="ip">{{ inset.status }}. PRZ {{ fmtH(inset.prz[0]) }}–{{ fmtH(inset.prz[1]) }}: {{ inset.bull ? 'area potensi berbalik naik' : 'area potensi berbalik turun' }}.</p>
        </div>
        <svg v-if="panel.w" ref="elOv" class="ov" :width="panel.w" :height="panel.h" :viewBox="`0 0 ${panel.w} ${panel.h}`" aria-hidden="true">
          <!-- Fib retracement / extension -->
          <g v-for="k in ['fib', 'ext']" :key="k">
            <template v-if="gambar[k]">
              <template v-for="l in gambar[k].level" :key="l.r">
                <rect v-if="l.y2 != null" :x="gambar[k].x0" :width="panel.w - gambar[k].x0" :y="Math.min(l.y, l.y2)" :height="Math.abs(l.y2 - l.y)" class="band" :class="'b' + (l.j % 6)" />
                <line :x1="gambar[k].x0" :x2="panel.w" :y1="l.y" :y2="l.y" class="lvl" :class="['b' + (l.j % 6), { kunci: l.kunci }]" />
                <text :x="gambar[k].x0 + 4" :y="l.y - 3" class="lt" :class="'b' + (l.j % 6)">{{ r2(l.r) }} ({{ fmtH(l.p) }})</text>
              </template>
              <polyline :points="gambar[k].jalur" class="fibjalur" />
              <circle v-for="t in gambar[k].titik" :key="t.i" :cx="t.x" :cy="t.y" r="3.5" class="fibtitik" />
            </template>
          </g>
          <!-- XABCD -->
          <g v-if="gambar.xabcd" class="xabcd" :class="gambar.xabcd.bull ? 'bull' : 'bear'">
            <rect v-if="gambar.xabcd.prz" :x="gambar.xabcd.prz.x1" :width="gambar.xabcd.prz.x2 - gambar.xabcd.prz.x1" :y="Math.min(gambar.xabcd.prz.y1, gambar.xabcd.prz.y2)" :height="Math.max(3, Math.abs(gambar.xabcd.prz.y2 - gambar.xabcd.prz.y1))" class="prz" />
            <text v-if="gambar.xabcd.prz" :x="gambar.xabcd.prz.x2 - 4" :y="Math.min(gambar.xabcd.prz.y1, gambar.xabcd.prz.y2) - 4" class="przt">PRZ</text>
            <polygon v-for="(s, j) in gambar.xabcd.segi" :key="j" :points="s" class="segi" />
            <polyline :points="gambar.xabcd.jalur" class="kaki" />
            <line :x1="gambar.xabcd.cd.a.x" :y1="gambar.xabcd.cd.a.y" :x2="gambar.xabcd.cd.b.x" :y2="gambar.xabcd.cd.b.y" class="kaki" :class="{ proy: gambar.xabcd.cd.proyeksi }" />
            <g v-for="g in gambar.xabcd.rasio" :key="g.k">
              <line :x1="g.a.x" :y1="g.a.y" :x2="g.b.x" :y2="g.b.y" class="rasio" />
              <text :x="g.m.x" :y="g.m.y" class="rt">{{ g.teks }}</text>
            </g>
            <g v-for="t in gambar.xabcd.titik" :key="t.n">
              <circle :cx="t.x" :cy="t.y" r="4" class="pt" :class="{ proy: t.proyeksi }" />
              <text :x="t.x" :y="t.atas ? t.y - 10 : t.y + 19" class="nt">{{ t.n }}</text>
              <text v-if="t.n === 'X'" :x="t.x" :y="t.atas ? t.y - 24 : t.y + 33" class="xket">{{ gambar.xabcd.bull ? 'swing low awal pola' : 'swing high awal pola' }}</text>
            </g>
            <g v-if="gambar.xabcd.tanda" class="tanda">
              <path :d="gambar.xabcd.tanda.bull ? `M${gambar.xabcd.tanda.x},${gambar.xabcd.tanda.y} l-5,9 h10 z` : `M${gambar.xabcd.tanda.x},${gambar.xabcd.tanda.y} l-5,-9 h10 z`" />
              <text :x="gambar.xabcd.tanda.x" :y="gambar.xabcd.tanda.bull ? gambar.xabcd.tanda.y + 21 : gambar.xabcd.tanda.y - 13">{{ gambar.xabcd.tanda.nama }}</text>
            </g>
            <text :x="gambar.xabcd.titik[4].x + 8" :y="gambar.xabcd.titik[4].y + (gambar.xabcd.bull ? 34 : -26)" class="nama">{{ gambar.xabcd.label }}</text>
          </g>
          <!-- Elliott -->
          <g v-if="gambar.elliott" class="ew">
            <polyline :points="gambar.elliott.jalur" class="ewj" />
            <g v-for="p in gambar.elliott.proyeksi" :key="p.k">
              <line :x1="p.x1" :x2="p.x2" :y1="p.y" :y2="p.y" class="ewp" />
              <text :x="p.x2 + 3" :y="p.y + 4" class="ewpt">{{ p.k }} {{ fmtH(p.p) }}</text>
            </g>
            <g v-for="t in gambar.elliott.titik" :key="t.n">
              <circle :cx="t.x" :cy="t.atas ? t.y - 13 : t.y + 13" r="8" class="ewc" />
              <text :x="t.x" :y="(t.atas ? t.y - 13 : t.y + 13) + 4" class="ewt">{{ t.n }}</text>
            </g>
          </g>
          <!-- Long / Short position -->
          <g v-for="k in ['long', 'short']" :key="k">
            <g v-if="gambar[k]" class="pos">
              <rect :x="gambar[k].x1" :width="gambar[k].x2 - gambar[k].x1" :y="Math.min(gambar[k].ye, gambar[k].yt[1])" :height="Math.abs(gambar[k].yt[1] - gambar[k].ye)" class="untung" />
              <rect :x="gambar[k].x1" :width="gambar[k].x2 - gambar[k].x1" :y="Math.min(gambar[k].ye, gambar[k].ys)" :height="Math.abs(gambar[k].ys - gambar[k].ye)" class="rugi" />
              <line :x1="gambar[k].x1" :x2="gambar[k].x2" :y1="gambar[k].yt[0]" :y2="gambar[k].yt[0]" class="t1" />
              <line :x1="gambar[k].x1" :x2="gambar[k].x2" :y1="gambar[k].ye" :y2="gambar[k].ye" class="en" />
              <text :x="gambar[k].x1 + 5" :y="gambar[k].yt[1] + (k === 'long' ? 13 : -5)" class="pt2 g">TP2 {{ fmtH(gambar[k].s.target[1]) }} ({{ fmtP(gambar[k].s.targetPct[1]) }}) · R:R {{ r2(gambar[k].s.rr[1]) }}</text>
              <text :x="gambar[k].x1 + 5" :y="gambar[k].yt[0] + (k === 'long' ? -4 : 12)" class="pt2 g">TP1 {{ fmtH(gambar[k].s.target[0]) }} ({{ fmtP(gambar[k].s.targetPct[0]) }}) · R:R {{ r2(gambar[k].s.rr[0]) }}</text>
              <text :x="gambar[k].x1 + 5" :y="gambar[k].ye + (k === 'long' ? -4 : 12)" class="pt2">{{ k === 'long' ? 'Long' : 'Short' }} · entry {{ fmtH(gambar[k].s.entry) }}</text>
              <text :x="gambar[k].x1 + 5" :y="gambar[k].ys + (k === 'long' ? -4 : 12)" class="pt2 s">SL {{ fmtH(gambar[k].s.stop) }} ({{ fmtP(gambar[k].s.stopPct) }})</text>
            </g>
          </g>
        </svg>
      </div>

      <aside class="info" aria-label="Keterangan alat aktif">
        <article class="kartu langkah">
          <h3>Langkah pakai <button v-if="panduanTutup" type="button" class="mini" @click="panduanTutup = false">Tampilkan pop up</button></h3>
          <ol>
            <li :class="{ done: true }">Pilih saham dan gaya trading (timeframe menyesuaikan). Sekarang: {{ kode }}, {{ tfNama.nama.toLowerCase() }}.</li>
            <li v-for="l in LANGKAH" :key="l.k" :class="{ done: aktif.includes(l.k), now: langkahBerikut === l.k }">
              <button type="button" class="lk" :disabled="!bars.length" @click="aktif.includes(l.k) || togel(l.k)">{{ l.teks }}</button>
            </li>
            <li :class="{ now: selesai }">Hasil akhir: baca kesimpulan di bawah, lalu tunggu konfirmasi di PRZ sebelum eksekusi.</li>
          </ol>
        </article>
        <article v-if="kesimpulan" class="kartu simpul">
          <h3>Kesimpulan {{ kode }} · {{ tfNama.pendek }}</h3>
          <p v-for="(t, j) in kesimpulan" :key="j" class="small">{{ t }}</p>
        </article>
        <article v-for="k in kartu" :key="k" class="kartu">
          <!-- XABCD -->
          <template v-if="k === 'xabcd' && hasil.xabcd">
            <h3>XABCD pattern</h3>
            <p class="besar" :class="hasil.xabcd.arah === 'bullish' ? 'up' : 'dn'">{{ hasil.xabcd.pola ? `${hasil.xabcd.nama} ${hasil.xabcd.arah}` : 'Belum ada pola harmonik' }}</p>
            <p class="small">{{ STATUS[hasil.xabcd.status] }}<template v-if="hasil.xabcd.pola">. {{ hasil.xabcd.ket }}</template></p>
            <p v-if="sepi" class="small dn">Likuiditas rendah ({{ fmtRp(nilaiHarian) }} per hari): pola di saham sepi kurang bisa diandalkan.</p>
            <p v-if="!hasil.xabcd.pola" class="small">Gambar menunjukkan lima swing terakhir apa adanya beserta rasionya, supaya terlihat seberapa jauh dari pola baku.</p>
            <div v-if="jumlahPola > 1" class="ganti">
              <button type="button" class="mini" @click="pilihPola = (pilihPola + jumlahPola - 1) % jumlahPola">‹</button>
              <span class="small">Pola {{ pilihPola + 1 }} dari {{ jumlahPola }}</span>
              <button type="button" class="mini" @click="pilihPola = (pilihPola + 1) % jumlahPola">›</button>
            </div>
            <table class="tb">
              <thead><tr><th>Rasio</th><th>Aktual</th><th v-if="hasil.xabcd.pola">Ideal</th></tr></thead>
              <tbody><tr v-for="b in barisRasio" :key="b[0]"><td>{{ b[0] }}</td><td>{{ fmtR(b[1]) }}</td><td v-if="hasil.xabcd.pola">{{ b[2] }}</td></tr></tbody>
            </table>
            <div v-if="hasil.xabcd.pola" class="konf">
              <b>Konfirmasi di D: {{ konf ? `${konf.jumlah} dari ${konf.total} (${konf.label})` : 'menunggu D terbentuk' }}</b>
              <ul v-if="konf" class="cek">
                <li v-for="c in konf.cek" :key="c.k" :class="c.ok ? 'up' : 'mute'">{{ c.ok ? '✓' : '·' }} {{ c.teks }}</li>
              </ul>
              <p v-else class="small">Konfirmasi baru bisa dinilai setelah harga masuk PRZ dan membentuk titik D.</p>
            </div>
            <details class="kx" open>
              <summary>Kenapa titik X di sini?</summary>
              <p v-for="(t, j) in teksX" :key="j" class="small">{{ t }}</p>
            </details>
            <dl v-if="hasil.xabcd.pola" class="dl">
              <dt>PRZ</dt><dd>{{ fmtH(hasil.xabcd.prz[0]) }}–{{ fmtH(hasil.xabcd.prz[1]) }}</dd>
              <dt>Stop (pola batal)</dt><dd class="dn">{{ fmtH(hasil.xabcd.stop) }}</dd>
              <dt>Target 1 · 0,382 AD</dt><dd class="up">{{ fmtH(hasil.xabcd.target[0]) }}</dd>
              <dt>Target 2 · 0,618 AD</dt><dd class="up">{{ fmtH(hasil.xabcd.target[1]) }}</dd>
            </dl>
          </template>
          <!-- Fib -->
          <template v-else-if="(k === 'fib' || k === 'ext') && hasil[k]">
            <h3>{{ k === 'fib' ? 'Fib retracement' : 'Trend-based fib extension' }}</h3>
            <p class="small">Dasar: {{ hasil[k].dasar }}.<template v-if="k === 'fib' && hasil.fib.posisi != null"> Harga terakhir di retracement {{ fmtR(hasil.fib.posisi) }}.</template></p>
            <table class="tb">
              <tbody><tr v-for="l in hasil[k].level" :key="l.r" :class="{ kunci: [0.618, 0.786, 0.886, 1.27, 1.618].includes(l.r) }"><td>{{ r2(l.r) }}</td><td>{{ fmtH(l.p) }}</td></tr></tbody>
            </table>
          </template>
          <!-- Elliott -->
          <template v-else-if="k === 'elliott'">
            <h3>Elliott impulse wave</h3>
            <template v-if="hasil.elliott">
              <p class="besar" :class="hasil.elliott.naik ? 'up' : 'dn'">Impuls {{ hasil.elliott.naik ? 'naik' : 'turun' }} · {{ hasil.elliott.status }}</p>
              <ul class="cek">
                <li v-for="a in hasil.elliott.aturan" :key="a.teks" :class="a.ok ? 'up' : 'dn'">{{ a.ok ? '✓' : '✗' }} {{ a.teks }}</li>
              </ul>
              <table class="tb">
                <thead><tr><th>Rasio</th><th>Aktual</th><th>Panduan</th></tr></thead>
                <tbody><tr v-for="p in hasil.elliott.panduan" :key="p.k"><td>{{ p.k }}</td><td>{{ fmtR(p.v) }}</td><td>{{ p.ideal }}</td></tr></tbody>
              </table>
              <dl v-if="hasil.elliott.proyeksi" class="dl"><template v-for="p in hasil.elliott.proyeksi" :key="p.k"><dt>{{ p.k }}</dt><dd>{{ fmtH(p.p) }}</dd></template></dl>
            </template>
            <p v-else class="small">Belum ada rangkaian swing terbaru yang memenuhi aturan impuls lima gelombang di timeframe ini. Coba timeframe lain.</p>
          </template>
          <!-- Long / Short -->
          <template v-else-if="k === 'long' || k === 'short'">
            <h3>{{ k === 'long' ? 'Long position' : 'Short position' }}</h3>
            <template v-if="hasil[k] && !hasil[k].kosong">
              <p class="besar">{{ hasil[k].pola ? `${hasil[k].pola.nama} ${hasil[k].pola.arah}` : 'Tanpa pola harmonik searah' }}</p>
              <p class="small">Dasar: {{ hasil[k].dasar }} · {{ hasil[k].aktif }}.</p>
              <p v-if="hasil[k].pola && hasil[k].pola === polaAcuan" class="small" :class="konf && konf.jumlah >= 2 ? 'up' : 'dn'">{{ konf ? `Konfirmasi di D ${konf.jumlah}/${konf.total} (${konf.label})${konf.jumlah < 2 ? ': tunggu konfirmasi sebelum entry.' : '.'}` : 'D belum terbentuk: entry menunggu harga masuk PRZ dan konfirmasi.' }}</p>
              <dl class="dl">
                <dt>Entry</dt><dd>{{ fmtH(hasil[k].entry) }}</dd>
                <dt>Stop loss</dt><dd class="dn">{{ fmtH(hasil[k].stop) }} ({{ fmtP(hasil[k].stopPct) }})</dd>
                <dt>Take profit 1</dt><dd class="up">{{ fmtH(hasil[k].target[0]) }} ({{ fmtP(hasil[k].targetPct[0]) }}) · R:R {{ r2(hasil[k].rr[0]) }}</dd>
                <dt>Take profit 2</dt><dd class="up">{{ fmtH(hasil[k].target[1]) }} ({{ fmtP(hasil[k].targetPct[1]) }}) · R:R {{ r2(hasil[k].rr[1]) }}</dd>
                <dt>Harga terakhir</dt><dd>{{ fmtH(hasil[k].harga) }}</dd>
              </dl>
              <div class="lot">
                <label>Modal (Rp) <input v-model.number="modal" type="number" min="0" step="1000000" /></label>
                <label>Risiko per transaksi (%) <input v-model.number="risiko" type="number" min="0.1" max="10" step="0.1" /></label>
                <p v-if="lot(k)" class="small">Ukuran posisi: <b>{{ lot(k).lot.toLocaleString('id-ID') }} lot</b> (Rp{{ fmtH(lot(k).nilai) }}, {{ lot(k).pctModal }}% modal); rugi maksimal bila kena stop Rp{{ fmtH(lot(k).rugiMaks) }}.<template v-if="!lot(k).cukup"> Nilai posisi melebihi modal.</template></p>
              </div>
              <p v-if="k === 'short'" class="small catatan">Short selling di BEI hanya untuk saham dalam daftar efek short selling dan lewat anggota bursa yang berizin. Bagi yang tidak bisa short, pakai sebagai rencana jual atau ambil untung.</p>
            </template>
            <p v-else class="small">{{ hasil[k]?.catatan || 'Rencana posisi belum bisa dihitung dari data ini.' }}</p>
          </template>
        </article>
      </aside>
    </div>

    <footer class="bawah">
      <div class="rg" role="group" aria-label="Rentang tampil">
        <button v-for="r in RENTANG" :key="r.k" type="button" :class="{ on: rentangAktif === r.k }" @click="rentang(r.k)">{{ r.t }}</button>
      </div>
      <span class="small mute">Candle {{ tfNama.nama.toLowerCase() }} Stockbit {{ tf === 'D' ? '1 tahun' : '3 tahun' }}{{ tf === 'M' ? ' (gabungan candle mingguan)' : '' }} · {{ bars.length }} bar</span>
    </footer>

    <section class="panduan">
      <h2>Fungsi setiap tombol</h2>
      <div class="grid">
        <article>
          <h3>XABCD pattern</h3>
          <p>Menandai lima swing terakhir X-A-B-C-D, lalu mencocokkan rasio Fibonacci antarkaki dengan pola harmonik: Gartley, Bat, Alternate Bat, Butterfly, Crab, Deep Crab, Cypher, dan Shark.
            Kotak PRZ (Potential Reversal Zone) adalah area tempat D diperkirakan selesai dan harga berpotensi berbalik. Bullish berarti potensi naik dari D, bearish potensi turun.
            Bila ada beberapa pola, tombol ‹ › di panel kanan berpindah antarpola. Pola batal bila harga menembus X (Gartley, Bat, Cypher) atau sisi luar PRZ.</p>
        </article>
        <article>
          <h3>Cara menentukan titik X</h3>
          <p>X adalah awal pola. Untuk pola bullish, X adalah swing low (lembah) sebelum kenaikan XA. Untuk pola bearish, X adalah swing high (puncak) sebelum penurunan XA. Langkahnya:
            (1) cari lembah atau puncak yang jelas, yaitu titik yang kemudian ditinggalkan harga dengan gerak cukup besar (zigzag, di sini minimal 4–15% tergantung timeframe);
            (2) tarik kaki XA ke puncak atau lembah berikutnya;
            (3) cek titik B: harus di retracement 0,382–0,886 XA. Bila di luar itu, kemungkinan X salah, coba swing sebelumnya;
            (4) setelah semua titik cocok, X juga menjadi batas batal pola (kecuali pola yang D-nya memang melewati X).
            Halaman ini menjalankan langkah itu otomatis di semua skala swing dan memilih X yang membuat rasio paling cocok.</p>
        </article>
        <article>
          <h3>Fib retracement</h3>
          <p>Mengukur seberapa dalam koreksi terhadap satu kaki harga. Bila ada pola harmonik, alat dipasang di kaki XA. Letak B dibaca di 0,382–0,886, dan letak D dibaca di 0,786 atau 0,886 untuk pola retracement, serta di 1,13–1,618 untuk pola ekstensi.
            Tanpa pola, alat dipasang pada swing terakhir yang sudah selesai. Garis tebal adalah rasio kunci harmonic.</p>
        </article>
        <article>
          <h3>Trend-based fib extension</h3>
          <p>Memproyeksikan panjang kaki pertama dari titik ketiga. Dalam harmonic, ini berarti kaki AB diproyeksikan dari C (AB=CD). Level 1 berarti CD sama panjang dengan AB, sedangkan 1,27 dan 1,618 adalah AB=CD alternatif.
            Dipakai untuk memastikan PRZ dan mencari target lanjutan.</p>
        </article>
        <article>
          <h3>Elliott impulse wave (1-2-3-4-5)</h3>
          <p>Membaca tren lima gelombang: 1, 3, dan 5 searah tren, sedangkan 2 dan 4 adalah koreksi. Tiga aturan baku dicek otomatis: gelombang 2 tidak melewati awal gelombang 1, gelombang 3 bukan yang terpendek, dan gelombang 4 tidak masuk wilayah gelombang 1.
            Rasio panduan Fibonacci (W2 0,5–0,618, W3 1,618, W4 0,382) menghubungkannya dengan harmonic. Pola bullish di akhir gelombang 2 atau 4 umumnya lebih layak daripada di akhir gelombang 5.</p>
        </article>
        <article>
          <h3>Long position</h3>
          <p>Rencana beli dari pola bullish:
            <b>Entry:</b> di D, atau di tepi atas PRZ bila D masih proyeksi.
            <b>Stop loss:</b> satu fraksi di bawah X, atau di bawah PRZ untuk pola ekstensi.
            <b>Take profit:</b> TP1 di retracement 0,382 kaki AD, TP2 di 0,618 AD.
            Kotak hijau adalah area untung dan kotak merah area rugi. R:R adalah jarak target dibagi jarak stop. Tanpa pola bullish, rencana dihitung dari harga terakhir dengan stop di bawah swing low terakhir.</p>
        </article>
        <article>
          <h3>Short position</h3>
          <p>Kebalikan dari Long position, untuk pola bearish:
            <b>Entry:</b> di D.
            <b>Stop loss:</b> di atas X atau di atas PRZ.
            <b>Take profit:</b> turun ke 0,382 dan 0,618 kaki AD.
            Di BEI, short selling terbatas pada saham dan anggota bursa tertentu. Untuk investor ritel, rencana ini lebih berguna sebagai tanda ambil untung atau menahan diri dari membeli.</p>
        </article>
      </div>
      <h3>Khusus saham BEI</h3>
      <ul class="small rek">
        <li>Saham BEI hanya diperdagangkan di jam bursa dan sering bergerak dengan gap antarhari, jadi pola di candle harian dan mingguan lebih bersih daripada timeframe kecil.</li>
        <li>Batas auto reject (ARB/ARA) dan gap pagi bisa membuat harga melompati seluruh PRZ. Menurut Carney, gap yang melompati seluruh PRZ tanpa mengujinya adalah tanda peringatan; tunggu bar berikutnya.</li>
        <li>Likuiditas: pakai saham dengan nilai transaksi rata-rata minimal sekitar Rp1 miliar per hari. Saham sepi membentuk swing acak dan sulit dieksekusi di harga rencana. Peringatannya muncul otomatis di panel.</li>
        <li>Aksi korporasi (stock split, reverse split, rights issue, saham bonus) mengubah harga historis. Pastikan swing X sampai D tidak terpotong oleh aksi korporasi sebelum memakai rasio.</li>
        <li>Lot 100 lembar dan fraksi harga BEI sudah dipakai di rencana posisi. Short selling terbatas pada saham dan anggota bursa tertentu, jadi pola bearish bagi investor ritel adalah tanda jual, ambil untung, atau menunda beli.</li>
        <li>Cek notasi khusus, UMA, dan suspensi sebelum masuk. Saham yang disuspensi tidak bisa dijual di stop loss.</li>
        <li>Rasio di halaman ini mengikuti Carney (lebih ketat) dengan toleransi ±5%. Rentang yang lebih longgar memang menemukan lebih banyak pola, tetapi juga lebih banyak sinyal palsu.</li>
        <li>Putuskan ambil atau lewati dari R:R. Stop di luar PRZ, dan bila target tidak sebanding dengan stop (R:R di bawah 2), cari entry lain atau tunggu.</li>
      </ul>
      <h3>Rekomendasi timeframe per gaya trading</h3>
      <table class="tg">
        <thead><tr><th>Gaya</th><th>Timeframe utama</th><th>Konfirmasi</th><th>Di halaman ini</th></tr></thead>
        <tbody>
          <tr><td>Scalping</td><td>1–5 menit</td><td>15 menit</td><td>Belum tersedia (data menit belum ada); 1D untuk peta area</td></tr>
          <tr><td>Intraday</td><td>15 menit–1 jam</td><td>4 jam / 1D</td><td>Belum tersedia; 1D untuk arah dan area</td></tr>
          <tr><td>Swing</td><td>1D</td><td>1W</td><td>Tersedia</td></tr>
          <tr><td>Invest</td><td>1W</td><td>1M</td><td>Tersedia</td></tr>
        </tbody>
      </table>
      <p class="small mute">Prinsipnya: cari pola di timeframe utama, lalu pastikan arahnya tidak melawan timeframe di atasnya. Semakin kecil timeframe, semakin banyak pola palsu.</p>
      <h3>Tambahan di halaman ini</h3>
      <ul class="small rek">
        <li>Timeframe harian, mingguan, dan bulanan. Pola di timeframe lebih besar lebih kuat (Carney). Cocokkan pola harian dengan arah mingguan sebelum masuk.</li>
        <li>Ukuran posisi dalam lot dari modal dan risiko per transaksi (umumnya 1–2%), supaya kerugian saat kena stop sudah diketahui sebelum masuk.</li>
        <li>Harga entry, stop, dan target dibulatkan ke fraksi harga BEI.</li>
        <li>Tunggu konfirmasi di PRZ (candle pembalikan, volume) sebelum masuk. PRZ adalah zona, bukan satu titik harga. Saham yang sepi transaksi sering membentuk swing yang kurang representatif.</li>
      </ul>
      <p class="small mute">Rasio mengikuti Scott M. Carney, <i>Harmonic Trading Vol. 1</i>, artikel Astronacci tentang harmonic pattern dan area entry, serta artikel Maxco. Ini bahan analisa teknikal, bukan saran investasi.</p>
    </section>
  </section>
</template>

<style scoped>
.hp{display:grid;gap:0;min-width:0}
.top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 10px;background:var(--sheet);border:1px solid var(--rule);border-bottom:0}
.cari{position:relative}
.cari input{width:150px;font:700 14px var(--f-data);padding:6px 10px;border:1px solid var(--rule);border-radius:6px;background:var(--sheet-2);color:var(--ink);text-transform:uppercase}
.cari input::placeholder{color:var(--ink);opacity:1}
.saran{position:absolute;z-index:20;top:100%;left:0;min-width:280px;list-style:none;margin:4px 0 0;padding:4px;background:var(--sheet);border:1px solid var(--rule);box-shadow:var(--shadow);border-radius:6px}
.saran button{width:100%;text-align:left;background:none;border:0;padding:6px 8px;color:var(--ink);cursor:pointer;font:13px var(--f-body);border-radius:4px}
.saran button:hover{background:var(--zebra)}
.tf,.rg{display:flex;gap:2px}
.tf button,.rg button{background:none;border:0;padding:5px 9px;border-radius:5px;font:600 13px var(--f-data);color:var(--ink-2);cursor:pointer}
.tf button:hover,.rg button:hover{background:var(--zebra);color:var(--ink)}
.tf button.on,.rg button.on{background:var(--accent-soft);color:var(--accent-ink)}
.gaya{display:flex;align-items:center;gap:2px;flex-wrap:wrap}
.gaya button{background:none;border:1px solid var(--rule);padding:3px 8px;border-radius:12px;font:600 12px var(--f-body);color:var(--ink-2);cursor:pointer}
.gaya button.on{background:var(--accent-soft);color:var(--accent-ink);border-color:transparent}
.gaya button.na{border-style:dashed}
.gket{flex-basis:100%;margin:0;color:var(--ink)}
.judul{font-family:var(--f-display);font-size:18px;color:var(--ink)}
.unduh{margin-left:auto}
.mute{color:var(--ink-2)}
.body{position:relative;display:grid;grid-template-columns:62px minmax(0,1fr) 300px;border:1px solid var(--rule);background:var(--sheet);min-height:600px}
.popup{position:absolute;left:64px;z-index:6;width:250px;background:var(--ink);color:var(--sheet);border-radius:8px;padding:9px 11px;font-size:12px;line-height:1.45;box-shadow:var(--shadow)}
.popup::before{content:'';position:absolute;left:-6px;top:14px;border:6px solid transparent;border-left:0;border-right-color:var(--ink)}
.popup p{margin:3px 0 6px}
.pn{font-weight:700;opacity:.75;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
.pa{display:flex;gap:6px;margin-top:4px}
.popup .mini{background:transparent;color:var(--sheet);border-color:currentColor}
.popup .mini.utama{background:var(--sheet);color:var(--ink)}
.tools{display:flex;flex-direction:column;gap:2px;padding:6px 4px;border-right:1px solid var(--rule)}
.tool{display:grid;justify-items:center;gap:2px;padding:7px 2px;border:0;border-radius:6px;background:none;color:var(--ink);cursor:pointer;font:600 10px var(--f-body)}
.tool:hover:not(:disabled){background:var(--zebra)}
.tool.on{background:var(--accent-soft);color:var(--accent-ink)}
.tool:disabled{opacity:.4;cursor:default}
.tool .ig{fill:var(--good-bg);stroke:var(--good)}.tool .is{fill:var(--strong-bg);stroke:var(--strong)}
.tool.next{outline:2px solid var(--accent);outline-offset:-2px;animation:kedip 1.4s ease-in-out infinite}
@keyframes kedip{50%{outline-color:transparent}}
@media (prefers-reduced-motion: reduce){.tool.next{animation:none}}
.langkah ol{margin:0;padding-left:18px;display:grid;gap:4px;font-size:12px}
.langkah li{color:var(--ink-2)}
.langkah li.done{color:var(--good)}
.langkah li.now{color:var(--ink);font-weight:700}
.lk{background:none;border:0;padding:0;font:inherit;color:inherit;text-align:left;cursor:pointer}
.lk:hover{text-decoration:underline}
.simpul{border-color:var(--accent);background:var(--accent-soft)}
.simpul p.small{color:var(--ink) !important}
.sep{height:1px;background:var(--rule);margin:6px 4px}
.chartbox{position:relative;min-width:0;height:600px}
.chart{position:absolute;inset:0}
.legend{position:absolute;top:6px;left:8px;z-index:3;display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline;font:12px var(--f-data);color:var(--ink);pointer-events:none;max-width:calc(100% - 90px)}
.legend .nm{color:var(--ink-2)}
.legend i{font-style:normal;color:var(--ink)}
.legend .up{color:var(--good)}.legend .dn{color:var(--strong)}
.legend .vol{flex-basis:100%;color:var(--ink-2)}
.err{position:absolute;top:44px;left:10px;z-index:3;color:var(--strong);background:var(--strong-bg);padding:6px 10px;border-radius:6px;margin:0}
.ov{position:absolute;top:0;left:0;z-index:2;pointer-events:none;overflow:hidden}
.ov text{font-family:var(--f-data);font-size:11px;paint-order:stroke;stroke:var(--sheet);stroke-width:3px;stroke-linejoin:round}
/* Fibonacci: warna bergantian seperti alat fib TradingView, dari token. */
.band{opacity:.07}
.band.b0{fill:var(--ink-2)}.band.b1{fill:var(--strong)}.band.b2{fill:var(--warn)}.band.b3{fill:var(--good)}.band.b4{fill:var(--viz-a)}.band.b5{fill:var(--viz-b)}
.lvl{stroke-width:1;opacity:.8}.lvl.kunci{stroke-width:2;opacity:1}
.lvl.b0,.lt.b0{stroke:var(--ink-2);fill:var(--ink-2)}.lvl.b1,.lt.b1{stroke:var(--strong);fill:var(--strong)}.lvl.b2,.lt.b2{stroke:var(--warn);fill:var(--warn)}
.lvl.b3,.lt.b3{stroke:var(--good);fill:var(--good)}.lvl.b4,.lt.b4{stroke:var(--viz-a);fill:var(--viz-a)}.lvl.b5,.lt.b5{stroke:var(--viz-b);fill:var(--viz-b)}
.ov text.lt{stroke:var(--sheet);font-weight:600}
.fibjalur{fill:none;stroke:var(--ink-2);stroke-dasharray:4 4;stroke-width:1.2}
.fibtitik{fill:var(--sheet);stroke:var(--ink-2);stroke-width:1.5}
/* XABCD */
.xabcd.bull{--pc:var(--viz-a)}.xabcd.bear{--pc:var(--viz-c)}
.segi{fill:var(--pc);fill-opacity:.14;stroke:none}
.kaki{fill:none;stroke:var(--pc);stroke-width:2.2;stroke-linejoin:round}.kaki.proy{stroke-dasharray:6 4}
.rasio{stroke:var(--pc);stroke-dasharray:3 4;stroke-width:1}
.rt{fill:var(--ink);text-anchor:middle;font-weight:600}
.pt{fill:var(--sheet);stroke:var(--pc);stroke-width:2}.pt.proy{stroke-dasharray:2 2}
.nt{fill:var(--pc);text-anchor:middle;font-weight:800;font-size:13px !important}
.xket{fill:var(--ink-2);text-anchor:middle;font-size:10px !important}
.konf{margin:6px 0;font-size:12px}
.kx{margin:6px 0;font-size:12px}.kx summary{cursor:pointer;font-weight:700;color:var(--ink)}.kx p.small{margin:4px 0 0 !important;color:var(--ink) !important}
.tanda path{fill:var(--good);stroke:none}.tanda text{fill:var(--good);text-anchor:middle;font-weight:700;font-size:10px !important}
.bear .tanda path{fill:var(--strong)}.bear .tanda text{fill:var(--strong)}
.nama{fill:var(--pc);font-weight:700;font-size:12px !important}
.prz{fill:var(--warn-bg);stroke:var(--warn);stroke-dasharray:4 3;opacity:.85}
.przt{fill:var(--warn);text-anchor:end;font-weight:700}
/* Elliott */
.ewj{fill:none;stroke:var(--viz-b);stroke-width:2;stroke-linejoin:round}
.ewc{fill:var(--sheet);stroke:var(--viz-b);stroke-width:1.5}
.ewt{fill:var(--viz-b);text-anchor:middle;font-weight:800;stroke:none !important}
.ewp{stroke:var(--viz-b);stroke-dasharray:5 4}
.ewpt{fill:var(--viz-b);font-weight:600}
/* Posisi */
.untung{fill:var(--good);fill-opacity:.18;stroke:var(--good);stroke-opacity:.5}
.rugi{fill:var(--strong);fill-opacity:.18;stroke:var(--strong);stroke-opacity:.5}
.t1{stroke:var(--good);stroke-dasharray:4 3}
.en{stroke:var(--ink);stroke-width:1.5}
.pt2{fill:var(--ink);font-weight:700}.pt2.g{fill:var(--good)}.pt2.s{fill:var(--strong)}
/* Panel kanan */
.info{border-left:1px solid var(--rule);padding:10px;overflow:auto;max-height:600px;display:grid;align-content:start;gap:10px}
.kosong{color:var(--ink-2);font-size:13px;margin:0}
.kartu{border:1px solid var(--rule);border-radius:8px;padding:10px;background:var(--sheet-2)}
.kartu h3{margin:0 0 4px;font:700 12px var(--f-body);text-transform:uppercase;letter-spacing:.04em;color:var(--ink-2)}
.besar{font:700 16px var(--f-display);margin:0 0 4px}
.up{color:var(--good)}.dn{color:var(--strong)}
.small{font-size:12px}
.kartu p.small{margin:0 0 6px;color:var(--ink-2)}
.tb{width:100%;border-collapse:collapse;font:12px var(--f-data);margin:4px 0}
.tb th,.tb td{text-align:left;padding:3px 4px;border-bottom:1px solid var(--rule-2)}
.tb th{color:var(--ink-2);font-weight:600}
.tb tr.kunci td{font-weight:700}
.dl{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;margin:6px 0 0;font:12px var(--f-data)}
.dl dt{color:var(--ink-2)}.dl dd{margin:0;font-weight:700}
.cek{list-style:none;padding:0;margin:4px 0;font-size:12px;display:grid;gap:2px}
.ganti{display:flex;align-items:center;gap:6px;margin:4px 0}
.mini{border:1px solid var(--rule);background:var(--sheet);color:var(--ink);border-radius:4px;padding:1px 8px;cursor:pointer}
.lot{display:grid;gap:4px;margin-top:8px;font-size:12px}
.lot label{display:flex;justify-content:space-between;gap:8px;align-items:center;color:var(--ink-2)}
.lot input{width:120px;font:12px var(--f-data);padding:3px 6px;border:1px solid var(--rule);border-radius:4px;background:var(--sheet);color:var(--ink)}
.catatan{margin-top:6px !important}
.bawah{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:6px 10px;background:var(--sheet);border:1px solid var(--rule);border-top:0}
.bawah .small{margin-left:auto}
.inset{position:absolute;z-index:4;background:var(--sheet);border:1px solid var(--rule);border-radius:8px;box-shadow:var(--shadow);padding:8px 10px;font-size:11.5px;line-height:1.4;opacity:.96}
.ih{display:flex;justify-content:space-between;align-items:center;font:700 14px var(--f-display)}
.ix{border:0;background:none;color:var(--ink-2);font-size:18px;line-height:1;cursor:pointer;padding:0 2px}
.ideal{width:100%;height:auto;display:block;margin:2px 0}
.ig-j{fill:none;stroke:var(--ink);stroke-width:2;stroke-linejoin:round}
.ig-r{stroke:var(--ink-2);stroke-dasharray:3 3;stroke-width:1}
.ig-rt{font:600 9px var(--f-data);fill:var(--ink);text-anchor:middle;paint-order:stroke;stroke:var(--sheet);stroke-width:3px}
.ig-t{font:800 11px var(--f-data);fill:var(--ink);text-anchor:middle}
.ig-dg{fill:var(--good);opacity:.55}.ig-ds{fill:var(--strong);opacity:.55}
.ip{margin:4px 0;color:var(--ink)}
.ia{list-style:none;padding:0;margin:2px 0;display:grid;gap:1px;font-family:var(--f-data)}
.ia span{color:var(--ink-2)}
.panduan{margin-top:18px}
.panduan h2{font-family:var(--f-display);margin:0 0 10px}
.panduan .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}
.panduan article{border:1px solid var(--rule);background:var(--sheet);border-radius:8px;padding:12px}
.panduan article h3{margin:0 0 6px;font-size:15px}
.panduan article p{margin:0;font-size:13px;line-height:1.55;color:var(--ink)}
.panduan > h3{margin:16px 0 6px}
.tg{border-collapse:collapse;font-size:13px;margin:4px 0 6px;background:var(--sheet)}
.tg th,.tg td{border:1px solid var(--rule);padding:5px 10px;text-align:left}
.tg th{color:var(--ink-2);font-weight:600}
.rek{margin:0 0 10px;padding-left:18px;display:grid;gap:4px}
@media (max-width: 1100px){
  .body{grid-template-columns:56px minmax(0,1fr)}
  .info{grid-column:1 / -1;border-left:0;border-top:1px solid var(--rule);max-height:none}
}
@media (max-width: 640px){
  .chartbox{height:440px}
  .judul{display:none}
}
</style>
