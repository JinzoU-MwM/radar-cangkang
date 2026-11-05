<script setup>
// Harmonic Pattern (POV): materi belajar bergaya presentasi riset (sampul, anatomi XABCD interaktif, jenis pola,
// strategi, studi kasus, screening harian saham BEI, analisa per saham, bukti & sumber). Materi diringkas dari
// artikel Astronacci (2), Maxco, dan FOREXimf; screening dari /api/harmonik (dihitung server tiap malam).
import { computed, onMounted, ref, watch } from 'vue'
import { api } from '../api.js'
import { HM_STATUS, saringHarmonik, hitungHarmonik, rentang, przTeks, polaDiagram, skalaSvg } from '../lib/harmonik.js'
import HarmonikAnalisa from './HarmonikAnalisa.vue'

const data = ref(null), err = ref('')
onMounted(() => api.get('/api/harmonik').then(v => { data.value = v }, e => { err.value = e.message || String(e) }))
const rows = computed(() => data.value?.rows || [])
const pola = computed(() => data.value?.pola || [])
const n = computed(() => hitungHarmonik(rows.value))
const rp = v => v == null ? '–' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: 2 })

// Sumber (catatan kaki [1]-[7]).
const SUMBER = [
  { k: 1, teks: 'Astronacci, "Belajar Harmonic Pattern: Pengertian, Cara Kerja, dan Jenis-Jenisnya", 31 Juli 2026.', url: 'https://astronacci.com/blog/read/belajar-harmonic-pattern-pengertian-cara-kerja-dan-jenis-jenisnya' },
  { k: 2, teks: 'Astronacci, "Cara Menggunakan Harmonic Pattern untuk Menentukan Area Entry", 7 Agustus 2026.', url: 'https://astronacci.com/blog/read/cara-menggunakan-harmonic-pattern-untuk-menentukan-area-entry' },
  { k: 3, teks: 'Maxco, "Cara Mudah Belajar Harmonic Pattern: Panduan Praktis Trading Forex untuk Pemula".', url: 'https://www.maxco.co.id/blog-id/belajar-harmonic-pattern-untuk-begin/' },
  { k: 4, teks: 'FOREXimf, "Harmonic Pattern: Seni Membaca \'Ritme\' Market Biar Gak Cuma Tebak-tebakan", 20 Januari 2026.', url: 'https://www.foreximf.com/blog/pattern/harmonic-pattern-seni-membaca-ritme-market-biar-gak-cuma-tebak-tebakan' },
  { k: 5, teks: 'TradersLog, "Classic Chart Patterns: Gartley\'s AB=CD Pattern" (sejarah pola Gartley 222).', url: 'https://www.traderslog.com/?p=2939' },
  { k: 6, teks: 'Scott M. Carney, Harmonic Trading, Volume One (Pearson/FT Press, 2010), halaman penerbit.', url: 'https://www.informit.com/store/harmonic-trading-volume-one-profiting-from-the-natural-9780137051502' },
  { k: 7, teks: 'Anup Shinde, "Backtesting the four classical harmonic patterns", 30 Mei 2026.', url: 'https://www.anupshinde.com/harmonic-patterns-backtested/' },
]

const SLIDE = [['sampul', 'Pengenalan'], ['anatomi', 'Anatomi XABCD'], ['jenis', 'Jenis pola'], ['strategi', 'Strategi'],
  ['kasus', 'Studi kasus'], ['screening', 'Screening'], ['analisa', 'Analisa'], ['bukti', 'Bukti & sumber']]
const s = ref(0)
const ke = i => { s.value = Math.max(0, Math.min(SLIDE.length - 1, i)) }

// ---------------------------------------------------------------- diagram ----
const W = 560, H = 270, PAD = 30
// y: {X, A, B, C, D?} (nilai bebas: rasio atau harga); ekstra = nilai lain yang harus muat (PRZ, stop, target).
function bentuk(y, ekstra = [], kini = null) {
  const nm = ['X', 'A', 'B', 'C', 'D'].filter(k => y[k] != null)
  const { fy } = skalaSvg([...nm.map(k => y[k]), ...ekstra.filter(v => v != null), ...(kini != null ? [kini] : [])], W, H, PAD)
  const dx = (W - 2 * PAD - 150) / 4   // ruang kanan untuk label PRZ, stop, target
  const pts = nm.map((k, i) => ({ n: k, x: PAD + i * dx, y: fy(y[k]), v: y[k] }))
  pts.forEach((p, i) => { const a = pts[i - 1], b = pts[i + 1]; p.puncak = (!a || p.v >= a.v) && (!b || p.v >= b.v) })
  return { pts, fy, dx, xD: PAD + 4 * dx }
}
const garis = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
const tengahGaris = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

// --------------------------------------------------------------- anatomi ----
const arahAnatomi = ref('bullish')
const ANATOMI = {
  X: ['Titik X', 'Titik awal pergerakan; acuan pengukuran rasio untuk seluruh kaki berikutnya.', '1'],
  A: ['Titik A', 'Puncak atau lembah pertama setelah dorongan dari X. Kaki XA adalah dorongan impulsif pertama dan landasan ukur utama.', '1, 3'],
  B: ['Titik B', 'Koreksi dari kaki XA. Besar retracement B terhadap XA menjadi penentu awal jenis pola (Gartley 0,618; Bat 0,382–0,5; Butterfly 0,786).', '1, 2'],
  C: ['Titik C', 'Kelanjutan dari B: kembali searah XA, tetapi hanya koreksi dari kaki AB. Pada Cypher, C justru melewati A.', '1, 3'],
  D: ['Titik D (PRZ)', 'Titik akhir pola dan lokasi Potential Reversal Zone: area tempat retracement XA dan extension BC bertemu. PRZ adalah zona, bukan satu angka, dan bukan jaminan harga berbalik.', '1, 2, 3'],
  XA: ['Kaki XA', 'Dorongan pertama yang menjadi tolok ukur. Semua rasio B dan D diukur terhadap panjang XA.', '3'],
  AB: ['Kaki AB', 'Koreksi dari XA; kedalamannya harus berhenti di rasio retracement tertentu.', '3'],
  BC: ['Kaki BC', 'Koreksi dari AB yang kembali searah XA. Panjangnya dipakai untuk memproyeksikan D (extension BC).', '2, 3'],
  CD: ['Kaki CD', 'Kaki terakhir yang menyempurnakan pola. Pola ABCD, fondasi semua pola harmonik, mensyaratkan AB dan CD sebanding jarak dan waktunya.', '3'],
}
const pilihAnatomi = ref('D')
const GENERIK = { b: [0.618, 0.618], c: [0.382, 0.886], d: [0.786, 0.786] }
const dAnatomi = computed(() => {
  const g = polaDiagram(GENERIK, arahAnatomi.value)
  return { ...bentuk(g.y, g.prz), prz: g.prz }
})

