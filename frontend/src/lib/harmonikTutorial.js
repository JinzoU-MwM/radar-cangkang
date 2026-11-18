// Tutorial Harmonic: alat gambar manual. Titik diklik pengguna di chart, ditempelkan ke high/low candle, lalu dibangun
// ke bentuk yang sama dengan alat otomatis di harmonikAlat.js supaya digambar dan dijelaskan dengan format yang sama.
// Tombol Cek menilai tarikan: benar atau belum, masuk pola harmonic apa, dan saran perbaikan (yang masih kurang).
// Aturan sama dengan pemindai (Carney Vol. 1 + lembar pola): rasio, AB=CD, PRZ, stop, target 0,382/0,618 AD.
// Fungsi murni: masukan bars [{d,o,h,l,c,v}] (v dalam lot) dan titik [{n,i,p,sisi}].
import {
  ABCD_TOL, FIB_EXT, FIB_RET, POLA, SKALA, STOP_PRZ, TOL, aturanElliott, bentukOk, cariXabcd, garisXabcd, jarak, konfirmasiD,
  przPola, rasioXabcd, skorPola, targetStop,
} from './harmonikAlat.js'
import { tick } from './ta.js'

// Jumlah titik dan nama titik tiap alat. Alat swing (XABCD, Fib, Ext, Elliott) menempel ke high/low candle secara
// bergantian; Long/Short memakai harga klik yang dibulatkan ke fraksi harga BEI.
export const JUMLAH = { xabcd: 5, fib: 2, ext: 3, elliott: 6, long: 4, short: 4 }
export const NAMA_TITIK = {
  xabcd: ['X', 'A', 'B', 'C', 'D'], fib: ['awal', 'akhir'], ext: ['1', '2', '3'], elliott: ['0', '1', '2', '3', '4', '5'],
  long: ['Entry', 'Stop', 'TP1', 'TP2'], short: ['Entry', 'Stop', 'TP1', 'TP2'],
}
const SWING = new Set(['xabcd', 'fib', 'ext', 'elliott'])
export const PETUNJUK = {
  xabcd: 'Klik lima titik berurutan dari kiri ke kanan: X (awal dorongan besar), A, B, C, lalu D.',
  fib: 'Klik dua titik: awal dan akhir kaki yang diukur. Untuk harmonic, tarik dari X ke A.',
  ext: 'Klik tiga titik: awal kaki (1), akhir kaki (2), dan titik koreksi (3). Untuk AB=CD: A, B, lalu C.',
  elliott: 'Klik enam titik: 0 (awal impuls), 1, 2, 3, 4, dan 5.',
  long: 'Klik empat harga: entry, stop loss (di bawah entry), TP1, lalu TP2 (di atas entry).',
  short: 'Klik empat harga: entry, stop loss (di atas entry), TP1, lalu TP2 (di bawah entry).',
}

const fh = p => p == null || !isFinite(p) ? '–' : Number(p).toLocaleString('id-ID', { maximumFractionDigits: p < 200 ? 1 : 0 })
const fr = v => v == null ? '–' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: 3 })
const rg = r => r[0] === r[1] ? fr(r[0]) : `${fr(r[0])}–${fr(r[1])}`
const tgl = (bars, i) => String(bars[i]?.d || '').slice(0, 10)
const bulatTick = p => { const t = tick(p); return Math.round(p / t) * t }
const pct = (a, b) => Math.round((b / a - 1) * 1000) / 10

