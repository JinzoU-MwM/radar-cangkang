// Struktur harga (port taAdvanced, taLevels, taStructure, pros/cons, rencana berbasis pola dari versi lama):
// 17 pola chart, 19 pola candlestick, divergensi RSI/MACD, zona reaksi volume, Fibonacci, volume profile.
// Semua fungsi murni: masukan bars [{d,o,h,l,c,v}] + indikator dari ta.js, keluaran data siap digambar.
import { rp, big, fmt, fmtDate, x2 } from './domain.js'
import { tick, floorTick, ceilTick } from './ta.js'

// Katalog pola: nama, arah (1 naik / −1 turun), jenis, dan cara membacanya.
export const PATTERNS = {
  dbl_bottom:     { n: 'Double Bottom', b: 1, k: 'Pembalikan', d: 'Dua lembah setara dipisah satu puncak (neckline). Aktif bila harga ditutup di atas neckline; target = tinggi pola diproyeksikan dari neckline.' },
  dbl_top:        { n: 'Double Top', b: -1, k: 'Pembalikan', d: 'Dua puncak setara dipisah satu lembah (neckline). Aktif bila harga ditutup di bawah neckline; target = tinggi pola diproyeksikan ke bawah.' },
  hs:             { n: 'Head & Shoulders', b: -1, k: 'Pembalikan', d: 'Tiga puncak dengan puncak tengah (kepala) tertinggi; neckline ditarik dari dua lembah. Tembus ke bawah = pembalikan turun; target = tinggi kepala.' },
  ihs:            { n: 'Inverted Head & Shoulders', b: 1, k: 'Pembalikan', d: 'Tiga lembah dengan lembah tengah terdalam. Tembus neckline ke atas = pembalikan naik; target = kedalaman kepala.' },
  asc_tri:        { n: 'Ascending Triangle', b: 1, k: 'Kelanjutan', d: 'Resistance datar dengan lembah yang makin tinggi: pembeli makin agresif. Breakout di atas resistance; target = lebar segitiga.' },
  desc_tri:       { n: 'Descending Triangle', b: -1, k: 'Kelanjutan', d: 'Support datar dengan puncak yang makin rendah: penjual makin agresif. Breakdown di bawah support; target = lebar segitiga.' },
  rising_wedge:   { n: 'Rising Wedge', b: -1, k: 'Pembalikan', d: 'Harga naik dalam wedge yang menyempit; kenaikan makin lemah. Tembus garis bawah = pelemahan; target = awal wedge.' },
  falling_wedge:  { n: 'Falling Wedge', b: 1, k: 'Pembalikan', d: 'Harga turun dalam wedge yang menyempit; tekanan jual melemah. Tembus garis atas = penguatan; target = awal wedge.' },
  bull_flag:      { n: 'Bullish Flag', b: 1, k: 'Kelanjutan', d: 'Kenaikan tajam (flagpole) lalu konsolidasi turun sejajar (flag). Breakout di atas flag; target = panjang flagpole.' },
  bull_pennant:   { n: 'Bullish Pennant', b: 1, k: 'Kelanjutan', d: 'Kenaikan tajam lalu konsolidasi segitiga kecil yang menyempit. Breakout ke atas; target = panjang flagpole.' },
  bear_flag:      { n: 'Bearish Flag', b: -1, k: 'Kelanjutan', d: 'Penurunan tajam lalu rebound sejajar. Breakdown di bawah flag; target = panjang flagpole ke bawah.' },
  bear_pennant:   { n: 'Bearish Pennant', b: -1, k: 'Kelanjutan', d: 'Penurunan tajam lalu konsolidasi segitiga kecil yang menyempit. Breakdown ke bawah; target = panjang flagpole.' },
  cup_handle:     { n: 'Cup & Handle', b: 1, k: 'Kelanjutan', d: 'Dasar membulat (cup) lalu koreksi kecil (handle). Breakout di atas rim cup; target = kedalaman cup.' },
  bull_butterfly: { n: 'Bullish Butterfly', b: 1, k: 'Harmonik', d: 'Pola harmonik XABCD: AB ±78,6% XA, D di 127–161,8% XA di bawah X. Zona D (PRZ) = area beli; target 38,2% lalu 61,8% AD.' },
  bear_butterfly: { n: 'Bearish Butterfly', b: -1, k: 'Harmonik', d: 'Pola harmonik XABCD terbalik: D di 127–161,8% XA di atas X. Zona D (PRZ) = area jual; target 38,2% lalu 61,8% AD.' },
  v_bottom:       { n: 'V-Bottom', b: 1, k: 'Pembalikan', d: 'Penurunan tajam langsung dibalas kenaikan secepat itu. Terkonfirmasi setelah memulihkan 61,8% penurunan; target = puncak awal.' },
  v_top:          { n: 'V-Top', b: -1, k: 'Pembalikan', d: 'Kenaikan tajam langsung dibalas penurunan secepat itu. Terkonfirmasi setelah kehilangan 61,8% kenaikan; target = dasar awal.' },
}
export const PT_STATUS = {
  forming: ['Sedang terbentuk', 'calm'], ready: ['Menunggu breakout', 'warn'], breakout: ['Breakout aktif', 'good'],
  target: ['Target tercapai', 'good'], failed: ['Gagal (invalid)', 'strong'], expired: ['Kedaluwarsa', 'calm'],
}
export const ptStatusTxt = p => p.fakeout ? (p.bias > 0 ? 'Breakout palsu' : 'Breakdown palsu')
  : p.bias < 0 ? ({ ready: 'Menunggu breakdown', breakout: 'Breakdown aktif' }[p.status] || PT_STATUS[p.status][0]) : PT_STATUS[p.status][0]
// Pola candlestick: [nama, arah, kekuatan 1–3, kode label di chart].
export const CANDLES = {
  hammer: ['Hammer', 1, 1, 'Ham'], inv_hammer: ['Inverted Hammer', 1, 1, 'InvH'], hanging: ['Hanging Man', -1, 1, 'HgM'], shooting: ['Shooting Star', -1, 1, 'SS'],
  bull_engulf: ['Bullish Engulfing', 1, 2, 'Eng'], bear_engulf: ['Bearish Engulfing', -1, 2, 'Eng'], piercing: ['Piercing Line', 1, 2, 'Prc'], dark_cloud: ['Dark Cloud Cover', -1, 2, 'DCC'],
  bull_harami: ['Bullish Harami', 1, 1, 'Har'], bear_harami: ['Bearish Harami', -1, 1, 'Har'], morning: ['Morning Star', 1, 3, 'MS'], evening: ['Evening Star', -1, 3, 'ES'],
  soldiers: ['Three White Soldiers', 1, 3, '3WS'], crows: ['Three Black Crows', -1, 3, '3BC'], dragonfly: ['Dragonfly Doji', 1, 1, 'DfD'], gravestone: ['Gravestone Doji', -1, 1, 'GsD'],
  doji: ['Doji', 0, 1, 'Doji'], bull_maru: ['Bullish Marubozu', 1, 2, 'Mrb'], bear_maru: ['Bearish Marubozu', -1, 2, 'Mrb'],
}
export const confLvl = c => c >= 70 ? 'Tinggi' : c >= 50 ? 'Sedang' : 'Rendah'
const pctPlain = (to, from) => { if (to == null || !from) return '–'; const p = (to / from - 1) * 100; return (p >= 0 ? '+' : '') + (Math.abs(p) < 10 ? p.toFixed(1).replace('.', ',') : p.toFixed(0)) + '%' }
const pct1 = x => (x * 100).toFixed(1).replace('.', ',')

// Garis lurus melalui dua titik (indeks bar, harga).
const ln = (i1, p1, i2, p2) => { const a = (p2 - p1) / ((i2 - i1) || 1); return { a, at: i => p1 + a * (i - i1) } }
// Garis regresi melalui pivot + simpangan maksimum (untuk menguji apakah pivot benar-benar segaris).
const fit = pts => {
  if (pts.length === 2) return { ...ln(pts[0].i, pts[0].p, pts[1].i, pts[1].p), dev: 0 }
  const n = pts.length, mx = pts.reduce((s, p) => s + p.i, 0) / n, my = pts.reduce((s, p) => s + p.p, 0) / n
  const a = pts.reduce((s, p) => s + (p.i - mx) * (p.p - my), 0) / (pts.reduce((s, p) => s + (p.i - mx) ** 2, 0) || 1)
  const at = i => my + a * (i - mx)
  return { a, at, dev: Math.max(...pts.map(p => Math.abs(p.p - at(p.i)))) }
}

