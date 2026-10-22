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

// Kasus penambahan modal untuk satu emiten, atau null bila tidak ada rencana yang relevan.
// A: hasil buildAnalysis; ctx: { aset, sv, item, reports }.
export function riCase(A, { aset = null, sv = null, item = null, reports = [] } = {}) {
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
  }
}

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
