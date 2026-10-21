// Teks perubahan dari /api/diff (snapshot harian server); dipakai panel Berubah dan kartu Hari ini.
export const MS_SHORT = { spa: 'PPJB', akuisisi: 'akuisisi efektif', to_umum: 'PTW diumumkan', to_selesai: 'PTW selesai', rupslb: 'RUPSLB',
  rights: 'rights issue', kjpp: 'KJPP terbit', inbreng: 'injeksi efektif', bisnis: 'usaha baru' }
export const fmtPct = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '%'
const rp = v => v == null ? '–' : Number(v).toLocaleString('id-ID')

export function chText(c) {
  if (c.k === 'price') return `harga ${rp(c.from)} → ${rp(c.to)} (${fmtPct(c.pct)})`
  if (c.k === 'ctrl') return `pengendali ${c.from == null ? '–' : rp(c.from) + '%'} → ${rp(c.to)}%${c.name ? ' (' + c.name + ')' : ''}`
  if (c.k === 'ms') return 'tahap: ' + c.added.map(m => MS_SHORT[m] || m).join(', ')
  if (c.k === 'tender') return `harga tender ${rp(c.from)} → ${rp(c.to)}`
  if (c.k === 'reports') return `${c.n} laporan baru`
  if (c.k === 'new') return 'baru masuk radar'
  return ''
}

// Harga hanya dihitung bila bergerak ≥ 3%, supaya daftar berisi perubahan yang berarti.
export const meaningful = changes => (changes || []).filter(c => c.k !== 'price' || Math.abs(c.pct) >= 3)