// Titik baru dari klik di bar i pada harga tertentu. Alat swing menempel ke high atau low: titik pertama ke sisi yang
// lebih dekat dengan klik, titik berikutnya bergantian (puncak, lembah, puncak, ...).
export function tempel(bars, k, titik, i, harga) {
  const n = bars.length
  if (!n || titik.length >= JUMLAH[k]) return null
  i = Math.max(0, Math.min(n - 1, Math.round(i)))
  const b = bars[i], j = titik.length, nama = NAMA_TITIK[k][j]
  if (!SWING.has(k)) return { n: nama, i, p: bulatTick(Math.max(harga, 1)) }
  const sisi = j === 0 ? (Math.abs(harga - b.h) <= Math.abs(harga - b.l) ? 'H' : 'L') : titik[j - 1].sisi === 'H' ? 'L' : 'H'
  return { n: nama, i, p: sisi === 'H' ? b.h : b.l, sisi }
}

// ------------------------------------------------------------ cek swing ----
function ekstremDi(bars, i0, i1, sisi) {
  let j = i0
  for (let i = i0; i <= i1; i++) if (sisi === 'H' ? bars[i].h > bars[j].h : bars[i].l < bars[j].l) j = i
  return j
}

// Urutan kiri ke kanan, puncak/lembah bergantian, dan setiap titik benar-benar ujung ayunan di antara tetangganya.
export function cekSwing(bars, titik, k = 'xabcd') {
  const salah = [], n = bars.length
  for (let j = 1; j < titik.length; j++) {
    if (titik[j].i <= titik[j - 1].i) salah.push(`Titik ${titik[j].n} harus berada di kanan titik ${titik[j - 1].n} (urutan dari kiri ke kanan).`)
    else if (titik[j].sisi === 'H' ? titik[j].p <= titik[j - 1].p : titik[j].p >= titik[j - 1].p)
      salah.push(`Titik ${titik[j].n} harus lebih ${titik[j].sisi === 'H' ? 'tinggi' : 'rendah'} dari titik ${titik[j - 1].n}.`)
  }
  if (salah.length) return salah
  for (let j = 0; j < titik.length; j++) {
    // Titik pertama juga dicek ke belakang (sepanjang kaki pertama): X yang diambil di tengah dorongan ketahuan.
    // Batas ke belakang: sampai harga sebelumnya sudah setengah jalan menuju titik kedua (ayunan sebelumnya).
    const t = titik[j], i1 = j < titik.length - 1 ? titik[j + 1].i : n - 1
    let i0 = j ? titik[j - 1].i : t.i
    if (!j && titik[1]) {
      const tengah = (t.p + titik[1].p) / 2
      while (i0 > 0 && (t.sisi === 'L' ? bars[i0 - 1].h < tengah : bars[i0 - 1].l > tengah)) i0--
    }
    const e = ekstremDi(bars, i0, i1, t.sisi), pe = t.sisi === 'H' ? bars[e].h : bars[e].l
    if (pe === t.p) continue
    const jenis = t.sisi === 'H' ? 'puncak' : 'lembah', arah = t.sisi === 'H' ? 'lebih tinggi' : 'lebih rendah'
    if (j === 0)
      salah.push(`Titik ${t.n} belum ${jenis} ${t.sisi === 'H' ? 'tertinggi' : 'terendah'} di awal dorongan: ada ${jenis} ${fh(pe)} pada ${tgl(bars, e)}. Pindahkan ${t.n} ke sana, karena ${t.n} harus ujung paling ekstrem sebelum dorongan dimulai.`)
    else if (j === titik.length - 1)
      salah.push(`Setelah titik ${t.n}, harga bergerak ${arah} ke ${fh(pe)} pada ${tgl(bars, e)}. Pindahkan ${t.n} ke ${jenis} itu${k === 'xabcd' ? ', atau polanya sudah gagal' : ''}.`)
    else
      salah.push(`Titik ${t.n} belum ${jenis} ${t.sisi === 'H' ? 'tertinggi' : 'terendah'} di antara ${j ? titik[j - 1].n : t.n} dan ${titik[j + 1].n}: ada ${jenis} ${fh(pe)} pada ${tgl(bars, e)}. Pindahkan ${t.n} ke sana.`)
  }
  return salah
}

