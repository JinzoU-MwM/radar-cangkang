import { describe, it, expect } from 'vitest'
import { sma, rsi, atr, tick, floorTick, ceilTick, indicators, taSignals, buildPlan, moneyMgmt, MM_DEF } from '../ta.js'

// Seri sintetis: tren naik bergelombang, 80 hari.
const bars = Array.from({ length: 80 }, (_, i) => {
  const c = 1000 + i * 5 + (i % 3 === 0 ? -8 : 6)
  return { d: `2026-01-${i}`, o: c - 3, h: c + 10, l: c - 10, c, v: 1000 + (i % 5) * 200 }
})

describe('indikator', () => {
  it('sma', () => expect(sma([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5]))
  it('rsi: naik terus = 100, turun terus = 0, selalu 0..100', () => {
    expect(rsi(Array.from({ length: 20 }, (_, i) => i + 1)).at(-1)).toBe(100)
    expect(rsi(Array.from({ length: 20 }, (_, i) => 20 - i)).at(-1)).toBe(0)
    const r = rsi(bars.map(b => b.c)).filter(x => x != null)
    expect(r.every(x => x >= 0 && x <= 100)).toBe(true)
  })
  it('atr: null sebelum bar ke-14, lalu rata-rata true range', () => {
    const a = atr(bars)
    expect(a[13]).toBe(null)
    expect(a[14]).toBeGreaterThan(0)
  })
})

describe('fraksi harga', () => {
  it('tick', () => {
    expect([199, 200, 499, 500, 1999, 2000, 4999, 5000].map(tick)).toEqual([1, 2, 2, 5, 5, 10, 10, 25])
  })
  it('floorTick / ceilTick', () => {
    expect(floorTick(1003)).toBe(1000); expect(ceilTick(1003)).toBe(1005)
    expect(floorTick(333)).toBe(332); expect(ceilTick(5010)).toBe(5025)
  })
})

describe('plan & money management', () => {
  const ind = indicators(bars), s = taSignals(bars, ind)
  const plan = buildPlan(bars, ind, s)
  it('sinyal & rencana konsisten', () => {
    expect(s.votes.length).toBeGreaterThan(0)
    expect(plan.s).toBe(s)
    if (plan.entry != null) expect(plan.stop).toBeLessThan(plan.entry)
  })
  // Rencana buatan agar hitungan lot bisa diverifikasi manual.
  const fake = { s: { score: 2, sig: ['Beli', 'good'], valDay: 1e10 }, frozen: false, entry: 1000, stop: 950, tp1: 1075, tp2: 1150, resBlock: null }
  const mm = { ...MM_DEF, fb: 0, fs: 0 }
  it('lots dari risiko, dibatasi porsi maksimum', () => {
    const r = moneyMgmt(fake, mm)
    // risiko 1% × 100 jt = 1 jt; rugi/saham 50 → 200 lot; batas porsi 20% = 200 lot
    expect(r.lots).toBe(200); expect(r.capLots).toBe(200); expect(r.finalLots).toBe(200)
    expect(r.breakeven).toBe(1000)
    expect(r.pnl1).toBe(200 * 100 * 75 / 2)
    expect(r.verdict.cls).toBe('good')
  })
  it('sikap Hindari memotong 50% dan menggagalkan satu syarat', () => {
    const r = moneyMgmt(fake, mm, { sikap: 'Hindari' })
    expect(r.finalLots).toBe(100)
    expect(r.why).toContain('dipotong 50% karena pandangan analis Hindari')
    expect(r.checklist.at(-1)).toEqual({ ok: false, text: 'Pandangan analis bukan Hindari (Hindari)' })
    expect(r.verdict.cls).toBe('warn')
  })
  it('likuiditas membatasi lot', () => {
    expect(moneyMgmt(fake, mm, { valDay: 1e8 }).finalLots).toBe(100)
  })
  it('tanpa entry: tidak ada lot, tidak layak', () => {
    const r = moneyMgmt({ ...fake, entry: null }, mm)
    expect(r.finalLots).toBe(null); expect(r.verdict.text).toBe('Tidak layak dibuka sekarang')
  })
})
