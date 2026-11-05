import { describe, it, expect } from 'vitest'
import { saringHarmonik, hitungHarmonik, rentang, titikTeks, przTeks, analisaHarmonik, idxTanggal } from '../harmonik.js'

describe('analisaHarmonik', () => {
  const jalur = (t, n = 10) => [...t.slice(1).flatMap((b, i) => Array.from({ length: n }, (_, k) => t[i] + (b - t[i]) * k / n)), t[t.length - 1]]
  const tgl = i => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)
  const cl = [...Array(200).fill(0).map((_, i) => 60 + i * 0.2), ...jalur([100, 200, 138.2, 175.3, 121.4])]
  const bars = cl.map((c, i) => ({ d: tgl(i), o: c, h: c * 1.004, l: c * 0.996, c, v: i === cl.length - 1 ? 3e5 : 1e5 }))
  const titik = [['X', 200], ['A', 210], ['B', 220], ['C', 230], ['D', 240]].map(([n, i]) => ({ n, d: tgl(i), p: Math.round(bars[i].c) }))
  const pola = [{ k: 'gartley', nama: 'Gartley', b: [0.618, 0.618], c: [0.382, 0.886], d: [0.786, 0.786], bc: [1.13, 1.618] }]
  const r = { pola: 'gartley', arah: 'bullish', status: 'prz', harga: 121.4, prz: [118, 124], stop: 100, target: [151, 170], targetCA: [175, 200],
    rasio: { b: 0.618, c: 0.6 }, konfirmasi: ['pin bar 2026-08-29'], titik }

  it('mengurai kaki, simetri, tren, volume D, dan skor', () => {
    const a = analisaHarmonik(r, bars, pola)
    expect(a.kaki.map(k => k.n)).toEqual(['XA', 'AB', 'BC', 'CD'])
    expect(a.kaki[0]).toEqual({ n: 'XA', pct: 100, bar: 10 })
    expect(a.simetri.harga).toBeCloseTo(0.87, 1)
    expect(a.volD).toBe(3)
    expect(a.rincian.map(x => x.k)).toEqual(['Presisi rasio', 'Konfirmasi di PRZ', 'Searah tren besar', 'Simetri AB=CD', 'Likuiditas'])
    expect(a.skor).toBeGreaterThan(0)
    expect(['Kuat', 'Sedang', 'Lemah']).toContain(a.label)
    expect(a.narasi[0]).toMatch(/^Pola Gartley bullish/)
    expect(a.skenario[0].teks).toContain('stop 100')
  })
  it('status menuju: konfirmasi bernilai nol dan skenario menunggu D', () => {
    const a = analisaHarmonik({ ...r, status: 'menuju', jarak: 5, titik: titik.slice(0, 4), konfirmasi: [] }, bars, pola)
    expect(a.rincian[1].nilai).toBe(0)
    expect(a.simetri).toBeNull()
    expect(a.skenario[0].k).toBe('Harga masuk PRZ')
  })
  it('idxTanggal mencari bar pada/sesudah tanggal', () => {
    expect(idxTanggal(bars, tgl(5))).toBe(5)
    expect(idxTanggal(bars, '2099-01-01')).toBe(bars.length - 1)
    expect(analisaHarmonik(null, bars)).toBeNull()
  })
})

const rows = [
  { t: 'AAAA', status: 'prz', arah: 'bullish' },
  { t: 'BBBB', status: 'menuju', arah: 'bearish' },
  { t: 'CCCC', status: 'menuju', arah: 'bullish' },
]

describe('saringHarmonik & hitungHarmonik', () => {
  it('menyaring status dan arah', () => {
    expect(saringHarmonik(rows).length).toBe(3)
    expect(saringHarmonik(rows, 'menuju').map(r => r.t)).toEqual(['BBBB', 'CCCC'])
    expect(saringHarmonik(rows, 'menuju', 'bullish').map(r => r.t)).toEqual(['CCCC'])
    expect(saringHarmonik(undefined)).toEqual([])
  })
  it('menghitung per status dan arah', () => {
    expect(hitungHarmonik(rows)).toEqual({ semua: 3, prz: 1, berbalik: 0, menuju: 2, bullish: 2, bearish: 1 })
  })
})

describe('teks ringkas', () => {
  it('menulis rasio, titik, dan PRZ dengan format Indonesia', () => {
    expect(rentang([0.618, 0.618])).toBe('0,618')
    expect(rentang([0.382, 0.886])).toBe('0,382–0,886')
    expect(rentang(undefined)).toBe('–')
    expect(titikTeks([{ n: 'X', p: 1200, d: '2026-10-01' }, { n: 'A', p: 1500, d: '2026-10-09' }])).toBe('X 1.200 (2026-10-01) · A 1.500 (2026-10-09)')
    expect(przTeks({ prz: [2684, 2729] })).toBe('2.684–2.729')
  })
})

