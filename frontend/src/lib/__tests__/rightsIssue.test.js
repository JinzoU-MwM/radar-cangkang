import { describe, it, expect } from 'vitest'
import { riCase, riCalc, riRange, riVerdict } from '../rightsIssue.js'

// Data mirip NINE: PMHMETD I 2,44 miliar saham, asumsi harga Rp81, aset tambang ±Rp2,475 T lewat inbreng tahap II.
const A = {
  shares: 2157e6, price: 73, mcap: 157e9, flt: 58.91, ctrlPct: 35.85, equity: 26e9, injRp: null, reps: [],
  pa: {
    dilusi: { berlaku: true, sahamSekarang: 2157e6, sahamBaru: 2440e6, porsiPublikSekarang: 58.91, asumsi: 'PMHMETD I penuh 2,44 miliar saham pada harga pasar Rp81 (asumsi; belum ada harga resmi).' },
    kalkulator: { kasSegar: 197.64e9, hargaPelaksanaan: 81, dasar: 'Jumlah saham maks. 2,44 miliar; harga Rp81 adalah asumsi. PMHMETD I hingga 2,44 miliar saham (nominal Rp10).' },
  },
}
const aset = { transaksi: { nilaiRp: 2475e9, caraBayar: 'Inbreng/integrasi aset melalui rights issue (PMHMETD) tahap kedua' }, kjpp: { status: 'belum', nilaiRp: null } }
const sv = { injectTarget: 'Aset tambang Poh Group (PGGR), Mongolia', target: 'RUPSLB 18 November 2026' }

describe('riCase', () => {
  const c = riCase(A, { aset, sv })
  it('mengenali PMHMETD dan mengambil data kurasi', () => {
    expect(c).toMatchObject({ kind: 'PMHMETD', status: 'rencana', S0: 2157e6, N: 2440e6, ex: 81, exAssumed: true, nominal: 10, inj: 2475e9, inbreng: true, laterInj: 2475e9 })
  })
  it('null bila tidak ada rencana penambahan modal', () => {
    expect(riCase({ ...A, pa: { dilusi: { berlaku: false } } }, {})).toBeNull()
  })
  it('PMTHMETD dikenali dari teks', () => {
    expect(riCase({ ...A, pa: { kalkulator: { kasSegar: 28e9, dasar: 'Hasil PMTHMETD 66,67 jt saham' } } }, {}).kind).toBe('PMTHMETD')
  })
})

describe('riCalc', () => {
  const c = riCase(A, { aset, sv })
  const r = riCalc(c, 81, 0)
  it('menghitung kebutuhan dana, rasio, TERP, dan siapa menyetor', () => {
    expect(r.total).toBeCloseTo(2440e6 * 81)
    expect(r.tunai).toBeCloseTo(r.total)
    expect(r.ratio).toBeCloseTo(2440 / 2157)
    expect(r.terp).toBeCloseTo((2157e6 * 73 + 2440e6 * 81) / 4597e6)
    expect(r.ctrlPart).toBeCloseTo(0.3585 * r.total)
    expect(r.standby).toBeCloseTo(0.5891 * r.total)
    expect(r.pubAfter).toBeCloseTo(0.5891 * 2157 / 4597)
    expect(r.pubAfterInj).toBeLessThan(r.pubAfter)
  })
  it('publik menebus penuh menjaga porsinya', () => {
    expect(riCalc(c, 81, 1).pubAfter).toBeCloseTo(0.5891)
  })
  it('rentang slider mulai dari nominal', () => {
    expect(riRange(c)).toMatchObject({ lo: 10, start: 81 })
    expect(riVerdict(c, r)).toMatch(/kapitalisasi pasar/)
  })
})

describe('merger dan inbreng', () => {
  it('merger tanpa harga memakai harga tersirat nilai aset ÷ saham baru', () => {
    const c = riCase({ shares: 47.77e9, price: 3180, mcap: 150e12, flt: 18.88, ctrlPct: 48.37, reps: [],
      pa: { dilusi: { berlaku: true, sahamBaru: 24.12e9, asumsi: 'Merger sudah efektif 22 Apr 2026' }, kalkulator: { kasSegar: 0 } } },
      { aset: { transaksi: { nilaiRp: 10.42e12, caraBayar: 'Saham: penerbitan saham baru' } }, sv: { injectType: 'Merger (penggabungan usaha) dibayar saham baru' } })
    expect(c).toMatchObject({ kind: 'merger', status: 'tereksekusi' })
    expect(riRange(c).start).toBe(432)
    const r = riCalc(c, 432)
    expect(r.aset).toBeCloseTo(r.total)
    expect(r.standby).toBeNull()
  })
  it('inbreng + tunai dipisah dari nilai penerbitan', () => {
    const c = riCase({ shares: 11.6e9, price: 2150, mcap: 25e12, flt: 17.92, ctrlPct: 53.17, reps: [],
      pa: { dilusi: { berlaku: true, sahamBaru: 7.88e9 }, kalkulator: { nilaiDibayarSaham: 14.57e12, kasSegar: 2.37e12, hargaPelaksanaan: 2150, dasar: 'inbreng Rp14,57 T' } } },
      { aset: { transaksi: { nilaiRp: 14.57e12, caraBayar: 'inbreng 100% saham FFI dalam PMHMETD IV' } } })
    const r = riCalc(c, 2150)
    expect(r.aset).toBeCloseTo(14.57e12)
    expect(r.tunai).toBeCloseTo(7.88e9 * 2150 - 14.57e12)
  })
})

describe('rincian aset injeksi', () => {
  it('kisaran nilai dari beberapa sumber (USD dan Rupiah)', async () => {
    const { valuesOf, asetDetail } = await import('../rightsIssue.js')
    const t = 'Indikatif USD150 juta (Rp2,51 triliun) menurut pengumuman Desember 2025; IDX Channel Oktober 2026 menyebut indikatif USD100 juta (Rp1,8 triliun). Konversi Rp16.500: USD150 juta = Rp2.475.000.000.000'
    const v = valuesOf(t)
    expect(Math.min(...v)).toBeCloseTo(1.65e12)
    expect(Math.max(...v)).toBeCloseTo(2.51e12)
    const d = asetDetail({ aset: { nama: 'PGGR', tambang: { produksi: '>20 juta ton', cadangan: null } }, transaksi: { nilai: t, caraBayar: 'Inbreng' },
      kjpp: { status: 'belum' }, tidakDitemukan: ['kjpp: dua penilai independen belum diumumkan'] }, 2475e9)
    expect(d).toMatchObject({ spread: true, cara: 'Inbreng', gaps: ['dua penilai independen belum diumumkan'] })
    expect(d.facts).toEqual([['Produksi', '>20 juta ton']])
  })
})
