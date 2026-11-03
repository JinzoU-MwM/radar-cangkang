// Analisa mendalam POV (PDF, A4 tegak) dengan format riset yang sama dengan Berita/Seasonality:
// sampul berpita; kepemilikan & jaringan; riwayat & aksi korporasi; komunitas, dugaan tujuan, dan yang perlu diselidiki.
// Data dari /api/pov-dalam (server povdalam.analyze). Tanpa warna merah; faktor negatif memakai oranye.
import { MUTED, GOOD, BAD, INK, PRIMER, GOLD, LINE, frame, heading, para } from './ihsgPdf.js'
import { sampul } from './ihsgModelPdf.js'
import { pdfText } from './deckPdf.js'

const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const tgl = d => { const x = new Date(d); return isNaN(x) ? String(d || '-') : `${x.getDate()} ${BLN[x.getMonth()]} ${x.getFullYear()}` }
const potong = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s }
const p2 = v => v == null ? '-' : Number(v).toFixed(2).replace('.', ',') + '%'
const BAWAH = 272

export async function povDalamPdf(a, jsPDF) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const seri = `Analisa mendalam ${a.t}`
  let hal = 1, y = 0
  const halaman = judul => { doc.addPage(); hal += 1; frame(doc, judul, hal, seri); heading(doc, judul, 26); y = 37 }
  // Pindah halaman bila sisa ruang kurang dari h (judul halaman lanjutan diberi "(lanjutan)").
  let judulKini = ''
  const ruang = h => { if (y + h > BAWAH) halaman(`${judulKini} (lanjutan)`) }
  const sub = (text, color = PRIMER) => {
    ruang(12)
    doc.setFont('times', 'bold'); doc.setFontSize(11); doc.setTextColor(color); doc.text(pdfText(text), 14, y)
    doc.setDrawColor(color); doc.setLineWidth(0.4); doc.line(14, y + 1.6, 196, y + 1.6); y += 7
  }
  const butir = (rows, { size = 8.8, color = INK, tanda = '•', x = 18, w = 178 } = {}) => {
    for (const r of rows) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(size)
      const lines = doc.splitTextToSize(pdfText(`${tanda} ${r}`), w)
      const h = lines.length * size * 0.3528 * 1.4 + 1.4
      ruang(h)
      // Halaman baru mengganti font (judul); set ulang sebelum menulis agar ukuran tidak terbawa.
      doc.setFont('helvetica', 'normal'); doc.setFontSize(size)
      doc.setTextColor(color); doc.text(lines, x, y, { lineHeightFactor: 1.4 }); y += h
    }
  }
  const teks = (s, size = 9, color = INK) => { ruang(10); y = para(doc, s, 18, y, 178, size, color) }

  const k = a.kepemilikan, idn = a.identitas
  const kuat = [...a.dugaan].sort((p, q) => q.bukti.length - p.bukti.length)[0]
  sampul(doc, {
    besar: a.t, judul: 'Analisa mendalam', label: `${a.nama || a.t} · ${tgl(a.dibuat)}`,
    sub: [idn.sektor, idn.industri].filter(Boolean).join(' · ') + (kuat ? `. Dugaan terkuat: ${kuat.judul}.` : ''),
    updated: a.dibuat, seri: [],
    box: [['Pihak terafiliasi', p2(k.nonPublik)], ['Free float efektif', p2(k.ffEfektif)], ['Emiten di jaringan', String(a.sumber.jaringan)], ['Dugaan tujuan', String(a.dugaan.length)]],
    catatan: `Disusun otomatis dari ${a.sumber.pemegang} pemegang saham, ${a.sumber.insider} keterbukaan pemegang saham, ${a.sumber.keterbukaan} keterbukaan informasi, ${a.sumber.berita} berita, dan ${a.sumber.posting} posting publik Stockbit. Bukan ajakan membeli atau menjual efek.`,
  })

  // ---- Kepemilikan dan jaringan pengendali.
  judulKini = 'Kepemilikan dan jaringan'; halaman(judulKini)
  if (a.ringkas.length) teks(a.ringkas.join('. ') + '.', 9.5)
  if (idn.latar) teks(potong(idn.latar, 600), 8.5, MUTED)
  if (a.radarSikap) { sub(`Sikap analisa radar: ${a.radarSikap.sikap}`, GOOD); teks(potong(a.radarSikap.ringkas, 360), 8.8) }
  sub('Skenario nilai')
  butir([`Harga terakhir ${idn.harga ? 'Rp' + Math.round(idn.harga) : '-'}${idn.mcap ? ' · kapitalisasi Rp' + Math.round(idn.mcap / 1e9) + ' M' : ''}`,
    ...a.skenario.map(s => `${s.label}: Rp${Math.round(s.harga)} (${s.selisih > 0 ? '+' : ''}${String(s.selisih).replace('.', ',')}% dari harga sekarang)`),
    ...(a.broker ? [`Broker 30 hari: ${a.broker.bandar > 0 ? 'akumulasi' : 'distribusi'} Rp${(Math.abs(a.broker.bandar) / 1e9).toFixed(2).replace('.', ',')} M; pembeli ${a.broker.akum.join(', ') || '-'}; penjual ${a.broker.dist.join(', ') || '-'}`] : [])])
  sub(`Pemegang saham (terafiliasi ${p2(k.nonPublik)} · free float efektif ${p2(k.ffEfektif)})`)
  butir(k.pemegang.map(p => `${p.name} ${p2(p.pct)}${p.pengendali ? ' · pengendali' : ''}${p.pengurus ? ' · juga pengurus (' + p.pengurus + ')' : ''}${p.keluarga ? ' · keluarga ' + p.keluarga : ''}`))
  if (k.keluarga?.length) butir(k.keluarga.map(x => `Keluarga ${x.nama}: ${x.anggota.length} anggota, total ${p2(x.pct)}`), { color: PRIMER })
  if (k.ubo.length) butir([`Pemilik manfaat akhir (UBO): ${k.ubo.join(', ')}`], { color: PRIMER })
  if (k.direksi.length || k.komisaris.length) butir([`Direksi: ${k.direksi.join(', ') || '-'}`, `Komisaris: ${k.komisaris.join(', ') || '-'}`], { size: 8.2, color: MUTED })
  sub('Jaringan: kepemilikan pemegang saham di emiten lain', GOLD)
  const jar = a.jaringan.filter(r => r.emiten.length)
  if (!jar.length) teks('Pemegang saham utama tidak tercatat memiliki emiten lain di data keterbukaan pemegang saham.', 9, MUTED)
  butir(jar.map(r => `${r.nama} (${p2(r.pct)} di ${a.t}): ${r.emiten.map(e => `${e.t} ${p2(e.pct)}`).join(', ')}`))
  if (a.bersama.length) butir(a.bersama.map(x => `${x.t} dimiliki bersama oleh ${x.pemegang.join(', ')}`), { color: PRIMER, tanda: '›' })
  if (a.grup?.length) {
    sub('Emiten grup: pemegang utamanya')
    butir(a.grup.map(g => `${g.t}${g.nama ? ' (' + g.nama + ')' : ''}${g.sektor ? ' · ' + g.sektor : ''}: ${g.pemegang.map(p => `${p.name} ${p.pct || ''}`).join('; ')}`), { size: 8.2 })
  }

  // ---- Riwayat pengendalian, orang dalam, aksi korporasi, kinerja.
  judulKini = 'Riwayat dan aksi korporasi'; halaman(judulKini)
  if (a.kronologi?.length) { sub('Kronologi (terbaru dulu)'); butir(a.kronologi.slice(0, 16).map(k => `${tgl(k.date)} [${k.jenis}] ${potong(k.teks, 220)}`), { size: 8.3 }) }
  sub('Peristiwa kepemilikan penting (3 tahun)')
  if (!a.riwayat.length) teks('Tidak ada perubahan kepemilikan besar (melewati 20%/50% atau >= 5 poin) dalam 3 tahun.', 9, MUTED)
  butir(a.riwayat.map(r => `${tgl(r.date)}: ${r.teks}`))
  if (a.insider.length) {
    sub('Transaksi pemegang saham / orang dalam (180 hari)')
    butir(a.insider.map(x => `${x.nama}${x.role ? ' (' + x.role + ')' : ''}: ${x.chg > 0 ? '+' : ''}${x.chg.toFixed(2).replace('.', ',')} poin, ${x.n} transaksi, terakhir ${tgl(x.akhir)}`
      + (x.lembar ? `; ${(x.lembar / 1e6).toFixed(1).replace('.', ',')} juta lembar` : '') + (x.harga ? ` @ ±Rp${x.harga}` : '')
      + (x.sisa ? `; sisa ${(x.sisa / 1e6).toFixed(1).replace('.', ',')} juta lembar (${p2(x.sisaPct)})` : '')
      + (x.habisBulan ? `; habis ± ${Math.round(x.habisBulan)} bulan lagi bila laju sama` : '')),
      { color: INK })
  }
  sub('Keterbukaan aksi korporasi (1 tahun)')
  if (!a.aksi.length) teks('Tidak ada keterbukaan aksi korporasi yang terbaca dalam 1 tahun.', 9, MUTED)
  butir(a.aksi.slice(0, 14).map(x => `${tgl(x.date)}: ${x.judul}${x.inti ? ' — ' + potong(x.inti, 200) : ''}`), { size: 8.5 })
  const kn = a.kinerja, kw = kn.kuartal
  sub('Kinerja dan valuasi')
  butir([kn.judul ? `Laporan ${kn.periode}: ${kn.judul}` : 'Laporan keuangan terbaru belum terbaca.',
    kw ? `Laba Q${kw.q} murni ${kw.status === 'berbalik' ? 'berbalik dari rugi' : (kw.yoy ?? '-') + '% YoY'}, QoQ ${kw.berbalikQoq ? 'berbalik dari rugi' : (kw.qoq ?? '-') + '%'}${kw.tumbuh ? ' (naik dari tahun lalu dan kuartal sebelumnya)' : ''}` : '',
    `PBV ${kn.pbv ?? '-'}x · PER ${kn.per ?? '-'}x`].filter(Boolean))
  if (a.berita.length) { sub('Berita terbaru'); butir(a.berita.slice(0, 6).map(b => `${tgl(b.date)}: ${b.judul}`), { size: 8.3 }) }

  // ---- Komunitas, dugaan, dan penyelidikan.
  judulKini = 'Dugaan dan penyelidikan'; halaman(judulKini)
  if (a.klaim?.length) {
    sub('Cek kebenaran klaim publik', PRIMER)
    for (const c of a.klaim) {
      ruang(14)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(c.status === 'didukung data' ? GOOD : c.status === 'tidak didukung' ? BAD : MUTED)
      const h = doc.splitTextToSize(pdfText(`[${c.status}] "${potong(c.klaim, 200)}" (@${c.user}, ${tgl(c.d)})`), 178); doc.text(h, 18, y, { lineHeightFactor: 1.3 }); y += h.length * 4.2 + 0.6
      butir(c.bukti, { size: 8.3, tanda: '›', x: 22, w: 174 }); y += 0.8
    }
  }
  sub('Dugaan tujuan dan buktinya', GOLD)
  if (!a.dugaan.length) teks('Belum ada bukti yang cukup untuk menyusun dugaan tujuan.', 9, MUTED)
  for (const g of a.dugaan) {
    ruang(16)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(g.arah > 0 ? GOOD : g.keyakinan === 'tinggi' ? GOLD : PRIMER)
    const h = doc.splitTextToSize(pdfText(`${g.judul} (keyakinan ${g.keyakinan})`), 178); doc.text(h, 18, y, { lineHeightFactor: 1.3 }); y += h.length * 4.4 + 0.6
    butir(g.bukti, { size: 8.4, tanda: '›', x: 22, w: 174 }); y += 1
  }
  sub('Yang perlu diselidiki', PRIMER)
  butir(a.selidiki, { size: 8.6 })
  // Informasi dari sumber publik: terverifikasi data lebih dulu, lalu rumor (belum terverifikasi) dengan sumbernya.
  const kom = a.komunitas
  const rel = kom.relasi || [], klaim = kom.klaim || []
  const tokoh = kom.nama.filter(e => e.terverifikasi)
  if (rel.length || klaim.length || tokoh.length) {
    sub('Informasi dari sumber publik: terverifikasi', GOOD)
    const v = [...rel.filter(r => r.terverifikasi).map(r => `${r.orang} melalui ${r.badan} (cocok dengan data kepemilikan; sumber @${r.user})`),
      ...tokoh.map(e => `${e.nama}: tercatat di data pemegang saham/pengurus (disebut ${e.n}x)`)]
    if (!v.length) teks('Belum ada informasi publik yang cocok dengan data kepemilikan.', 8.8, MUTED)
    butir(v, { size: 8.6 })
    const r2 = [...rel.filter(r => !r.terverifikasi).map(r => `${r.orang} melalui ${r.badan} (@${r.user})`),
      ...klaim.slice(0, 8).map(c => `${potong(c.teks, 240)} (@${c.user}, ${tgl(c.d)})`)]
    if (r2.length) { sub('Rumor / klaim belum terverifikasi (cek dokumen sumber)', GOLD); butir(r2, { size: 8.3, color: MUTED }) }
  }
  if (a.catatan?.length) butir(a.catatan, { size: 7.8, color: BAD, tanda: '!' })

  const dis = 'Disusun otomatis oleh Radar Backdoor dari data Stockbit (profil, keterbukaan pemegang saham KSEI/IDX, keterbukaan informasi, berita, dan posting publik). '
    + 'Hubungan antarpihak dan dugaan tujuan dibaca dengan aturan otomatis; rumor dan klaim yang belum terverifikasi harus dicek di dokumen sumber. '
    + 'Bukan penawaran, ajakan, atau rekomendasi membeli atau menjual efek; keputusan investasi sepenuhnya tanggung jawab pembaca.'
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
  const lines = doc.splitTextToSize(pdfText(dis), 182)
  ruang(lines.length * 3.4 + 6)
  doc.setDrawColor(LINE); doc.setLineWidth(0.3); doc.line(14, y + 1, 196, y + 1)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(MUTED); doc.text(lines, 14, y + 5, { lineHeightFactor: 1.35 })
  return doc
}

export const povDalamPdfName = a => `Analisa-Mendalam-${a.t}_${(a.dibuat || '').slice(0, 10) || new Date().toISOString().slice(0, 10)}.pdf`
