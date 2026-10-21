// Siklus saham backdoor dari /api/benchmark: tiap transaksi punya deret [hari sejak PTW, harga ÷ harga saat PTW].
// Model = kurva median & kuartil per 10 hari, titik dasar/puncak median; fase tiap emiten dihitung dari model ini.
import { num } from './domain.js'

export const CYC_MIN = -240, CYC_MAX = 720, CYC_STEP = 10

// Interpolasi linier deret s pada hari x; null di luar rentang deret.
export function seriesAt(s, x) {
  if (x < s[0][0] || x > s[s.length - 1][0]) return null
  const i = s.findIndex(p => p[0] >= x)
  if (i <= 0) return s[0][1]
  const [x0, y0] = s[i - 1], [x1, y1] = s[i]
  return y0 + (y1 - y0) * (x - x0) / ((x1 - x0) || 1)
}

// Kuantil f (0..1) dengan interpolasi linier.
export function quantile(arr, f) {
  const s = [...arr].sort((a, b) => a - b), i = (s.length - 1) * f, lo = Math.floor(i), hi = Math.ceil(i)
  return s[lo] + (s[hi] - s[lo]) * (i - lo)
}
const median = arr => arr.length ? quantile(arr, 0.5) : null

export function cycleModel(bm) {
  const deals = (bm?.deals || []).filter(r => r.series?.length > 10)
  const pts = []
  for (let x = CYC_MIN; x <= CYC_MAX; x += CYC_STEP) {
    const ys = deals.map(d => seriesAt(d.series, x)).filter(v => v != null && v > 0)
    // Titik kurva hanya bila minimal 5 transaksi punya harga pada hari itu.
    if (ys.length >= 5) pts.push({ x, n: ys.length, q1: quantile(ys, 0.25), md: quantile(ys, 0.5), q3: quantile(ys, 0.75) })
  }
  return {
    deals, pts, n: deals.length,
    baseDay: median(deals.map(d => d.baseDay).filter(v => v != null)),
    peakDay: median(deals.map(d => d.peakDay).filter(v => v != null)),
    peakX: median(deals.filter(d => d.peak && d.p0).map(d => d.peak / d.p0)),
    baseX: median(deals.filter(d => d.base && d.p0).map(d => d.base / d.p0)),
  }
}

export const CYCLE_PHASES = [
  { id: 'pra', name: 'Akumulasi & rumor', tip: 'Sebelum PTW: harga merangkak dari titik dasar saat kabar pengambilalihan beredar.' },
  { id: 'ptw', name: 'PTW berjalan', tip: 'Tender offer dibuka: harga cenderung ditopang harga tender.' },
  { id: 'euf', name: 'Euforia berlanjut', tip: 'Sesudah PTW harga masih di atas kuartil 3 kurva siklus, lebih tinggi dari kebanyakan kasus serupa.' },
  { id: 'dist', name: 'Distribusi & koreksi', tip: 'Harga turun dari puncak; pemegang lama dan spekulan melepas saham.' },
  { id: 'bawah', name: 'Di bawah harga PTW', tip: 'Pasar meragukan rencana: harga di bawah biaya masuk pengendali.' },
  { id: 'inj', name: 'Injeksi aset (gelombang 2)', tip: 'Aset sudah atau sedang masuk: nilai ditentukan kualitas aset, bukan cerita.' },
]
export const phaseName = id => CYCLE_PHASES.find(p => p.id === id)?.name || ''

export const daysSince = (iso, now = Date.now()) => Math.round((now - new Date(String(iso).slice(0, 10) + 'T00:00:00')) / 864e5)

// Harga kini ÷ harga saat PTW: dari benchmark bila transaksinya ada, selain itu harga radar ÷ harga tender.
export function ratioOf(d, model) {
  const deal = model.deals.find(x => x.ticker === d.ticker)
  if (deal?.p0 && deal.last) return deal.last / deal.p0
  const p = num(d.price)
  return p && d.tender?.price ? p / d.tender.price : null
}

// Fase siklus emiten d. ms = tahapan (default d.ms; isi dari progressOf bila ada data aset/verified).
export function phaseOf(d, model, { ms = d.ms || {}, verified = {}, now = Date.now() } = {}) {
  if (!d.tender?.start) return ms.akuisisi || ms.spa ? 'pra' : null
  const day = daysSince(d.tender.start, now), ratio = ratioOf(d, model)
  if (day < 0) return 'pra'
  if (!ms.to_selesai && day <= 45) return 'ptw'
  if (verified[d.ticker]?.executed || ms.inbreng || ms.kjpp) return 'inj'
  if (ratio != null && ratio < 1) return 'bawah'
  // Masih di atas kuartil 3 kurva pada hari terdekat = euforia berlanjut; selain itu distribusi/koreksi.
  const p = model.pts.reduce((best, q) => !best || Math.abs(q.x - day) < Math.abs(best.x - day) ? q : best, null)
  return ratio != null && p && ratio > p.q3 ? 'euf' : 'dist'
}

export const dayTxt = d => d == null ? 'belum ada' : Math.round(d) === 0 ? 'saat PTW' : `${Math.abs(Math.round(d))} hari ${d < 0 ? 'sebelum' : 'sesudah'} PTW`
export const xTxt = v => v == null ? 'belum ada' : (Math.round(v * 100) / 100).toLocaleString('id-ID') + '×'
