// Analisa penambahan modal: PMHMETD (rights issue), PMTHMETD (private placement), atau penerbitan saham untuk
// merger, dihitung otomatis dari data kurasi (pandangan-analis: dilusi & kalkulator, aset-verified: transaksi &
// KJPP, story-verified) dan profil Stockbit (saham beredar, harga, porsi pengendali/publik).
// Model: nilai penerbitan = saham baru × harga pelaksanaan, terdiri dari setoran aset (inbreng) dan tunai.
// Harga pelaksanaan bisa digeser untuk simulasi.

const PMT_RE = /PMTHMETD|tanpa (memberikan )?HMETD|private placement|penempatan terbatas/i
const PMH_RE = /PMHMETD|rights? issue|dengan (memberikan )?HMETD|\bHMETD\s+[IVX]+\b/i
const MERGER_RE = /merger|penggabungan usaha|peleburan/i
const DONE_RE = /(hasil|pengumuman hasil) (PMHMETD|PMTHMETD|penambahan modal)|telah (selesai|dicatatkan)/i
const EFFECTIVE_RE = /(sudah|telah) (efektif|tereksekusi|dicatatkan|selesai)/i

// Angka "nominal Rp10" pertama di teks: batas bawah harga pelaksanaan.
const nominalOf = s => { const m = String(s || '').match(/nominal\s*Rp\s?([\d.]+)/i); return m ? +m[1].replace(/\./g, '') || null : null }

// Semua angka nilai di teks bebas → Rupiah (USD dikonversi pada kurs asumsi). Dipakai untuk kisaran nilai aset
// bila sumber berbeda-beda (mis. "USD150 juta (Rp2,51 triliun) ... USD100 juta (Rp1,8 triliun)").
export const KURS_USD = 16500
const UNIT = { triliun: 1e12, t: 1e12, miliar: 1e9, m: 1e9, juta: 1e6, jt: 1e6 }
const numId = s => +String(s).replace(/\./g, '').replace(',', '.')
export function valuesOf(text) {
  const out = []
  const s = String(text || '')
  for (const m of s.matchAll(/(USD|US\$|\$)\s?([\d.,]+)\s*(triliun|miliar|juta|T|M|jt)?\b/gi)) {
    const u = UNIT[String(m[3] || '').toLowerCase()] || 1
    const v = numId(m[2]) * u * KURS_USD
    if (v > 1e9) out.push(v)
  }
  for (const m of s.matchAll(/Rp\s?([\d.,]+)\s*(triliun|miliar|juta|T|M|jt)?\b/gi)) {
    const u = UNIT[String(m[2] || '').toLowerCase()] || 1
    const v = numId(m[1]) * u
    if (v > 1e9) out.push(v)
  }
  return out
}

// Rincian aset injeksi dari aset-verified: kisaran nilai antar-sumber, profil aset, data tambang/keuangan yang
// tersedia, cara bayar, status penilaian, dan data yang belum diungkap.
const TAMBANG = { cadangan: 'Cadangan', sumberDaya: 'Sumber daya', kalori: 'Kalori', produksi: 'Produksi', iup: 'Izin/konsesi' }
const KEU = { pendapatan: 'Pendapatan', ebitda: 'EBITDA', labaBersih: 'Laba bersih', totalAset: 'Total aset', ekuitas: 'Ekuitas', utang: 'Utang' }
export function asetDetail(aset, inj) {
  if (!aset) return null
  const a = aset.aset || {}, t = aset.transaksi || {}, k = aset.kjpp || {}
  // Hanya angka di sekitar nilai transaksi (0,5×–2×) yang dianggap versi lain dari nilai yang sama; angka komponen
  // (biaya, sebagian aset, kurs) diabaikan agar kisaran tidak menyesatkan.
  const vals = [...valuesOf(t.nilai).filter(v => !inj || (v >= inj * 0.5 && v <= inj * 2)), ...(inj ? [inj] : [])]
  const lo = vals.length ? Math.min(...vals) : null, hi = vals.length ? Math.max(...vals) : null
  const facts = [
    ...Object.entries(TAMBANG).filter(([f]) => a.tambang?.[f]).map(([f, l]) => [l, a.tambang[f]]),
    ...Object.entries(KEU).filter(([f]) => a.keuangan?.[f] != null).map(([f, l]) => [l + (a.keuangan.periode ? ` (${a.keuangan.periode})` : ''), a.keuangan[f]]),
  ]
  return {
    nama: a.nama || '', jenis: a.jenis || '', lokasi: a.lokasi || '', porsi: a.porsi || '', deskripsi: a.deskripsi || '',
    lo, hi, spread: lo && hi && hi > lo * 1.05, nilaiText: t.nilai || '', cara: t.caraBayar || '',
    facts, kjpp: { status: k.status || '', nama: k.nama || '', nilai: k.nilaiRp || null, metode: k.metode || '', ket: k.kesimpulan || k.dasar || '' },
    gaps: (aset.tidakDitemukan || []).map(g => String(g).replace(/^[\w.\/]+:\s*/, '')),
  }
}

