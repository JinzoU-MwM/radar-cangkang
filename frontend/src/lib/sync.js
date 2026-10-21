// Sinkron data dari Stockbit lewat server lokal (port syncTenders/syncStockbit/syncReportsRun dari app.js lama).
// `api.get(path, params)` mengembalikan JSON atau melempar Error dengan `.status`. Input tidak dimutasi.
// Kegagalan per sumber dikumpulkan sebagai { source, error } (tidak memanggil toast).
import { stageOf } from './domain.js'
import { backdoorTickers } from './news.js'

const sleep = ms => ms > 0 ? new Promise(res => setTimeout(res, ms)) : Promise.resolve()
const errText = e => e?.status ? (e.message || String(e.status)) : 'server lokal tidak merespons'
const nowIso = () => new Date().toISOString()
// Salinan dalam lewat JSON: input bisa berupa reactive proxy Vue, yang ditolak structuredClone.
const clone = v => JSON.parse(JSON.stringify(v))

// Tarik semua penawaran tender wajib BEI: emiten baru masuk daftar, tonggak diisi dari jadwal PTW
// (hanya dinyalakan, tidak pernah dimatikan). opts.errors (opsional) menampung kegagalan.
export async function syncTenders(items, api, { errors = [] } = {}) {
  let list = clone(items)
  let j
  try { j = await api.get('/api/tenders') } catch (e) { errors.push({ source: 'Daftar tender', error: errText(e) }); return list }
  const today = nowIso().slice(0, 10)
  // Pengambilalihan yang bukan backdoor (config "exclude") dikeluarkan dari daftar.
  const excl = new Set(j.exclude || [])
  list = list.filter(x => !excl.has(x.ticker))
  for (const t of j.items || []) {
    const hasTender = !!t.paydate
    const settled = hasTender && t.paydate <= today
    const tender = hasTender ? { price: t.price, percent: t.percent, start: t.start, end: t.end, paydate: t.paydate, active: t.active } : null
    const note = hasTender
      ? `PTW Rp${t.price}/saham untuk ${String(t.percent).replace('.', ',')}% saham, periode ${t.start} s.d. ${t.end}, pembayaran ${t.paydate} (Stockbit).`
      : 'Masuk daftar backdoor (config). Penawaran tender wajib dan laporan pengambilalihan belum ditemukan di Stockbit; tahap belum terverifikasi, cek keterbukaan informasi BEI.'
    // Tanpa data tender: perubahan pengendali diketahui, tahap tender belum terverifikasi.
    const msNew = hasTender ? { spa: true, akuisisi: true, to_umum: true, ...(settled ? { to_selesai: true } : {}) } : { spa: true }
    const i = list.findIndex(x => x.id === t.ticker)
    if (i < 0) {
      list.push({ id: t.ticker, ticker: t.ticker, name: t.name || '', stage: 'tender', flags: { akuisisi: true },
        ms: msNew, ...(tender ? { tender } : {}), confirmed: !!t.confirmed, notes: note, updatedAt: nowIso() })
    } else {
      const d = list[i]
      if (tender) d.tender = tender
      if (t.confirmed) d.confirmed = true
      d.flags = { ...(d.flags || {}), akuisisi: true }
      d.ms = { ...(d.ms || {}), ...msNew }
      if (stageOf(d) === 'radar' || stageOf(d) === 'spa') d.stage = 'tender'
      if (!(d.notes || '').includes(note)) d.notes = [d.notes, note].filter(Boolean).join('\n')
    }
  }
  return list
}

// Harga, kapitalisasi, porsi publik & pengendali per emiten. Berhenti total bila token ditolak (401).
// opts.ownership=false melewati /api/ownership (butuh token); opts.delay = jeda antarpermintaan (ms);
// opts.onProgress(i, n) dipanggil sebelum tiap emiten (i mulai 1).
export async function syncStockbit(items, api, { errors = [], ownership = true, delay = 400, onProgress } = {}) {
  const list = clone(items)
  for (const [k, next] of list.entries()) {
    onProgress?.(k + 1, list.length)
    let q
    try { q = await api.get('/api/quote', { ticker: next.ticker }) } catch (e) {
      errors.push({ source: next.ticker, error: errText(e) })
      if (e?.status === 401) break   // token bermasalah, hentikan semua
      await sleep(delay); continue
    }
    if (q.price != null) next.price = q.price
    if (q.mcap != null) next.mcap = Math.round(q.mcap * 10) / 10
    if (q.float != null) next.float = q.float
    if (q.pctChange != null) next.chgPct = q.pctChange
    next.volRatio = q.volume && q.avgVolume ? Math.round(q.volume / q.avgVolume * 10) / 10 : null
    if (!next.name && q.name) next.name = q.name
    // Sinyal dari data pasar hanya dinyalakan, tidak dimatikan; keputusan mematikan tetap di analis.
    next.flags = { ...(next.flags || {}) }
    if (q.uma) next.flags.uma = true
    if (q.volume && q.avgVolume && q.volume >= 3 * q.avgVolume) next.flags.volume = true
    if (ownership) {
      const o = await api.get('/api/ownership', { ticker: next.ticker }).catch(() => null)
      if (o) {
        if (o.marketCap) next.mcap = Math.round(o.marketCap / 1e8) / 10   // rupiah → Rp miliar
        if (o.freeFloat != null) next.float = o.freeFloat
        next.ctrlPct = o.controllerPct; next.ctrlName = o.controllerName || ''; next.ctrlGuess = !!o.controllerGuess
      }
    }
    next.updatedAt = nowIso()
    await sleep(delay)   // jeda agar tidak membanjiri Stockbit
  }
  return list
}

