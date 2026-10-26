// Mode Slide halaman emiten: adegan analisa (lib/videoScript.js, versi lengkap) dikelompokkan per tab, plus
// slide khusus untuk tab Insider Activity dan Intel Pasar yang tidak ada di video. Format adegan sama:
// { id, bab, judul, visual: { type, ... }, lines: [kalimat] }.
import { LABELS, prepare } from './insiderFlow.js'
import { big, fmt, fmtDate } from './domain.js'

// Adegan video per tab (urutan mengikuti alur di dalam tab).
export const TAB_SCENES = {
  ringkasan: ['buka', 'tesis', 'rekomendasi', 'penutup'],
  profil: ['profilp', 'pengurus'],
  story: ['pengendali', 'profil', 'transformasi', 'progres'],
  berita: ['berita', 'penjelasan-bursa'],
  analisa: ['skor', 'kasus', 'aset', 'rencana-korporasi', 'valuasi', 'ri', 'ri-kewajaran', 'ri-penilaian', 'ri-bisnis', 'ri-simulasi', 'ri-valuasi', 'ri-kelayakan'],
  teknikal: ['teknikal', 'rencana'],
  spekulasi: ['skenario', 'tindakan'],
}
// Tab yang punya mode Slide (Video dan Download sudah berbentuk ringkasan sendiri).
export const SLIDE_TABS = ['ringkasan', 'profil', 'story', 'insider', 'berita', 'analisa', 'teknikal', 'spekulasi', 'intel']

export const scenesFor = (tab, all) => (TAB_SCENES[tab] || []).map(id => all.find(s => s.id === id)).filter(Boolean)

// Insider Activity: jenis perpindahan kepemilikan dan pemegang dengan perubahan terbesar (data /api/insider-rows).
export function insiderScenes(rows, t) {
  const r = prepare(rows || [])
  if (!r.length) return [{ id: 'insider-kosong', bab: 'Insider Activity', judul: `Belum ada keterbukaan pemegang saham ${t}`, visual: { type: 'list', items: ['Tidak ada data IDX/KSEI untuk emiten ini.'] }, lines: [] }]
  const c = {}
  for (const x of r) for (const l of x.labels) c[l] = (c[l] || 0) + 1
  const jenis = Object.keys(LABELS).filter(k => c[k]).map(k => ({ label: LABELS[k].text, to: c[k] }))
  const max = Math.max(...jenis.map(x => x.to), 1)
  const last = r[0], first = r[r.length - 1]
  // Perubahan bersih per pemegang selama rentang data.
  const m = new Map()
  for (const x of [...r].reverse()) {
    const g = m.get(x.name) || { name: x.name, from: x.prevUnknown ? x.cur : +x.prev || 0, to: +x.cur || 0 }
    g.to = +x.cur || 0; m.set(x.name, g)
  }
  const movers = [...m.values()].map(g => ({ ...g, d: g.to - g.from })).filter(g => Math.abs(g.d) >= 0.01).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 6)
  const pct = v => fmt(v, 2) + '%'
  const S = [{
    id: 'insider-jenis', bab: 'Insider Activity', judul: 'Jenis perpindahan kepemilikan',
    visual: jenis.length ? { type: 'bars', items: jenis, max, unit: '' } : { type: 'kpis', items: [[String(r.length), 'keterbukaan'], [fmtDate(first.date), 'data sejak'], [fmtDate(last.date), 'terakhir']] },
    lines: [
      `${r.length} keterbukaan pemegang saham tercatat sejak ${fmtDate(first.date)}; terakhir ${fmtDate(last.date)}.`,
      jenis.length ? `Jenis terbanyak: ${jenis.slice().sort((a, b) => b.to - a.to).slice(0, 3).map(x => `${x.label} (${x.to})`).join(', ')}.` : null,
      ...Object.keys(LABELS).filter(k => c[k]).slice(0, 4).map(k => `${LABELS[k].text}: ${LABELS[k].why}`),
    ].filter(Boolean),
  }]
  if (movers.length) S.push({
    id: 'insider-pemegang', bab: 'Insider Activity', judul: 'Perubahan kepemilikan terbesar',
    visual: { type: 'bars', items: movers.map(g => ({ label: g.name, from: g.from, to: g.to })), max: Math.max(...movers.map(g => Math.max(g.from, g.to)), 1), unit: '%' },
    lines: movers.map(g => `${g.name}: ${pct(g.from)} → ${pct(g.to)} (${g.d > 0 ? '+' : '−'}${fmt(Math.abs(g.d), 2)} poin).`),
  })
  return S
}

