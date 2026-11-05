// Analisa Harmonic Pattern satu saham (PDF, A4 tegak) dengan format riset yang sama (sampul berpita, halaman
// berbingkai, disclaimer): chart candlestick + XABCD/PRZ/stop/target, struktur kaki, validasi rasio, konfirmasi,
// rencana, rincian skor, konteks teknikal, ringkasan, dan skenario. Data dari /api/harmonik?ticker= (sama dengan
// tampilan). Tanpa warna merah: turun/stop memakai oranye.
import { MUTED, GOOD, BAD, INK, PRIMER, GOLD, LINE, frame, heading, para, kpi } from './ihsgPdf.js'
import { sampul, tabel, disclaimer } from './ihsgModelPdf.js'
import { pdfText } from './deckPdf.js'
import { HM_STATUS, analisaHarmonik, cekRasio, przTeks, rentang, idxTanggal, detailHarmonik, kandidatTerdekat } from './harmonik.js'

const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const tgl = d => { const x = new Date(String(d || '').slice(0, 10)); return isNaN(x) ? String(d || '-') : `${x.getDate()} ${BLN[x.getMonth()]} ${x.getFullYear()}` }
const n = v => v == null || isNaN(v) ? '-' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: 2 })
const BAWAH = 272

// Chart candlestick dalam kotak (x, y, w, h); 78% tinggi untuk harga, sisanya volume.
export function chartPdf(doc, bars, r, pivot, x, y, w, h) {
  const d0 = r?.titik?.[0]?.d || pivot?.[0]?.d
  const awal = Math.max(0, Math.min(d0 ? idxTanggal(bars, d0) - 15 : bars.length - 120, bars.length - 90))
  const vis = bars.slice(awal)
  const kanan = 22, wp = w - kanan, hp = h * 0.78, hv = h - hp - 4
  const ekstra = r ? [...(r.prz || []), r.stop, ...(r.target || [])].filter(v => v != null) : []
  let lo = Math.min(...vis.map(b => b.l), ...ekstra), hi = Math.max(...vis.map(b => b.h), ...ekstra)
  const pad = (hi - lo) * 0.04 || 1; lo -= pad; hi += pad
  const bw = wp / vis.length, X = i => x + (i + 0.5) * bw, Y = v => y + hp * (1 - (v - lo) / (hi - lo))
  const vMaks = Math.max(...vis.map(b => b.v), 1), YV = v => y + h - hv * v / vMaks
  doc.setFillColor('#ffffff'); doc.setDrawColor(LINE); doc.setLineWidth(0.3); doc.rect(x, y, w, h, 'FD')
  doc.setDrawColor('#ebeee6'); doc.setLineWidth(0.2)
  for (let k = 1; k < 4; k++) doc.line(x, y + hp * k / 4, x + wp, y + hp * k / 4)
  doc.setFontSize(6.5); doc.setTextColor(MUTED)
  for (let k = 0; k <= 4; k++) { const v = hi - (hi - lo) * k / 4; doc.text(n(Math.round(v)), x + w - 1, y + hp * k / 4 + (k ? 1 : 3), { align: 'right' }) }
  // PRZ, stop, target.
  const tl = (v, warna, teks) => {
    doc.setDrawColor(warna); doc.setLineWidth(0.3); doc.setLineDashPattern([1.2, 1], 0); doc.line(x, Y(v), x + wp, Y(v)); doc.setLineDashPattern([], 0)
    doc.setFontSize(6.5); doc.setTextColor(warna); doc.text(pdfText(teks), x + wp + 1, Y(v) + 1)
  }
  if (r?.prz) {
    const t = (r.titik || []).find(z => z.n === 'D') || (r.titik || []).find(z => z.n === 'C')
    const px = t ? X(idxTanggal(bars, t.d) - awal) : x + wp * 0.8
    doc.setFillColor('#f6ead2'); doc.rect(px, Y(r.prz[1]), x + wp - px, Math.max(0.6, Y(r.prz[0]) - Y(r.prz[1])), 'F')
    doc.setFontSize(6.5); doc.setTextColor(GOLD); doc.text('PRZ', x + wp + 1, (Y(r.prz[0]) + Y(r.prz[1])) / 2 + 1)
    tl(r.stop, BAD, `Stop ${n(r.stop)}`)
    ;(r.target || []).forEach((v, i) => tl(v, GOOD, `T${i + 1} ${n(v)}`))
  }
  // Candle dan volume (naik hijau, turun oranye).
  vis.forEach((b, i) => {
    const naik = b.c >= b.o, warna = naik ? GOOD : BAD
    doc.setDrawColor(warna); doc.setLineWidth(Math.max(0.12, Math.min(0.3, bw * 0.15))); doc.line(X(i), Y(b.h), X(i), Y(b.l))
    doc.setFillColor(warna)
    doc.rect(X(i) - bw * 0.35, Y(Math.max(b.o, b.c)), Math.max(0.2, bw * 0.7), Math.max(0.2, Math.abs(Y(b.o) - Y(b.c))), 'F')
    doc.setFillColor(naik ? '#cfe3d6' : '#f3dcc3'); doc.rect(X(i) - bw * 0.35, YV(b.v), Math.max(0.2, bw * 0.7), y + h - YV(b.v), 'F')
  })
  // Garis pola XABCD (atau swing terakhir, putus-putus).
  const src = r?.titik?.length ? r.titik : (pivot || []).map(p => ({ n: '', d: p.d, p: p.p }))
  const pts = src.map(t => ({ ...t, i: idxTanggal(bars, t.d) - awal })).filter(t => t.i >= 0)
  doc.setDrawColor(PRIMER); doc.setLineWidth(r ? 0.6 : 0.35)
  if (!r) doc.setLineDashPattern([1, 0.8], 0)
  for (let k = 1; k < pts.length; k++) doc.line(X(pts[k - 1].i), Y(pts[k - 1].p), X(pts[k].i), Y(pts[k].p))
  doc.setLineDashPattern([], 0)
  pts.forEach((t, k) => {
    const a = pts[k - 1], b = pts[k + 1], puncak = (!a || t.p >= a.p) && (!b || t.p >= b.p)
    doc.setFillColor('#ffffff'); doc.setDrawColor(PRIMER); doc.setLineWidth(0.4); doc.circle(X(t.i), Y(t.p), 0.9, 'FD')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(INK)
    doc.text(pdfText(`${t.n ? t.n + ' ' : ''}${n(t.p)}`), X(t.i), puncak ? Y(t.p) - 2 : Y(t.p) + 4, { align: 'center' })
  })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(MUTED)
  ;[0, Math.floor(vis.length / 2), vis.length - 1].forEach((i, k) => doc.text(pdfText(tgl(vis[i].d)), X(i), y + h + 4, { align: k === 0 ? 'left' : k === 2 ? 'right' : 'center' }))
  // Keterangan simbol.
  const lg = [[GOOD, 'kotak', 'Candle naik'], [BAD, 'kotak', 'Candle turun'], [PRIMER, 'garis', r ? 'Garis pola XABCD' : 'Swing terakhir (pivot >= 6%)'],
    ...(r ? [['#f6ead2', 'kotak', 'PRZ'], [BAD, 'putus', 'Stop loss'], [GOOD, 'putus', 'Target 1 & 2']] : [])]
  let lx = x
  const ly = y + h + 9
  doc.setFontSize(7)
  for (const [c, jenis, t] of lg) {
    if (jenis === 'kotak') { doc.setFillColor(c); doc.rect(lx, ly - 2.4, 4, 2.6, 'F') } else {
      doc.setDrawColor(c); doc.setLineWidth(0.6); if (jenis === 'putus') doc.setLineDashPattern([1, 0.7], 0)
      doc.line(lx, ly - 1.1, lx + 4, ly - 1.1); doc.setLineDashPattern([], 0)
    }
    doc.setTextColor(INK); doc.text(pdfText(t), lx + 5.5, ly); lx += doc.getTextWidth(pdfText(t)) + 11
  }
}