// ---------------------------------------------------------------- XABCD ----
const LABEL = { b: 'Titik B (AB/XA)', c: 'Titik C (BC/AB)', cx: 'Titik C (XC/XA)', d: 'Titik D (AD/XA)', dc: 'Titik D (CD/XC)',
  dbc: 'Titik D (DC/BC)', e: 'Proyeksi BC (CD/BC)', abcd: 'AB=CD (CD/AB)' }
export function rincian(k, r) {
  const p = POLA[k]
  const kunci = ['b', p.cx ? 'cx' : 'c', p.d ? 'd' : p.dc ? 'dc' : 'dbc', ...(p.e ? ['e'] : []), ...(p.abcd ? ['abcd'] : [])]
  return kunci.map(x => {
    const v = x === 'abcd' ? r.cd : r[x], batas = p[x], tol = x === 'e' ? TOL * 2 : x === 'abcd' ? ABCD_TOL : TOL
    return { x, teks: LABEL[x], v, rg: batas, ideal: rg(batas), ok: v != null && jarak(v, batas) <= tol, arah: v == null ? '' : v < batas[0] ? 'kecil' : v > batas[1] ? 'besar' : '' }
  })
}

function saranRasio(k, b, r, harga) {
  const nama = POLA[k].nama, v = fr(b.v), id = b.ideal
  const lain = x => Object.keys(POLA).filter(q => q !== k && POLA[q][x] && jarak(r[x], POLA[q][x]) <= TOL).map(q => POLA[q].nama)
  switch (b.x) {
    case 'b': {
      const alt = lain('b')
      return `B ${v} terlalu ${b.arah === 'besar' ? 'dalam' : 'dangkal'} untuk ${nama} (ideal ${id}).` + (alt.length ? ` Angka B ini cocok untuk ${alt.join(', ')}.` : ' Cek lagi titik X dan A.')
    }
    case 'c': case 'cx': return `C ${v} di luar rentang ${nama} (ideal ${id}). Pastikan C adalah ${b.arah === 'besar' ? 'pantulan yang belum melewati A' : 'pantulan yang cukup tinggi dari B'}.`
    case 'd': case 'dc': case 'dbc':
      return b.arah === 'besar' ? `D ${v} sudah melewati batas ${nama} (ideal ${id}). Kemungkinan polanya lain atau sudah gagal.`
        : `D ${v} belum sampai (ideal ${id}). ` + (harga != null ? `Untuk ${nama}, D diharapkan di sekitar ${fh(harga)}; tunggu harga sampai di sana.` : 'Tunggu harga bergerak lebih jauh.')
    case 'e': return `Kaki CD ${v} kali BC, ${b.arah === 'besar' ? 'terlalu panjang' : 'terlalu pendek'} untuk ${nama} (ideal ${id}).`
    default: return `CD baru ${v} kali AB (kriteria ${id}). Menurut Carney AB=CD wajib ada; pola ini lebih lemah.`
  }
}

