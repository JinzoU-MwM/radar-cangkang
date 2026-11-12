// Halaman Harmonic Pattern (gaya TradingView): gambar otomatis dari swing harga terakhir. Fungsi murni.
// Masukan bars [{d,o,h,l,c,v}] urut waktu; keluaran berisi indeks bar (i) dan harga (p) untuk digambar di chart.
//
// Rasio pola mengikuti Scott M. Carney, "Harmonic Trading Vol. 1" (Gartley, Bat, Butterfly, Crab, Deep Crab, AB=CD),
// artikel Astronacci "Belajar Harmonic Pattern" dan "Cara Menggunakan Harmonic Pattern untuk Menentukan Area Entry"
// (Cypher, PRZ, stop, target 0,382/0,618 AD), serta tabel ilustrasi pola (Alternate Bat, Shark) yang dilampirkan
// pengguna. Notasi: b = AB/XA, c = BC/AB, d = AD/XA, e = CD/BC (proyeksi BC), cx = XC/XA, dc = CD/XC.
import { ceilTick, ema, floorTick, tick } from './ta.js'

export const POLA = {
  gartley: { nama: 'Gartley', b: [0.618, 0.618], c: [0.382, 0.886], d: [0.786, 0.786], e: [1.13, 1.618],
    ket: 'Pola retracement klasik: B tepat 0,618 XA, D di 0,786 XA. D tidak boleh melewati X.' },
  bat: { nama: 'Bat', b: [0.382, 0.5], c: [0.382, 0.886], d: [0.886, 0.886], e: [1.618, 2.618],
    ket: 'Retracement dalam: B di bawah 0,618 XA (ideal 0,382–0,5), D di 0,886 XA. D tidak boleh melewati X.' },
  altbat: { nama: 'Alternate Bat', b: [0.382, 0.382], c: [0.382, 0.886], d: [1.13, 1.13], e: [2.0, 3.618],
    ket: 'Varian Bat: B dangkal 0,382 XA, D melewati X sampai 1,13 XA.' },
  butterfly: { nama: 'Butterfly', b: [0.786, 0.786], c: [0.382, 0.886], d: [1.27, 1.414], e: [1.618, 2.24],
    ket: 'Pola ekstensi: B tepat 0,786 XA, D melewati X di 1,27 XA. Muncul di area ekstrem.' },
  crab: { nama: 'Crab', b: [0.382, 0.618], c: [0.382, 0.886], d: [1.618, 1.618], e: [2.618, 3.618],
    ket: 'Proyeksi paling ekstrem: D di 1,618 XA. Pembalikan sering tajam, disiplin stop penting.' },
  deepcrab: { nama: 'Deep Crab', b: [0.886, 0.886], c: [0.382, 0.886], d: [1.618, 1.618], e: [2.24, 3.618],
    ket: 'Seperti Crab dengan B dalam di 0,886 XA; D tetap 1,618 XA.' },
  cypher: { nama: 'Cypher', b: [0.382, 0.618], cx: [1.272, 1.414], dc: [0.786, 0.786],
    ket: 'C melewati A (1,272–1,414 XA); D di 0,786 kaki XC. Muncul di pasar dengan swing kompleks.' },
  shark: { nama: 'Shark', b: [0.382, 0.886], c: [1.13, 1.618], dc: [0.886, 1.13], e: [1.618, 2.24],
    ket: 'C melewati A (1,13–1,618 AB); D kembali ke sekitar level X (0,886–1,13 XC).' },
}
// Pola yang D-nya melewati atau menyentuh X: stop memakai sisi luar PRZ, bukan X.
const STOP_PRZ = new Set(['altbat', 'butterfly', 'crab', 'deepcrab', 'shark'])
export const TOL = 0.05          // toleransi relatif batas rasio (±5%)
export const PRZ_LEBAR = 0.03    // PRZ minimal = ±3% kaki acuan di sekitar level D
export const MENUJU_MAKS = 0.25  // jarak harga terakhir ke tepi PRZ yang masih digambar sebagai pola "menuju"
// Ambang zigzag (pembalikan minimal) per timeframe, dari swing kecil ke besar.
export const SKALA = { D: [0.04, 0.06, 0.1, 0.15], W: [0.08, 0.12, 0.18, 0.25], M: [0.12, 0.18, 0.25, 0.35] }
export const TF = [{ k: 'D', nama: 'Harian', pendek: '1D' }, { k: 'W', nama: 'Mingguan', pendek: '1W' }, { k: 'M', nama: 'Bulanan', pendek: '1M' }]

export const FIB_RET = [0, 0.236, 0.382, 0.5, 0.618, 0.707, 0.786, 0.886, 1, 1.13, 1.27, 1.414, 1.618]
export const FIB_EXT = [0, 0.382, 0.618, 0.786, 1, 1.13, 1.27, 1.414, 1.618, 2, 2.24, 2.618]

// ------------------------------------------------------------------ timeframe ----
// Senin minggu itu (UTC) untuk tanggal YYYY-MM-DD.
function senin(d) {
  const t = new Date(d.slice(0, 10) + 'T00:00:00Z'), w = (t.getUTCDay() + 6) % 7
  t.setUTCDate(t.getUTCDate() - w)
  return t.toISOString().slice(0, 10)
}
// Gabung candle harian menjadi mingguan (W) atau bulanan (M); tanggal = hari bursa pertama periode.
export function kelompokBar(bars = [], tf = 'D') {
  if (tf === 'D') return bars.map(b => ({ ...b, d: String(b.d).slice(0, 10) }))
  const kunci = tf === 'W' ? b => senin(String(b.d)) : b => String(b.d).slice(0, 7)
  const out = []
  let k0 = null
  for (const b of bars) {
    const k = kunci(b)
    if (k !== k0) { out.push({ d: String(b.d).slice(0, 10), o: b.o, h: b.h, l: b.l, c: b.c, v: b.v || 0 }); k0 = k; continue }
    const x = out[out.length - 1]
    x.h = Math.max(x.h, b.h); x.l = Math.min(x.l, b.l); x.c = b.c; x.v += b.v || 0
  }
  return out
}

