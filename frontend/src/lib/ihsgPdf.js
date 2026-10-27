// Riset IHSG (PDF, A4 tegak) dari data /api/ihsg-outlook: sampul, Analisa Teknikal & Flow (grafik, narasi,
// area beli/target/risiko), Seasonality & sentimen, dan disclaimer. Digambar dengan jsPDF (satuan mm).
import { pdfText } from './deckPdf.js'

const NAVY = '#13202b', GREEN = '#2fb37a', INK = '#1f2937', MUTED = '#6b7280', RED = '#c0392b', TEAL = '#0d9488', ORANGE = '#c2410c'
const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const n0 = v => v == null ? '-' : Math.round(v).toLocaleString('id-ID')
const tgl = d => { const x = new Date(d); return isNaN(x) ? String(d || '') : `${x.getDate()} ${BLN[x.getMonth()]} ${x.getFullYear()}` }

function header(doc, title, page) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(NAVY)
  doc.text('RADAR BACKDOOR', 14, 14)
  doc.setFontSize(9); doc.setTextColor(INK); doc.text('Radar Backdoor Research', 196, 14, { align: 'right' })
  doc.setDrawColor('#e5e7eb'); doc.setLineWidth(0.3); doc.line(14, 18, 196, 18)
  doc.setFontSize(9); doc.setTextColor(GREEN); doc.setFont('helvetica', 'bold')
  doc.text(pdfText(`Radar Backdoor Research | ${title}`), 14, 287)
  doc.setTextColor(INK); doc.text(String(page), 196, 287, { align: 'right' })
}

function para(doc, text, x, y, w, size = 10) {
  doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(INK)
  const lines = doc.splitTextToSize(pdfText(text), w)
  doc.text(lines, x, y, { lineHeightFactor: 1.45 })
  return y + lines.length * size * 0.3528 * 1.45 + 3
}

function chart(doc, tek, x, y, w, h) {
  const s = tek.seri || []
  if (s.length < 2) return
  const lv = [...(tek.support || []), ...(tek.resistance || [])].map(v => v.v)
  const ys = [...s.map(p => p.c), ...s.map(p => p.e50), ...s.map(p => p.e200), ...lv]
  const lo = Math.min(...ys) * 0.99, hi = Math.max(...ys) * 1.01
  const X = i => x + i / (s.length - 1) * w, Y = v => y + h - (v - lo) / (hi - lo) * h
  doc.setDrawColor('#d1d5db'); doc.setLineWidth(0.2); doc.rect(x, y, w, h)
  // Garis support (hijau) & resistance (merah) putus-putus dengan label.
  doc.setLineDashPattern([1.2, 1], 0); doc.setFontSize(7)
  for (const l of tek.support || []) { doc.setDrawColor(GREEN); doc.line(x, Y(l.v), x + w, Y(l.v)); doc.setTextColor(GREEN); doc.text(`S ${n0(l.v)}`, x + w - 1, Y(l.v) - 0.8, { align: 'right' }) }
  for (const l of tek.resistance || []) { doc.setDrawColor(RED); doc.line(x, Y(l.v), x + w, Y(l.v)); doc.setTextColor(RED); doc.text(`R ${n0(l.v)}`, x + w - 1, Y(l.v) - 0.8, { align: 'right' }) }
  doc.setLineDashPattern([], 0)
  const line = (k, color, lw) => { doc.setDrawColor(color); doc.setLineWidth(lw); for (let i = 1; i < s.length; i++) doc.line(X(i - 1), Y(s[i - 1][k]), X(i), Y(s[i][k])) }
  line('e200', ORANGE, 0.35); line('e50', TEAL, 0.35); line('c', INK, 0.45)
  // Sumbu waktu (awal, tengah, akhir) & legenda.
  doc.setFontSize(7); doc.setTextColor(MUTED)
  ;[0, Math.floor(s.length / 2), s.length - 1].forEach((i, k) => doc.text(pdfText(tgl(s[i].d)), X(i), y + h + 4, { align: k === 0 ? 'left' : k === 2 ? 'right' : 'center' }))
  doc.text(pdfText(`IHSG ${n0(tek.harga)}  ·  EMA50 ${n0(tek.ema50)}  ·  EMA200 ${n0(tek.ema200)}`), x, y - 1.5)
}

function kpi(doc, x, y, w, label, value, color) {
  doc.setFillColor('#f3f6f8'); doc.setDrawColor('#e5e7eb'); doc.roundedRect(x, y, w, 18, 1.5, 1.5, 'FD')
  doc.setFillColor(color); doc.rect(x, y, w, 1.4, 'F')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(MUTED); doc.text(pdfText(label), x + 3, y + 6.5)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(color); doc.text(pdfText(value), x + 3, y + 14)
}

