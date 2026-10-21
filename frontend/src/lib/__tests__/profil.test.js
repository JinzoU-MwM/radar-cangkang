import { describe, it, expect } from 'vitest'
import { yakinOf, tickerParts, perkaraState, risikoText, chainLayers, boardStats, trackStats, trackSummary } from '../profil.js'
import { buildNetwork, bridgesOf, crossOnly, egoOf, layoutNet } from '../netGraph.js'
import { sanitizeMilestones } from '../sync.js'

describe('profil', () => {
  it('label keyakinan', () => {
    expect(yakinOf('terverifikasi').id).toBe('ok')
    expect(yakinOf('indikasi').id).toBe('ind')
    expect(yakinOf('disebut media').id).toBe('media')
    expect(yakinOf(undefined).id).toBe('media')
  })
  it('kode saham dikenal jadi tautan, singkatan lain tetap teks', () => {
    const p = tickerParts('Masuk NINE lalu PIPA; BUMN bukan emiten', new Set(['NINE', 'PIPA']))
    expect(p.filter(x => x.ticker).map(x => x.ticker)).toEqual(['NINE', 'PIPA'])
    expect(p.map(x => x.text ?? x.ticker).join('')).toBe('Masuk NINE lalu PIPA; BUMN bukan emiten')
    expect(tickerParts('', new Set())).toEqual([])
  })
  it('status perkara: belum diriset vs bersih vs ada', () => {
    expect(perkaraState(undefined)).toBe('belum')
    expect(perkaraState([])).toBe('bersih')
    expect(perkaraState([{ jenis: 'PKPU' }])).toBe('ada')
  })
  it('risiko: buang kalimat "Tidak ditemukan", sisakan catatan', () => {
    expect(risikoText('Tidak ditemukan kasus hukum. Catatan: RUPSLB dua kali gagal kuorum.')).toBe('RUPSLB dua kali gagal kuorum.')
    expect(risikoText('Tidak ditemukan perkara.')).toBe('')
  })
  it('rantai kepemilikan dikelompokkan per lapis', () => {
    const c = chainLayers([{ lapis: 2, entitas: 'B' }, { lapis: 1, entitas: 'A' }, { lapis: 1, entitas: 'A2' }])
    expect(c.map(x => x.lapis)).toEqual([1, 2])
    expect(c[0].items).toHaveLength(2)
  })
  it('jumlah pengurus & orang pengendali baru', () => {
    expect(boardStats({ direksi: [{ orangPengendaliBaru: true }], komisaris: [{}, { orangPengendaliBaru: true }] })).toEqual({ n: 3, baru: 2 })
  })
})

describe('rekam jejak harga', () => {
  const bars = [
    { d: '2025-01-03', c: 100, h: 105 }, { d: '2025-02-07', c: 150, h: 180 },
    { d: '2025-03-07', c: 120, h: 130 }, { d: '2025-04-04', c: 60, h: 70 },
  ]
  it('masih memegang: hasil sampai sekarang, puncak sepanjang periode', () => {
    const s = trackStats(bars, { symbol: 'X', pct: 30, since: '2025-01-01' })
    expect(s.p0).toBe(100); expect(s.peak).toBe(180); expect(s.exit).toBe(null)
    expect(s.result).toBeCloseTo(-0.4)
  })
  it('sudah keluar: hasil sampai tanggal keluar, puncak hanya sampai keluar', () => {
    const s = trackStats(bars, { symbol: 'X', pct: 0, since: '2025-01-01', lastDate: '2025-03-01' })
    expect(s.exit).toBe(120); expect(s.result).toBeCloseTo(0.2)
  })
  it('data mulai sesudah tanggal masuk ditandai', () => {
    expect(trackStats(bars, { pct: 5, since: '2024-06-01' }).short).toBe(true)
    expect(trackStats([], { since: '2025-01-01' })).toBe(null)
  })
  it('ringkasan median & jumlah positif', () => {
    const s = trackSummary([{ stats: { result: 0.5 } }, { stats: { result: -0.2 } }, { stats: { result: 0.1 } }, { err: 'x' }])
    expect(s).toEqual({ n: 3, wins: 2, median: 0.1 })
  })
})