// ----------------------------------------------------------------- jenis ----
const KARAKTER = {
  gartley: ['Cocok untuk trading searah tren; strukturnya paling mudah dikenali pemula.', '4'],
  bat: ['Titik D presisi dan sering memberi entry berisiko kecil, asal disiplin menunggu harga masuk area yang tepat.', '4'],
  butterfly: ['Sering muncul di ujung tren saat harga over-extended; potensi pembalikan besar tetapi butuh konfirmasi ekstra.', '4'],
  crab: ['Sering muncul di ujung tren saat harga over-extended; potensi pembalikan besar tetapi butuh konfirmasi ekstra.', '4'],
  cypher: ['Strukturnya berbeda: C melewati A. Umumnya muncul di pasar volatil dengan swing kompleks.', '1'],
}
const pilihPola = ref('gartley')
const polaAktif = computed(() => pola.value.find(p => p.k === pilihPola.value))
const dPola = computed(() => {
  const p = polaAktif.value
  if (!p) return null
  const g = polaDiagram(p, 'bullish')
  return { ...bentuk(g.y, g.prz), prz: g.prz, p }
})
const labelKaki = p => p.cx
  ? [['AB', `B ${rentang(p.b)} XA`], ['BC', `C ${rentang(p.cx)} XA`], ['CD', `D ${rentang(p.dxc)} XC`]]
  : [['AB', `B ${rentang(p.b)} XA`], ['BC', `C ${rentang(p.c)} AB`], ['CD', `CD ${rentang(p.bc)} × BC`]]

// -------------------------------------------------------------- strategi ----
const LANGKAH = [
  ['Identifikasi swing', 'Cari dorongan harga yang jelas dan tandai swing high/low signifikan untuk X, A, B, C. Salah memilih titik awal membuat semua rasio meleset. Untuk pemula disarankan H4 atau Daily.', '2, 3'],
  ['Ukur rasio tiap kaki', 'Tarik Fibonacci retracement dan extension pada XA, AB, dan BC, lalu cocokkan dengan kriteria pola. Bila tidak mendekati kriteria, jangan dipaksakan.', '2'],
  ['Proyeksikan D dan PRZ', 'Gabungkan retracement XA dengan extension BC. Area tumpang tindihnya adalah PRZ; makin banyak level Fibonacci berkumpul, makin kuat zonanya.', '2, 3'],
  ['Tunggu konfirmasi', 'Jangan entry hanya karena harga menyentuh D. Tunggu candle pembalikan (pin bar, engulfing, inside/outside bar), divergence RSI atau Stochastic, atau tembusnya struktur minor.', '2, 3, 4'],
  ['Kelola risiko', 'Stop sedikit di balik X (atau sedikit di luar PRZ). Target 0,382 lalu 0,618 kaki AD; alternatif: titik C lalu titik A. Bila harga menembus PRZ, skenario batal.', '2, 3, 4'],
]
const pilihLangkah = ref(0)

// ----------------------------------------------------------- studi kasus ----
// Astronacci [2]: Bullish Gartley BTC/USDT 24 Juli 2026, rasio terukur B 0,59 XA, C 0,845 AB, D 0,783 XA, CD 1,385 BC.
const KASUS = [
  ['Identifikasi struktur', 'Harga naik dari X ke A (kaki XA), lalu terkoreksi ke B di sekitar 0,59 XA, dekat rasio Gartley 0,618.'],
  ['Pengukuran kaki berikutnya', 'Dari B harga naik ke C (0,845 AB, masih dalam 0,382–0,886). D diproyeksikan dari dua acuan: 0,783 XA (dekat 0,786) dan 1,385 extension BC. Keduanya bertumpuk membentuk PRZ.'],
  ['Konfirmasi dan entry', 'Saat harga masuk PRZ di sekitar D muncul sinyal pembalikan bullish. Sinyal itu yang menjadi alasan mempertimbangkan entry buy, bukan sentuhan ke D semata.'],
  ['Stop loss dan target', 'Stop sedikit di bawah X. Target pertama retracement 0,382 kaki AD, target lanjutan 0,618 AD. Menurut artikel, harga setelah D bergerak naik sesuai skenario.'],
]
const tahapKasus = ref(0)
const dKasus = computed(() => {
  const y = { X: 0, A: 1, B: 0.41, C: 0.41 + 0.845 * 0.59, D: 0.217 }
  const b = bentuk(y, [-0.08, 0.217 + 0.382 * 0.783, 0.217 + 0.618 * 0.783])
  return { ...b, prz: [0.2, 0.235], t: [0.217 + 0.382 * 0.783, 0.217 + 0.618 * 0.783], stop: -0.05 }
})
const contohBei = computed(() => rows.value.find(r => r.status !== 'menuju') || rows.value[0] || null)

