import { describe, it, expect } from 'vitest'
import { hitungHarmonik, rentang, idxTanggal, HM_STATUS } from '../harmonik.js'

const rows = [
  { t: 'AAAA', status: 'prz', arah: 'bullish' },
  { t: 'BBBB', status: 'menuju', arah: 'bearish' },
  { t: 'CCCC', status: 'menuju', arah: 'bullish' },
]

describe('screening harmonik', () => {
  it('menghitung per status dan arah', () => {
    expect(hitungHarmonik(rows)).toEqual({ semua: 3, prz: 1, berbalik: 0, menuju: 2, bullish: 2, bearish: 1 })
    expect(hitungHarmonik()).toEqual({ semua: 0, prz: 0, berbalik: 0, menuju: 0, bullish: 0, bearish: 0 })
  })
  it('label status lengkap', () => {
    expect(Object.keys(HM_STATUS)).toEqual(['prz', 'berbalik', 'menuju'])
  })
  it('rentang rasio format Indonesia', () => {
    expect(rentang([0.618, 0.618])).toBe('0,618')
    expect(rentang([0.382, 0.886])).toBe('0,382–0,886')
    expect(rentang(undefined)).toBe('–')
  })
  it('idxTanggal mencari bar pada/sesudah tanggal', () => {
    const bars = ['2026-01-02', '2026-01-05', '2026-01-06'].map(d => ({ d }))
    expect(idxTanggal(bars, '2026-01-03')).toBe(1)
    expect(idxTanggal(bars, '2026-01-06')).toBe(2)
    expect(idxTanggal(bars, '2099-01-01')).toBe(2)
  })
})
