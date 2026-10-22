// Pembuat presentasi analisa emiten (.pptx) dengan pptxgenjs. Prinsip: analisa dalam, teks sedikit —
// angka besar, meteran, diagram, dan grafik PowerPoint asli (bisa diklik/diedit). Satu pesan per slide,
// pita KESIMPULAN di bawah. Dipakai di browser (unduhan) dan di Node (uji).
import { fmtDate } from './domain.js'
import { PT_STATUS, ptStatusTxt, confLvl } from './patterns.js'
import { phaseName } from './cycle.js'
import { mergeBoard } from './profil.js'
import { riCalc, riVerdict, noRights, riFunding, asetDetail } from './rightsIssue.js'

const W = 10, H = 5.625, M = 0.45, CW = W - 2 * M
const TOP = 1.2, BOT = 4.6

// ---- format angka singkat ----
const id = (v, d = 0) => v == null || isNaN(v) ? '–' : (+v).toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: 0 })
export const rpS = v => v == null || isNaN(v) ? '–' : 'Rp' + id(Math.round(v))
export const bigS = v => v == null || isNaN(v) ? '–' : Math.abs(v) >= 1e12 ? `Rp${id(v / 1e12, 2)} T` : Math.abs(v) >= 1e9 ? `Rp${id(v / 1e9, 1)} M` : `Rp${id(v / 1e6, 0)} jt`
const pctS = (v, d = 0) => v == null || isNaN(v) ? '–' : `${v > 0 ? '+' : ''}${id(v * 100, d)}%`
const xS = v => v == null || isNaN(v) ? '–' : id(v, 2) + '×'
// Teks ringkas: utuh bila muat; kalimat pertama bila muat; selain itu dipotong di batas anak kalimat
// (koma, titik koma, titik dua, tanda pisah), baru di batas kata — tidak pernah di tengah kata.
export function short(s, n = 90) {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  if (t.length <= n) return t
  const sent = t.match(/^(.+?[.!?])(\s|$)/)
  if (sent && sent[1].length <= n && sent[1].length >= 20) return sent[1]
  const head = t.slice(0, n - 1)
  const clause = [...head.matchAll(/[;:,)](?=\s)|\s[—–-](?=\s)/g)].map(m => m.index).filter(i => i >= n * 0.45).pop()
  if (clause) return head.slice(0, clause).replace(/[,;:\s—–-]+$/, '') + '…'
  const sp = head.lastIndexOf(' ')
  return (sp > n * 0.5 ? head.slice(0, sp) : head).replace(/[,;:\s]+$/, '') + '…'
}
// Nama badan usaha tanpa keterangan dalam kurung (termasuk kurung terpotong) dan tanpa "melalui …".
const entName = s => String(s || '').replace(/\s*\(.*$/, '').replace(/^\s*(grup|melalui)\s+/i, '').replace(/\s+(melalui|via)\s.*$/i, '').trim()
// Porsi tanpa rincian dalam kurung: "39,31% (±1,03 miliar saham) via Triple B" -> "39,31%".
const porsiS = s => String(s || '').replace(/\s*\(.*?\)/g, '').replace(/\s+(melalui|via)\s.*$/i, '').trim()
// Gabungkan potongan teks berurutan selama muat n karakter; potongan yang tidak muat dipotong rapi.
const clip = (arr, n) => {
  let out = ''
  for (const t of (arr || []).map(x => String(x || '').trim()).filter(Boolean)) {
    const next = out ? out + ' ' + t : t
    if (next.length <= n) { out = next; continue }
    if (!out) out = short(t, n)
    break
  }
  return out
}
// Judul keterbukaan berhuruf kapital semua → huruf kalimat, dengan nama emiten & singkatan baku dipulihkan.
const ABBR = /\b(pt|tbk|hmetd|pmhmetd|pmthmetd|rups|rupslb|rupst|ojk|bei|kjpp|ptw|ipo)\b/g
function calmTitle(t, name = '') {
  const s = String(t || '').replace(/\s+/g, ' ').trim()
  if (s.length < 40 || s !== s.toUpperCase()) return s
  let out = s.charAt(0) + s.slice(1).toLowerCase()
  const nm = String(name || '').replace(/\.$/, '')
  if (nm) out = out.replace(new RegExp(nm.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'g'), nm)
  return out.replace(ABBR, w => w === 'tbk' ? 'Tbk' : w.toUpperCase())
}
// Persen dari Stockbit ("-84.72%") ke format Indonesia ("−84,72%").
const pctId = v => String(v || '').replace(/(\d)\.(\d)/, '$1,$2')
// Gaya tulisan ilmiah: tanda pisah panjang di tengah kalimat diganti koma.
const prose = v => typeof v === 'string' ? v.replace(/\s+[—]\s+/g, ', ').replace(/\s—(?=\S)/g, ', ')
  : Array.isArray(v) ? v.map(r => (r && typeof r === 'object' ? { ...r, text: prose(r.text) } : r)) : v
const KJPP_SHORT = { terbit: 'Terbit', ditunjuk: 'Ditunjuk', belum: 'Belum ada' }
const initials = s => String(s || '?').replace(/^(PT|CV)\.?\s+/i, '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
const yk = k => /terverifikasi/i.test(k || '') ? 'ok' : /indikasi/i.test(k || '') ? 'ind' : 'media'
const YK_LABEL = { ok: 'terverifikasi', ind: 'indikasi', media: 'disebut media' }

// Perangkat gambar bersama (presentasi + helper slide) untuk semua jenis presentasi unduhan.
function makeKit(PptxGenJS, d, th, title) {
  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_16x9'
  pres.author = 'Radar Backdoor'
  pres.company = 'Radar Backdoor'
  pres.title = title
  const S = pres.shapes
  let page = 0

  // ---- perangkat gambar ----
  // Teks satu warna (tidak warna-warni): warna penanda (aksen, positif, waspada, negatif) menjadi tinta gelap;
  // sorotan muda (accent2 dan warna terang lain), yang hanya dipakai di panel berwarna, menjadi putih.
  // Warna tema tetap dipakai pada bentuk (panel, batang, garis), bukan pada teks.
  const LIGHT = new Set(['FFFFFF', 'F8FAFC', 'EAF2FA', 'DCE7F3', 'BBF7D0', 'FDE68A', th.accent2])
  const mono = c => !c || c === th.ink || c === th.muted ? c : LIGHT.has(c) ? 'FFFFFF' : th.ink
  const monoRuns = v => Array.isArray(v) ? v.map(r => (r && typeof r === 'object' && r.options?.color ? { ...r, options: { ...r.options, color: mono(r.options.color) } } : r)) : v
  const T = (s, text, o = {}) => s.addText(monoRuns(prose(text)), { isTextBox: true, margin: 0, fontFace: th.body, color: th.ink, fontSize: 12, valign: 'top', ...o, ...(o.color ? { color: mono(o.color) } : {}) })
  const shadow = () => ({ type: 'outer', blur: 3, offset: 1, angle: 90, color: '000000', opacity: 0.1 })
  const card = (s, x, y, w, h, o = {}) => s.addShape(S.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.07,
    fill: { color: o.fill || th.card, transparency: o.tr || 0 }, line: { color: o.line || o.fill || th.line, width: 0.75 }, shadow: o.flat ? undefined : shadow() })
  const pill = (s, x, y, text, color, o = {}) => {
    const w = o.w || Math.max(0.7, 0.11 + String(text).length * 0.068 * (o.size || 9) / 9)
    s.addShape(S.ROUNDED_RECTANGLE, { x, y, w, h: o.h || 0.24, rectRadius: 0.12, fill: { color }, line: { color, width: 0.5 } })
    T(s, text, { x, y, w, h: o.h || 0.24, fontSize: o.size || 9, bold: true, color: o.ink || 'FFFFFF', align: 'center', valign: 'middle' })
    return w
  }
  const dot = (s, x, y, r, color, o = {}) => s.addShape(S.OVAL, { x: x - r, y: y - r, w: 2 * r, h: 2 * r, fill: { color, transparency: o.tr || 0 }, line: { color: o.line || color, width: o.lw || 0.75, transparency: o.ltr || 0 } })
  const line = (s, x, y, w, h, color, o = {}) => lineShape(s, S, x, y, w, h, color, o)
  const tone = v => v === 'good' ? th.good : v === 'warn' ? th.warn : v === 'bad' || v === 'strong' ? th.bad : th.muted
  const sikapTone = s => /asimetri/i.test(s || '') ? th.good : /netral/i.test(s || '') ? th.warn : s ? th.bad : th.muted
  const scoreTone = v => v >= 65 ? th.good : v >= 45 ? th.warn : th.bad
  const dimTone = v => v >= 6.5 ? th.good : v >= 4.5 ? th.warn : th.bad
  const chartBase = () => ({ catAxisLabelColor: th.muted, valAxisLabelColor: th.muted, catAxisLabelFontSize: 8, valAxisLabelFontSize: 8,
    catAxisLabelFontFace: th.body, valAxisLabelFontFace: th.body, legendFontFace: th.body, dataLabelFontFace: th.body,
    valGridLine: { color: th.line, size: 0.5 }, catGridLine: { style: 'none' }, legendFontSize: 9, legendColor: th.muted })

  // Kerangka slide isi: label bagian, judul, pita kesimpulan, kaki halaman.
  function slide(eyebrow, title, take) {
    const s = pres.addSlide()
    page++
    s.background = { color: th.bg }
    // Label bagian bernomor seperti bab/subbab laporan.
    T(s, `${page - 1}. ${eyebrow}`.toUpperCase(), { x: M, y: 0.28, w: CW, h: 0.22, fontSize: 9.5, bold: true, color: th.accent, charSpacing: 4 })
    T(s, title, { x: M, y: 0.5, w: CW, h: 0.58, fontFace: th.head, fontSize: 25, bold: true, color: th.ink, valign: 'middle', fit: 'shrink' })
    if (take) {
      s.addShape(S.ROUNDED_RECTANGLE, { x: M, y: 4.72, w: CW, h: 0.42, rectRadius: 0.06, fill: { color: th.dark }, line: { color: th.dark, width: 0.5 } })
      T(s, 'SIMPULAN', { x: M + 0.18, y: 4.72, w: 1.2, h: 0.42, fontSize: 8.5, bold: true, color: th.accent2, charSpacing: 3, valign: 'middle' })
      T(s, short(take, 150), { x: M + 1.45, y: 4.72, w: CW - 1.6, h: 0.42, fontSize: 10.5, color: 'FFFFFF', valign: 'middle' })
    }
    T(s, `${d.t} | Kajian Radar Backdoor | Data per ${fmtDate(d.date)}`, { x: M, y: 5.24, w: 6, h: 0.22, fontSize: 8, color: th.muted })
    T(s, String(page), { x: W - M - 0.5, y: 5.24, w: 0.5, h: 0.22, fontSize: 8, color: th.muted, align: 'right' })
    return s
  }
  // Kartu angka besar.
  function kpi(s, x, y, w, h, val, label, color = th.accent) {
    card(s, x, y, w, h)
    // Ukuran huruf menyesuaikan panjang nilai dan lebar kartu (agar tidak meluber).
    const per = String(val).length / Math.max(0.8, w - 0.3), base = h > 1.2 ? 26 : 20
    const fs = per <= 4.2 ? base : per <= 6 ? base * 0.78 : per <= 9 ? base * 0.6 : 11
    T(s, val, { x: x + 0.18, y: y + 0.12, w: w - 0.3, h: h * 0.5, fontFace: th.head, fontSize: Math.round(fs), bold: true, color, valign: 'middle' })
    T(s, short(label, 70), { x: x + 0.18, y: y + h * 0.58, w: w - 0.3, h: h * 0.38, fontSize: 9.5, color: th.muted })
  }
  // Batang horizontal (nilai 0..1).
  function hbar(s, x, y, w, frac, color, h = 0.14) {
    s.addShape(S.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: h / 2, fill: { color: th.line }, line: { color: th.line, width: 0.25 } })
    const fw = Math.max(h, w * Math.max(0, Math.min(1, frac)))
    s.addShape(S.ROUNDED_RECTANGLE, { x, y, w: fw, h, rectRadius: h / 2, fill: { color }, line: { color, width: 0.25 } })
  }

  return { pres, S, T, card, pill, dot, line, tone, sikapTone, scoreTone, dimTone, chartBase, slide, kpi, hbar, bump: () => ++page }
}

