// Presentasi versi infografis: poster vertikal A4 (portrait), mengikuti format riset manajer investasi.
// Halaman 1 "Tear sheet" = halaman depan riset sell-side (rating, target, potensi, data saham, pemegang saham, grafik
// harga) + memo buy-side fund manager (tesis, pandangan berbeda dari pasar, katalis bertanggal, skenario bear/base/bull,
// risiko & kriteria tesis batal). Halaman 2 "Transaksi & aset": diagram transaksi, aset dalam angka, garis waktu, peta harga.
// Bentuk yang dipakai hanya persegi, persegi bundar, lingkaran, garis, teks, dan grafik agar PDF identik dengan PPTX.
import { rpS, bigS, short } from './deck.js'
import { fmtDate } from './domain.js'

const W = 8.27, H = 11.69, M = 0.4, CW = W - 2 * M
const id = (v, d = 0) => v == null || isNaN(v) ? '–' : (+v).toLocaleString('id-ID', { maximumFractionDigits: d })
const pctS = v => v == null || isNaN(v) ? '–' : `${v > 0 ? '+' : ''}${id(v * 100, 0)}%`
const ent = s => String(s || '').replace(/\s*\(.*?\)/g, '').replace(/^\s*(grup|melalui)\s+/i, '').trim()
const kalimat = t => String(t || '').split(/(?<!\b(?:No|Tbk|Pte|Ltd|PT|Kec|Kab|dr|Sdn|Bhd|Co|Inc|vs|dkk|mis))[.;]\s+(?=[A-Z])/)
  .map(x => x.trim().replace(/[.;]?$/, '.')).filter(x => x.length > 15)

// Angka utama untuk kartu aset: utamakan angka bersatuan (umur -> "tahun"), abaikan tahun kalender (2024, 2026).
const SATUAN_RX = /[±~]?\d[\d.,]*\s*(juta ton|juta MT|ton|ha|hektare|MW|MMSCFD|liter\/detik|tahun|%|kolam|unit|km|triliun|miliar|T|M)(?![A-Za-z])/gi
function angkaUtama(label, v) {
  const t = String(v || '')
  const all = [...t.matchAll(SATUAN_RX)].map(m => m[0].trim())
  const pick = /umur/i.test(label) ? all.find(x => /tahun/i.test(x)) : all.find(x => !/^\d{4}\s*tahun$/i.test(x))
  if (pick) return pick
  const n = [...t.matchAll(/[±~]?\d[\d.,]*/g)].map(m => m[0]).find(x => !/^(19|20)\d{2}$/.test(x))
  return n || short(t, 18)
}

