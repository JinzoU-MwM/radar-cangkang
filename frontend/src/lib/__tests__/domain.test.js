import { describe, it, expect } from 'vitest'
import { progressOf, statusOf, stageOf, trackIndex, fairGap, scoreOf, dealOf, pctTxt } from '../domain.js'

describe('domain', () => {
  it('progressOf: estimasi dari tahap tanpa tonggak, jumlah bobot bila ada', () => {
    expect(progressOf({ stage: 'rupslb' })).toEqual({ pct: 50, est: true, next: null })
    const p = progressOf({ ms: { spa: true, akuisisi: true } })
    expect(p.pct).toBe(25); expect(p.est).toBe(false); expect(p.next.id).toBe('to_umum')
  })
  it('statusOf ambang 65/35', () => {
    expect(statusOf(65)).toBe('strong'); expect(statusOf(64)).toBe('warn'); expect(statusOf(35)).toBe('warn'); expect(statusOf(34)).toBe('calm')
  })
  it('scoreOf memakai sinyal otomatis harga & kapitalisasi', () => {
    expect(scoreOf({ price: 50, mcap: 100, flags: { akuisisi: true } })).toBe(45)
  })
  it('stageOf: tonggak terjauh mengalahkan stage manual; trackIndex', () => {
    expect(stageOf({ stage: 'spa', ms: { rupslb: true } })).toBe('rupslb')
    expect(trackIndex({})).toBe(-1)
    expect(trackIndex({ stage: 'spa' })).toBe(0)
    expect(trackIndex({ ms: { bisnis: true } })).toBe(4)
  })
  it('dealOf', () => {
    expect(dealOf({ ms: { to_selesai: true } })).toBe('selesai')
    expect(dealOf({ stage: 'tender' })).toBe('proses')
  })
  it('fairGap', () => {
    expect(fairGap(150, 80, 100)).toBe(50)
    expect(fairGap(60, 80, 100)).toBe(-25)
    expect(fairGap(90, 80, 100)).toBe(0)
    expect(fairGap(null, 80, 100)).toBe(null)
  })
  it('pctTxt', () => {
    expect(pctTxt(105, 100)).toBe('+5,0%')
    expect(pctTxt(80, 100)).toBe('-20%')
    expect(pctTxt(1, 0)).toBe('–')
  })
})