import { polaDiagram, skalaSvg, rencanaHarmonik, cekRasio } from '../harmonik.js'

describe('polaDiagram & skalaSvg', () => {
  it('Gartley bullish: B 0,618, D 0,786 XA dari A', () => {
    const g = polaDiagram({ b: [0.618, 0.618], c: [0.382, 0.886], d: [0.786, 0.786] })
    expect(g.y.X).toBe(0); expect(g.y.A).toBe(1)
    expect(g.y.B).toBeCloseTo(0.382, 3)
    expect(g.y.D).toBeCloseTo(0.214, 3)
    expect(g.prz[0]).toBeLessThan(g.y.D); expect(g.prz[1]).toBeGreaterThan(g.y.D)
    expect(polaDiagram({ b: [0.618, 0.618], c: [0.382, 0.886], d: [0.786, 0.786] }, 'bearish').y.A).toBe(0)
  })
  it('Cypher: C melewati A', () => {
    const c = polaDiagram({ b: [0.382, 0.618], cx: [1.272, 1.414], dxc: [0.786, 0.786] })
    expect(c.y.C).toBeGreaterThan(c.y.A)
  })
  it('memetakan nilai ke tinggi SVG (nilai tinggi di atas)', () => {
    const s = skalaSvg([0, 10], 100, 100, 0)
    expect([s.fy(10), s.fy(0)]).toEqual([0, 100])
  })
})

describe('rencanaHarmonik & cekRasio', () => {
  const r = { pola: 'gartley', arah: 'bullish', status: 'prz', harga: 121, prz: [118, 124], stop: 100, target: [151, 170], rasio: { b: 0.624, c: 0.607 } }
  it('entry di tepi atas PRZ bullish, R:R dari stop', () => {
    expect(rencanaHarmonik(r)).toEqual({ entry: 124, stop: 100, t1: 151, t2: 170, rr1: 1.1, rr2: 1.9, risikoPct: 19.4 })
    expect(rencanaHarmonik({ ...r, status: 'berbalik', harga: 130 }).entry).toBe(130)
    expect(rencanaHarmonik({})).toBeNull()
  })
  it('mencentang rasio dalam kriteria (toleransi 5%)', () => {
    const pola = [{ k: 'gartley', b: [0.618, 0.618], c: [0.382, 0.886] }]
    expect(cekRasio(r, pola).map(x => x.ok)).toEqual([true, true])
    expect(cekRasio({ ...r, rasio: { b: 0.7, c: 0.5 } }, pola)[0].ok).toBe(false)
  })
})


import { detailHarmonik, kandidatTerdekat } from '../harmonik.js'

describe('detailHarmonik & kandidatTerdekat', () => {
  const meta = { k: 'gartley', nama: 'Gartley', b: [0.618, 0.618], c: [0.382, 0.886], d: [0.786, 0.786], bc: [1.13, 1.618] }
  const r = { arah: 'bullish', harga: 125, prz: [118, 124], stop: 100, target: [151, 170], targetCA: [175, 200],
    titik: [{ n: 'X', d: '2026-01-01', p: 100 }, { n: 'A', d: '2026-02-01', p: 200 }, { n: 'B', d: '2026-03-01', p: 138 }, { n: 'C', d: '2026-04-01', p: 175 }, { n: 'D', d: '2026-05-01', p: 121 }] }
  it('menjelaskan PRZ dalam harga dan jarak level dari harga kini', () => {
    const x = detailHarmonik(r, meta)
    expect(x.titik[0].peran).toMatch(/^Awal dorongan/)
    expect(x.prz[0]).toBe('D = 0,786 kaki XA dari A: 121')
    expect(x.prz[1]).toBe('Proyeksi CD 1,13–1,618 × BC dari C: 115–133')
    expect(x.level.find(l => l.k === 'Stop loss').jarak).toBe(-20)
    expect(detailHarmonik(null)).toBeNull()
  })
  it('mencari pola terdekat dari swing terakhir', () => {
    const pv = [{ d: 'a', p: 100 }, { d: 'b', p: 200 }, { d: 'c', p: 155 }, { d: 'd', p: 190 }, { d: 'e', p: 115 }]
    const k = kandidatTerdekat(pv, [meta, { k: 'bat', nama: 'Bat', b: [0.382, 0.5], c: [0.382, 0.886], d: [0.886, 0.886], bc: [1.618, 2.618] }])
    expect(k.nama).toBe('Bat')                         // B 0,45 XA cocok Bat
    expect(k.arah).toBe('bullish')
    expect(k.cek[0]).toEqual({ label: 'B / XA', nilai: 0.45, kriteria: [0.382, 0.5], ok: true })
    expect(kandidatTerdekat(pv.slice(0, 3), [meta])).toBeNull()
  })
})