// ZigZag: pivot berganti arah bila harga berbalik ≥ max(mult × ATR, minPct × harga). Pivot terakhir ditandai open (belum terkonfirmasi).
export function zigzag(B, atrAt, mult, minPct) {
  const N = B.length, th = i => Math.max(mult * atrAt(i), minPct * B[i].c), out = []
  let mode = 0, hiI = 0, loI = 0
  for (let i = 1; i < N; i++) {
    const b = B[i]
    if (mode === 0) {
      if (b.h > B[hiI].h) hiI = i
      if (b.l < B[loI].l) loI = i
      if (B[hiI].h - B[loI].l >= th(i)) {
        if (hiI > loI) { out.push({ i: loI, p: B[loI].l, t: 'L' }); mode = 1 } else { out.push({ i: hiI, p: B[hiI].h, t: 'H' }); mode = -1 }
      }
    } else if (mode === 1) {
      if (b.h >= B[hiI].h) hiI = i
      else if (B[hiI].h - b.l >= th(i)) { out.push({ i: hiI, p: B[hiI].h, t: 'H' }); mode = -1; loI = i }
    } else {
      if (b.l <= B[loI].l) loI = i
      else if (b.h - B[loI].l >= th(i)) { out.push({ i: loI, p: B[loI].l, t: 'L' }); mode = 1; hiI = i }
    }
  }
  if (mode === 1 && hiI > (out.at(-1)?.i ?? -1)) out.push({ i: hiI, p: B[hiI].h, t: 'H', open: true })
  if (mode === -1 && loI > (out.at(-1)?.i ?? -1)) out.push({ i: loI, p: B[loI].l, t: 'L', open: true })
  return out
}

const helpers = (B, I) => {
  const atrAt = i => I.atr[i] || I.atr.find(v => v) || B[i].c * 0.03
  return { atrAt, volX: i => (I.vma[i] ? B[i].v / I.vma[i] : null), tolAt: i => Math.max(0.8 * atrAt(i), 0.025 * B[i].c) }
}

