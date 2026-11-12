// Screening Harmonic Pattern (/api/harmonik, tab Screening halaman Harmonic Pattern): label status, hitungan, dan teks
// rentang rasio; idxTanggal dipakai chart PDF cadangan (harmonikPdf.chartPdf).

export const HM_STATUS = {
  prz: ['Di PRZ', 't-warn', 'Titik D sedang berada di Potential Reversal Zone; tunggu konfirmasi sebelum entry.'],
  berbalik: ['Berbalik dari PRZ', 't-good', 'D terkonfirmasi di PRZ dan harga mulai bergerak berlawanan arah kaki CD.'],
  menuju: ['Menuju PRZ', 't-calm', 'X-A-B-C sudah terbentuk; harga masih bergerak ke PRZ. Belum ada titik D.'],
}

export function hitungHarmonik(rows = []) {
  const n = { semua: rows.length, prz: 0, berbalik: 0, menuju: 0, bullish: 0, bearish: 0 }
  for (const r of rows) { n[r.status] = (n[r.status] || 0) + 1; n[r.arah] = (n[r.arah] || 0) + 1 }
  return n
}

const angka = (v, n = 2) => v == null ? '–' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: n })
// Rentang rasio: [0.618, 0.618] -> "0,618"; [0.382, 0.886] -> "0,382–0,886".
export const rentang = r => !r ? '–' : r[0] === r[1] ? angka(r[0], 3) : `${angka(r[0], 3)}–${angka(r[1], 3)}`

// Indeks bar pada tanggal d (YYYY-MM-DD) atau bar pertama sesudahnya.
export function idxTanggal(bars, d) {
  const i = bars.findIndex(b => String(b.d).slice(0, 10) >= d)
  return i < 0 ? bars.length - 1 : i
}