// Bangun objek XABCD (bentuk sama dengan baris cariXabcd) dari lima titik manual, dengan pola paling cocok bila ada.
export function bangunXabcd(bars, titik) {
  if (titik.length < 5) return null
  const [X, A, B, C, D] = titik.map(t => t.p), bull = A > X, n = bars.length
  const r = rasioXabcd(X, A, B, C, D)
  const kand = Object.keys(POLA).filter(k => bentukOk(k, X, A, B, C)).map(k => {
    const tolakX = (k === 'gartley' || k === 'bat') && (bull ? D < X : D > X)
    return { k, skor: tolakX ? null : skorPola(k, r), jauh: skorPola(k, r, 99) ?? 99 }
  }).sort((a, b) => (a.skor == null) - (b.skor == null) || (a.skor ?? a.jauh) - (b.skor ?? b.jauh))
  const dasar = { titik: titik.map(({ n: nm, i, p }) => ({ n: nm, i, p })), rasio: r, arah: bull ? 'bullish' : 'bearish', bentuk: 'xabcd',
    segi: [[0, 1, 2], [2, 3, 4]], harga: bars[n - 1]?.c, manual: true, kandidat: kand }
  const cocok = kand.find(x => x.skor != null)
  if (!cocok) return { ...dasar, pola: null, nama: 'Tarikan manual', status: 'tidak cocok', prz: null, garis: garisXabcd(null, r), terdekat: kand[0]?.k || null }
  const k = cocok.k, p = POLA[k]
  const prz = przPola(k, X, A, B, C) || [D, D]
  const { target, stop } = targetStop(k, X, A, B, C, D, prz, bull)
  const diPrz = D >= prz[0] && D <= prz[1]
  const abcd = p.abcd ? { rasio: r.cd, kriteria: p.abcd, ok: jarak(r.cd, p.abcd) <= ABCD_TOL } : null
  return { ...dasar, pola: k, nama: p.nama, ket: p.ket, status: diPrz ? (titik[4].i < n - 1 ? 'berbalik' : 'prz') : 'tidak cocok', skor: cocok.skor,
    prz, target, stop, abcd, kaki: k === 'cypher' ? 'CD' : 'AD', ketTarget: k === 'fiveo' ? ['0,618 DC', 'titik C'] : ['0,382 AD', '0,618 AD'],
    targetCA: ['cypher', 'fiveo'].includes(k) ? null : [C, A], garis: garisXabcd(k, r), diPrz }
}

function nilaiHarian(bars) {
  const xs = bars.slice(-20)
  return xs.length ? xs.reduce((a, x) => a + x.c * x.v * 100, 0) / xs.length : null
}

