// Screening Harmonic Pattern POV (/api/harmonik): label status, saringan, dan teks ringkas baris.

export const HM_STATUS = {
  prz: ['Di PRZ', 't-warn', 'Titik D sedang berada di Potential Reversal Zone; tunggu konfirmasi sebelum entry.'],
  berbalik: ['Berbalik dari PRZ', 't-good', 'D terkonfirmasi di PRZ dan harga mulai bergerak berlawanan arah kaki CD.'],
  menuju: ['Menuju PRZ', 't-calm', 'X-A-B-C sudah terbentuk; harga masih bergerak ke PRZ. Belum ada titik D.'],
}

// Saringan tampilan: status ('semua' | 'prz' | 'berbalik' | 'menuju') dan arah ('semua' | 'bullish' | 'bearish').
export function saringHarmonik(rows = [], status = 'semua', arah = 'semua') {
  return rows.filter(r => (status === 'semua' || r.status === status) && (arah === 'semua' || r.arah === arah))
}

export function hitungHarmonik(rows = []) {
  const n = { semua: rows.length, prz: 0, berbalik: 0, menuju: 0, bullish: 0, bearish: 0 }
  for (const r of rows) { n[r.status] = (n[r.status] || 0) + 1; n[r.arah] = (n[r.arah] || 0) + 1 }
  return n
}

const angka = (v, n = 2) => v == null ? '–' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: n })
// Rentang rasio: [0.618, 0.618] -> "0,618"; [0.382, 0.886] -> "0,382–0,886".
export const rentang = r => !r ? '–' : r[0] === r[1] ? angka(r[0], 3) : `${angka(r[0], 3)}–${angka(r[1], 3)}`
export const titikTeks = titik => (titik || []).map(x => `${x.n} ${angka(x.p)} (${x.d})`).join(' · ')
export const przTeks = r => `${angka(r.prz?.[0])}–${angka(r.prz?.[1])}`

// Titik diagram pola dari rasio (nilai tengah tiap rentang): y 0 = X, 1 = A untuk bullish (dibalik untuk bearish).
// Hasil: { X, A, B, C, D } (y), dan prz [lo, hi] (y) di sekitar D.
const tengah = r => r ? (r[0] + r[1]) / 2 : null
export function polaDiagram(p, arah = 'bullish') {
  if (!p) return null
  const X = 0, A = 1, B = A - tengah(p.b)
  let C, D
  if (p.cx) { C = tengah(p.cx); D = C - tengah(p.dxc) * C }
  else { C = B + tengah(p.c) * (A - B); D = A - tengah(p.d) }
  const lebar = 0.03 * (p.cx ? C : 1)
  const y = { X, A, B, C, D }
  const balik = v => arah === 'bearish' ? 1 - v : v
  return { y: Object.fromEntries(Object.entries(y).map(([k, v]) => [k, balik(v)])), prz: [balik(D - lebar), balik(D + lebar)].sort((a, b) => a - b) }
}

// Peta nilai ke koordinat SVG: xs/ys = deret nilai; keluaran fungsi fx(i), fy(v) dalam kotak w x h dengan pad.
export function skalaSvg(ys, w, h, pad = 24) {
  const lo = Math.min(...ys), hi = Math.max(...ys), rng = hi - lo || 1
  return { fy: v => pad + (h - 2 * pad) * (1 - (v - lo) / rng), lo, hi }
}

// Rencana dari baris screening: area entry (PRZ, atau harga kini bila sudah berbalik), stop, target, dan R:R target 1.
export function rencanaHarmonik(r) {
  if (!r?.prz) return null
  const bull = r.arah === 'bullish'
  const entry = r.status === 'berbalik' ? r.harga : bull ? r.prz[1] : r.prz[0]
  const risiko = Math.abs(entry - r.stop)
  const t1 = r.target?.[0], t2 = r.target?.[1]
  const rr = t => t == null || !risiko ? null : Math.round(Math.abs(t - entry) / risiko * 10) / 10
  return { entry, stop: r.stop, t1, t2, rr1: rr(t1), rr2: rr(t2), risikoPct: Math.round(risiko / entry * 1000) / 10 }
}

// Rasio terukur dibanding kriteria pola (untuk centang di slide Analisa).
export function cekRasio(r, pola) {
  const p = (pola || []).find(x => x.k === r?.pola)
  if (!p || !r?.rasio) return []
  const tol = v => [v[0] * 0.95, v[1] * 1.05]
  const baris = [['B / XA', r.rasio.b, p.b]]
  if (p.cx) baris.push(['C / XA (C melewati A)', r.rasio.cx, p.cx])
  else baris.push(['C / AB', r.rasio.c, p.c])
  return baris.map(([label, nilai, k]) => ({ label, nilai, kriteria: k, ok: nilai != null && nilai >= tol(k)[0] && nilai <= tol(k)[1] }))
}

