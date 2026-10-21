import { describe, it, expect } from 'vitest'
import { cycleModel, phaseOf, seriesAt, quantile, dayTxt, CYCLE_PHASES } from '../cycle.js'

// Deret sintetis: naik dari 0,5× (hari -200) ke k× (hari 0), lalu turun ke k/2 di hari +400.
const mk = (t, k) => ({
  ticker: t, p0: 100, last: 100 * k / 2, peak: 100 * k, base: 50, baseDay: -200, peakDay: 0,
  series: Array.from({ length: 31 }, (_, i) => { const x = -200 + i * 20; return [x, x <= 0 ? 0.5 + (k - 0.5) * (x + 200) / 200 : k - (k / 2) * x / 400] }),
})
const bm = { deals: [mk('AAAA', 1), mk('BBBB', 2), mk('CCCC', 3), mk('DDDD', 4), mk('EEEE', 5), { ticker: 'XXXX', series: [[0, 1]] }] }
const NOW = new Date('2026-10-21T00:00:00').getTime()
const ago = n => new Date(NOW - n * 864e5).toISOString().slice(0, 10)

describe('cycleModel', () => {
  const m = cycleModel(bm)
  it('membuang deret pendek, menghitung kuartil per 10 hari', () => {
    expect(m.n).toBe(5)
    expect(m.pts[0].x).toBe(-200)
    const p0 = m.pts.find(p => p.x === 0)
    expect(p0.md).toBe(3)
    expect(p0.q1).toBe(2)
    expect(p0.q3).toBe(4)
    expect(m.peakX).toBe(3)
    expect(m.baseDay).toBe(-200)
  })
  it('kosong bila tidak ada data', () => {
    expect(cycleModel(null).pts).toEqual([])
    expect(cycleModel({ deals: [] }).baseDay).toBe(null)
  })
  it('interpolasi & kuantil', () => {
    expect(seriesAt([[0, 1], [10, 2]], 5)).toBe(1.5)
    expect(seriesAt([[0, 1], [10, 2]], 11)).toBe(null)
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(dayTxt(-30)).toBe('30 hari sebelum PTW')
    expect(dayTxt(0)).toBe('saat PTW')
  })
})

describe('phaseOf', () => {
  const m = cycleModel(bm), o = { now: NOW }
  it('urutan aturan fase', () => {
    expect(phaseOf({ ticker: 'Q', ms: { spa: true } }, m, o)).toBe('pra')
    expect(phaseOf({ ticker: 'Q' }, m, o)).toBe(null)
    expect(phaseOf({ ticker: 'Q', tender: { start: ago(-10) } }, m, o)).toBe('pra')
    expect(phaseOf({ ticker: 'Q', tender: { start: ago(20), price: 100 }, price: 90 }, m, o)).toBe('ptw')
    expect(phaseOf({ ticker: 'Q', tender: { start: ago(100), price: 100 }, price: 90 }, m, { ...o, ms: { kjpp: true } })).toBe('inj')
    expect(phaseOf({ ticker: 'Q', tender: { start: ago(100), price: 100 }, price: 90 }, m, { ...o, verified: { Q: { executed: true } } })).toBe('inj')
    expect(phaseOf({ ticker: 'Q', tender: { start: ago(100), price: 100 }, price: 90 }, m, o)).toBe('bawah')
    expect(phaseOf({ ticker: 'Q', tender: { start: ago(100), price: 100 }, price: 900 }, m, o)).toBe('euf')
    expect(phaseOf({ ticker: 'Q', tender: { start: ago(100), price: 100 }, price: 150 }, m, o)).toBe('dist')
  })
  it('rasio benchmark mengalahkan harga radar', () => {
    // EEEE last/p0 = 2,5 → di bawah kuartil 3 hari 100 → distribusi, meski harga radar jauh di atas.
    expect(phaseOf({ ticker: 'EEEE', tender: { start: ago(100), price: 100 }, price: 900 }, m, o)).toBe('dist')
  })
  it('enam fase', () => expect(CYCLE_PHASES.map(p => p.id)).toEqual(['pra', 'ptw', 'euf', 'dist', 'bawah', 'inj']))
})