// ---- Pola chart: kandidat mentah dari pivot tiga skala ----
function rawPatterns(B, I, scales) {
  const { atrAt, tolAt } = helpers(B, I), last = B.length - 1, raw = [], add = o => raw.push(o)
  scales.forEach((P, si) => {
    for (let m = 1; m < P.length; m++) {
      const w = len => (m - len + 1 >= 0 ? P.slice(m - len + 1, m + 1) : null)
      const ty = arr => arr.map(p => p.t).join('')
      const open = !!P[m].open
      // V-Bottom / V-Top: gerak tajam ≥ max(15%, 5×ATR) dalam ≤ 30 hari, lalu pembalikan secepat itu.
      { const [a, b] = w(2)
        const mv = Math.abs(a.p - b.p), bars = b.i - a.i
        // Titik balik harus sudah terkonfirmasi; gerak yang masih berjalan belum bisa disebut V.
        if (!open && mv >= Math.max(5 * atrAt(b.i), 0.15 * Math.max(a.p, b.p)) && bars <= 30 && bars >= 2) {
          const up = a.t === 'H'   // H→L lalu pulih = V-Bottom
          add({ key: up ? 'v_bottom' : 'v_top', pts: [a, b], lines: [], trig: () => up ? b.p + 0.618 * mv : b.p - 0.618 * mv,
            target: a.p, inv: b.p, q: Math.min(1, mv / (8 * atrAt(b.i))), start: a.i, e: b.i, open, si, wait: Math.round(1.5 * bars) + 3,
            info: [`${up ? 'Turun' : 'Naik'} ${pctPlain(b.p, a.p)} dalam ${bars} hari bursa.`] })
        } }
      const w3 = w(3)
      if (w3) {
        const [a, b, c] = w3, tol = tolAt(c.i), sep = c.i - a.i
        // Double Bottom / Double Top.
        if (sep >= 8 && sep <= 150 && Math.abs(a.p - c.p) <= tol) {
          if (ty(w3) === 'LHL') {
            const base = Math.min(a.p, c.p), h = b.p - Math.max(a.p, c.p)
            if (h >= Math.max(2 * tol, 0.06 * b.p)) add({ key: 'dbl_bottom', pts: w3, lines: [{ l: ln(a.i, b.p, c.i, b.p), from: a.i, ext: true, nm: 'Neckline' }],
              trig: () => b.p, target: b.p + (b.p - base), inv: base, q: 1 - Math.abs(a.p - c.p) / tol * 0.5, start: a.i, e: c.i, open, si,
              dry: B[c.i].v < B[a.i].v, info: [`Lembah ${rp(a.p)} & ${rp(c.p)} (selisih ${pctPlain(c.p, a.p)}), neckline ${rp(b.p)}.`] })
          } else {
            const top = Math.max(a.p, c.p), h = Math.min(a.p, c.p) - b.p
            if (h >= Math.max(2 * tol, 0.06 * b.p)) add({ key: 'dbl_top', pts: w3, lines: [{ l: ln(a.i, b.p, c.i, b.p), from: a.i, ext: true, nm: 'Neckline' }],
              trig: () => b.p, target: Math.max(1, b.p - (top - b.p)), inv: top, q: 1 - Math.abs(a.p - c.p) / tol * 0.5, start: a.i, e: c.i, open, si,
              dry: B[c.i].v < B[a.i].v, info: [`Puncak ${rp(a.p)} & ${rp(c.p)} (selisih ${pctPlain(c.p, a.p)}), neckline ${rp(b.p)}.`] })
          }
        }
        // Cup & Handle: bibir kiri ≈ bibir kanan, kedalaman 12–55%, lebar ≥ 25 hari, dasar membulat (bukan V).
        if (ty(w3) === 'HLH' && si >= 1) {
          const rim = Math.max(a.p, c.p), depth = rim - b.p, width = c.i - a.i
          const pos = (b.i - a.i) / (width || 1)
          if (Math.abs(a.p - c.p) <= Math.max(tol, 0.05 * rim) && depth >= Math.max(3 * atrAt(b.i), 0.12 * rim) && depth <= 0.55 * rim && width >= 25 && pos > 0.25 && pos < 0.75) {
            const seg = B.slice(a.i, c.i + 1), lowZone = seg.filter(x => x.c <= b.p + 0.35 * depth).length / seg.length
            if (lowZone >= 0.2) {
              // Gagang: koreksi setelah bibir kanan, maksimal separuh kedalaman cangkir.
              let hl = null; for (let j = c.i + 1; j <= Math.min(last, c.i + 30); j++) { if (B[j].c > rim) break; hl = hl == null ? B[j].l : Math.min(hl, B[j].l) }
              if (hl == null || hl >= b.p + 0.5 * depth) add({ key: 'cup_handle', pts: w3, lines: [{ l: ln(a.i, rim, c.i, rim), from: a.i, ext: true, nm: 'Rim cup' }],
                curve: [a, b, c], handleLow: hl, trig: () => rim, target: rim + depth, inv: b.p + 0.5 * depth,
                q: Math.min(1, 0.5 + lowZone), start: a.i, e: c.i, open, si, wait: 30,
                info: [`Kedalaman ${pctPlain(b.p, rim)}, lebar ${width} hari bursa${hl != null ? `, handle turun ke ${rp(hl)}` : ', handle belum terbentuk'}.`] })
            }
          }
        }
      }
      const w4 = w(4)
      if (w4) {
        const [a, b, c, d] = w4, t4 = ty(w4)
        // Flag / Pennant: tiang ≥ max(15%, 4×ATR) dalam ≤ 25 hari, konsolidasi ≤ 50% flagpole.
        if ((t4 === 'LHLH' || t4 === 'HLHL') && si === 0) {
          const bull = t4 === 'LHLH', pole = Math.abs(b.p - a.p), pBars = b.i - a.i, cons = d.i - b.i
          const retr = Math.abs(b.p - c.p) / (pole || 1)
          const capped = bull ? d.p <= b.p + 0.3 * atrAt(d.i) : d.p >= b.p - 0.3 * atrAt(d.i)
          if (pole >= Math.max(4 * atrAt(b.i), 0.15 * Math.min(a.p, b.p)) && pBars <= 25 && retr <= 0.5 && capped && cons >= 3 && cons <= Math.max(30, 2 * pBars)) {
            const up = ln(b.i, b.p, d.i, d.p)   // garis sisi luar (atas untuk bullish)
            const e5 = P[m + 1] && P[m + 1].t === c.t ? P[m + 1] : null   // pivot kelima menentukan bendera vs pennant
            const inner = e5 ? ln(c.i, c.p, e5.i, e5.p) : { a: up.a, at: i => c.p + up.a * (i - c.i) }
            const conv = bull ? up.a < 0 && inner.a > 0 : up.a > 0 && inner.a < 0
            const key = bull ? (conv ? 'bull_pennant' : 'bull_flag') : (conv ? 'bear_pennant' : 'bear_flag')
            const ext = e5 || d, consLow = bull ? Math.min(c.p, e5?.p ?? Infinity) : Math.max(c.p, e5?.p ?? -Infinity)
            add({ key, pts: [a, b, c, d, ...(e5 ? [e5] : [])], lines: [{ l: up, from: b.i, ext: true, nm: bull ? 'Garis atas' : 'Garis bawah' }, { l: inner, from: c.i, ext: true }],
              trig: i => up.at(i), target: bull ? up.at(ext.i) + pole : Math.max(1, up.at(ext.i) - pole), inv: consLow,
              q: 1 - retr * 0.8, start: a.i, e: ext.i, open: !!ext.open, si, wait: 15,
              info: [`Flagpole ${pctPlain(b.p, a.p)} dalam ${pBars} hari; konsolidasi ${cons} hari, koreksi ${Math.round(retr * 100)}% flagpole.`] })
          }
        }
        // Segitiga & baji dari 4–5 pivot.
        for (const win of [w4, w(5)].filter(Boolean)) {
          const highs = win.filter(p => p.t === 'H'), lows = win.filter(p => p.t === 'L')
          if (highs.length < 2 || lows.length < 2 || si === 2) continue
          const s0 = win[0].i, e = win.at(-1).i, span = e - s0, tol = tolAt(e)
          if (span < 10 || span > 160) continue
          const hs = fit(highs), ls = fit(lows)
          if (hs.dev > tol || ls.dev > tol) continue
          const w0 = hs.at(s0) - ls.at(s0), wE = hs.at(e) - ls.at(e)
          if (w0 <= 0 || wE <= 0) continue
          const dH = hs.a * span, dL = ls.a * span
          const flatH = Math.abs(dH) <= tol * 0.8, flatL = Math.abs(dL) <= tol * 0.8
          const q = 1 - (hs.dev + ls.dev) / (2 * tol) * 0.5 + (win.length === 5 ? 0.1 : 0)
          // Breakout sesudah apex (titik temu kedua garis) tidak sahih → batas tunggu berakhir di apex.
          const apex = hs.a !== ls.a ? e + (hs.at(e) - ls.at(e)) / (ls.a - hs.a) : Infinity
          const wait = Number.isFinite(apex) && apex > e ? Math.max(3, Math.min(Math.round(span * 0.8), Math.round(apex - e))) : undefined
          const lastH = highs.at(-1), lastL = lows.at(-1), base = { pts: win, start: s0, e, open: !!win.at(-1).open, si, q: Math.min(1, q), wait }
          const lines = [{ l: hs, from: s0, ext: true, nm: 'Garis atas' }, { l: ls, from: s0, ext: true, nm: 'Garis bawah' }]
          if (flatH && dL >= tol) { const res = Math.max(...highs.map(p => p.p)); add({ ...base, key: 'asc_tri', lines: [{ l: ln(s0, res, e, res), from: s0, ext: true, nm: 'Resistance' }, lines[1]], trig: () => res, target: res + w0, inv: lastL.p, info: [`Resistance ${rp(res)} disentuh ${highs.length}×, lembah naik dari ${rp(lows[0].p)} ke ${rp(lastL.p)}.`] }) }
          else if (flatL && dH <= -tol) { const sup = Math.min(...lows.map(p => p.p)); add({ ...base, key: 'desc_tri', lines: [lines[0], { l: ln(s0, sup, e, sup), from: s0, ext: true, nm: 'Support' }], trig: () => sup, target: Math.max(1, sup - w0), inv: lastH.p, info: [`Support ${rp(sup)} disentuh ${lows.length}×, puncak turun dari ${rp(highs[0].p)} ke ${rp(lastH.p)}.`] }) }
          else if (dL >= tol && dH > 0 && ls.a > hs.a && wE < 0.8 * w0) add({ ...base, key: 'rising_wedge', lines, trig: i => ls.at(i), target: lows[0].p, inv: lastH.p, info: [`Wedge naik menyempit ${Math.round((1 - wE / w0) * 100)}% selama ${span} hari.`] })
          else if (dH <= -tol && dL < 0 && hs.a < ls.a && wE < 0.8 * w0) add({ ...base, key: 'falling_wedge', lines, trig: i => hs.at(i), target: highs[0].p, inv: lastL.p, info: [`Wedge turun menyempit ${Math.round((1 - wE / w0) * 100)}% selama ${span} hari.`] })
        }
      }
      const w5 = w(5)
      if (w5) {
        const [p1, p2, p3, p4, p5] = w5, t5 = ty(w5), tol = tolAt(p5.i)
        // Head & Shoulders / Inverted.
        if (t5 === 'HLHLH' || t5 === 'LHLHL') {
          const top = t5 === 'HLHLH', neck = ln(p2.i, p2.p, p4.i, p4.p)
          const head = top ? p3.p - neck.at(p3.i) : neck.at(p3.i) - p3.p
          const shoulders = top ? p3.p > Math.max(p1.p, p5.p) + 0.5 * tol : p3.p < Math.min(p1.p, p5.p) - 0.5 * tol
          const sym = Math.abs(p1.p - p5.p), tr = (p3.i - p1.i) / ((p5.i - p3.i) || 1)
          const outside = top ? p1.p > neck.at(p1.i) && p5.p > neck.at(p5.i) : p1.p < neck.at(p1.i) && p5.p < neck.at(p5.i)
          if (shoulders && outside && sym <= Math.max(1.5 * tol, 0.35 * head) && head >= Math.max(2 * tol, 0.06 * Math.abs(p3.p)) && Math.abs(p2.p - p4.p) <= 0.5 * head && tr > 0.33 && tr < 3)
            add({ key: top ? 'hs' : 'ihs', pts: w5, lines: [{ l: neck, from: p1.i, ext: true, nm: 'Neckline' }], trig: i => neck.at(i),
              target: top ? Math.max(1, neck.at(p5.i) - head) : neck.at(p5.i) + head, inv: p5.p,
              q: Math.max(0.2, 1 - sym / (1.5 * tol) * 0.4 - Math.abs(Math.log(tr)) * 0.2), start: p1.i, e: p5.i, open: !!p5.open, si,
              info: [`Kepala ${rp(p3.p)}, bahu ${rp(p1.p)} & ${rp(p5.p)}; tinggi kepala ${rp(head)} dari neckline.`] })
          // Butterfly harmonik.
          const [X, A, Bp, C, D] = w5, XA = Math.abs(A.p - X.p), AB = Math.abs(A.p - Bp.p), BC = Math.abs(C.p - Bp.p), CD = Math.abs(C.p - D.p)
          const ab = AB / XA, bc = BC / AB, cd = CD / BC, xd = Math.abs(A.p - D.p) / XA, bull = t5 === 'LHLHL'
          const beyondX = bull ? D.p < X.p : D.p > X.p
          if (ab >= 0.7 && ab <= 0.87 && bc >= 0.38 && bc <= 0.89 && cd >= 1.5 && cd <= 2.7 && xd >= 1.18 && xd <= 1.72 && beyondX) {
            const AD = Math.abs(A.p - D.p), t1 = bull ? D.p + 0.382 * AD : D.p - 0.382 * AD, t2 = bull ? D.p + 0.618 * AD : D.p - 0.618 * AD
            const ext = bull ? A.p - 1.618 * XA : A.p + 1.618 * XA, invL = bull ? Math.min(D.p, ext) - 0.5 * atrAt(D.i) : Math.max(D.p, ext) + 0.5 * atrAt(D.i)
            add({ key: bull ? 'bull_butterfly' : 'bear_butterfly', pts: w5, lines: [{ l: ln(X.i, X.p, Bp.i, Bp.p), from: X.i, to: Bp.i }, { l: ln(X.i, X.p, D.i, D.p), from: X.i, to: D.i }, { l: ln(Bp.i, Bp.p, D.i, D.p), from: Bp.i, to: D.i }],
              labels: ['X', 'A', 'B', 'C', 'D'], trig: () => bull ? B[D.i].h : B[D.i].l, target: Math.max(1, t1), target2: Math.max(1, t2), inv: Math.max(1, invL),
              q: Math.max(0.2, 1 - (Math.abs(ab - 0.786) / 0.09 + Math.abs(xd - 1.414) / 0.3) * 0.35), start: X.i, e: D.i, open: !!D.open, si, wait: 10,
              info: [`AB ${fmt(ab * 100, 1)}% XA · BC ${fmt(bc * 100, 1)}% AB · CD ${fmt(cd, 2)}× BC · D di ${fmt(xd * 100, 1)}% XA.`, `Target 2 (61,8% AD): ${rp(t2)}.`] })
          }
        }
      }
    }
  })
  return raw
}

