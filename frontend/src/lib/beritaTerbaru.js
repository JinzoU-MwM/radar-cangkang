// Analisa otomatis untuk laporan/berita TERBARU satu emiten: ringkasan, poin kunci, tingkat sinyal, dampak terhadap
// pemegang saham publik (Positif/Netral/Negatif beserta alasan dari isi dokumen), kaitan dengan tesis analisa kurasi
// (pandangan-analis.json), dan hal yang dipantau. Deterministik dari data sinkron Stockbit; dipakai tab Berita dan PDF.
import { UTYPES } from './domain.js'
import { newsTake } from './news.js'
import { faktaAset, RUTIN_RX } from './pembaruan.js'

const day = u => String(u.date || '').slice(0, 10)
const isReport = u => /^sb-report-/.test(String(u.id || ''))
const intiOf = s => (String(s || '').match(/Inti:\s*(.+?)\s*(\(Ringkasan AI Stockbit\))?$/) || [])[1] || ''
const bersih = s => String(s || '').replace(/\s*\(Ringkasan AI Stockbit\)\s*$/, '').replace(/\s*Inti:\s*.+$/, '').trim()
const rp = v => v == null ? '–' : 'Rp' + Math.round(v).toLocaleString('id-ID')

// Laporan/berita paling baru satu emiten; pada tanggal yang sama keterbukaan resmi didahulukan.
export function beritaTerakhir(updates, ticker) {
  return (updates || []).filter(u => u.ticker === ticker && u.title)
    .sort((a, b) => day(b).localeCompare(day(a)) || isReport(b) - isReport(a) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0] || null
}

const DAMPAK = { 1: ['Positif', 'good'], 0: ['Netral', 'calm'], [-1]: ['Negatif', 'bad'] }

export function analisaBerita(u, { items = [], pandangan = {} } = {}) {
  if (!u) return null
  const t = u.ticker
  const take = newsTake(u, { items, pandangan })
  const laporan = isReport(u), rutin = laporan && RUTIN_RX.test(u.title || '')
  const jenis = (UTYPES.find(x => x.id === u.type) || { name: 'Lainnya' }).name
  const poin = String(u.points || '').split(' · ').map(z => z.trim().replace(/\.$/, '')).filter(Boolean)
  const inti = intiOf(u.summary)

  // Dampak: arah mayoritas poin tafsiran (positif/negatif bagi pemegang saham publik); berimbang = Netral.
  const arah = take.arah.cls === 'good' ? 1 : take.arah.cls === 'bad' ? -1 : 0
  const alasan = take.detail.all.map(x => ({ teks: x.text, nada: x.tone }))

  // Kaitan dengan tesis analisa kurasi (bila emiten sudah dianalisa).
  const pa = pandangan[t] || null
  const it = items.find(x => x.ticker === t) || null
  const harga = it?.price ?? null
  let tesis = null
  if (pa) {
    const nw = pa.nilaiWajar
    const posisi = harga == null || !nw ? ''
      : harga > nw.atas ? `Harga ${rp(harga)} di atas rentang nilai wajar ${rp(nw.bawah)}–${rp(nw.atas)}.`
      : harga < nw.bawah ? `Harga ${rp(harga)} di bawah rentang nilai wajar ${rp(nw.bawah)}–${rp(nw.atas)}.`
      : `Harga ${rp(harga)} di dalam rentang nilai wajar ${rp(nw.bawah)}–${rp(nw.atas)}.`
    tesis = { sikap: pa.sikap || '', ringkas: pa.ringkas || '', asOf: pa.asOf || '', hargaAcuan: pa.hargaAcuan ?? null, harga, posisi,
      baru: !!pa.asOf && day(u) > String(pa.asOf).slice(0, 10) }
  }

  const pantau = [take.detail.watch, ...(pa?.variabelKunci || []).slice(0, 3)].filter(Boolean)
  const fakta = faktaAset([u], { n: 6 }).map(f => `${f.l}: ${f.t}`)

  // Kesimpulan satu paragraf, objektif dan berdasar isi dokumen.
  const k = [`${laporan ? 'Keterbukaan resmi' : 'Berita media'} ${t} (${jenis.toLowerCase()}): ${(inti || u.title).replace(/\.?$/, '.')}`]
  k.push(rutin ? 'Dokumen bersifat administratif sehingga tidak mengubah nilai saham.'
    : `Tingkat sinyal ${take.label.toLowerCase()} dengan dampak ${DAMPAK[arah][0].toLowerCase()} bagi pemegang saham publik.`)
  if (tesis) k.push(tesis.baru
    ? `Dokumen ini terbit setelah analisa kurasi ${tesis.asOf}; sikap ${tesis.sikap} ${arah === 0 || rutin ? 'tidak berubah karenanya' : 'perlu ditinjau ulang terhadap fakta baru ini'}.`
    : `Dokumen ini sudah tercakup dalam analisa kurasi ${tesis.asOf} (sikap ${tesis.sikap}).`)

  return {
    ticker: t, tanggal: day(u), judul: u.title, url: u.url || '', sumber: u.source || (laporan ? 'Stockbit Reports' : 'Media'),
    laporan, rutin, jenis, ringkas: bersih(u.summary), inti, poin,
    sinyal: { label: take.label, cls: take.cls, level: take.level, why: take.detail.levelWhy },
    dampak: { label: rutin ? 'Netral' : DAMPAK[arah][0], cls: rutin ? 'calm' : DAMPAK[arah][1], alasan },
    nominal: take.nominalText, fakta, tesis, pantau, salahBila: pa?.tesisSalahBila || [], kesimpulan: k.join(' '),
  }
}
