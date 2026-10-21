import { describe, it, expect } from 'vitest'
import PptxGenJS from 'pptxgenjs'
import { jsPDF } from 'jspdf'
import { buildDeck, deckFileName } from '../deck.js'
import { THEMES, SECTORS } from '../deckThemes.js'
import { deckToPdf, pdfText, pdfFileName } from '../deckPdf.js'

describe('deckToPdf', () => {
  const d = {
    t: 'ABCD', name: 'PT Abcd Tbk', sector: SECTORS.find(s => s.id === 'umum'), date: '2026-10-21',
    A: { score: 50, verdict: 'Netral', dims: [], p: {}, sv: {}, holders: [{ name: 'X', change: 5 }, { name: 'Y', change: -3 }], ctrlPct: 40, flt: 55 },
    pc: { pros: [], cons: [] }, deep: [], steps: [], milestones: [],
  }
  it('satu halaman PDF per slide, untuk tiap motif sampul', async () => {
    for (const s of SECTORS) {
      const pres = buildDeck(PptxGenJS, { ...d, sector: s }, THEMES[s.id][0])
      const doc = await deckToPdf(pres, jsPDF)
      expect(doc.getNumberOfPages()).toBe(pres.slides.length)
      expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(1000)
    }
  })
  it('karakter di luar WinAnsi dipetakan', () => {
    expect(pdfText('45% → 0 · ≥5% ✓ −2 — “ok”')).toBe('45% -> 0 · >=5% v -2 — “ok”')
    expect(pdfText('漢')).toBe('?')
  })
  it('nama berkas .pdf', () => {
    expect(pdfFileName(deckFileName('ABCD', '2026-10-21', { name: 'Arang & Amber' }))).toBe('ABCD_Analisa_2026-10-21_Arang-Amber.pdf')
  })
})
