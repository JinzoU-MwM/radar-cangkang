// Analisa teknikal & trading plan (port objek TA, taSignals, buildPlan, money management dari app.js lama).
// Volume Stockbit dalam lot (1 lot = 100 saham).
import { rp, big, x2 } from './domain.js'

export function sma(a, n) { const o = Array(a.length).fill(null); let s = 0; a.forEach((v, i) => { s += v; if (i >= n) s -= a[i - n]; if (i >= n - 1) o[i] = s / n }); return o }
export function ema(a, n) {
  const o = Array(a.length).fill(null), k = 2 / (n + 1); let e = null
  a.forEach((v, i) => { if (v == null) return; if (e == null) { if (i >= n - 1) { e = a.slice(i - n + 1, i + 1).reduce((s, x) => s + x, 0) / n; o[i] = e } return } e = v * k + e * (1 - k); o[i] = e })
  return o
}
export function bollinger(c, n = 20, m = 2) {
  const mid = sma(c, n), up = [], lo = []
  c.forEach((_, i) => {
    if (mid[i] == null) { up.push(null); lo.push(null); return }
    const w = c.slice(i - n + 1, i + 1), sd = Math.sqrt(w.reduce((s, x) => s + (x - mid[i]) ** 2, 0) / n)
    up.push(mid[i] + m * sd); lo.push(mid[i] - m * sd)
  })
  return { mid, up, lo }
}
// RSI Wilder.
export function rsi(c, n = 14) {
  const o = Array(c.length).fill(null); let g = 0, l = 0
  for (let i = 1; i < c.length; i++) {
    const ch = c[i] - c[i - 1], up = Math.max(ch, 0), dn = Math.max(-ch, 0)
    if (i <= n) { g += up; l += dn; if (i === n) { g /= n; l /= n; o[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l) } continue }
    g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; o[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l)
  }
  return o
}
export function macd(c, f = 12, s = 26, sig = 9) {
  const ef = ema(c, f), es = ema(c, s), m = c.map((_, i) => ef[i] != null && es[i] != null ? ef[i] - es[i] : null)
  const first = m.findIndex(v => v != null), sg = Array(c.length).fill(null)
  if (first >= 0) ema(m.slice(first), sig).forEach((v, j) => { sg[first + j] = v })
  return { m, sg, h: m.map((v, i) => v != null && sg[i] != null ? v - sg[i] : null) }
}
// Parabolic SAR (langkah 0,02, maksimum 0,2). up = tren naik (SAR di bawah harga).
export function psar(h, l, step = 0.02, max = 0.2) {
  const n = h.length, sar = Array(n).fill(null), up = Array(n).fill(null)
  if (n < 3) return { sar, up }
  let isUp = h[1] >= h[0], af = step, ep = isUp ? Math.max(h[0], h[1]) : Math.min(l[0], l[1]), s = isUp ? Math.min(l[0], l[1]) : Math.max(h[0], h[1])
  for (let i = 2; i < n; i++) {
    s = s + af * (ep - s)
    if (isUp) {
      s = Math.min(s, l[i - 1], l[i - 2])
      if (l[i] < s) { isUp = false; s = ep; ep = l[i]; af = step }
      else if (h[i] > ep) { ep = h[i]; af = Math.min(max, af + step) }
    } else {
      s = Math.max(s, h[i - 1], h[i - 2])
      if (h[i] > s) { isUp = true; s = ep; ep = h[i]; af = step }
      else if (l[i] < ep) { ep = l[i]; af = Math.min(max, af + step) }
    }
    sar[i] = s; up[i] = isUp
  }
  return { sar, up }
}
// ATR Wilder: rata-rata true range n hari pertama (mulai bar 1), lalu dihaluskan.
export function atr(bars, n = 14) {
  const tr = bars.map((b, i) => i ? Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c)) : b.h - b.l)
  const o = Array(tr.length).fill(null)
  if (tr.length <= n) return o
  let a = tr.slice(1, n + 1).reduce((s, x) => s + x, 0) / n; o[n] = a
  for (let i = n + 1; i < tr.length; i++) { a = (a * (n - 1) + tr[i]) / n; o[i] = a }
  return o
}