// Titik kurva cangkir (Bezier kuadrat yang melewati dasar), satu titik per bar untuk seri garis.
function cupCurve([a, b, c]) {
  const cx = (4 * b.i - a.i - c.i) / 2, cy = (4 * b.p - a.p - c.p) / 2, out = []
  for (let k = 0; k <= 60; k++) {
    const t = k / 60, i = Math.round((1 - t) ** 2 * a.i + 2 * t * (1 - t) * cx + t * t * c.i)
    if (out.length && out.at(-1).i >= i) continue
    out.push({ i, p: (1 - t) ** 2 * a.p + 2 * t * (1 - t) * cy + t * t * c.p })
  }
  return out
}

// ---- Candlestick (120 bar terakhir) ----
export function detectCandles(B, I) {
  const { atrAt, volX } = helpers(B, I), N = B.length, last = N - 1, out = []
  for (let i = Math.max(6, N - 120); i <= last; i++) {
    const b = B[i], p1 = B[i - 1], p2 = B[i - 2]
    if (!b.v || b.h === b.l) continue
    const body = Math.abs(b.c - b.o), rng = b.h - b.l, up = b.h - Math.max(b.o, b.c), lo = Math.min(b.o, b.c) - b.l
    const avgBody = B.slice(i - 10, i).reduce((s, x) => s + Math.abs(x.c - x.o), 0) / 10 || rng * 0.5
    // Konteks tren: perubahan 5 hari sebelum candle dalam satuan ATR.
    const at = atrAt(i), tr = (p1.c - B[i - 6].c) / (at || 1), down = tr <= -1, rise = tr >= 1
    const bull = x => x.c > x.o, bear = x => x.c < x.o, b1 = Math.abs(p1.c - p1.o)
    const hits = []
    if (bear(p2) && Math.abs(p2.c - p2.o) >= avgBody && b1 <= 0.5 * avgBody && bull(b) && b.c > (p2.o + p2.c) / 2 && down) hits.push('morning')
    if (bull(p2) && Math.abs(p2.c - p2.o) >= avgBody && b1 <= 0.5 * avgBody && bear(b) && b.c < (p2.o + p2.c) / 2 && rise) hits.push('evening')
    if ([p2, p1, b].every(bull) && p1.c > p2.c && b.c > p1.c && [p2, p1, b].every(x => Math.abs(x.c - x.o) >= 0.6 * avgBody && x.h - x.c <= 0.3 * Math.abs(x.c - x.o) + 0.0001)) hits.push('soldiers')
    if ([p2, p1, b].every(bear) && p1.c < p2.c && b.c < p1.c && [p2, p1, b].every(x => Math.abs(x.c - x.o) >= 0.6 * avgBody && x.c - x.l <= 0.3 * Math.abs(x.c - x.o) + 0.0001)) hits.push('crows')
    if (bear(p1) && bull(b) && b.o <= p1.c && b.c >= p1.o && body > b1 && down) hits.push('bull_engulf')
    if (bull(p1) && bear(b) && b.o >= p1.c && b.c <= p1.o && body > b1 && rise) hits.push('bear_engulf')
    if (bear(p1) && b1 >= avgBody && bull(b) && b.o <= p1.c && b.c > (p1.o + p1.c) / 2 && b.c < p1.o && down) hits.push('piercing')
    if (bull(p1) && b1 >= avgBody && bear(b) && b.o >= p1.c && b.c < (p1.o + p1.c) / 2 && b.c > p1.o && rise) hits.push('dark_cloud')
    if (bear(p1) && b1 >= avgBody && body <= 0.5 * b1 && Math.max(b.o, b.c) <= p1.o && Math.min(b.o, b.c) >= p1.c && down) hits.push('bull_harami')
    if (bull(p1) && b1 >= avgBody && body <= 0.5 * b1 && Math.max(b.o, b.c) <= p1.c && Math.min(b.o, b.c) >= p1.o && rise) hits.push('bear_harami')
    if (body >= 0.9 * rng && body >= 1.5 * avgBody) hits.push(bull(b) ? 'bull_maru' : 'bear_maru')
    if (body <= 0.1 * rng) hits.push(up <= 0.1 * rng && lo >= 0.6 * rng ? 'dragonfly' : lo <= 0.1 * rng && up >= 0.6 * rng ? 'gravestone' : 'doji')
    else if (lo >= 2 * body && up <= 0.15 * rng) hits.push(down ? 'hammer' : rise ? 'hanging' : null)
    else if (up >= 2 * body && lo <= 0.15 * rng) hits.push(down ? 'inv_hammer' : rise ? 'shooting' : null)
    // Pola terkuat menang bila beberapa cocok sekaligus.
    const key = hits.filter(Boolean).sort((x, y) => CANDLES[y][2] - CANDLES[x][2])[0]
    if (!key) continue
    const [n, bias, s, code] = CANDLES[key]
    const bbL = I.bb.lo[i], bbU = I.bb.up[i]
    const loc = bias > 0 && bbL && b.l <= bbL * 1.02 ? 'di lower band Bollinger' : bias < 0 && bbU && b.h >= bbU * 0.98 ? 'di upper band Bollinger' : ''
    const vx = volX(i), nx = B[i + 1]
    const confirm = !nx ? 'Menunggu konfirmasi hari berikutnya' : bias === 0 ? 'tanpa arah' : (bias > 0 ? nx.c > b.c : nx.c < b.c) ? 'Terkonfirmasi hari berikutnya' : 'Tidak terkonfirmasi'
    let c = 30 + s * 12 + (loc ? 10 : 0) + (vx >= 1.5 ? 10 : 0) + (/^Terkonfirmasi/.test(confirm) ? 10 : /^Tidak/.test(confirm) ? -15 : 0) + ((bias > 0 && down) || (bias < 0 && rise) ? 5 : 0)
    if (bias === 0) c = 25
    out.push({ i, key, n, bias, s, code, loc, vx, confirm, conf: Math.round(Math.max(5, Math.min(95, c))), trend: down ? 'setelah turun' : rise ? 'setelah naik' : 'tren datar' })
  }
  return out
}