describe('peta jaringan', () => {
  const profil = {
    MEJA: { pengendali: [{ nama: 'Noprian Fadli', entitas: 'PT Triple Berkah Bersama', rekamJejak: [{ kode: 'EPAC', peran: 'pengendali' }], jaringan: [{ dengan: 'Emiten NINE' }] }],
      afiliasi: { pihakLawan: 'PT Trimata Coal Perkasa (TCP), pemegang IUP' } },
    EPAC: { pengendali: [{ nama: 'Noprian Fadli', entitas: 'Langsung' }], afiliasi: { pihakLawan: 'Belum ada injeksi aset' } },
    NINE: { pengendali: [{ nama: 'Poh Kay Ping', entitas: 'Noprian 99%, Nuzwan 1%' }],
      pengurus: { komisaris: [{ nama: 'Venantius', jabatan: 'Komisaris Independen', rangkap: ['Direktur MEJA'] }] } },
  }
  const G = buildNetwork({ profil, relasi: {} })
  it('penghubung lintas emiten dari pengendali, rekam jejak, jaringan, dan rangkap jabatan', () => {
    const b = bridgesOf(G)
    const nop = b.find(n => n.label === 'Noprian Fadli')
    expect([...nop.em].sort()).toEqual(['EPAC', 'MEJA', 'NINE'])
    expect(b.find(n => n.label === 'Venantius')).toBeTruthy()
  })
  it('teks pengisi dan porsi bukan simpul', () => {
    const labels = G.nodes.map(n => n.label)
    expect(labels).not.toContain('Langsung')
    expect(labels).not.toContain('Belum ada injeksi aset')
    expect(labels.some(l => /%/.test(l))).toBe(false)
    expect(labels).toContain('PT Trimata Coal Perkasa')
  })
  it('kurung terpotong tidak membuat simpul ganda', () => {
    const g = buildNetwork({ profil: {
      AAAA: { pengendali: [{ nama: 'Orang A', entitas: 'PT Triple Berkah Bersama (Triple B; melalui PT Lain' }] },
      BBBB: { pengendali: [{ nama: 'Orang B', entitas: 'PT Triple Berkah Bersama' }] } }, relasi: {} })
    const tb = g.nodes.filter(n => /Triple Berkah/.test(n.label))
    expect(tb).toHaveLength(1)
    expect([...tb[0].em].sort()).toEqual(['AAAA', 'BBBB'])
  })
  it('pihak di Alur saham ≥2 emiten ikut jadi penghubung', () => {
    const relasi = { MEJA: { nodes: [{ id: 'a', t: 'PT Sinar Contoh' }] }, NINE: { nodes: [{ id: 'b', t: 'Sinar Contoh, PT' }] } }
    const g = buildNetwork({ profil, relasi })
    expect(bridgesOf(g).some(n => /Sinar Contoh/.test(n.label))).toBe(true)
  })
  it('subgraf lintas emiten & ego', () => {
    expect(crossOnly(G).nodes.some(n => n.label === 'PT Trimata Coal Perkasa')).toBe(false)
    expect(egoOf(G, 'MEJA').others.sort()).toEqual(['EPAC', 'NINE'])
  })
  it('tata letak deterministik dan di dalam bidang', () => {
    const a = layoutNet(G.nodes, G.edges, 600, 400, 40), b = layoutNet(G.nodes, G.edges, 600, 400, 40)
    expect(a).toEqual(b)
    expect(a.every(p => p.x >= 30 && p.x <= 570 && p.y >= 20 && p.y <= 380)).toBe(true)
  })
})

describe('sanitizeMilestones', () => {
  const upd = [{ id: 'sb-report-1', ticker: 'AAAA', date: '2026-05-01', title: 'Rencana PMHMETD perseroan' },
    { id: 'sb-report-2', ticker: 'AAAA', date: '2026-06-01', title: 'Ringkasan Risalah RUPSLB' }]
  it('hapus tanpa bukti, sebelum PTW, dan judul yang tak lolos aturan; pertahankan yang sah', () => {
    const items = [{ ticker: 'AAAA', tender: { paydate: '2026-03-01' },
      ms: { to_selesai: true, rights: true, rupslb: true, bisnis: true, kjpp: true },
      msAuto: { rights: '2026-05-01', rupslb: '2026-06-01', kjpp: '2026-02-01' } }]
    const { items: out, removed } = sanitizeMilestones(items, upd)
    expect(out[0].ms.rupslb).toBe(true)
    expect(out[0].ms.rights).toBeUndefined()
    expect(out[0].ms.bisnis).toBeUndefined()
    expect(out[0].ms.kjpp).toBeUndefined()
    expect(removed[0].gone.map(g => g.why).sort()).toEqual(['bukti sebelum PTW dibayar', 'laporan tidak lolos aturan terbaru', 'tanpa tanggal bukti'])
    expect(items[0].ms.rights).toBe(true) // tidak memutasi input
  })
  it('item tanpa tahapan bermasalah dikembalikan apa adanya', () => {
    const it0 = { ticker: 'B', ms: { akuisisi: true } }
    expect(sanitizeMilestones([it0], []).items[0]).toBe(it0)
  })
})

describe('rapikan peta jaringan', () => {
  it('kalimat, jabatan, dan daftar banyak orang bukan simpul', async () => {
    const { isEntityLabel } = await import('../netGraph.js')
    for (const ok of ['Noprian Fadli', 'PT Triple Berkah Bersama', 'Poh Holdings Pte. Ltd.']) expect(isEntityLabel(ok)).toBe(true)
    for (const bad of ['KSEI mencantumkan MCI sendiri', 'calon pengendali baru', 'Komisaris Utama KRYA', 'Direktur GIGP',
      'Chen Pei Ling Catherine, Lim Yu Victoria, Chong Chee Hoong (UBO bersama)']) expect(isEntityLabel(bad)).toBe(false)
  })
  it('dua kolom: emiten diurutkan mengikuti penghubungnya', async () => {
    const { layoutBipartite } = await import('../netGraph.js')
    const L = layoutBipartite([{ id: 'a', label: 'A', em: new Set(['ZZZZ']) }, { id: 'b', label: 'B', em: new Set(['AAAA']) }])
    expect(L.right.map(r => r.t)).toEqual(['ZZZZ', 'AAAA'])   // ikut urutan penghubung, bukan abjad
    expect(L.links).toHaveLength(2)
  })
})