export function indicators(bars) {
  const c = bars.map(b => b.c), h = bars.map(b => b.h), l = bars.map(b => b.l), v = bars.map(b => b.v)
  return { bb: bollinger(c), ma20: sma(c, 20), ma50: sma(c, 50), rsi: rsi(c), macd: macd(c), sar: psar(h, l), vma: sma(v, 20), atr: atr(bars) }
}

// Harga indikator: satu desimal untuk saham di bawah Rp200 agar perbedaan kecil tidak hilang karena pembulatan.
export const rpx = v => v == null ? '–' : v < 200 ? 'Rp' + v.toLocaleString('id-ID', { maximumFractionDigits: 1 }) : rp(v)

// Pembacaan tiap indikator → suara +1 (beli), −1 (jual), 0 (netral), lalu diringkas jadi sinyal.
export function taSignals(bars, ind) {
  const i = bars.length - 1, b = bars[i], c = b.c
  const votes = []
  const vote = (k, s, txt) => votes.push({ k, s, txt })
  // 1. Tren rata-rata bergerak.
  const m20 = ind.ma20[i], m50 = ind.ma50[i]
  if (m20 && m50) {
    if (c > m20 && m20 > m50) vote('Tren (MA20/MA50)', 1, `Harga ${rpx(c)} di atas MA20 ${rpx(m20)} dan MA50 ${rpx(m50)} — tren naik tersusun.`)
    else if (c < m20 && m20 < m50) vote('Tren (MA20/MA50)', -1, `Harga di bawah MA20 ${rpx(m20)} dan MA50 ${rpx(m50)} — tren turun tersusun.`)
    else vote('Tren (MA20/MA50)', 0, `Harga di antara MA20 ${rpx(m20)} dan MA50 ${rpx(m50)} — tren belum tegas.`)
  }
  // 2. Parabolic SAR (+ deteksi pembalikan baru).
  const sar = ind.sar.sar[i], sUp = ind.sar.up[i]
  if (sar != null) {
    let flip = 0; for (let k = i; k > i - 5 && k > 2; k--) if (ind.sar.up[k] !== ind.sar.up[k - 1]) { flip = i - k + 1; break }
    vote('Parabolic SAR', sUp ? 1 : -1, `SAR ${rpx(sar)} ${sUp ? 'di bawah' : 'di atas'} harga — ${sUp ? 'tren naik' : 'tren turun'}${flip ? `, baru berbalik ${flip} hari lalu` : ''}.`)
  }
  // 3. RSI.
  const r = ind.rsi[i], r5 = ind.rsi[i - 5]
  if (r != null) {
    if (r < 30) vote('RSI 14', 1, `RSI ${r.toFixed(0)} — oversold, peluang technical rebound.`)
    else if (r > 70) vote('RSI 14', -1, `RSI ${r.toFixed(0)} — overbought, rawan koreksi.`)
    else if (r >= 50 && r5 != null && r > r5) vote('RSI 14', 1, `RSI ${r.toFixed(0)} naik di atas 50 — momentum menguat.`)
    else if (r < 50 && r5 != null && r < r5) vote('RSI 14', -1, `RSI ${r.toFixed(0)} turun di bawah 50 — momentum melemah.`)
    else vote('RSI 14', 0, `RSI ${r.toFixed(0)} — momentum netral.`)
  }
  // 4. MACD (+ cross baru).
  const mm = ind.macd.m[i], ms = ind.macd.sg[i], mh = ind.macd.h[i], mh1 = ind.macd.h[i - 1]
  if (mm != null && ms != null) {
    let cross = 0; for (let k = i; k > i - 5; k--) { const a = ind.macd.h[k], p = ind.macd.h[k - 1]; if (a != null && p != null && Math.sign(a) !== Math.sign(p)) { cross = i - k + 1; break } }
    const rising = mh1 != null && mh > mh1
    vote('MACD 12/26/9', mm > ms ? 1 : -1, `MACD ${mm > ms ? 'di atas' : 'di bawah'} garis sinyal, histogram ${rising ? 'membesar' : 'mengecil'}${cross ? `; cross ${mm > ms ? 'ke atas' : 'ke bawah'} ${cross} hari lalu` : ''}.`)
  }
  // 5. Bollinger Bands (+ squeeze).
  const up = ind.bb.up[i], lo = ind.bb.lo[i], mid = ind.bb.mid[i]
  if (up != null) {
    const bw = (up - lo) / mid, bws = ind.bb.up.map((u, k) => u != null ? (u - ind.bb.lo[k]) / ind.bb.mid[k] : null).slice(-120).filter(x => x != null)
    const squeeze = bws.length > 40 && bw <= Math.min(...bws) * 1.1
    const pos = (c - lo) / (up - lo || 1)
    if (c < lo) vote('Bollinger 20,2', 1, `Harga di bawah lower band ${rpx(lo)} — oversold secara statistik.`)
    else if (c > up) vote('Bollinger 20,2', -1, `Harga di atas upper band ${rpx(up)} — terlalu jauh dari rata-rata.`)
    else vote('Bollinger 20,2', 0, `Harga di ${Math.round(pos * 100)}% lebar band (${rpx(lo)}–${rpx(up)}).`)
    if (squeeze) votes[votes.length - 1].txt += ' Band sedang menyempit tajam (squeeze) — volatilitas biasanya akan meledak.'
  }
  // 6. Volume: konfirmasi atau distribusi.
  const va = ind.vma[i]
  if (va) {
    const ratio = b.v / va, dir = c >= (bars[i - 1]?.c ?? c)
    if (ratio >= 1.5) vote('Volume', dir ? 1 : -1, `Volume ${x2(ratio)} rata-rata 20 hari pada hari ${dir ? 'naik — akumulasi' : 'turun — distribusi'}.`)
    else vote('Volume', 0, `Volume ${x2(ratio)} rata-rata 20 hari — tanpa konfirmasi.`)
  }
  const score = votes.reduce((s, x) => s + x.s, 0)
  const sig = score >= 3 ? ['Beli kuat', 'good'] : score >= 2 ? ['Beli', 'good'] : score <= -3 ? ['Jual kuat', 'bad'] : score <= -2 ? ['Jual', 'bad'] : ['Netral', 'warn']
  // Level kunci: support/resistance dari band, SAR, dan ekstrem 20 hari.
  const last20 = bars.slice(-20), lo20 = Math.min(...last20.map(x => x.l)), hi20 = Math.max(...last20.map(x => x.h))
  const supports = [lo, sUp ? sar : null, lo20].filter(x => x != null && x < c), resists = [up, !sUp ? sar : null, hi20].filter(x => x != null && x > c)
  const sup = supports.length ? Math.max(...supports) : lo20, res = resists.length ? Math.min(...resists) : hi20
  const stop = sUp && sar < c ? sar : lo20
  const valDay = (va || 0) * 100 * c   // nilai transaksi harian rata-rata (lot × 100 × harga)
  return { votes, score, sig, sup, res, stop, hi20, lo20, valDay, rr: c > stop && res > c ? (res - c) / (c - stop) : null }
}