// Keterbukaan terkait penambahan modal (bukan laporan penggunaan dana IPO).
const RI_REP = /HMETD|rights? issue|penambahan modal|PMTHMETD|PMHMETD|prospektus|pernyataan efektif|pembeli siaga|private placement|penempatan terbatas|penawaran umum terbatas/i
const NOT_RI = /penggunaan dana hasil penawaran umum(?! terbatas)/i
const REP_DONE = /hasil (pelaksanaan )?(penambahan modal|PMTHMETD|PMHMETD|penawaran umum terbatas|private placement)|penambahan jumlah saham setelah|(private placement|rights? issue|PMTHMETD|PMHMETD)[^.]*\btuntas\b|pencatatan saham (baru )?hasil/i
const REP_EXEC = /prospektus|pernyataan efektif|jadwal (pelaksanaan|perdagangan)|perdagangan HMETD/i
const RUPS_OK = /risalah RUPS|hasil RUPS|ringkasan risalah/i
const STANDBY_NO = /(belum ada|tanpa|tidak ada|belum ditunjuk|belum menunjuk)\s+(adanya\s+)?pembeli siaga/gi

// Keterbukaan terakhir, tahap proses, dan sinyal pembeli siaga untuk menilai apakah dana bisa terkumpul.
function fundingFacts(reports, texts) {
  const reps = (reports || []).filter(x => RI_REP.test(x.title || '') && !NOT_RI.test(x.title || ''))
    .map(x => ({ date: String(x.date || '').slice(0, 10), title: String(x.title || '').replace(/\s+/g, ' ').trim() }))
    .sort((a, b) => b.date.localeCompare(a.date))
  // Persetujuan RUPS harus sesudah pengumuman rencana terakhir (risalah RUPS lama tidak dihitung).
  const plan = reps.find(x => !REP_DONE.test(x.title) && !REP_EXEC.test(x.title))?.date || ''
  const rupsOk = (reports || []).some(x => RUPS_OK.test(x.title || '') && plan && String(x.date || '').slice(0, 10) > plan) ||
    /(telah |sudah )?disetujui (dalam |oleh )?RUPS|RUPSLB[^.]{0,60}menyetujui/i.test(texts)
  const stage = reps.some(x => REP_DONE.test(x.title)) ? 'tereksekusi'
    : reps.some(x => REP_EXEC.test(x.title)) || /cum[- ]?date|pernyataan efektif/i.test(texts) ? 'pelaksanaan' : rupsOk ? 'disetujui' : 'rencana'
  // Pembeli siaga: "belum ada/tanpa pembeli siaga" = tidak; penyebutan lain = ada/direncanakan.
  const noSb = STANDBY_NO.test(texts); STANDBY_NO.lastIndex = 0
  const rest = texts.replace(STANDBY_NO, ' ')
  // Kalimat asumsi/syarat ("pengendali atau pembeli siaga menyerap", "pantau komitmen ...") bukan komitmen.
  const sbSentence = (rest.match(/[^.]*(pembeli siaga|standby buyer)[^.]*\./gi) || [])
    .find(x => !/asumsi|diasumsikan|\batau pembeli siaga|pantau|\bbila\b|\bjika\b|kemungkinan|seandainya/i.test(x))
  return { last: reps[0] || null, nReps: reps.length, stage, rupsOk, standby: sbSentence ? 'ya' : noSb ? 'tidak' : '', standbyText: (sbSentence || '').trim() }
}

