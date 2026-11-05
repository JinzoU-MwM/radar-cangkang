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
