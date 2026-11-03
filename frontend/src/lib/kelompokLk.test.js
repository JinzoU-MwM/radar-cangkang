import { describe, expect, it } from 'vitest'
import { bankAsuransi, grupKonglo, komoditas, terbaikPerKelompok } from './kelompokLk.js'

const r = (t, pe, extra = {}) => ({ t, nama: '', kuartal: { pe }, ...extra })
const semua = () => true

describe('kelompokLk', () => {
  it('konglo dan pengecualian bank/asuransi', () => {
    expect(grupKonglo('SIMP')).toBe('Salim')
    expect(bankAsuransi({ nama: 'Bank Woori Saudara' })).toBe(true)
    expect(bankAsuransi({ kelas: { sub: 'Insurance' } })).toBe(true)
    expect(bankAsuransi({ nama: 'Mitrabara Adiperdana', kelas: { sub: 'Coal' } })).toBe(false)
  })

  it('satu saham per kelompok, PE terendah, tidak dipakai dua kali', () => {
    const rows = [
      r('SIMP', 3.1, { kelas: { ind: 'Plantations & Crops' } }),
      r('LSIP', 4.1, { kelas: { ind: 'Plantations & Crops' } }),
      r('MBAP', 5, { kelas: { sub: 'Coal' } }),
      r('NAYZ', 9, { radar: true, backdoor: true }),
      r('KOTA', 6, { radar: true }),   // baru bersinyal di radar: bukan backdoor
      r('TLKM', 12, { kelas: { sub: 'Telecommunication' } }),
      r('BBRI', 2, { nama: 'Bank Rakyat Indonesia', kelas: { sub: 'Banks' } }),
    ]
    const h = Object.fromEntries(terbaikPerKelompok(rows, semua).map(g => [g.k, g.x?.t || null]))
    expect(h).toEqual({ konglo: 'SIMP', cpo: 'LSIP', backdoor: 'NAYZ', tambang: 'MBAP', telko: 'TLKM', konsumen: null })
  })

  it('SMAR masuk CPO walau profilnya produk makanan', () => {
    // SIMP mengisi Konglo lebih dulu, sehingga SMAR (Sinar Mas) tersedia untuk CPO; bukan Konsumen.
    const g = terbaikPerKelompok([r('SIMP', 3.1), r('SMAR', 3.87, { kelas: { ind: 'Food Products' } }), r('CSRA', 3.89)], semua)
    expect(g.find(x => x.k === 'cpo').x.t).toBe('SMAR')
    expect(g.find(x => x.k === 'konsumen').x).toBe(null)
  })

  it('tambang mencakup emas, nikel, batu bara', () => {
    const g = terbaikPerKelompok([r('MDKA', 9), r('INCO', 8), r('PTBA', 7)], semua).find(x => x.k === 'tambang')
    expect(g.x.t).toBe('PTBA')
    expect(komoditas('MDKA')).toBe('Emas')
    expect(komoditas('INCO')).toBe('Nikel')
  })

  it('telekomunikasi termasuk produsen kabel', () => {
    const h = terbaikPerKelompok([r('SCCO', 4.96), r('KBLI', 5.83)], semua).find(g => g.k === 'telko')
    expect(h.x.t).toBe('SCCO')
  })

  it('kelompok kosong bila tidak ada yang lolos', () => {
    expect(terbaikPerKelompok([r('MBAP', 5, { kelas: { sub: 'Coal' } })], () => false).every(g => g.x === null)).toBe(true)
  })
})