// ------------------------------------------------------------------- zigzag ----
// Pivot bergantian H/L: berganti bila harga berbalik >= th dari ekstrem terakhir. Pivot terakhir = ekstrem
// berjalan (tentatif), belum terkonfirmasi pembalikan. Sama dengan website/harmonik.py.
export function zigzag(bars = [], th = 0.06) {
  const n = bars.length
  if (n < 3) return []
  const out = []
  let mode = 0, hi = 0, lo = 0, ext = 0
  for (let i = 1; i < n; i++) {
    const h = bars[i].h, l = bars[i].l
    if (mode === 0) {
      if (h > bars[hi].h) hi = i
      if (l < bars[lo].l) lo = i
      if (bars[lo].l > 0 && bars[hi].h >= bars[lo].l * (1 + th)) {
        if (lo < hi) { out.push({ i: lo, p: bars[lo].l, k: 'L' }); mode = 1; ext = hi }
        else { out.push({ i: hi, p: bars[hi].h, k: 'H' }); mode = -1; ext = lo }
      }
    } else if (mode === 1) {
      if (h >= bars[ext].h) ext = i
      else if (l <= bars[ext].h * (1 - th)) { out.push({ i: ext, p: bars[ext].h, k: 'H' }); mode = -1; ext = i }
    } else {
      if (l <= bars[ext].l) ext = i
      else if (h >= bars[ext].l * (1 + th)) { out.push({ i: ext, p: bars[ext].l, k: 'L' }); mode = 1; ext = i }
    }
  }
  if (mode) out.push({ i: ext, p: mode === 1 ? bars[ext].h : bars[ext].l, k: mode === 1 ? 'H' : 'L', tentatif: true })
  return out
}

// ------------------------------------------------------------------- XABCD ----
const r3 = v => v == null || !isFinite(v) ? null : Math.round(v * 1000) / 1000
// Jarak relatif nilai ke rentang (0 bila di dalam).
const jarak = (v, [lo, hi]) => v < lo ? (lo - v) / lo : v > hi ? (v - hi) / hi : 0

export function rasioXabcd(X, A, B, C, D = null) {
  const xa = Math.abs(A - X), ab = Math.abs(B - A), bc = Math.abs(C - B), xc = Math.abs(C - X)
  return {
    b: r3(ab / xa), c: r3(bc / ab), cx: r3(xc / xa),
    d: D == null ? null : r3(Math.abs(A - D) / xa),
    e: D == null ? null : r3(Math.abs(D - C) / bc),
    dc: D == null ? null : r3(Math.abs(D - C) / xc),
  }
}

// Rentang harga D (PRZ) dari X, A, B, C untuk satu pola; null bila rasio XA/XC dan proyeksi BC tidak bertemu.
export function przPola(k, X, A, B, C, tol = TOL) {
  const p = POLA[k], xa = Math.abs(A - X), s = Math.sign(A - X)
  let rg, acuan
  if (p.d) { rg = [A - s * xa * p.d[0], A - s * xa * p.d[1]]; acuan = xa }
  else { rg = [C - (C - X) * p.dc[0], C - (C - X) * p.dc[1]]; acuan = Math.abs(C - X) }
  rg = [Math.min(...rg), Math.max(...rg)]
  if (rg[1] - rg[0] < 2 * PRZ_LEBAR * acuan) {
    const m = (rg[0] + rg[1]) / 2
    rg = [m - PRZ_LEBAR * acuan, m + PRZ_LEBAR * acuan]
  }
  if (p.e) {
    const pr = [C + (B - C) * p.e[0] * (1 - tol), C + (B - C) * p.e[1] * (1 + tol)].sort((a, b) => a - b)
    const lo = Math.max(rg[0], pr[0]), hi = Math.min(rg[1], pr[1])
    if (lo > hi) return null
    // Pertemuan sempit tetap diberi lebar minimal di sekitar titik temu.
    if (hi - lo < PRZ_LEBAR * acuan) {
      const m = (lo + hi) / 2
      return [Math.max(rg[0], m - PRZ_LEBAR * acuan / 2), Math.min(rg[1], m + PRZ_LEBAR * acuan / 2)]
    }
    return [lo, hi]
  }
  return rg
}

// Skor ketidakcocokan X-A-B-C (dan D bila ada) terhadap satu pola; null bila ada rasio di luar toleransi.
export function skorPola(k, r, tol = TOL) {
  const p = POLA[k], cek = []
  cek.push([r.b, p.b])
  if (p.cx) cek.push([r.cx, p.cx])
  else cek.push([r.c, p.c])
  if (r.d != null) {
    if (p.d) cek.push([r.d, p.d])
    if (p.dc) cek.push([r.dc, p.dc])
    if (p.e) cek.push([r.e, p.e])
  }
  let s = 0
  for (const [v, rg] of cek) {
    if (v == null) return null
    const j = jarak(v, rg)
    // Proyeksi BC lebih longgar (2x) karena D diukur dari ujung swing yang berbeda-beda.
    if (j > (rg === p.e ? tol * 2 : tol)) return null
    s += j
  }
  return Math.round(s * 1000) / 1000
}

// Bentuk dasar: C di antara A dan B (pola retracement C), kecuali Cypher/Shark yang C-nya melewati A.
function bentukOk(k, X, A, B, C) {
  const s = Math.sign(A - X)
  if (!s || Math.sign(B - A) !== -s || Math.sign(C - B) !== s) return false
  const lewatA = s > 0 ? C > A : C < A
  return k === 'cypher' || k === 'shark' ? lewatA : !lewatA
}

function targetStop(k, X, A, C, D, prz, bull) {
  const acuan = k === 'cypher' ? C : A
  // Target dibulatkan ke fraksi harga BEI ke arah konservatif (bullish ke bawah, bearish ke atas).
  const target = [0.382, 0.618].map(r => D + (acuan - D) * r).map(t => bull ? floorTick(t) : ceilTick(t))
  const stopMentah = STOP_PRZ.has(k) ? (bull ? prz[0] : prz[1]) : X
  return { target, stop: stopMentah }
}

