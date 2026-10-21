import { describe, it, expect } from 'vitest'
import PptxGenJS from 'pptxgenjs'
import { sectorOf, pickTheme, THEMES, SECTORS } from '../deckThemes.js'
import { short, buildDeck, deckFileName } from '../deck.js'

describe('sectorOf', () => {
  it('mengenali bisnis dari teks', () => {
    expect(sectorOf({ baru: 'tambang batu bara di Kalimantan' }).id).toBe('batubara')
    expect(sectorOf({ aset: 'smelter nikel' }).id).toBe('logam')
    expect(sectorOf({ baru: 'rumah sakit jantung' }).id).toBe('kesehatan')
    expect(sectorOf({ sektor: 'Technology', industri: 'Software' }).id).toBe('teknologi')
  })
  it('pelayaran pengangkut batu bara tetap logistik', () => {
    expect(sectorOf({ baru: 'pelayaran tongkang batu bara' }).id).toBe('logistik')
  })
  it('jatuh ke umum bila tidak ada petunjuk', () => {
    expect(sectorOf({ nama: 'PT Xyz Tbk' }).id).toBe('umum')
    expect(sectorOf().id).toBe('umum')
  })
})

describe('pickTheme', () => {
  it('setiap sektor punya tiga varian dengan id unik', () => {
    for (const s of SECTORS) expect(THEMES[s.id]?.length).toBe(3)
    const ids = Object.values(THEMES).flat().map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('tidak mengulang tema unduhan sebelumnya', () => {
    for (const r of [0, 0.5, 0.99]) {
      const last = THEMES.batubara[0].id
      expect(pickTheme('batubara', { lastId: last, rand: () => r }).id).not.toBe(last)
    }
  })
  it('pilihan manual dihormati, termasuk tema sektor lain', () => {
    expect(pickTheme('batubara', { choose: THEMES.kesehatan[1].id }).id).toBe(THEMES.kesehatan[1].id)
  })
})

describe('short', () => {
  it('teks pendek tidak diubah', () => expect(short('Halo dunia', 20)).toBe('Halo dunia'))
  it('memotong di batas kalimat atau kata, tidak di tengah kata', () => {
    const s = short('Pengendali baru masuk lewat tender wajib dan menyiapkan inbreng aset tambang senilai besar', 40)
    expect(s.length).toBeLessThanOrEqual(40)
    expect(s.endsWith('…')).toBe(true)
    expect(s).not.toMatch(/\s…$/)
  })
})

describe('buildDeck', () => {
  // Data minimal: slide yang datanya kosong harus dilewati tanpa galat.
  const d = {
    t: 'ABCD', name: 'PT Abcd Tbk', sector: SECTORS.find(s => s.id === 'umum'), date: '2026-10-21',
    A: { score: 50, verdict: 'Netral', dims: [], p: {}, sv: {} }, pc: { pros: [], cons: [] }, deep: [], steps: [], milestones: [],
  }
  it('menghasilkan slide tanpa ukuran negatif atau NaN', async () => {
    for (const th of Object.values(THEMES).flat().slice(0, 3)) {
      const pres = buildDeck(PptxGenJS, d, th)
      expect(pres.slides.length).toBeGreaterThan(1)
      const json = JSON.stringify(pres.slides.map(s => s._slideObjects.map(o => o.options)))
      expect(json).not.toMatch(/"[wh]":-|NaN/)
    }
  })
  it('nama berkas aman', () => {
    expect(deckFileName('ABCD', '2026-10-21', { name: 'Arang & Amber' })).toBe('ABCD_Analisa_2026-10-21_Arang-Amber.pptx')
  })
})
