import { describe, it, expect } from 'vitest'
import { speakable, sentences, buildVideo, lineSecs, toSrt, toScript } from '../videoScript.js'

describe('speakable', () => {
  it('angka, satuan, dan singkatan dibaca wajar', () => {
    expect(speakable('Nilai Rp2,48 T dan Rp197,6 M, porsi 58,9% → 27,6%, 15,3× kapitalisasi'))
      .toBe('Nilai 2,48 triliun rupiah dan 197,6 miliar rupiah, porsi 58,9 persen menjadi 27,6 persen, 15,3 kali kapitalisasi')
    expect(speakable('Kisaran Rp11–Rp49 · PMHMETD belum dinilai KJPP')).toBe('Kisaran 11 rupiah hingga 49 rupiah, rights issue belum dinilai K J P P')
  })
})

describe('sentences', () => {
  it('tidak memotong singkatan nama perusahaan', () => {
    expect(sentences('Poh Holdings Pte. Ltd. masuk bertahap. Porsinya 35,85%.')).toEqual(['Poh Holdings Pte. Ltd. masuk bertahap.', 'Porsinya 35,85%.'])
  })
})

describe('buildVideo', () => {
  const d = {
    t: 'ABCD', name: 'PT Abcd Tbk', sector: { label: 'Umum' }, date: '2026-10-22',
    A: { price: 100, mcap: 1e11, ctrlPct: 40, ctrlName: 'PT X', flt: 50, score: 55, tender: { price: 120 }, levels: [['Harga PTW', 'Biaya masuk pengendali', 120], ['Skenario turun', 'kembali ke harga awal', 60]],
      dims: [{ k: 'Pengendali', s: 5, why: ['a.'] }, { k: 'Fundamental', s: 3, why: ['b.'] }], checks: ['KJPP terbit'], exits: ['Harga di bawah PTW'] },
    pa: { sikap: 'Netral', ringkas: 'Ringkasan singkat.', tesis: 'Kalimat satu. Kalimat dua.', nilaiWajar: { bawah: 80, atas: 110, metode: 'Nilai buku.' } },
    aset: { aset: { nama: 'PT Aset' }, transaksi: { nilaiRp: 5e11 } },
    rec: { label: 'Menunggu konfirmasi, belum membeli', entry: [110, null], stop: 90, targets: [{ p: 120, l: 'harga PTW' }], porsi: '0% pada saat ini', holder: 'Bagi pemegang saham, tahan.', triggers: ['KJPP terbit'], exits: ['Harga di bawah PTW'] },
  }
  it('versi ringkas lebih pendek dari lengkap, keduanya diawali pembuka dan diakhiri penutup', () => {
    const r = buildVideo(d, 'ringkas'), l = buildVideo(d, 'lengkap')
    expect(r[0].id).toBe('buka'); expect(r.at(-1).id).toBe('penutup')
    expect(l.length).toBeGreaterThan(r.length)
    const secs = sc => sc.flatMap(s => s.lines).reduce((a, x) => a + lineSecs(x), 0)
    expect(secs(l)).toBeGreaterThan(secs(r))
    expect(r.find(s => s.id === 'rekomendasi').lines[0]).toMatch(/menunggu konfirmasi/)
  })
  it('subtitle dan naskah terbentuk', () => {
    const sc = buildVideo(d, 'ringkas')
    expect(toSrt(sc)).toMatch(/^1\n00:00:00,000 --> /)
    expect(toScript(sc, d)).toMatch(/1\. Pembuka/)
  })
})