// Semua pola XABCD aktif di ujung data (paling relevan dulu):
//  - "di PRZ": D sedang terbentuk (ekstrem berjalan) dan berada di PRZ;
//  - "berbalik": D terkonfirmasi di PRZ, harga sudah berbalik;
//  - "menuju": X-A-B-C terbentuk, harga bergerak ke PRZ (D diproyeksikan).
export function cariXabcd(bars = [], skala = SKALA.D, umurD = 30) {
  const n = bars.length
  if (n < 30) return []
  const akhir = bars[n - 1].c, hasil = new Map()
  for (const th of skala) {
    const pv = zigzag(bars, th)
    const jendela = []
    if (pv.length >= 5) jendela.push({ w: pv.slice(-5), mode: 'jalan' })
    // D terkonfirmasi: satu sampai dua swing sebelum ekstrem berjalan, selama D masih dalam umurD bar terakhir.
    for (let m = 1; m <= 2 && pv.length >= 5 + m; m++) {
      const w = pv.slice(-5 - m, -m)
      if (w[4].i >= n - umurD) jendela.push({ w, mode: 'tetap' })
    }
    for (const { w, mode } of jendela) {
      const [X, A, B, C, D] = w, bull = A.p > X.p
      for (const k of Object.keys(POLA)) {
        if (!bentukOk(k, X.p, A.p, B.p, C.p)) continue
        const prz = przPola(k, X.p, A.p, B.p, C.p)
        if (!prz) continue
        const r = rasioXabcd(X.p, A.p, B.p, C.p, D.p)
        const diPrz = D.p >= prz[0] && D.p <= prz[1]
        const lewat = bull ? D.p < prz[0] : D.p > prz[1]
        let status, skor, titikD
        if (diPrz && (skor = skorPola(k, r)) != null) {
          status = mode === 'jalan' ? 'prz' : 'berbalik'
          titikD = { n: 'D', i: D.i, p: D.p }
        } else if (mode === 'jalan' && !lewat && !diPrz) {
          // Kaki C→D belum sampai PRZ: cocokkan X-A-B-C saja, D = pusat PRZ (proyeksi).
          skor = skorPola(k, { ...r, d: null, e: null, dc: null })
          if (skor == null) continue
          const tepi = bull ? prz[1] : prz[0]
          if ((bull ? akhir < tepi : akhir > tepi) || Math.abs(akhir / tepi - 1) > MENUJU_MAKS) continue
          status = 'menuju'
          titikD = { n: 'D', i: Math.max(n - 1, C.i) + Math.max(3, Math.round((C.i - B.i) * 0.8)), p: (prz[0] + prz[1]) / 2, proyeksi: true }
        } else continue
        if ((k === 'gartley' || k === 'bat') && (bull ? titikD.p < X.p : titikD.p > X.p)) continue
        const { target, stop } = targetStop(k, X.p, A.p, C.p, titikD.p, prz, bull)
        // Pola batal: setelah D ada penutupan yang menembus stop (X / sisi luar PRZ); bukan pola aktif lagi.
        if (!titikD.proyeksi && bars.slice(D.i + 1).some(b => bull ? b.c < stop : b.c > stop)) continue
        // Kunci tanpa X/A: skala zigzag berbeda bisa memilih bar berbeda untuk harga ekstrem yang sama (harga kembar),
        // padahal B, C, D-nya sama; pola itu cukup tampil sekali.
        const kunci = `${k}|${bull ? 'b' : 's'}|${B.i}|${C.i}|${titikD.proyeksi ? 'p' : D.i}`
        const row = {
          kunci, pola: k, nama: POLA[k].nama, ket: POLA[k].ket, arah: bull ? 'bullish' : 'bearish', status, skala: th, skor,
          titik: [{ n: 'X', i: X.i, p: X.p }, { n: 'A', i: A.i, p: A.p }, { n: 'B', i: B.i, p: B.p }, { n: 'C', i: C.i, p: C.p }, titikD],
          rasio: status === 'menuju' ? rasioXabcd(X.p, A.p, B.p, C.p) : r, prz, target, stop, harga: akhir,
          kaki: k === 'cypher' ? 'CD' : 'AD',   // kaki acuan target 0,382/0,618
        }
        const lama = hasil.get(kunci)
        if (!lama || row.skor < lama.skor) hasil.set(kunci, row)
      }
    }
  }
  const urut = { prz: 0, berbalik: 1, menuju: 2 }
  return [...hasil.values()].sort((a, b) => urut[a.status] - urut[b.status] || a.skor - b.skor || b.titik[0].i - a.titik[0].i)
}

// Swing X-A-B-C-D terakhir apa adanya (dengan rasio sebenarnya) saat tidak ada pola yang cocok. Dengan daftar skala:
// skala terbesar yang masih punya lima swing, supaya gambarnya terbaca (bukan gerak kecil di ujung chart).
export function swingXabcd(bars = [], th = 0.06) {
  const daftar = Array.isArray(th) ? [...th].sort((a, b) => b - a) : [th]
  th = daftar.find(t => zigzag(bars, t).length >= 5) ?? daftar[daftar.length - 1]
  const pv = zigzag(bars, th)
  if (pv.length < 5) return null
  const w = pv.slice(-5), [X, A, B, C, D] = w
  return { pola: null, nama: 'Swing terakhir', arah: A.p > X.p ? 'bullish' : 'bearish', status: 'tidak cocok', skala: th,
    titik: w.map((x, j) => ({ n: 'XABCD'[j], i: x.i, p: x.p })), rasio: rasioXabcd(X.p, A.p, B.p, C.p, D.p), prz: null }
}

// ---------------------------------------------------------------- Fibonacci ----
// Leg terakhir yang sudah selesai pada skala sedang (pivot sebelum ekstrem berjalan).
function legTerakhir(bars, th, jumlah) {
  const pv = zigzag(bars, th)
  const tetap = pv.filter(x => !x.tentatif)
  return tetap.length >= jumlah ? tetap.slice(-jumlah) : null
}

