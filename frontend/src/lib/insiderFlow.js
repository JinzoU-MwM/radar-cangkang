// Klasifikasi keterbukaan pemegang saham (feed InsiderNews Stockbit: IDX & KSEI) untuk tab Insider Activity.
// Setiap baris diberi label yang menjelaskan jenis perpindahan saham dan ditandai relevansinya terhadap
// backdoor listing: emiten radar, kandidat, atau potensi (perpindahan besar / indikasi ganti pengendali).

// id → teks, nada (warna tag), dan penjelasan singkat (tooltip & legenda).
export const LABELS = {
  ganti: { text: 'Pergantian pengendali', tone: 't-strong', why: 'Porsi melintasi 50%, pemegang baru langsung ≥20%, atau pemegang ≥20% keluar hingga <5%.' },
  tender: { text: 'Tender offer', tone: 't-strong', why: 'Pembelian lewat penawaran tender (PTW), biasanya sesudah ganti pengendali.' },
  cross: { text: 'Crossing', tone: 't-warn', why: 'Transaksi crossing (pembeli dan penjual lewat broker yang sama/nego), lazim untuk pengalihan blok.' },
  blok: { text: 'Blok besar', tone: 't-warn', why: 'Satu transaksi memindahkan ≥2 poin persen saham.' },
  transfer: { text: 'Pengalihan', tone: 't-warn', why: 'Pengalihan di luar bursa (transfer, hibah, inbreng, atau pelaksanaan perjanjian jual beli).' },
  repoCair: { text: 'Repo: pencairan', tone: 't-strong', why: 'Saham jaminan repo dicairkan/dieksekusi pemberi pinjaman; pemegang bisa kehilangan saham.' },
  repoTop: { text: 'Repo: top up', tone: 't-warn', why: 'Penambahan saham jaminan repo karena nilai jaminan turun.' },
  repo: { text: 'Repo/gadai', tone: 't-warn', why: 'Transaksi terkait repo atau gadai saham.' },
  pp: { text: 'Private placement', tone: 't-calm', why: 'Saham baru dari penambahan modal tanpa HMETD.' },
  ri: { text: 'Rights issue', tone: 't-calm', why: 'Saham baru dari penambahan modal dengan HMETD.' },
  masuk: { text: 'Pemegang baru ≥5%', tone: 't-good', why: 'Porsi naik melewati batas pelaporan 5%.' },
  keluar: { text: 'Turun di bawah 5%', tone: 't-calm', why: 'Porsi turun di bawah 5%; pelaporan berikutnya berhenti.' },
  orangDalam: { text: 'Direksi/komisaris', tone: 't-calm', why: 'Transaksi oleh anggota direksi atau dewan komisaris.' },
}

// Label untuk satu baris. row: { prev, cur, chg, action, purpose, role }.
export function labelsOf(r) {
  const out = []
  const prev = +r.prev || 0, cur = +r.cur || 0, chg = cur - prev
  const purpose = String(r.purpose || '')
  // Rekap KSEI multi-rekening tanpa riwayat: porsi awal tidak diketahui, label berbasis perubahan dilewati.
  const known = !r.prevUnknown
  if (known && ((prev < 50 && cur >= 50) || (prev >= 50 && cur < 50 && chg <= -10) || (prev < 5 && cur >= 20) || (prev >= 20 && cur < 5))) out.push('ganti')
  if (r.action === 'TENDER_OFFER') out.push('tender')
  if (r.action === 'CROSS') out.push('cross')
  if (r.action === 'TRANSFER') out.push('transfer')
  if (/repo|gadai|jaminan|pledge/i.test(purpose)) out.push(/pencairan|eksekusi|force/i.test(purpose) ? 'repoCair' : /top ?up/i.test(purpose) ? 'repoTop' : 'repo')
  if (r.action === 'PRIVATE_PLACEMENT') out.push('pp')
  if (r.action === 'RIGHT_ISSUE') out.push('ri')
  if (known && Math.abs(chg) >= 2 && !out.some(x => ['cross', 'transfer', 'tender', 'pp', 'ri'].includes(x))) out.push('blok')
  if (known && prev < 5 && cur >= 5) out.push('masuk')
  if (known && prev >= 5 && cur < 5 && !out.includes('ganti')) out.push('keluar')
  if (r.role) out.push('orangDalam')
  return out
}

// Relevansi backdoor: 'radar' (emiten di radar), 'kandidat', 'potensi' (perpindahan besar/indikasi ganti
// pengendali di emiten lain), atau '' (tidak relevan).
export function relevanceOf(r, labels, { radar = new Set(), kandidat = new Set() } = {}) {
  if (radar.has(r.ticker)) return 'radar'
  if (kandidat.has(r.ticker)) return 'kandidat'
  const big = !r.prevUnknown && Math.abs((+r.cur || 0) - (+r.prev || 0)) >= 5
  if (labels.includes('ganti') || labels.includes('tender')) return 'potensi'
  if (big && labels.some(x => ['cross', 'transfer', 'blok', 'pp'].includes(x))) return 'potensi'
  if (labels.includes('repoCair') && (+r.prev || 0) >= 20) return 'potensi'
  return ''
}

export const REL_TEXT = { radar: 'Radar', kandidat: 'Kandidat', potensi: 'Potensi backdoor' }

// Baris siap tampil: label + relevansi. Urut terbaru, lalu perubahan terbesar.
// Transaksi yang sama sering dilaporkan IDX dan KSEI: digabung jadi satu baris (sumber "IDX + KSEI").
export function dedupe(rows) {
  const out = [], seen = new Map()
  for (const r of rows || []) {
    const k = [r.ticker, String(r.name).toUpperCase(), r.date, Math.round((+r.cur || 0) * 100)].join('|')
    const hit = seen.get(k)
    if (hit && hit.source !== r.source) {
      hit.source = 'IDX + KSEI'
      hit.broker ||= r.broker
      hit.purpose ||= r.purpose
      continue
    }
    const x = { ...r }
    seen.set(k, x); out.push(x)
  }
  return out
}

export function prepare(rows, ctx = {}) {
  return dedupe(rows).map(r => {
    const labels = labelsOf(r)
    return { ...r, chg: r.chg ?? (+r.cur || 0) - (+r.prev || 0), labels, rel: relevanceOf(r, labels, ctx) }
  }).sort((a, b) => b.date.localeCompare(a.date) || Math.abs(b.chg) - Math.abs(a.chg))
}

// Ringkasan per emiten untuk mode semua: jumlah baris, perubahan bersih terbesar per pemegang, label unik.
export function byTicker(rows) {
  const m = new Map()
  for (const r of rows) {
    const g = m.get(r.ticker) || { ticker: r.ticker, rel: r.rel, n: 0, labels: new Set(), top: null, last: r.date }
    g.n++
    r.labels.forEach(l => g.labels.add(l))
    if (!g.top || Math.abs(r.chg) > Math.abs(g.top.chg)) g.top = r
    if (r.date > g.last) g.last = r.date
    m.set(r.ticker, g)
  }
  const rank = g => (g.labels.includes('ganti') ? 0 : g.labels.includes('tender') ? 1 : g.labels.includes('repoCair') ? 2 : 3)
  return [...m.values()].map(g => ({ ...g, labels: [...g.labels] }))
    .sort((a, b) => rank(a) - rank(b) || Math.abs(b.top.chg) - Math.abs(a.top.chg))
}