export function taVerdict(s) {
  const pos = s.votes.filter(v => v.s > 0).map(v => v.k), neg = s.votes.filter(v => v.s < 0).map(v => v.k)
  if (s.score >= 3) return `mayoritas indikator searah naik (${pos.join(', ')}). Momentum kuat; disiplin pada level invalidasi.`
  if (s.score >= 2) return `kecenderungan naik (${pos.join(', ')}), tetapi belum semua indikator mengonfirmasi${neg.length ? ` (${neg.join(', ')} masih negatif)` : ''}.`
  if (s.score <= -3) return `mayoritas indikator searah turun (${neg.join(', ')}). Hindari menangkap pisau jatuh sebelum ada pembalikan SAR/MACD.`
  if (s.score <= -2) return `kecenderungan turun (${neg.join(', ')})${pos.length ? `; ${pos.join(', ')} masih positif` : ''}. Tunggu konfirmasi pembalikan.`
  return `indikator saling bertentangan${pos.length ? ` (positif: ${pos.join(', ')}` : ''}${neg.length ? `${pos.length ? '; ' : ' ('}negatif: ${neg.join(', ')}` : ''}${pos.length || neg.length ? ')' : ''}. Tunggu arah yang lebih jelas.`
}

// Fraksi harga BEI: <200 → 1; <500 → 2; <2.000 → 5; <5.000 → 10; ≥5.000 → 25.
export const tick = p => p < 200 ? 1 : p < 500 ? 2 : p < 2000 ? 5 : p < 5000 ? 10 : 25
export const floorTick = p => { const t = tick(p); return Math.floor(p / t) * t }
export const ceilTick = p => { const t = tick(p); return Math.ceil(p / t) * t }

// Rencana dari sinyal teknikal: ikuti tren (sinyal Beli), tunggu breakout (Netral), atau rencana keluar (Jual).
export function buildPlan(bars, ind, s = taSignals(bars, ind)) {
  const i = bars.length - 1, c = bars[i].c
  const atrV = ind.atr[i] || c * 0.03, sar = ind.sar.sar[i], sUp = ind.sar.up[i]
  const frozen = s.hi20 === s.lo20 || bars.slice(-10).every(x => !x.v)
  let type, entryLo, entryHi, entry, stop, note
  if (s.score >= 2) {
    type = 'Ikuti tren — beli saat koreksi ke zona'
    entryHi = floorTick(c); entryLo = floorTick(Math.max(s.sup, c - 0.5 * atrV))
    entry = floorTick((entryLo + entryHi) / 2)
    stop = floorTick(Math.min(sUp && sar < entry ? sar : s.lo20, entry - atrV))
    note = 'Sinyal teknikal positif: masuk bertahap di zona entry, jangan mengejar harga di atas batas zona.'
  } else if (s.score > -2) {
    type = 'Tunggu breakout — beli hanya bila resistance ditembus'
    entry = ceilTick(s.res + tick(s.res)); entryLo = entry; entryHi = ceilTick(entry + 0.5 * atrV)
    stop = floorTick(Math.max(s.sup, entry - 2 * atrV))
    note = `Indikator belum searah: rencana aktif hanya bila harga ditutup di atas ${rp(s.res)} dengan volume di atas rata-rata.`
  } else {
    type = 'Tidak ada setup beli — rencana keluar'
    entry = null; entryLo = entryHi = null; stop = floorTick(s.sup)
    note = `Sinyal teknikal negatif. Bagi pemegang: manfaatkan rebound ke ${rp(s.res)} untuk mengurangi posisi; keluar penuh bila ditutup di bawah ${rp(s.sup)}.`
  }
  if (entry != null && stop >= entry) stop = floorTick(entry - Math.max(tick(entry), atrV))
  const R = entry != null ? entry - stop : null
  const tp1 = R ? floorTick(entry + 1.5 * R) : null, tp2 = R ? floorTick(entry + 3 * R) : null
  const resBlock = R && s.res > entry && s.res < tp1 ? s.res : null   // resistance yang menghadang sebelum TP1
  return { s, c, atr: atrV, sar, sUp, frozen, type, entryLo, entryHi, entry, stop, R, tp1, tp2, resBlock, note }
}

export const MM_DEF = { modal: 100000000, risk: 1, maxPos: 20, fb: 0.15, fs: 0.25 }

// Ukuran posisi + daftar kelayakan. mm dalam persen (risk, maxPos, fb, fs) seperti input form.
// pnl1/pnl2 = laba untuk separuh posisi (jual 50% di tiap target), sama dengan tampilan lama.
export function moneyMgmt(plan, mm = MM_DEF, { valDay = plan.s.valDay, sikap = null } = {}) {
  const g = v => Math.max(0, +v || 0)
  const m = { modal: g(mm.modal), risk: g(mm.risk), maxPos: g(mm.maxPos), fb: g(mm.fb), fs: g(mm.fs) }
  const s = plan.s, fb = m.fb / 100, fs = m.fs / 100, half = !!sikap && /hindari/i.test(sikap)
  const checklist = [
    [s.score > -2, `Sinyal teknikal bukan Jual (${s.sig[0]})`],
    [!plan.frozen, 'Harga bergerak dan ada volume (tidak suspensi)'],
    [valDay >= 5e8, `Likuiditas ≥ Rp500 juta/hari (rata-rata ${big(valDay)})`],
    // Dua syarat ini hanya relevan bila ada setup beli.
    ...(plan.entry ? [[(plan.entry - plan.stop) / plan.entry <= 0.1, 'Jarak stop loss ≤ 10% dari entry'], [!plan.resBlock, 'Tidak ada resistance sebelum Target 1']] : []),
    [!half, sikap ? `Pandangan analis bukan Hindari (${sikap})` : 'Belum ada pandangan analis'],
  ].map(([ok, text]) => ({ ok, text }))
  const fails = checklist.filter(x => !x.ok).length
  const verdict = !plan.entry || plan.frozen ? { text: 'Tidak layak dibuka sekarang', cls: 'bad' }
    : fails === 0 ? { text: 'Layak dieksekusi sesuai rencana', cls: 'good' }
    : fails <= 2 ? { text: 'Layak dengan ukuran diperkecil & disiplin stop', cls: 'warn' }
    : { text: 'Tidak layak — terlalu banyak syarat gagal', cls: 'bad' }
  const out = { lossPS: null, lots: null, capLots: null, liqLots: null, finalLots: null, shares: null, pos: null, maxLoss: null,
    breakeven: null, pnl1: null, pnl2: null, why: [], checklist, verdict }
  if (!plan.entry) return out   // tanpa setup beli tidak ada posisi yang dihitung
  const lossPS = (plan.entry - plan.stop) + plan.entry * fb + plan.stop * fs
  const lots = Math.floor(m.modal * m.risk / 100 / (lossPS * 100))
  const capLots = Math.floor(m.modal * m.maxPos / 100 / (plan.entry * 100 * (1 + fb)))
  const liqLots = Math.floor(0.1 * valDay / (plan.entry * 100))   // posisi ≤ 10% nilai transaksi harian
  let n = lots; const why = []
  if (n > capLots) { n = capLots; why.push(`dibatasi maks. porsi ${m.maxPos}% modal`) }
  if (half) { n = Math.floor(n / 2); why.push('dipotong 50% karena pandangan analis Hindari') }
  if (n > liqLots) { n = Math.max(0, liqLots); why.push('dibatasi 10% nilai transaksi harian agar bisa keluar') }
  const sh = n * 100, pos = sh * plan.entry * (1 + fb)
  const pnl = tp => sh * (tp * (1 - fs) - plan.entry * (1 + fb))
  return { ...out, lossPS, lots, capLots, liqLots, finalLots: n, shares: sh, pos, maxLoss: sh * lossPS,
    breakeven: ceilTick(plan.entry * (1 + fb) / (1 - fs)), pnl1: pnl(plan.tp1) / 2, pnl2: pnl(plan.tp2) / 2, why }
}