// d = respons /api/harmonik?ticker=; pilih = indeks pola yang sedang ditampilkan.
export async function harmonikPdf(d, pilih, jsPDF) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const pola = d.pola || [], r = d.rows?.[pilih] || null
  const meta = pola.find(p => p.k === r?.pola) || {}
  const a = r ? analisaHarmonik(r, d.bars, pola, d.likuid) : null
  const akhir = d.bars[d.bars.length - 1] || {}
  const seri = `Harmonic Pattern ${d.t}`
  let hal = 1, y = 0, judulKini = ''
  const halaman = judul => { judulKini = judul; doc.addPage(); hal += 1; frame(doc, judul, hal, seri); heading(doc, judul, 26); y = 37 }
  const ruang = h => { if (y + h > BAWAH) halaman(`${judulKini.replace(/ \(lanjutan\)$/, '')} (lanjutan)`) }
  const sub = (t, warna = PRIMER) => {
    ruang(20)
    doc.setFont('times', 'bold'); doc.setFontSize(11); doc.setTextColor(warna); doc.text(pdfText(t), 14, y)
    doc.setDrawColor(warna); doc.setLineWidth(0.4); doc.line(14, y + 1.6, 196, y + 1.6); y += 7
  }
  const butir = (rows, warna = INK) => {
    for (const t of rows) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8)
      const lines = doc.splitTextToSize(pdfText(`• ${t}`), 178), h = lines.length * 8.8 * 0.3528 * 1.4 + 1.4
      ruang(h)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8); doc.setTextColor(warna)
      doc.text(lines, 18, y, { lineHeightFactor: 1.4 }); y += h
    }
  }
  const tbl = (cols, rows) => { ruang(16); y = tabel(doc, 14, y + 2, cols, rows, 8.5, { baru: () => { halaman(`${judulKini} (lanjutan)`); return y }, bawah: BAWAH }) + 2 }

  sampul(doc, {
    besar: d.t, judul: 'Analisa Harmonic Pattern', label: `${d.nama || d.t} · ${tgl(akhir.d)}`,
    sub: r ? `${meta.nama} ${r.arah}, status ${HM_STATUS[r.status][0].toLowerCase()}. PRZ ${przTeks(r)}, stop ${n(r.stop)}, target ${n(r.target?.[0])} / ${n(r.target?.[1])}.`
      : 'Swing terakhir belum memenuhi rasio Gartley, Bat, Butterfly, Crab, maupun Cypher (toleransi ±5%).',
    updated: String(akhir.d || '').slice(0, 10), seri: d.bars.slice(-120).map(b => b.c),
    box: r ? [['Pola', `${meta.nama} ${r.arah}`], ['Status', HM_STATUS[r.status][0]], ['Skor kualitas', `${a.skor}/100 ${a.label}`], ['Harga terakhir', n(akhir.c)]]
      : [['Pola', 'Belum ada'], ['Harga terakhir', n(akhir.c)], ['Swing terbaca', String((d.pivot || []).length)]],
    catatan: `Disusun otomatis dari ${d.sumber} (${d.bars.length} bar harian) dengan rasio Fibonacci tiap pola; PRZ = retracement XA bertemu extension BC. Bukan ajakan membeli atau menjual efek.`,
  })

  halaman('Chart dan struktur pola')
  chartPdf(doc, d.bars, r, d.pivot, 14, y - 2, 182, 92)
  y += 107
  if (!r) {
    sub('Belum ada pola harmonik valid')
    butir([`Swing terakhir ${d.t} belum memenuhi rasio pola harmonik dengan toleransi ±5%, atau D sudah menembus PRZ. Pola harmonik jarang terbentuk sempurna; jangan dipaksakan.`,
      `Swing terakhir: ${(d.pivot || []).map(p => `${p.k === 'H' ? 'puncak' : 'lembah'} ${n(p.p)} (${p.d})`).join(' → ')}.`])
    const k = kandidatTerdekat(d.pivot || [], pola)
    if (k) {
      sub(`Pola terdekat: ${k.nama} ${k.arah} (${k.cocok} dari ${k.total} syarat terpenuhi)`)
      butir([`Lima swing terakhir dibaca sebagai ${k.titik.map(t => `${t.n} ${n(t.p)} (${t.d})`).join(', ')}.${k.titik.length < 5 ? ' Titik D belum terbentuk.' : ''}`,
        ...k.cek.map(c => `${c.ok ? 'Sesuai' : 'Di luar'}: ${c.label} ${n(c.nilai)} (kriteria ${rentang(c.kriteria)})`),
        'Pola baru dianggap valid bila semua syarat terpenuhi dan PRZ tidak ditembus. Pantau lagi setelah swing baru terbentuk.'])
    }
  } else {
    const det = detailHarmonik(r, meta, akhir.c)
    sub('Keterangan titik')
    tbl([{ t: 'Titik', w: 14 }, { t: 'Tanggal', w: 26 }, { t: 'Harga', w: 24, align: 'right' }, { t: 'vs kini', w: 22, align: 'right' }, { t: 'Peran', w: 96 }],
      det.titik.map(t => [{ t: t.n, bold: true }, t.d, n(t.p), t.jarak == null ? '-' : `${t.jarak > 0 ? '+' : ''}${n(t.jarak)}%`, t.peran]))
    sub('Struktur kaki')
    tbl([{ t: 'Kaki', w: 30 }, { t: 'Perubahan', w: 40, align: 'right' }, { t: 'Hari bursa', w: 35, align: 'right' }, { t: 'Titik', w: 77 }],
      a.kaki.map((k, i) => [{ t: k.n, bold: true }, { t: `${k.pct > 0 ? '+' : ''}${n(k.pct)}%`, color: k.pct >= 0 ? GOOD : BAD }, String(k.bar),
        `${r.titik[i].n} ${n(r.titik[i].p)} (${r.titik[i].d}) → ${r.titik[i + 1].n} ${n(r.titik[i + 1].p)} (${r.titik[i + 1].d})`]))
    sub('Validasi rasio')
    butir([...cekRasio(r, pola).map(c => `${c.ok ? 'Sesuai' : 'Di luar'}: ${c.label} ${n(c.nilai)} (kriteria ${rentang(c.kriteria)})`),
      `PRZ ${przTeks(r)}: retracement XA bertemu extension BC.`,
      ...(a.simetri ? [`AB=CD: CD ${n(a.simetri.harga)}× AB, durasi ${n(a.simetri.waktu)}× (ideal mendekati 1).`] : [])])
    sub('Asal-usul PRZ')
    butir(det.prz)
    sub('Konfirmasi di PRZ')
    butir(r.konfirmasi?.length ? r.konfirmasi : [r.status === 'menuju' ? 'Titik D belum terbentuk.' : 'Belum ada candle pembalikan, divergence RSI, atau tembus struktur minor.'])
    sub(`Level penting vs harga terakhir ${n(akhir.c)}`)
    tbl([{ t: 'Level', w: 60 }, { t: 'Harga', w: 60, align: 'right' }, { t: 'Jarak dari harga terakhir', w: 62, align: 'right' }],
      det.level.map(l => [{ t: l.k, bold: true }, l.teks, l.jarak == null ? '-' : { t: `${l.jarak > 0 ? '+' : ''}${n(l.jarak)}%`, color: l.jarak >= 0 ? GOOD : BAD }]))

    halaman('Rencana, skor, dan skenario')
    const rc = a.rencana, kw = 43.25
    kpi(doc, 14, y - 4, kw, 'Area entry', przTeks(r), PRIMER)
    kpi(doc, 14 + (kw + 3.7), y - 4, kw, 'Stop loss', `${n(r.stop)} (${n(rc?.risikoPct)}%)`, BAD)
    kpi(doc, 14 + 2 * (kw + 3.7), y - 4, kw, 'Target 0,382 / 0,618', `${n(rc?.t1)} / ${n(rc?.t2)}`, GOOD)
    kpi(doc, 14 + 3 * (kw + 3.7), y - 4, kw, 'R:R target 1 / 2', `${n(rc?.rr1)} / ${n(rc?.rr2)}`, GOLD)
    y += 24
    y = para(doc, r.targetCA ? `Target alternatif (Maxco): titik C ${n(r.targetCA[0])} lalu titik A ${n(r.targetCA[1])}. Entry setelah konfirmasi di PRZ; stop di balik X atau di luar PRZ (Astronacci).`
      : 'Cypher: target diukur dari kaki CD. Entry setelah konfirmasi di PRZ.', 14, y, 182, 8.5, MUTED)
    sub(`Skor kualitas ${a.skor}/100 (${a.label})`)
    tbl([{ t: 'Komponen', w: 45 }, { t: 'Nilai', w: 22, align: 'right' }, { t: 'Keterangan', w: 115 }],
      a.rincian.map(x => [{ t: x.k, bold: true }, `${Math.round(x.nilai)}/${x.maks}`, x.ket]))
    sub('Konteks teknikal')
    tbl([{ t: 'Ukuran', w: 60 }, { t: 'Nilai', w: 122 }], [
      ['Tren besar', `${a.tren} (pola ${a.searah ? 'searah' : 'tidak searah'} tren)`],
      ['EMA50 / EMA200', `${n(a.e50 && Math.round(a.e50))} / ${n(a.e200 && Math.round(a.e200))}`],
      ['RSI(14)', n(a.rsi)],
      ...(a.volD != null ? [['Volume di D', `${n(a.volD)}× rata-rata 20 hari`]] : []),
      ['Likuiditas', `nilai transaksi rata-rata 20 hari Rp${n(Math.round(d.nilai / 1e6))} juta${d.likuid ? '' : ' (di bawah batas screening)'}`]])
    sub('Ringkasan analisa')
    butir(a.narasi)
    sub('Skenario', GOLD)
    butir(a.skenario.map(x => `${x.k}. ${x.teks}`))
    if (meta.ket) { ruang(12); y = para(doc, `${meta.nama}: ${meta.ket}`, 14, y + 1, 182, 8.5, MUTED) }
    sub('Cara membaca analisa ini')
    butir(['Status: Menuju PRZ = X-A-B-C terbentuk, harga bergerak ke zona D; Di PRZ = titik D sedang di zona; Berbalik dari PRZ = D terkonfirmasi dan harga mulai berbalik.',
      'PRZ adalah area, bukan satu harga: pertemuan retracement kaki XA dengan proyeksi extension kaki BC.',
      'Skor kualitas menjumlahkan presisi rasio (30), konfirmasi di PRZ (25), keselarasan dengan tren besar EMA50/EMA200 (20), simetri AB=CD (15), dan likuiditas (10). Skor bukan peluang berhasil.',
      'Konfirmasi: candle pembalikan (pin bar, engulfing, outside bar), divergence RSI antara B dan D, atau penutupan menembus struktur minor 3 bar sebelum D.',
      'Stop sedikit di balik X (Gartley, Bat, Cypher) atau di luar PRZ (Butterfly, Crab). R:R dihitung dari tepi PRZ (atau harga kini bila sudah berbalik).'], MUTED)
  }
  disclaimer(doc, ++hal, String(akhir.d || '').slice(0, 10),
    'Pola dideteksi otomatis dari harga harian (pivot zigzag 6/10/15%, toleransi rasio ±5%). Rasio pola mengikuti artikel Astronacci "Belajar Harmonic Pattern" (31 Juli 2026); '
    + 'PRZ, konfirmasi, stop, dan target 0,382/0,618 AD mengikuti Astronacci "Cara Menggunakan Harmonic Pattern untuk Menentukan Area Entry" (7 Agustus 2026); target alternatif C/A dari Maxco. '
    + 'Skor kualitas adalah ringkasan internal Radar Backdoor, bukan ukuran peluang berhasil.')
  return doc
}

export const harmonikPdfName = t => `Harmonic-${t}_${new Date().toISOString().slice(0, 10)}.pdf`