// Kasus penambahan modal untuk satu emiten, atau null bila tidak ada rencana yang relevan.
// A: hasil buildAnalysis; ctx: { aset, sv, item, reports }.
export function riCase(A, { aset = null, sv = null, item = null, reports = [], pv = null } = {}) {
  if (!A) return null
  const pa = A.pa || {}, dl = pa.dilusi || {}, k = pa.kalkulator || {}
  const sigEv = (item?.signals?.rights?.ev || []).map(e => e.text)
  // Hanya keterbukaan setahun terakhir; narasi yang menyangkal ("tanpa rights issue") diabaikan.
  const yearAgo = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10)
  const repT = (reports || []).filter(r => !r.date || String(r.date) >= yearAgo).slice(0, 40).map(r => r.title)
  const strip = s => String(s || '').replace(/(tanpa|bukan|belum ada|tidak ada|tidak melalui)\s+(rights? issue|PMHMETD|PMTHMETD|HMETD|private placement)/gi, ' ')
  const cara = `${aset?.transaksi?.caraBayar || ''} ${sv?.injectType || ''}`
  const spec = strip([cara, k.dasar, dl.asumsi, dl.catatan, sv?.note].filter(Boolean).join(' · '))
  const evidence = [spec, ...sigEv, ...repT].join(' · ')
  const inbreng = /inbreng|tukar saham|integrasi aset|penyetoran (saham )?(dalam bentuk )?(lain )?selain uang|konversi utang/i.test(`${cara} ${k.dasar || ''}`)
  const merger = MERGER_RE.test(cara)
  const isH = PMH_RE.test(evidence)
  const isT = PMT_RE.test(evidence) || (inbreng && !PMH_RE.test(spec))
  const inj = aset?.transaksi?.nilaiRp || A.injRp || null
  const N = dl.berlaku ? dl.sahamBaru || null : null
  const V = k.nilaiDibayarSaham || 0, cash = k.kasSegar || 0
  // Perlu bukti konkret: jumlah saham baru, kas, nilai setoran, atau jenis penambahan modal + nilai aset.
  if (!N && !cash && !V && !((isT || isH) && inj)) return null
  const kind = merger ? 'merger' : isH && isT ? 'campuran' : isT ? 'PMTHMETD' : 'PMHMETD'
  const S0 = dl.sahamSekarang || A.shares || null
  const price = A.price || null
  const exAssumed = /asumsi/i.test(`${k.dasar || ''} ${dl.asumsi || ''}`)
  const nominal = nominalOf(spec) || nominalOf(repT.join(' '))
  const done = !!k.sudahTereksekusi || EFFECTIVE_RE.test(`${dl.asumsi || ''} ${k.dasar || ''}`) || (DONE_RE.test(repT.slice(0, 15).join(' ')) && !N)
  // Harga pelaksanaan: resmi/asumsi data → tersirat (nilai aset ÷ saham baru) → harga pasar.
  const implied = !k.hargaPelaksanaan && inj && N ? inj / N : null
  return {
    kind, label: { PMTHMETD: 'PMTHMETD (private placement)', campuran: 'PMHMETD & PMTHMETD', merger: 'penerbitan saham merger', PMHMETD: 'PMHMETD (rights issue)' }[kind],
    status: done ? 'tereksekusi' : item?.ms?.rights ? 'berjalan' : 'rencana',
    jadwal: sv?.target || '', S0, N, price, ex: k.hargaPelaksanaan || null, exAssumed, implied, nominal,
    V, cash, inj, injCara: aset?.transaksi?.caraBayar || '', injTarget: sv?.injectTarget || aset?.aset?.nama || '', inbreng,
    // Aset dibayar saham pada tahap terpisah (bukan bagian dari saham baru N), mis. NINE tahap II.
    laterInj: inbreng && inj && !V && N && !implied && kind !== 'merger' ? inj : null,
    kjpp: aset?.kjpp?.nilaiRp || null, kjppStatus: aset?.kjpp?.status || '',
    ctrlPct: A.ctrlPct ?? null, float: A.flt ?? dl.porsiPublikSekarang ?? null, mcap: A.mcap || null, equity: A.equity ?? null,
    notes: [k.dasar, dl.asumsi].filter(Boolean),
    detail: asetDetail(aset, inj),
    // Sumber keterbukaan di data kurasi (story-verified) ikut dihitung bila tidak ada di daftar laporan.
    funding: fundingFacts([...(reports || []), ...(sv?.sourceTitle ? [{ date: sv.sourceDate, title: sv.sourceTitle }] : [])], [spec, pv && [pv.siapa, pv.grup, pv.rencana, pv.catatan].join(' '), pa.tesis, pa.ringkas, ...sigEv].filter(Boolean).join(' ')),
    // Perubahan bersih porsi pengendali 365 hari (keterbukaan ≥5%); negatif = pengendali menjual.
    ctrlNet: typeof A.isCtrlH === 'function' ? (A.holders || []).filter(A.isCtrlH).reduce((s, h) => s + (h.change || 0), 0) : null,
    avgVal: A.avgVal ?? null,
  }
}

