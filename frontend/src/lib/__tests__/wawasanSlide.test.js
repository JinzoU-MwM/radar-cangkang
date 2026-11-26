import { describe, expect, it } from 'vitest'
import { jsPDF } from 'jspdf'
import { BAGIAN } from '../wawasan.js'
import { MARKET_MAKER, LANGKAH_OB, bagianDeck, butirWawasan, deckTopik, lotRisiko } from '../wawasanSlide.js'
import { ADA, ANALOGI } from '../wawasanAnalogi.js'
import { slideCetak, wawasanPdf, wawasanPdfName } from '../wawasanPdf.js'

const GAMBAR = ['keset', 'grosir', 'pohon', 'antrean', 'belanja', 'akumulasi', 'shakeout', 'distribusi', 'stop']
const semua = BAGIAN.flatMap(b => b.kurang.map(k => ({ k, menu: b.menu })))

describe('presentasi Wawasan', () => {
  it('setiap topik punya deck yang tiap slidenya berisi', () => {
    for (const { k, menu } of semua) {
      const d = deckTopik(k, menu)
      expect(d.length, k.id).toBeGreaterThanOrEqual(3)
      expect(new Set(d.map(s => s.id)).size, k.id).toBe(d.length)
      for (const s of d) expect(butirWawasan(s).length > 0 || s.pilihan || s.alat || s.periksa, s.id).toBeTruthy()
    }
  })
  it('deck market maker dipakai untuk topiknya dan lengkap', () => {
    const k = semua.find(x => x.k.id === 'dunia-market-maker').k
    expect(deckTopik(k)).toBe(MARKET_MAKER)
    expect(bagianDeck(MARKET_MAKER)).toEqual(['Pengantar', 'Cara kerja pemain besar', 'Cara bertahan', 'Latihan'])
    for (const s of MARKET_MAKER) {
      if (s.gambar) expect(GAMBAR, s.id).toContain(s.gambar)
      if (s.alat) expect(['orderbook', 'kalkulator'], s.id).toContain(s.alat)
      if (s.tabel) s.tabel.baris.forEach(b => expect(b, s.id).toHaveLength(s.tabel.kolom.length))
      if (s.pilihan) {
        expect(s.pilihan.opsi.filter(o => o.benar), s.id).toHaveLength(1)
        for (const o of s.pilihan.opsi) expect(o.alasan.length, s.id).toBeGreaterThan(20)
      }
    }
    expect(MARKET_MAKER.filter(s => s.analogi).length).toBeGreaterThanOrEqual(4)
    expect(MARKET_MAKER.filter(s => s.pilihan).length).toBe(3)
  })
  it('setiap topik punya analogi, gambar hanya untuk yang sudah dibuat', () => {
    for (const { k } of semua) {
      if (k.id === 'dunia-market-maker') continue
      expect(ANALOGI[k.id]?.teks?.length, k.id).toBeGreaterThan(40)
      const s2 = deckTopik(k)[1]
      expect(s2.analogi, k.id).toBe(ANALOGI[k.id].teks)
      expect(s2.gambar, k.id).toBe(ADA.includes(k.id) ? k.id : undefined)
    }
    for (const id of ADA) expect(semua.some(x => x.k.id === id), id).toBe(true)
  })
  it('kalkulator ukuran posisi', () => {
    const r = lotRisiko({ modal: 100_000_000, risiko: 1, beli: 200, stop: 188 })
    expect(r.lot).toBe(833)
    expect(r.rugi).toBe(833 * 100 * 12)
    expect(r.rugi).toBeLessThanOrEqual(r.rugiMaks)
    // dibatasi modal: stop sangat dekat tidak boleh melebihi uang yang ada
    expect(lotRisiko({ modal: 10_000_000, risiko: 5, beli: 1000, stop: 999 }).lot).toBe(100)
    expect(lotRisiko({ modal: 1e8, risiko: 1, beli: 200, stop: 200 })).toBeNull()
    expect(lotRisiko({ modal: 0, risiko: 1, beli: 200, stop: 190 })).toBeNull()
  })
  it('simulasi order book: antrean ditarik sebelum harga jatuh', () => {
    const i = LANGKAH_OB.findIndex(l => !l.tebal)
    expect(i).toBeGreaterThan(0)
    expect(LANGKAH_OB.at(-1).harga).toBeLessThan(150)
  })
  it('PDF per topik: alat diganti uraian, daftar periksa berkotak', () => {
    const c = slideCetak(MARKET_MAKER)
    expect(c.find(s => s.alat === 'orderbook').poin).toHaveLength(LANGKAH_OB.length)
    expect(c.find(s => s.periksa).poin[0]).toMatch(/^\[ {2}\]/)
    for (const { k, menu } of [semua[0], semua.find(x => x.k.id === 'dunia-market-maker')]) {
      const doc = wawasanPdf(k, menu, jsPDF)
      expect(doc.getNumberOfPages()).toBeGreaterThan(2)
      expect(doc.output()).toContain('Daftar isi')
    }
    expect(wawasanPdfName({ id: 'dunia-market-maker' })).toMatch(/^Wawasan-dunia-market-maker_\d{4}-\d{2}-\d{2}\.pdf$/)
  })
})
