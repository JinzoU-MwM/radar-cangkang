import { describe, expect, it } from 'vitest'
import { BAB, periksaTitik } from '../materiTitikXabcd.js'

const JENIS = ['p', 'h', 'poin', 'langkah', 'tabel', 'kotak', 'gambar', 'rumus']
const GAMBAR = ['arah', 'zigzag', 'xBenar', 'prz', 'contoh']

describe('materi titik XABCD', () => {
  it('bab valid: id unik, setiap blok satu jenis dikenal, tabel rapi, gambar dikenal', () => {
    expect(new Set(BAB.map(b => b.id)).size).toBe(BAB.length)
    for (const b of BAB) {
      expect(b.judul && b.blok.length, b.id).toBeTruthy()
      for (const k of b.blok) {
        const j = JENIS.filter(x => x in k)
        expect(j.length, `${b.id}: ${JSON.stringify(k).slice(0, 60)}`).toBe(1)
        if (k.tabel) for (const r of k.tabel.baris) expect(r.length, b.id).toBe(k.tabel.kolom.length)
        if (k.gambar) { expect(GAMBAR).toContain(k.gambar); expect(k.ket).toBeTruthy() }
        if (k.kotak) expect(['info', 'awas', 'ok']).toContain(k.kotak.jenis)
      }
    }
  })

  it('contoh Gartley di materi: rasio dan PRZ sama dengan hitungan di teks', () => {
    const h = periksaTitik({ x: 100, a: 200, b: 138, c: 176 })
    expect(h.arah).toBe('bullish')
    expect(h.rasio.b).toBeCloseTo(0.62, 2)
    expect(h.rasio.c).toBeCloseTo(0.613, 3)
    const g = h.cocok.find(p => p.k === 'gartley')
    expect(g.prz[0]).toBeGreaterThanOrEqual(118)
    expect(g.prz[1]).toBeLessThanOrEqual(125)
    expect(g.batal).toBe(100)
  })

  it('B 150 mengubah pola menjadi Bat dengan D sekitar 0,886 XA', () => {
    const h = periksaTitik({ x: 100, a: 200, b: 150, c: 180 })
    expect(h.cocok.map(p => p.k)).toEqual(['bat'])
    const [lo, hi] = h.cocok[0].prz
    expect(lo <= 111.4 && 111.4 <= hi).toBe(true)
  })

  it('bearish adalah cermin bullish; pola ekstensi memakai sisi luar PRZ sebagai batas batal', () => {
    const h = periksaTitik({ x: 200, a: 100, b: 162, c: 124 })
    expect(h.arah).toBe('bearish')
    const g = h.cocok.find(p => p.k === 'gartley'), c = h.cocok.find(p => p.k === 'crab')
    expect(g.batal).toBe(200)
    expect(c.batal).toBe(c.prz[1])
  })

  it('5-0: B melewati X dan C melewati A', () => {
    const h = periksaTitik({ x: 100, a: 200, b: 90, c: 300 })
    expect(h.lewatX && h.lewatA).toBe(true)
    expect(h.cocok[0].k).toBe('fiveo')
  })

  it('menolak titik tidak lengkap atau urutan puncak-lembah yang salah', () => {
    expect(periksaTitik({ x: 100, a: 200, b: 138 }).galat).toMatch(/Isi harga/)
    expect(periksaTitik({ x: 100, a: 100, b: 90, c: 95 }).galat).toMatch(/penggaris/)
    expect(periksaTitik({ x: 100, a: 200, b: 210, c: 220 }).galat).toMatch(/bullish/)
    expect(periksaTitik({ x: 200, a: 100, b: 90, c: 80 }).galat).toMatch(/bearish/)
  })

  it('rasio di luar semua pola: daftar cocok kosong', () => {
    expect(periksaTitik({ x: 100, a: 200, b: 170, c: 195 }).cocok).toEqual([])
  })
})