function cekXabcd(bars, titik, skala) {
  const row = bangunXabcd(bars, titik), n = bars.length
  const benar = [], kurang = cekSwing(bars, titik, 'xabcd')
  const [X, A, B, C, D] = titik.map(t => t.p), bull = A > X, xa = Math.abs(A - X)
  if (!kurang.length) benar.push('Kelima titik adalah ujung ayunan (puncak dan lembah) yang benar, berurutan dari kiri ke kanan.')
  if (xa / Math.min(X, A) < 0.05) kurang.push(`Kaki XA hanya ${fr(Math.round(xa / Math.min(X, A) * 1000) / 10)}%: terlalu kecil. Pilih dorongan yang lebih besar, minimal sekitar 5–10% di chart harian.`)
  else benar.push(`Kaki XA ${fr(Math.round(xa / Math.min(X, A) * 1000) / 10)}% cukup besar sebagai penggaris pola.`)
  const r = row.rasio, rek = []
  let pola = null
  if (row.pola) {
    pola = `${row.nama} ${row.arah}`
    for (const b of rincian(row.pola, r)) {
      if (b.ok) benar.push(`${b.teks} ${fr(b.v)}: sesuai ${row.nama} (ideal ${b.ideal}).`)
      else kurang.push(saranRasio(row.pola, b, r))
    }
    if (row.diPrz) benar.push(`D ${fh(D)} berada di PRZ ${fh(row.prz[0])}–${fh(row.prz[1])}.`)
    else kurang.push(`D ${fh(D)} di luar PRZ ${fh(row.prz[0])}–${fh(row.prz[1])}. D harus berada di PRZ.`)
  } else if (row.terdekat) {
    const k = row.terdekat, nama = POLA[k].nama, s = bull ? 1 : -1
    kurang.unshift(`Rasio belum memenuhi pola mana pun. Yang paling dekat: ${nama} ${bull ? 'bullish' : 'bearish'}.`)
    for (const b of rincian(k, r)) {
      if (b.ok) benar.push(`${b.teks} ${fr(b.v)}: sudah sesuai ${nama}.`)
      else kurang.push(saranRasio(k, b, r, b.x === 'd' ? A - s * xa * POLA[k].d[0] : null))
    }
  } else kurang.unshift('Bentuk titik belum membentuk pola harmonic: B harus di antara X dan A, C di antara A dan B (kecuali Cypher, Shark, 5-0).')
  // Rekomendasi: daftar periksa kualitas pola (materi Hari 3) bila polanya cocok.
  if (row.pola) {
    const akhir = bars[n - 1].c, t1 = row.target[0], stop = row.stop
    const rr = bull ? (t1 - akhir) / (akhir - stop) : (akhir - t1) / (stop - akhir)
    const lari = Math.abs(akhir / D - 1) * 100
    const nilai = nilaiHarian(bars)
    const konf = konfirmasiD(bars, { ...row, titik: row.titik })
    const cek = [
      { ok: true, teks: `Angka B dan D cocok dengan ${row.nama}` },
      { ok: !row.abcd || row.abcd.ok, teks: row.abcd ? `AB=CD: CD ${fr(r.cd)} kali AB (kriteria ${rg(row.abcd.kriteria)})` : 'AB=CD tidak dipakai pola ini' },
      { ok: row.diPrz, teks: 'D berada di PRZ' },
      { ok: lari <= 5, teks: `Harga terakhir ${fh(akhir)}, ${fr(Math.round(lari * 10) / 10)}% dari D (maksimal sekitar 5%)` },
      { ok: rr >= 1, teks: `Dari harga terakhir: untung ke target 1 (${fh(t1)}) dibanding rugi ke stop (${fh(stop)}) = ${isFinite(rr) ? fr(Math.round(rr * 100) / 100) : '–'} banding 1 (minimal 1)` },
      { ok: nilai != null && nilai >= 1e9, teks: `Likuiditas: rata-rata nilai transaksi ${nilai == null ? '–' : 'Rp' + fr(Math.round(nilai / 1e8) / 10) + ' miliar'} per hari (minimal Rp1 miliar)` },
      { ok: !!konf && konf.jumlah >= 2, teks: konf ? `Tanda berbalik di D: ${konf.jumlah} dari ${konf.total} (${konf.label})` : 'Tanda berbalik di D: belum bisa dinilai' },
    ]
    const gagal = cek.filter(c => !c.ok)
    rek.push(...cek.map(c => ({ ...c })))
    row.kesimpulan = !gagal.length ? 'Layak dipertimbangkan. Tetap pasang stop sejak awal.'
      : gagal.length === 1 ? `Hampir layak. Yang kurang: ${gagal[0].teks.toLowerCase()}.` : `Lewati dulu: ${gagal.length} syarat belum terpenuhi.`
    row.rencana = { prz: row.prz, stop, target: row.target, rr: isFinite(rr) ? Math.round(rr * 100) / 100 : null,
      stopKet: STOP_PRZ.has(row.pola) ? 'sedikit di luar PRZ (D sudah melewati X)' : row.pola === 'fiveo' ? '0,618 kaki BC' : 'di balik X' }
  }
  // Pembanding: apakah pemindai otomatis menemukan pola yang sama (B, C, D di bar yang berdekatan)?
  const auto = cariXabcd(bars, skala || SKALA.D)
  const sama = auto.find(a => a.pola === row.pola && [2, 3, 4].every(j => Math.abs(a.titik[j].i - titik[j].i) <= 3))
  const sistem = sama ? `Pemindai sistem juga menemukan ${sama.nama} ${sama.arah} di titik yang sama.`
    : auto.length ? `Pemindai sistem saat ini menemukan: ${auto.slice(0, 3).map(a => `${a.nama} ${a.arah} (X ${tgl(bars, a.titik[0].i)})`).join('; ')}. Bandingkan titiknya dengan tarikan Anda.`
      : 'Pemindai sistem tidak menemukan pola aktif di saham dan timeframe ini.'
  const nilaiAkhir = kurang.length === 0 ? 'benar' : row.pola && cekSwing(bars, titik).length === 0 ? 'hampir' : 'perlu'
  return { alat: 'xabcd', nilai: nilaiAkhir, pola, benar, kurang, rekomendasi: rek, kesimpulan: row.kesimpulan || null, rencana: row.rencana || null, sistem, objek: row }
}