// ------------------------------------------------------- screening & analisa ----
const fStatus = ref('semua'), fArah = ref('semua')
const tampil = computed(() => saringHarmonik(rows.value, fStatus.value, fArah.value))
// Analisa tampil di tempat: baris screening yang diklik membuka analisanya tepat di bawahnya.
const kunci = r => r.t + r.pola + r.titik[0].d
const terbuka = ref('')
const togel = r => { terbuka.value = terbuka.value === kunci(r) ? '' : kunci(r) }
const kasusBuka = ref(false)

// Slide Analisa: saham BEI mana pun (kode/nama dari /api/kode-bei) atau pilihan cepat dari screening.
const q = ref(''), kodeBei = ref(null), saham = ref(null)
watch(q, v => {
  if (v.trim() && kodeBei.value === null) {
    kodeBei.value = []
    api.get('/api/kode-bei').then(r => { kodeBei.value = r.kode || [] }, () => { kodeBei.value = [] })
  }
})
const saran = computed(() => {
  const x = q.value.trim().toLowerCase()
  if (x.length < 2 || !kodeBei.value) return []
  return kodeBei.value.filter(k => k.t.toLowerCase().startsWith(x) || (x.length >= 3 && (k.nama || '').toLowerCase().includes(x)))
    .sort((a, b) => (b.t.toLowerCase() === x) - (a.t.toLowerCase() === x) || a.t.localeCompare(b.t)).slice(0, 8)
})
const cepat = computed(() => rows.value.slice(0, 10))
function analisaSaham(t, pola = '') { saham.value = { t, pola }; q.value = '' }
const sahamAktif = computed(() => saham.value || (rows.value[0] ? { t: rows.value[0].t, pola: rows.value[0].pola } : null))
</script>

