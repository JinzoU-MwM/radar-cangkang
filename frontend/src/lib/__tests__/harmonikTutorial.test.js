import { describe, expect, it } from 'vitest'
import { bangunManual, cekManual, cekSwing, tempel } from '../harmonikTutorial.js'

// Bar sintetis: harga bergerak lurus antar titik, 10 bar per kaki (indeks titik 0, 10, 20, ...).
function bangun(titik, per = 10, v = 1e5) {
  const harga = [titik[0]]
  for (let k = 1; k < titik.length; k++)
    for (let j = 1; j <= per; j++) harga.push(titik[k - 1] + (titik[k] - titik[k - 1]) * j / per)
  return harga.map((c, i) => {
    const o = i ? harga[i - 1] : c
    return { d: `2026-01-${String(1 + (i % 28)).padStart(2, '0')}`, o, h: Math.max(o, c), l: Math.min(o, c), c, v }
  })
}
// Klik pengguna di setiap ujung kaki (indeks 10 per kaki), lalu ditempel ke high/low.
function klik(bars, k, idx) {
  const t = []
  for (const i of idx) t.push(tempel(bars, k, t, i, bars[i].c))
  return t
}

// Gartley bullish: X 1000, A 2000, B 0,618 XA, C 0,786 AB (CD = AB), D 0,786 XA.
const G = [1000, 2000, 1382, 1868, 1214]

describe('tempel', () => {
  it('menempel ke high/low bergantian; Long memakai fraksi harga BEI', () => {
    const bars = bangun([1200, ...G])
    const t = klik(bars, 'xabcd', [10, 20, 30, 40, 50])
    expect(t.map(x => [x.n, x.sisi, x.p])).toEqual([['X', 'L', 1000], ['A', 'H', 2000], ['B', 'L', 1382], ['C', 'H', 1868], ['D', 'L', 1214]])
    expect(tempel(bars, 'xabcd', t, 55, 1300)).toBe(null)            // sudah lengkap
    expect(tempel(bars, 'long', [], 50, 1213).p).toBe(1215)           // fraksi Rp5
  })
})

describe('cek XABCD', () => {
  it('pola benar: masuk Gartley, AB=CD terpenuhi, ada rencana dan daftar periksa', () => {
    const bars = bangun([1200, ...G])
    const c = cekManual(bars, 'xabcd', klik(bars, 'xabcd', [10, 20, 30, 40, 50]))
    expect(c.pola).toBe('Gartley bullish')
    expect(c.kurang.filter(x => !/Tanda berbalik/.test(x))).toEqual([])
    expect(c.rencana.stop).toBe(1000)
    expect(c.rekomendasi.find(r => /AB=CD/.test(r.teks)).ok).toBe(true)
    expect(c.objek.garis.length).toBeGreaterThan(2)
  })
  it('X bukan lembah terendah: saran memindahkan X', () => {
    const bars = bangun([1200, ...G])
    const t = klik(bars, 'xabcd', [10, 20, 30, 40, 50])
    t[0] = { ...t[0], i: 12, p: bars[12].l }
    const s = cekSwing(bars, t)
    expect(s[0]).toMatch(/Titik X belum lembah terendah/)
    expect(s[0]).toMatch(/1\.000/)
  })
  it('B terlalu dalam: menyebut pola terdekat dan pola yang cocok untuk B itu', () => {
    // B 0,786 XA dengan D 0,786: bukan Gartley (B harus 0,618) dan bukan Butterfly (D harus melewati X).
    const bars = bangun([1200, 1000, 2000, 1214, 1800, 1214])
    const c = cekManual(bars, 'xabcd', klik(bars, 'xabcd', [10, 20, 30, 40, 50]))
    expect(c.pola).toBe(null)
    expect(c.kurang[0]).toMatch(/paling dekat/)
    expect(c.kurang.join(' ')).toMatch(/B 0,786 terlalu dalam/)
  })
})

describe('cek alat lain', () => {
  it('Fib dari X ke A dinilai benar; Long mengikuti target pola', () => {
    const bars = bangun([1200, ...G])
    const x = klik(bars, 'xabcd', [10, 20, 30, 40, 50])
    const pola = bangunManual(bars, 'xabcd', x)
    const f = cekManual(bars, 'fib', klik(bars, 'fib', [10, 20]), { xabcd: pola })
    expect(f.nilai).toBe('benar')
    const salahFib = cekManual(bars, 'fib', klik(bars, 'fib', [30, 40]), { xabcd: pola })
    expect(salahFib.kurang.join(' ')).toMatch(/tarik Fib dari X/)
    const long = []
    for (const p of [1215, 995, pola.target[0], pola.target[1]]) long.push(tempel(bars, 'long', long, 50, p))
    const l = cekManual(bars, 'long', long, { xabcd: pola })
    expect(l.benar.join(' ')).toMatch(/Entry dekat PRZ/)
    expect(l.benar.join(' ')).toMatch(/TP1 dan TP2 sesuai target pola/)
    const terbalik = []
    for (const p of [1215, 1300, 1100, 1000]) terbalik.push(tempel(bars, 'long', terbalik, 50, p))
    expect(cekManual(bars, 'long', terbalik, { xabcd: pola }).kurang[0]).toMatch(/Urutan harga Long/)
  })
  it('titik belum lengkap', () => {
    const bars = bangun([1200, ...G])
    expect(cekManual(bars, 'elliott', klik(bars, 'elliott', [10, 20])).kurang[0]).toMatch(/2 dari 6/)
  })
})