// Fib retracement: 1 = titik awal, 0 = titik akhir leg. Dengan pola harmonik: leg X→A (tempat B dan D diukur).
export function fibRetracement(bars = [], pola = null, th = 0.1) {
  let a, b, dasar
  if (pola?.titik?.length >= 2 && pola.pola) {
    a = pola.titik[0]; b = pola.titik[1]; dasar = `kaki XA pola ${pola.nama}`
  } else {
    const leg = legTerakhir(bars, th, 2) || legTerakhir(bars, th / 2, 2)
    if (!leg) return null
    ;[a, b] = leg; dasar = 'swing terakhir yang sudah selesai'
  }
  const level = FIB_RET.map(r => ({ r, p: b.p - (b.p - a.p) * r }))
  const akhir = bars[bars.length - 1]?.c
  return { a: { i: a.i, p: a.p }, b: { i: b.i, p: b.p }, level, dasar, naik: b.p > a.p,
    posisi: akhir == null ? null : r3((b.p - akhir) / (b.p - a.p)) }
}

// Trend-based fib extension: leg pertama (titik 1→2) diproyeksikan dari titik 3. Dengan pola: A→B diproyeksikan
// dari C (AB=CD), sehingga level 1 = CD sama panjang dengan AB.
export function fibExtension(bars = [], pola = null, th = 0.1) {
  let p1, p2, p3, dasar
  if (pola?.titik?.length >= 4 && pola.pola && pola.pola !== 'cypher' && pola.pola !== 'shark') {
    ;[, p1, p2, p3] = pola.titik; dasar = `A→B diproyeksikan dari C (AB=CD) pola ${pola.nama}`
  } else {
    const leg = legTerakhir(bars, th, 3) || legTerakhir(bars, th / 2, 3)
    if (!leg) return null
    ;[p1, p2, p3] = leg
    dasar = pola?.pola ? `tiga swing terakhir yang sudah selesai (pola ${pola.nama} tidak memakai AB=CD)` : 'tiga swing terakhir yang sudah selesai'
  }
  const k = p2.p - p1.p
  const level = FIB_EXT.map(r => ({ r, p: p3.p + k * r }))
  return { titik: [p1, p2, p3].map((x, j) => ({ n: String(j + 1), i: x.i, p: x.p })), level, dasar, naik: k > 0 }
}

// ------------------------------------------------------------ Elliott wave ----
// Aturan baku impuls: gelombang 2 tidak melewati awal gelombang 1, gelombang 3 bukan yang terpendek, dan
// gelombang 4 tidak masuk wilayah gelombang 1. Rasio panduan (bukan aturan) ikut dihitung.
export function aturanElliott(w) {
  const s = Math.sign(w[1].p - w[0].p), L = (a, b) => Math.abs(w[b].p - w[a].p)
  const w1 = L(0, 1), w3 = L(2, 3), w5 = w.length > 5 ? L(4, 5) : null
  const aturan = [
    { teks: 'Gelombang 2 tidak melewati awal gelombang 1', ok: s * (w[2].p - w[0].p) > 0 },
    { teks: 'Gelombang 3 melewati puncak gelombang 1', ok: s * (w[3].p - w[1].p) > 0 },
    { teks: 'Gelombang 3 bukan yang terpendek', ok: w5 == null ? w3 >= w1 * 0.618 : !(w3 < w1 && w3 < w5) },
  ]
  if (w.length > 4) aturan.push({ teks: 'Gelombang 4 tidak masuk wilayah gelombang 1', ok: s * (w[4].p - w[1].p) > 0 })
  const panduan = [{ k: 'W2/W1', v: r3(L(1, 2) / w1), ideal: '0,5–0,618' }, { k: 'W3/W1', v: r3(w3 / w1), ideal: '1,618' }]
  if (w.length > 4) panduan.push({ k: 'W4/W3', v: r3(L(3, 4) / w3), ideal: '0,382' })
  if (w5 != null) panduan.push({ k: 'W5/W1', v: r3(w5 / w1), ideal: '0,618–1' })
  return { aturan, panduan, valid: aturan.every(a => a.ok), naik: s > 0 }
}

// Target gelombang 5 dari ujung gelombang 4: sama panjang dengan W1, atau 0,618 x jarak 0->3.
function proyeksiW5(w, naik) {
  const s = naik ? 1 : -1, w1 = Math.abs(w[1].p - w[0].p), r03 = Math.abs(w[3].p - w[0].p)
  return [{ k: 'W5 = W1', p: w[4].p + s * w1 }, { k: 'W5 = 0,618 × (0→3)', p: w[4].p + s * 0.618 * r03 }]
}

// Impuls 0-1-2-3-4-5 terbaru yang lolos aturan; bila belum ada, impuls 0-4 yang sedang membentuk gelombang 5
// beserta proyeksinya (W5 = W1 dan W5 = 0,618 × jarak 0→3).
export function cariElliott(bars = [], skala = SKALA.D, mundur = 6) {
  const n = bars.length
  let best = null
  for (const th of skala) {
    const pv = zigzag(bars, th)
    for (let akhir = pv.length; akhir >= Math.max(6, pv.length - mundur); akhir--) {
      const w = pv.slice(akhir - 6, akhir)
      if (w.length < 6) break
      const a = aturanElliott(w)
      if (!a.valid) continue
      const kand = { status: w[5].tentatif ? 'gelombang 5 berjalan' : 'lengkap', skala: th, ...a,
        titik: w.map((x, j) => ({ n: String(j), i: x.i, p: x.p })) }
      if (w[5].tentatif) kand.proyeksi = proyeksiW5(w, a.naik)
      if (!best || w[5].i > best.titik[5].i || (w[5].i === best.titik[5].i && th > best.skala)) best = kand
      break
    }
  }
  // Impuls berumur (selesai jauh sebelum akhir data) kalah dari impuls 0-4 yang masih berjalan.
  if (best && best.titik[5].i >= n - Math.max(20, n * 0.15)) return best
  let jalan = null
  for (const th of skala) {
    const pv = zigzag(bars, th)
    if (pv.length < 5) continue
    const w = pv.slice(-5)
    if (!w[4].tentatif && pv.length > 5) continue
    const a = aturanElliott(w)
    if (!a.valid) continue
    const proyeksi = proyeksiW5(w, a.naik)
    const kand = { status: 'menuju gelombang 5', skala: th, ...a, proyeksi,
      titik: w.map((x, j) => ({ n: String(j), i: x.i, p: x.p })) }
    if (!jalan || w[4].i > jalan.titik[4].i) jalan = kand
  }
  return jalan || best
}