// Penilaian: apakah dana penambahan modal kemungkinan terkumpul, berdasarkan keterbukaan terakhir dan struktur
// transaksi. Mengembalikan { key, label, tone, score, reasons: [{ s: +1|-1|0, t }], last }.
export function riFunding(c, r) {
  if (!c || !r) return null
  const f = c.funding || {}
  const why = []
  const add = (s, t) => why.push({ s, t })
  const done = c.status === 'tereksekusi' || f.stage === 'tereksekusi'
  if (done) {
    add(1, f.last && REP_DONE.test(f.last.title) ? `Keterbukaan hasil pelaksanaan sudah terbit (${f.last.title}).` : 'Penambahan modal sudah tereksekusi; saham baru sudah tercatat.')
    if (c.kind === 'PMTHMETD' || c.kind === 'merger') add(1, 'Penyerap saham baru sudah ditentukan sejak awal (bukan dana publik).')
    return { key: 'done', label: 'Sudah tercapai', tone: 'good', score: 9, reasons: why, last: f.last }
  }
  let sc = 0
  const plus = (n, t) => { sc += n; add(n > 0 ? 1 : n < 0 ? -1 : 0, t) }
  const asetShare = r.total > 0 ? r.aset / r.total : 0
  const nonCash = asetShare >= 0.95
  const tunaiMcap = c.mcap ? r.tunai / c.mcap : null
  if (asetShare >= 0.8) plus(2, `${nonCash ? 'Hampir seluruh' : Math.round(asetShare * 100) + '%'} penerbitan disetor aset (${bigTxt(r.aset)}) oleh pemilik aset, bukan dana pasar.`)
  if (!nonCash && tunaiMcap != null) {
    if (tunaiMcap > 3) plus(-3, `Dana tunai ${fx(tunaiMcap)} kapitalisasi pasar: terlalu besar untuk diserap pasar tanpa penyandang dana kuat.`)
    else if (tunaiMcap > 1) plus(-2, `Dana tunai ${fx(tunaiMcap)} kapitalisasi pasar: besar dibanding nilai emiten.`)
    else if (tunaiMcap > 0.3) plus(0, `Dana tunai ${Math.round(tunaiMcap * 100)}% kapitalisasi pasar: moderat.`)
    else plus(1, `Dana tunai hanya ${Math.round(tunaiMcap * 100)}% kapitalisasi pasar: relatif kecil.`)
  }
  if (c.kind !== 'PMTHMETD' && c.kind !== 'merger' && !nonCash) {
    if (f.standby === 'ya') plus(2, `Ada pembeli siaga/komitmen penyerapan: ${shortTxt(f.standbyText, 160)}`)
    else if (f.standby === 'tidak') plus(-2, 'Belum ada pembeli siaga: bila publik tidak menebus, dana tidak terjamin.')
    else plus(-1, 'Pembeli siaga belum diungkap di keterbukaan.')
  } else if (c.kind === 'PMTHMETD' && !nonCash) {
    plus(f.standby === 'ya' || /diserap|investor/i.test(c.notes.join(' ')) ? 1 : 0, 'PMTHMETD: dana bergantung pada investor yang ditunjuk, bukan publik.')
  }
  if (r.disc != null && !nonCash) {
    if (r.disc > 0.05) plus(-2, `Harga pelaksanaan ${Math.round(r.disc * 100)}% di atas harga pasar: publik cenderung tidak menebus.`)
    else if (r.disc < -0.2) plus(1, `Harga pelaksanaan diskon ${Math.round(-r.disc * 100)}% dari pasar: menarik untuk ditebus.`)
  }
  if (c.ctrlNet != null && c.ctrlNet < -1) plus(-1, `Pengendali justru mengurangi porsi ${Math.abs(c.ctrlNet).toFixed(1).replace('.', ',')} poin dalam setahun.`)
  else if (c.ctrlNet != null && c.ctrlNet > 1) plus(1, `Pengendali menambah porsi ${c.ctrlNet.toFixed(1).replace('.', ',')} poin dalam setahun.`)
  // RUPS yang dijadwalkan di masa depan berarti rencana belum disetujui.
  const rupsLater = /RUPS/i.test(c.jadwal || '') && (dateIn(c.jadwal) || '') > new Date().toISOString().slice(0, 10)
  if (f.stage === 'pelaksanaan') plus(1, 'Sudah masuk tahap pelaksanaan (prospektus/pernyataan efektif).')
  else if (f.rupsOk && !rupsLater) plus(1, 'Rencana sudah disetujui RUPS.')
  else plus(0, `Belum disetujui RUPS${c.jadwal ? ` (${shortTxt(c.jadwal, 60)})` : ''}; rencana masih bisa berubah atau batal.`)
  if (c.inj && c.kjppStatus === 'belum' && (c.V || c.laterInj)) plus(-1, 'Nilai aset belum dinilai KJPP: jadwal bisa mundur.')
  if (!f.last) plus(-1, 'Belum ada keterbukaan resmi tentang penambahan modal di Stockbit Reports.')
  const key = sc >= 3 ? 'likely' : sc >= 0 ? 'maybe' : 'doubt'
  return {
    key, score: sc, last: f.last, reasons: why,
    label: { likely: 'Kemungkinan besar tercapai', maybe: 'Bisa tercapai, bersyarat', doubt: 'Diragukan tercapai' }[key],
    tone: { likely: 'good', maybe: 'warn', doubt: 'strong' }[key],
  }
}
// Tanggal pertama "18 November 2026" / "18 Nov 2026" di teks → YYYY-MM-DD.
const BULAN = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des']
function dateIn(s) {
  const m = String(s || '').match(/(\d{1,2})\s+(jan|feb|mar|apr|mei|jun|jul|agu|ags|sep|okt|nov|des)\w*\s+(\d{4})/i)
  if (!m) return null
  const mo = BULAN.indexOf(m[2].toLowerCase().replace('ags', 'agu')) + 1
  return `${m[3]}-${String(mo).padStart(2, '0')}-${m[1].padStart(2, '0')}`
}
const bigTxt = v => v >= 1e12 ? `Rp${(v / 1e12).toLocaleString('id-ID', { maximumFractionDigits: 2 })} T` : `Rp${(v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`
const fx = v => v.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '×'
const shortTxt = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, t.lastIndexOf(' ', n - 1) > n * 0.6 ? t.lastIndexOf(' ', n - 1) : n - 1) + '…' : t }

