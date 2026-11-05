import { describe, it, expect } from 'vitest'
import { fibLevels, ukuranPosisi, KUIS, nilaiKuis } from '../harmonikBelajar.js'

describe('materi pemula harmonik', () => {
  it('fibLevels: retracement dan extension kaki XA', () => {
    const lv = fibLevels(100, 200)
    expect(lv.find(l => l.r === 0.618).harga).toBe(138)
    expect(lv.find(l => l.r === 0.786).harga).toBe(121)
    expect(lv.find(l => l.r === 1.618).harga).toBe(38)
    expect(fibLevels(100, 100)).toEqual([])
  })
  it('ukuranPosisi: lot dari risiko per transaksi', () => {
    const u = ukuranPosisi({ modal: 10e6, risikoPct: 2, entry: 500, stop: 470, target: 590 })
    expect(u).toMatchObject({ risikoRp: 200000, lot: 66, nilai: 3300000, rugiMaks: 198000, rr: 3, cukup: true })
    expect(ukuranPosisi({ modal: 10e6, risikoPct: 2, entry: 500, stop: 500 })).toBeNull()
  })
  it('kuis: kunci jawaban konsisten dengan kalkulator', () => {
    const soal = KUIS.find(k => k.q.startsWith('Modal Rp10 juta'))
    expect(soal.pilihan[soal.benar]).toBe('66 lot')
    expect(nilaiKuis({ 0: 0, 1: 0 })).toEqual({ benar: 1, total: KUIS.length, dijawab: 2 })
  })
})