// ---- Divergensi RSI & MACD dari pivot minor (120 bar terakhir) ----
export function detectDivergences(B, I, pivots) {
  const N = B.length, last = N - 1
  const P0 = pivots.filter(p => !p.open && p.i >= N - 120), divs = []
  const mAbs = Math.max(...I.macd.m.filter(v => v != null).map(Math.abs)) || 1
  for (const [nm, arr, th] of [['RSI', I.rsi, 3], ['MACD', I.macd.m, 0.05 * mAbs]]) {
    for (const t of ['L', 'H']) {
      const ps = P0.filter(p => p.t === t)
      for (let k = 1; k < ps.length; k++) {
        const a = ps[k - 1], b = ps[k], gap = b.i - a.i, v1 = arr[a.i], v2 = arr[b.i]
        if (gap < 5 || gap > 60 || v1 == null || v2 == null) continue
        let type = null
        if (t === 'L' && b.p < a.p && v2 > v1 + th) type = ['Bullish reguler', 1, `Harga membuat lembah lebih rendah tetapi ${nm} lembah lebih tinggi: tekanan jual melemah, peluang pembalikan naik.`]
        if (t === 'L' && b.p > a.p && v2 < v1 - th) type = ['Bullish tersembunyi', 1, `Harga lembah lebih tinggi tetapi ${nm} lebih rendah: koreksi sehat dalam tren naik, peluang kelanjutan.`]
        if (t === 'H' && b.p > a.p && v2 < v1 - th) type = ['Bearish reguler', -1, `Harga membuat puncak lebih tinggi tetapi ${nm} puncak lebih rendah: momentum naik melemah, rawan pembalikan turun.`]
        if (t === 'H' && b.p < a.p && v2 > v1 + th) type = ['Bearish tersembunyi', -1, `Harga puncak lebih rendah tetapi ${nm} lebih tinggi: rebound dalam tren turun, peluang kelanjutan turun.`]
        if (!type) continue
        let ok = null; for (let j = b.i + 1; j <= Math.min(last, b.i + 5); j++) { if (type[1] > 0 ? B[j].c > B[b.i].h : B[j].c < B[b.i].l) { ok = j; break } }
        divs.push({ ind: nm, a, b, v1, v2, name: type[0], bias: type[1], d: type[2], ok, active: b.i >= last - 20, reg: /reguler/.test(type[0]) })
      }
    }
  }
  // Hanya divergensi terbaru per indikator & jenis; keyakinan naik bila RSI dan MACD sepakat di pivot yang sama.
  const latest = Object.values(divs.reduce((m, d) => { const k = d.ind + d.name; if (!m[k] || m[k].b.i < d.b.i) m[k] = d; return m }, {})).sort((x, y) => y.b.i - x.b.i)
  latest.forEach(d => {
    const both = divs.some(o => o !== d && o.ind !== d.ind && o.bias === d.bias && o.b.i === d.b.i)
    const zone = d.ind === 'RSI' && (d.bias > 0 ? d.v1 < 35 : d.v1 > 65)
    d.conf = Math.round(Math.min(95, 40 + (d.reg ? 10 : 0) + (both ? 15 : 0) + (zone ? 10 : 0) + (d.ok ? 15 : 0) - (d.active ? 0 : 10)))
    d.both = both; d.zone = zone
  })
  return latest
}

// ---- Zona reaksi volume: candle bervolume ≥ 2× rata-rata menandai area yang dipertahankan pelaku besar ----
export function volumeZones(B, I) {
  const { atrAt, volX } = helpers(B, I), N = B.length, last = N - 1
  let zones = []
  for (let i = Math.max(20, N - 250); i <= last; i++) {
    const vx = volX(i); if (!(vx >= 2)) continue
    const b = B[i], at = atrAt(i), mid = (b.o + b.c) / 2, half = Math.max(Math.abs(b.c - b.o) / 2, 0.3 * at)
    const z = { i, lo: mid - half, hi: mid + half, vx, n: 1, side: b.c >= b.o ? 'beli' : 'jual' }
    const same = zones.find(o => z.lo <= o.hi && z.hi >= o.lo)
    if (same) { same.lo = Math.min(same.lo, z.lo); same.hi = Math.max(same.hi, z.hi); same.vx = Math.max(same.vx, vx); same.n++; same.last = i }
    else zones.push({ ...z, last: i })
  }
  const c0 = B[last].c
  zones.forEach(z => {
    // Uji reaksi: tiap episode harga menyentuh zona, apakah memantul (bertahan) atau ditembus dalam 5 hari.
    let holds = 0, breaks = 0, inside = false
    for (let j = z.last + 2; j <= last; j++) {
      const touch = B[j].l <= z.hi && B[j].h >= z.lo
      if (touch && !inside) {
        inside = true
        const from = B[j - 1].c > z.hi ? 1 : B[j - 1].c < z.lo ? -1 : 0
        if (from) {
          let res = 0
          for (let k = j; k <= Math.min(last, j + 5); k++) {
            if (from > 0 ? B[k].c < z.lo : B[k].c > z.hi) { res = -1; break }
            if (from > 0 ? B[k].c > z.hi + 0.5 * atrAt(k) : B[k].c < z.lo - 0.5 * atrAt(k)) { res = 1; break }
          }
          if (res > 0) holds++; else if (res < 0) breaks++
        }
      } else if (!touch) inside = false
    }
    z.holds = holds; z.breaks = breaks
    z.role = c0 > z.hi ? 'support' : c0 < z.lo ? 'resistance' : 'inside'
    z.dist = c0 > z.hi ? (c0 - z.hi) / c0 : c0 < z.lo ? (z.lo - c0) / c0 : 0
    z.str = Math.round(Math.max(5, Math.min(95, 30 + Math.min(25, (z.vx - 2) * 8) + z.n * 5 + holds * 12 - breaks * 15)))
  })
  zones = zones.filter(z => z.breaks <= z.holds + 1)
  return [...zones.filter(z => z.role === 'support').sort((a, b) => a.dist - b.dist).slice(0, 2), ...zones.filter(z => z.role === 'inside'), ...zones.filter(z => z.role === 'resistance').sort((a, b) => a.dist - b.dist).slice(0, 2)]
}