export const noRights = c => c?.kind === 'PMTHMETD' || c?.kind === 'merger'

// Hitungan pada harga pelaksanaan P dan tingkat penebusan publik u (0–1).
export function riCalc(c, P, u = 0) {
  if (!c || !(P > 0) || !(c.S0 > 0)) return null
  // Saham baru: dari data; bila belum ada, (setoran aset + tunai, atau nilai aset) ÷ P.
  const N = c.N || ((c.V || 0) + (c.cash || 0) || c.inj || 0) / P
  if (!(N > 0)) return null
  const S0 = c.S0, S1 = S0 + N, total = N * P
  const aset = Math.min(c.V || (c.kind === 'merger' ? total : 0), total), tunai = total - aset
  const ctrl = (c.ctrlPct || 0) / 100, pub = (c.float || 0) / 100
  const nr = noRights(c)
  // TERP: harga teoretis setelah penerbitan = (nilai pasar lama + nilai baru) ÷ total saham.
  const terp = c.price ? (S0 * c.price + total) / S1 : null
  const pubAfter = nr ? pub * S0 / S1 : (pub * S0 + pub * N * u) / S1
  const injShares = c.laterInj ? c.laterInj / P : 0
  return {
    N, S1, total, aset, tunai, ratio: N / S0, terp, hak: terp != null && !nr ? terp - P : null, disc: c.price ? P / c.price - 1 : null,
    ctrlPart: nr ? null : ctrl * total, pubPart: nr ? null : pub * total, standby: nr ? null : pub * total * (1 - u),
    ctrlAfterAbsorb: nr ? null : (ctrl * S0 + ctrl * N + pub * N * (1 - u)) / S1,
    newHolder: N / S1, ctrlAfterNr: ctrl * S0 / S1,
    pubAfter, injShares, pubAfterInj: injShares ? pubAfter * S1 / (S1 + injShares) : null,
    dilusi: 1 - S0 / S1, perLot: { hak: 100 * N / S0, dana: 100 * N / S0 * P },
    cover: c.inj ? total / c.inj : null, gap: c.inj ? c.inj - total : null,
    vsMcap: c.mcap ? total / c.mcap : null,
  }
}

