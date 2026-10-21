import { describe, it, expect } from 'vitest'
import { isBackdoorNews, newsTake } from '../news.js'

const items = [{ ticker: 'ASPI', name: 'PT Andalan Sakti Primaindo Tbk', stage: 'tender', mcap: 100 }, { ticker: 'RDAR', stage: 'radar' }]

describe('isBackdoorNews', () => {
  it('tanpa kode: hanya topik backdoor', () => {
    expect(isBackdoorNews({ title: 'Marak saham backdoor' }, items)).toBe(true)
    expect(isBackdoorNews({ title: 'IHSG ditutup naik' }, items)).toBe(false)
  })
  it('kode harus emiten backdoor dan dalam konteks saham', () => {
    expect(isBackdoorNews({ ticker: 'RDAR', title: 'saham RDAR naik' }, items)).toBe(false)
    expect(isBackdoorNews({ ticker: 'ASPI', id: 'sb-report-1', title: 'Laporan' }, items)).toBe(true)
    expect(isBackdoorNews({ ticker: 'ASPI', id: 'n1', title: 'Asosiasi Sistem Pembayaran Indonesia (ASPI) rilis aturan' }, items)).toBe(false)
    expect(isBackdoorNews({ ticker: 'ASPI', id: 'n2', title: 'Saham ASPI dapat pengendali baru' }, items)).toBe(true)
    expect(isBackdoorNews({ ticker: 'ASPI', id: 'n3', title: 'Top gainers: saham ASPI' }, items)).toBe(false)
  })
})

describe('newsTake', () => {
  it('level, nominal vs kapitalisasi, sikap', () => {
    const r = newsTake({ ticker: 'ASPI', title: 'Inbreng aset Rp200 miliar' }, { items, pandangan: { ASPI: { sikap: 'Hindari', ringkas: 'x' } } })
    expect(r.level).toBe(3)
    expect(r.nominalText).toMatch(/^Nominal Rp200 M ≈ 2× kapitalisasi ASPI/)
    expect(r.points[0]).toBe(r.nominalText)
    expect(r.sikapLine.cls).toBe('bad')
  })
  it('tanpa aturan cocok: rutin', () => {
    const r = newsTake({ title: 'Kabar biasa' })
    expect(r.level).toBe(1); expect(r.points).toHaveLength(1); expect(r.sikapLine).toBe(null)
  })
  it('arah dampak per poin dan ringkasan', () => {
    const neg = newsTake({ title: 'Private placement tanpa HMETD kepada afiliasi' })
    expect(neg.tones.every(t => t < 0)).toBe(true)
    expect(neg.arah).toMatchObject({ label: 'Cenderung negatif', cls: 'bad' })
    const pos = newsTake({ ticker: 'ASPI', title: 'Inbreng aset Rp200 miliar' }, { items })
    expect(pos.tones).toEqual([1, 1])
    expect(pos.arah.cls).toBe('good')
    expect(newsTake({ title: 'Laba bersih naik 40%' }).tones).toEqual([1])
    expect(newsTake({ title: 'Kinerja: rugi melebar' }).arah.cls).toBe('bad')
    expect(newsTake({ title: 'Kabar biasa' }).arah.label).toBe('Berimbang')
  })
})