// Analisa struktur atas seluruh candle harian (tidak bergantung rentang chart).
// Tiap pola: { id, key, name, kind, bias, status, statusTxt, pts, segs[{nm,i1,p1,i2,p2}], curve?, labels?, trigNow, target, target2?, inv,
//   bo, end, boVol, volTxt, conf, notes, info, hist }
export function analyzePatterns(B, I) {
  const N = B.length, last = N - 1, { atrAt, volX } = helpers(B, I)
  const scales = [zigzag(B, atrAt, 1.5, 0.03), zigzag(B, atrAt, 2.5, 0.05), zigzag(B, atrAt, 4, 0.08)]
  const raw = rawPatterns(B, I, scales)

  // Status: breakout (penutupan melewati level breakout), target, invalidasi, atau kedaluwarsa.
  const evalP = p => {
    const bias = PATTERNS[p.key].b, span = Math.max(5, p.e - p.start)
    const maxWait = p.wait ?? Math.max(15, Math.round(span * 0.8)), maxRun = Math.max(25, span * 2)
    let status = p.open ? 'forming' : 'ready', bo = null, end = null, back = 0, fakeout = false
    // Level breakout dibekukan di batas waktu tunggu (garis miring tidak diperpanjang tanpa batas), lalu di titik breakout.
    const trigAt = j => p.trig(Math.min(j, bo ?? p.e + maxWait))
    if (!p.open) for (let j = p.e + 1; j <= last; j++) {
      const c = B[j].c
      if (bo == null) {
        if (bias > 0 ? c < p.inv : c > p.inv) { status = 'failed'; end = j; break }
        if (bias > 0 ? c > trigAt(j) : c < trigAt(j)) { bo = j; status = 'breakout' }
        else if (j - p.e > maxWait) { status = 'expired'; end = j; break }
      }
      if (bo != null) {
        if (bias > 0 ? B[j].h >= p.target : B[j].l <= p.target) { status = 'target'; end = j; break }
        if (j > bo && (bias > 0 ? c < p.inv : c > p.inv)) { status = 'failed'; end = j; break }
        // Breakout palsu: 3 penutupan berturut-turut kembali ke sisi dalam level breakout.
        back = j > bo && (bias > 0 ? c < trigAt(j) : c > trigAt(j)) ? back + 1 : 0
        if (back >= 3) { status = 'failed'; end = j; fakeout = true; break }
        if (j - bo > maxRun) { status = 'expired'; end = j; break }
      }
    }
    const boVol = bo != null ? Math.max(volX(bo) || 0, bo < last ? volX(bo + 1) || 0 : 0) : null
    // Garis pola sebagai segmen data: garis yang diperpanjang berhenti di breakout / batas tunggu.
    const endI = end ?? last
    const segs = p.lines.map(o => {
      const i2 = o.ext ? Math.min(endI, bo ?? p.e + maxWait) : o.to
      return { nm: o.nm || '', i1: o.from, p1: o.l.at(o.from), i2, p2: o.l.at(i2) }
    }).filter(s => s.i2 > s.i1)
    const { trig, lines, curve, ...rest } = p
    return { ...rest, bias, status, bo, end, boVol, maxWait, fakeout, trigNow: trigAt(last), segs, curve: curve ? cupCurve(curve) : null }
  }
  // Saring duplikat lintas skala: jenis sama dengan rentang beririsan ≥ 50% atau titik akhir berdekatan → ambil kualitas tertinggi.
  const overlap = (a, b) => { const x = Math.min(a.e, b.e) - Math.max(a.start, b.start); return x / Math.max(1, Math.min(a.e - a.start, b.e - b.start)) }
  const all = raw.map(evalP).sort((a, b) => b.q - a.q).filter((p, k, arr) => !arr.slice(0, k).some(o => o.key === p.key && (Math.abs(o.e - p.e) <= 6 || overlap(o, p) >= 0.5)))
  // Riwayat keberhasilan per jenis pola di saham ini.
  const hist = {}
  all.filter(p => p.status === 'target' || p.status === 'failed').forEach(p => { const h = hist[p.key] ||= { n: 0, hit: 0 }; h.n++; if (p.status === 'target') h.hit++ })
  const valDay = (I.vma[last] || 0) * 100 * B[last].c
  all.forEach(p => {
    const P = PATTERNS[p.key], notes = []
    p.id = p.key + '-' + p.start + '-' + p.e
    p.name = P.n; p.kind = p.bias > 0 ? 'bullish' : 'bearish'; p.type = P.k; p.desc = P.d
    let c = 35 + p.q * 30
    // Konteks tren sebelum pola: pola pembalikan butuh tren sebelumnya yang berlawanan.
    const s0 = Math.max(0, p.start - 30), chg = (B[p.start].c - B[s0].c) / (B[s0].c || 1)
    if (P.k === 'Pembalikan') {
      if (p.bias > 0 ? chg <= -0.08 : chg >= 0.08) { c += 10; notes.push(`Didahului tren ${p.bias > 0 ? 'turun' : 'naik'} ${Math.round(Math.abs(chg) * 100)}%, konteks pembalikan sahih.`) }
      else { c -= 5; notes.push('Tidak didahului tren yang jelas; pola pembalikan kurang bermakna.') }
    } else if (P.k === 'Kelanjutan') {
      if (p.bias > 0 ? chg >= 0 : chg <= 0) { c += 5; notes.push(`Searah tren sebelumnya (${chg >= 0 ? '+' : ''}${Math.round(chg * 100)}%).`) }
      else { c -= 5; notes.push('Berlawanan dengan tren sebelumnya.') }
    }
    // Volume menyusut selama pembentukan = konsolidasi sehat.
    const mid = Math.round((p.start + p.e) / 2), avgV = (i1, i2) => { const s = B.slice(i1, i2 + 1); return s.reduce((t, x) => t + x.v, 0) / (s.length || 1) }
    if (p.dry || avgV(mid, p.e) < 0.85 * avgV(p.start, mid)) { c += 5; notes.push('Volume menyusut selama pola terbentuk.') }
    if (p.bo != null) {
      if (p.boVol >= 1.5) { c += 15; notes.push(`Breakout bervolume ${x2(p.boVol)} rata-rata 20 hari, terkonfirmasi.`) }
      else if (p.boVol >= 1) { c += 5; notes.push(`Volume breakout ${x2(p.boVol)} rata-rata: cukup, belum kuat.`) }
      else { c -= 10; notes.push(`Volume breakout hanya ${x2(p.boVol)} rata-rata, rawan breakout palsu.`) }
    }
    if (p.status === 'forming') { c -= 10; notes.push('Titik terakhir pola belum terkonfirmasi.') }
    if (p.status === 'ready' && last - p.e > p.maxWait * 0.7) { c -= 5; notes.push('Pola mulai lama menunggu breakout.') }
    const h = hist[p.key], done = p.status === 'target' || p.status === 'failed'
    const hn = h ? h.n - (done ? 1 : 0) : 0, hh = h ? h.hit - (p.status === 'target' ? 1 : 0) : 0
    if (hn >= 2) { c += (hh / hn - 0.5) * 30; notes.push(`Riwayat 1 tahun di saham ini: ${hh} dari ${hn} pola serupa mencapai target.`) }
    if (valDay < 5e8) { c -= 10; notes.push('Likuiditas tipis; pola mudah rusak oleh satu transaksi besar.') }
    p.conf = Math.round(Math.max(5, Math.min(95, c)))
    p.notes = notes; p.hist = hn ? { n: hn, hit: hh } : null
    p.statusTxt = ptStatusTxt(p)
    const dir = p.bias > 0 ? 'breakout' : 'breakdown'
    p.volTxt = p.bo != null
      ? (p.boVol >= 1.5 ? `Terkonfirmasi: volume ${x2(p.boVol)} rata-rata saat ${dir} (${fmtDate(B[p.bo].d)})` : p.boVol >= 1 ? `Lemah: volume ${x2(p.boVol)} rata-rata saat ${dir}` : `Tidak terkonfirmasi: volume hanya ${x2(p.boVol)} rata-rata`)
      : `Belum: butuh penutupan ${p.bias > 0 ? 'di atas' : 'di bawah'} ${rp(p.trigNow)} dengan volume ≥ 1,5× rata-rata 20 hari`
  })
  // Aktif = masih relevan hari ini: sedang terbentuk, menunggu breakout ≤ 30 hari, atau breakout ≤ 30 hari lalu.
  const fresh = p => p.status === 'forming' || (p.status === 'ready' && last - p.e <= 30) || (p.status === 'breakout' && last - p.bo <= 30)
  const active = all.filter(fresh).sort((a, b) => b.conf - a.conf)
    .filter((p, k, arr) => !arr.slice(0, k).some(o => o.key === p.key && overlap(o, p) > 0)).slice(0, 6)
  const recent = all.filter(p => (p.status === 'target' || p.status === 'failed') && p.end >= last - 20).sort((a, b) => b.end - a.end).slice(0, 4)

  return { all, active, recent, hist, candles: detectCandles(B, I), divs: detectDivergences(B, I, scales[0]), zones: volumeZones(B, I), valDay }
}

// ---- Fibonacci & volume profile pada rentang chart yang dipilih ----
export function fibLevels(V) {
  let hiI = 0, loI = 0; V.forEach((b, k) => { if (b.h > V[hiI].h) hiI = k; if (b.l < V[loI].l) loI = k })
  const H = V[hiI].h, L = V[loI].l, upSwing = loI < hiI, R = H - L
  // Swing naik: retracement diukur turun dari puncak; swing turun: naik dari dasar.
  const fib = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map(r => ({ r, p: upSwing ? H - r * R : L + r * R, lbl: (r * 100).toFixed(1).replace('.0', '').replace('.', ',') + '%' }))
    .concat([1.272, 1.618].map(r => ({ r, ext: true, p: Math.max(1, upSwing ? H + (r - 1) * R : L - (r - 1) * R), lbl: 'Ekstensi ' + (r * 100).toFixed(1).replace('.', ',') + '%' })))
  const gp = [upSwing ? H - 0.618 * R : L + 0.5 * R, upSwing ? H - 0.5 * R : L + 0.618 * R]
  return { fib, upSwing, H, L, hiD: V[hiI].d, loD: V[loI].d, gp }
}

