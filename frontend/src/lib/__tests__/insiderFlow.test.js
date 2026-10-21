import { describe, it, expect } from 'vitest'
import { labelsOf, relevanceOf, prepare, byTicker, dedupe } from '../insiderFlow.js'

describe('labelsOf', () => {
  it('pergantian pengendali dan pemegang baru', () => {
    expect(labelsOf({ prev: 0, cur: 26.67, action: 'BUY' })).toEqual(expect.arrayContaining(['ganti', 'blok', 'masuk']))
    expect(labelsOf({ prev: 52.49, cur: 0, action: 'SELL' })).toContain('ganti')
    expect(labelsOf({ prev: 45, cur: 51, action: 'BUY' })).toContain('ganti')
  })
  it('crossing, pengalihan, tender, repo', () => {
    expect(labelsOf({ prev: 0, cur: 5.79, action: 'CROSS' })).toEqual(['cross', 'masuk'])
    expect(labelsOf({ prev: 10, cur: 10.5, action: 'TRANSFER' })).toEqual(['transfer'])
    expect(labelsOf({ prev: 60, cur: 70, action: 'TENDER_OFFER' })).toContain('tender')
    expect(labelsOf({ prev: 30, cur: 28, action: 'SELL', purpose: 'PENCAIRAN REPO' })).toContain('repoCair')
    expect(labelsOf({ prev: 30, cur: 31, action: 'BUY', purpose: 'TOP UP REPO' })).toContain('repoTop')
  })
  it('transaksi kecil tanpa label kecuali orang dalam', () => {
    expect(labelsOf({ prev: 0.0008, cur: 0.0012, action: 'BUY' })).toEqual([])
    expect(labelsOf({ prev: 0.001, cur: 0.0013, action: 'BUY', role: 'direksi' })).toEqual(['orangDalam'])
  })
})

describe('relevanceOf', () => {
  const ctx = { radar: new Set(['GPSO']), kandidat: new Set(['KOTA']) }
  it('radar dan kandidat selalu relevan', () => {
    expect(relevanceOf({ ticker: 'GPSO', prev: 1, cur: 1.1 }, [], ctx)).toBe('radar')
    expect(relevanceOf({ ticker: 'KOTA', prev: 1, cur: 1.1 }, [], ctx)).toBe('kandidat')
  })
  it('emiten lain hanya bila perpindahan besar atau indikasi ganti pengendali', () => {
    expect(relevanceOf({ ticker: 'WIFI', prev: 0, cur: 26.67 }, ['ganti', 'blok', 'masuk'], ctx)).toBe('potensi')
    expect(relevanceOf({ ticker: 'APEX', prev: 0, cur: 5.79 }, ['cross', 'masuk'], ctx)).toBe('potensi')
    expect(relevanceOf({ ticker: 'ATIC', prev: 5.61, cur: 5.62 }, [], ctx)).toBe('')
  })
  it('ringkasan per emiten mendahulukan pergantian pengendali', () => {
    const rows = prepare([
      { date: '2026-10-20', ticker: 'APEX', name: 'HSBC', prev: 0, cur: 5.79, action: 'CROSS' },
      { date: '2026-10-19', ticker: 'WIFI', name: 'SGK', prev: 0, cur: 26.67, action: 'BUY' },
    ], ctx)
    expect(byTicker(rows).map(g => g.ticker)).toEqual(['WIFI', 'APEX'])
  })
})

describe('dedupe', () => {
  it('menggabungkan laporan IDX dan KSEI untuk transaksi yang sama', () => {
    const r = dedupe([
      { date: '2026-10-19', ticker: 'WIFI', name: 'SINERGI GRAHA KAPITAL', prev: 0, cur: 26.67, source: 'IDX', broker: '' },
      { date: '2026-10-19', ticker: 'WIFI', name: 'SINERGI GRAHA KAPITAL', prev: 0, cur: 26.67, source: 'KSEI', broker: 'YB' },
    ])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ source: 'IDX + KSEI', broker: 'YB' })
  })
})