// Deteksi tonggak sesudah pengambilalihan dari judul Stockbit Reports.
// Hanya laporan yang terbit SETELAH PTW dibayar, agar aksi pengendali lama tidak terhitung.
const MS_RULES = [
  ['rupslb',  /risalah.*(luar biasa|RUPSLB)|hasil.*RUPSLB/i],
  // HMETD hanya bila ada bukti persetujuan/pelaksanaan, bukan sekadar rencana atau penjelasan bursa.
  ['rights',  /^(?!.*(rencana|penjelasan|permintaan)).*((HMETD|hak memesan efek|private placement|penambahan modal).*(disetujui|persetujuan|pernyataan efektif|prospektus|hasil pelaksanaan|pencatatan)|(prospektus|pernyataan efektif|hasil pelaksanaan|pencatatan saham).*(HMETD|hak memesan|penambahan modal))/i],
  // Laporan penilai terbit (bukan sekadar penunjukan KJPP).
  ['kjpp',    /^(?!.*penunjukan).*(laporan penilai|hasil penilaian|pendapat kewajaran|fairness opinion|ringkasan laporan penilai)/i],
  // Injeksi efektif: laporan pelaksanaan akuisisi/inbreng, bukan rencana, penunjukan penilai, atau negosiasi.
  ['inbreng', /^(?!.*(rencana|penunjukan|persiapan|penjelasan|permintaan|perkembangan|negosiasi|uang muka)).*(inbreng|penyetoran.*selain uang|akuisisi|akusisi|pengambilalihan.{0,40}saham)/i],
]
// Untuk emiten tanpa data tender di Stockbit: tahap tender dibaca dari judul laporan.
const TENDER_RULES = [
  ['to_umum',    /penawaran tender|tender offer/i],
  ['to_selesai', /hasil.*penawaran tender|laporan.*hasil.*tender|penyelesaian.*penawaran tender/i],
]
const TAKEOVER_RE = /pengalihan saham|pengambilalihan|pengendali|perjanjian jual beli saham/i

// Tahapan dari laporan (RUPSLB, HMETD, KJPP, injeksi, usaha baru) hanya diakui bila ada bukti laporannya.
// Mengembalikan salinan item yang dibersihkan + daftar yang dihapus, untuk uji coba sebelum disimpan:
// tanpa tanggal bukti (sisa input manual/versi lama), bukti terbit sebelum PTW dibayar, atau laporan
// pada tanggal itu tidak lagi lolos aturan deteksi yang sudah diperketat.
export function sanitizeMilestones(items, updates) {
  const RULE = Object.fromEntries(MS_RULES)
  const removed = []
  const out = items.map(d => {
    if (!d.ms) return d
    const ms = { ...d.ms }, auto = { ...(d.msAuto || {}) }
    const paid = ms.to_selesai && d.tender?.paydate
    const gone = []
    for (const k of ['rupslb', 'rights', 'kjpp', 'inbreng', 'bisnis']) {
      if (!ms[k]) continue
      let why = ''
      if (!auto[k]) why = 'tanpa tanggal bukti'
      else if (paid && auto[k] <= paid) why = 'bukti sebelum PTW dibayar'
      else {
        const same = (updates || []).filter(u => u.ticker === d.ticker && u.date === auto[k] && /^sb-report-/.test(u.id || ''))
        if (RULE[k] && same.length && !same.some(u => RULE[k].test(u.title || ''))) why = 'laporan tidak lolos aturan terbaru'
      }
      if (!why) continue
      delete ms[k]; delete auto[k]
      gone.push({ tahap: k, why })
    }
    if (!gone.length) return d
    removed.push({ ticker: d.ticker, gone })
    return { ...d, ms, msAuto: auto }
  })
  return { items: out, removed }
}

