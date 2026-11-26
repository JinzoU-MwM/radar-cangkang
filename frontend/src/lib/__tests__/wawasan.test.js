import { describe, expect, it } from 'vitest'
import { BAGIAN, PRIORITAS, hitungPrioritas, urutanBelajar } from '../wawasan.js'
import { readFileSync } from 'node:fs'

describe('wawasan', () => {
  it('mencakup semua menu utama Radar dengan rute yang ada', () => {
    expect(BAGIAN.map(b => b.menu)).toEqual(['Berita', 'Monitor', 'Kandidat', 'IHSG', 'Harmonic Pattern', 'Rekomendasi'])
    // router.js butuh window (hash history), jadi rute dicek dari teks berkasnya.
    const teks = readFileSync(new URL('../../router.js', import.meta.url), 'utf8')
    for (const b of BAGIAN) expect(teks).toContain(`path: '${b.rute}', name:`)
  })

  it('setiap topik lengkap dan id-nya unik', () => {
    const ids = new Set()
    for (const b of BAGIAN) {
      expect(b.inti).toBeTruthy()
      expect(b.sudah.length).toBeGreaterThan(0)
      expect(b.kurang.length).toBeGreaterThan(0)
      for (const k of b.kurang) {
        expect(ids.has(k.id)).toBe(false); ids.add(k.id)
        expect(PRIORITAS[k.prioritas]).toBeTruthy()
        for (const f of ['judul', 'kenapa', 'wawasan']) expect(k[f].length).toBeGreaterThan(10)
        expect(k.pelajari.length).toBeGreaterThan(0)
        expect(k.sumber.length).toBeGreaterThan(0)
      }
    }
  })

  it('urutan belajar: prioritas dulu, lalu urutan menu', () => {
    const u = urutanBelajar()
    expect(u.length).toBe(BAGIAN.reduce((n, b) => n + b.kurang.length, 0))
    for (let i = 1; i < u.length; i++) expect(u[i].prioritas).toBeGreaterThanOrEqual(u[i - 1].prioritas)
    expect(u[0]).toMatchObject({ id: 'berita-sumber', menu: 'Berita', rute: '/berita' })
    const n = hitungPrioritas()
    expect(n[1] + n[2] + n[3]).toBe(u.length)
  })
})
