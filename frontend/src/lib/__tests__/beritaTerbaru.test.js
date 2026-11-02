import { describe, it, expect } from 'vitest'
import { jsPDF } from 'jspdf'
import { beritaTerakhir, analisaBerita } from '../beritaTerbaru.js'
import { beritaPdf, beritaPdfName } from '../beritaPdf.js'

const updates = [
  { id: 'sb-news-1', ticker: 'NAYZ', date: '2026-11-02', title: 'Berita media NAYZ', summary: 'Isi berita.' },
  { id: 'sb-report-2', ticker: 'NAYZ', date: '2026-11-02', type: 'lainnya', title: 'Pendirian Anak Usaha dari Perseroan', url: 'https://stockbit.com/post/2',
    summary: 'NAYZ mendirikan anak usaha PT Integrasi Sistem Digital. Inti: Pendirian anak usaha baru dengan porsi 99,6% (Ringkasan AI Stockbit)',
    points: 'Porsi kepemilikan saham perseroan mencapai 2.490 lembar saham atau 99,6% · Total modal ditempatkan 2.500 lembar saham' },
  { id: 'sb-report-3', ticker: 'NAYZ', date: '2026-10-22', title: 'Laporan lama' },
  { id: 'sb-report-4', ticker: 'BBCA', date: '2026-11-03', title: 'Emiten lain' },
]
const pandangan = { NAYZ: { sikap: 'Spekulatif tinggi', ringkas: 'Ringkas tesis.', asOf: '2026-10-22', hargaAcuan: 77,
  nilaiWajar: { bawah: 58, atas: 75 }, variabelKunci: ['KJPP independen'], tesisSalahBila: ['Valuasi terkonfirmasi'] } }
const items = [{ ticker: 'NAYZ', price: 76, mcap: 190 }]

describe('analisa berita terbaru', () => {
  it('memilih dokumen terbaru emiten, keterbukaan resmi didahulukan pada tanggal sama', () => {
    expect(beritaTerakhir(updates, 'NAYZ').id).toBe('sb-report-2')
    expect(beritaTerakhir(updates, 'XXXX')).toBeNull()
  })
  it('menyusun ringkasan, poin, dampak, dan kaitan tesis', () => {
    const a = analisaBerita(beritaTerakhir(updates, 'NAYZ'), { items, pandangan, updates })
    expect(a.dampak.positif.some(x => /anak usaha baru/.test(x))).toBe(true)
    expect(a.dampak.positif.some(x => /99,6%/.test(x))).toBe(true)
    expect(a.dampak.negatif.some(x => /belum diungkap/.test(x))).toBe(true)
    expect(a.riwayat.map(r => r.judul)).toEqual(['Laporan lama'])
    expect(a.implikasi[0]).toMatch(/-1,3%/)
    expect(a.ringkas).toBe('NAYZ mendirikan anak usaha PT Integrasi Sistem Digital.')
    expect(a.poin).toHaveLength(2)
    expect(['Positif', 'Netral', 'Negatif']).toContain(a.dampak.label)
    expect(a.tesis.baru).toBe(true)
    expect(a.tesis.posisi).toMatch(/di atas rentang nilai wajar/)
    expect(a.pantau).toContain('KJPP independen')
    expect(a.kesimpulan).toMatch(/terbit setelah analisa kurasi 2026-10-22/)
  })
  it('membuat PDF analisa', async () => {
    const a = analisaBerita(beritaTerakhir(updates, 'NAYZ'), { items, pandangan })
    const doc = await beritaPdf(a, jsPDF)
    expect(doc.getNumberOfPages()).toBe(3)
    expect(beritaPdfName(a)).toBe('Analisa-NAYZ_Berita-2026-11-02.pdf')
    const b = analisaBerita(updates[0], {})
    expect((await beritaPdf(b, jsPDF)).getNumberOfPages()).toBe(3)
  })
})