// Item baru dengan ms/msAuto terisi (msAuto = tanggal deteksi otomatis); item yang sama bila tak ada patokan.
export function inferMilestones(d, reports) {
  const ms = { ...(d.ms || {}) }, auto = { ...(d.msAuto || {}) }
  // Patokan: tanggal PTW dibayar; bila tidak ada data tender, laporan pengambilalihan paling awal.
  let base = ms.to_selesai && d.tender && d.tender.paydate
  if (!d.tender) {
    const first = reports.filter(r => r.date && TAKEOVER_RE.test(r.title)).map(r => r.date).sort()[0]
    if (!first) return d
    if (!ms.akuisisi) { ms.akuisisi = true; auto.akuisisi = first }
    for (const r of reports) {
      if (!r.date || r.date < first) continue
      for (const [m, re] of TENDER_RULES) if (!ms[m] && re.test(r.title)) { ms[m] = true; auto[m] = r.date }
    }
    base = first
  }
  if (!base) return { ...d, ms, msAuto: auto }
  // Aturan diperketat: deteksi otomatis lama yang masih tercakup laporan kali ini dihitung ulang,
  // agar tahapan dari judul "rencana"/"penjelasan" tidak menggelembungkan progress.
  const oldest = reports.map(r => r.date).filter(Boolean).sort()[0]
  for (const k of ['rights', 'inbreng', 'kjpp']) if (oldest && auto[k] && auto[k] >= oldest) { delete ms[k]; delete auto[k] }
  for (const r of reports) {
    if (!r.date || r.date <= base) continue
    // Tanpa data tender, laporan lanjutan pengambilalihan itu sendiri jangan dihitung sebagai injeksi aset.
    if (!d.tender && TAKEOVER_RE.test(r.title)) continue
    for (const [m, re] of MS_RULES) if (!ms[m] && re.test(r.title)) { ms[m] = true; auto[m] = r.date }
  }
  return { ...d, ms, msAuto: auto }
}

// Stockbit Reports per emiten backdoor + berita media. Item digabung berdasarkan id agar tidak dobel.
// opts: reports/news = fitur aktif, tickers = daftar kode (bawaan: emiten backdoor), delay (ms),
// onProgress(i, n) sebelum tiap emiten yang laporannya ditarik.
export async function syncReports(items, updates, api, { news = false, reports = true, tickers, delay = 400, onProgress } = {}) {
  let list = clone(items)
  const upd = clone(updates)
  const errors = []
  let added = 0, addedNews = 0
  const codes = [...(tickers || backdoorTickers(list))].filter(t => /^[A-Z]{4}$/.test(t))
  for (const [k, t] of (reports ? codes : []).entries()) {
    onProgress?.(k + 1, codes.length)
    try {
      const j = await api.get('/api/reports', { ticker: t })
      for (const it of j.items || []) {
        const i = upd.findIndex(u => u.id === it.id)
        // updatedAt = waktu laporan pertama kali masuk radar (dasar penanda "baru" dan diff harian):
        // laporan yang sudah ada hanya diperbarui isinya, stempelnya tidak ikut diganti.
        if (i >= 0) upd[i] = { ...upd[i], ...it, updatedAt: upd[i].updatedAt || nowIso() }
        else { upd.push({ ...it, updatedAt: nowIso() }); added++ }
      }
      list = list.map(d => d.id === t ? inferMilestones(d, j.items || []) : d)
    } catch (e) {
      errors.push({ source: t, error: errText(e) })
      if (e?.status === 401) break
    }
    await sleep(delay)   // jeda agar tidak membanjiri Stockbit
  }
  // Berita media; hanya yang relevan backdoor atau menyebut emiten di radar (disaring server).
  if (news) {
    try {
      const j = await api.get('/api/news', { tickers: codes.join(',') })
      for (const it of j.items || []) {
        const i = upd.findIndex(u => u.id === it.id)
        // Tanggal artikel HTML = tanggal pertama kali terlihat; jangan ditimpa saat pembaruan berikutnya.
        if (i >= 0) upd[i] = { ...upd[i], ...it, date: upd[i].date }
        else { upd.push({ ...it, updatedAt: nowIso() }); addedNews++ }
      }
      for (const e of j.errors || []) errors.push({ source: e.source, error: e.error })
    } catch { errors.push({ source: 'Berita media', error: 'server lokal tidak merespons' }) }
  }
  return { items: list, updates: upd, errors, added, addedNews }
}
