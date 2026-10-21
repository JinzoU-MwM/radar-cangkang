import { describe, it, expect } from 'vitest'
import { nominalRp, buildAnalysis } from '../analysis.js'

describe('nominalRp', () => {
  it('rupiah & valas', () => {
    expect(nominalRp('Rp1,65 triliun')).toBe(1.65e12)
    expect(nominalRp('USD125 juta')).toBe(125e6 * 16500)
    expect(nominalRp('Rp 87,67 M')).toBeCloseTo(87.67e9)
  })
  it('isi kurung diabaikan, beberapa nilai dijumlah', () => {
    expect(nominalRp('USD100 juta (±Rp1,6 T) + Rp172,25 M')).toBeCloseTo(100e6 * 16500 + 172.25e9)
  })
  it('tanpa angka → null', () => {
    expect(nominalRp('belum disebut')).toBe(null); expect(nominalRp('')).toBe(null)
  })
})

describe('buildAnalysis', () => {
  it('menghasilkan enam dimensi, skor 0..100, dan memakai data terverifikasi', () => {
    const item = { ticker: 'ABCD', name: 'PT Abcd Tbk', price: 100, mcap: 50, ms: { spa: true }, tender: { price: 120, start: '2020-01-01', end: '2020-02-01' } }
    const a = buildAnalysis({ ticker: 'ABCD', item, profile: { chart: [{ d: '2026-10-01', v: 100 }], metrics: {}, stats: {} },
      verified: { ABCD: { injectType: 'Tambang', nominal: 'Rp100 miliar' } } })
    expect(a.dims.map(x => x.k)).toEqual(['Pengendali', 'Substansi aset', 'Posisi harga', 'Struktur & likuiditas', 'Katalis', 'Fundamental'])
    expect(a.mcap).toBe(50e9)
    expect(a.injRp).toBe(1e11)
    expect(a.score).toBeGreaterThanOrEqual(0); expect(a.score).toBeLessThanOrEqual(100)
  })
})
