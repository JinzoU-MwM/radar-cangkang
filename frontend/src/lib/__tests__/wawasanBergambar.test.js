import { describe, expect, it } from 'vitest'
import { jsPDF } from 'jspdf'
import { BAGIAN } from '../wawasan.js'
import { MARKET_MAKER, deckTopik } from '../wawasanSlide.js'
import { GAMBAR_SLIDE, deckBergambar } from '../wawasanGambarSlide.js'
import { DAFTAR_MOTIF, WARNA_HEX, svgMotif } from '../wawasanMotif.js'
import { wawasanPdfBergambar, wawasanPdfName } from '../wawasanPdf.js'

const semua = BAGIAN.flatMap(b => b.kurang.map(k => ({ k, menu: b.menu, bagian: b.id })))
// PNG 1x1 untuk menggantikan rasterisasi canvas di Node.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('presentasi bergambar', () => {
  it('setiap slide di setiap topik punya gambar, deck biasa tidak berubah', () => {
    for (const { k, menu } of semua) {
      const g = deckBergambar(k, menu)
      const biasa = k.id === 'dunia-market-maker' ? MARKET_MAKER : deckTopik(k, menu)
      expect(g.map(s => s.id), k.id).toEqual(biasa.map(s => s.id))
      for (const s of g) expect(!!(s.motif || s.gambar || s.alat), s.id).toBe(true)
      for (const s of biasa) expect(s.motif, s.id).toBeUndefined()
    }
  })
  it('Dunia saham dan market maker: setiap slide punya perumpamaan sendiri', () => {
    for (const { k, menu, bagian } of semua.filter(x => x.bagian === 'dunia')) {
      for (const s of deckBergambar(k, menu)) expect(s.analogi?.length, s.id).toBeGreaterThan(20)
    }
  })
  it('semua motif yang dipakai tersedia dan labelnya di-escape', () => {
    for (const [id, g] of Object.entries(GAMBAR_SLIDE).filter(([, g]) => g.m)) {
      expect(DAFTAR_MOTIF, id).toContain(g.m)
      const svg = svgMotif(g)
      expect(svg.startsWith('<svg'), id).toBe(true)
      for (const t of [g.a, g.b, g.c, g.d].filter(Boolean)) expect(svg, id).toContain(t.replace(/&/g, '&amp;').replace(/</g, '&lt;'))
    }
    expect(svgMotif({ m: 'rambu', a: '<b>' })).toContain('&lt;b&gt;')
    expect(svgMotif({ m: 'tidak-ada' })).toBe('')
    expect(svgMotif({ m: 'kaca', a: 'x' }, WARNA_HEX)).not.toContain('var(--')
  })
  it('PDF bergambar memuat gambar tiap slide', async () => {
    const t = semua.find(x => x.k.id === 'dunia-dividen')
    let n = 0
    const doc = await wawasanPdfBergambar(t.k, t.menu, jsPDF, async () => { n++; return PNG })
    expect(n).toBe(deckBergambar(t.k, t.menu).filter(s => s.motif).length)
    expect(doc.getNumberOfPages()).toBeGreaterThan(2)
    expect(doc.output()).toContain('/Subtype /Image')
    expect(wawasanPdfName(t.k, true)).toMatch(/^Wawasan-dunia-dividen-bergambar_/)
  })
})