// Intel Pasar: ringkasan data tradersaham.com (/api/tsa/summary).
const REG = { ACCUMULATION: 'akumulasi', ACCUM: 'akumulasi', MILD_ACCUMULATION: 'akumulasi ringan', FLIP_BUY: 'berbalik beli',
  DISTRIBUTION: 'distribusi', DIST: 'distribusi', MILD_DISTRIBUTION: 'distribusi ringan', FLIP_SELL: 'berbalik jual', NEUTRAL: 'netral' }
const rpNet = v => v == null ? '–' : (v < 0 ? '−' : '+') + big(Math.abs(v))
export function intelScenes(data, t) {
  if (!data || !data.ada) return [{ id: 'intel-kosong', bab: 'Intel Pasar', judul: `Data intel pasar ${t} belum tersedia`, visual: { type: 'list', items: ['Sumber tradersaham.com belum memiliki data untuk emiten ini.'] }, lines: [] }]
  const sig = data.signals || {}, gems = data.gems || {}, ff = data.foreignFlow || {}, bs = data.brokerScanner || {}
  const reg = REG[sig.regimeSignal] || sig.regimeSignal || '–'
  const S = [{
    id: 'intel-broker', bab: 'Intel Pasar', judul: `Arah broker dominan: ${reg}`,
    visual: { type: 'kpis', items: [
      [reg, 'arah broker dominan'],
      [sig.netAccumulationScore != null ? fmt(sig.netAccumulationScore, 0) : '–', 'skor akumulasi bersih'],
      [rpNet(sig.foreignNetVal), 'arus asing bersih'],
      [sig.rsi != null ? fmt(sig.rsi, 0) : '–', 'RSI'],
    ] },
    lines: [
      sig.dominantAccumBroker ? `Broker akumulasi dominan ${sig.dominantAccumBroker}${sig.dominantAccumShare != null ? ` (${fmt(sig.dominantAccumShare, 1)}% porsi)` : ''}.` : null,
      sig.emaTrend ? `Tren EMA: ${sig.emaTrend}.` : null,
      sig.priceChangePct != null ? `Perubahan harga ${fmt(sig.priceChangePct, 2)}%${sig.closePrice ? ` ke Rp${fmt(sig.closePrice, 0)}` : ''}.` : null,
      sig.liquidityTier ? `Tingkat likuiditas: ${sig.liquidityTier}.` : null,
    ].filter(Boolean),
  }]
  const flows = [['Bandar', bs.bandarNet], ['Smart money', bs.smartMoneyNet], ['Whale', bs.whaleNet], ['Retail', bs.retailNet], ['Campuran', bs.mixedNet]].filter(([, v]) => v != null)
  if (flows.length) S.push({
    id: 'intel-arus', bab: 'Intel Pasar', judul: 'Arus dana per kelompok pelaku',
    visual: { type: 'kpis', items: flows.slice(0, 4).map(([l, v]) => [rpNet(v), l]) },
    lines: [
      ...flows.map(([l, v]) => `${l}: ${v < 0 ? 'jual bersih' : 'beli bersih'} ${big(Math.abs(v))}.`),
      ff.net_value != null ? `Arus asing ${ff.days || ''} hari: ${rpNet(ff.net_value)}${ff.streak ? `, beruntun ${ff.streak} hari` : ''}.` : null,
    ].filter(Boolean),
  })
  if (gems.gemScore != null) S.push({
    id: 'intel-gems', bab: 'Intel Pasar', judul: `Skor gems ${fmt(gems.gemScore, 0)}${gems.gemTier ? ` (${gems.gemTier})` : ''}`,
    visual: { type: 'kpis', items: [[fmt(gems.gemScore, 0), 'skor gems'], [gems.accumScore != null ? fmt(gems.accumScore, 0) : '–', 'skor akumulasi'], [gems.regimeStreakDays != null ? `${gems.regimeStreakDays} hari` : '–', 'rezim berlangsung']] },
    lines: [...(gems.evidence || []).slice(0, 4).map(String), data.meta?.tanggal_data ? `Data per ${fmtDate(data.meta.tanggal_data)}.` : null].filter(Boolean),
  })
  return S
}
