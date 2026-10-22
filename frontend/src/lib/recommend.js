// Rekomendasi tindakan untuk presentasi analisa: menggabungkan sikap analis, skor enam dimensi, sinyal teknikal,
// rencana transaksi, nilai wajar, dan (bila ada) penilaian pengumpulan dana rights issue. Berbasis aturan,
// kerangka keputusan, bukan saran investasi personal.

const rp = v => v == null || isNaN(v) ? '–' : 'Rp' + Math.round(v).toLocaleString('id-ID')
const pct = (a, b) => a && b ? `${a >= b ? '+' : ''}${Math.round((a / b - 1) * 100)}%` : ''

export const TIERS = {
  hindari: { label: 'Hindari / kurangi posisi', tone: 'bad', porsi: '0% (pemegang: kurangi saat rebound)' },
  tunggu: { label: 'Tunggu konfirmasi, belum beli', tone: 'warn', porsi: '0% sekarang; maks. 1–2% portofolio setelah syarat terpenuhi' },
  spekulatif: { label: 'Beli spekulatif kecil', tone: 'warn', porsi: 'Maks. 1–2% portofolio, masuk bertahap' },
  akumulasi: { label: 'Akumulasi bertahap', tone: 'good', porsi: 'Maks. 3–5% portofolio, 2–3 tahap' },
}

// d: hasil collectDeck (A, pa, tech, pos, ri, riF, aset, item).
export function recommend(d) {
  const A = d.A || {}, pa = d.pa || {}, tech = d.tech, pl = tech?.plan || null
  const sikap = String(pa.sikap || A.stance?.t || '')
  const techScore = tech?.sig?.score ?? 0
  const setup = !!pl?.entry
  const price = A.price
  let tier
  if (/hindari/i.test(sikap) || (A.score ?? 50) < 35) tier = 'hindari'
  else if (techScore <= -3 && !setup) tier = 'tunggu'
  else if (setup && (A.score ?? 0) >= 55 && techScore >= 1 && !/spekulatif tinggi/i.test(sikap)) tier = 'akumulasi'
  else if (setup && (A.score ?? 0) >= 45) tier = 'spekulatif'
  else tier = 'tunggu'
  // Pengumpulan dana rights issue yang diragukan menahan rekomendasi beli.
  if (d.riF?.key === 'doubt' && (tier === 'akumulasi' || tier === 'spekulatif')) tier = tier === 'akumulasi' ? 'spekulatif' : 'tunggu'
  const T = TIERS[tier]

  // Level harga: area beli, stop, target.
  const lv = Object.fromEntries((A.levels || []).map(l => [l[0], l[2]]))
  const nw = pa.nilaiWajar || null
  const res = tech?.plan?.s?.res, sup = tech?.plan?.s?.sup, sar = pl?.sar
  let entry = null, entryNote = ''
  if (setup) { entry = [pl.entryLo, pl.entryHi]; entryNote = 'zona entry dari rencana transaksi teknikal' }
  else if (tier !== 'hindari') {
    const trig = Math.max(...[sar, res].filter(v => v > 0 && v > (price || 0)))
    if (isFinite(trig)) { entry = [Math.round(trig), null]; entryNote = `masuk hanya bila ditutup di atas ${rp(trig)} dengan volume (pembalikan tren)` }
  }
  const stop = pl?.stop || lv['Skenario turun'] || (sup ? Math.round(sup * 0.95) : null)
  const targets = [
    pl?.tp1 && { p: pl.tp1, l: 'target teknikal 1' }, pl?.tp2 && { p: pl.tp2, l: 'target teknikal 2' },
    lv['Harga PTW'] > (price || 0) && { p: lv['Harga PTW'], l: 'harga PTW' },
    lv['Skenario naik'] > (price || 0) && { p: lv['Skenario naik'], l: 'puncak siklus' },
  ].filter(Boolean).sort((a, b) => a.p - b.p).slice(0, 3)

  // Alasan utama: positif terkuat, negatif terkuat, posisi harga vs nilai wajar, teknikal, dana rights issue.
  const why = []
  if ((A.bull || [])[0]) why.push({ s: 1, t: A.bull[0] })
  if ((A.bear || [])[0]) why.push({ s: -1, t: A.bear[0] })
  if (nw && price) {
    if (price > nw.atas) why.push({ s: -1, t: `Harga ${rp(price)} di atas nilai wajar kasar ${rp(nw.bawah)}–${rp(nw.atas)} (${pct(price, nw.atas)} dari batas atas).` })
    else if (price < nw.bawah) why.push({ s: 1, t: `Harga ${rp(price)} di bawah nilai wajar kasar ${rp(nw.bawah)}–${rp(nw.atas)}.` })
    else why.push({ s: 0, t: `Harga ${rp(price)} di dalam rentang nilai wajar kasar ${rp(nw.bawah)}–${rp(nw.atas)}.` })
  }
  if (tech?.sig?.sig) why.push({ s: techScore > 0 ? 1 : techScore < 0 ? -1 : 0, t: `Teknikal: ${tech.sig.sig[0].toLowerCase()} (skor ${techScore > 0 ? '+' : ''}${techScore}); ${tech.verdict || ''}`.trim() })
  if (d.riF) why.push({ s: d.riF.key === 'done' || d.riF.key === 'likely' ? 1 : d.riF.key === 'doubt' ? -1 : 0, t: `Pengumpulan dana rights issue: ${d.riF.label.toLowerCase()}.` })

  // Syarat masuk: bukti fundamental + konfirmasi teknikal bila tren turun.
  const triggers = [...(A.checks || [])]
  if (techScore < 0) triggers.push(sar && price && sar > price ? `Parabolic SAR berbalik ke bawah harga (kini ${rp(sar)})` : 'Indikator tren berbalik naik (MACD memotong ke atas garis sinyal)')
  if (d.riF && d.riF.key !== 'done') triggers.push('Pembeli siaga/penyerap dana rights issue diumumkan resmi')

  const holder = tier === 'hindari' || techScore <= -3
    ? (pl?.note || `Bagi pemegang: kurangi posisi saat rebound${res ? ' ke ' + rp(res) : ''}; keluar penuh bila ditutup di bawah ${rp(stop)}.`)
    : `Bagi pemegang: pertahankan selama harga di atas ${rp(stop)}; ambil sebagian untung di target pertama.`

  return {
    tier, ...T, sikap, score: A.score ?? null, techScore,
    profil: /spekulatif tinggi|hindari/i.test(sikap) ? 'Sangat tinggi' : 'Tinggi',
    // Horizon: tanggal katalis (target story/rights issue) bila ada; selain itu tahap berikutnya.
    horizon: (A.sv?.target || d.ri?.jadwal) ? `Sampai ${String(A.sv?.target || d.ri.jadwal).split(/[;(]/)[0].trim()}`
      : d.pos?.next ? `Sampai tahap berikutnya: ${d.pos.next}` : 'Jangka pendek–menengah; tinjau ulang tiap ada keterbukaan baru',
    entry, entryNote, stop, targets, why: why.slice(0, 5), triggers: triggers.slice(0, 4), exits: (A.exits || []).slice(0, 3), holder,
    catalyst: d.pos?.next || '', price,
  }
}