// ------------------------------------------------------- Long / Short position ----
const bulat = (p, atas) => atas ? ceilTick(p) : floorTick(p)
export const STOP_MAKS = 0.25   // stop swing lebih jauh dari 25% harga dianggap tidak realistis
const fmt1 = v => Number(v).toLocaleString('id-ID', { maximumFractionDigits: 1 })
const pct = (a, b) => Math.round((b / a - 1) * 1000) / 10

// Rencana posisi dari pola harmonik searah (Long: bullish, Short: bearish): entry di D (atau tepi PRZ bila D masih
// proyeksi), stop di balik X / sisi luar PRZ, target 0,382 dan 0,618 kaki AD. Tanpa pola searah: swing terakhir
// (stop di balik swing low/high, target swing berlawanan terdekat lalu 2R).
export function rencanaPosisi(bars = [], arah = 'long', polaList = [], th = 0.06) {
  const n = bars.length
  if (!n) return null
  const long = arah === 'long', akhir = bars[n - 1].c
  const pola = polaList.find(r => r.arah === (long ? 'bullish' : 'bearish'))
  let entry, stop, target, i0, dasar, polaRef = null
  if (pola) {
    const D = pola.titik[4]
    entry = D.proyeksi ? (long ? pola.prz[1] : pola.prz[0]) : D.p
    stop = pola.stop
    target = pola.target
    i0 = D.proyeksi ? n - 1 : D.i
    dasar = `pola ${pola.nama} ${pola.arah}`
    polaRef = pola
  } else {
    const pv = zigzag(bars, th).filter(x => !x.tentatif)
    const sisiStop = pv.filter(x => x.k === (long ? 'L' : 'H') && (long ? x.p < akhir : x.p > akhir))
    if (!sisiStop.length) return { arah, kosong: true, dasar: 'swing terakhir', catatan: long ? 'Belum ada swing low di bawah harga terakhir.' : 'Belum ada swing high di atas harga terakhir.' }
    entry = akhir
    stop = sisiStop[sisiStop.length - 1].p
    const r = Math.abs(entry - stop)
    // Stop swing terlalu jauh: rencana tidak realistis (target bisa di bawah nol untuk short).
    if (r / entry > STOP_MAKS) return { arah, kosong: true, dasar: 'swing terakhir', catatan: `Belum ada pola harmonik ${long ? 'bullish' : 'bearish'}, dan swing ${long ? 'low' : 'high'} terdekat ${fmt1(r / entry * 100)}% dari harga terakhir: terlalu jauh untuk stop loss. Tunggu pola atau swing baru.` }
    // TP1 = swing berlawanan terdekat yang minimal 1R dari entry (swing yang terlalu dekat tidak sebanding stop).
    const lawan = pv.filter(x => x.k === (long ? 'H' : 'L') && Math.abs(x.p - entry) >= r && (long ? x.p > entry : x.p < entry)).map(x => x.p)
    const t1 = lawan.length ? (long ? Math.min(...lawan) : Math.max(...lawan)) : entry + (long ? 1 : -1) * r * 1.5
    target = [t1, entry + (long ? 1 : -1) * Math.max(2 * r, Math.abs(t1 - entry) * 1.5)].map(t => Math.max(t, tick(entry)))
    i0 = n - 1
    dasar = 'swing terakhir (belum ada pola harmonik ' + (long ? 'bullish' : 'bearish') + ')'
  }
  // Pembulatan ke fraksi harga BEI; stop digeser satu fraksi di balik level.
  entry = bulat(entry, !long)
  // Satu fraksi di balik level, memakai fraksi pada harga hasil (aman di batas pita fraksi BEI).
  if (long) stop = floorTick(floorTick(stop) - 1e-9)
  else { const c = ceilTick(stop); stop = c + tick(c) }
  target = target.map(t => bulat(t, !long))
  const risiko = Math.abs(entry - stop)
  return {
    arah, dasar, pola: polaRef, entry, stop, target, i0, harga: akhir,
    stopPct: pct(entry, stop), targetPct: target.map(t => pct(entry, t)),
    rr: target.map(t => risiko ? Math.round(Math.abs(t - entry) / risiko * 100) / 100 : null),
    aktif: polaRef ? (polaRef.titik[4].proyeksi ? 'menunggu harga masuk PRZ' : polaRef.status === 'prz' ? 'harga di PRZ' : 'sudah berbalik dari D') : 'harga terakhir',
  }
}

// ------------------------------------------------- diagram ideal & alasan ----
// Ciri pembeda tiap pola (Carney: lihat titik B dulu, lalu titik D).
export const PEMBEDA = {
  gartley: 'B tepat 0,618 XA dan D di 0,786 XA, tidak melewati X.',
  bat: 'B di bawah 0,618 XA (0,382–0,5) dan D dalam di 0,886 XA.',
  altbat: 'B dangkal 0,382 XA, tetapi D melewati X sampai 1,13 XA.',
  butterfly: 'B tepat 0,786 XA dan D melewati X di 1,27–1,414 XA.',
  crab: 'B 0,618 XA atau kurang, D jauh melewati X di 1,618 XA.',
  deepcrab: 'B dalam di 0,886 XA, D di 1,618 XA.',
  cypher: 'C melewati A (1,272–1,414 XA), D di 0,786 kaki XC.',
  shark: 'C melewati A (1,13–1,618 AB), D kembali ke sekitar level X (0,886–1,13 XC).',
}
const tgh = r => r ? (r[0] + r[1]) / 2 : null
const teksRg = r => r[0] === r[1] ? String(r[0]).replace('.', ',') : `${String(r[0]).replace('.', ',')}–${String(r[1]).replace('.', ',')}`