// Volume per tingkat harga: volume tiap candle dibagi rata sepanjang rentang high–low.
export function volumeProfile(V, bins = 24) {
  const lo = Math.min(...V.map(b => b.l)), hi = Math.max(...V.map(b => b.h)), step = (hi - lo) / bins || 1
  const vol = Array(bins).fill(0)
  V.forEach(b => {
    const r = b.h - b.l
    for (let k = 0; k < bins; k++) {
      const bl = lo + k * step, bh = bl + step
      const ov = r > 0 ? Math.max(0, Math.min(bh, b.h) - Math.max(bl, b.l)) / r : (b.c >= bl && (b.c < bh || k === bins - 1) ? 1 : 0)
      vol[k] += b.v * ov
    }
  })
  const tot = vol.reduce((s, v) => s + v, 0) || 1, poc = vol.indexOf(Math.max(...vol))
  // Value area: melebar dari POC ke sisi bervolume lebih besar sampai 70% volume.
  let a = poc, z = poc, acc = vol[poc]
  while (acc < 0.7 * tot && (a > 0 || z < bins - 1)) { const dn = a > 0 ? vol[a - 1] : -1, upv = z < bins - 1 ? vol[z + 1] : -1; if (upv >= dn) acc += vol[++z]; else acc += vol[--a] }
  const mean = tot / bins
  const nodes = vol.map((v, k) => ({ k, v, p: lo + (k + 0.5) * step, kind: v >= 1.3 * mean && v >= (vol[k - 1] ?? 0) && v >= (vol[k + 1] ?? 0) ? 'HVN' : v <= 0.5 * mean && k > a && k < z ? 'LVN' : '' })).filter(x => x.kind)
  return { lo, step, vol, poc, pocP: lo + (poc + 0.5) * step, val: lo + a * step, vah: lo + (z + 1) * step, a, z, nodes }
}

export function levels(B, range) {
  const n = Math.min(range, B.length), V = B.slice(B.length - n), c = B.at(-1).c, f = fibLevels(V)
  const below = f.fib.filter(x => x.p < c).sort((a, b) => b.p - a.p)[0], above = f.fib.filter(x => x.p > c).sort((a, b) => a.p - b.p)[0]
  return { ...f, off: B.length - n, n, below, above, vp: volumeProfile(V) }
}

export function fibRead(Lv, c, zones) {
  const t = []
  if (Lv.below && Lv.above) t.push(`Harga ${rp(c)} di antara Fib ${Lv.below.lbl} (${rp(Lv.below.p)}) dan ${Lv.above.lbl} (${rp(Lv.above.p)}).`)
  const [g1, g2] = Lv.gp
  if (c >= Math.min(g1, g2) && c <= Math.max(g1, g2)) t.push('Harga berada di golden pocket (50–61,8%), area rebound/rejection paling sering.')
  // Confluence: level Fibonacci yang berdekatan (≤1,5%) dengan POC atau zona volume = level lebih kuat.
  const conf = Lv.fib.filter(fb => Math.abs(fb.p - Lv.vp.pocP) / fb.p <= 0.015 || zones.some(z => fb.p >= z.lo * 0.985 && fb.p <= z.hi * 1.015))
  if (conf.length) t.push(`Confluence: Fib ${conf.map(fb => fb.lbl + ' ' + rp(fb.p)).join(', ')} berimpit dengan POC/zona volume, level lebih kuat.`)
  return t.join(' ')
}

// Bias struktur gabungan: pola aktif (dibobot keyakinan), candlestick 3 hari terakhir, divergensi aktif, posisi vs value area.
export function structure(B, A, Lv) {
  const c = B.at(-1).c, last = B.length - 1, why = []
  let s = 0
  A.active.filter(p => p.status !== 'forming').forEach(p => { const w = p.bias * p.conf / 100 * (p.status === 'breakout' ? 1.5 : 1); s += w; why.push([w, `${p.name}: ${p.statusTxt.toLowerCase()} (keyakinan ${p.conf}%)`]) })
  A.candles.filter(k => k.i >= last - 2 && k.bias !== 0).forEach(k => { const w = k.bias * k.conf / 200; s += w; why.push([w, `Candlestick ${k.n} ${fmtDate(B[k.i].d)}${k.loc ? ' ' + k.loc : ''}`]) })
  A.divs.filter(d => d.active).forEach(d => { const w = d.bias * d.conf / 150; s += w; why.push([w, `Divergensi ${d.name.toLowerCase()} ${d.ind}`]) })
  if (Lv) { const w = c > Lv.vp.vah ? 0.3 : c < Lv.vp.val ? -0.3 : 0; if (w) { s += w; why.push([w, `Harga ${w > 0 ? 'di atas' : 'di bawah'} area nilai volume (${rp(Lv.vp.val)}–${rp(Lv.vp.vah)})`]) } }
  const res = A.zones.find(z => z.role === 'resistance'), sup = A.zones.find(z => z.role === 'support')
  if (res && res.dist < 0.03) { s -= 0.3; why.push([-0.3, `Menempel zona volume resistance ${rp(res.lo)}–${rp(res.hi)}`]) }
  if (sup && sup.dist < 0.03) { s += 0.3; why.push([0.3, `Di atas zona volume support ${rp(sup.lo)}–${rp(sup.hi)}`]) }
  const sig = s >= 1 ? ['Bullish', 'good'] : s >= 0.4 ? ['Cenderung bullish', 'good'] : s <= -1 ? ['Bearish', 'strong'] : s <= -0.4 ? ['Cenderung bearish', 'strong'] : ['Netral', 'warn']
  return { s, sig, why: why.sort((a, b) => Math.abs(b[0]) - Math.abs(a[0])) }
}

// Kelebihan & kekurangan setup teknikal: suara indikator, pola, konteks rentang 1 tahun, volatilitas, likuiditas, fundamental.
export function taProsCons(B, I, s, pa, A) {
  const pros = [], cons = [], i = B.length - 1, c = B[i].c
  s.votes.forEach(v => (v.s > 0 ? pros : v.s < 0 ? cons : []).push({ t: v.k, d: v.txt }))
  ;(A?.active || []).filter(p => p.conf >= 50 && p.status !== 'forming').forEach(p => (p.bias > 0 ? pros : cons).push({ t: `${p.name}: ${p.statusTxt.toLowerCase()} (${p.conf}%)`, d: `Target ${rp(p.target)}, invalidasi ${rp(p.inv)}.` }))
  ;(A?.divs || []).filter(d => d.active && d.conf >= 50).forEach(d => (d.bias > 0 ? pros : cons).push({ t: `Divergensi ${d.name.toLowerCase()} ${d.ind}`, d: d.d }))
  const vz = A?.zones || [], rz = vz.find(z => z.role === 'resistance'), sz = vz.find(z => z.role === 'support')
  if (rz && rz.dist < 0.05) cons.push({ t: `Zona volume resistance dekat (${rp(rz.lo)}–${rp(rz.hi)})`, d: `${rz.holds} kali menahan harga; ${pct1(rz.dist)}% di atas harga.` })
  if (sz && sz.dist < 0.05 && sz.holds >= 1) pros.push({ t: `Zona volume support dekat (${rp(sz.lo)}–${rp(sz.hi)})`, d: `${sz.holds} kali rebound dari zona ini.` })
  const yr = B.slice(-250), hi = Math.max(...yr.map(b => b.h)), lo = Math.min(...yr.map(b => b.l)), pos = (c - lo) / (hi - lo || 1)
  if (pos < 0.25) pros.push({ t: `Dekat dasar 1 tahun (${Math.round(pos * 100)}% rentang)`, d: `Rentang ${rp(lo)}–${rp(hi)}; ruang turun relatif kecil terhadap rentang.` })
  if (pos > 0.85) cons.push({ t: `Dekat puncak 1 tahun (${Math.round(pos * 100)}% rentang)`, d: `Rentang ${rp(lo)}–${rp(hi)}; ruang naik terbatas sebelum menguji puncak.` })
  const atrP = (I.atr[i] || 0) / c
  if (atrP > 0.08) cons.push({ t: `Volatilitas tinggi (ATR ${pct1(atrP)}% per hari)`, d: 'Stop loss harus lebar sehingga ukuran posisi kecil; risiko gap besar.' })
  if (s.rr != null) (s.rr >= 2 ? pros : s.rr < 1.5 ? cons : []).push({ t: `Imbal-risiko ke resistance ${s.rr.toFixed(1).replace('.', ',')} : 1`, d: `Resistance ${rp(s.res)}, invalidasi ${rp(s.stop)}.` })
  if (s.valDay < 5e8) cons.push({ t: `Likuiditas tipis (${big(s.valDay)}/hari)`, d: 'Indikator mudah terdistorsi satu-dua transaksi besar.' })
  else if (s.valDay >= 5e9) pros.push({ t: `Likuid (${big(s.valDay)}/hari)`, d: 'Sinyal teknikal lebih dapat diandalkan.' })
  if (pa) (/asimetri/i.test(pa.sikap) ? pros : /hindari|spekulatif/i.test(pa.sikap) ? cons : []).push({ t: `Pandangan fundamental: ${pa.sikap}`, d: s.score >= 2 && /hindari|spekulatif/i.test(pa.sikap) ? 'Momentum naik bertentangan dengan fundamental; perlakukan sebagai trading jangka pendek.' : '' })
  return [pros, cons]
}

