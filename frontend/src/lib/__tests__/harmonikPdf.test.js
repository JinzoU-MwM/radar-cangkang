import { describe, it, expect } from 'vitest'
import { jsPDF } from 'jspdf'
import { harmonikPdf, harmonikPdfName } from '../harmonikPdf.js'

const tgl = i => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)
const jalur = (t, k = 10) => [...t.slice(1).flatMap((b, i) => Array.from({ length: k }, (_, j) => t[i] + (b - t[i]) * j / k)), t[t.length - 1]]
const cl = [...Array(200).fill(0).map((_, i) => 60 + i * 0.2), ...jalur([100, 200, 138.2, 175.3, 121.4])]
const bars = cl.map((c, i) => ({ d: tgl(i), o: c * 0.99, h: c * 1.01, l: c * 0.98, c, v: 1e5 }))
const pola = [{ k: 'gartley', nama: 'Gartley', ket: 'Pola tertua.', b: [0.618, 0.618], c: [0.382, 0.886], d: [0.786, 0.786], bc: [1.13, 1.618] },
  { k: 'cypher', nama: 'Cypher', ket: 'C melewati A.', b: [0.382, 0.618], cx: [1.272, 1.414], dxc: [0.786, 0.786] }]
const titik = [['X', 200], ['A', 210], ['B', 220], ['C', 230], ['D', 240]].map(([n, i]) => ({ n, d: tgl(i), p: Math.round(bars[i].c) }))
const row = { pola: 'gartley', arah: 'bullish', status: 'prz', harga: 121, prz: [118, 124], stop: 100, target: [151, 170], targetCA: [175, 200],
  rasio: { b: 0.62, c: 0.6 }, konfirmasi: ['pin bar 2026-08-29'], titik, skala: 0.06 }
const pivot = [{ d: tgl(200), p: 100, k: 'L' }, { d: tgl(210), p: 200, k: 'H' }, { d: tgl(220), p: 155, k: 'L' }, { d: tgl(230), p: 190, k: 'H' }, { d: tgl(240), p: 115, k: 'L', tentatif: true }]
const dasar = { t: 'UJIX', nama: 'Uji Tbk', sumber: 'harga harian Stockbit', bars, nilai: 5e9, likuid: true, minNilai: 1e9, pola, pivot }

describe('harmonikPdf', () => {
  it('analisa berpola: sampul, chart, rencana, dan disclaimer', async () => {
    const doc = await harmonikPdf({ ...dasar, rows: [row] }, 0, jsPDF)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(4)
  })
  it('tanpa pola: chart swing dan pola terdekat', async () => {
    const doc = await harmonikPdf({ ...dasar, rows: [] }, 0, jsPDF)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(3)
    expect(harmonikPdfName('MEJA')).toMatch(/^Harmonic-MEJA_\d{4}-\d\d-\d\d\.pdf$/)
  })
})
