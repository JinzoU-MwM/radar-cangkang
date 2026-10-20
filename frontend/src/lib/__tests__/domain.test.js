import { describe, it, expect } from 'vitest'
import { progressOf, statusOf, stageOf, trackIndex, fairGap, scoreOf, dealOf, posisiOf, pctTxt } from '../domain.js'

describe('domain', () => {
  it('progressOf: estimasi dari tahap tanpa tonggak, jumlah bobot bila ada', () => {
    expect(progressOf({ stage: 'rupslb' })).toMatchObject({ pct: 50, est: true, next: null })
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
  it('progressOf: KJPP terbit & eksekusi dari data terverifikasi, tanpa injeksi = tahapan pengambilalihan saja', () => {
    const d = { ticker: 'AAAA', ms: { spa: true, akuisisi: true } }
    expect(progressOf(d, { aset: { AAAA: { kjpp: { status: 'ditunjuk' } } } }).pct).toBe(25)
    expect(progressOf(d, { aset: { AAAA: { kjpp: { status: 'terbit' } } } }).pct).toBe(35)
    expect(progressOf(d, { verified: { AAAA: { executed: true, injectType: 'Tambang' } } }).ms.inbreng).toBe(true)
    const strat = { verified: { AAAA: { injectType: '', baru: 'Tetap: usaha lama' } } }
    expect(progressOf(d, strat).pct).toBe(56)   // 25 dari 45
    expect(progressOf({ ...d, ms: { ...d.ms, to_umum: true, to_selesai: true } }, strat).pct).toBe(100)
  })
  it('dealOf: PTW dibayar belum berarti selesai bila injeksi belum berjalan', () => {
    expect(dealOf({ ms: { to_selesai: true } })).toBe('proses')
    expect(dealOf({ ms: { to_selesai: true, rupslb: true, inbreng: true } })).toBe('selesai')
    expect(dealOf({ ticker: 'X', ms: { to_selesai: true } }, null, { verified: { X: { baru: 'Tetap' } } })).toBe('selesai')
    expect(dealOf({ ms: { bisnis: true } })).toBe('selesai')
    expect(dealOf({ stage: 'tender' })).toBe('proses')
  })
  it('posisiOf: tahapan terakhir dan berikutnya (+ target)', () => {
    expect(posisiOf({})).toEqual({ now: 'Belum ada tahapan terverifikasi', next: 'Penandatanganan PPJB bersyarat' })
    const r = posisiOf({ ticker: 'X', ms: { spa: true, akuisisi: true, to_umum: true, to_selesai: true, rupslb: true } }, null,
      { verified: { X: { target: 'RUPSLB 3 Nov 2026. Lainnya' } } })
    expect(r.now).toBe('RUPSLB tercapai')
    expect(r.next).toBe('PMHMETD/PMTHMETD berjalan (prospektus, pernyataan efektif, atau hasil pelaksanaan) · target: RUPSLB 3 Nov 2026')
    // KJPP dilewati bila tidak ada rencana injeksi
    expect(posisiOf({ ms: { spa: true, akuisisi: true, to_umum: true, to_selesai: true, rupslb: true, rights: true } }).next).toMatch(/^Injeksi aset efektif/)
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