function kit(PptxGenJS, th, title) {
  const pres = new PptxGenJS()
  pres.defineLayout({ name: 'A4P', width: W, height: H })
  pres.layout = 'A4P'
  pres.author = 'Radar Backdoor'
  pres.company = 'Radar Backdoor'
  pres.title = title
  const S = pres.shapes
  const T = (s, text, o = {}) => s.addText(text, { isTextBox: true, margin: 0, fontFace: th.body, color: th.ink, valign: 'top', fit: 'shrink', fontSize: 10, ...o })
  const box = (s, x, y, w, h, fill, o = {}) => s.addShape(o.round === false ? S.RECTANGLE : S.ROUNDED_RECTANGLE,
    { x, y, w, h, rectRadius: o.r ?? 0.06, fill: { color: fill }, line: { color: o.line || fill, width: o.lw || 0.75 } })
  const dot = (s, cx, cy, r, fill, o = {}) => s.addShape(S.OVAL, { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, fill: { color: fill }, line: { color: o.line || fill, width: o.lw || 0.75 } })
  // Garis dengan panah; arah ke kiri/atas lewat flipH/flipV (ukuran negatif merusak berkas).
  const arrow = (s, x, y, w, h, color, o = {}) => s.addShape(S.LINE, { x: w < 0 ? x + w : x, y: h < 0 ? y + h : y, w: Math.abs(w), h: Math.abs(h),
    flipH: w < 0, flipV: h < 0, line: { color, width: o.w || 2, endArrowType: o.noArrow ? undefined : 'triangle' } })
  const rule = (s, x, y, w, color, wd = 1) => s.addShape(S.LINE, { x, y, w, h: 0, line: { color, width: wd } })
  // Ikon = lingkaran berisi singkatan teks (simbol khusus tidak tersedia di font PDF).
  const icon = (s, cx, cy, r, txt, fill, ink = 'FFFFFF') => {
    dot(s, cx, cy, r, fill)
    T(s, txt, { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, fontSize: Math.max(7, Math.round(r * 30)), bold: true, color: ink, align: 'center', valign: 'middle' })
  }
  // Judul blok: label huruf besar + garis.
  const head = (s, x, y, w, t) => {
    T(s, t.toUpperCase(), { x, y, w, h: 0.22, fontSize: 8.5, bold: true, color: th.accent, charSpacing: 2, valign: 'middle' })
    rule(s, x, y + 0.25, w, th.accent, 1.25)
  }
  // Daftar poin bernomor/berbutir pendek.
  const bullets = (s, x, y, w, items, o = {}) => {
    const lh = o.lh || 0.36
    items.forEach((t, i) => {
      dot(s, x + 0.06, y + i * lh + 0.1, 0.035, o.color || th.accent)
      T(s, short(t, o.n || 120), { x: x + 0.18, y: y + i * lh, w: w - 0.18, h: lh - 0.03, fontSize: o.size || 8.5 })
    })
    return y + items.length * lh
  }
  return { pres, S, T, box, dot, arrow, rule, icon, head, bullets }
}

// Skenario valuasi bear/base/bull dari rekomendasi & nilai wajar analis (harga per saham).
function skenario(d) {
  const A = d.A || {}, rc = d.rec || {}, nw = d.pa?.nilaiWajar || {}, p = A.price
  const tg = (rc.targets || []).map(t => t.p).filter(x => x > 0)
  const bear = rc.stop || (nw.bawah && nw.bawah < p ? nw.bawah : null) || A.p?.metrics?.low52 || null
  const base = tg[0] || (nw.bawah && nw.atas ? (nw.bawah + nw.atas) / 2 : null)
  const bull = tg[1] || nw.atas || null
  return [['Bear', bear, 'batas risiko / nilai bawah'], ['Base', base, tg[0] ? 'target pertama' : 'tengah nilai wajar'], ['Bull', bull, tg[1] ? 'target kedua' : 'nilai wajar atas']]
    .map(([n, v, k]) => ({ n, v, k, r: v && p ? v / p - 1 : null }))
}