export function buildDeck(PptxGenJS, d, th) {
  const K = makeKit(PptxGenJS, d, th, `${d.t}: Kajian Analitis Backdoor Listing`)
  const { pres, S, T, card, pill, dot, line, tone, sikapTone, scoreTone, dimTone, chartBase, slide, kpi, hbar } = K
  const A = d.A || {}

  // ===== 1. Sampul (gelap, motif sesuai sektor) =====
  {
    const s = pres.addSlide(); K.bump()
    s.background = { color: th.dark }
    coverArt(s, d.sector?.motif, th, S, dot, line)
    T(s, 'KAJIAN ANALITIS · BACKDOOR LISTING', { x: 0.7, y: 1.0, w: 5.2, h: 0.3, fontSize: 10, bold: true, color: th.accent2, charSpacing: 5 })
    T(s, d.t, { x: 0.7, y: 1.35, w: 5.2, h: 1.2, fontFace: th.head, fontSize: 66, bold: true, color: 'FFFFFF', valign: 'middle' })
    T(s, 'Kajian Pengambilalihan Emiten', { x: 0.7, y: 2.55, w: 5.6, h: 0.5, fontFace: th.head, fontSize: 22, color: 'FFFFFF' })
    T(s, d.name || '', { x: 0.7, y: 3.1, w: 5.2, h: 0.35, fontSize: 15, color: th.accent2 })
    const topics = ['Pengendali', d.aset || A.sv?.injectType ? 'Aset injeksi' : null, 'Valuasi', 'Teknikal', 'Skenario'].filter(Boolean)
    T(s, topics.join('  •  '), { x: 0.7, y: 3.55, w: 5.4, h: 0.3, fontSize: 11, color: 'EAF2FA' })
    pill(s, 0.7, 4.0, d.sector?.label || 'Umum', th.accent, { size: 9 })
    T(s, `Data per ${fmtDate(d.date)}  |  Harga terakhir ${rpS(A.price)}${A.priceDate ? ' (' + fmtDate(A.priceDate) + ')' : ''}`, { x: 0.7, y: 4.95, w: 6, h: 0.25, fontSize: 9.5, color: 'DCE7F3' })
    if (d.pa?.asOf) T(s, `Narasi analis per ${fmtDate(d.pa.asOf)}${d.pa.hargaAcuan ? ' pada harga acuan ' + rpS(d.pa.hargaAcuan) : ''}`, { x: 0.7, y: 5.2, w: 6, h: 0.22, fontSize: 8.5, color: 'DCE7F3' })
  }

const recTone = t => t === 'good' ? th.good : t === 'bad' ? th.bad : th.warn
  // ===== 1b. Rekomendasi (tindakan, area harga, porsi, alasan) =====
  if (d.rec) {
    const rc = d.rec, col = recTone(rc.tone)
    const s = slide('Rekomendasi', 'Rekomendasi Investasi', rc.holder)
    card(s, M, TOP, 3.35, 3.35, { fill: th.dark, line: th.dark })
    T(s, 'TINDAKAN', { x: M + 0.2, y: TOP + 0.18, w: 3, h: 0.22, fontSize: 8, bold: true, color: th.accent2, charSpacing: 3 })
    T(s, rc.label, { x: M + 0.2, y: TOP + 0.42, w: 2.95, h: 0.85, fontFace: th.head, fontSize: 20, bold: true, color: 'FFFFFF', valign: 'middle', fit: 'shrink' })
    ;[['Porsi maksimal', rc.porsi], ['Profil risiko', rc.profil], ['Horizon', short(rc.horizon, 64)]].forEach(([k, v], i) => {
      const y = TOP + 1.38 + i * 0.64
      T(s, k.toUpperCase(), { x: M + 0.2, y, w: 2.95, h: 0.2, fontSize: 7.5, bold: true, color: th.accent2, charSpacing: 2 })
      T(s, v, { x: M + 0.2, y: y + 0.2, w: 2.95, h: 0.42, fontSize: 9.5, color: 'F8FAFC' })
    })
    const x = M + 3.5, w = CW - 3.5, bw = (w - 0.3) / 3
    const tg = rc.targets.map(t => `${rpS(t.p)} ${A.price ? '(' + pctS(t.p / A.price - 1, 0) + ')' : ''}`).join(' · ')
    ;[
      ['Area beli', rc.entry ? (rc.entry[1] ? `${rpS(rc.entry[0])}–${rpS(rc.entry[1])}` : `> ${rpS(rc.entry[0])}`) : 'Tidak ada', short(rc.entryNote || 'belum ada setup beli', 80), th.accent],
      ['Batas risiko', rpS(rc.stop), A.price && rc.stop ? `${pctS(rc.stop / A.price - 1, 1)} dari harga kini ${rpS(A.price)}` : '', th.bad],
      ['Target', rc.targets[0] ? rpS(rc.targets[0].p) : '–', short(tg || 'belum ada target', 80), th.good],
    ].forEach(([k, v, n, c2], i) => {
      const bx = x + i * (bw + 0.15)
      card(s, bx, TOP, bw, 1.35)
      T(s, k.toUpperCase(), { x: bx + 0.15, y: TOP + 0.12, w: bw - 0.3, h: 0.2, fontSize: 7.5, bold: true, color: th.accent, charSpacing: 2 })
      T(s, v, { x: bx + 0.15, y: TOP + 0.34, w: bw - 0.3, h: 0.5, fontFace: th.head, fontSize: 18, bold: true, color: c2, valign: 'middle', fit: 'shrink' })
      T(s, n, { x: bx + 0.15, y: TOP + 0.86, w: bw - 0.3, h: 0.45, fontSize: 8, color: th.muted })
    })
    card(s, x, TOP + 1.5, w, 1.85)
    T(s, 'ALASAN UTAMA', { x: x + 0.18, y: TOP + 1.6, w: w - 0.36, h: 0.2, fontSize: 7.5, bold: true, color: th.accent, charSpacing: 2 })
    T(s, rc.why.slice(0, 4).map((r, i, a) => ({ text: `${r.s > 0 ? 'Pendukung: ' : r.s < 0 ? 'Risiko: ' : 'Catatan: '}${short(r.t, 150)}`, options: { color: r.s > 0 ? th.good : r.s < 0 ? th.bad : th.ink, breakLine: i < a.length - 1, paraSpaceAfter: 3 } })),
      { x: x + 0.18, y: TOP + 1.84, w: w - 0.36, h: 1.45, fontSize: 9 })
  }

  // ===== 2. Ringkasan =====
  {
    const pa = d.pa || {}
    const s = slide('Ringkasan eksekutif', `Ringkasan Eksekutif ${d.t}: ${short(pa.sikap || A.stance?.t || 'Hasil Kajian', 34)}`, pa.ringkas || A.thesis)
    const k = [
      [rpS(A.price), `Harga terakhir${A.priceDate ? ' ' + fmtDate(A.priceDate) : ''}${A.tender?.price ? ' · ' + pctS(A.price / A.tender.price - 1) + ' vs PTW' : ''}`, th.accent],
      [bigS(A.mcap), `Kapitalisasi pasar · porsi publik ${A.flt != null ? id(A.flt, 1) + '%' : '–'}`, th.accent],
      [d.prog ? `${d.prog.pct}%` : '–', d.pos ? `Progres transaksi · ${short(d.pos.now, 48)}` : 'Progres transaksi', th.accent],
      [A.score != null ? `${A.score}/100` : '–', `Skor analisis · ${short(A.stance?.t || '', 50)}`, scoreTone(A.score)],
    ]
    k.forEach(([v, l, c], i) => kpi(s, M + (i % 2) * 2.15, TOP + Math.floor(i / 2) * 1.72, 2.0, 1.58, v, l, c))
    const px = M + 4.45, pw = CW - 4.45
    card(s, px, TOP, pw, 3.3, { fill: th.dark, line: th.dark })
    T(s, 'Sikap analis', { x: px + 0.25, y: TOP + 0.2, w: 2, h: 0.3, fontFace: th.head, fontSize: 15, bold: true, color: 'FFFFFF' })
    pill(s, px + 2.0, TOP + 0.23, pa.sikap || 'belum ada', sikapTone(pa.sikap), { size: 9 })
    // Empat poin: arti skor, pendorong terkuat, risiko terbesar, langkah berikutnya (label tebal + isi singkat).
    const pts = [['Skor', A.stance?.t], ['Pendorong', (A.bull || [])[0]], ['Risiko', (A.bear || [])[0]],
      d.pos?.next ? ['Berikutnya', d.pos.next] : A.rr != null ? ['Imbal-risiko', `${id(A.rr, 1)} : 1`] : null].filter(p => p && p[1])
    pts.forEach(([k, v], i) => {
      const y = TOP + 0.72 + i * 0.64
      T(s, k.toUpperCase(), { x: px + 0.25, y, w: pw - 0.45, h: 0.2, fontSize: 8, bold: true, color: th.accent2, charSpacing: 2 })
      T(s, short(v, 100), { x: px + 0.25, y: y + 0.2, w: pw - 0.45, h: 0.42, fontSize: 10.5, color: 'F8FAFC' })
    })
  }

  // ===== 2b. Tesis analis (lengkap, per kalimat bernomor) =====
  if (d.pa?.tesis) {
    const pts = String(d.pa.tesis).split(/(?<=[.;])\s+(?=[A-Z0-9])/).map(x => x.trim()).filter(x => x.length > 15).slice(0, 6)
    const s = slide('Tesis analis', 'Dasar Penilaian Analis', d.pa.ringkas || '')
    const cols = pts.length > 3 ? 2 : 1, rows = Math.ceil(pts.length / cols)
    const cw = (CW - 0.2 * (cols - 1)) / cols, ch = (3.35 - 0.12 * (rows - 1)) / rows
    pts.forEach((p, i) => {
      const x = M + (i % cols) * (cw + 0.2), y = TOP + Math.floor(i / cols) * (ch + 0.12)
      card(s, x, y, cw, ch)
      dot(s, x + 0.3, y + 0.3, 0.17, th.accent)
      T(s, String(i + 1), { x: x + 0.13, y: y + 0.13, w: 0.34, h: 0.34, fontSize: 10, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
      T(s, short(p, 230), { x: x + 0.6, y: y + 0.12, w: cw - 0.75, h: ch - 0.2, fontSize: 9.5, color: th.ink, valign: 'middle', fit: 'shrink' })
    })
  }
  if ((d.pa?.variabelKunci || []).length || (d.pa?.tesisSalahBila || []).length) {
    const s = slide('Variabel kunci', 'Variabel Kunci dan Kondisi Gugurnya Tesis', d.pa?.likuiditas || d.pa?.pengendaliBergerak || '')
    ;[['Variabel kunci yang dipantau', d.pa?.variabelKunci || [], th.accent], ['Tesis salah bila', d.pa?.tesisSalahBila || [], th.bad]].forEach(([h, list, col], k) => {
      const x = M + k * (CW / 2 + 0.1), w = CW / 2 - 0.1
      card(s, x, TOP, w, 3.35)
      s.addShape(S.RECTANGLE, { x, y: TOP, w: 0.08, h: 3.35, fill: { color: col }, line: { color: col, width: 0 } })
      T(s, h.toUpperCase(), { x: x + 0.25, y: TOP + 0.15, w: w - 0.4, h: 0.22, fontSize: 8, bold: true, color: col, charSpacing: 2 })
      T(s, list.length ? list.slice(0, 5).map((t, i, a) => ({ text: short(t, 170), options: { bullet: { indent: 12 }, breakLine: i < a.length - 1, paraSpaceAfter: 6 } })) : 'belum ada',
        { x: x + 0.25, y: TOP + 0.48, w: w - 0.45, h: 2.75, fontSize: 10, color: th.ink })
    })
  }

  // ===== 3. Skor enam dimensi =====
  if ((A.dims || []).length) {
    const dims = A.dims
    const best = [...dims].sort((a, b) => b.s - a.s)[0], worst = [...dims].sort((a, b) => a.s - b.s)[0]
    const s = slide('Skor analisis', 'Penilaian Enam Dimensi', `Dimensi terkuat adalah ${best.k} (${id(best.s, 1)}), sedangkan yang terlemah adalah ${worst.k} (${id(worst.s, 1)}). Skor total ${A.score}/100.`)
    dims.forEach((x, i) => {
      const y = TOP + 0.05 + i * 0.55
      T(s, x.k, { x: M, y, w: 2.0, h: 0.22, fontSize: 11, bold: true })
      T(s, id(x.s, 1), { x: M + 5.35, y: y - 0.02, w: 0.6, h: 0.26, fontSize: 13, bold: true, color: dimTone(x.s), align: 'right' })
      hbar(s, M + 2.05, y + 0.04, 3.2, x.s / 10, dimTone(x.s))
      T(s, short((x.why || [])[0] || '', 85), { x: M, y: y + 0.24, w: 5.95, h: 0.22, fontSize: 9, color: th.muted })
    })
    const cx = M + 7.25, cy = TOP + 1.45
    dot(s, cx, cy, 1.15, th.card, { line: th.line })
    dot(s, cx, cy, 0.95, scoreTone(A.score), { tr: 85, line: scoreTone(A.score), lw: 3 })
    T(s, String(A.score ?? '–'), { x: cx - 0.9, y: cy - 0.45, w: 1.8, h: 0.65, fontFace: th.head, fontSize: 40, bold: true, color: scoreTone(A.score), align: 'center', valign: 'middle' })
    T(s, 'dari 100', { x: cx - 0.9, y: cy + 0.2, w: 1.8, h: 0.25, fontSize: 10, color: th.muted, align: 'center' })
    T(s, short(A.stance?.t || '', 60), { x: cx - 1.35, y: cy + 1.3, w: 2.7, h: 0.5, fontSize: 10.5, bold: true, align: 'center', color: th.ink })
  }

  // ===== 3b. Rincian skor: alasan per dimensi =====
  if ((A.dims || []).length) {
    const WB = { 'Pengendali': 25, 'Substansi aset': 25, 'Posisi harga': 20, 'Struktur & likuiditas': 10, 'Katalis': 10, 'Fundamental': 10 }
    const s = slide('Skor analisis', 'Uraian Skor per Dimensi', `Skor total ${A.score}/100 merupakan rata-rata tertimbang dari keenam dimensi.`)
    const rh = 3.35 / A.dims.length
    A.dims.forEach((dm, i) => {
      const y = TOP + i * rh
      s.addShape(S.RECTANGLE, { x: M, y, w: CW, h: rh - 0.06, fill: { color: i % 2 ? th.bg : th.card }, line: { color: th.line, width: 0.5 } })
      T(s, dm.k, { x: M + 0.15, y, w: 1.75, h: rh - 0.06, fontSize: 10, bold: true, color: th.ink, valign: 'middle' })
      T(s, `${id(dm.s, 1)}`, { x: M + 1.9, y, w: 0.5, h: rh - 0.06, fontFace: th.head, fontSize: 16, bold: true, color: dimTone(dm.s), valign: 'middle', align: 'right' })
      hbar(s, M + 2.5, y + rh / 2 - 0.1, 0.9, dm.s / 10, dimTone(dm.s), 0.12)
      T(s, `bobot ${WB[dm.k] || '–'}%`, { x: M + 2.5, y: y + rh / 2 + 0.06, w: 0.9, h: 0.18, fontSize: 7, color: th.muted })
      T(s, clip(dm.why, 230), { x: M + 3.55, y, w: CW - 3.7, h: rh - 0.06, fontSize: 8.5, color: th.ink, valign: 'middle', fit: 'shrink' })
    })
  }

  // ===== 4. Struktur pengendali (diagram alur) =====
  {
    const pf = d.profil || {}, persons = (pf.pengendali || []).slice(0, 3), st = d.story || {}
    const s = slide('Pengendali', 'Struktur Kepemilikan dan Pihak Terkait', pf.ringkas || d.pv?.siapa || `Pengendali ${A.ctrlName || 'belum diketahui'}`)
    const ent = short(entName(persons[0]?.entitas) || entName(A.ctrlName) || 'Pengendali', 40)
    const lx = M, lw = 2.75, mx = M + 3.45, mw = 2.1, rx = M + 6.25, rw = CW - 6.25
    const n = Math.max(1, persons.length), bh = 0.62, gap = (2.05 - n * bh) / Math.max(1, n - 1)
    const midY = TOP + 0.6
    persons.forEach((o, i) => {
      const y = n === 1 ? midY + 0.12 : TOP + i * (bh + gap)
      card(s, lx, y, lw, bh)
      T(s, short(o.nama, 34), { x: lx + 0.12, y: y + 0.07, w: lw - 0.24, h: 0.26, fontSize: 11, bold: true, align: 'center' })
      T(s, short([o.peran, porsiS(o.porsi)].filter(Boolean).join(' · '), 40), { x: lx + 0.12, y: y + 0.34, w: lw - 0.24, h: 0.22, fontSize: 9, color: th.muted, align: 'center' })
      line(s, lx + lw, y + bh / 2, mx - lx - lw, midY + 0.42 - (y + bh / 2), th.muted, { arrow: true, w: 1.5 })
    })
    if (!persons.length) { card(s, lx, TOP + 0.75, lw, bh); T(s, short(A.ctrlName || 'belum ada', 34), { x: lx, y: TOP + 0.9, w: lw, h: 0.3, fontSize: 11, bold: true, align: 'center' }); line(s, lx + lw, TOP + 1.06, mx - lx - lw, 0.11, th.muted, { arrow: true }) }
    s.addShape(S.ROUNDED_RECTANGLE, { x: mx, y: midY, w: mw, h: 0.85, rectRadius: 0.07, fill: { color: th.accent }, line: { color: th.accent, width: 0.5 } })
    T(s, ent, { x: mx + 0.1, y: midY + 0.08, w: mw - 0.2, h: 0.7, fontSize: 11.5, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', fit: 'shrink' })
    line(s, mx + mw, midY + 0.42, rx - mx - mw, 0, th.accent, { arrow: true, w: 2 })
    T(s, A.ctrlPct != null ? id(A.ctrlPct, 1) + '%' : '', { x: mx + mw + 0.05, y: midY + 0.1, w: rx - mx - mw - 0.1, h: 0.25, fontSize: 10, bold: true, color: th.accent, align: 'center' })
    card(s, rx, midY - 0.25, rw, 1.35, { fill: th.dark, line: th.dark })
    T(s, d.t, { x: rx, y: midY - 0.15, w: rw, h: 0.45, fontSize: 22, bold: true, color: 'FFFFFF', align: 'center' })
    T(s, `Pengendali ${A.ctrlPct != null ? id(A.ctrlPct, 2) + '%' : '–'}`, { x: rx, y: midY + 0.32, w: rw, h: 0.25, fontSize: 10.5, color: 'FFFFFF', align: 'center' })
    T(s, `Publik ${A.flt != null ? id(A.flt, 2) + '%' : '–'}`, { x: rx, y: midY + 0.58, w: rw, h: 0.25, fontSize: 10.5, color: th.accent2, align: 'center' })
    const cards = [
      ['Pengendali lama', st.oldName ? `${short(st.oldName, 40)}${st.oldPct ? ' (' + st.oldPct + ')' : ''}` : 'belum ada'],
      ['Masuk sejak', st.takeoverDate ? fmtDate(st.takeoverDate) : 'belum ada'],
      ['Harga PTW vs kini', A.tender?.price ? `${rpS(A.tender.price)} → ${rpS(A.price)} (${pctS(A.price / A.tender.price - 1)})` : 'belum ada PTW'],
    ]
    cards.forEach(([h, v], i) => {
      const x = M + i * (CW / 3 + 0.075), w = CW / 3 - 0.1
      card(s, x, 3.4, w, 1.15)
      T(s, h, { x: x + 0.18, y: 3.5, w: w - 0.3, h: 0.25, fontSize: 9.5, bold: true, color: th.accent })
      T(s, v, { x: x + 0.18, y: 3.78, w: w - 0.3, h: 0.65, fontSize: 11, bold: true })
    })
  }

  // ===== 5. Kepemilikan & pergerakan pemegang saham (grafik) =====
  const hold = (A.holders || []).filter(h => Math.abs(h.change || 0) >= 0.1).slice(0, 7)
  if (A.ctrlPct != null || hold.length) {
    const s = slide('Kepemilikan', 'Komposisi dan Perubahan Pemegang Saham', d.pa?.pengendaliBergerak || (hold[0] ? `${short(hold[0].name, 40)} ${pctS((hold[0].change || 0) / 100, 2)} poin dalam setahun` : ''))
    const ctrl = +A.ctrlPct || 0, pub = A.flt != null ? +A.flt : Math.max(0, 100 - ctrl), other = Math.max(0, 100 - ctrl - pub)
    s.addChart(pres.charts.DOUGHNUT, [{ name: 'Kepemilikan', labels: ['Pengendali', 'Publik', 'Lainnya'], values: [ctrl, pub, other] }], {
      x: M, y: TOP, w: 3.6, h: 3.3, holeSize: 58, chartColors: [th.accent, th.accent2, th.line], showPercent: true, showLegend: true, legendPos: 'b',
      dataLabelColor: 'FFFFFF', dataLabelFontSize: 10, legendFontSize: 9, legendFontFace: th.body, dataLabelFontFace: th.body, showTitle: true, title: 'Struktur kepemilikan (%)',
      titleFontSize: 11, titleColor: th.ink, titleFontFace: th.body })
    if (hold.length) {
      const labels = hold.map(h => short(h.name, 26)), up = hold.map(h => h.change > 0 ? +h.change.toFixed(2) : 0), dn = hold.map(h => h.change < 0 ? +h.change.toFixed(2) : 0)
      s.addChart(pres.charts.BAR, [{ name: 'Menambah', labels, values: up }, { name: 'Mengurangi', labels, values: dn }], {
        ...chartBase(), x: M + 3.8, y: TOP, w: CW - 3.8, h: 3.3, barDir: 'bar', barGrouping: 'stacked', chartColors: [th.good, th.bad], showLegend: true, legendPos: 'b', catAxisLabelPos: 'low',
        showValue: false, showTitle: true, title: 'Perubahan porsi pemegang ≥5% dalam 365 hari (poin %)', titleFontSize: 11, titleColor: th.ink, titleFontFace: th.body, valAxisLabelFormatCode: '0.0' })
    } else {
      T(s, 'Tidak ada pergerakan pemegang 5% ke atas dalam setahun.', { x: M + 4, y: TOP + 1.4, w: CW - 4, h: 0.4, fontSize: 12, color: th.muted, align: 'center' })
    }
  }

  // ===== 6. Profil pengendali per orang (maks. 2 slide) =====
  for (const o of (d.profil?.pengendali || []).slice(0, 2)) {
    const rj = (o.rekamJejak || []).slice(0, 5)
    const s = slide('Profil pengendali', short(o.nama, 44), o.karakteristik || o.risiko)
    card(s, M, TOP, 3.55, 3.35)
    dot(s, M + 0.62, TOP + 0.6, 0.38, th.accent)
    T(s, initials(o.nama), { x: M + 0.24, y: TOP + 0.36, w: 0.76, h: 0.48, fontSize: 16, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
    T(s, short(o.nama, 40), { x: M + 1.15, y: TOP + 0.3, w: 2.25, h: 0.3, fontSize: 12, bold: true })
    T(s, short([o.peran, porsiS(o.porsi)].filter(Boolean).join(' · '), 44), { x: M + 1.15, y: TOP + 0.6, w: 2.25, h: 0.3, fontSize: 9, color: th.muted })
    T(s, [{ text: 'Latar  ', options: { bold: true, color: th.accent } }, { text: short(o.latar, 150) }], { x: M + 0.2, y: TOP + 1.12, w: 3.15, h: 0.85, fontSize: 9.5 })
    const per = (o.perkara || []).length, risk = o.perkara ? (per ? `${per} perkara/sanksi tercatat` : 'Bersih dari perkara publik') : 'Perkara belum diriset'
    pill(s, M + 0.2, TOP + 2.05, risk, o.perkara ? (per ? th.bad : th.good) : th.muted, { size: 8.5 })
    const net = (o.jaringan || []).length, co = (o.perusahaan || []).length
    T(s, `${rj.length ? (o.rekamJejak.length + ' rekam jejak · ') : ''}${co ? co + ' perusahaan · ' : ''}${net} jaringan`, { x: M + 0.2, y: TOP + 2.42, w: 3.15, h: 0.25, fontSize: 9.5, bold: true, color: th.ink })
    T(s, short(o.pengalaman, 110), { x: M + 0.2, y: TOP + 2.7, w: 3.15, h: 0.6, fontSize: 9, color: th.muted })
    // Garis waktu rekam jejak.
    const tx = M + 3.85, tw = CW - 3.85
    T(s, rj.length ? 'Rekam jejak' : 'Rekam jejak belum ditemukan', { x: tx, y: TOP, w: tw, h: 0.25, fontSize: 11, bold: true, color: th.accent })
    if (rj.length) line(s, tx + 0.12, TOP + 0.42, 0, 2.85, th.line, { w: 2 })
    rj.forEach((r, i) => {
      const y = TOP + 0.35 + i * 0.6, c = yk(r.keyakinan) === 'ok' ? th.good : yk(r.keyakinan) === 'ind' ? th.muted : th.warn
      dot(s, tx + 0.12, y + 0.1, 0.08, c)
      T(s, `${r.kode ? r.kode + ' · ' : ''}${short(entName(r.entitas), 44)}`, { x: tx + 0.32, y, w: tw - 2.0, h: 0.22, fontSize: 10, bold: true })
      T(s, short(String(r.periode || '').replace(/\s*\(.*$/, ''), 26), { x: tx + tw - 1.7, y, w: 1.7, h: 0.22, fontSize: 8.5, color: th.muted, align: 'right' })
      T(s, short(r.hasil, 120), { x: tx + 0.32, y: y + 0.22, w: tw - 0.35, h: 0.36, fontSize: 8.5, color: th.muted })
    })
  }

  // ===== 7. Pengurus (kartu, bukan tabel) =====
  // Pengurus riset dilengkapi daftar terkini Stockbit; yang tidak lagi tercantum tidak ditampilkan.
  const mb = mergeBoard(d.profil?.pengurus, d.profile)
  const board = [...mb.direksi.map(x => ({ ...x, g: 'Direksi' })), ...mb.komisaris.map(x => ({ ...x, g: 'Komisaris' }))].filter(x => !x.notListed)
  if (board.length) {
    const nb = board.filter(x => x.orangPengendaliBaru).length
    const s = slide('Pengurus', 'Susunan Direksi dan Dewan Komisaris', `Sebanyak ${nb} dari ${board.length} anggota pengurus berasal dari pihak pengendali baru${board.some(x => (x.rangkap || []).length) ? ', dan sebagian merangkap jabatan di emiten lain' : ''}.`)
    // Kartu mengisi tinggi area: 1 baris bila ≤4 orang (kartu tinggi, dengan latar singkat), 2 baris bila lebih.
    const list = board.slice(0, 8), cols = 4, rows = Math.ceil(list.length / cols)
    const cw = (CW - 0.15 * (cols - 1)) / cols, ch = rows === 1 ? 3.3 : 1.6
    list.forEach((x, i) => {
      const cx = M + (i % cols) * (cw + 0.15), cy = TOP + Math.floor(i / cols) * (ch + 0.1)
      card(s, cx, cy, cw, ch)
      dot(s, cx + 0.32, cy + 0.32, 0.2, x.orangPengendaliBaru ? th.accent : th.muted)
      T(s, initials(x.nama), { x: cx + 0.12, y: cy + 0.12, w: 0.4, h: 0.4, fontSize: 9, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
      T(s, short(x.nama, 34), { x: cx + 0.6, y: cy + 0.1, w: cw - 0.68, h: 0.46, fontSize: 9.5, bold: true, valign: 'middle' })
      T(s, short(x.jabatan || x.g, 34), { x: cx + 0.15, y: cy + 0.6, w: cw - 0.3, h: 0.22, fontSize: 8.5, color: th.muted })
      let tw = pill(s, cx + 0.15, cy + 0.88, x.orangPengendaliBaru ? 'pengendali baru' : 'pengurus lama', x.orangPengendaliBaru ? th.accent : th.muted, { size: 7.5, h: 0.2 })
      if (x.independen) pill(s, cx + 0.22 + tw, cy + 0.88, 'independen', th.good, { size: 7.5, h: 0.2 })
      let y = cy + 1.16
      if ((x.rangkap || []).length) { T(s, 'Rangkap: ' + short(x.rangkap[0], rows === 1 ? 70 : 30), { x: cx + 0.15, y, w: cw - 0.3, h: rows === 1 ? 0.42 : 0.22, fontSize: 7.5, color: th.warn, bold: true }); y += rows === 1 ? 0.48 : 0.24 }
      if (rows === 1 && x.latar) T(s, short(x.latar, 170), { x: cx + 0.15, y, w: cw - 0.3, h: cy + ch - y - 0.1, fontSize: 8, color: th.muted })
      else if (rows > 1 && x.hubungan && y < cy + ch - 0.25) T(s, short(x.hubungan, 34), { x: cx + 0.15, y, w: cw - 0.3, h: 0.22, fontSize: 7.5, color: th.muted })
    })
  }

  // ===== 8. Aset injeksi & mekanisme (langkah bergambar) =====
  if (d.aset || A.sv?.injectType) {
    const as = d.aset || {}, mcap = A.mcap
    const s = slide('Aset injeksi', short(as.aset?.nama || A.sv?.injectTarget || A.sv?.injectType || 'Rencana injeksi aset', 50), (d.deep.find(x => /^Aset yang masuk/.test(x[0])) || [])[1])
    const k = [[bigS(d.tx), 'Nilai transaksi/aset', th.accent], [d.tx && mcap ? xS(d.tx / mcap) : '–', 'Terhadap kapitalisasi pasar', th.accent],
      [KJPP_SHORT[d.kjpp?.id] || '–', `Penilaian KJPP${d.aset?.kjpp?.nama ? ' · ' + short(d.aset.kjpp.nama, 30) : ''}`, tone(d.kjpp?.tone)]]
    k.forEach(([v, l, c], i) => kpi(s, M + i * (CW / 3), TOP, CW / 3 - 0.15, 1.05, v, l, c))
    T(s, `Mekanisme: ${d.mechLabel || 'belum diungkap'}`, { x: M, y: TOP + 1.25, w: CW, h: 0.25, fontSize: 11, bold: true, color: th.accent })
    const steps = d.steps || [], sw = CW / Math.max(1, steps.length)
    steps.forEach((st, i) => {
      const cx = M + sw * i + sw / 2, cy = TOP + 1.85
      if (i) line(s, cx - sw + 0.22, cy, sw - 0.44, 0, st.done ? th.good : th.line, { w: 2.5 })
      dot(s, cx, cy, 0.2, st.done ? th.good : th.card, { line: st.done ? th.good : th.line, lw: 2 })
      T(s, st.done ? '✓' : String(i + 1), { x: cx - 0.2, y: cy - 0.2, w: 0.4, h: 0.4, fontSize: 11, bold: true, color: st.done ? 'FFFFFF' : th.muted, align: 'center', valign: 'middle' })
      T(s, st.t, { x: cx - sw / 2 + 0.05, y: cy + 0.28, w: sw - 0.1, h: 0.55, fontSize: 8.5, align: 'center', color: st.done ? th.ink : th.muted, bold: st.done })
    })
    const desc = [as.aset?.sektor && `Sektor: ${as.aset.sektor}`, as.aset?.porsi && `Porsi: ${short(as.aset.porsi, 40)}`, as.aset?.deskripsi && short(as.aset.deskripsi, 120)].filter(Boolean).join('  ·  ')
    if (desc) T(s, desc, { x: M, y: TOP + 2.75, w: CW, h: 0.55, fontSize: 9.5, color: th.muted })
  }

  // ===== 8b. Rincian nilai aset injeksi (kisaran antar-sumber, cara bayar, KJPP, data belum diungkap) =====
  {
    const inj = d.ri?.inj || d.aset?.transaksi?.nilaiRp || null
    const det = d.ri?.detail || asetDetail(d.aset, inj)
    if (det && (det.lo || det.nama)) {
      const kj = det.kjpp
      const s = slide('Aset injeksi', 'Rincian Nilai Aset Injeksi', det.spread
        ? `Nilai aset masih indikatif, berkisar ${bigS(det.lo)} hingga ${bigS(det.hi)} menurut sumber yang berbeda; perhitungan memakai ${bigS(inj || det.hi)}.`
        : kj.status === 'terbit' ? `Nilai aset telah dinilai KJPP${kj.nilai ? ' sebesar ' + bigS(kj.nilai) : ''}.` : 'Nilai aset belum diuji oleh penilai independen (KJPP).')
      card(s, M, TOP, 3.3, 3.35, { fill: th.dark, line: th.dark })
      T(s, det.spread ? 'NILAI INDIKATIF (BERBEDA ANTARSUMBER)' : 'NILAI TRANSAKSI', { x: M + 0.2, y: TOP + 0.18, w: 2.9, h: 0.22, fontSize: 8, bold: true, color: th.accent2, charSpacing: 2 })
      T(s, det.spread ? `${bigS(det.lo)} – ${bigS(det.hi)}` : bigS(det.hi || inj), { x: M + 0.2, y: TOP + 0.45, w: 2.9, h: 0.7, fontFace: th.head, fontSize: det.spread ? 19 : 26, bold: true, color: 'FFFFFF', valign: 'middle' })
      if (det.spread && inj) T(s, `Dipakai dalam perhitungan: ${bigS(inj)}`, { x: M + 0.2, y: TOP + 1.15, w: 2.9, h: 0.25, fontSize: 9.5, color: th.accent2 })
      if (det.nilaiText) T(s, short(det.nilaiText, 260), { x: M + 0.2, y: TOP + 1.5, w: 2.9, h: 1.75, fontSize: 9, color: 'EAF2FA' })
      const cx = M + 3.5, cw = CW - 3.5
      const boxes = [
        ['Aset', [det.nama, det.jenis, [det.lokasi, det.porsi].filter(Boolean).join(' · '), ...det.facts.map(([l, v]) => `${l}: ${typeof v === 'number' ? bigS(v) : v}`)].filter(Boolean).join(' · ')],
        ['Cara bayar', det.cara],
        ['Penilaian independen (KJPP)', `${KJPP_SHORT[kj.status] || 'Belum ada'}${kj.nama ? ' · ' + kj.nama : ''}${kj.nilai ? ' · ' + bigS(kj.nilai) : ''}${kj.ket ? '. ' + kj.ket : ''}`],
      ].filter(b => b[1])
      // Tinggi kotak mengikuti panjang teks (±95 karakter per baris pada lebar ini).
      const lines = boxes.map(([, v]) => Math.min(3, Math.ceil(short(v, 280).length / 95)))
      const room = det.gaps.length ? 2.3 : 3.35
      const unit = (room - 0.1 * (boxes.length - 1) - 0.36 * boxes.length) / lines.reduce((a, b) => a + b, 0)
      let by = TOP
      boxes.forEach(([h, v], i) => {
        const bh = 0.36 + lines[i] * Math.min(0.2, unit)
        card(s, cx, by, cw, bh)
        T(s, h.toUpperCase(), { x: cx + 0.15, y: by + 0.07, w: cw - 0.3, h: 0.2, fontSize: 7.5, bold: true, color: th.accent, charSpacing: 2 })
        T(s, short(v, 280), { x: cx + 0.15, y: by + 0.28, w: cw - 0.3, h: bh - 0.32, fontSize: 8.5, color: th.ink, fit: 'shrink' })
        by += bh + 0.1
      })
      if (det.gaps.length) {
        const gy = Math.max(by + 0.05, TOP + 2.2)
        T(s, 'BELUM DIUNGKAP KE PUBLIK', { x: cx, y: gy, w: cw, h: 0.2, fontSize: 7.5, bold: true, color: th.bad, charSpacing: 2 })
        T(s, det.gaps.slice(0, 4).map((g, i, a) => ({ text: short(g, 95), options: { bullet: { indent: 10 }, breakLine: i < a.length - 1, paraSpaceAfter: 2 } })),
          { x: cx, y: gy + 0.24, w: cw, h: TOP + 3.35 - gy - 0.24, fontSize: 8.5, color: th.muted })
      }
    }
  }

  // ===== 8c. Tahapan pendanaan (tahap I tunai) dan injeksi aset (tahap II dibayar saham) =====
  if (d.ri?.laterInj && d.riR) {
    const c = d.ri, r = d.riR, P = d.riP
    const sh = v => v == null ? '–' : v >= 1e9 ? `${id(v / 1e9, 2)} miliar` : `${id(v / 1e6, 0)} jt`
    const pc = v => v == null ? '–' : `${id(v * 100, v < 0.1 ? 2 : 1)}%`
    const s = slide('Aset injeksi', 'Tahapan Pendanaan dan Injeksi Aset',
      `Tahap I (${bigS(r.total)}) berupa dana tunai, bukan pembelian aset; aset ${bigS(c.laterInj)} dibayar dengan ±${sh(r.injShares)} saham baru pada tahap II.`)
    ;[
      [`TAHAP I · ${c.label.toUpperCase()}`, bigS(r.total), `${sh(r.N)} saham × ${rpS(P)}${c.jadwal ? ' · ' + short(c.jadwal, 40) : ''}`, 'Dana tunai untuk modal kerja dan kewajiban, bukan untuk membeli aset.', th.accent],
      ['TAHAP II · INJEKSI ASET', bigS(c.laterInj), `Dibayar sekitar ${sh(r.injShares)} saham baru pada harga ${rpS(P)}`, `Porsi publik dapat turun dari ${id(c.float || 0, 1)}% menjadi ${pc(r.pubAfterInj)} bila publik tidak ikut menebus.`, r.pubAfterInj < 0.075 ? th.bad : th.accent],
    ].forEach(([h, v, a, b, col], i) => {
      const x = M + i * (CW / 2 + 0.1), w = CW / 2 - 0.1
      card(s, x, TOP, w, 3.35)
      s.addShape(S.RECTANGLE, { x, y: TOP, w, h: 0.08, fill: { color: col }, line: { color: col, width: 0 } })
      T(s, h, { x: x + 0.25, y: TOP + 0.25, w: w - 0.5, h: 0.24, fontSize: 9, bold: true, color: th.accent, charSpacing: 2, fit: 'shrink' })
      T(s, v, { x: x + 0.25, y: TOP + 0.6, w: w - 0.5, h: 0.75, fontFace: th.head, fontSize: 30, bold: true, color: col, valign: 'middle' })
      T(s, a, { x: x + 0.25, y: TOP + 1.5, w: w - 0.5, h: 0.5, fontSize: 10.5, color: th.ink })
      T(s, b, { x: x + 0.25, y: TOP + 2.1, w: w - 0.5, h: 1.0, fontSize: 10, color: th.muted })
    })
    T(s, '+', { x: M + CW / 2 - 0.15, y: TOP + 1.45, w: 0.3, h: 0.4, fontSize: 20, bold: true, color: th.muted, align: 'center', valign: 'middle' })
  }

  // ===== 9. Simulasi nilai KJPP (grafik) =====
  if (d.sim?.rows?.length) {
    const sm = d.sim
    const s = slide('Valuasi aset', 'Simulasi Nilai Wajar terhadap Harga Transaksi', sm.verdict?.t)
    const labels = [...sm.rows.map(r => short(r.k, 32)), 'Harga transaksi']
    const vals = [...sm.rows.map(r => +(r.v / 1e9).toFixed(1)), sm.tx ? +(sm.tx / 1e9).toFixed(1) : 0]
    s.addChart(pres.charts.BAR, [{ name: 'Rp miliar', labels, values: vals }], { ...chartBase(), x: M, y: TOP, w: 6.0, h: 3.35, barDir: 'bar',
      chartColors: [th.accent], showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 9, dataLabelColor: th.ink, valAxisLabelFormatCode: '#,##0', showLegend: false,
      showTitle: true, title: 'Nilai porsi aset (Rp miliar)', titleFontSize: 11, titleColor: th.ink, titleFontFace: th.body })
    kpi(s, M + 6.2, TOP, CW - 6.2, 1.05, sm.prem != null ? pctS(sm.prem) : '–', 'Selisih harga transaksi vs median simulasi', sm.prem > 0.15 ? th.bad : th.good)
    kpi(s, M + 6.2, TOP + 1.2, CW - 6.2, 1.05, sm.mid ? bigS(sm.mid) : '–', `Median simulasi · keyakinan ${sm.conf || '–'}`)
    T(s, `Kelipatan pembanding: median ${sm.n} emiten (${sm.peers.join(', ')}). Ini simulasi, bukan laporan KJPP.`, { x: M + 6.2, y: TOP + 2.45, w: CW - 6.2, h: 0.85, fontSize: 9, color: th.muted })
  }

  // ===== 9b. Penambahan modal (rights issue) & pengumpulan dana =====
  if (d.ri && d.riR) {
    const c = d.ri, r = d.riR, f = d.riF
    const fc = f ? { good: th.good, warn: th.warn, strong: th.bad }[f.tone] : th.muted
    const s = slide('Penambahan modal', `${c.label.charAt(0).toUpperCase() + c.label.slice(1)}`, f ? `Berdasarkan keterbukaan informasi terakhir${f.last ? ` (${fmtDate(f.last.date)})` : ''}, peluang terkumpulnya dana dinilai ${f.label.toLowerCase()}.` : '')
    const w4 = (CW - 0.45) / 4
    ;[
      [c.inj ? bigS(c.inj) : '–', 'Nilai transaksi injeksi aset'],
      [bigS(r.total), `Nilai penerbitan · ${id(r.N / 1e6, 0)} jt saham × ${rpS(d.riP)}`],
      [bigS(r.tunai), r.aset ? `Dana tunai; ${bigS(r.aset)} non-tunai` : 'Dana tunai'],
      [`${id(c.float || 0, 1)}% → ${id(r.pubAfter * 100, 1)}%`, 'Porsi publik bila tidak menebus'],
    ].forEach(([v, l], i) => kpi(s, M + i * (w4 + 0.15), TOP, w4, 1.3, v, l))
    if (f) {
      card(s, M, TOP + 1.45, CW, 1.9)
      s.addShape(S.RECTANGLE, { x: M, y: TOP + 1.45, w: 0.08, h: 1.9, fill: { color: fc }, line: { color: fc, width: 0 } })
      T(s, 'PENGUMPULAN DANA', { x: M + 0.25, y: TOP + 1.55, w: 3, h: 0.2, fontSize: 7.5, bold: true, color: th.accent, charSpacing: 2 })
      T(s, f.label, { x: M + 0.25, y: TOP + 1.78, w: 2.6, h: 0.45, fontFace: th.head, fontSize: 16, bold: true, color: fc, valign: 'middle', fit: 'shrink' })
      if (f.last) T(s, `${fmtDate(f.last.date)} · ${short(f.last.title, 110)}`, { x: M + 0.25, y: TOP + 2.28, w: 2.6, h: 1.0, fontSize: 8, color: th.muted })
      const rs = [...f.reasons].sort((a, b) => Math.abs(b.s) - Math.abs(a.s)).slice(0, 5)
      T(s, rs.map((x, i) => ({ text: `${x.s > 0 ? 'Pendukung: ' : x.s < 0 ? 'Risiko: ' : 'Catatan: '}${short(x.t, 120)}`, options: { color: x.s > 0 ? th.good : x.s < 0 ? th.bad : th.ink, breakLine: i < rs.length - 1, paraSpaceAfter: 3 } })),
        { x: M + 3.0, y: TOP + 1.58, w: CW - 3.15, h: 1.7, fontSize: 8.5 })
    }
  }

  // ===== 10. Pihak lawan & rantai kepemilikan (diagram) =====
  const af = d.profil?.afiliasi
  if (af?.pihakLawan) {
    const s = slide('Pihak lawan', 'Pihak Pengendali Aset Target', af.hubungan)
    const chain = (af.strukturKepemilikan || []).slice().sort((a, b) => (a.lapis || 0) - (b.lapis || 0))
    const lay = [...new Set(chain.map(c => c.lapis ?? 0))].slice(0, 4)
    const lw = 5.6, colW = lay.length ? lw / lay.length : lw
    if (lay.length) {
      lay.forEach((lv, i) => {
        const items = chain.filter(c => (c.lapis ?? 0) === lv).slice(0, 3)
        const x = M + i * colW
        T(s, `Lapis ${lv}`, { x, y: TOP, w: colW - 0.3, h: 0.22, fontSize: 9, bold: true, color: th.accent, align: 'center' })
        items.forEach((c, j) => {
          const y = TOP + 0.3 + j * 1.0
          card(s, x, y, colW - 0.3, 0.85)
          T(s, short(c.pemilik || '–', 40), { x: x + 0.08, y: y + 0.06, w: colW - 0.46, h: 0.45, fontSize: 9, bold: true, align: 'center', valign: 'middle', fit: 'shrink' })
          T(s, short(`${c.porsi ? c.porsi + ' di ' : 'di '}${c.entitas || ''}`, 44), { x: x + 0.08, y: y + 0.5, w: colW - 0.46, h: 0.32, fontSize: 7.5, color: th.muted, align: 'center' })
        })
        if (i) line(s, x - 0.28, TOP + 0.72, 0.24, 0, th.muted, { arrow: true, w: 1.5 })
      })
    } else {
      card(s, M, TOP + 0.3, lw, 1.1)
      T(s, short(af.pihakLawan, 80), { x: M + 0.2, y: TOP + 0.4, w: lw - 0.4, h: 0.45, fontSize: 12, bold: true })
      T(s, 'Pengendali/UBO: ' + short(af.pengendaliPihakLawan || 'belum ada', 80), { x: M + 0.2, y: TOP + 0.88, w: lw - 0.4, h: 0.45, fontSize: 9.5, color: th.muted })
    }
    const rx = M + 5.85, rw = CW - 5.85
    card(s, rx, TOP, rw, 3.35, { fill: th.dark, line: th.dark })
    T(s, 'Temuan tidak langsung', { x: rx + 0.2, y: TOP + 0.15, w: rw - 0.4, h: 0.3, fontSize: 12, bold: true, color: 'FFFFFF' })
    const hid = (af.temuanTersembunyi || []).slice(0, 3)
    hid.forEach((h, i) => {
      const y = TOP + 0.55 + i * 0.92, k = yk(h.keyakinan)
      pill(s, rx + 0.2, y, YK_LABEL[k], k === 'ok' ? th.good : k === 'ind' ? th.muted : th.warn, { size: 7.5, h: 0.2 })
      T(s, short(h.temuan, 105), { x: rx + 0.2, y: y + 0.24, w: rw - 0.4, h: 0.62, fontSize: 9, color: 'F8FAFC' })
    })
    if (!hid.length) T(s, 'Tidak ada temuan hubungan tidak langsung.', { x: rx + 0.2, y: TOP + 0.6, w: rw - 0.4, h: 0.4, fontSize: 10, color: 'DCE7F3' })
  }

  // ===== 11. Progres transaksi (donat + langkah) =====
  if (d.prog) {
    const p = d.prog, ms = p.applicable || d.milestones
    const s = slide('Kemajuan transaksi', `Kemajuan Transaksi: ${p.pct}% dari Seluruh Tahapan`, d.pos?.next ? `Tahap berikutnya adalah ${d.pos.next}.` : 'Seluruh tahapan transaksi telah selesai.')
    s.addChart(pres.charts.DOUGHNUT, [{ name: 'Progres', labels: ['Tercapai', 'Belum'], values: [p.pct, 100 - p.pct] }], {
      x: M, y: TOP + 0.1, w: 2.9, h: 2.6, holeSize: 70, chartColors: [th.accent, th.line], showLegend: false, showPercent: false, showValue: false, dataLabelColor: th.bg })
    T(s, `${p.pct}%`, { x: M, y: TOP + 1.05, w: 2.9, h: 0.6, fontFace: th.head, fontSize: 30, bold: true, color: th.accent, align: 'center', valign: 'middle' })
    T(s, `Posisi: ${short(d.pos?.now || '', 60)}`, { x: M, y: TOP + 2.8, w: 2.9, h: 0.5, fontSize: 9.5, bold: true, align: 'center' })
    const lx = M + 3.2, rowH = Math.min(0.37, 3.3 / ms.length)
    ms.forEach((m, i) => {
      const y = TOP + i * rowH, ok = !!p.ms[m.id], a = p.auto?.[m.id]
      dot(s, lx + 0.12, y + rowH / 2, 0.1, ok ? th.good : th.card, { line: ok ? th.good : th.line, lw: 1.5 })
      T(s, `${m.w}%`, { x: lx + 0.32, y, w: 0.45, h: rowH, fontSize: 9, bold: true, color: ok ? th.good : th.muted, valign: 'middle' })
      T(s, short(m.label, 70), { x: lx + 0.8, y, w: 3.7, h: rowH, fontSize: 9.5, color: ok ? th.ink : th.muted, valign: 'middle', bold: ok })
      if (ok && a) T(s, fmtDate(String(a).slice(0, 10)), { x: lx + 4.55, y, w: CW - 3.2 - 4.55, h: rowH, fontSize: 8, color: th.muted, valign: 'middle', align: 'right' })
    })
  }

  // ===== 11b. Kronologi keterbukaan & peristiwa penting =====
  {
    const KEY = /(transaksi material|kegiatan usaha|inbreng|HMETD|penilai|akuisisi|pengambilalihan|tender|RUPS|private placement|penempatan|pengendali|perjanjian|penambahan modal|hasil)/i
    const NOISE = /bukti iklan|panggilan RUPS|pemberitahuan RUPS|penggunaan dana hasil|public expose|laporan bulanan|volatilitas/i
    const seen = new Set()
    const evs = (d.reports || []).filter(r => r.date && KEY.test(r.title || '') && !NOISE.test(r.title || ''))
      .filter(r => { const k = String(r.title).toLowerCase().slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true }).slice(0, 9)
    if (evs.length >= 3) {
      const s = slide('Kronologi', 'Kronologi Keterbukaan Informasi', `Tercatat ${evs.length} keterbukaan informasi penting, dengan yang terbaru pada ${fmtDate(String(evs[0].date).slice(0, 10))}.`)
      const rows = [...evs].reverse(), rh = 3.35 / rows.length
      line(s, M + 1.32, TOP + 0.05, 0, 3.25, th.line, { w: 2 })
      rows.forEach((r, i) => {
        const y = TOP + i * rh
        T(s, fmtDate(String(r.date).slice(0, 10)), { x: M, y, w: 1.15, h: rh, fontSize: 8.5, bold: true, color: th.accent, valign: 'middle', align: 'right' })
        dot(s, M + 1.32, y + rh / 2, 0.07, i === rows.length - 1 ? th.accent : th.card, { line: th.accent, lw: 1.25 })
        T(s, short(calmTitle(r.title, d.name), 150), { x: M + 1.55, y, w: CW - 1.6, h: rh, fontSize: 9, color: th.ink, valign: 'middle' })
      })
    }
  }

  // ===== 11c. Perkembangan berita terkini & kesimpulannya =====
  if (d.newsSum && (d.newsRecent || []).length) {
    const ns = d.newsSum, rows = d.newsRecent
    const s = slide('Berita terkini', 'Perkembangan Berita Terkini', ns.verdict)
    const lw = 5.75, rh = Math.min(0.68, 3.35 / rows.length)
    rows.forEach(({ u, take }, i) => {
      const y = TOP + i * rh
      card(s, M, y, lw, rh - 0.08, { flat: true })
      T(s, fmtDate(String(u.date || '').slice(0, 10)), { x: M + 0.12, y: y + 0.05, w: 1.0, h: 0.22, fontSize: 8, bold: true, color: th.accent })
      pill(s, M + 1.12, y + 0.05, take.label, take.level >= 3 ? th.good : take.level === 2 ? th.warn : th.muted, { size: 7, h: 0.2 })
      T(s, short(calmTitle(u.title, d.name), 95), { x: M + 0.12, y: y + 0.27, w: lw - 0.24, h: 0.2, fontSize: 9, bold: true, color: th.ink })
      if (rh > 0.6) T(s, short(take.points[0] || '', 120), { x: M + 0.12, y: y + 0.45, w: lw - 0.24, h: 0.18, fontSize: 7.5, color: th.muted })
    })
    const rx = M + lw + 0.2, rw = CW - lw - 0.2
    const pb = (d.pa?.pembaruan || []).slice(0, 2)
    const h1 = pb.length ? 1.95 : 3.35
    card(s, rx, TOP, rw, h1)
    T(s, 'KESIMPULAN BERITA', { x: rx + 0.15, y: TOP + 0.1, w: rw - 0.3, h: 0.22, fontSize: 8, bold: true, color: th.accent, charSpacing: 2 })
    T(s, ns.paras.slice(0, 3).map(x => short(x, 170)).join('\n\n'), { x: rx + 0.15, y: TOP + 0.36, w: rw - 0.3, h: h1 - 0.45, fontSize: 8.5, color: th.ink, fit: 'shrink' })
    if (pb.length) {
      card(s, rx, TOP + 2.05, rw, 1.3, { fill: th.dark, line: th.dark })
      T(s, `PEMBARUAN ANALISA ${fmtDate(d.pa.asOf).toUpperCase()}`, { x: rx + 0.15, y: TOP + 2.13, w: rw - 0.3, h: 0.22, fontSize: 7.5, bold: true, color: th.accent2, charSpacing: 2 })
      T(s, pb.map(x => short(x, 185)).join('\n'), { x: rx + 0.15, y: TOP + 2.37, w: rw - 0.3, h: 0.92, fontSize: 7.5, color: 'FFFFFF', fit: 'shrink' })
    }
  }

  // ===== 12. Valuasi & dilusi (grafik batang harga) =====
  {
    const pa = d.pa || {}, nw = pa.nilaiWajar || {}, dl = pa.dilusi || {}
    const pts = [['Harga kini', A.price], ['Harga PTW', A.tender?.price], ['Nilai wajar bawah', nw.bawah], ['Nilai wajar atas', nw.atas], ['Nilai/saham pasca transaksi', dl.nilaiPerSaham]].filter(x => x[1] > 0)
    if (pts.length >= 2) {
      const s = slide('Valuasi dan dilusi', 'Perbandingan Harga dengan Patokan Nilai', nw.metode || dl.catatan)
      s.addChart(pres.charts.BAR, [{ name: 'Rp per saham', labels: pts.map(x => x[0]), values: pts.map(x => Math.round(x[1])) }], { ...chartBase(), x: M, y: TOP, w: 5.6, h: 3.35,
        barDir: 'col', chartColors: [th.accent], showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 9, dataLabelColor: th.ink, showLegend: false, valAxisLabelFormatCode: '#,##0',
        showTitle: true, title: 'Rupiah per saham', titleFontSize: 11, titleColor: th.ink, titleFontFace: th.body })
      const rx = M + 5.8, rw = CW - 5.8
      if (dl.berlaku && dl.porsiPublikSekarang != null && dl.porsiPublikSetelah != null) {
        card(s, rx, TOP, rw, 1.55)
        T(s, 'Porsi publik bila tidak ikut menebus', { x: rx + 0.18, y: TOP + 0.12, w: rw - 0.3, h: 0.25, fontSize: 9.5, bold: true, color: th.accent })
        T(s, `${id(dl.porsiPublikSekarang, 1)}%`, { x: rx + 0.18, y: TOP + 0.45, w: 1.2, h: 0.6, fontFace: th.head, fontSize: 24, bold: true, color: th.ink })
        line(s, rx + 1.4, TOP + 0.75, 0.45, 0, th.muted, { arrow: true, w: 2 })
        T(s, `${id(dl.porsiPublikSetelah, 1)}%`, { x: rx + 1.95, y: TOP + 0.45, w: 1.3, h: 0.6, fontFace: th.head, fontSize: 24, bold: true, color: th.bad })
        T(s, short(dl.asumsi || '', 80), { x: rx + 0.18, y: TOP + 1.08, w: rw - 0.3, h: 0.42, fontSize: 8, color: th.muted })
      }
      kpi(s, rx, TOP + 1.7, rw, 1.0, nw.bawah != null ? `${rpS(nw.bawah)}–${rpS(nw.atas)}` : '–', 'Rentang nilai wajar (pandangan analis)')
      T(s, A.price && nw.bawah ? `Harga kini ${pctS(A.price / nw.atas - 1)} dari batas atas` : '', { x: rx, y: TOP + 2.85, w: rw, h: 0.4, fontSize: 9.5, color: th.muted })
    }
  }

  // ===== 12b. Fundamental (angka laporan keuangan & valuasi) =====
  {
    const m = A.p?.metrics || {}, st = A.p?.stats || {}
    const tiles = [
      [m.pbv != null ? id(m.pbv, 2) + '×' : null, `PBV · nilai buku/saham ${rpS(m.bvps)}`, m.pbv > 3 ? th.bad : th.ink],
      [m.per != null ? id(m.per, 1) + '×' : null, `PER · EPS tahunan ${m.epsAnn != null ? id(m.epsAnn, 2) : '–'}`, m.per < 0 ? th.bad : th.ink],
      [m.equity != null ? bigS(m.equity) : null, 'Ekuitas', m.equity < 0 ? th.bad : th.ink],
      [m.cash != null ? bigS(m.cash) : null, `Kas${st.marketCap ? ' · ' + id(m.cash / st.marketCap * 100, 1) + '% kapitalisasi' : ''}`, th.ink],
      [m.assets != null ? bigS(m.assets) : null, 'Total aset', th.ink],
      [m.revGrowth ? pctId(m.revGrowth) : null, 'Pertumbuhan pendapatan (YoY)', /^-/.test(m.revGrowth || '') ? th.bad : th.good],
      [m.netMargin ? pctId(m.netMargin) : null, 'Margin laba bersih', /^-/.test(m.netMargin || '') ? th.bad : th.good],
      [m.ret1y ? pctId(m.ret1y) : null, `Kinerja harga 1 tahun · 52 minggu ${rpS(m.low52)}–${rpS(m.high52)}`, /^-/.test(m.ret1y || '') ? th.bad : th.good],
    ].filter(t => t[0] != null)
    if (tiles.length >= 4) {
      const nw = d.pa?.nilaiWajar
      const s = slide('Fundamental', 'Indikator Keuangan dan Valuasi', nw ? `Nilai wajar kasar berada pada rentang ${rpS(nw.bawah)}–${rpS(nw.atas)}, dibandingkan harga saat ini ${rpS(A.price)}. ${nw.metode || ''}` : '')
      const w4 = (CW - 0.45) / 4, rowsN = Math.ceil(tiles.length / 4), h = rowsN > 1 ? 1.6 : 2.0
      tiles.slice(0, 8).forEach(([v, l, col], i) => kpi(s, M + (i % 4) * (w4 + 0.15), TOP + Math.floor(i / 4) * (h + 0.15), w4, h, v, l, col))
    }
  }

  // ===== 13. Harga 1 tahun & posisi siklus (grafik garis) =====
  if (d.tech?.bars?.length) {
    const B = d.tech.bars, step = Math.max(1, Math.round(B.length / 60)), sm = B.filter((_, i) => i % step === 0 || i === B.length - 1)
    const labels = sm.map(b => fmtDate(b.d).replace(/ 20(\d\d)$/, " '$1")), close = sm.map(b => b.c)
    const series = [{ name: 'Harga penutupan', labels, values: close }]
    if (A.tender?.price) series.push({ name: 'Harga PTW', labels, values: sm.map(() => A.tender.price) })
    const cyc = d.cyc, ph = cyc ? phaseName(cyc.ph) : ''
    const s = slide('Harga dan siklus', ph ? `Posisi dalam Siklus: ${ph}` : 'Pergerakan Harga Satu Tahun Terakhir', cyc ? `${cyc.day} hari sejak PTW; puncak median kasus serupa ${cyc.model.peakDay != null ? Math.abs(Math.round(cyc.model.peakDay)) + ' hari ' + (cyc.model.peakDay < 0 ? 'sebelum' : 'sesudah') + ' PTW' : '–'}.` : d.tech.verdict)
    s.addChart(pres.charts.LINE, series, { ...chartBase(), x: M, y: TOP, w: 6.3, h: 3.35, lineSize: 2, lineDataSymbol: 'none', chartColors: [th.accent, th.warn],
      showLegend: true, legendPos: 'b', catAxisLabelFrequency: Math.max(1, Math.round(sm.length / 6)), valAxisLabelFormatCode: '#,##0',
      showTitle: true, title: 'Harga harian 1 tahun (Rp)', titleFontSize: 11, titleColor: th.ink, titleFontFace: th.body })
    const hi = Math.max(...B.map(b => b.h)), lo = Math.min(...B.map(b => b.l)), c = B[B.length - 1].c
    const rx = M + 6.5, rw = CW - 6.5
    kpi(s, rx, TOP, rw, 1.0, A.tender?.price ? pctS(c / A.tender.price - 1) : '–', 'Harga kini vs harga PTW', A.tender?.price && c < A.tender.price ? th.bad : th.good)
    kpi(s, rx, TOP + 1.15, rw, 1.0, `${rpS(lo)}–${rpS(hi)}`, 'Rentang terendah–tertinggi setahun')
    T(s, 'Posisi dalam rentang setahun', { x: rx, y: TOP + 2.35, w: rw, h: 0.22, fontSize: 9, bold: true, color: th.accent })
    hbar(s, rx, TOP + 2.65, rw, (c - lo) / ((hi - lo) || 1), th.accent, 0.16)
    T(s, `${Math.round((c - lo) / ((hi - lo) || 1) * 100)}% dari dasar ke puncak`, { x: rx, y: TOP + 2.88, w: rw, h: 0.25, fontSize: 9, color: th.muted })
  }

  // ===== 14. Skenario harga (tangga level) =====
  if ((A.levels || []).length && A.price) {
    const lv = A.levels.slice(0, 5)
    const s = slide('Skenario', 'Analisis Skenario Harga', A.rr != null ? `Dari harga saat ini (${rpS(A.price)}), rasio imbal hasil terhadap risiko adalah ${id(A.rr, 1)} : 1.` : '')
    // Batang divergen: tiap level satu baris (tertinggi di atas); hijau ke kanan = naik, merah ke kiri = turun dari harga kini.
    const rows = [...lv.map(l => ({ k: l[0], why: l[1], v: l[2] })), { k: 'Harga kini', why: A.priceDate ? fmtDate(A.priceDate) : '', v: A.price, now: true }]
      .sort((a, b) => b.v - a.v)
    const maxAbs = Math.max(...rows.map(r => Math.abs(r.v / A.price - 1)), 0.05)
    const lblW = 3.3, axis = M + lblW + 1.0 + (CW - lblW - 1.0) / 2, half = (CW - lblW - 1.0) / 2 - 0.65
    const rh = Math.min(0.6, 3.3 / rows.length)
    line(s, axis, TOP - 0.05, 0, rows.length * rh + 0.05, th.ink, { w: 1.25 })
    rows.forEach((r, i) => {
      const y = TOP + i * rh, ch = r.v / A.price - 1, c = r.now ? th.dark : ch >= 0 ? th.good : th.bad
      T(s, r.k, { x: M, y: y + 0.02, w: lblW, h: 0.22, fontSize: 10, bold: true, color: r.now ? th.ink : th.ink })
      T(s, short(r.why, 60), { x: M, y: y + 0.24, w: lblW, h: 0.22, fontSize: 8, color: th.muted })
      T(s, rpS(r.v), { x: M + lblW, y: y + 0.08, w: 0.95, h: 0.3, fontSize: 12, bold: true, color: c, align: 'right' })
      if (r.now) { dot(s, axis, y + rh / 2 - 0.04, 0.11, th.dark); return }
      const bw = Math.max(0.05, Math.abs(ch) / maxAbs * half)
      s.addShape(S.RECTANGLE, { x: ch >= 0 ? axis : axis - bw, y: y + 0.1, w: bw, h: rh - 0.24, fill: { color: c, transparency: 15 }, line: { color: c, width: 0.25 } })
      T(s, pctS(ch), { x: ch >= 0 ? axis + bw + 0.06 : axis - bw - 0.66, y: y + 0.08, w: 0.6, h: 0.3, fontSize: 10, bold: true, color: c, align: ch >= 0 ? 'left' : 'right' })
    })
  }

  // ===== 15. Teknikal (meteran sinyal + indikator) =====
  if (d.tech) {
    const { sig, verdict } = d.tech
    const s = slide('Teknikal', `Analisis Teknikal: Sinyal ${sig.sig?.[0] || '–'}`, verdict)
    // Meteran −6..+6 dalam 5 ruas warna.
    const gx = M, gw = 5.2, gy = TOP + 0.3
    const seg = [th.bad, 'E8888F', th.line, '8FD1AE', th.good], segW = gw / 5
    seg.forEach((c, i) => s.addShape(S.RECTANGLE, { x: gx + i * segW, y: gy, w: segW - 0.03, h: 0.3, fill: { color: c }, line: { color: c, width: 0.25 } }))
    ;['Jual kuat', 'Jual', 'Netral', 'Beli', 'Beli kuat'].forEach((t, i) => T(s, t, { x: gx + i * segW, y: gy + 0.36, w: segW, h: 0.2, fontSize: 8, align: 'center', color: th.muted }))
    const mx = gx + (sig.score + 6) / 12 * gw
    s.addShape(S.ISOSCELES_TRIANGLE, { x: mx - 0.12, y: gy - 0.28, w: 0.24, h: 0.22, rotate: 180, fill: { color: th.ink }, line: { color: th.ink, width: 0.5 } })
    T(s, `${sig.score > 0 ? '+' : ''}${sig.score} dari ±6`, { x: gx, y: gy + 0.62, w: gw, h: 0.3, fontSize: 12, bold: true, align: 'center' })
    // Suara tiap indikator sebagai kartu kecil.
    ;(sig.votes || []).slice(0, 6).forEach((v, i) => {
      const cw = (gw - 0.3) / 3, x = gx + (i % 3) * (cw + 0.15), y = TOP + 1.45 + Math.floor(i / 3) * 0.95, c = v.s > 0 ? th.good : v.s < 0 ? th.bad : th.muted
      card(s, x, y, cw, 0.82)
      T(s, v.k, { x: x + 0.12, y: y + 0.08, w: cw - 0.24, h: 0.22, fontSize: 9, bold: true })
      pill(s, x + 0.12, y + 0.33, v.s > 0 ? 'Beli' : v.s < 0 ? 'Jual' : 'Netral', c, { size: 8, h: 0.2, w: 0.65 })
      T(s, short(v.txt, 40), { x: x + 0.12, y: y + 0.56, w: cw - 0.24, h: 0.24, fontSize: 7, color: th.muted })
    })
    const rx = M + 5.5, rw = CW - 5.5
    ;[['Resistance terdekat', sig.res, th.bad], ['Support terdekat', sig.sup, th.good], ['Batas invalidasi', sig.stop, th.warn]].forEach(([l, v, c], i) =>
      kpi(s, rx, TOP + i * 1.12, rw, 1.0, rpS(v), `${l}${v && d.tech.bars ? ' · ' + pctS(v / d.tech.bars[d.tech.bars.length - 1].c - 1, 1) : ''}`, c))
  }

  // ===== 16. Pola chart, candlestick, divergensi =====
  if (d.tech?.PA) {
    const PA = d.tech.PA, act = PA.active.slice(0, 3)
    const st = d.tech.struct
    const s = slide('Pola grafik', act.length ? `Teridentifikasi ${act.length} Pola Grafik Aktif` : 'Tidak Terdapat Pola Grafik Aktif', st?.sig ? `Struktur harga ${st.sig[0].toLowerCase()}${st.why?.[0] ? ': ' + st.why[0][1] : ''}` : '')
    const cw = (CW - 0.3) / 3
    act.forEach((p, i) => {
      const x = M + i * (cw + 0.15), y = TOP, bull = p.bias > 0, c = bull ? th.good : th.bad
      card(s, x, y, cw, 2.35)
      s.addShape(S.ROUNDED_RECTANGLE, { x, y, w: cw, h: 0.5, rectRadius: 0.07, fill: { color: c }, line: { color: c, width: 0.5 } })
      T(s, p.name, { x: x + 0.15, y, w: cw - 0.3, h: 0.5, fontSize: 12, bold: true, color: 'FFFFFF', valign: 'middle', fit: 'shrink' })
      T(s, `${bull ? 'Bullish' : 'Bearish'} · ${ptStatusTxt(p)}`, { x: x + 0.15, y: y + 0.6, w: cw - 0.3, h: 0.22, fontSize: 9, bold: true, color: c })
      const rows = [['Level pemicu', rpS(p.trigNow)], ['Target', rpS(p.target)], ['Invalidasi', rpS(p.inv)]]
      rows.forEach(([k, v], j) => { T(s, k, { x: x + 0.15, y: y + 0.92 + j * 0.3, w: 1.3, h: 0.25, fontSize: 9, color: th.muted }); T(s, v, { x: x + cw - 1.35, y: y + 0.92 + j * 0.3, w: 1.2, h: 0.25, fontSize: 10, bold: true, align: 'right' }) })
      T(s, `Keyakinan ${p.conf}% · ${confLvl(p.conf)}`, { x: x + 0.15, y: y + 1.85, w: cw - 0.3, h: 0.2, fontSize: 8.5, bold: true })
      hbar(s, x + 0.15, y + 2.08, cw - 0.3, p.conf / 100, p.conf >= 70 ? th.good : p.conf >= 50 ? th.warn : th.bad, 0.12)
    })
    if (!act.length) {
      // Tanpa pola aktif: tampilkan level kunci (Fibonacci & volume profile) agar slide tetap bermakna.
      const lv = d.tech.lv || {}, vp = lv.vp || {}, c0 = d.tech.bars[d.tech.bars.length - 1].c
      const keys = [[`Fib ${lv.below?.lbl || ''}`.trim(), lv.below?.p, 'support Fibonacci terdekat', th.good], [`Fib ${lv.above?.lbl || ''}`.trim(), lv.above?.p, 'resistance Fibonacci terdekat', th.bad],
        ['POC', vp.pocP, 'harga dengan volume terbesar', th.accent], ['VAL – VAH', vp.val && vp.vah ? null : undefined, 'area nilai 70% volume', th.accent]].filter(k => k[1] !== undefined)
      T(s, 'Belum ada pola chart aktif. Level kunci yang dipantau:', { x: M, y: TOP, w: CW, h: 0.25, fontSize: 10.5, bold: true, color: th.muted })
      keys.forEach(([k, v, l, c], i) => {
        const w = CW / keys.length - 0.12, x = M + i * (w + 0.16)
        const val = k === 'VAL – VAH' ? `${rpS(vp.val)}–${rpS(vp.vah)}` : rpS(v)
        kpi(s, x, TOP + 0.35, w, 1.15, val, `${k} · ${l}${v ? ' · ' + pctS(v / c0 - 1, 1) : ''}`, c)
      })
      const why = (st?.why || []).slice(0, 2)
      why.forEach(([w, t], i) => T(s, [{ text: w > 0 ? '▲ ' : '▼ ', options: { color: w > 0 ? th.good : th.bad, bold: true } }, { text: short(t, 110) }], { x: M, y: TOP + 1.65 + i * 0.3, w: CW, h: 0.28, fontSize: 9.5 }))
    }
    // Candlestick & divergensi terbaru sebagai chip.
    const chips = [...PA.candles.slice(-4).reverse().filter(k => k.bias).map(k => ({ t: `${k.n} · ${fmtDate(d.tech.bars[k.i].d)}`, c: k.bias > 0 ? th.good : th.bad })),
      ...PA.divs.filter(v => v.active).slice(0, 2).map(v => ({ t: `Divergensi ${v.name.toLowerCase()} ${v.ind}`, c: v.bias > 0 ? th.good : th.bad }))].slice(0, 6)
    if (chips.length) {
      T(s, 'Sinyal pendukung terbaru', { x: M, y: TOP + 2.5, w: CW, h: 0.22, fontSize: 9.5, bold: true, color: th.accent })
      let cx = M, cy = TOP + 2.8
      chips.forEach(ch => { const w = Math.min(4.3, 0.2 + ch.t.length * 0.062); if (cx + w > M + CW) { cx = M; cy += 0.3 } pill(s, cx, cy, ch.t, ch.c, { size: 8, w, h: 0.24 }); cx += w + 0.1 })
    }
  }

  // ===== 17. Trading plan (tangga harga) =====
  if (d.tech?.plan) {
    const pl = d.tech.planPola || d.tech.plan, c = d.tech.bars[d.tech.bars.length - 1].c
    const s = slide('Rencana transaksi', short(pl.type || 'Rencana Transaksi', 54), d.rec?.holder || pl.note)
    const vals = [pl.stop, pl.entryLo, pl.entryHi, pl.tp1, pl.tp2, c].filter(v => v > 0)
    if (pl.entry && vals.length >= 3) {
      const lo = Math.min(...vals) * 0.97, hi = Math.max(...vals) * 1.03, x0 = M + 0.2, x1 = M + CW - 0.2, X = v => x0 + (v - lo) / (hi - lo) * (x1 - x0), y = TOP + 0.9
      line(s, x0, y, x1 - x0, 0, th.line, { w: 4 })
      s.addShape(S.RECTANGLE, { x: X(pl.entryLo), y: y - 0.2, w: Math.max(0.06, X(pl.entryHi) - X(pl.entryLo)), h: 0.4, fill: { color: th.accent, transparency: 55 }, line: { color: th.accent, width: 0.5 } })
      const marks = [['Stop', pl.stop, th.bad], ['Entry', pl.entry, th.accent], ['Target 1', pl.tp1, th.good], ['Target 2', pl.tp2, th.good]]
      marks.forEach(([l, v, col], i) => { if (!(v > 0)) return; const x = X(v); line(s, x, y - 0.35, 0, 0.7, col, { w: 2 }); T(s, l, { x: x - 0.6, y: i % 2 ? y + 0.42 : y - 0.68, w: 1.2, h: 0.2, fontSize: 9, bold: true, color: col, align: 'center' }); T(s, rpS(v), { x: x - 0.6, y: i % 2 ? y + 0.62 : y - 0.48, w: 1.2, h: 0.2, fontSize: 9.5, bold: true, align: 'center' }) })
      dot(s, X(c), y, 0.09, th.dark)
    }
    if (pl.entry) {
      const rows = [['Zona entry', `${rpS(pl.entryLo)}–${rpS(pl.entryHi)}`], ['Stop loss', `${rpS(pl.stop)} (${pctS(pl.stop / pl.entry - 1, 1)})`],
        ['Target 1', pl.tp1 ? `${rpS(pl.tp1)} (${pctS(pl.tp1 / pl.entry - 1, 1)})` : '–'], ['Target 2', pl.tp2 ? `${rpS(pl.tp2)} (${pctS(pl.tp2 / pl.entry - 1, 1)})` : '–']]
      rows.forEach(([k, v], i) => kpi(s, M + i * (CW / 4), TOP + 2.0, CW / 4 - 0.15, 1.2, v, k, i === 1 ? th.bad : i >= 2 ? th.good : th.accent))
    } else {
      // Tanpa setup beli: rencana bagi pemegang — area jual saat rebound, batas keluar, dan syarat masuk kembali.
      const sig = d.tech.sig
      kpi(s, M, TOP, CW / 3 - 0.1, 1.3, rpS(sig.res), `Area kurangi posisi saat rebound · ${pctS(sig.res / c - 1, 1)}`, th.warn)
      kpi(s, M + CW / 3 + 0.05, TOP, CW / 3 - 0.1, 1.3, rpS(pl.stop), `Keluar penuh bila ditutup di bawah · ${pctS(pl.stop / c - 1, 1)}`, th.bad)
      kpi(s, M + 2 * CW / 3 + 0.1, TOP, CW / 3 - 0.1, 1.3, rpS(c), 'Harga kini', th.ink)
      T(s, 'Syarat masuk kembali', { x: M, y: TOP + 1.55, w: CW, h: 0.25, fontSize: 11, bold: true, color: th.accent })
      ;['Parabolic SAR berbalik ke bawah harga', 'MACD memotong ke atas garis sinyal', `Harga ditutup di atas ${rpS(sig.res)} dengan volume ≥ 1,5× rata-rata`].forEach((t, i) => {
        const x = M + i * (CW / 3 + 0.05), w = CW / 3 - 0.1
        card(s, x, TOP + 1.9, w, 0.9, { flat: true })
        dot(s, x + 0.3, TOP + 2.35, 0.15, th.accent)
        T(s, String(i + 1), { x: x + 0.15, y: TOP + 2.2, w: 0.3, h: 0.3, fontSize: 10, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
        T(s, t, { x: x + 0.6, y: TOP + 1.95, w: w - 0.7, h: 0.8, fontSize: 9.5, valign: 'middle' })
      })
    }
  }

  // ===== 18. Red flags vs catalysts =====
  if (d.pc && (d.pc.pros.length || d.pc.cons.length)) {
    const { pros, cons } = d.pc
    const s = slide('Temuan', 'Faktor Pendukung dan Faktor Risiko', `Teridentifikasi ${pros.length} faktor pendukung dan ${cons.length} faktor risiko${cons.length > pros.length ? '; faktor risiko lebih dominan' : ''}.`)
    ;[[cons, 'Red flags (tanda bahaya)', th.bad, '!'], [pros, 'Catalysts (pemicu positif)', th.good, '✓']].forEach(([list, head, c, ic], k) => {
      const x = M + k * (CW / 2 + 0.08), w = CW / 2 - 0.08
      card(s, x, TOP, w, 3.35)
      s.addShape(S.ROUNDED_RECTANGLE, { x, y: TOP, w, h: 0.5, rectRadius: 0.07, fill: { color: c }, line: { color: c, width: 0.5 } })
      dot(s, x + 0.32, TOP + 0.25, 0.15, 'FFFFFF')
      T(s, ic, { x: x + 0.17, y: TOP + 0.1, w: 0.3, h: 0.3, fontSize: 11, bold: true, color: c, align: 'center', valign: 'middle' })
      T(s, head, { x: x + 0.6, y: TOP, w: w - 0.7, h: 0.5, fontSize: 12.5, bold: true, color: 'FFFFFF', valign: 'middle' })
      // Judul tebal + rincian singkat abu-abu; rincian dibuang bila poin banyak agar tetap muat.
      const items = list.slice(0, 7), detail = items.length <= 5, runs = []
      items.forEach((p, i) => {
        const last = i === items.length - 1, hasD = detail && !!p.d
        runs.push({ text: short(p.t, 62), options: { bold: true, bullet: { indent: 12 }, breakLine: hasD || !last, paraSpaceAfter: hasD ? 0 : 6 } })
        if (hasD) runs.push({ text: short(p.d, 95), options: { fontSize: 8.5, color: th.muted, indentLevel: 1, breakLine: !last, paraSpaceAfter: 6 } })
      })
      T(s, runs.length ? runs : 'Tidak ada yang menonjol.', { x: x + 0.2, y: TOP + 0.65, w: w - 0.4, h: 2.6, fontSize: 10 })
    })
  }

  // ===== 19. Sudut pandang mendalam (ubin bernomor) =====
  if ((d.deep || []).length) {
    const items = d.deep.slice(0, 6)
    const s = slide('Pembahasan', 'Pembahasan Temuan Utama', items[items.length - 1]?.[1])
    const cols = 3, cw = (CW - 0.3) / cols, ch = items.length > 3 ? 1.6 : 3.2
    items.forEach(([h, t], i) => {
      const x = M + (i % cols) * (cw + 0.15), y = TOP + Math.floor(i / cols) * (ch + 0.12)
      card(s, x, y, cw, ch)
      dot(s, x + 0.3, y + 0.3, 0.17, th.accent)
      T(s, String(i + 1), { x: x + 0.13, y: y + 0.13, w: 0.34, h: 0.34, fontSize: 11, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
      T(s, h, { x: x + 0.58, y: y + 0.12, w: cw - 0.7, h: 0.38, fontSize: 9.5, bold: true, fit: 'shrink' })
      T(s, short(t, ch > 2 ? 420 : 220), { x: x + 0.15, y: y + 0.55, w: cw - 0.3, h: ch - 0.65, fontSize: 8.5, color: th.muted })
    })
  }

  // ===== 20. Yang harus terjadi vs sinyal keluar =====
  {
    const pa = d.pa || {}
    const good = [...(A.checks || []), ...(pa.variabelKunci || [])].slice(0, 5), bad = [...(A.exits || []), ...(pa.tesisSalahBila || [])].slice(0, 5)
    if (good.length || bad.length) {
      const s = slide('Indikator pemantauan', 'Syarat Keberhasilan dan Sinyal Keluar', 'Bukti pelaksanaan transaksi perlu dipantau; posisi sebaiknya dilepas apabila salah satu sinyal keluar muncul.')
      ;[[good, 'Yang harus terjadi agar tesis benar', th.good, '✓'], [bad, 'Sinyal keluar / tesis salah bila', th.bad, '✕']].forEach(([list, head, c, ic], k) => {
        const x = M + k * (CW / 2 + 0.08), w = CW / 2 - 0.08
        T(s, head, { x, y: TOP, w, h: 0.3, fontSize: 12, bold: true, color: c })
        list.forEach((t, i) => {
          const y = TOP + 0.42 + i * 0.58
          card(s, x, y, w, 0.5, { flat: true })
          dot(s, x + 0.25, y + 0.25, 0.13, c)
          T(s, ic, { x: x + 0.12, y: y + 0.12, w: 0.26, h: 0.26, fontSize: 9, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
          T(s, short(t, 140), { x: x + 0.5, y: y + 0.03, w: w - 0.6, h: 0.44, fontSize: 8.5, valign: 'middle' })
        })
      })
    }
  }

  // ===== 20b. Rencana aksi: bila terkonfirmasi / sekarang / bila gagal =====
  if (d.rec) {
    const rc = d.rec
    const s = slide('Rencana tindakan', 'Rencana Tindakan Berdasarkan Skenario', rc.catalyst ? `Katalis berikutnya adalah ${rc.catalyst}.` : rc.holder)
    const cw = (CW - 0.3) / 3
    const tg = rc.targets.map(t => `${rpS(t.p)} (${t.l})`)
    ;[
      ['BILA TERKONFIRMASI', th.good, 'Syarat:', rc.triggers.slice(0, 3), `Tindakan: ${rc.tier === 'akumulasi' ? 'tambah posisi bertahap' : 'mulai posisi kecil'}${rc.entry ? ` di area ${rc.entry[1] ? rpS(rc.entry[0]) + '–' + rpS(rc.entry[1]) : 'di atas ' + rpS(rc.entry[0])}` : ''}; target ${tg[0] || '–'}.`],
      ['KONDISI SEKARANG', recTone(rc.tone), 'Rekomendasi:', [rc.label, `Porsi: ${rc.porsi}`, `Profil risiko: ${rc.profil}`], rc.holder],
      ['BILA TESIS GAGAL', th.bad, 'Sinyal keluar:', rc.exits, `Tindakan: keluar/hindari; batas risiko ${rpS(rc.stop)}.`],
    ].forEach(([h, col, sub, list, act], i) => {
      const x = M + i * (cw + 0.15)
      card(s, x, TOP, cw, 3.35)
      s.addShape(S.RECTANGLE, { x, y: TOP, w: cw, h: 0.08, fill: { color: col }, line: { color: col, width: 0 } })
      T(s, h, { x: x + 0.18, y: TOP + 0.2, w: cw - 0.36, h: 0.22, fontSize: 8.5, bold: true, color: col, charSpacing: 2 })
      T(s, sub, { x: x + 0.18, y: TOP + 0.48, w: cw - 0.36, h: 0.2, fontSize: 8, bold: true, color: th.muted })
      T(s, (list.length ? list : ['belum ada']).map((t, k, a) => ({ text: short(t, 120), options: { bullet: { indent: 10 }, breakLine: k < a.length - 1, paraSpaceAfter: 3 } })),
        { x: x + 0.18, y: TOP + 0.7, w: cw - 0.36, h: 1.75, fontSize: 8.5, color: th.ink })
      T(s, short(act, 170), { x: x + 0.18, y: TOP + 2.5, w: cw - 0.36, h: 0.78, fontSize: 8.5, bold: true, color: th.ink })
    })
  }

  // ===== 21. Kesimpulan (gelap) =====
  {
    const pa = d.pa || {}
    const s = pres.addSlide(); K.bump()
    s.background = { color: th.dark }
    coverArt(s, d.sector?.motif, th, S, dot, line, true)
    T(s, 'SIMPULAN', { x: 0.7, y: 0.6, w: 5, h: 0.3, fontSize: 10, bold: true, color: th.accent2, charSpacing: 5 })
    T(s, short(pa.sikap || A.stance?.t || 'Kesimpulan', 40), { x: 0.7, y: 0.95, w: 6.2, h: 0.8, fontFace: th.head, fontSize: 34, bold: true, color: 'FFFFFF', valign: 'middle', fit: 'shrink' })
    const pts = [pa.ringkas, A.stance?.t, d.pos?.next ? 'Berikutnya: ' + d.pos.next : null, (pa.variabelKunci || [])[0] ? 'Kunci: ' + pa.variabelKunci[0] : null].filter(Boolean).slice(0, 4)
    pts.forEach((p, i) => {
      const y = 2.0 + i * 0.62
      dot(s, 0.85, y + 0.17, 0.08, th.accent2)
      T(s, short(p, 100), { x: 1.1, y, w: 5.3, h: 0.55, fontSize: 11.5, color: 'F8FAFC' })
    })
    T(s, `${d.rec ? 'Rekomendasi: ' + d.rec.label + '  ·  ' : ''}Skor ${A.score ?? '–'}/100  ·  Harga ${rpS(A.price)}`, { x: 0.7, y: 4.65, w: 6.2, h: 0.3, fontSize: 11, bold: true, color: th.accent2 })
    T(s, 'Kajian ini disusun secara otomatis berdasarkan aturan dari data Stockbit dan sumber publik. Isinya merupakan kerangka analisis, bukan anjuran membeli atau menjual efek.', { x: 0.7, y: 5.0, w: 6.5, h: 0.3, fontSize: 8.5, color: 'DCE7F3' })
  }

  // ===== 22. Lampiran: sumber & batasan =====
  {
    const pf = d.profil || {}
    const src = [...new Set([...(pf.pengendali || []).flatMap(o => o.sumber || []), ...(pf.afiliasi?.sumber || []), ...(d.aset?.sumber ? [].concat(d.aset.sumber) : [])])].slice(0, 7)
    const reps = (d.reports || []).slice(0, 6).map(r => `${fmtDate(String(r.date).slice(0, 10))} · ${r.title}`)
    const gaps = (pf.tidakDitemukan || []).slice(0, 6)
    const s = slide('Lampiran', 'Sumber Data dan Keterbatasan Kajian', '')
    ;[['Sumber riset', src], ['Keterbukaan informasi terbaru', reps], ['Belum ditemukan di sumber publik', gaps]].forEach(([h, list], k) => {
      const x = M + k * (CW / 3), w = CW / 3 - 0.15
      card(s, x, TOP, w, 3.75)
      T(s, h, { x: x + 0.15, y: TOP + 0.12, w: w - 0.3, h: 0.25, fontSize: 10, bold: true, color: th.accent })
      T(s, list.length ? list.map((t, i) => ({ text: short(t, 95), options: { bullet: { indent: 12 }, breakLine: i < list.length - 1, paraSpaceAfter: 4 } })) : 'belum ada',
        { x: x + 0.15, y: TOP + 0.45, w: w - 0.3, h: 3.2, fontSize: 8, color: th.muted })
    })
  }
  return pres
}

// Garis dari (x,y) sejauh (w,h). PowerPoint menolak ukuran negatif (berkas dianggap rusak), jadi arah
// ke kiri/atas dinyatakan dengan flipH/flipV dan kotak garisnya dinormalkan.
function lineShape(s, S, x, y, w, h, color, o = {}) {
  const flipH = w < 0, flipV = h < 0
  return s.addShape(S.LINE, { x: flipH ? x + w : x, y: flipV ? y + h : y, w: Math.abs(w), h: Math.abs(h), flipH, flipV,
    line: { color, width: o.w || 1.25, dashType: o.dash || 'solid', endArrowType: o.arrow ? 'triangle' : undefined, transparency: o.tr || 0 } })
}

// Motif sampul sesuai sektor bisnis (bentuk sederhana, warna aksen tema).
function coverArt(s, motif, th, S, dot, line, small = false) {
  // Versi kecil (slide kesimpulan) digeser ke kanan agar tidak menabrak teks.
  const cx = small ? 8.55 : 7.6, cy = 2.8, k = small ? 0.62 : 1
  const a = th.accent, b = th.accent2
  switch (motif) {
    case 'strata':
      for (let i = 0; i < 6; i++) s.addShape(S.RECTANGLE, { x: cx - 2.2 * k + i * 0.12, y: cy - 1.6 * k + i * 0.55 * k, w: (4.4 - i * 0.24) * k, h: 0.38 * k, fill: { color: i % 2 ? a : b, transparency: 30 + i * 10 }, line: { color: a, width: 0.5, transparency: 60 } })
      break
    case 'hex':
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) s.addShape(S.HEXAGON, { x: cx - 1.9 * k + c * 1.25 * k + (r % 2) * 0.62 * k, y: cy - 1.7 * k + r * 1.08 * k, w: 1.15 * k, h: 1.0 * k, fill: { color: (r + c) % 3 ? a : b, transparency: (r + c) % 3 ? 55 : 20 }, line: { color: b, width: 1 } })
      break
    case 'rings':
      ;[2.2, 1.65, 1.1].forEach((r, i) => dot(s, cx, cy, r * k, a, { tr: 100, line: i ? a : b, lw: 1.5, ltr: 20 * i }))
      dot(s, cx, cy, 0.55 * k, b, { tr: 10 })
      for (let i = 0; i < 8; i++) { const ang = i * Math.PI / 4; line(s, cx + Math.cos(ang) * 0.7 * k, cy + Math.sin(ang) * 0.7 * k, Math.cos(ang) * 0.35 * k, Math.sin(ang) * 0.35 * k, b, { w: 2 }) }
      break
    case 'plus':
      ;[[0, 0, 1.6], [-1.6, -1.1, 0.8], [1.5, 1.2, 0.9], [1.4, -1.4, 0.55]].forEach(([dx, dy, z], i) => s.addShape(S.MATH_PLUS, { x: cx + dx * k - z * k / 2, y: cy + dy * k - z * k / 2, w: z * k, h: z * k, fill: { color: i ? a : b, transparency: i ? 40 : 0 }, line: { color: b, width: 0.5 } }))
      dot(s, cx, cy, 1.9 * k, a, { tr: 100, line: a, lw: 1.5 })
      break
    case 'network':
      ;[2.2, 1.6, 1.0].forEach(r => dot(s, cx, cy, r * k, a, { tr: 100, line: a, lw: 1.25 }))
      dot(s, cx, cy, 0.5 * k, a, { line: b, lw: 2 })
      ;[[-1.7, -1.4], [1.4, -1.6], [2.1, 0.5], [-1.4, 1.6], [1.0, 1.9], [-2.1, 0.2]].forEach(([dx, dy]) => { line(s, cx, cy, dx * k, dy * k, a, { dash: 'dash', w: 0.75 }); dot(s, cx + dx * k, cy + dy * k, 0.1 * k, b) })
      break
    case 'bars':
      ;[0.9, 1.4, 1.2, 2.0, 2.6, 3.2].forEach((h, i) => s.addShape(S.RECTANGLE, { x: cx - 2.0 * k + i * 0.68 * k, y: cy + 1.6 * k - h * k, w: 0.5 * k, h: h * k, fill: { color: i === 5 ? b : a, transparency: i === 5 ? 0 : 35 }, line: { color: a, width: 0.5 } }))
      line(s, cx - 2.1 * k, cy + 1.0 * k, 4.2 * k, -2.3 * k, b, { w: 2.5, arrow: true })
      break
    case 'waves':
      for (let i = 0; i < 5; i++) s.addShape(S.WAVE, { x: cx - 2.3 * k, y: cy - 1.5 * k + i * 0.62 * k, w: 4.6 * k, h: 0.55 * k, fill: { color: i % 2 ? a : b, transparency: 25 + i * 12 }, line: { color: a, width: 0.5, transparency: 50 } })
      break
    case 'blocks':
      ;[[0, 2.6], [0.75, 1.8], [1.5, 3.2], [2.25, 2.2], [3.0, 1.4]].forEach(([dx, h], i) => {
        s.addShape(S.RECTANGLE, { x: cx - 1.85 * k + dx * k, y: cy + 1.6 * k - h * k, w: 0.62 * k, h: h * k, fill: { color: i === 2 ? b : a, transparency: i === 2 ? 0 : 30 }, line: { color: b, width: 0.5 } })
        for (let w = 0; w < Math.floor(h / 0.45); w++) s.addShape(S.RECTANGLE, { x: cx - 1.75 * k + dx * k, y: cy + 1.45 * k - h * k + 0.25 * k + w * 0.42 * k, w: 0.12 * k, h: 0.16 * k, fill: { color: th.dark, transparency: 30 }, line: { color: th.dark, width: 0.25 } })
      })
      break
    case 'dots':
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { const z = 0.12 + ((r * 3 + c * 7) % 5) * 0.06; dot(s, cx - 1.8 * k + c * 0.9 * k, cy - 1.8 * k + r * 0.9 * k, z * k, (r + c) % 3 ? a : b, { tr: (r + c) % 3 ? 30 : 0 }) }
      break
    default:
      for (let i = 0; i < 5; i++) { line(s, cx - 2 * k + i * k, cy - 2 * k, 0, 4 * k, a, { w: 0.75, tr: 40 }); line(s, cx - 2 * k, cy - 2 * k + i * k, 4 * k, 0, a, { w: 0.75, tr: 40 }) }
      ;[[0, 0], [1, -1], [-1, 1], [2, 1], [-2, -1]].forEach(([dx, dy], i) => dot(s, cx + dx * k, cy + dy * k, (i ? 0.12 : 0.3) * k, i ? b : a))
  }
}

// Presentasi khusus analisa penambahan modal (PMHMETD/PMTHMETD/merger), bukan presentasi analisa lengkap.
// d: { t, name, date, sector, A, c, P, U } dengan c = riCase(...), P = harga pelaksanaan, U = % publik menebus
// (0–100), sama seperti simulasi di layar.
export function buildRiDeck(PptxGenJS, d, th) {
  const c = d.c
  const K = makeKit(PptxGenJS, d, th, `${d.t}: Kajian ${c.label}`)
  const { pres, S, T, card, pill, dot, line, chartBase, slide, kpi, hbar } = K
  const P = d.P, u = (d.U || 0) / 100
  const r = riCalc(c, P, u)
  const nr = noRights(c), det = c.detail
  const pc = v => v == null || isNaN(v) ? '–' : id(v * 100, v < 0.1 ? 2 : 1) + '%'
  const shS = v => v == null ? '–' : v >= 1e9 ? id(v / 1e9, 2) + ' miliar' : id(v / 1e6, 0) + ' jt'
  const B = v => Math.round(v / 1e9 * 10) / 10
  const verdict = riVerdict(c, r)
  const fund = riFunding(c, r)
  const STATUS = { rencana: 'Rencana', berjalan: 'Berjalan', tereksekusi: 'Sudah tereksekusi' }
  const what = nr ? (c.kind === 'merger' ? 'penerbitan merger' : 'PMTHMETD') : 'rights issue'

  // ===== 1. Sampul =====
  {
    const s = pres.addSlide(); K.bump()
    s.background = { color: th.dark }
    coverArt(s, d.sector?.motif, th, S, dot, line)
    T(s, 'KAJIAN PENAMBAHAN MODAL', { x: 0.7, y: 1.0, w: 5.2, h: 0.3, fontSize: 10, bold: true, color: th.accent2, charSpacing: 5 })
    T(s, d.t, { x: 0.7, y: 1.35, w: 5.2, h: 1.2, fontFace: th.head, fontSize: 66, bold: true, color: 'FFFFFF', valign: 'middle' })
    T(s, c.label.charAt(0).toUpperCase() + c.label.slice(1), { x: 0.7, y: 2.55, w: 5.6, h: 0.5, fontFace: th.head, fontSize: 24, color: 'FFFFFF', fit: 'shrink' })
    T(s, d.name || '', { x: 0.7, y: 3.1, w: 5.2, h: 0.35, fontSize: 15, color: th.accent2 })
    T(s, ['Nilai aset', 'Kebutuhan dana', 'Siapa menyetor', 'Per lot', 'Sensitivitas harga'].join('  •  '), { x: 0.7, y: 3.55, w: 5.6, h: 0.3, fontSize: 11, color: 'EAF2FA' })
    const w0 = pill(s, 0.7, 4.0, STATUS[c.status], c.status === 'tereksekusi' ? th.good : th.accent, { size: 9 })
    if (c.jadwal) T(s, short(c.jadwal, 70), { x: 0.85 + w0, y: 4.0, w: 5, h: 0.24, fontSize: 9.5, color: 'EAF2FA', valign: 'middle' })
    T(s, `Data per ${fmtDate(d.date)}  |  Harga terakhir ${rpS(c.price)}  |  Simulasi harga pelaksanaan ${rpS(P)}`, { x: 0.7, y: 4.95, w: 7, h: 0.25, fontSize: 9.5, color: 'DCE7F3' })
  }
  if (!r) return pres

  // ===== 2. Angka kunci =====
  {
    const s = slide('Angka kunci', 'Ringkasan Angka Penambahan Modal', verdict)
    const w4 = (CW - 0.45) / 4
    ;[
      [c.inj ? bigS(c.inj) : '–', `Nilai transaksi injeksi aset${c.injTarget ? ' · ' + short(c.injTarget, 40) : ''}`, th.accent],
      [bigS(r.total), `Nilai penerbitan · ${shS(r.N)} saham × ${rpS(P)}`, th.accent],
      [bigS(r.tunai), r.aset ? `Dana tunai; ${bigS(r.aset)} disetor non-tunai` : 'Dana tunai (seluruhnya)', th.accent],
      [rpS(P), `Harga pelaksanaan${r.disc != null ? ` · ${r.disc >= 0 ? 'premi' : 'diskon'} ${id(Math.abs(r.disc) * 100, 0)}% vs pasar` : ''}`, r.disc != null && r.disc < -0.3 ? th.bad : th.accent],
    ].forEach(([v, l, col], i) => kpi(s, M + i * (w4 + 0.15), TOP, w4, 1.5, v, l, col))
    ;[
      [nr ? pc(r.newHolder) : `${id(r.ratio, 2)} : 1`, nr ? 'Porsi penerima saham baru' : 'Rasio HMETD per saham lama', th.ink],
      [pc(r.dilusi), 'Dilusi bila tidak ikut menebus', th.warn],
      [`${pc((c.float || 0) / 100)} → ${pc(r.pubAfter)}`, 'Porsi publik sekarang → setelah', r.pubAfter < 0.075 ? th.bad : th.ink],
      [r.vsMcap != null ? id(r.vsMcap, 1) + '×' : '–', 'Nilai penerbitan dibanding kapitalisasi pasar', r.vsMcap >= 1 ? th.bad : th.ink],
    ].forEach(([v, l, col], i) => kpi(s, M + i * (w4 + 0.15), TOP + 1.7, w4, 1.5, v, l, col))
  }

  // ===== 3. Rincian nilai aset injeksi =====
  if (det && (det.nama || det.lo)) {
    const kj = det.kjpp
    const s = slide('Aset injeksi', short(det.nama || 'Rincian nilai aset injeksi', 52),
      kj.status === 'terbit' ? `KJPP terbit${kj.nilai ? ': ' + bigS(kj.nilai) : ''}.` : kj.ket || 'Nilai aset belum diuji penilai independen.')
    card(s, M, TOP, 3.3, 3.35, { fill: th.dark, line: th.dark })
    T(s, det.spread ? 'NILAI INDIKATIF (BEDA ANTAR-SUMBER)' : 'NILAI TRANSAKSI', { x: M + 0.2, y: TOP + 0.18, w: 2.9, h: 0.22, fontSize: 8, bold: true, color: th.accent2, charSpacing: 2 })
    T(s, det.spread ? `${bigS(det.lo)} – ${bigS(det.hi)}` : bigS(det.hi), { x: M + 0.2, y: TOP + 0.45, w: 2.9, h: 0.7, fontFace: th.head, fontSize: det.spread ? 19 : 26, bold: true, color: 'FFFFFF', valign: 'middle' })
    if (det.spread) T(s, `Dipakai di hitungan: ${bigS(c.inj)}`, { x: M + 0.2, y: TOP + 1.15, w: 2.9, h: 0.25, fontSize: 9.5, color: th.accent2 })
    T(s, short(det.nilaiText, 260), { x: M + 0.2, y: TOP + 1.5, w: 2.9, h: 1.75, fontSize: 9, color: 'EAF2FA' })
    const cx = M + 3.5, cw = CW - 3.5
    const boxes = [
      ['Aset', [det.jenis, [det.lokasi, det.porsi].filter(Boolean).join(' · '), ...det.facts.map(([l, v]) => `${l}: ${typeof v === 'number' ? bigS(v) : v}`)].filter(Boolean).join(' · ')],
      ['Cara bayar', det.cara],
      ['Penilaian independen (KJPP)', `${KJPP_SHORT[kj.status] || 'Belum ada'}${kj.nama ? ' · ' + kj.nama : ''}${kj.nilai ? ' · ' + bigS(kj.nilai) : ''}`],
    ].filter(b => b[1])
    // Tinggi kotak mengikuti panjang teks (±95 karakter per baris pada lebar ini).
    const lines = boxes.map(([, v]) => Math.min(3, Math.ceil(short(v, 280).length / 95)))
    const room = det.gaps.length ? 2.3 : 3.35
    const unit = (room - 0.1 * (boxes.length - 1) - 0.36 * boxes.length) / lines.reduce((a, b) => a + b, 0)
    let by = TOP
    boxes.forEach(([h, v], i) => {
      const bh = 0.36 + lines[i] * Math.min(0.2, unit)
      card(s, cx, by, cw, bh)
      T(s, h.toUpperCase(), { x: cx + 0.15, y: by + 0.07, w: cw - 0.3, h: 0.2, fontSize: 7.5, bold: true, color: th.accent, charSpacing: 2 })
      T(s, short(v, 280), { x: cx + 0.15, y: by + 0.28, w: cw - 0.3, h: bh - 0.32, fontSize: 8.5, color: th.ink, fit: 'shrink' })
      by += bh + 0.1
    })
    if (det.gaps.length) {
      const gy = Math.max(by + 0.05, TOP + 2.2)
      T(s, 'BELUM DIUNGKAP KE PUBLIK', { x: cx, y: gy, w: cw, h: 0.2, fontSize: 7.5, bold: true, color: th.bad, charSpacing: 2 })
      T(s, det.gaps.slice(0, 4).map((g, i, a) => ({ text: short(g, 95), options: { bullet: { indent: 10 }, breakLine: i < a.length - 1, paraSpaceAfter: 2 } })),
        { x: cx, y: gy + 0.24, w: cw, h: TOP + 3.35 - gy - 0.24, fontSize: 8.5, color: th.muted })
    }
  }

  // ===== 4. Komposisi penerbitan vs nilai aset; tahap I vs II =====
  {
    const take = c.laterInj ? `Tahap I ${bigS(r.total)} tunai bukan untuk membeli aset; aset ${bigS(c.laterInj)} dibayar ±${shS(r.injShares)} saham baru.`
      : r.gap > (c.inj || 0) * 0.05 ? `Kekurangan ${bigS(r.gap)} harus ditutup utang, kas internal, atau tahap lanjutan.`
        : r.aset >= r.total * 0.95 ? 'Seluruh penerbitan dibayar dengan aset (non-tunai).' : 'Nilai penerbitan menutup nilai aset.'
    const s = slide('Kebutuhan dana', c.laterInj ? 'Tahapan Pendanaan dan Injeksi Aset' : 'Perbandingan Nilai Penerbitan dan Nilai Aset', take)
    const cats = c.inj ? ['Nilai aset injeksi', 'Nilai penerbitan'] : ['Nilai penerbitan']
    const series = [
      { name: 'Non-tunai (inbreng/konversi utang)', labels: cats, values: c.inj ? [0, B(r.aset)] : [B(r.aset)] },
      { name: 'Tunai', labels: cats, values: c.inj ? [0, B(r.tunai)] : [B(r.tunai)] },
      ...(c.inj ? [{ name: 'Nilai aset', labels: cats, values: [B(c.inj), 0] }] : []),
    ]
    s.addChart(pres.charts.BAR, series, { ...chartBase(), x: M, y: TOP, w: c.laterInj ? 5.0 : CW, h: 3.3, barDir: 'bar', barGrouping: 'stacked',
      chartColors: [th.warn, th.good, th.muted], showLegend: true, legendPos: 'b', valAxisLabelFormatCode: '#,##0' })
    T(s, 'Rp miliar', { x: M, y: TOP + 3.32, w: 2, h: 0.2, fontSize: 8, color: th.muted })
    if (c.laterInj) {
      const x = M + 5.2, w = CW - 5.2
      ;[
        ['TAHAP I · ' + c.label.toUpperCase(), bigS(r.total), `${shS(r.N)} saham × ${rpS(P)}${c.jadwal ? ' · ' + short(c.jadwal, 40) : ''}`, 'Dana tunai, bukan untuk membeli aset.', th.accent],
        ['TAHAP II · INJEKSI ASET', bigS(c.laterInj), `dibayar ±${shS(r.injShares)} saham baru pada ${rpS(P)}`, `Porsi publik bisa turun ke ${pc(r.pubAfterInj)}.`, r.pubAfterInj < 0.075 ? th.bad : th.accent],
      ].forEach(([h, v, a, b, col], i) => {
        const y = TOP + i * 1.7
        card(s, x, y, w, 1.55)
        T(s, h, { x: x + 0.18, y: y + 0.12, w: w - 0.3, h: 0.22, fontSize: 8, bold: true, color: th.accent, charSpacing: 2, fit: 'shrink' })
        T(s, v, { x: x + 0.18, y: y + 0.36, w: w - 0.3, h: 0.5, fontFace: th.head, fontSize: 22, bold: true, color: col, valign: 'middle' })
        T(s, a, { x: x + 0.18, y: y + 0.9, w: w - 0.3, h: 0.28, fontSize: 9, color: th.ink })
        T(s, b, { x: x + 0.18, y: y + 1.17, w: w - 0.3, h: 0.28, fontSize: 9, color: th.muted })
      })
    }
  }

  // ===== 5. Siapa harus menyetor / penerima saham baru =====
  if (!nr) {
    const s = slide('Kewajiban penyetoran', 'Kewajiban Penyetoran Dana',
      `Bila publik menebus ${d.U || 0}%, pembeli siaga/pengendali harus menyerap ${bigS(r.standby)}; porsi pengendali ${id(c.ctrlPct || 0, 2)}% → ${pc(r.ctrlAfterAbsorb)}.`)
    s.addChart(pres.charts.BAR, [{ name: 'Rp miliar', labels: ['Sisa publik diserap siaga', `Publik (${id(c.float || 0, 1)}%)`, `Pengendali (${id(c.ctrlPct || 0, 1)}%)`], values: [B(r.standby), B(r.pubPart), B(r.ctrlPart)] }],
      { ...chartBase(), x: M, y: TOP, w: 5.4, h: 3.3, barDir: 'bar', chartColors: [th.accent], showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 9, dataLabelColor: th.ink, dataLabelFormatCode: '#,##0.0', valAxisLabelFormatCode: '#,##0', showLegend: false })
    T(s, 'Rp miliar', { x: M, y: TOP + 3.32, w: 2, h: 0.2, fontSize: 8, color: th.muted })
    const x = M + 5.6, w = CW - 5.6
    card(s, x, TOP, w, 3.3)
    T(s, 'PORSI PENGENDALI', { x: x + 0.2, y: TOP + 0.18, w: w - 0.4, h: 0.22, fontSize: 8, bold: true, color: th.accent, charSpacing: 2 })
    ;[['Sekarang', (c.ctrlPct || 0) / 100, th.muted], ['Bila menyerap sisa publik', r.ctrlAfterAbsorb, th.accent]].forEach(([l, v, col], i) => {
      const y = TOP + 0.6 + i * 1.15
      T(s, l, { x: x + 0.2, y, w: w - 0.4, h: 0.25, fontSize: 9.5, color: th.muted })
      T(s, pc(v), { x: x + 0.2, y: y + 0.25, w: w - 0.4, h: 0.45, fontFace: th.head, fontSize: 24, bold: true, color: col })
      hbar(s, x + 0.2, y + 0.78, w - 0.4, v, col)
    })
  } else {
    const s = slide('Penerima saham baru', c.kind === 'merger' ? 'Pemegang Saham Pihak yang Digabungkan' : 'Komposisi Penerima Saham Baru',
      `Penerima saham baru memegang ${pc(r.newHolder)}; porsi pengendali lama ${id(c.ctrlPct || 0, 2)}% → ${pc(r.ctrlAfterNr)}.`)
    s.addChart(pres.charts.DOUGHNUT, [{ name: 'Porsi', labels: ['Pemegang lama', 'Penerima saham baru'], values: [Math.round((1 - r.newHolder) * 1000) / 10, Math.round(r.newHolder * 1000) / 10] }],
      { x: M, y: TOP, w: 3.6, h: 3.3, holeSize: 58, chartColors: [th.line, th.accent], showPercent: true, showLegend: true, legendPos: 'b', legendFontFace: th.body, dataLabelColor: th.ink })
    kpi(s, M + 3.9, TOP, CW - 3.9, 1.55, bigS(r.total), r.aset ? 'Nilai aset masuk (dibayar saham)' : 'Dana masuk', th.accent)
    kpi(s, M + 3.9, TOP + 1.75, CW - 3.9, 1.55, `${id(c.ctrlPct || 0, 2)}% → ${pc(r.ctrlAfterNr)}`, 'Porsi pengendali lama sesudah penerbitan', th.warn)
  }

  // ===== 6. Untuk investor per 1 lot =====
  {
    const s = slide('Investor ritel', 'Dampak terhadap Investor per Satu Lot', r.hak != null
      ? (r.hak > 0 ? `Nilai teoretis 1 HMETD ${rpS(r.hak)}.` : 'Harga tebus di atas TERP: HMETD secara teoretis tidak bernilai.')
      : `Tanpa hak tebus; kepemilikan turun ${pc(r.dilusi)}.`)
    const tiles = [
      !nr && [id(r.perLot.hak, 1), 'HMETD diterima per lot'],
      !nr && [rpS(r.perLot.dana), 'Dana untuk menebus semua hak'],
      r.terp != null && [rpS(r.terp), `Harga teoretis setelah penerbitan (TERP) · ${pctS(r.terp / c.price - 1, 0)} vs pasar`],
      !nr && r.hak != null && [r.hak > 0 ? rpS(r.hak) : 'Rp0', 'Nilai teoretis 1 HMETD'],
      [pc(r.dilusi), 'Kepemilikan turun bila tidak ikut'],
    ].filter(Boolean)
    const n = tiles.length, w = (CW - 0.15 * (n - 1)) / n
    tiles.forEach(([v, l], i) => kpi(s, M + i * (w + 0.15), TOP + 0.4, w, 2.2, v, l, i === n - 1 ? th.warn : th.accent))
  }

  // ===== 7. Sensitivitas harga pelaksanaan (kotak, bukan tabel, agar sama di PDF) =====
  {
    const base = c.price || P
    const pts = [...new Set([c.nominal, base * 0.5, base * 0.75, c.price, c.ex, c.implied, P, base * 1.25]
      .filter(v => v > 0).map(v => Math.round(v)))].sort((a, b) => a - b).slice(0, 8)
    const rows = pts.map(p => [p, riCalc(c, p, u)]).filter(([, x]) => x)
    const s = slide('Sensitivitas', 'Analisis Sensitivitas Harga Pelaksanaan', c.laterInj
      ? `Makin rendah harga, makin banyak saham untuk membayar aset tahap II: pada ${rpS(P)} porsi publik akhir ${pc(r.pubAfterInj)}.`
      : `Pada ${rpS(P)}: nilai penerbitan ${bigS(r.total)}, TERP ${r.terp != null ? rpS(r.terp) : '–'}.`)
    // Kolom yang benar-benar berubah terhadap harga: bila jumlah saham baru tetap, yang berubah adalah dana,
    // TERP, nilai HMETD, dan (bila ada) saham untuk injeksi tahap lanjutan.
    const COLS = {
      saham: ['Saham baru', x => shS(x.N)], nilai: ['Nilai penerbitan', x => bigS(x.total)], tunai: ['Dana tunai', x => bigS(x.tunai)],
      terp: ['TERP', x => x.terp != null ? rpS(x.terp) : '–'], hak: ['Nilai 1 HMETD', x => x.hak != null ? rpS(Math.max(0, x.hak)) : '–'],
      disc: ['vs pasar', x => x.disc != null ? pctS(x.disc, 0) : '–'], pub: ['Publik setelah', x => pc(x.pubAfter)],
      inj: ['Saham utk aset tahap II', x => shS(x.injShares)], pubInj: ['Publik setelah tahap II', x => pc(x.pubAfterInj)],
    }
    const keys = c.laterInj ? ['nilai', 'tunai', 'terp', 'inj', 'pubInj'] : c.N ? ['nilai', 'tunai', 'terp', ...(nr ? [] : ['hak']), 'disc'] : ['saham', 'nilai', 'tunai', 'terp', 'pub']
    const cols = ['Harga', ...keys.map(k => COLS[k][0])]
    const warnCol = keys.includes('pubInj') ? 'pubInj' : keys.includes('pub') ? 'pub' : ''
    const cw = CW / cols.length, rh = Math.min(0.42, 3.3 / (rows.length + 1))
    s.addShape(S.ROUNDED_RECTANGLE, { x: M, y: TOP, w: CW, h: rh, rectRadius: 0.04, fill: { color: th.dark }, line: { color: th.dark, width: 0.5 } })
    cols.forEach((h, i) => T(s, h, { x: M + i * cw + 0.1, y: TOP, w: cw - 0.2, h: rh, fontSize: 9, bold: true, color: 'FFFFFF', valign: 'middle', align: i ? 'right' : 'left' }))
    rows.forEach(([p, x], k) => {
      const y = TOP + (k + 1) * rh, cur = p === Math.round(P)
      s.addShape(S.RECTANGLE, { x: M, y, w: CW, h: rh, fill: { color: cur ? th.accent2 : k % 2 ? th.bg : th.card, transparency: cur ? 55 : 0 }, line: { color: th.line, width: 0.5 } })
      const tag = [p === c.nominal && 'nominal', p === Math.round(c.price || 0) && 'pasar', p === Math.round(c.ex || 0) && 'data', c.implied && p === Math.round(c.implied) && 'tersirat'].filter(Boolean).join(', ')
      const low = warnCol && (warnCol === 'pubInj' ? x.pubAfterInj : x.pubAfter) < 0.075
      ;[rpS(p) + (tag ? ` (${tag})` : ''), ...keys.map(k => COLS[k][1](x))]
        .forEach((v, i) => T(s, v, { x: M + i * cw + 0.1, y, w: cw - 0.2, h: rh, fontSize: 9, bold: cur, color: low && keys[i - 1] === warnCol ? th.bad : th.ink, valign: 'middle', align: i ? 'right' : 'left' }))
    })
  }

  // ===== 8. Porsi publik bertahap =====
  {
    const labels = ['Sekarang', 'Setelah penerbitan', ...(r.pubAfterInj != null ? ['Setelah injeksi tahap lanjutan'] : [])]
    const vals = [c.float || 0, r.pubAfter * 100, ...(r.pubAfterInj != null ? [r.pubAfterInj * 100] : [])].map(v => Math.round(v * 100) / 100)
    const low = Math.min(...vals) < 7.5
    const s = slide('Porsi publik', 'Porsi Kepemilikan Publik setelah Penerbitan', low
      ? 'Porsi publik bisa turun di bawah batas free float 7,5%: risiko likuiditas dan kewajiban menambah saham publik.'
      : `Porsi publik ${id(vals[0], 2)}% → ${id(vals[vals.length - 1], 2)}%.`)
    s.addChart(pres.charts.BAR, [{ name: 'Porsi publik (%)', labels, values: vals }], { ...chartBase(), x: M, y: TOP, w: 6.2, h: 3.3, barDir: 'col',
      chartColors: [low ? th.bad : th.accent], showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 10, dataLabelColor: th.ink, dataLabelFormatCode: '0.0', showLegend: false, valAxisMinVal: 0, valAxisLabelFormatCode: '0' })
    const x = M + 6.4, w = CW - 6.4
    card(s, x, TOP, w, 3.3)
    T(s, 'BATAS FREE FLOAT', { x: x + 0.2, y: TOP + 0.2, w: w - 0.4, h: 0.22, fontSize: 8, bold: true, color: th.accent, charSpacing: 2 })
    T(s, '7,5%', { x: x + 0.2, y: TOP + 0.45, w: w - 0.4, h: 0.6, fontFace: th.head, fontSize: 30, bold: true, color: low ? th.bad : th.good })
    T(s, nr ? 'Penerbitan tanpa hak tebus: porsi publik pasti turun.' : `Simulasi: publik menebus ${d.U || 0}%. Bila publik menebus penuh, porsinya tetap ${id(c.float || 0, 2)}%.`,
      { x: x + 0.2, y: TOP + 1.15, w: w - 0.4, h: 1.0, fontSize: 9.5, color: th.muted })
  }

  // ===== 9. Kesimpulan (gelap) =====
  {
    const s = pres.addSlide(); K.bump()
    s.background = { color: th.dark }
    T(s, 'SIMPULAN', { x: 0.7, y: 0.6, w: 5, h: 0.3, fontSize: 10, bold: true, color: th.accent2, charSpacing: 5 })
    if (fund) {
      // Pengumpulan dana: tercapai atau tidak, dengan keterbukaan terakhir dan alasan utama.
      const fc = { good: th.good, warn: th.warn, strong: th.bad }[fund.tone] || th.accent2
      const fx = 6.95, fw = W - fx - 0.4
      s.addShape(S.ROUNDED_RECTANGLE, { x: fx, y: 0.6, w: fw, h: 4.35, rectRadius: 0.08, fill: { color: 'FFFFFF', transparency: 92 }, line: { color: fc, width: 1.5 } })
      T(s, 'PENGUMPULAN DANA', { x: fx + 0.18, y: 0.75, w: fw - 0.36, h: 0.22, fontSize: 8, bold: true, color: th.accent2, charSpacing: 3 })
      T(s, fund.label, { x: fx + 0.18, y: 1.0, w: fw - 0.36, h: 0.62, fontFace: th.head, fontSize: 17, bold: true, color: 'FFFFFF', valign: 'middle', fit: 'shrink' })
      T(s, fund.last ? `Keterbukaan terakhir ${fmtDate(fund.last.date)}: ${short(fund.last.title, 90)}` : 'Belum ada keterbukaan resmi tentang penambahan modal.',
        { x: fx + 0.18, y: 1.66, w: fw - 0.36, h: 0.62, fontSize: 8, color: 'DCE7F3' })
      const rs = [...fund.reasons].sort((a, b) => Math.abs(b.s) - Math.abs(a.s)).slice(0, 5)
      T(s, rs.map((x, i) => ({ text: `${x.s > 0 ? 'Pendukung: ' : x.s < 0 ? 'Risiko: ' : 'Catatan: '}${short(x.t, 95)}`, options: { color: x.s > 0 ? 'BBF7D0' : x.s < 0 ? 'FDE68A' : 'EAF2FA', breakLine: i < rs.length - 1, paraSpaceAfter: 4 } })),
        { x: fx + 0.18, y: 2.32, w: fw - 0.36, h: 2.55, fontSize: 8.5 })
    } else coverArt(s, d.sector?.motif, th, S, dot, line, true)
    T(s, `${d.t}: ${c.label}`, { x: 0.7, y: 0.95, w: 6.0, h: 0.8, fontFace: th.head, fontSize: 30, bold: true, color: 'FFFFFF', valign: 'middle', fit: 'shrink' })
    const pts = [
      `Nilai ${what} ${bigS(r.total)} (${shS(r.N)} saham × ${rpS(P)}); dana tunai ${bigS(r.tunai)}.`,
      c.inj ? `Aset injeksi ${det?.spread ? bigS(det.lo) + '–' + bigS(det.hi) : bigS(c.inj)}${c.laterInj ? `, dibayar ±${shS(r.injShares)} saham di tahap lanjutan` : ''}.` : null,
      `Porsi publik ${pc((c.float || 0) / 100)} → ${pc(r.pubAfterInj ?? r.pubAfter)}${r.pubAfterInj != null ? ' setelah semua tahap' : ''}.`,
      fund ? `Pengumpulan dana: ${fund.label.toLowerCase()}.` : null,
      ...verdict.split(/(?<=\.)\s+/).filter(Boolean),
      c.jadwal ? `Berikutnya: ${c.jadwal}.` : null,
    ].filter(Boolean).slice(0, 5)
    pts.forEach((p, i) => {
      const y = 1.9 + i * 0.5
      dot(s, 0.85, y + 0.15, 0.07, th.accent2)
      T(s, short(p, 120), { x: 1.1, y, w: 5.6, h: 0.46, fontSize: 10.5, color: 'F8FAFC' })
    })
    T(s, short(c.notes.join(' '), 260), { x: 0.7, y: 4.5, w: 6.5, h: 0.5, fontSize: 8.5, color: 'DCE7F3' })
    T(s, 'Simulasi ini disusun dari data kurasi dan keterbukaan informasi publik. Angka bersifat indikatif hingga prospektus dan laporan KJPP terbit, dan bukan merupakan anjuran membeli atau menjual efek.', { x: 0.7, y: 5.05, w: 6.5, h: 0.3, fontSize: 8, color: 'DCE7F3' })
  }
  return pres
}

export const riDeckFileName = (t, date, theme) => `${t}_RightsIssue_${date}_${String(theme?.name || '').replace(/[^A-Za-z0-9]+/g, '-')}.pptx`

// Nama berkas unduhan.
export const deckFileName = (t, date, theme) => `${t}_Analisa_${date}_${String(theme?.name || '').replace(/[^A-Za-z0-9]+/g, '-')}.pptx`