// ------------------------------------------------------------- Fib, Ext ----
export function bangunFib(bars, titik) {
  if (titik.length < 2) return null
  const [a, b] = titik, akhir = bars[bars.length - 1]?.c
  const level = FIB_RET.map(r => ({ r, p: b.p - (b.p - a.p) * r })).filter(l => l.p > 0)
  return { a: { i: a.i, p: a.p }, b: { i: b.i, p: b.p }, level, dasar: 'tarikan manual', naik: b.p > a.p, manual: true,
    posisi: akhir == null ? null : Math.round((b.p - akhir) / (b.p - a.p) * 1000) / 1000 }
}
export function bangunExt(titik) {
  if (titik.length < 3) return null
  const [p1, p2, p3] = titik, k = p2.p - p1.p
  return { titik: titik.map((x, j) => ({ n: String(j + 1), i: x.i, p: x.p })), level: FIB_EXT.map(r => ({ r, p: p3.p + k * r })).filter(l => l.p > 0),
    dasar: 'tarikan manual', naik: k > 0, manual: true }
}

function cekFib(bars, titik, xabcd) {
  const o = bangunFib(bars, titik), kurang = cekSwing(bars, titik, 'fib'), benar = []
  const [a, b] = titik, besar = Math.abs(b.p - a.p) / Math.min(a.p, b.p) * 100
  if (!kurang.length) benar.push('Fib ditarik dari ujung ayunan ke ujung ayunan berikutnya.')
  if (besar < 5) kurang.push(`Kaki yang diukur hanya ${fr(Math.round(besar * 10) / 10)}%: terlalu kecil untuk dibaca.`)
  if (xabcd?.titik?.length === 5) {
    const [X, A] = xabcd.titik
    if (a.i === X.i && b.i === A.i) benar.push('Fib ditarik dari X ke A: B dan D bisa dibaca langsung di level 0,618, 0,786, 0,886, 1,27, dan 1,618.')
    else kurang.push(`Untuk membaca pola harmonic, tarik Fib dari X (${tgl(bars, X.i)}) ke A (${tgl(bars, A.i)}).`)
  }
  const rek = []
  if (o.posisi != null) {
    const dekat = o.level.reduce((m, l) => Math.abs(l.r - o.posisi) < Math.abs(m.r - o.posisi) ? l : m, o.level[0])
    rek.push({ ok: true, teks: `Harga terakhir di retracement ${fr(o.posisi)}, paling dekat dengan level ${fr(dekat.r)} (${fh(dekat.p)}).` })
  }
  return { alat: 'fib', nilai: kurang.length ? 'perlu' : 'benar', benar, kurang, rekomendasi: rek, objek: o }
}