// ------------------------------------------------------------------ analisa ----
const emaAkhir = (xs, n) => {
  if (xs.length < n) return null
  let e = xs.slice(0, n).reduce((a, b) => a + b, 0) / n
  const k = 2 / (n + 1)
  for (let i = n; i < xs.length; i++) e = xs[i] * k + e * (1 - k)
  return e
}
function rsiAkhir(xs, n = 14) {
  if (xs.length <= n) return null
  let g = 0, l = 0
  for (let i = 1; i <= n; i++) { const d = xs[i] - xs[i - 1]; g += Math.max(d, 0); l += Math.max(-d, 0) }
  g /= n; l /= n
  for (let i = n + 1; i < xs.length; i++) { const d = xs[i] - xs[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l)
}
// Indeks bar pada tanggal d (YYYY-MM-DD) atau bar pertama sesudahnya.
export function idxTanggal(bars, d) {
  const i = bars.findIndex(b => String(b.d).slice(0, 10) >= d)
  return i < 0 ? bars.length - 1 : i
}
const bulat1 = v => v == null ? null : Math.round(v * 10) / 10

// Analisa satu pola dari baris /api/harmonik + bar harian: struktur kaki, simetri AB=CD, presisi rasio, tren besar
// (EMA50/EMA200), RSI, volume di D, skor kualitas (dengan rincian), narasi, dan skenario.
export function analisaHarmonik(r, bars = [], pola = [], likuid = true) {
  if (!r?.titik?.length || !bars.length) return null
  const bull = r.arah === 'bullish'
  const p = Object.fromEntries(r.titik.map(t => [t.n, t.p]))
  const ix = Object.fromEntries(r.titik.map(t => [t.n, idxTanggal(bars, t.d)]))
  const urut = r.titik.map(t => t.n)
  const kaki = urut.slice(1).map((k, i) => ({ n: urut[i] + k, pct: bulat1((p[k] / p[urut[i]] - 1) * 100), bar: ix[k] - ix[urut[i]] }))
  const meta = pola.find(x => x.k === r.pola) || {}
  const simetri = p.D != null && !meta.cx
    ? { harga: Math.round(Math.abs(p.D - p.C) / Math.abs(p.B - p.A) * 100) / 100, waktu: Math.round((ix.D - ix.C) / Math.max(1, ix.B - ix.A) * 100) / 100 }
    : null
  const cl = bars.map(b => b.c), akhir = cl[cl.length - 1]
  const e50 = emaAkhir(cl, 50), e200 = emaAkhir(cl, 200)
  const naik = e200 ? akhir > e200 && e50 > e200 : e50 != null && akhir > e50
  const turun = e200 ? akhir < e200 && e50 < e200 : e50 != null && akhir < e50
  const tren = naik ? 'naik' : turun ? 'turun' : 'mendatar'
  const searah = bull ? tren === 'naik' : tren === 'turun'
  const rsi = bulat1(rsiAkhir(cl))
  let volD = null
  if (ix.D != null) {
    const pra = bars.slice(Math.max(0, ix.D - 20), ix.D)
    const rata = pra.reduce((a, b) => a + b.v, 0) / (pra.length || 1)
    volD = rata ? Math.round(bars[ix.D].v / rata * 10) / 10 : null
  }
  // Skor kualitas: tiap komponen bernilai maksimum tertentu; komponen yang tidak berlaku tidak dihitung.
  const cek = cekRasio(r, pola)
  const tepat = cek.map(c => c.nilai >= c.kriteria[0] && c.nilai <= c.kriteria[1] ? 1 : c.ok ? 0.7 : 0)
  const rincian = [
    { k: 'Presisi rasio', nilai: cek.length ? Math.round(tepat.reduce((a, b) => a + b, 0) / cek.length * 30) : 0, maks: 30,
      ket: cek.map(c => `${c.label} ${fmtR(c.nilai)}`).join(', ') },
    { k: 'Konfirmasi di PRZ', nilai: r.status === 'menuju' ? 0 : Math.min(2, (r.konfirmasi || []).length) * 12.5, maks: 25,
      ket: r.status === 'menuju' ? 'D belum terbentuk' : (r.konfirmasi || []).length ? r.konfirmasi.join('; ') : 'belum ada' },
    { k: 'Searah tren besar', nilai: searah ? 20 : tren === 'mendatar' ? 10 : 0, maks: 20, ket: `tren ${tren}, pola ${r.arah}` },
    ...(simetri ? [{ k: 'Simetri AB=CD', nilai: Math.abs(simetri.harga - 1) <= 0.25 ? 15 : Math.abs(simetri.harga - 1) <= 0.5 ? 8 : 0, maks: 15,
      ket: `CD = ${fmtR(simetri.harga)}× AB, durasi ${fmtR(simetri.waktu)}×` }] : []),
    { k: 'Likuiditas', nilai: likuid ? 10 : 0, maks: 10, ket: likuid ? 'nilai transaksi memadai' : 'di bawah batas screening' },
  ]
  const skor = Math.round(rincian.reduce((a, x) => a + x.nilai, 0) / rincian.reduce((a, x) => a + x.maks, 0) * 100)
  const label = skor >= 70 ? 'Kuat' : skor >= 45 ? 'Sedang' : 'Lemah'
  const rc = rencanaHarmonik(r)
  const nama = meta.nama || r.pola
  const narasi = [
    `Pola ${nama} ${r.arah} terbentuk dari ${kaki.map(k => `${k.n} ${k.pct > 0 ? '+' : ''}${fmtR(k.pct)}% dalam ${k.bar} hari bursa`).join(', ')}.`,
    r.status === 'menuju' ? `Harga ${fmtR(akhir)} masih ${fmtR(r.jarak)}% dari tepi PRZ ${przTeks(r)}; titik D belum terbentuk.`
      : r.status === 'prz' ? `Titik D ${fmtR(p.D)} berada di PRZ ${przTeks(r)}; harga kini ${fmtR(akhir)}.`
        : `D ${fmtR(p.D)} terkonfirmasi di PRZ dan harga sudah bergerak ${r.reaksi > 0 ? '+' : ''}${fmtR(r.reaksi)}% darinya.`,
    e50 ? `Harga ${akhir >= e50 ? 'di atas' : 'di bawah'} EMA50 (${fmtR(Math.round(e50))})${e200 ? ` dan ${akhir >= e200 ? 'di atas' : 'di bawah'} EMA200 (${fmtR(Math.round(e200))})` : ''}: tren besar ${tren}, pola ${searah ? 'searah' : 'tidak searah'} tren besar.` : null,
    rsi != null ? `RSI(14) ${fmtR(rsi)} (${rsi < 30 ? 'jenuh jual' : rsi > 70 ? 'jenuh beli' : 'netral'}).` : null,
    volD != null ? `Volume saat D ${fmtR(volD)}× rata-rata 20 hari sebelumnya.` : null,
    simetri ? `Kaki CD ${fmtR(simetri.harga)}× panjang AB dengan durasi ${fmtR(simetri.waktu)}× (ideal AB=CD mendekati 1).` : null,
  ].filter(Boolean)
  const arahKata = bull ? 'naik' : 'turun'
  const skenario = r.status === 'menuju'
    ? [{ k: 'Harga masuk PRZ', teks: `Pantau zona ${przTeks(r)}. Pola baru lengkap setelah D terbentuk; tunggu candle pembalikan, divergence RSI, atau tembus struktur minor sebelum entry.` },
      { k: 'Harga berbalik sebelum PRZ', teks: 'D tidak terbentuk; pola tidak lengkap dan tidak dipakai.' },
      { k: 'Harga menembus PRZ', teks: `Bila menembus ${fmtR(r.stop)}, pola batal.` }]
    : [{ k: 'Konfirmasi muncul', teks: `Area entry ${przTeks(r)}, stop ${fmtR(r.stop)}, target ${fmtR(rc?.t1)} lalu ${fmtR(rc?.t2)} (R:R ${fmtR(rc?.rr1)} / ${fmtR(rc?.rr2)}).` },
      { k: `Pembalikan ${arahKata} berlanjut`, teks: r.targetCA ? `Target alternatif titik C ${fmtR(r.targetCA[0])} lalu A ${fmtR(r.targetCA[1])}.` : 'Ikuti target 0,618 kaki CD.' },
      { k: 'Harga menembus stop', teks: `Penutupan melewati ${fmtR(r.stop)} membatalkan pola; keluar sesuai rencana.` }]
  return { kaki, simetri, tren, searah, e50, e200, rsi, volD, rincian, skor, label, narasi, skenario, rencana: rc, ix }
}
const fmtR = v => v == null ? '–' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: 2 })
