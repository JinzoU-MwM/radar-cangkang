import { describe, expect, it } from 'vitest'
import { KODE_KATA, kodeSah, serbaKapital } from '../kodeKata.js'
import { tickerParts } from '../profil.js'

describe('kode saham yang juga kata umum', () => {
  const known = new Set(['PADA', 'PACK', 'MSCI', 'NINE'])
  const kode = s => tickerParts(s, known).filter(p => p.ticker).map(p => p.ticker)

  it('judul serba kapital: kata "PADA" bukan tautan, "(PACK)" tetap', () => {
    expect(serbaKapital('PACK TUNDA RUPSLB, JADWALKAN KEMBALI PADA 8 DESEMBER 2026')).toBe(true)
    expect(kode('PACK TUNDA RUPSLB, JADWALKAN KEMBALI PADA 8 DESEMBER 2026')).toEqual([])
    expect(kode('PT ABADI NUSANTARA HIJAU INVESTAMA TBK (PACK) MENUNDA RUPSLB')).toEqual(['PACK'])
  })
  it('teks campuran: kode polos ditautkan, singkatan umum tidak', () => {
    expect(kode('Masuk NINE lalu PADA naik')).toEqual(['NINE', 'PADA'])
    expect(kode('Tekanan MSCI menekan saham')).toEqual([])
    expect(kode('Saham $MSCI naik')).toEqual(['MSCI'])
    expect(kode('Rekomendasi Saham Hari Ini: NINE, MSCI, PADA')).toEqual(['NINE', 'MSCI', 'PADA'])
    expect(kode('Gedung PEMERINTAH PADA PROVINSI baru diresmikan hari ini')).toEqual([])
  })
  it('daftar memuat kode yang salah tanda pada 27 Nov 2026', () => {
    for (const t of ['PADA', 'KOTA', 'PIPA', 'AGAR', 'NATO', 'BUMN']) expect(KODE_KATA.has(t), t).toBe(true)
    expect(kodeSah('lihat (PADA) ya', 'PADA', 7)).toBe(true)
  })
})