function cekExt(bars, titik, xabcd) {
  const o = bangunExt(titik), kurang = cekSwing(bars, titik, 'ext'), benar = []
  const [p1, p2, p3] = titik, c = Math.abs(p3.p - p2.p) / Math.abs(p2.p - p1.p)
  if (!kurang.length) benar.push('Ketiga titik adalah ujung ayunan yang benar.')
  if (c >= 0.382 * 0.95 && c <= 0.886 * 1.05) benar.push(`Titik 3 memantul ${fr(Math.round(c * 1000) / 1000)} dari kaki 1–2, sesuai rentang AB=CD (0,382–0,886).`)
  else kurang.push(`Titik 3 memantul ${fr(Math.round(c * 1000) / 1000)} dari kaki 1–2, di luar 0,382–0,886. Untuk AB=CD, titik 3 harus pantulan sebagian.`)
  if (xabcd?.titik?.length === 5) {
    const [, A, B, C] = xabcd.titik
    if (p1.i === A.i && p2.i === B.i && p3.i === C.i) benar.push('Ext ditarik dari A, B, ke C: level 1 adalah titik D bila AB=CD setara, level 1,27 dan 1,618 untuk versi panjang.')
    else kurang.push('Untuk mengecek AB=CD di pola harmonic, tarik Ext dari A ke B, lalu klik C.')
  }
  const l1 = o.level.find(l => l.r === 1), l127 = o.level.find(l => l.r === 1.27)
  return { alat: 'ext', nilai: kurang.length ? 'perlu' : 'benar', benar, kurang, objek: o,
    rekomendasi: [{ ok: true, teks: `Proyeksi setara (level 1) di ${fh(l1?.p)}, versi 1,27 di ${fh(l127?.p)}. Bandingkan dengan PRZ pola.` }] }
}

// --------------------------------------------------------------- Elliott ----
export function bangunElliott(titik) {
  if (titik.length < 6) return null
  return { status: 'tarikan manual', ...aturanElliott(titik), titik: titik.map((x, j) => ({ n: String(j), i: x.i, p: x.p })), manual: true }
}
function cekElliott(bars, titik) {
  const o = bangunElliott(titik), kurang = cekSwing(bars, titik, 'elliott'), benar = []
  if (!kurang.length) benar.push('Keenam titik adalah ujung ayunan yang benar.')
  for (const a of o.aturan) {
    if (a.ok) benar.push(a.teks + '.')
    else kurang.push(`${a.teks}: belum terpenuhi. Coba geser penomoran gelombang, atau ini bukan impuls lima gelombang.`)
  }
  return { alat: 'elliott', nilai: kurang.length ? 'perlu' : 'benar', benar, kurang, objek: o,
    rekomendasi: o.panduan.map(p => ({ ok: true, teks: `${p.k} ${fr(p.v)} (panduan ${p.ideal})` })) }
}