<template>
  <div class="hm" tabindex="0" @keydown.left="ke(s - 1)" @keydown.right="ke(s + 1)">
    <nav class="nav" aria-label="Slide Harmonic Pattern">
      <button v-for="(x, i) in SLIDE" :key="x[0]" type="button" class="nv" :class="{ on: s === i }" :aria-current="s === i ? 'step' : null" @click="ke(i)">
        <span class="no">{{ String(i + 1).padStart(2, '0') }}</span>{{ x[1] }}</button>
    </nav>
    <div class="prog" aria-hidden="true"><i :style="{ width: ((s + 1) / SLIDE.length * 100) + '%' }"></i></div>

    <!-- 01 Sampul -->
    <section v-if="s === 0" class="slide">
      <div class="sampul">
        <span class="kick">POV · MATERI RISET TEKNIKAL</span>
        <h2>Harmonic Pattern</h2>
        <p class="sub">Membaca titik balik harga dengan geometri XABCD dan rasio Fibonacci: dari konsep, strategi, studi kasus, sampai screening harian saham BEI.</p>
        <div class="kpi">
          <div><b>{{ data ? data.dinilai : '–' }}</b><span>saham dinilai</span></div>
          <div><b>{{ data ? n.semua : '–' }}</b><span>pola aktif</span></div>
          <div><b>{{ data ? n.prz + n.berbalik : '–' }}</b><span>di / dari PRZ</span></div>
          <div><b>{{ data ? `${n.bullish}/${n.bearish}` : '–' }}</b><span>bullish / bearish</span></div>
        </div>
        <span class="small upd">Screening {{ data?.updated ? 'per ' + data.updated + ' WIB' : 'belum tersedia' }} · bukan rekomendasi beli/jual</span>
      </div>
      <div class="grid3">
        <div class="kartu"><span class="ik">Apa</span><p>Metode teknikal yang memadukan pola geometris harga dengan rasio Fibonacci untuk menemukan area potensi pembalikan arah.<sup>1</sup></p></div>
        <div class="kartu"><span class="ik">Beda</span><p>Pola chart biasa dikenali dari bentuknya. Pola harmonik baru sah bila setiap kaki (XA, AB, BC, CD) memenuhi rasio tertentu.<sup>1, 2</sup></p></div>
        <div class="kartu"><span class="ik">Kenapa "harmonik"</span><p>Seperti nada dalam lagu: bila struktur dan rasionya pas, pergerakan terasa "nyambung". Bila rasio meleset, bentuk secantik apa pun bukan pola harmonik.<sup>4</sup></p></div>
      </div>
      <blockquote class="kutip">PRZ adalah area probabilitas, bukan jaminan harga berbalik.<sup>1, 2</sup></blockquote>
    </section>

    <!-- 02 Anatomi -->
    <section v-else-if="s === 1" class="slide">
      <header class="sh"><span class="no">02</span><div><h3>Anatomi XABCD</h3><p class="small muted">Klik titik atau kaki pada diagram.</p></div>
        <div class="seg"><button v-for="a in ['bullish', 'bearish']" :key="a" type="button" class="pill sm" :aria-pressed="String(arahAnatomi === a)" @click="arahAnatomi = a">{{ a }}</button></div></header>
      <div class="dua">
        <svg :viewBox="`0 0 ${W} ${H}`" class="dg" role="img" aria-label="Diagram XABCD">
          <rect :x="dAnatomi.xD - 34" :width="68" :y="Math.min(dAnatomi.fy(dAnatomi.prz[0]), dAnatomi.fy(dAnatomi.prz[1])) - 6" :height="Math.abs(dAnatomi.fy(dAnatomi.prz[0]) - dAnatomi.fy(dAnatomi.prz[1])) + 12" class="przb" :class="{ on: pilihAnatomi === 'D' }" @click="pilihAnatomi = 'D'" />
          <template v-for="(p, i) in dAnatomi.pts.slice(1)" :key="'k' + i">
            <line :x1="dAnatomi.pts[i].x" :y1="dAnatomi.pts[i].y" :x2="p.x" :y2="p.y" class="kaki" :class="{ on: pilihAnatomi === dAnatomi.pts[i].n + p.n }" @click="pilihAnatomi = dAnatomi.pts[i].n + p.n" />
            <text :x="tengahGaris(dAnatomi.pts[i], p).x + 8" :y="tengahGaris(dAnatomi.pts[i], p).y" class="kl">{{ dAnatomi.pts[i].n + p.n }}</text>
          </template>
          <g v-for="p in dAnatomi.pts" :key="p.n" class="tt" :class="{ on: pilihAnatomi === p.n }" @click="pilihAnatomi = p.n">
            <circle :cx="p.x" :cy="p.y" r="9" /><text :x="p.x" :y="p.puncak ? p.y - 16 : p.y + 26">{{ p.n }}</text>
          </g>
          <text :x="dAnatomi.xD + 40" :y="dAnatomi.fy((dAnatomi.prz[0] + dAnatomi.prz[1]) / 2) + 4" class="kl">PRZ</text>
        </svg>
        <div class="kartu pilih">
          <span class="ik">{{ ANATOMI[pilihAnatomi][0] }}</span>
          <p>{{ ANATOMI[pilihAnatomi][1] }}<sup>{{ ANATOMI[pilihAnatomi][2] }}</sup></p>
          <p class="small muted">{{ arahAnatomi === 'bullish' ? 'Bullish: XA naik, D berupa lembah, area potensi berbalik naik.' : 'Bearish: XA turun, D berupa puncak, area potensi berbalik turun.' }}</p>
        </div>
      </div>
    </section>

    <!-- 03 Jenis pola -->
    <section v-else-if="s === 2" class="slide">
      <header class="sh"><span class="no">03</span><div><h3>Lima pola utama</h3><p class="small muted">Rasio sesuai ilustrasi artikel sumber.<sup>1</sup></p></div></header>
      <div class="seg">
        <button v-for="p in pola" :key="p.k" type="button" class="pill sm" :aria-pressed="String(pilihPola === p.k)" @click="pilihPola = p.k">{{ p.nama }}</button>
      </div>
      <p v-if="!pola.length" class="small muted">{{ err || 'Memuat…' }}</p>
      <div v-else-if="dPola" class="dua">
        <svg :viewBox="`0 0 ${W} ${H}`" class="dg" role="img" :aria-label="'Diagram pola ' + dPola.p.nama">
          <rect :x="dPola.xD - 34" :width="68" :y="Math.min(dPola.fy(dPola.prz[0]), dPola.fy(dPola.prz[1])) - 6" :height="Math.abs(dPola.fy(dPola.prz[0]) - dPola.fy(dPola.prz[1])) + 12" class="przb on" />
          <line :x1="dPola.pts[0].x" :y1="dPola.pts[0].y" :x2="dPola.pts[4].x" :y2="dPola.pts[4].y" class="bantu" />
          <line :x1="dPola.pts[0].x" :y1="dPola.pts[0].y" :x2="dPola.pts[2].x" :y2="dPola.pts[2].y" class="bantu" />
          <path :d="garis(dPola.pts)" class="jalur" />
          <template v-for="(lk, i) in labelKaki(dPola.p)" :key="lk[0]">
            <text :x="tengahGaris(dPola.pts[i + 1], dPola.pts[i + 2]).x + 8" :y="tengahGaris(dPola.pts[i + 1], dPola.pts[i + 2]).y" class="kl rasio">{{ lk[1] }}</text>
          </template>
          <text v-if="dPola.p.d" :x="(dPola.pts[0].x + dPola.pts[4].x) / 2" :y="(dPola.pts[0].y + dPola.pts[4].y) / 2 + 16" class="kl rasio">D {{ rentang(dPola.p.d) }} XA</text>
          <g v-for="p in dPola.pts" :key="p.n" class="tt"><circle :cx="p.x" :cy="p.y" r="7" /><text :x="p.x" :y="p.puncak ? p.y - 14 : p.y + 24">{{ p.n }}</text></g>
        </svg>
        <div class="kartu pilih">
          <span class="ik">{{ dPola.p.nama }}</span>
          <p>{{ dPola.p.ket }}<sup>1</sup></p>
          <p class="small">{{ KARAKTER[dPola.p.k][0] }}<sup>{{ KARAKTER[dPola.p.k][1] }}</sup></p>
          <table class="ledger small">
            <tbody>
              <tr><td>B / XA</td><td class="num">{{ rentang(dPola.p.b) }}</td></tr>
              <tr v-if="dPola.p.c"><td>C / AB</td><td class="num">{{ rentang(dPola.p.c) }}</td></tr>
              <tr v-if="dPola.p.cx"><td>C / XA</td><td class="num">{{ rentang(dPola.p.cx) }}</td></tr>
              <tr v-if="dPola.p.d"><td>D / XA</td><td class="num">{{ rentang(dPola.p.d) }}</td></tr>
              <tr v-if="dPola.p.bc"><td>CD / BC</td><td class="num">{{ rentang(dPola.p.bc) }}</td></tr>
              <tr v-if="dPola.p.dxc"><td>D / XC</td><td class="num">{{ rentang(dPola.p.dxc) }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <p class="small muted note">Ilustrasi pola di artikel sumber dibuat dengan AI; teks artikel menyebut B Gartley 0,618, B Bat 0,382–0,5, B Butterfly 0,786, D Crab hingga 1,618, dan C Cypher 1,272–1,414 XA.<sup>1, 2</sup></p>
    </section>

    <!-- 04 Strategi -->
    <section v-else-if="s === 3" class="slide">
      <header class="sh"><span class="no">04</span><div><h3>Kerangka eksekusi lima langkah</h3><p class="small muted">Klik setiap langkah.</p></div></header>
      <ol class="alur">
        <li v-for="(l, i) in LANGKAH" :key="l[0]" :class="{ on: pilihLangkah === i }">
          <button type="button" @click="pilihLangkah = i"><span class="bul">{{ i + 1 }}</span>{{ l[0] }}</button>
        </li>
      </ol>
      <div class="kartu pilih lebar"><span class="ik">Langkah {{ pilihLangkah + 1 }} · {{ LANGKAH[pilihLangkah][0] }}</span><p>{{ LANGKAH[pilihLangkah][1] }}<sup>{{ LANGKAH[pilihLangkah][2] }}</sup></p></div>
      <div class="grid3">
        <div class="kartu"><span class="ik">Kondisi cocok</span><p>Pasar yang sudah bergerak jauh satu arah dan mulai lelah. Pada pasar choppy tanpa swing tegas, rasio sulit divalidasi dan sinyal palsu lebih sering.<sup>2</sup></p></div>
        <div class="kartu"><span class="ik">Time frame</span><p>Makin besar time frame, makin signifikan PRZ. Time frame kecil cepat membentuk pola tetapi rentan noise. Pola searah tren time frame besar umumnya lebih baik.<sup>2</sup></p></div>
        <div class="kartu"><span class="ik">Likuiditas</span><p>Pada instrumen tidak likuid, struktur XABCD kurang representatif.<sup>2</sup> Karena itu screening di sini hanya menilai saham dengan nilai transaksi rata-rata 20 hari ≥ Rp{{ rp((data?.minNilai || 1e9) / 1e9) }} miliar.</p></div>
      </div>
      <table class="ledger small">
        <thead><tr><th>Rencana</th><th>Versi Astronacci<sup>2</sup></th><th>Versi Maxco<sup>3</sup></th></tr></thead>
        <tbody>
          <tr><td>Entry</td><td>Di PRZ setelah sinyal pembalikan</td><td>Di PRZ setelah candle konfirmasi (pin bar, engulfing)</td></tr>
          <tr><td>Stop loss</td><td>Sedikit di bawah/atas X</td><td>Sedikit di luar PRZ atau di balik X</td></tr>
          <tr><td>Target 1</td><td>Retracement 0,382 kaki AD</td><td>Titik C (konservatif)</td></tr>
          <tr><td>Target 2</td><td>Retracement 0,618 kaki AD</td><td>Titik A</td></tr>
        </tbody>
      </table>
    </section>

    <!-- 05 Studi kasus -->
    <section v-else-if="s === 4" class="slide">
      <header class="sh"><span class="no">05</span><div><h3>Studi kasus: Bullish Gartley BTC/USDT, 24 Juli 2026</h3><p class="small muted">Digambar ulang dari rasio yang disebut artikel; chart aslinya dari TradingView.<sup>2</sup></p></div></header>
      <div class="dua">
        <svg :viewBox="`0 0 ${W} ${H}`" class="dg" role="img" aria-label="Diagram studi kasus Gartley">
          <rect v-if="tahapKasus >= 1" :x="dKasus.xD - 34" :width="68" :y="dKasus.fy(dKasus.prz[1]) - 6" :height="dKasus.fy(dKasus.prz[0]) - dKasus.fy(dKasus.prz[1]) + 12" class="przb on" />
          <path :d="garis(dKasus.pts.slice(0, tahapKasus >= 1 ? 5 : 3))" class="jalur" />
          <g v-for="p in dKasus.pts.slice(0, tahapKasus >= 1 ? 5 : 3)" :key="p.n" class="tt"><circle :cx="p.x" :cy="p.y" r="7" /><text :x="p.x" :y="p.puncak ? p.y - 14 : p.y + 24">{{ p.n }}</text></g>
          <text v-if="tahapKasus >= 0" :x="tengahGaris(dKasus.pts[1], dKasus.pts[2]).x + 8" :y="tengahGaris(dKasus.pts[1], dKasus.pts[2]).y" class="kl rasio">0,59 XA</text>
          <template v-if="tahapKasus >= 1">
            <text :x="tengahGaris(dKasus.pts[2], dKasus.pts[3]).x + 8" :y="tengahGaris(dKasus.pts[2], dKasus.pts[3]).y" class="kl rasio">0,845 AB</text>
            <text :x="tengahGaris(dKasus.pts[3], dKasus.pts[4]).x + 8" :y="tengahGaris(dKasus.pts[3], dKasus.pts[4]).y" class="kl rasio">1,385 × BC</text>
            <text :x="dKasus.xD + 40" :y="dKasus.fy(0.217) + 4" class="kl">PRZ · 0,783 XA</text>
          </template>
          <path v-if="tahapKasus >= 2" :d="`M${dKasus.xD},${dKasus.fy(0.217) - 14} l0,-40 m-7,9 l7,-9 l7,9`" class="panah" />
          <template v-if="tahapKasus >= 3">
            <line :x1="PAD" :x2="W - PAD" :y1="dKasus.fy(dKasus.stop)" :y2="dKasus.fy(dKasus.stop)" class="ln stop" /><text :x="W - PAD" :y="dKasus.fy(dKasus.stop) - 5" class="kl end">stop di bawah X</text>
            <template v-for="(t, i) in dKasus.t" :key="t"><line :x1="dKasus.xD - 60" :x2="W - PAD" :y1="dKasus.fy(t)" :y2="dKasus.fy(t)" class="ln tgt" /><text :x="W - PAD" :y="dKasus.fy(t) - 5" class="kl end">T{{ i + 1 }} {{ i ? '0,618' : '0,382' }} AD</text></template>
          </template>
        </svg>
        <div class="kartu pilih">
          <span class="ik">Tahap {{ tahapKasus + 1 }} dari 4 · {{ KASUS[tahapKasus][0] }}</span>
          <p>{{ KASUS[tahapKasus][1] }}<sup>2</sup></p>
          <div class="seg"><button type="button" class="pill sm" :disabled="tahapKasus === 0" @click="tahapKasus--">Sebelumnya</button>
            <button type="button" class="pill sm" :disabled="tahapKasus === 3" @click="tahapKasus++">Tahap berikutnya</button></div>
        </div>
      </div>
      <div v-if="contohBei" class="kartu lebar">
        <span class="ik">Dari screening hari ini</span>
        <p><b>{{ contohBei.t }}</b>{{ contohBei.nama ? ' · ' + contohBei.nama : '' }}: pola {{ (pola.find(p => p.k === contohBei.pola) || {}).nama }} {{ contohBei.arah }},
          status {{ HM_STATUS[contohBei.status][0].toLowerCase() }}, PRZ {{ przTeks(contohBei) }}.</p>
        <button type="button" class="pill sm" :aria-expanded="String(kasusBuka)" @click="kasusBuka = !kasusBuka">{{ kasusBuka ? 'Tutup analisa' : 'Bedah ' + contohBei.t + ' di sini' }}</button>
        <HarmonikAnalisa v-if="kasusBuka" :ticker="contohBei.t" :pola="contohBei.pola" />
      </div>
    </section>

    <!-- 06 Screening -->
    <section v-else-if="s === 5" class="slide">
      <header class="sh"><span class="no">06</span><div><h3>Screening harian saham BEI</h3>
        <p class="small muted">{{ data?.dinilai || 0 }} saham likuid dinilai{{ data?.updated ? ' · ' + data.updated + ' WIB' : '' }} · bar harian 1 tahun, tiga skala swing (6%, 10%, 15%) · toleransi rasio ±5%</p></div></header>
      <div class="seg">
        <button v-for="k in ['semua', 'prz', 'berbalik', 'menuju']" :key="k" type="button" class="pill sm" :aria-pressed="String(fStatus === k)" @click="fStatus = k">
          {{ k === 'semua' ? 'Semua' : HM_STATUS[k][0] }} <span class="muted">{{ n[k] }}</span></button>
        <span class="sep"></span>
        <button v-for="k in ['semua', 'bullish', 'bearish']" :key="'a' + k" type="button" class="pill sm" :aria-pressed="String(fArah === k)" @click="fArah = k">
          {{ k === 'semua' ? 'Dua arah' : k }}<span v-if="k !== 'semua'" class="muted"> {{ n[k] }}</span></button>
      </div>
      <p v-if="err" class="small c-strong">{{ err }}</p>
      <p v-else-if="!data" class="small muted">Memuat screening…</p>
      <p v-else-if="!tampil.length" class="small muted">{{ rows.length ? 'Tidak ada pola untuk saringan ini.' : 'Belum ada hasil screening. Dihitung server tiap malam setelah data Recovery diperbarui.' }}</p>
      <div v-else class="scroll">
        <table class="ledger">
          <thead><tr><th>Saham</th><th>Pola</th><th>Status</th><th class="num">Harga</th><th class="num">PRZ</th><th class="num">Jarak</th><th class="num">Stop</th><th class="num">Target 1 / 2</th><th>Konfirmasi</th></tr></thead>
          <tbody>
            <template v-for="r in tampil" :key="kunci(r)">
            <tr class="row" :class="{ open: terbuka === kunci(r) }" tabindex="0" :aria-expanded="String(terbuka === kunci(r))" @click="togel(r)" @keydown.enter="togel(r)">
              <td><span class="car">{{ terbuka === kunci(r) ? '▾' : '▸' }}</span><b>{{ r.t }}</b> <span v-if="r.radar" class="tag t-calm">radar</span><div class="small muted nm">{{ r.nama }}</div></td>
              <td><span class="tag" :class="r.arah === 'bullish' ? 't-good' : 't-strong'">{{ r.arah }}</span> {{ (pola.find(p => p.k === r.pola) || {}).nama || r.pola }}</td>
              <td><span class="tag" :class="HM_STATUS[r.status][1]">{{ HM_STATUS[r.status][0] }}</span></td>
              <td class="num">{{ rp(r.harga) }}</td>
              <td class="num">{{ przTeks(r) }}</td>
              <td class="num">{{ r.status === 'menuju' ? rp(r.jarak) + '%' : r.status === 'berbalik' ? (r.reaksi > 0 ? '+' : '') + rp(r.reaksi) + '%' : '–' }}</td>
              <td class="num">{{ rp(r.stop) }}</td>
              <td class="num">{{ rp(r.target?.[0]) }} / {{ rp(r.target?.[1]) }}</td>
              <td class="small">{{ r.konfirmasi?.length ? r.konfirmasi.join('; ') : (r.status === 'menuju' ? 'menunggu D' : 'belum ada') }}</td>
            </tr>
            <tr v-if="terbuka === kunci(r)" class="detail"><td colspan="9"><HarmonikAnalisa :ticker="r.t" :pola="r.pola" /></td></tr>
            </template>
          </tbody>
        </table>
      </div>
      <p class="small muted note">Jarak = sisa gerak harga ke tepi PRZ (menuju) atau reaksi harga dari D (berbalik). Klik baris untuk membuka chart dan analisa harmonik di bawahnya.</p>
    </section>

    <!-- 07 Analisa -->
    <section v-else-if="s === 6" class="slide">
      <header class="sh"><span class="no">07</span><div><h3>Analisa Harmonic Pattern per saham</h3>
        <p class="small muted">Cari saham BEI mana pun; chart dan analisa tampil di sini.</p></div></header>
      <div class="cari">
        <input v-model="q" type="search" class="inp" placeholder="Kode atau nama saham BEI, mis. CLEO" aria-label="Cari saham untuk analisa harmonik"
          @keydown.enter="saran[0] && analisaSaham(saran[0].t)" />
        <ul v-if="saran.length" class="saran"><li v-for="k in saran" :key="k.t"><button type="button" @click="analisaSaham(k.t)"><b>{{ k.t }}</b> <span class="muted">{{ k.nama }}</span></button></li></ul>
      </div>
      <div v-if="cepat.length" class="seg"><span class="small muted">Dari screening:</span>
        <button v-for="r in cepat" :key="kunci(r)" type="button" class="pill sm" :aria-pressed="String(sahamAktif?.t === r.t && sahamAktif?.pola === r.pola)" @click="analisaSaham(r.t, r.pola)">
          {{ r.t }} <span class="muted">{{ (pola.find(p => p.k === r.pola) || {}).nama }}</span></button></div>
      <HarmonikAnalisa v-if="sahamAktif" :key="sahamAktif.t" :ticker="sahamAktif.t" :pola="sahamAktif.pola" />
      <p v-else class="small muted">Ketik kode saham untuk memulai.</p>
    </section>

    <!-- 08 Bukti & sumber -->
    <section v-else class="slide">
      <header class="sh"><span class="no">08</span><div><h3>Kelebihan, keterbatasan, dan bukti</h3></div></header>
      <div class="dua2">
        <div class="kartu"><span class="ik c-good">Kelebihan</span><ul class="small">
          <li>Kerangka lebih objektif dibanding membaca bentuk chart secara visual.<sup>1</sup></li>
          <li>Berlaku di banyak instrumen dan time frame.<sup>1</sup></li>
          <li>Level batal, stop, dan target jelas sejak awal, sehingga risk-reward terukur.<sup>4</sup></li>
          <li>Menandai PRZ sebelum harga berbalik, bukan sesudahnya.<sup>4</sup></li></ul></div>
        <div class="kartu"><span class="ik c-strong">Keterbatasan</span><ul class="small">
          <li>Penentuan swing bisa subjektif bila belum terbiasa mengukur Fibonacci.<sup>1</sup></li>
          <li>Tidak semua pola menghasilkan pembalikan; sinyal palsu tetap terjadi.<sup>1</sup></li>
          <li>Pola jarang muncul sempurna; perlu latihan dan studi kasus.<sup>1, 2</sup></li>
          <li>Screening otomatis memakai harga penutupan harian dan toleransi ±5%; hasilnya titik awal analisa, bukan sinyal jadi.</li></ul></div>
      </div>
      <div class="kartu lebar">
        <span class="ik">Seberapa sering berhasil?</span>
        <ul class="small">
          <li>Gartley memperkenalkan pola ini di <i>Profits in the Stock Market</i> (1935, hlm. 222); Larry Pesavento kemudian menamainya "Gartley 222". Gartley disebut mengklaim pola ini benar sekitar 7 dari 10 kali. Itu klaim penulis, bukan uji independen.<sup>5</sup></li>
          <li>Scott Carney menulis seri <i>Harmonic Trading</i> yang membahas AB=CD, Bat, Gartley, Crab, Butterfly, dan perilaku harga di PRZ.<sup>6</sup></li>
          <li>Maxco menyebut win rate Gartley atau Bat 70–80% bila pola sempurna dan risiko dikelola ketat; artikel tidak menyertakan data atau penelitian sumbernya.<sup>3</sup></li>
          <li>Uji ulang independen pada kontrak berjangka ES 15 menit 2020–2024: Gartley 16 transaksi (menang 62,5%, profit factor 1,40), Bat 17 (PF 1,05), Butterfly 29 (58,6%, PF 1,37), Crab rugi (PF 0,43). Penulisnya menilai sampel kecil dan hasil Butterfly tidak konsisten di pasar lain (emas rugi).<sup>7</sup></li>
          <li>Belum ditemukan penelitian akademik yang ditelaah sejawat tentang pola harmonik di saham BEI.</li>
        </ul>
      </div>
      <ol class="sumber small">
        <li v-for="x in SUMBER" :key="x.k" :value="x.k"><a :href="x.url" target="_blank" rel="noopener">{{ x.teks }}</a></li>
      </ol>
      <p class="small muted note">Materi bersifat edukasi, bukan rekomendasi beli/jual. Setiap keputusan dan pengelolaan risiko menjadi tanggung jawab pembaca.</p>
    </section>

    <footer class="kaki-nav">
      <button type="button" class="pill sm" :disabled="s === 0" @click="ke(s - 1)">‹ Sebelumnya</button>
      <span class="small muted">{{ s + 1 }} / {{ SLIDE.length }} · panah kiri/kanan untuk berpindah</span>
      <button type="button" class="pill sm" :disabled="s === SLIDE.length - 1" @click="ke(s + 1)">Berikutnya ›</button>
    </footer>
  </div>
</template>

<style scoped>
.hm{border:1px solid var(--rule);background:var(--sheet);margin:10px 0 18px;outline:none}
.hm:focus-visible{box-shadow:0 0 0 2px var(--accent-soft)}
.nav{display:flex;flex-wrap:wrap;gap:2px;padding:8px 10px 0;border-bottom:1px solid var(--rule)}
.nv{background:none;border:0;border-bottom:2px solid transparent;padding:8px 10px;font:600 13px var(--f-body);color:var(--ink-2);cursor:pointer}
.nv .no{font:700 11px var(--f-data);color:var(--ink-2);margin-right:6px}
.nv.on{color:var(--ink);border-bottom-color:var(--accent)}.nv.on .no{color:var(--accent)}
.prog{height:3px;background:var(--rule-2)}.prog i{display:block;height:100%;background:var(--accent);transition:width .3s}
.slide{padding:18px 20px 8px;animation:muncul .35s ease}
@keyframes muncul{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.slide{animation:none}.prog i{transition:none}}
.sampul{background:var(--accent);color:var(--sheet);padding:28px 26px 22px;margin:-18px -20px 16px;position:relative;overflow:hidden}
.sampul::after{content:'';position:absolute;right:-60px;top:-80px;width:280px;height:280px;border-radius:50%;border:36px solid var(--sheet);opacity:.08}
.kick{font:700 11px var(--f-data);letter-spacing:.18em;opacity:.85}
.sampul h2{font:800 clamp(34px,6vw,56px)/1.05 var(--f-display);margin:8px 0 6px}
.sub{max-width:640px;opacity:.92;margin:0 0 18px}
.kpi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;max-width:640px}
.kpi b{display:block;font:800 clamp(22px,3.5vw,32px) var(--f-display)}.kpi span{font-size:11px;letter-spacing:.1em;text-transform:uppercase;opacity:.85}
.upd{display:block;margin-top:14px;opacity:.85}
.sh{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:10px}
.sh>.no{font:800 28px/1 var(--f-display);color:var(--accent)}
.sh h3{margin:0;font:800 20px var(--f-display)}.sh p{margin:2px 0 0}
.sh .seg{margin-left:auto}
.seg{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0}.sep{width:10px}
.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:12px 0}
.grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0}
.dua{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:14px;align-items:start}
.dua2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.kartu{border:1px solid var(--rule);border-top:3px solid var(--accent);background:var(--paper);padding:12px 14px}
.kartu.pilih{border-top-color:var(--now-ink)}.kartu.lebar{margin:10px 0}
.kartu p{margin:6px 0}.kartu ul{margin:6px 0;padding-left:18px}.kartu h4{margin:10px 0 4px;font:700 13px var(--f-display)}
.ik{display:block;font:700 11px var(--f-data);letter-spacing:.1em;text-transform:uppercase;color:var(--accent)}
.bn{display:block;font:800 18px var(--f-display);margin-top:4px}
.kutip{margin:8px 0 4px;padding:10px 16px;border-left:4px solid var(--accent);font:600 16px var(--f-display);color:var(--ink-2)}
sup{font-size:10px;color:var(--accent);margin-left:1px}
.note{margin:8px 0}
/* Diagram */
.dg{width:100%;height:auto;max-height:340px;background:var(--sheet);border:1px solid var(--rule)}
.jalur,.kaki{fill:none;stroke:var(--accent);stroke-width:3;stroke-linejoin:round}
.kaki{cursor:pointer;stroke-linecap:round}.kaki:hover,.kaki.on{stroke:var(--now-ink);stroke-width:6}
.bantu{stroke:var(--ink-2);stroke-dasharray:4 4;stroke-width:1.2;opacity:.7}
.przb{fill:var(--warn-bg);stroke:var(--warn);stroke-dasharray:3 3;cursor:pointer}.przb.on{fill:var(--warn-bg);stroke:var(--warn);stroke-width:2}
.tt{cursor:pointer}.tt circle{fill:var(--sheet);stroke:var(--accent);stroke-width:3}.tt text{font:700 17px var(--f-display);fill:var(--ink);text-anchor:middle}
.tt.on circle,.tt:hover circle{fill:var(--now-ink);stroke:var(--now-ink)}
.kl{font:600 14px var(--f-data);fill:var(--ink-2)}.kl.rasio{fill:var(--accent)}.kl.end{text-anchor:end}.kl.mid{text-anchor:middle}
.ln{stroke-width:1.5;stroke-dasharray:6 4}.ln.stop{stroke:var(--strong)}.ln.tgt{stroke:var(--good)}
.panah{fill:none;stroke:var(--good);stroke-width:3;stroke-linecap:round}
.kini{fill:var(--now-ink)}
/* Alur langkah */
.alur{list-style:none;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0;padding:0;margin:8px 0 10px;counter-reset:x}
.alur li{position:relative}
.alur li:not(:last-child)::after{content:'';position:absolute;top:22px;right:-6px;width:12px;height:12px;border-top:2px solid var(--rule-2);border-right:2px solid var(--rule-2);transform:rotate(45deg);z-index:1}
.alur button{width:100%;display:flex;flex-direction:column;align-items:center;gap:6px;background:none;border:0;padding:4px 10px;font:600 13px var(--f-body);color:var(--ink-2);cursor:pointer;text-align:center}
.bul{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;border:2px solid var(--accent);color:var(--accent);font:800 18px var(--f-display);background:var(--sheet)}
.alur li.on .bul{background:var(--accent);color:var(--sheet)}.alur li.on button{color:var(--ink)}
.cek{list-style:none;padding:0}.cek li{padding-left:20px;position:relative;margin:3px 0}
.cek li::before{position:absolute;left:0;font-weight:800}.cek li.ok::before{content:'✓';color:var(--good)}.cek li.no::before{content:'–';color:var(--ink-2)}
.scroll{overflow-x:auto}.row{cursor:pointer}.row:hover,.row.open{background:var(--zebra)}.nm{max-width:180px}
.car{display:inline-block;width:14px;color:var(--ink-2)}
.detail>td{background:var(--sheet);padding:4px 8px 14px}
.cari{position:relative;max-width:460px;margin:6px 0}
.inp{width:100%;padding:8px 10px;border:1px solid var(--rule);background:var(--sheet);font:14px var(--f-body);color:var(--ink)}
.saran{position:absolute;z-index:3;left:0;right:0;list-style:none;margin:2px 0 0;padding:0;background:var(--sheet);border:1px solid var(--rule)}
.saran button{width:100%;text-align:left;background:none;border:0;padding:6px 10px;cursor:pointer;font:13px var(--f-body);color:var(--ink)}
.saran button:hover{background:var(--zebra)}
.sumber{padding-left:20px;margin:10px 0}.sumber li{margin:3px 0}
.kaki-nav{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 20px 14px;border-top:1px solid var(--rule)}
@media (max-width:760px){
  .grid3,.dua,.dua2{grid-template-columns:1fr}.grid4,.kpi{grid-template-columns:repeat(2,minmax(0,1fr))}
  .alur{grid-template-columns:1fr}.alur li::after{display:none}.alur button{flex-direction:row}
}
</style>
