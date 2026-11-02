// Analisa berita/laporan terbaru satu emiten (PDF, A4 tegak) dengan format riset Seasonality: sampul berpita,
// halaman berbingkai, blok berlabel, dan disclaimer. Data dari analisaBerita() (lib/beritaTerbaru.js). Tanpa warna merah.
import { MUTED, GOOD, BAD, INK, frame, heading, para, block } from './ihsgPdf.js'
import { sampul, disclaimer } from './ihsgModelPdf.js'

const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const tgl = d => { const x = new Date(d); return isNaN(x) ? String(d || '-') : `${x.getDate()} ${BLN[x.getMonth()]} ${x.getFullYear()}` }
const rp = v => v == null ? '-' : 'Rp' + Math.round(v).toLocaleString('id-ID')
const warna = cls => cls === 'good' ? GOOD : cls === 'bad' ? BAD : MUTED
const tanda = n => n > 0 ? '(+)' : n < 0 ? '(-)' : '(o)'

export async function beritaPdf(a, jsPDF) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const seri = `Analisa ${a.ticker}`
  sampul(doc, {
    besar: a.ticker, judul: 'Analisa berita terbaru', label: `${a.jenis} · ${tgl(a.tanggal)}`,
    sub: a.judul, updated: tgl(a.tanggal), seri: [],
    box: [['Sinyal', a.sinyal.label], ['Dampak bagi publik', a.dampak.label], ['Sikap analisa', a.tesis?.sikap || 'Belum dianalisa'], ['Harga', rp(a.tesis?.harga)]],
    catatan: `Disusun otomatis dari ${a.laporan ? 'keterbukaan informasi' : 'berita'} ${a.sumber} dan analisa kurasi Radar Backdoor. Bukan ajakan membeli atau menjual efek.`,
  })

  let page = 1, y = 0
  const baru = judul => { doc.addPage(); frame(doc, judul, ++page, seri); heading(doc, judul, 28); y = 40 }
  // Pindah halaman bila sisa ruang kurang dari `perlu` mm.
  const cek = (perlu, judul) => { if (y + perlu > 275) baru(judul) }
  const daftar = (label, rows, judul) => {
    if (!rows.length) return
    cek(14 + rows.length * 6, judul)
    y = block(doc, label, rows[0], y)
    for (const r of rows.slice(1)) { cek(10, judul); y = para(doc, r, 18, y, 178) }
    y += 2
  }

  // Halaman 2: inti dokumen.
  baru('Ringkasan dokumen')
  y = block(doc, 'Kesimpulan', a.kesimpulan, y) + 2
  if (a.ringkas) { cek(20, 'Ringkasan dokumen'); y = block(doc, 'Ringkasan', a.ringkas, y) + 2 }
  daftar('Poin kunci', a.poin.map(p => '• ' + p), 'Ringkasan dokumen')
  daftar('Fakta aset dan transaksi', a.fakta.map(p => '• ' + p), 'Ringkasan dokumen')
  cek(16, 'Ringkasan dokumen')
  y = para(doc, `Sumber: ${a.sumber} · ${tgl(a.tanggal)}${a.url ? ' · ' + a.url : ''}`, 14, y, 182, 8.5, MUTED)

  // Halaman 3: dampak dan kaitan dengan tesis.
  baru('Dampak dan tesis')
  y = block(doc, `Tingkat sinyal: ${a.sinyal.label}`, a.sinyal.why, y) + 2
  cek(20, 'Dampak dan tesis')
  doc.setFont('times', 'bold'); doc.setFontSize(11); doc.setTextColor(warna(a.dampak.cls))
  doc.text(`Dampak bagi pemegang saham publik: ${a.dampak.label}`, 18, y); y += 6
  for (const x of a.dampak.alasan) { cek(10, 'Dampak dan tesis'); y = para(doc, `${tanda(x.nada)} ${x.teks}`, 18, y, 178, 10, x.nada > 0 ? GOOD : x.nada < 0 ? BAD : INK) }
  y = para(doc, '(+) positif bagi pemegang saham publik, (-) negatif atau risiko, (o) perlu dicermati.', 18, y, 178, 8.5, MUTED) + 2
  if (a.tesis) {
    cek(30, 'Dampak dan tesis')
    y = block(doc, `Tesis analisa per ${tgl(a.tesis.asOf)} · ${a.tesis.sikap}`, [a.tesis.ringkas, a.tesis.posisi,
      a.tesis.hargaAcuan != null ? `Harga acuan analisa ${rp(a.tesis.hargaAcuan)}.` : ''].filter(Boolean).join(' '), y) + 2
  } else {
    y = block(doc, 'Tesis analisa', `${a.ticker} belum memiliki analisa kurasi; dampak dinilai hanya dari isi dokumen.`, y) + 2
  }
  daftar('Yang dipantau', a.pantau.map(p => '• ' + p), 'Dampak dan tesis')
  daftar('Tesis salah bila', a.salahBila.map(p => '• ' + p), 'Dampak dan tesis')

  disclaimer(doc, ++page, tgl(a.tanggal), 'Tingkat sinyal, arah dampak, dan poin dibaca otomatis dari judul, ringkasan, dan poin kunci dokumen; kaitan tesis dari analisa kurasi terakhir.')
  return doc
}

export const beritaPdfName = a => `Analisa-${a.ticker}_Berita-${a.tanggal || new Date().toISOString().slice(0, 10)}.pdf`