// ----------------------------------------------------------- Long / Short ----
export function bangunPosisi(bars, k, titik, pola = null) {
  if (titik.length < 4) return null
  const long = k === 'long', [e, s, t1, t2] = titik.map(t => t.p), risiko = Math.abs(e - s), n = bars.length
  return { arah: k, dasar: 'tarikan manual', pola: pola && pola.arah === (long ? 'bullish' : 'bearish') && pola.pola ? pola : null,
    entry: e, stop: s, target: [t1, t2], i0: titik[0].i, harga: bars[n - 1]?.c, stopPct: pct(e, s), targetPct: [pct(e, t1), pct(e, t2)],
    rr: [t1, t2].map(t => risiko ? Math.round(Math.abs(t - e) / risiko * 100) / 100 : null), aktif: 'tarikan manual', manual: true }
}
function cekPosisi(bars, k, titik, xabcd) {
  const o = bangunPosisi(bars, k, titik, xabcd), long = k === 'long', benar = [], kurang = []
  const { entry: e, stop: s, target: [t1, t2] } = o
  const urut = long ? s < e && e < t1 && t1 < t2 : s > e && e > t1 && t1 > t2
  if (!urut) kurang.push(long ? 'Urutan harga Long harus: stop di bawah entry, TP1 di atas entry, dan TP2 di atas TP1.' : 'Urutan harga Short harus: stop di atas entry, TP1 di bawah entry, dan TP2 di bawah TP1.')
  else benar.push('Urutan entry, stop, TP1, dan TP2 sudah benar.')
  if (urut) {
    if (o.rr[0] >= 1) benar.push(`R:R ke TP1 ${fr(o.rr[0])}: target sebanding dengan risiko.`)
    else kurang.push(`R:R ke TP1 hanya ${fr(o.rr[0])}: untung lebih kecil dari risiko. Dekatkan entry ke stop atau pilih target lebih jauh.`)
    if (o.rr[1] >= 2) benar.push(`R:R ke TP2 ${fr(o.rr[1])}, minimal 2 terpenuhi.`)
    else kurang.push(`R:R ke TP2 ${fr(o.rr[1])} di bawah 2.`)
    if (Math.abs(o.stopPct) > 25) kurang.push(`Stop ${fr(Math.abs(o.stopPct))}% dari entry: terlalu jauh.`)
  }
  const p = o.pola
  if (p) {
    const D = p.titik[4].p
    if (e >= p.prz[0] * 0.98 && e <= p.prz[1] * 1.02) benar.push(`Entry dekat PRZ pola ${p.nama} (${fh(p.prz[0])}–${fh(p.prz[1])}).`)
    else kurang.push(`Entry ${fh(e)} jauh dari PRZ pola ${p.nama} (${fh(p.prz[0])}–${fh(p.prz[1])}). Entry yang baik di dekat D (${fh(D)}).`)
    if (long ? s <= p.stop : s >= p.stop) benar.push(`Stop di balik batas batal pola (${fh(p.stop)}).`)
    else kurang.push(`Stop ${fh(s)} belum di balik batas batal pola ${p.nama} (${fh(p.stop)}): ${STOP_PRZ.has(p.pola) ? 'di luar PRZ' : 'di balik X'}.`)
    const dekat = (a, b) => Math.abs(a / b - 1) <= 0.03
    if (dekat(t1, p.target[0]) && dekat(t2, p.target[1])) benar.push('TP1 dan TP2 sesuai target pola (0,382 dan 0,618 kaki AD).')
    else kurang.push(`Target pola ${p.nama}: TP1 ${fh(p.target[0])} (0,382 AD) dan TP2 ${fh(p.target[1])} (0,618 AD).`)
  } else if (xabcd?.pola) kurang.push(`Arah ${long ? 'Long' : 'Short'} berlawanan dengan pola ${xabcd.nama} ${xabcd.arah} yang Anda tarik.`)
  else kurang.push('Belum ada pola harmonic yang cocok dari tarikan XABCD Anda; rencana ini belum punya dasar pola.')
  if (!long) benar.push('Catatan: short selling di BEI terbatas. Bagi yang tidak bisa short, pakai sebagai rencana jual atau ambil untung.')
  return { alat: k, nilai: kurang.length ? 'perlu' : 'benar', benar, kurang, rekomendasi: [], objek: o }
}

// ------------------------------------------------------------- pintu masuk ----
// Objek gambar untuk alat yang titiknya sudah lengkap (bentuk sama dengan alat otomatis).
export function bangunManual(bars, k, titik, xabcd = null) {
  if (!titik || titik.length < JUMLAH[k]) return null
  if (k === 'xabcd') return bangunXabcd(bars, titik)
  if (k === 'fib') return bangunFib(bars, titik)
  if (k === 'ext') return bangunExt(titik)
  if (k === 'elliott') return bangunElliott(titik)
  return bangunPosisi(bars, k, titik, xabcd)
}

// Hasil cek satu alat: { nilai: 'benar' | 'hampir' | 'perlu', benar[], kurang[], rekomendasi[], ... }.
export function cekManual(bars, k, titik, { xabcd = null, skala = null } = {}) {
  if (!titik || titik.length < JUMLAH[k]) return { alat: k, nilai: 'belum', benar: [], kurang: [`Titik belum lengkap: ${titik?.length || 0} dari ${JUMLAH[k]}. ${PETUNJUK[k]}`], rekomendasi: [] }
  if (k === 'xabcd') return cekXabcd(bars, titik, skala)
  if (k === 'fib') return cekFib(bars, titik, xabcd)
  if (k === 'ext') return cekExt(bars, titik, xabcd)
  if (k === 'elliott') return cekElliott(bars, titik)
  return cekPosisi(bars, k, titik, xabcd)
}