export async function ihsgPdf(d, jsPDF) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const bln = BLN[(d.bulan || 1) - 1], terbit = tgl(new Date()), r = d.riset || {}, t = d.tek, lv = r.level || {}

  // 1) Sampul.
  doc.setFillColor(NAVY); doc.rect(0, 0, 210, 297, 'F')
  doc.setDrawColor('#1f6f52'); doc.setLineWidth(0.6)
  for (const k of [0, 1, 2]) doc.circle(150 + k * 18, 250, 90 + k * 22, 'S')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor('#ffffff'); doc.text('RADAR BACKDOOR', 16, 20)
  doc.setFontSize(10); doc.text('Radar Backdoor Research', 194, 20, { align: 'right' })
  doc.setFontSize(80); doc.text('IHSG', 16, 110)
  doc.setFontSize(20); doc.setTextColor(GREEN); doc.text(pdfText('Analisa Teknikal & Flow'), 16, 126)
  doc.text(pdfText(`Seasonality ${bln}`), 16, 136)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor('#d1d5db'); doc.text('Disusun oleh', 16, 158); doc.text('Terbit', 80, 158)
  doc.setFont('helvetica', 'bold'); doc.setTextColor('#ffffff'); doc.text('Radar Backdoor', 16, 164); doc.text(pdfText(terbit), 80, 164)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor('#9ca3af')
  doc.text(pdfText('Disusun otomatis dari data publik (Stockbit) untuk kerangka berpikir; bukan rekomendasi beli/jual.'), 16, 285)

  // 2) Analisa Teknikal & Flow.
  doc.addPage(); header(doc, 'IHSG', 2)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(NAVY); doc.text('IHSG Radar Research', 105, 32, { align: 'center' })
  doc.setFillColor('#b7f0d2'); doc.rect(14, 37, 62, 8, 'F'); doc.setFontSize(12); doc.setTextColor(NAVY); doc.text(pdfText('Analisa Teknikal & Flow'), 16, 43)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.setTextColor(t.tren === 'Uptrend' ? GREEN : t.tren === 'Downtrend' ? RED : ORANGE); doc.text(pdfText(`${t.tren}  ·  data ${tgl(t.tanggal)}`), 196, 43, { align: 'right' })
  chart(doc, t, 14, 52, 182, 78)
  let y = 142
  y = para(doc, r.struktur || '', 14, y, 182)
  if (r.flow) y = para(doc, r.flow, 14, y + 1, 182)
  y = para(doc, r.rencana || '', 14, y + 1, 182)
  const yk = Math.min(y + 3, 262), kw = (182 - 8) / 3
  kpi(doc, 14, yk, kw, 'Area beli (bertahap)', lv.beli ? `${n0(lv.beli[0])} - ${n0(lv.beli[1])}` : '-', TEAL)
  kpi(doc, 14 + kw + 4, yk, kw, 'Target', lv.target ? `${n0(lv.target[0])} / ${n0(lv.target[1])}` : '-', GREEN)
  kpi(doc, 14 + 2 * (kw + 4), yk, kw, 'Risiko (penutupan harian <)', n0(lv.risiko), RED)

  // 3) Seasonality & sentimen.
  doc.addPage(); header(doc, 'IHSG', 3)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(NAVY); doc.text(pdfText(`Seasonality ${bln} & Sentimen`), 105, 32, { align: 'center' })
  const b = d.berulang || {}
  doc.setFontSize(34); doc.setTextColor(b.label === 'Tinggi' ? GREEN : b.label === 'Rendah' ? RED : ORANGE); doc.text(`${b.prob ?? '-'}%`, 14, 54)
  doc.setFontSize(11); doc.setTextColor(INK); doc.text(pdfText(`Probabilitas pola ${bln} berulang · ${b.label || '-'}`), 52, 46)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  ;(b.komponen || []).forEach((k, i) => doc.text(pdfText(`• ${k.nama}: ${k.nilai}% (bobot ${Math.round(k.bobot * 100)}%)`), 52, 52 + i * 5))
  y = 74
  const m = d.musiman || {}, c = d.kondisi || {}
  y = para(doc, `Pola musiman 10 tahun: IHSG naik ${m.up ?? '-'} dari ${m.n ?? '-'} tahun pada ${bln} (${m.prob ?? '-'}%), median ${m.median ?? '-'}%.`, 14, y, 182)
  y = para(doc, `Pada kondisi tren yang sama (akhir bulan sebelumnya IHSG di ${c.kondisi || '-'} rata-rata 10 bulan, seperti sekarang): naik ${c.up ?? '-'} dari ${c.n ?? '-'} tahun${c.prob != null ? ` (${c.prob}%)` : ''}. `
    + (c.tahun || []).map(x => `${x.tahun}: ${x.ret > 0 ? '+' : ''}${x.ret}%`).join('; ') + '.', 14, y, 182)
  const sn = d.sentimen || {}
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(NAVY); doc.text(pdfText(`Sentimen pasar: ${sn.arah || '-'} (${sn.nPos || 0} positif / ${sn.nNeg || 0} negatif)`), 14, y + 6)
  y += 12
  for (const [arr, label, col] of [[sn.positif, 'Positif', GREEN], [sn.negatif, 'Negatif', RED]]) {
    doc.setFontSize(10); doc.setTextColor(col); doc.setFont('helvetica', 'bold'); doc.text(label, 14, y); y += 5
    for (const x of (arr || []).slice(0, 5)) y = para(doc, `• ${x.judul} (${tgl(x.d)})`, 16, y, 178, 9) - 1.5
    y += 3
  }

  // 4) Disclaimer.
  doc.addPage(); header(doc, 'Disclaimer', 4)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(NAVY); doc.text('Disclaimer', 14, 40)
  para(doc, 'Riset ini disusun otomatis oleh Radar Backdoor dari data yang diyakini dapat diandalkan (harga, ringkasan broker, dan berita pasar Stockbit), '
    + 'namun tidak ada jaminan atas ketepatan, kelengkapan, atau kebenarannya. Pandangan dapat berubah tanpa pemberitahuan. Dokumen ini untuk edukasi '
    + 'dan kerangka berpikir; bukan penawaran, ajakan, atau rekomendasi untuk membeli atau menjual efek. Keputusan investasi sepenuhnya menjadi tanggung jawab pembaca; '
    + 'selalu terapkan manajemen risiko dan batas rugi.', 14, 50, 182, 10)
  doc.setFontSize(8); doc.setTextColor(MUTED); doc.text(pdfText(`Data per ${d.updated || '-'} · ${terbit}`), 14, 100)
  return doc
}

export const ihsgPdfName = bulan => `Riset-IHSG_Seasonality-${BLN[(bulan || 1) - 1]}_${new Date().toISOString().slice(0, 10)}.pdf`
