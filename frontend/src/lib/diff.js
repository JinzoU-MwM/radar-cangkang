// Teks perubahan dari /api/diff (snapshot harian server); dipakai panel Berubah dan kartu Hari ini.
export const MS_SHORT = { spa: 'PPJB', akuisisi: 'akuisisi efektif', to_umum: 'PTW diumumkan', to_selesai: 'PTW selesai', rupslb: 'RUPSLB',
  rights: 'rights issue', kjpp: 'KJPP terbit', inbreng: 'injeksi efektif', bisnis: 'usaha baru' }
export const fmtPct = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '%'
const rp = v => v == null ? '–' : Number(v).toLocaleString('id-ID')

// Alasan emiten masuk radar, dari data item (tender Stockbit, pengambilalihan, pengendali, rencana bisnis).
// Singkat satu baris; dipakai di samping label "baru masuk radar".
const dShort = iso => { const d = new Date(String(iso).slice(0, 10) + 'T00:00:00'); return isNaN(d) ? '' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) }
const pctTxt = v => Number(v).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + '%'
export function newReason(item, { verified = {} } = {}) {
  if (!item) return ''
  const parts = []
  const tk = item.storyAuto?.takeover
  const buyer = item.ctrlName || tk?.buyer || ''
  if (item.tender?.price) {
    parts.push(`tender wajib Rp${rp(item.tender.price)}/saham untuk ${pctTxt(item.tender.percent)} saham` +
      (item.tender.start ? ` (${dShort(item.tender.start)}–${dShort(item.tender.end || item.tender.start)})` : ''))
  } else if (item.auto || item.stage === 'radar') {
    const sig = Object.entries(item.signals || {}).filter(([, v]) => v).map(([k]) => k)
    parts.push('kandidat otomatis' + (sig.length ? ': sinyal ' + sig.slice(0, 3).join(', ') : ''))
  } else if (/daftar backdoor \(config\)/.test(item.notes || '')) {
    parts.push('pengalihan pengendali tercatat; tender wajib belum ditemukan')
  }
  if (buyer) parts.push(`pengendali baru ${buyer}${item.ctrlPct != null ? ' ' + pctTxt(item.ctrlPct) : ''}` +
    (tk?.date ? ` sejak ${dShort(tk.date)}` : ''))
  const baru = verified[item.ticker]?.baru
  if (baru) parts.push('rencana: ' + String(baru).toLowerCase())
  return parts.join(' · ')
}

export function chText(c, item = null, ctx = {}) {
  if (c.k === 'price') return `harga ${rp(c.from)} → ${rp(c.to)} (${fmtPct(c.pct)})`
  if (c.k === 'ctrl') return `pengendali ${c.from == null ? '–' : rp(c.from) + '%'} → ${rp(c.to)}%${c.name ? ' (' + c.name + ')' : ''}`
  if (c.k === 'ms') return 'tahap: ' + c.added.map(m => MS_SHORT[m] || m).join(', ')
  if (c.k === 'tender') return `harga tender ${rp(c.from)} → ${rp(c.to)}`
  if (c.k === 'reports') return `${c.n} laporan baru`
  if (c.k === 'new') { const why = newReason(item, ctx); return 'baru masuk radar' + (why ? ' — ' + why : '') }
  return ''
}

// Harga hanya dihitung bila bergerak ≥ 3%, supaya daftar berisi perubahan yang berarti.
export const meaningful = changes => (changes || []).filter(c => c.k !== 'price' || Math.abs(c.pct) >= 3)