// Rentang slider harga pelaksanaan: dari nominal (atau 10% harga) sampai 150% dari harga tertinggi yang relevan.
export function riRange(c) {
  const start = c?.ex || c?.implied || c?.price || 100
  const top = Math.max(c?.price || 0, start)
  const lo = Math.max(1, Math.floor(Math.min(c?.nominal || top * 0.1, start)))
  const hi = Math.max(lo + 1, Math.round(top * 1.5))
  return { lo, hi, step: hi > 2000 ? 5 : 1, start: Math.round(start) }
}

const fmtX = v => v.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '×'
const pc = v => Math.round(v * 100) + '%'

// Kesimpulan singkat otomatis.
export function riVerdict(c, r) {
  if (!c || !r) return ''
  const out = []
  if (r.vsMcap != null) {
    if (r.aset >= r.total * 0.95) out.push(`Penerbitan dibayar aset senilai ${fmtX(r.vsMcap)} kapitalisasi pasar: nilai wajar aset menentukan apakah pemegang lama untung atau terdilusi.`)
    else out.push(r.vsMcap >= 1 ? `Dana tunai yang dibutuhkan ${fmtX(r.tunai / c.mcap)} kapitalisasi pasar: penyerapan sangat bergantung pada pengendali/pembeli siaga.` : `Nilai penerbitan setara ${pc(r.vsMcap)} kapitalisasi pasar.`)
  }
  if (r.cover != null && r.cover < 0.95 && !c.laterInj) out.push(`Nilai penerbitan hanya menutup ${pc(r.cover)} nilai aset; sisanya perlu utang, kas internal, atau tahap lanjutan.`)
  if (c.kjpp && c.inj) out.push(c.inj > c.kjpp * 1.05 ? `Harga aset ${pc(c.inj / c.kjpp - 1)} di atas penilaian KJPP.` : 'Harga aset sejalan dengan penilaian KJPP.')
  else if (c.inj && c.kjppStatus === 'belum') out.push('Nilai aset belum diuji KJPP.')
  if (r.disc != null && r.disc < -0.3) out.push(`Harga pelaksanaan diskon ${pc(-r.disc)} dari pasar: tekanan harga ke arah TERP.`)
  if (r.pubAfter < 0.075) out.push(`Bila publik tidak menebus, porsi publik turun ke ${(r.pubAfter * 100).toFixed(1).replace('.', ',')}% (di bawah batas free float 7,5%).`)
  return out.join(' ')
}