// Kelebihan & kekurangan rencana transaksi Spekulasi.
export function spProsCons(pl, pa) {
  const pros = [], cons = [], s = pl.s
  if (pl.usePola) pros.push({ t: `Berbasis pola ${pl.bp.name} (${pl.bp.conf}%)`, d: `Level masuk, stop, dan target diturunkan dari geometri pola; invalidasi ${rp(pl.bp.inv)} jelas.` })
  if (!pl.entry) cons.push({ t: 'Tidak ada setup beli', d: `Sinyal teknikal ${s.sig[0]}; rencana hanya untuk pemegang.` })
  else if (s.score >= 2) pros.push({ t: 'Searah tren', d: 'Membeli saat koreksi dalam tren naik; peluang historis lebih baik daripada menebak dasar.' })
  else if (!pl.usePola) pros.push({ t: 'Menunggu konfirmasi breakout', d: `Posisi baru dibuka bila ${rp(s.res)} ditembus; risiko salah arah lebih kecil.` })
  if (pl.entry) {
    const sp = (pl.entry - pl.stop) / pl.entry
    ;(sp <= 0.07 ? pros : sp > 0.1 ? cons : []).push({ t: `Jarak stop ${pct1(sp)}%`, d: sp > 0.1 ? 'Stop lebar memperkecil ukuran posisi.' : 'Risiko per lembar terkendali.' })
    pros.push({ t: pl.usePola ? 'Target terukur dari pola' : 'Target terukur 1,5R & 3R', d: `Target 1 ${rp(pl.tp1)}, Target 2 ${rp(pl.tp2)}; separuh posisi diamankan di Target 1.` })
    if (pl.resBlock) cons.push({ t: `Resistance ${rp(pl.resBlock)} sebelum Target 1`, d: 'Harga bisa tertahan sebelum target pertama.' })
  }
  if (pl.frozen) cons.push({ t: 'Harga tidak bergerak / tanpa volume', d: 'Kemungkinan suspensi atau harga lantai.' })
  if (s.valDay < 5e8) cons.push({ t: `Likuiditas tipis (${big(s.valDay)}/hari)`, d: 'Rawan gap melewati stop loss; ukuran posisi dibatasi.' })
  else if (s.valDay >= 5e9) pros.push({ t: `Likuid (${big(s.valDay)}/hari)`, d: 'Posisi bisa dibuka-tutup tanpa menggerakkan harga.' })
  const atrP = pl.atr / pl.c
  if (atrP > 0.08) cons.push({ t: `Volatilitas tinggi (ATR ${pct1(atrP)}%/hari)`, d: 'Satu hari buruk bisa melewati stop; gunakan ukuran kecil.' })
  else if (atrP < 0.04) pros.push({ t: `Volatilitas terkendali (ATR ${pct1(atrP)}%/hari)`, d: 'Stop bisa ketat sehingga ukuran posisi lebih efisien.' })
  if (s.rr != null && s.rr >= 2) pros.push({ t: `Imbal-risiko ke resistance ${s.rr.toFixed(1).replace('.', ',')} : 1`, d: '' })
  if (pa && /hindari/i.test(pa.sikap)) cons.push({ t: 'Pandangan analis Hindari', d: 'Ukuran posisi otomatis dipotong 50%.' })
  else if (pa && /spekulatif/i.test(pa.sikap)) cons.push({ t: 'Pandangan analis Spekulatif tinggi', d: 'Perlakukan sebagai trading jangka pendek dengan disiplin stop.' })
  else if (pa && /asimetri/i.test(pa.sikap)) pros.push({ t: 'Didukung pandangan fundamental', d: pa.sikap })
  return [pros, cons]
}

// Pola beli terbaik untuk Spekulasi: bullish, sudah lengkap (siap/breakout), keyakinan ≥ 45%.
export const bestBullPattern = A => A?.active.find(p => p.bias > 0 && (p.status === 'ready' || p.status === 'breakout') && p.conf >= 45) || null

// Rencana dari pola: entry di breakout/retest level breakout, stop di bawah invalidasi, Target 2 = target pola.
// `pl` = hasil buildPlan (ta.js); dikembalikan salinan baru dengan field yang sama + { bp, usePola }.
export function polaPlan(pl, bp) {
  const { atr, c, s } = pl, tg = bp.trigNow, nm = bp.name
  let type, entryLo, entryHi, entry, note
  if (bp.status === 'breakout') {
    type = `Pola ${nm}: beli saat retest level breakout`
    // Zona retest tidak boleh di bawah/menempel level invalidasi (bisa terjadi pada baji yang curam).
    const base = Math.max(tg, bp.inv + 0.5 * atr)
    entryLo = floorTick(base); entryHi = floorTick(Math.max(base, Math.min(c, base + 0.5 * atr))); entry = floorTick((entryLo + entryHi) / 2)
    note = `Breakout ${nm} sudah terjadi; beli saat harga kembali menguji ${rp(tg)} dan bertahan. Keyakinan pola ${bp.conf}%.`
  } else {
    type = `Pola ${nm}: beli saat breakout`
    entry = ceilTick(tg + tick(tg)); entryLo = entry; entryHi = ceilTick(entry + 0.3 * atr)
    note = `Aktif hanya bila harga ditutup di atas ${rp(tg)} dengan volume ≥ 1,5× rata-rata. Keyakinan pola ${bp.conf}%.`
  }
  let stop = floorTick(bp.inv - tick(bp.inv))
  if (stop >= entry) stop = floorTick(entry - Math.max(tick(entry), atr))
  const R = entry - stop
  let tp1 = floorTick(entry + 1.5 * R), tp2 = floorTick(entry + 3 * R)
  // Target pola menjadi Target 2; Target 1 tidak melampaui separuh jalan ke target pola.
  const pt = floorTick(bp.target)
  if (pt > entry) { tp2 = pt; tp1 = Math.min(tp1, floorTick(entry + (pt - entry) / 2)) }
  const resBlock = s.res > entry && s.res < tp1 ? s.res : null
  return { ...pl, type, entryLo, entryHi, entry, stop, R, tp1, tp2, resBlock, note, bp, usePola: true }
}

// Syarat tambahan kelayakan dari struktur harga.
export function structureChecks(A) {
  if (!A) return []
  const b = A.active.find(p => p.bias < 0 && p.status !== 'forming' && p.conf >= 60)
  return [
    { ok: !b, text: b ? `Tidak ada pola bearish kuat (ada: ${b.name} ${b.conf}%)` : 'Tidak ada pola bearish aktif berkeyakinan ≥ 60%' },
    { ok: !A.divs.some(d => d.active && d.bias < 0 && d.conf >= 50), text: 'Tidak ada divergensi bearish aktif' },
  ]
}

// Vonis kelayakan (aturan sama dengan moneyMgmt di ta.js) untuk daftar syarat yang sudah ditambah.
export function verdictOf(pl, checklist) {
  const fails = checklist.filter(x => !x.ok).length
  return !pl.entry || pl.frozen ? { text: 'Tidak layak dibuka sekarang', cls: 'bad' }
    : fails === 0 ? { text: 'Layak dieksekusi sesuai rencana', cls: 'good' }
    : fails <= 2 ? { text: 'Layak dengan ukuran diperkecil & disiplin stop', cls: 'warn' }
    : { text: 'Tidak layak: terlalu banyak syarat gagal', cls: 'bad' }
}
