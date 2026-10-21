import { describe, it, expect } from 'vitest'
import { buildRelasi } from '../relasiAuto.js'

const profil = { GPSO: {
  pengendali: [{ nama: 'Kurniawan Eddy Tjokro', peran: 'UBO', entitas: 'PT PIMSF Pulogadung (Tjokro Group)', porsi: '42,40% (KSEI)' }],
  pengurus: { direksi: [{ nama: 'Axel', jabatan: 'Direktur', orangPengendaliBaru: true }], komisaris: [] },
  afiliasi: { pihakLawan: 'PT Jaya Indah Casting (JIC) — penjual tanah', hubungan: 'Afiliasi langsung (satu grup)' },
  ringkas: 'GPSO dikendalikan Tjokro Group.', tidakDitemukan: ['Pendidikan Kurniawan Eddy Tjokro'],
} }
const aset = { GPSO: { aset: { nama: 'Aset tetap PT Jaya Indah Casting', sektor: 'properti' }, kjpp: { status: 'terbit' }, transaksi: { nilai: 'Rp78,5 miliar' } } }

describe('buildRelasi', () => {
  it('membangun orang → kendaraan → emiten, pihak lawan terafiliasi, aset, dan publik', () => {
    const r = buildRelasi('GPSO', { profil, aset, pandangan: { dilusi: { porsiPublikSekarang: 57.6 } } })
    const ids = r.nodes.map(n => n.id)
    expect(ids).toEqual(expect.arrayContaining(['p0', 'e0', 'em', 'lawan', 'aset', 'pub']))
    expect(r.nodes.find(n => n.id === 'em').x).toBe(680)
    expect(r.nodes.find(n => n.id === 'e0').t).toBe('PT PIMSF Pulogadung')
    expect(r.edges).toContainEqual(['p0', 'e0', 'own', 'UBO 42,40%'])
    expect(r.edges).toContainEqual(['e0', 'lawan', 'role', 'afiliasi'])
    expect(r.edges).toContainEqual(['aset', 'em', 'plan', 'Rp78,5 miliar'])
    expect(r.info.p0.open).toEqual(['Pendidikan Kurniawan Eddy Tjokro'])
    // tiap node punya posisi
    expect(r.nodes.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true)
  })

  it('tanpa data pengendali sama sekali → null', () => {
    expect(buildRelasi('ZZZZ', {})).toBe(null)
  })

  it('"tidak terafiliasi" tidak ditandai afiliasi', () => {
    const p = { X: { pengendali: [{ nama: 'A', peran: 'UBO', entitas: 'PT B' }], afiliasi: { pihakLawan: 'PT C', hubungan: 'Dinyatakan tidak terafiliasi' } } }
    const r = buildRelasi('X', { profil: p })
    expect(r.edges.some(e => e[3] === 'afiliasi')).toBe(false)
  })
})

describe('buildRelasi aset', () => {
  const p = { X: { pengendali: [{ nama: 'A', peran: 'UBO', entitas: 'PT B' }] } }
  it('target injeksi dari story-verified bila aset-verified kosong', () => {
    const r = buildRelasi('X', { profil: p, verified: { X: { injectTarget: 'PT Tambang C (60%)', injectType: 'Inbreng', nominal: 'Rp1 T' } } })
    expect(r.nodes.find(n => n.id === 'aset').t).toBe('PT Tambang C')
    expect(r.edges).toContainEqual(['aset', 'em', 'plan', 'Rp1 T'])
  })
  it('tanpa injeksi: kotak keterangan tanpa garis', () => {
    const r = buildRelasi('X', { profil: p, verified: { X: { baru: 'Tetap: logistik' } } })
    const a = r.nodes.find(n => n.id === 'aset')
    expect([a.t, a.s, a.k]).toEqual(['Tanpa injeksi aset', 'bisnis lama dipertahankan', 'none'])
    expect(r.edges.some(e => e[0] === 'aset')).toBe(false)
  })
})

describe('layoutRows', () => {
  it('memberi koordinat per baris, emiten di tengah baris 2', async () => {
    const { layoutRows } = await import('../relasiAuto.js')
    const r = layoutRows({ nodes: [{ id: 'a', row: 2 }, { id: 'em', row: 2 }, { id: 'b', row: 2 }, { id: 'p', row: 0 }] })
    expect(r.nodes.find(n => n.id === 'em').x).toBe(680)
    expect(r.nodes.find(n => n.id === 'p')).toMatchObject({ x: 680, y: 120 })
    expect(r.nodes.every(n => Number.isFinite(n.x))).toBe(true)
  })
  it('relasi yang sudah berkoordinat tidak diubah', async () => {
    const { layoutRows } = await import('../relasiAuto.js')
    const rel = { nodes: [{ id: 'em', x: 10, y: 20 }] }
    expect(layoutRows(rel)).toBe(rel)
  })
})

describe('jaringan lintas emiten', () => {
  it('nama pihak dicocokkan tanpa bentuk badan hukum', async () => {
    const { buildEntityIndex, entityKey } = await import('../relasiAuto.js')
    const idx = buildEntityIndex({
      MEJA: { nodes: [{ id: 'em', t: 'MEJA' }, { id: 'a', t: 'PT Triple Berkah Bersama' }] },
      EPAC: { nodes: [{ id: 'b', t: 'Triple Berkah Bersama' }, { id: 'p', t: 'Masyarakat' }] },
    })
    expect([...idx.get(entityKey('PT. Triple Berkah Bersama'))].sort()).toEqual(['EPAC', 'MEJA'])
    expect(idx.has('masyarakat')).toBe(false)
  })
})
