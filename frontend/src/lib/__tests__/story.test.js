import { describe, it, expect } from 'vitest'
import { deriveStory, nominalOf } from '../story.js'

const item = { ticker: 'ABCD', name: 'PT Abcd Tbk', stage: 'tender' }
const updates = [{ ticker: 'ABCD', date: '2026-09-01', title: 'Rencana inbreng tambang nikel', summary: 'Perseroan akan melakukan inbreng saham PT Nikel Jaya senilai Rp500 miliar.' }]

describe('deriveStory', () => {
  it('otomatis dari laporan', () => {
    const s = deriveStory(item, { updates })
    expect(s.verified).toBe(false)
    expect(s.injType).toBe('Tambang nikel')
    expect(s.nominal).toBe('Rp500 miliar')
  })
  it('terverifikasi mengalahkan otomatis', () => {
    const s = deriveStory(item, { updates, verified: { ABCD: { injectType: 'Energi', nominal: 'Rp1 T', baru: 'Energi terbarukan' } } })
    expect(s.verified).toBe(true)
    expect(s.injType).toBe('Energi')
    expect(s.nominal).toBe('Rp1 T')
    expect(s.baru).toBe('Energi terbarukan')
  })
  it('koreksi manual mengalahkan terverifikasi', () => {
    const s = deriveStory({ ...item, story: { nominal: 'Rp2 T', baru: 'Manual' } }, { updates, verified: { ABCD: { nominal: 'Rp1 T', baru: 'X' } } })
    expect(s.nominal).toBe('Rp2 T'); expect(s.nominalEdited).toBe(true)
    expect(s.baru).toBe('Manual')
  })
})

describe('nominalOf', () => {
  it('mengambil nominal terbesar, USD dikonversi kasar', () => {
    expect(nominalOf('nilai Rp1,54 triliun dan Rp 87,67 miliar').txt).toBe('Rp1,54 triliun')
    expect(nominalOf('USD200 juta atau Rp1 triliun').txt).toBe('USD200 juta')
  })
})
