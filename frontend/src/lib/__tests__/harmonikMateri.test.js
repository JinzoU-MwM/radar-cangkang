import { describe, expect, it } from 'vitest'
import { SLIDE, diagramAbcd, totalSlide } from '../harmonikMateri.js'
import { POLA } from '../harmonikAlat.js'

describe('materi harmonic', () => {
  it('setiap slide punya id unik, judul, dan isi', () => {
    expect(new Set(SLIDE.map(s => s.id)).size).toBe(SLIDE.length)
    for (const s of SLIDE) {
      expect(s.judul).toBeTruthy()
      expect((s.poin?.length || 0) + (s.tabel?.baris?.length || 0)).toBeGreaterThan(0)
      if (s.tabel) s.tabel.baris.forEach(b => expect(b).toHaveLength(s.tabel.kolom.length))
      if (s.pola) expect(s.pola === 'abcd' || POLA[s.pola]).toBeTruthy()
      if (s.alat) expect(['xabcd', 'fib', 'ext', 'elliott', 'long', 'short']).toContain(s.alat)
    }
    expect(totalSlide).toBe(SLIDE.length + 1)
  })
  it('AB=CD bullish: A di atas, D paling bawah', () => {
    const d = diagramAbcd('bullish'), y = Object.fromEntries(d.titik.map(t => [t.n, t.y]))
    expect(y.A).toBe(0)
    expect(y.D).toBe(1)
    expect(y.B).toBeGreaterThan(y.C)
  })
})
