// POV AH: format dan saringan untuk hasil /api/pov-ah (portofolio Andry Hakim + screening saham beredar sedikit).

// Jumlah lembar ringkas: 220 jt, 1,05 M (miliar lembar).
export const lembar = v => v == null ? '–' : v >= 1e9
  ? `${(v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M lbr`
  : `${(v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt lbr`

// Jalur kepemilikan AH di satu saham sebagai teks pendek.
export function jalurTeks(j) {
  if (j.jenis === 'pribadi') return `pribadi ${String(j.pct).replace('.', ',')}% (KSEI)`
  if (j.jenis === 'PT') return `lewat ${j.nama} ${String(j.pct).replace('.', ',')}% (${j.status})`
  return `di bawah 1% / lewat pihak lain (${j.status})`
}

// Saringan tampilan screening: batas saham beredar, batas porsi publik, hanya yang ada rekan AH, kata kunci kode/nama.
export function saringAh(rows, { maksSaham = Infinity, maksFF = Infinity, rekan = false, cari = '' } = {}) {
  const q = cari.trim().toLowerCase()
  return (rows || []).filter(r =>
    (r.saham == null || r.saham <= maksSaham) &&
    (r.ff == null || r.ff <= maksFF) &&
    (!rekan || (r.jejak || []).length > 0) &&
    (!q || r.t.toLowerCase().includes(q) || (r.nama || '').toLowerCase().includes(q)))
}

// Perubahan jumlah pemegang ±3 bulan sebagai teks dan nada (turun = akumulasi).
export function trenTeks(tr) {
  if (!tr) return { teks: '–', nada: '' }
  const s = (tr.ubah > 0 ? '+' : '') + tr.ubah.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '%'
  return { teks: s, nada: tr.ubah <= -5 ? 'akumulasi' : tr.ubah >= 5 ? 'distribusi' : '' }
}