export function buildInfoDeck(PptxGenJS, d, th) {
  const K = kit(PptxGenJS, th, `${d.t}: Infografis Riset Backdoor Listing`)
  const { pres, T, box, dot, arrow, rule, icon, head, bullets } = K
  const A = d.A || {}, st = d.story || {}, sv = A.sv || {}, pv = d.pv || {}, pa = d.pa || {}, rc = d.rec, rs = d.riset || {}
  const m = A.p?.metrics || {}, sx = A.p?.stats || {}, p = A.price
  const nilai = d.tx || d.ri?.inj || null
  const who = ent(pv.siapa || A.ctrlName || d.item?.acquirer || 'belum diketahui')
  const injT = ent(d.ri?.injTarget || sv.injectTarget || d.aset?.aset?.nama || st.inject || '')
  const foot = (s, n) => {
    rule(s, M, H - 0.45, CW, th.line)
    T(s, `${d.t} · Riset Radar Backdoor · Data per ${fmtDate(d.date)} · Disusun otomatis dari Stockbit, keterbukaan informasi, dan sumber publik; bukan ajakan membeli atau menjual efek.`,
      { x: M, y: H - 0.38, w: CW - 0.4, h: 0.22, fontSize: 6.5, color: th.muted })
    T(s, String(n), { x: W - M - 0.3, y: H - 0.38, w: 0.3, h: 0.22, fontSize: 7, color: th.muted, align: 'right' })
  }

  // ===================== Halaman 1: Tear sheet =====================
  {
    const s = pres.addSlide()
    s.background = { color: 'FFFFFF' }
    // Kepala: identitas emiten (kiri) + kotak rekomendasi (kanan), seperti halaman depan riset sekuritas.
    box(s, 0, 0, W, 1.55, th.dark, { round: false })
    T(s, `RISET EKUITAS · ${String(d.sector?.label || 'UMUM').toUpperCase()} · ${fmtDate(d.date)}`, { x: M, y: 0.2, w: 4.6, h: 0.2, fontSize: 7.5, bold: true, color: th.accent2, charSpacing: 2 })
    T(s, d.t, { x: M, y: 0.42, w: 2.6, h: 0.62, fontFace: th.head, fontSize: 36, bold: true, color: 'FFFFFF', valign: 'middle' })
    T(s, short(d.name || '', 48), { x: M, y: 1.04, w: 4.6, h: 0.22, fontSize: 10, color: 'FFFFFF' })
    T(s, short(`${st.lama ? st.lama + ' → ' : ''}${st.baru || sv.baru || ''}`, 70), { x: M, y: 1.26, w: 4.6, h: 0.2, fontSize: 8, color: th.accent2 })
    const sk = skenario(d), base = sk[1]
    const rcol = rc?.tone === 'good' ? th.good : rc?.tone === 'bad' ? th.bad : th.warn
    const rx = W - M - 2.85
    box(s, rx, 0.18, 2.85, 1.2, 'FFFFFF')
    box(s, rx, 0.18, 2.85, 0.36, rcol)
    T(s, short(rc?.label || pa.sikap || 'Belum ada rekomendasi', 34), { x: rx + 0.1, y: 0.18, w: 2.65, h: 0.36, fontSize: 10.5, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
    ;[['Harga', rpS(p)], ['Target', base.v ? rpS(base.v) : '–'], ['Potensi', base.r != null ? pctS(base.r) : '–']].forEach(([l, v], i) => {
      const x = rx + 0.08 + i * 0.93
      T(s, l.toUpperCase(), { x, y: 0.62, w: 0.9, h: 0.16, fontSize: 6.5, bold: true, color: th.muted, align: 'center', charSpacing: 1 })
      T(s, v, { x, y: 0.8, w: 0.9, h: 0.34, fontFace: th.head, fontSize: 13, bold: true, color: l === 'Potensi' && base.r != null ? (base.r >= 0 ? th.good : th.bad) : th.ink, align: 'center', valign: 'middle' })
    })
    T(s, short(`Horizon: ${rc?.horizon || '–'} · Sikap: ${pa.sikap || '–'}`, 70), { x: rx + 0.05, y: 1.16, w: 2.75, h: 0.18, fontSize: 6.5, color: th.muted, align: 'center' })

    // Kolom kiri: data saham, pemegang saham, grafik harga.
    const lx = M, lw = 2.55, rx2 = M + lw + 0.25, rw = CW - lw - 0.25
    let y = 1.75
    head(s, lx, y, lw, 'Data saham')
    const rows = [
      ['Kapitalisasi pasar', bigS(sx.marketCap || A.mcap)],
      ['Rentang 52 minggu', m.low52 ? `${rpS(m.low52)}–${rpS(m.high52)}` : '–'],
      ['Kinerja 1 tahun', m.ret1y || '–'],
      ['PBV / PER', `${m.pbv != null ? id(m.pbv, 2) + 'x' : '–'} / ${m.per != null ? id(m.per, 1) + 'x' : '–'}`],
      ['Free float', A.flt != null ? id(A.flt, 1) + '%' : sx.freeFloat != null ? id(sx.freeFloat, 1) + '%' : '–'],
      ['Pengendali', A.ctrlPct != null ? id(A.ctrlPct, 1) + '%' : '–'],
      ['Harga PTW', A.tender?.price ? `${rpS(A.tender.price)} (${pctS(p / A.tender.price - 1)})` : '–'],
      ['Skor analisis', A.score != null ? `${A.score}/100` : '–'],
    ]
    rows.forEach(([k, v], i) => {
      const yy = y + 0.33 + i * 0.25
      if (i % 2 === 0) box(s, lx, yy - 0.02, lw, 0.24, th.bg, { round: false })
      T(s, k, { x: lx + 0.06, y: yy, w: 1.25, h: 0.2, fontSize: 7.5, color: th.muted, valign: 'middle' })
      T(s, v, { x: lx + 1.3, y: yy, w: lw - 1.36, h: 0.2, fontSize: 8, bold: true, align: 'right', valign: 'middle' })
    })
    y += 0.33 + rows.length * 0.25 + 0.15
    head(s, lx, y, lw, 'Pemegang saham utama')
    const holders = (d.profile?.shareholders || A.p?.shareholders || []).map(h => ({ ...h, pct: parseFloat(String(h.pct).replace(',', '.')) })).filter(h => h.pct > 0).slice(0, 4)
    holders.forEach((h, i) => {
      const yy = y + 0.34 + i * 0.36
      T(s, short(h.name, 34), { x: lx, y: yy, w: lw - 0.5, h: 0.16, fontSize: 7, bold: !!h.pengendali })
      T(s, id(h.pct, 1) + '%', { x: lx + lw - 0.5, y: yy, w: 0.5, h: 0.16, fontSize: 7.5, bold: true, align: 'right' })
      box(s, lx, yy + 0.18, lw, 0.08, th.line, { r: 0.04 })
      box(s, lx, yy + 0.18, Math.max(0.05, lw * h.pct / 100), 0.08, h.pengendali ? th.accent : th.muted, { r: 0.04 })
    })
    if (!holders.length) T(s, 'Data pemegang saham belum tersedia.', { x: lx, y: y + 0.34, w: lw, h: 0.2, fontSize: 7.5, color: th.muted })
    y += 0.34 + Math.max(1, holders.length) * 0.36 + 0.15
    head(s, lx, y, lw, 'Harga 1 tahun')
    const bars = (d.tech?.bars || []).filter(b => b.c > 0)
    if (bars.length > 20) {
      const stp = Math.max(1, Math.floor(bars.length / 60)), pts = bars.filter((_, i) => i % stp === 0 || i === bars.length - 1)
      s.addChart(pres.charts.LINE, [{ name: d.t, labels: pts.map(b => String(b.d || '').slice(5, 10)), values: pts.map(b => b.c) }], {
        x: lx - 0.05, y: y + 0.3, w: lw + 0.1, h: 1.65, lineSize: 1.5, lineDataSymbol: 'none', chartColors: [th.accent], showLegend: false,
        catAxisHidden: true, valAxisLabelFontSize: 6, valAxisLabelColor: th.muted, valGridLine: { color: th.line, size: 0.5 }, catGridLine: { style: 'none' } })
    } else T(s, 'Data harga belum tersedia.', { x: lx, y: y + 0.34, w: lw, h: 0.2, fontSize: 7.5, color: th.muted })

    // Kolom kanan: memo fund manager.
    let r = 1.75
    head(s, rx2, r, rw, 'Tesis investasi')
    const tesis = (kalimat(pa.tesis).length ? kalimat(pa.tesis) : [...(A.bull || []), ...(d.pc?.pros || []).map(x => x.t)]).slice(0, 3)
    r = bullets(s, rx2, r + 0.33, rw, tesis.length ? tesis : ['Tesis analis belum tersedia.'], { lh: 0.42, n: 170 }) + 0.1
    head(s, rx2, r, rw, 'Pandangan berbeda dari pasar')
    const nw = pa.nilaiWajar
    const vv = [
      `Pasar menghargai ${rpS(p)}${m.pbv != null ? ` (PBV ${id(m.pbv, 2)}x)` : ''}${A.tender?.price ? `, ${pctS(p / A.tender.price - 1)} dari harga PTW` : ''}.`,
      nw ? `Kami menilai wajar ${rpS(nw.bawah)}–${rpS(nw.atas)} (${pctS(nw.bawah / p - 1)} s.d. ${pctS(nw.atas / p - 1)}).` : 'Nilai wajar analis belum ditetapkan.',
      pa.ringkas ? short(pa.ringkas, 170) : null,
    ].filter(Boolean)
    r = bullets(s, rx2, r + 0.33, rw, vv, { lh: 0.38, n: 175 }) + 0.1

    head(s, rx2, r, rw, 'Katalis yang ditunggu')
    const next = (d.prog?.applicable || d.milestones || []).filter(x => !d.prog?.ms?.[x.id]).slice(0, 3).map(x => x.label)
    const kat = [d.pos?.next && `Berikutnya: ${d.pos.next}`, ...next, ...(pa.variabelKunci || [])].filter(Boolean)
    const katU = [...new Set(kat)].slice(0, 3)
    r = bullets(s, rx2, r + 0.33, rw, katU.length ? katU : ['Belum ada katalis bertanggal.'], { lh: 0.32, n: 120, color: th.good }) + 0.1

    // Skenario bear/base/bull (kartu berwarna).
    head(s, rx2, r, rw, 'Skenario valuasi')
    const cw3 = (rw - 0.2) / 3
    sk.forEach((x, i) => {
      const col = [th.bad, th.accent, th.good][i], cx = rx2 + i * (cw3 + 0.1)
      box(s, cx, r + 0.34, cw3, 0.95, th.bg, { line: col, lw: 1.5 })
      box(s, cx, r + 0.34, cw3, 0.22, col)
      T(s, x.n.toUpperCase(), { x: cx, y: r + 0.34, w: cw3, h: 0.22, fontSize: 8, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', charSpacing: 2 })
      T(s, x.v ? rpS(x.v) : '–', { x: cx, y: r + 0.58, w: cw3, h: 0.3, fontFace: th.head, fontSize: 14, bold: true, align: 'center', valign: 'middle' })
      T(s, x.r != null ? pctS(x.r) : '', { x: cx, y: r + 0.88, w: cw3, h: 0.18, fontSize: 9, bold: true, color: col, align: 'center' })
      T(s, x.k, { x: cx + 0.05, y: r + 1.06, w: cw3 - 0.1, h: 0.18, fontSize: 6.5, color: th.muted, align: 'center' })
    })
    r += 1.45
    // Risiko & kriteria tesis batal.
    head(s, rx2, r, rw, 'Risiko & tesis batal bila')
    const risk = [...(pa.tesisSalahBila || []).map(x => 'Batal bila: ' + x), ...(A.bear || []), ...(d.pc?.cons || []).map(x => x.t), ...(rs.risiko || [])].filter(Boolean)
    bullets(s, rx2, r + 0.33, rw, [...new Set(risk)].slice(0, 4), { lh: 0.34, n: 125, color: th.bad })
    foot(s, 1)
  }

  // ===================== Halaman 2: Transaksi & aset =====================
  {
    const s = pres.addSlide()
    s.background = { color: 'FFFFFF' }
    box(s, 0, 0, W, 0.7, th.dark, { round: false })
    T(s, `${d.t} · TRANSAKSI, ASET, DAN HARGA`, { x: M, y: 0.14, w: CW, h: 0.42, fontFace: th.head, fontSize: 17, bold: true, color: 'FFFFFF', valign: 'middle' })

    // 1. Diagram transaksi.
    let y = 0.9
    head(s, M, y, CW, 'Transaksi dalam satu gambar')
    const y0 = y + 0.42, bw = 2.25, bh = 0.62, ex = W / 2 - 1.1, ew = 2.2
    box(s, M, y0, bw, bh, th.bg, { line: th.line })
    T(s, 'PENGENDALI LAMA', { x: M + 0.1, y: y0 + 0.06, w: bw - 0.2, h: 0.15, fontSize: 6.5, bold: true, color: th.muted, charSpacing: 2 })
    T(s, short(ent(st.oldName) || 'belum diketahui', 40) + (st.oldPct ? ` (${st.oldPct})` : ''), { x: M + 0.1, y: y0 + 0.22, w: bw - 0.2, h: 0.34, fontSize: 8.5, bold: true, valign: 'middle' })
    arrow(s, M + bw / 2, y0 + bh, 0, 0.3, th.muted)
    const yb = y0 + bh + 0.32
    box(s, M, yb, bw, bh, th.accent)
    T(s, 'PENGENDALI BARU', { x: M + 0.1, y: yb + 0.06, w: bw - 0.2, h: 0.15, fontSize: 6.5, bold: true, color: th.accent2, charSpacing: 2 })
    T(s, short(who, 40), { x: M + 0.1, y: yb + 0.22, w: bw - 0.2, h: 0.34, fontSize: 8.5, bold: true, color: 'FFFFFF', valign: 'middle' })
    const ey = y0 + 0.3
    box(s, ex, ey, ew, 1.3, th.dark)
    T(s, d.t, { x: ex, y: ey + 0.08, w: ew, h: 0.4, fontFace: th.head, fontSize: 20, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
    T(s, [{ text: 'Lama: ', options: { bold: true, color: th.accent2 } }, { text: short(st.lama || 'belum diketahui', 38), options: { breakLine: true } },
      { text: 'Baru: ', options: { bold: true, color: th.accent2 } }, { text: short(st.baru || sv.baru || 'belum diungkap', 38) }],
      { x: ex + 0.1, y: ey + 0.52, w: ew - 0.2, h: 0.72, fontSize: 7.5, color: 'FFFFFF', valign: 'middle' })
    arrow(s, M + bw, yb + bh / 2, ex - M - bw, 0, th.accent)
    T(s, A.ctrlPct != null ? id(A.ctrlPct, 1) + '%' : '', { x: M + bw, y: yb + bh / 2 - 0.22, w: ex - M - bw, h: 0.18, fontSize: 8, bold: true, color: th.accent, align: 'center' })
    const ax = W - M - bw
    if (injT || nilai || d.ri) {
      box(s, ax, ey + 0.32, bw, bh + 0.05, th.bg, { line: th.accent, lw: 1.5 })
      T(s, 'ASET INJEKSI', { x: ax + 0.1, y: ey + 0.38, w: bw - 0.2, h: 0.15, fontSize: 6.5, bold: true, color: th.accent, charSpacing: 2 })
      T(s, short(injT || 'Penambahan modal', 50), { x: ax + 0.1, y: ey + 0.55, w: bw - 0.2, h: 0.38, fontSize: 8.5, bold: true, valign: 'middle' })
      arrow(s, ax, ey + 0.32 + bh / 2, ex + ew - ax, 0, th.accent)
      T(s, nilai ? bigS(nilai) : '', { x: ex + ew, y: ey + 0.32 + bh / 2 - 0.22, w: ax - ex - ew, h: 0.18, fontSize: 8, bold: true, color: th.accent, align: 'center' })
    }
    T(s, d.mechLabel ? `Mekanisme: ${d.mechLabel}` : '', { x: M, y: yb + bh + 0.06, w: CW, h: 0.18, fontSize: 7.5, color: th.muted, align: 'center' })

    // 2. Aset dalam angka.
    y = yb + bh + 0.38
    head(s, M, y, CW, 'Aset dalam angka')
    T(s, short(injT || rs.entitas?.[0]?.nama || 'Aset belum diungkap', 95), { x: M, y: y + 0.32, w: CW, h: 0.22, fontSize: 9.5, bold: true })
    const tb = rs.tambang
    const angka = (tb ? [['Cadangan', tb.cadangan], ['Umur tambang', tb.umur], ['Produksi', tb.produksi], ['Luas / izin', tb.luas || tb.izin]] : [])
      .concat((rs.operasional || []).map(o => [o.l, o.t])).filter(x => x[1] && /\d/.test(x[1])).slice(0, 4)
    const aw = (CW - 0.3) / 4, ay = y + 0.6
    angka.forEach(([l, v], i) => {
      const x = M + i * (aw + 0.1)
      box(s, x, ay, aw, 1.05, th.bg, { line: th.line })
      T(s, short(angkaUtama(l, v), 18), { x: x + 0.06, y: ay + 0.08, w: aw - 0.12, h: 0.38, fontFace: th.head, fontSize: 14, bold: true, color: th.accent, align: 'center', valign: 'middle' })
      T(s, l.toUpperCase(), { x: x + 0.06, y: ay + 0.48, w: aw - 0.12, h: 0.15, fontSize: 6.5, bold: true, align: 'center', charSpacing: 1 })
      T(s, short(v, 75), { x: x + 0.06, y: ay + 0.64, w: aw - 0.12, h: 0.36, fontSize: 6.3, color: th.muted, align: 'center' })
    })
    if (!angka.length) T(s, 'Angka aset belum diungkap di sumber publik.', { x: M, y: ay, w: CW, h: 0.25, fontSize: 8.5, color: th.muted })

    // 3. Garis waktu tonggak (dua kolom agar ringkas).
    y = ay + (angka.length ? 1.25 : 0.45)
    head(s, M, y, CW, `Garis waktu transaksi${d.prog ? ` · progres ${d.prog.pct}%` : ''}`)
    const ms = (d.prog?.applicable || d.milestones || []).slice(0, 10)
    const half = Math.ceil(ms.length / 2), colw = (CW - 0.2) / 2, tstep = 0.34
    ms.forEach((mm, i) => {
      const cx = M + (i < half ? 0 : colw + 0.2) + 0.15, yy = y + 0.45 + (i % half) * tstep, ok = !!d.prog?.ms?.[mm.id]
      dot(s, cx, yy + 0.1, 0.1, ok ? th.good : 'FFFFFF', { line: ok ? th.good : th.muted, lw: 1.25 })
      T(s, ok ? 'v' : String(i + 1), { x: cx - 0.1, y: yy, w: 0.2, h: 0.2, fontSize: 6.5, bold: true, color: ok ? 'FFFFFF' : th.muted, align: 'center', valign: 'middle' })
      const a = d.prog?.auto?.[mm.id]
      T(s, short(mm.label, 55) + (ok && a ? ` · ${fmtDate(String(a).slice(0, 10))}` : ''), { x: cx + 0.2, y: yy, w: colw - 0.4, h: 0.2, fontSize: 7.5, bold: ok, color: ok ? th.ink : th.muted, valign: 'middle' })
    })
    if (!ms.length) T(s, 'Tonggak transaksi belum dipantau.', { x: M, y: y + 0.4, w: CW, h: 0.25, fontSize: 8.5, color: th.muted })

    // 4. Peta harga: level acuan vs harga kini.
    y = y + 0.45 + Math.max(1, half) * tstep + 0.2
    head(s, M, y, CW, 'Peta harga')
    const lv = [
      rc?.stop && ['Batas risiko', rc.stop, th.bad],
      rc?.entry?.[0] && ['Area beli', rc.entry[0], th.accent],
      A.tender?.price && ['Harga PTW', A.tender.price, th.muted],
      pa.nilaiWajar?.bawah && ['Nilai wajar bawah', pa.nilaiWajar.bawah, th.warn],
      pa.nilaiWajar?.atas && ['Nilai wajar atas', pa.nilaiWajar.atas, th.good],
      ...(rc?.targets || []).slice(0, 2).map((t, i) => ['Target ' + (i + 1), t.p, th.good]),
      p && ['Harga kini', p, th.dark],
    ].filter(Boolean).sort((a, b) => a[1] - b[1])
    if (lv.length > 1 && p) {
      const mx = Math.max(...lv.map(x => x[1])) * 1.1, bx = M + 1.45, bwid = CW - 2.6
      const rh = Math.min(0.28, (H - 0.6 - (y + 0.38)) / lv.length)
      lv.forEach(([l, v, col], i) => {
        const yy = y + 0.38 + i * rh, now = l === 'Harga kini'
        T(s, l, { x: M, y: yy, w: 1.4, h: rh - 0.03, fontSize: 7.5, bold: now, valign: 'middle' })
        box(s, bx, yy + 0.04, Math.max(0.05, bwid * v / mx), rh - 0.1, col, { r: 0.03 })
        T(s, `${rpS(v)}${now ? '' : ' (' + pctS(v / p - 1) + ')'}`, { x: bx + bwid * v / mx + 0.06, y: yy, w: 1.3, h: rh - 0.03, fontSize: 7.5, bold: now, valign: 'middle' })
      })
    } else T(s, 'Level harga acuan belum tersedia.', { x: M, y: y + 0.38, w: CW, h: 0.25, fontSize: 8.5, color: th.muted })

    // 5. Aset lain milik pengendali & sumber utama (mengisi sisa halaman bila ada ruang).
    y += 0.38 + (lv.length > 1 && p ? Math.min(0.28, (H - 0.6 - (y + 0.38)) / lv.length) * lv.length : 0.3) + 0.2
    const pa2 = (rs.pengendaliAset || []).slice(0, 3)
    if (pa2.length && H - 0.6 - y > 1.3) {
      head(s, M, y, CW, 'Aset lain milik pengendali')
      const pw = (CW - 0.2) / 3
      pa2.forEach((e, i) => {
        const x = M + i * (pw + 0.1)
        box(s, x, y + 0.36, pw, 0.85, th.bg, { line: th.line })
        T(s, short(e.nama, 50), { x: x + 0.08, y: y + 0.42, w: pw - 0.16, h: 0.22, fontSize: 8, bold: true })
        T(s, short([e.jenis, e.lokasi].filter(Boolean).join(' · '), 70), { x: x + 0.08, y: y + 0.64, w: pw - 0.16, h: 0.18, fontSize: 6.5, color: th.accent })
        T(s, short(e.detail || e.hubungan || '', 110), { x: x + 0.08, y: y + 0.82, w: pw - 0.16, h: 0.36, fontSize: 6.3, color: th.muted })
      })
      y += 1.35
    }
    const src = (rs.sumber || []).filter(x => x.t).slice(0, 6)
    if (src.length && H - 0.6 - y > 0.7) {
      head(s, M, y, CW, `Sumber utama (${(rs.sumber || []).length} sumber riset)`)
      const n = Math.max(1, Math.min(src.length, Math.floor((H - 0.6 - y - 0.35) / 0.2)))
      src.slice(0, n).forEach((x, i) => T(s, `${i + 1}. ${short(x.t, 120)}`, { x: M, y: y + 0.34 + i * 0.2, w: CW, h: 0.18, fontSize: 6.5, color: th.muted }))
    }
    foot(s, 2)
  }
  return pres
}

export const infoFileName = (t, date, theme) => `${t}_Infografis_${date}_${String(theme?.name || '').replace(/[^A-Za-z0-9]+/g, '-')}.pptx`
