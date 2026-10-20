import { describe, it, expect } from 'vitest'
import { indicators } from '../ta.js'
import { detectCandles, detectDivergences, fibLevels, volumeProfile, analyzePatterns, polaPlan, verdictOf, zigzag } from '../patterns.js'

const day = i => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)
const bar = (i, o, c, v = 1000, wick = 2) => ({ d: day(i), o, c, h: Math.max(o, c) + wick, l: Math.min(o, c) - wick, v })

describe('candlestick', () => {
  it('Bullish Engulfing setelah tren turun', () => {
    // 20 candle turun pelan, lalu satu candle merah kecil dan satu candle hijau yang menelannya.
    const B = Array.from({ length: 20 }, (_, i) => bar(i, 1000 - i * 10, 1000 - i * 10 - 6))
    B.push(bar(20, 805, 795), bar(21, 793, 812))
    const hit = detectCandles(B, indicators(B)).find(k => k.i === 21)
    expect(hit.key).toBe('bull_engulf')
    expect(hit.bias).toBe(1)
    expect(hit.trend).toBe('setelah turun')
    expect(hit.confirm).toMatch(/Menunggu/)
  })
})

describe('Fibonacci', () => {
  it('swing naik: retracement diukur turun dari puncak', () => {
    const V = [{ d: 'a', h: 110, l: 100 }, { d: 'b', h: 150, l: 140 }, { d: 'c', h: 200, l: 190 }]
    const f = fibLevels(V)
    expect(f.upSwing).toBe(true)
    expect(f.H).toBe(200); expect(f.L).toBe(100)
    const at = r => f.fib.find(x => x.r === r).p
    expect(at(0)).toBe(200); expect(at(0.5)).toBe(150); expect(at(1)).toBe(100)
    expect(at(0.618)).toBeCloseTo(138.2)
    expect(at(1.618)).toBeCloseTo(261.8)
    expect(f.gp[0]).toBeCloseTo(138.2); expect(f.gp[1]).toBe(150)
    expect(f.fib.find(x => x.r === 0.618).lbl).toBe('61,8%')
  })
  it('swing turun: retracement diukur naik dari dasar', () => {
    const f = fibLevels([{ d: 'a', h: 200, l: 190 }, { d: 'b', h: 110, l: 100 }])
    expect(f.upSwing).toBe(false)
    expect(f.fib.find(x => x.r === 0.382).p).toBeCloseTo(138.2)
  })
})

describe('volume profile', () => {
  it('jumlah volume semua bin = total volume, POC di harga paling ramai', () => {
    const V = [bar(0, 100, 110, 500), bar(1, 110, 120, 300), bar(2, 120, 120, 200, 0), bar(3, 104, 106, 5000)]
    const vp = volumeProfile(V, 24)
    expect(vp.vol.reduce((s, x) => s + x, 0)).toBeCloseTo(6000)
    expect(vp.pocP).toBeGreaterThan(100); expect(vp.pocP).toBeLessThan(110)
    expect(vp.val).toBeLessThanOrEqual(vp.pocP); expect(vp.vah).toBeGreaterThanOrEqual(vp.pocP)
  })
})

describe('divergensi', () => {
  it('bullish reguler RSI: lembah harga lebih rendah, RSI lebih tinggi', () => {
    // Turun tajam ke lembah 1, pulih, lalu turun pelan ke lembah 2 yang sedikit lebih rendah.
    const c = []
    for (let i = 0; i < 40; i++) c.push(1000)
    for (let i = 0; i < 12; i++) c.push(1000 - (i + 1) * 25)        // 700
    for (let i = 0; i < 12; i++) c.push(700 + (i + 1) * 15)         // 880
    for (let i = 0; i < 20; i++) c.push(880 - (i + 1) * 9.5)        // 690
    for (let i = 0; i < 10; i++) c.push(690 + (i + 1) * 12)
    const B = c.map((x, i) => bar(i, i ? c[i - 1] : x, x))
    const I = indicators(B)
    const atrAt = i => I.atr[i] || 20
    const divs = detectDivergences(B, I, zigzag(B, atrAt, 1.5, 0.03))
    const d = divs.find(x => x.ind === 'RSI' && x.name === 'Bullish reguler')
    expect(d).toBeTruthy()
    expect(d.b.p).toBeLessThan(d.a.p)
    expect(d.v2).toBeGreaterThan(d.v1)
    expect(d.conf).toBeGreaterThan(0)
  })
})

describe('pola chart', () => {
  it('Double Bottom terdeteksi dengan neckline, target, invalidasi', () => {
    const c = []
    const seg = (to, n) => { const from = c.length ? c.at(-1) : to; for (let i = 1; i <= n; i++) c.push(from + (to - from) * i / n) }
    c.push(1300); seg(1000, 20); seg(1200, 12); seg(1005, 12); seg(1180, 10); for (let i = 0; i < 6; i++) c.push(1180)
    const B = c.map((x, i) => bar(i, i ? c[i - 1] : x, x, 1000, 3))
    const A = analyzePatterns(B, indicators(B))
    const p = A.all.find(x => x.key === 'dbl_bottom')
    expect(p).toBeTruthy()
    expect(p.kind).toBe('bullish')
    expect(p.inv).toBeLessThan(p.trigNow)
    expect(p.target).toBeGreaterThan(p.trigNow)
    expect(p.segs[0].nm).toBe('Neckline')
    expect(p.conf).toBeGreaterThanOrEqual(5)
    expect(typeof p.trig).toBe('undefined')   // hanya data, tanpa fungsi
  })
})

describe('rencana berbasis pola', () => {
  const base = { s: { res: 1100, score: 0 }, c: 1000, atr: 30, frozen: false, entry: 1105 }
  it('menunggu breakout: entry di atas level breakout, stop di bawah invalidasi, Target 2 = target pola', () => {
    const pl = polaPlan(base, { name: 'Double Bottom', status: 'ready', trigNow: 1050, inv: 950, target: 1250, conf: 60 })
    expect(pl.entry).toBe(1055)   // 1050 + 1 fraksi (5)
    expect(pl.stop).toBe(945)
    expect(pl.tp2).toBe(1250)
    expect(pl.tp1).toBeLessThanOrEqual(1150)
    expect(pl.usePola).toBe(true)
  })
  it('vonis: tanpa entry tidak layak', () => {
    expect(verdictOf({ entry: null }, []).cls).toBe('bad')
    expect(verdictOf({ entry: 1 }, [{ ok: true }]).cls).toBe('good')
  })
})