// Bentuk ideal pola (nilai tengah tiap rentang rasio) dalam kotak 0..1: titik X-A-B-C-D (x, y; y 0 = atas) dan garis
// rasio putus-putus berlabel rentang baku, seperti tabel ilustrasi pola.
export function diagramIdeal(k, arah = 'bullish') {
  const p = POLA[k]
  if (!p) return null
  const v = { X: 0, A: 1 }
  v.B = 1 - tgh(p.b)
  if (p.cx) v.C = tgh(p.cx)
  else v.C = v.B + tgh(p.c) * (1 - v.B)
  v.D = p.d ? 1 - tgh(p.d) : v.C - tgh(p.dc) * (v.C - v.X)
  const nilai = Object.values(v), lo = Math.min(...nilai), hi = Math.max(...nilai)
  const bull = arah === 'bullish'
  const titik = ['X', 'A', 'B', 'C', 'D'].map((n, j) => {
    const t = (v[n] - lo) / (hi - lo)
    return { n, x: j / 4, y: bull ? 1 - t : t }
  })
  const [X, A, B, C, D] = titik
  const garis = [{ a: X, b: B, teks: teksRg(p.b) }]
  if (p.cx) garis.push({ a: X, b: C, teks: teksRg(p.cx) })
  else garis.push({ a: A, b: C, teks: teksRg(p.c) })
  if (p.e) garis.push({ a: B, b: D, teks: teksRg(p.e) })
  garis.push({ a: p.d ? X : C, b: D, teks: teksRg(p.d || p.dc) })
  return { titik, garis, bull }
}

// Alasan pola terdeteksi: tiap rasio aktual dibanding rentang baku pola (dengan toleransi TOL).
export function alasanPola(row, tol = TOL) {
  const p = row && POLA[row.pola]
  if (!p) return []
  const r = row.rasio || {}, out = []
  const tambah = (teks, v, rg, longgar = 1) => {
    if (v == null || !rg) return
    out.push({ teks, aktual: v, ideal: teksRg(rg), ok: jarak(v, rg) <= tol * longgar })
  }
  tambah('Titik B: retracement AB/XA', r.b, p.b)
  if (p.cx) tambah('Titik C: XC/XA (melewati A)', r.cx, p.cx)
  else tambah(p.c[0] > 1 ? 'Titik C: BC/AB (melewati A)' : 'Titik C: retracement BC/AB', r.c, p.c)
  if (r.d != null) {
    if (p.d) tambah('Titik D: AD/XA', r.d, p.d)
    if (p.dc) tambah('Titik D: CD/XC', r.dc, p.dc)
    if (p.e) tambah('Proyeksi CD/BC', r.e, p.e, 2)
  }
  return out
}

// Penjelasan kenapa titik X berada di situ: X = swing awal pola (lembah untuk bullish, puncak untuk bearish) yang
// ditemukan zigzag, dan kaki XA menjadi "penggaris" semua rasio. Mengembalikan kalimat untuk panel/inset.
export function alasanX(row, bars = []) {
  const t = row?.titik
  if (!t || t.length < 2) return []
  const [x, a] = t, bull = a.p > x.p, tgl = i => String(bars[i]?.d || '').slice(0, 10)
  const fh = p => Number(p).toLocaleString('id-ID', { maximumFractionDigits: p < 200 ? 1 : 0 })
  const naik = Math.abs(a.p / x.p - 1) * 100
  const out = [
    `X = ${bull ? 'swing low' : 'swing high'} ${fh(x.p)} (${tgl(x.i)}): ${bull ? 'titik terendah' : 'titik tertinggi'} sebelum harga ${bull ? 'naik' : 'turun'} ${naik.toLocaleString('id-ID', { maximumFractionDigits: 1 })}% ke A ${fh(a.p)} (${tgl(a.i)}). Di antara X dan A tidak ada harga yang ${bull ? 'lebih rendah dari X' : 'lebih tinggi dari X'}.`,
    `Swing dicari otomatis dengan zigzag: titik baru diakui bila harga berbalik minimal ${Math.round((row.skala || 0) * 100)}% dari ekstrem sebelumnya, sehingga gerak kecil diabaikan.`,
  ]
  if (row.pola) {
    out.push(`X dipakai karena dari kaki XA inilah B, C, dan D cocok dengan rasio ${row.nama}. Swing lain sebelum atau sesudahnya tidak menghasilkan rasio yang cocok.`)
    out.push(STOP_PRZ.has(row.pola)
      ? `Pada ${row.nama}, D boleh melewati X; batas batal pola adalah sisi luar PRZ.`
      : `X juga batas batal: bila harga menembus ${fh(x.p)}, pola ${row.nama} gugur.`)
  } else {
    out.push('Rasio dari kaki XA ini belum cocok dengan pola baku, jadi X di sini hanya awal lima swing terakhir, bukan awal pola.')
  }
  return out
}

// ------------------------------------------------------- konfirmasi di D ----
// RSI Wilder per bar (null sebelum cukup data). Sama dengan website/harmonik.py.
export function rsi(closes = [], n = 14) {
  const out = Array(closes.length).fill(null)
  if (closes.length <= n) return out
  let g = 0, l = 0
  for (let i = 1; i <= n; i++) { const d = closes[i] - closes[i - 1]; g += Math.max(d, 0); l += Math.max(-d, 0) }
  g /= n; l /= n
  for (let i = n; i < closes.length; i++) {
    if (i > n) { const d = closes[i] - closes[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n }
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l)
  }
  return out
}

