import { describe, it, expect } from 'vitest'
import { mergeBoard, boardStats } from '../profil.js'
import { newReason, chText } from '../diff.js'
import { buildAnalysis } from '../analysis.js'

describe('mergeBoard', () => {
  const riset = {
    direksi: [{ nama: 'Axel Tobias Joel', jabatan: 'Direktur', orangPengendaliBaru: true }, { nama: 'Orang Lama', jabatan: 'Direktur' }],
    komisaris: [{ nama: 'Adi Sulaiman', jabatan: 'Komisaris' }],
  }
  const sb = { directors: ['DIONYSIUS TJOKRO (Direktur Utama)', 'AXEL TOBIAS JOEL'],
    commissioners: ['KARNADI MARGAKA (Komisaris Utama)', 'ADI SULAIMAN ', 'PURWAN HABIBIE SISWANTO (independen)'] }
  const m = mergeBoard(riset, sb)
  it('menambah Direktur/Komisaris Utama dari Stockbit di urutan teratas', () => {
    expect(m.direksi[0]).toMatchObject({ nama: 'Dionysius Tjokro', jabatan: 'Direktur Utama', fromStockbit: true })
    expect(m.komisaris[0]).toMatchObject({ nama: 'Karnadi Margaka', jabatan: 'Komisaris Utama' })
    expect(m.komisaris.find(x => x.nama.startsWith('Purwan'))).toMatchObject({ jabatan: 'Komisaris Independen', independen: true })
  })
  it('menandai pengurus riset yang tidak lagi tercantum', () => {
    expect(m.direksi.find(x => x.nama === 'Orang Lama').notListed).toBe(true)
    expect(m.direksi.at(-1).nama).toBe('Orang Lama')
    expect(boardStats(m).n).toBe(5)
  })
  it('tanpa data Stockbit, riset dipakai apa adanya', () => {
    expect(mergeBoard(riset, null).direksi).toHaveLength(2)
  })
})

describe('newReason', () => {
  it('menjelaskan tender wajib, pengendali, dan rencana', () => {
    const t = newReason({ ticker: 'ABCD', tender: { price: 436, percent: 54.55, start: '2026-01-15', end: '2026-02-13' }, ctrlName: 'PT X', ctrlPct: 42.4 },
      { verified: { ABCD: { baru: 'Industri komponen' } } })
    expect(t).toMatch(/tender wajib Rp436\/saham untuk 54,55% saham/)
    expect(t).toMatch(/pengendali baru PT X 42,4%/)
    expect(t).toMatch(/rencana: industri komponen/)
    expect(chText({ k: 'new' }, null)).toBe('baru masuk radar')
  })
})

describe('pemegang ≥5% yang basi', () => {
  it('ditandai below5 dengan porsi terkini dari daftar ≥1%', () => {
    const A = buildAnalysis({ ticker: 'ABCD', item: null, reports: [],
      profile: { shareholders: [{ name: 'PT PIMSF PULOGADUNG', pct: '42.4%', pengendali: true }, { name: 'MASYARAKAT', pct: '57.6%' }],
        holders1: [{ name: 'TRIPLE BERKAH BERSAMA', pct: 1.9 }] },
      insider: { holders: [{ name: 'TRIPLE BERKAH BERSAMA', from: 0, to: 5.17, change: 5.17 }, { name: 'ELISA', from: 0, to: 5.63, change: 5.63 },
        { name: 'PIMSF PULOGADUNG', from: 0, to: 42.4, change: 42.4 }] } })
    const by = n => A.holders.find(h => h.name === n)
    expect(by('TRIPLE BERKAH BERSAMA')).toMatchObject({ below5: true, now: 1.9 })
    expect(by('ELISA')).toMatchObject({ below5: true, now: null })
    expect(by('PIMSF PULOGADUNG').below5).toBeUndefined()
  })
})

describe('newReason emiten radar tanpa tender', () => {
  it('memakai sinyal dan peristiwa terbaru', () => {
    const t = newReason({ ticker: 'APEX', stage: 'radar', flags: { rights: true },
      signals: { rights: { st: 'on', d: '2026-10-07', ev: [{ d: '2026-10-07', text: 'Agenda PMTHMETD 218.090.317 saham Seri B nominal Rp325' }] } } })
    expect(t).toBe('Rencana dilusi · Agenda PMTHMETD 218.090.317 saham Seri B nominal Rp325 (7 Okt 2026)')
  })
  it('jatuh ke catatan bila tidak ada peristiwa', () => {
    expect(newReason({ ticker: 'FLMC', stage: 'radar', flags: { cangkang: true }, notes: 'Profil cangkang: rugi Rp23 M. Belum ada sinyal.' }))
      .toBe('Profil cangkang · Profil cangkang: rugi Rp23 M.')
  })
})