// Candle pembalikan di bar i searah pembalikan: pin bar, engulfing, atau outside bar ('' bila tidak ada).
export function candleBalik(bars, i, bull) {
  if (i < 1 || i >= bars.length) return ''
  const b = bars[i], a = bars[i - 1], rng = b.h - b.l, badan = Math.abs(b.c - b.o)
  if (rng <= 0) return ''
  const bawah = Math.min(b.o, b.c) - b.l, atas = b.h - Math.max(b.o, b.c), ekor = bull ? bawah : atas
  if (ekor >= 2 * Math.max(badan, rng * 0.05) && ekor >= 0.6 * rng) return 'pin bar'
  if (bull && a.c < a.o && b.c > b.o && b.c >= a.o && b.o <= a.c) return 'bullish engulfing'
  if (!bull && a.c > a.o && b.c < b.o && b.c <= a.o && b.o >= a.c) return 'bearish engulfing'
  if (b.h > a.h && b.l < a.l && (bull ? b.c > b.o : b.c < b.o)) return 'outside bar'
  return ''
}

// Empat konfirmasi pembalikan di titik D (Astronacci: candle pembalikan, divergence RSI, tembus struktur minor;
// ditambah volume di D sesuai materi). Pola "menuju" (D belum terbentuk) tidak punya konfirmasi.
export function konfirmasiD(bars = [], row = null) {
  const t = row?.titik
  if (!row?.pola || !t || t.length < 5 || t[4].proyeksi) return null
  const bull = row.arah === 'bullish', B = t[2], D = t[4], n = bars.length
  const cek = []
  let candle = null
  for (let i = D.i; i < n; i++) { const c = candleBalik(bars, i, bull); if (c) { candle = { i, nama: c }; break } }
  cek.push({ k: 'candle', teks: candle ? `Candle pembalikan: ${candle.nama} (${String(bars[candle.i].d).slice(0, 10)})` : 'Candle pembalikan sejak D: belum ada', ok: !!candle, i: candle?.i ?? null, nama: candle?.nama })
  const rs = rsi(bars.map(b => b.c)), rb = rs[B.i], rd = rs[D.i]
  const div = rb != null && rd != null && (bull ? D.p < B.p && rd > rb : D.p > B.p && rd < rb)
  cek.push({ k: 'rsi', ok: div, teks: rb == null || rd == null ? 'Divergence RSI: data belum cukup'
    : `Divergence RSI: ${div ? 'ada' : 'tidak ada'} (RSI B ${Math.round(rb)}, RSI D ${Math.round(rd)})` })
  const awal = bars.slice(Math.max(0, D.i - 3), D.i)
  let tembus = false
  if (awal.length && D.i < n - 1) {
    const batas = bull ? Math.max(...awal.map(x => x.h)) : Math.min(...awal.map(x => x.l))
    tembus = bull ? bars[n - 1].c > batas : bars[n - 1].c < batas
  }
  cek.push({ k: 'struktur', ok: tembus, teks: `Struktur minor (puncak/lembah 3 bar sebelum D) ${tembus ? 'sudah' : 'belum'} ditembus harga terakhir` })
  const sebelum = bars.slice(Math.max(0, D.i - 20), D.i).map(b => b.v)
  const rataV = sebelum.length ? sebelum.reduce((a, v) => a + v, 0) / sebelum.length : 0
  const vMaks = Math.max(...bars.slice(D.i, Math.min(n, D.i + 3)).map(b => b.v))
  const kali = rataV ? vMaks / rataV : null
  cek.push({ k: 'volume', ok: kali != null && kali >= 1.5, teks: kali == null ? 'Volume di D: data belum cukup' : `Volume di D: ${kali.toLocaleString('id-ID', { maximumFractionDigits: 1 })}x rata-rata 20 bar` })
  const jumlah = cek.filter(c => c.ok).length
  return { cek, jumlah, total: cek.length, candle, label: jumlah >= 3 ? 'kuat' : jumlah === 2 ? 'sedang' : 'lemah' }
}

// -------------------------------------------------- panah skenario dari D ----
// Jalur yang mungkin setelah D (seperti panah skenario di materi): ke target 1 (0,382 AD), target 2 (0,618 AD),
// titik C sebagai target lanjutan (Maxco) bila lebih jauh dari target 2, dan jalur gagal bila harga menembus stop.
// Jarak waktu panah hanya ilustrasi (kelipatan durasi kaki CD), bukan proyeksi waktu.
export function skenarioD(row) {
  const t = row?.titik
  if (!row?.pola || !t || t.length < 5 || !row.target) return []
  const C = t[3], D = t[4], bull = row.arah === 'bullish', s = bull ? 1 : -1
  const lebar = Math.max(5, D.i - C.i), ke = k => D.i + Math.round(lebar * k)
  const fh = p => Number(p).toLocaleString('id-ID', { maximumFractionDigits: p < 200 ? 1 : 0 })
  const out = [
    // Bullish: target naik (untuk beli/Long). Bearish: target turun (untuk jual, ambil untung, atau Short).
    { k: 't1', jenis: 'target', label: `Target ${bull ? 'naik' : 'turun'} 1 (0,382 ${row.kaki || 'AD'}) ${fh(row.target[0])}`, dari: D, ke: { i: ke(0.6), p: row.target[0] } },
    { k: 't2', jenis: 'target', label: `Target ${bull ? 'naik' : 'turun'} 2 (0,618 ${row.kaki || 'AD'}) ${fh(row.target[1])}`, dari: D, ke: { i: ke(1), p: row.target[1] } },
  ]
  if (s * (C.p - row.target[1]) > 0) out.push({ k: 'c', jenis: 'target', label: `Target ${bull ? 'naik' : 'turun'} lanjutan: titik C ${fh(C.p)}`, dari: D, ke: { i: ke(1.4), p: C.p } })
  // Jalur gagal: panah sedikit melewati level stop; level stop sendiri digambar sebagai garis batas berlabel.
  const lewat = Math.max(Math.abs(D.p - row.stop) * 0.35, D.p * 0.01)
  out.push({ k: 'gagal', jenis: 'gagal', label: `Batal bila close menembus ${fh(row.stop)}`, dari: D, ke: { i: ke(0.6), p: row.stop - s * lewat }, stop: row.stop })
  return out
}

// ------------------------------------------------------ tren besar EMA ----
// Posisi harga terhadap EMA50 dan EMA200 sebagai penyaring: pola harmonik mencari pembalikan, jadi tren tidak
// membatalkan pola, tetapi pola yang searah tren besar (bullish di atas EMA200, bearish di bawahnya) lebih layak;
// yang melawan tren besar lebih sering hanya memberi reaksi singkat. EMA200 butuh minimal 200 bar.
export function trenBesar(bars = []) {
  const cl = bars.map(b => b.c), n = cl.length
  if (n < 50) return null
  const e50 = ema(cl, 50)[n - 1], e200 = n >= 200 ? ema(cl, 200)[n - 1] : null, c = cl[n - 1]
  const acuan = e200 ?? e50
  const arah = c > acuan ? 'naik' : 'turun'
  const kuat = e200 != null && (arah === 'naik' ? c > e50 && e50 > e200 : c < e50 && e50 < e200)
  return { e50, e200, harga: c, arah, kuat, acuanNama: e200 != null ? 'EMA200' : 'EMA50' }
}

// Kalimat penilaian pola terhadap tren besar.
export function nilaiTren(tren, arahPola) {
  if (!tren || !arahPola) return null
  const fh = p => Number(p).toLocaleString('id-ID', { maximumFractionDigits: p < 200 ? 1 : 0 })
  const searah = (arahPola === 'bullish') === (tren.arah === 'naik')
  const posisi = `Harga ${fh(tren.harga)} ${tren.arah === 'naik' ? 'di atas' : 'di bawah'} ${tren.acuanNama} ${fh(tren.e200 ?? tren.e50)}`
    + (tren.e200 != null ? ` (EMA50 ${fh(tren.e50)})` : ' (EMA200 belum bisa dihitung: data kurang dari 200 bar)')
  const teks = searah
    ? `${posisi}: pola ${arahPola} searah tren besar${tren.kuat ? ' yang kuat' : ''}, peluangnya lebih baik.`
    : `${posisi}: pola ${arahPola} melawan tren besar. Lebih sering hanya memberi reaksi singkat; kecilkan posisi atau tunggu konfirmasi lebih kuat.`
  return { searah, teks }
}

// Keterangan bila impuls Elliott terakhir sudah lama selesai (garisnya jauh dari swing terakhir/XABCD): kapan selesai,
// berapa bar lalu, dan kenapa swing sesudahnya tidak digambar. null bila impuls masih berjalan atau baru selesai.
export function jarakElliott(e, bars = [], satuan = 'bar') {
  if (!e?.titik?.length || /berjalan|menuju/.test(e.status)) return null
  const akhir = e.titik[e.titik.length - 1], umur = bars.length - 1 - akhir.i
  if (umur < 5) return null
  const iso = String(bars[akhir.i]?.d || '').slice(0, 10), [y, m, d] = iso.split('-')
  const tgl = y && m ? `${Number(d)} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][Number(m) - 1]} ${y}` : iso
  return { tgl, umur, i: akhir.i, teks: `Impuls ${e.naik ? 'naik' : 'turun'} ini selesai ${tgl} di gelombang 5 (${umur} ${satuan} lalu). `
    + 'Swing sesudahnya belum membentuk impuls lima gelombang baru yang memenuhi aturan, jadi tidak digambar. Menurut Elliott, '
    + 'setelah impuls selesai biasanya terjadi koreksi tiga gelombang (A-B-C), dan fase itulah yang berjalan sejak gelombang 5. '
    + 'Karena itu garis Elliott bisa jauh dari XABCD, yang selalu memakai lima swing terakhir.' }
}

// ------------------------------------------------------------ lab pola ----
// Lab interaktif (tab Materi): dari rasio pilihan pengguna AB/XA (b), BC/AB (c), dan AD/XA (d) dibentuk titik
// X-A-B-C-D bullish (X 0, A 1), lalu dicari pola yang cocok dengan aturan dan toleransi yang sama dengan pendeteksi.
export function labPola(b, c, d) {
  const X = 0, A = 1, B = A - b, C = B + c * (A - B), D = A - d
  const r = rasioXabcd(X, A, B, C, D)
  const cocok = Object.keys(POLA)
    .filter(k => bentukOk(k, X, A, B, C))
    .map(k => ({ k, nama: POLA[k].nama, skor: skorPola(k, r) }))
    .filter(x => x.skor != null)
    .sort((x, y) => x.skor - y.skor)
  return { titik: { X, A, B, C, D }, rasio: r, cocok }
}

// Contoh rasio ideal tiap pola untuk tombol "pasang" di lab (nilai tengah rentang; Cypher/Shark dari kaki XC).
export function rasioContoh(k) {
  const p = POLA[k], t = rg => (rg[0] + rg[1]) / 2
  if (!p) return null
  const b = t(p.b)
  if (p.cx) {   // C = cx x XA di atas X; D = C - dc x XC
    const C = t(p.cx), B = 1 - b, c = (C - B) / (1 - B), D = C - t(p.dc) * C
    return { b, c, d: 1 - D }
  }
  if (p.dc) {   // Shark: D di dc x XC dari C; c dan b dipilih supaya CD/BC di tengah rentangnya
    const dc = t(p.dc), e = t(p.e)
    for (let i = 0; i <= 40; i++) {
      const bb = p.b[0] + (p.b[1] - p.b[0]) * i / 40, B = 1 - bb
      const c = dc * B / ((1 - B) * (e - dc))   // dari e = dc x C / (c x (A - B)), C = B + c x (A - B)
      if (c >= p.c[0] && c <= p.c[1]) { const C = B + c * (1 - B); return { b: bb, c, d: 1 - (C - dc * C) } }
    }
    return null
  }
  // C dipilih supaya proyeksi CD/BC jatuh di tengah rentangnya: e = (B - D) / (c x (A - B)) + 1.
  const B = 1 - b, D = 1 - t(p.d), cIdeal = (B - D) / ((t(p.e) - 1) * (1 - B))
  return { b, c: Math.min(p.c[1], Math.max(p.c[0], cIdeal)), d: t(p.d) }
}
