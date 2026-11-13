// Materi "Menentukan Titik X-A-B-C-D" (tab Titik XABCD di halaman Harmonic Pattern): isi per bab sebagai blok data
// (paragraf, poin, langkah, tabel, kotak, gambar), dan pemeriksa titik yang menghitung rasio B, C, pola yang cocok,
// serta PRZ dari harga X, A, B, C dengan aturan yang sama dengan mesin pendeteksi (harmonikAlat.js).
// Angka rasio mengikuti Carney, Harmonic Trading (berkas terjemahan); nomor halaman = halaman berkas PDF.
import { POLA, TOL, bentukOk, przPola, rasioXabcd, skorPola } from './harmonikAlat.js'

export const RUJUKAN = 'Scott M. Carney, Harmonic Trading (berkas terjemahan): Bab 5 (Bat, rasio B ideal 0,50, halaman berkas 142); '
  + 'Bab 6 (Gartley, Gambar 6.16, halaman berkas 228); Bab 7 (Crab, pembahasan titik X sesudah Gambar 7.6, halaman berkas 257). '
  + 'Tabel rasio dan ambang zigzag: tab Materi, bagian Metodologi.'

export const BAB = [
  { id: 'dasar', judul: 'Dasar: swing, kaki, dan arah pola', blok: [
    { p: 'Kelima titik pola harmonik selalu berupa swing, yaitu puncak (swing high) atau lembah (swing low) yang jelas di grafik. Titik tidak pernah diambil di tengah gerakan. Garis dari satu swing ke swing berikutnya disebut kaki: XA, AB, BC, dan CD.' },
    { p: 'Karena puncak dan lembah selalu bergantian, jenis titik sudah pasti begitu arah pola diketahui:' },
    { tabel: { kolom: ['Arah pola', 'X', 'A', 'B', 'C', 'D', 'Bentuk'], baris: [
      ['Bullish (mencari titik beli di D)', 'lembah', 'puncak', 'lembah', 'puncak', 'lembah', 'huruf M'],
      ['Bearish (mencari titik jual di D)', 'puncak', 'lembah', 'puncak', 'lembah', 'puncak', 'huruf W'],
    ] } },
    { gambar: 'arah', ket: 'Urutan puncak dan lembah pada pola bullish dan bearish. Pola bearish adalah cermin pola bullish.' },
    { h: 'Swing mana yang dihitung?' },
    { p: 'Agar pemilihan titik tidak subjektif, swing kecil disaring dulu dengan zigzag: puncak baru diakui hanya bila harga kemudian turun minimal sekian persen darinya, dan lembah baru diakui bila harga kemudian naik minimal sekian persen. Gerak yang lebih kecil dari ambang itu diabaikan.' },
    { gambar: 'zigzag', ket: 'Zigzag menyaring gerak kecil. Hanya titik hitam yang boleh menjadi X, A, B, C, atau D. Titik terakhir (lingkaran kosong) masih bisa bergeser selama harga belum berbalik sebesar ambang.' },
    { kotak: { jenis: 'info', judul: 'Pegangan', teks: 'Pilih satu ukuran swing lalu pakai konsisten untuk kelima titik. Jangan mengambil X dari swing besar mingguan lalu B dari pantulan kecil harian. Ukuran kaki-kaki pola harus sebanding agar rasionya bermakna.' } },
  ] },
  { id: 'x', judul: 'Titik X: dari mana pola dimulai', blok: [
    { p: 'X adalah swing tempat kaki XA berawal. Pada pola bullish, X adalah lembah sebelum harga naik ke A. Pada pola bearish, X adalah puncak sebelum harga turun ke A.' },
    { h: 'Tiga syarat X yang sah' },
    { langkah: [
      ['X adalah swing yang jelas.', 'X harus berupa lembah (bullish) atau puncak (bearish) hasil zigzag, bukan harga di tengah tren.'],
      ['Kaki XA bersih.', 'Di antara X dan A tidak boleh ada harga yang melewati X. Pada pola bullish, tidak ada harga lebih rendah dari X sebelum sampai ke A. Kalau ada, lembah yang lebih rendah itulah calon X yang benar.'],
      ['Rasio sesudahnya cocok.', 'X baru benar-benar menjadi X bila B, C, dan D yang terbentuk sesudahnya jatuh di rasio sebuah pola baku. Swing yang memenuhi syarat 1 dan 2 tetapi rasionya tidak cocok hanyalah swing biasa.'],
    ] },
    { gambar: 'xBenar', ket: 'Lembah pertama bukan X karena sebelum sampai ke A harga turun lebih rendah. X yang benar adalah lembah terendah tepat sebelum kaki naik ke A.' },
    { h: 'X tidak harus titik tertinggi atau terendah sepanjang sejarah' },
    { p: 'Carney membahas hal ini saat menjelaskan pola Crab (Bab 7, sesudah Gambar 7.6, halaman berkas 257). X cukup menjadi ekstrem dari struktur pola itu sendiri. Harga bisa saja pernah jauh lebih rendah atau lebih tinggi bertahun-tahun sebelumnya. Yang menentukan adalah apakah kaki XA dan rasio-rasio sesudahnya membentuk pola yang sah.' },
    { h: 'Mencoba beberapa calon X' },
    { poin: [
      'Mulai dari swing terbaru: anggap swing-swing terakhir sebagai A, B, C (dan D bila sudah ada), lalu X adalah swing tepat sebelum A.',
      'Hitung rasio AB/XA. Bila tidak masuk rentang pola mana pun, geser: coba swing sebelumnya sebagai X dengan A yang sesuai.',
      'Pilih calon X yang menghasilkan rasio paling tepat ke angka baku, bukan yang paling enak dilihat.',
    ] },
    { kotak: { jenis: 'awas', judul: 'X juga batas batal (untuk sebagian pola)', teks: 'Pada Gartley dan Bat, D berada di dalam kaki XA (0,786 atau 0,886). Bila harga menembus X, pola gugur, sehingga X sekaligus menjadi patokan stop. Pada Butterfly, Crab, Deep Crab, dan Alternate Bat, D memang melewati X, sehingga batas batalnya diletakkan di sisi luar PRZ.' } },
  ] },
  { id: 'a', judul: 'Titik A: ujung kaki penggaris', blok: [
    { p: 'A adalah swing berikutnya sesudah X: puncak pada pola bullish, lembah pada pola bearish. Kaki XA adalah penggaris seluruh pola. Rasio B diukur dari XA, dan level D pada pola XABCD juga diukur dari XA. Kalau A salah pilih, semua rasio sesudahnya ikut salah.' },
    { poin: [
      'A adalah ekstrem kaki XA. Bila sesudah "A" harga masih naik lebih tinggi (bullish) sebelum turun membentuk B, puncak yang lebih tinggi itulah A.',
      'Kaki XA sebaiknya gerakan yang paling tegas dalam struktur itu. Kaki AB, BC, dan CD adalah reaksi terhadapnya.',
    ] },
  ] },
  { id: 'b', judul: 'Titik B: rasio pertama yang menentukan nama pola', blok: [
    { p: 'B adalah swing sesudah A. Ukur seberapa dalam B mengoreksi kaki XA:' },
    { rumus: 'rasio B = |A − B| ÷ |A − X|' },
    { p: 'Rasio inilah yang paling menentukan pola mana yang sedang terbentuk. Carney menekankan B sebagai pembeda utama, misalnya B Gartley di 0,618 (Bab 6, Gambar 6.16, halaman berkas 228) dan B Bat yang tidak melewati 0,618 dengan nilai ideal 0,50 (Bab 5, halaman berkas 142).' },
    { tabel: { kolom: ['Pola', 'Rasio B terhadap XA', 'Catatan'], baris: [
      ['Gartley', '0,618', 'Harus dekat 0,618. B jauh di atas atau di bawahnya berarti bukan Gartley.'],
      ['Bat', '0,382–0,50', 'Di bawah 0,618; nilai ideal 0,50.'],
      ['Alternate Bat', '0,382', 'B dangkal.'],
      ['Butterfly', '0,786', 'B dalam.'],
      ['Crab', '0,382–0,618', 'Yang ekstrem adalah D-nya (1,618 XA), bukan B-nya.'],
      ['Deep Crab', '0,886', 'B sangat dalam, tetapi tidak melewati X.'],
      ['Cypher', '0,382–0,618', 'C nanti melewati A.'],
      ['Shark', '0,382–0,886', 'C nanti melewati A.'],
      ['5-0', '1,13–1,618', 'B justru melewati X (titik awal pola ini sering ditulis 0).'],
    ] } },
    { kotak: { jenis: 'info', judul: 'Toleransi', teks: 'Harga jarang mendarat tepat di angka. Mesin Radar memberi kelonggaran ±5% dari rentang rasio. Contoh: B Gartley masih diterima di sekitar 0,59–0,65. Di luar itu, coba nama pola lain atau calon X lain.' } },
    { kotak: { jenis: 'awas', judul: 'B yang membatalkan', teks: 'Pada pola XABCD biasa (selain 5-0), B tidak boleh melewati X. Bila koreksi AB menembus X, struktur itu bukan pola-pola di atas. Biasanya titik yang tadinya disebut B malah menjadi calon X baru.' } },
  ] },
  { id: 'c', judul: 'Titik C: koreksi kaki AB', blok: [
    { p: 'C adalah swing sesudah B, kembali ke arah A. Ukur terhadap kaki AB:' },
    { rumus: 'rasio C = |C − B| ÷ |A − B|' },
    { poin: [
      'Untuk Gartley, Bat, Alternate Bat, Butterfly, Crab, dan Deep Crab, C berada di 0,382–0,886 kaki AB. C tidak melewati A.',
      'Pengecualian: pada Cypher C melewati A (1,272–1,414 XA), pada Shark C melewati A (1,13–1,618 AB), dan pada 5-0 C melewati A (1,618–2,24 AB).',
    ] },
    { p: 'Posisi C menentukan seberapa jauh kaki CD harus berjalan. C yang dangkal (0,382) membuat kaki BC pendek, sehingga proyeksinya ke D memakai pengali besar. C yang dalam (0,886) membuat kaki BC panjang dan pengalinya kecil. Pasangan ini disebut proyeksi BC resiprokal:' },
    { tabel: { kolom: ['Rasio C (koreksi AB)', 'Proyeksi BC yang sepadan untuk D'], baris: [
      ['0,382', '2,24–2,618'], ['0,50', '2,0'], ['0,618', '1,618'], ['0,707', '1,41'], ['0,786', '1,27'], ['0,886', '1,13'],
    ] } },
    { kotak: { jenis: 'info', judul: 'Sampai di sini, apakah sudah boleh disebut pola?', teks: 'Belum. Dengan X, A, B, C yang sah, statusnya baru calon pola yang sedang menuju D. Yang bisa dilakukan sekarang adalah menghitung zona D di depan dan menunggu harga datang ke sana.' } },
  ] },
  { id: 'd', judul: 'Titik D: Potential Reversal Zone (PRZ)', blok: [
    { p: 'D tidak dicari di grafik, tetapi dihitung lebih dulu. Beberapa ukuran dipakai sekaligus, dan tempat ukuran-ukuran itu berkumpul disebut PRZ, zona tempat harga berpeluang berbalik:' },
    { langkah: [
      ['Level D dari kaki XA,', 'misalnya 0,786 XA untuk Gartley atau 1,618 XA untuk Crab. Ini ukuran yang paling menentukan.'],
      ['Proyeksi BC:', 'panjang CD sebagai kelipatan kaki BC (pakai tabel resiprokal di bab C).'],
      ['AB = CD:', 'kaki CD sama panjang dengan AB, atau versi alternatifnya 1,27 / 1,618 kali AB.'],
    ] },
    { gambar: 'prz', ket: 'Tiga ukuran berbeda jatuh berdekatan. Zona tempat mereka bertemu adalah PRZ. Makin rapat garis-garisnya, makin kuat zonanya.' },
    { h: 'Ringkasan rasio D per pola' },
    { tabel: { kolom: ['Pola', 'Titik D', 'Proyeksi BC', 'Batas batal'], baris: [
      ['Gartley', '0,786 XA', '1,13–1,618', 'X'],
      ['Bat', '0,886 XA', '1,618–2,618', 'X'],
      ['Alternate Bat', '1,13 XA', '2,0–3,618', 'sisi luar PRZ'],
      ['Butterfly', '1,27–1,414 XA', '1,618–2,24', 'sisi luar PRZ'],
      ['Crab', '1,618 XA', '2,618–3,618', 'sisi luar PRZ'],
      ['Deep Crab', '1,618 XA', '2,24–3,618', 'sisi luar PRZ'],
      ['Cypher', '0,786 kaki XC', '–', 'X'],
      ['Shark', '0,886–1,13 kaki XC', '1,618–2,24', 'sisi luar PRZ'],
      ['5-0', 'retracement 0,50 kaki BC', '–', '0,618 kaki BC'],
    ] } },
    { h: 'D belum sah sebelum harga bereaksi' },
    { p: 'Sampainya harga di PRZ belum berarti D sudah terbentuk. D baru terkonfirmasi bila harga berbalik dari zona itu, misalnya lewat candle pembalikan, penutupan kembali ke dalam zona setelah sempat menembus, atau divergensi RSI. Bila harga menutup melewati batas batal, pola dianggap gagal dan D bukan di situ.' },
    { kotak: { jenis: 'ok', judul: 'Urutan berpikir yang benar', teks: 'X, A, B, C dipilih dari grafik. D dihitung, lalu ditunggu. Jangan membalik urutannya, misalnya mencari lembah yang sudah terjadi lalu menyebutnya D, kemudian memilih X yang membuat rasionya cocok.' } },
  ] },
  { id: 'checklist', judul: 'Urutan kerja di grafik (checklist)', blok: [
    { langkah: [
      ['Tentukan timeframe dan ukuran swing.', 'Pilih harian, mingguan, atau bulanan. Tandai swing yang jelas saja (zigzag), abaikan pantulan kecil.'],
      ['Tentukan arah yang dicari.', 'Mencari titik beli berarti pola bullish (X lembah). Mencari titik jual berarti pola bearish (X puncak).'],
      ['Mulai dari belakang.', 'Ambil swing terakhir yang sudah selesai sebagai C, lalu mundur: B, A, dan X.'],
      ['Cek kaki XA bersih.', 'Tidak ada harga di antara X dan A yang melewati X. A adalah ekstrem kaki itu.'],
      ['Hitung rasio B (AB/XA).', 'Cocokkan dengan tabel di bab B. Tidak cocok dengan pola mana pun? Kembali ke langkah 3 dan coba calon X lain.'],
      ['Hitung rasio C (BC/AB).', 'Harus 0,382–0,886 untuk pola biasa. Catat angkanya untuk memilih proyeksi BC.'],
      ['Hitung PRZ.', 'Level D dari XA, proyeksi BC, dan AB=CD. Bila ketiganya tidak saling berdekatan, pola itu lemah atau tidak ada.'],
      ['Tentukan batas batal.', 'X untuk Gartley dan Bat, sisi luar PRZ untuk pola yang D-nya melewati X.'],
      ['Tunggu harga masuk PRZ dan berbalik.', 'Baru sesudah itu D dianggap terbentuk.'],
      ['Hitung target dari kaki AD.', 'Target pertama umumnya 0,382 kaki AD, target kedua 0,618 AD (dihitung dari D ke arah A).'],
    ] },
    { h: 'Pola bearish: semua dibalik' },
    { p: 'Langkahnya sama. Hanya kata lembah dan puncak ditukar, dan "di bawah" menjadi "di atas". X adalah puncak, kaki XA turun, B memantul naik, C turun lagi, D naik ke PRZ di atas, lalu yang ditunggu adalah pembalikan turun.' },
  ] },
  { id: 'contoh', judul: 'Contoh hitungan: Gartley bullish', blok: [
    { p: 'Angka dibuat bulat agar mudah diikuti. Misalkan sebuah saham bergerak seperti ini:' },
    { tabel: { kolom: ['Titik', 'Harga', 'Cara mendapatkannya', 'Rasio'], baris: [
      ['X', '100', 'Lembah terendah sebelum kenaikan; tidak ada harga di bawah 100 sampai A', '–'],
      ['A', '200', 'Puncak kenaikan; kaki XA = 100', 'penggaris'],
      ['B', '138', 'Turun 62 dari A', '62 ÷ 100 = 0,62 (Gartley: 0,618)'],
      ['C', '176', 'Naik 38 dari B', '38 ÷ 62 = 0,61 (dalam 0,382–0,886)'],
      ['D', '± 121', 'Dihitung, belum terjadi', 'lihat PRZ di bawah'],
    ] } },
    { tabel: { kolom: ['Ukuran', 'Hitungan', 'Harga'], baris: [
      ['0,786 XA', '200 − 0,786 × 100', '121,4'],
      ['Proyeksi BC 1,618 (pasangan C = 0,618)', '176 − 1,618 × 38', '114,5'],
      ['Proyeksi BC 1,27', '176 − 1,27 × 38', '127,7'],
      ['AB = CD', '176 − 62', '114,0'],
    ] } },
    { p: 'Level XA (121,4) adalah patokan utama dan berada di dalam rentang proyeksi BC Gartley (1,13–1,618, yaitu 114,5–133,1). Jadi PRZ ditaruh di sekitar 118–124. Batas batal di X = 100. Target pertama 0,382 AD dari D: 121 + 0,382 × (200 − 121) ≈ 151.' },
    { gambar: 'contoh', ket: 'Contoh Gartley bullish. Garis putus-putus menghubungkan titik yang rasionya dihitung. D masih berupa zona yang ditunggu.' },
    { kotak: { jenis: 'info', judul: 'Kalau B ternyata 150, bukan 138?', teks: 'Rasio B menjadi 50 ÷ 100 = 0,50. Itu bukan Gartley, tetapi masuk rentang Bat (0,382–0,50). D lalu dihitung dengan aturan Bat, yaitu 0,886 XA = 200 − 88,6 = 111,4. Satu titik B yang berbeda mengubah nama pola dan letak PRZ. Coba sendiri di pemeriksa titik di bawah.' } },
  ] },
  { id: 'salah', judul: 'Kesalahan yang sering terjadi', blok: [
    { tabel: { kolom: ['Kesalahan', 'Akibat dan cara menghindari'], baris: [
      ['Memilih X dari lembah yang kemudian ditembus sebelum A', 'Kaki XA tidak sah. Pakai lembah terendah tepat sebelum kenaikan ke A.'],
      ['Mencampur ukuran swing (X dari swing besar, B dari pantulan kecil)', 'Rasio tidak bermakna. Pakai satu ambang zigzag untuk kelima titik.'],
      ['Memaksakan rasio ("0,70 kan dekat 0,618")', 'Di luar toleransi berarti pola lain atau bukan pola. Struktur yang mirip belum tentu pola yang sama.'],
      ['Menganggap D sudah terbentuk begitu harga menyentuh PRZ', 'Tunggu reaksi pembalikan. Harga bisa menembus PRZ dan membatalkan pola.'],
      ['Memilih X belakangan agar rasionya cocok dengan lembah yang sudah terjadi', 'Ini membalik urutan. X, A, B, C dulu; D dihitung lalu ditunggu.'],
      ['Hanya memakai satu ukuran untuk D', 'PRZ lemah. Cari pertemuan level XA, proyeksi BC, dan AB=CD.'],
      ['Lupa bahwa pola bisa bergeser', 'Swing terakhir yang belum selesai bisa berubah. Selama C atau D belum dikonfirmasi zigzag, pola masih bisa berganti.'],
    ] } },
  ] },
  { id: 'radar', judul: 'Cara halaman ini memilih titik', blok: [
    { p: 'Mesin pendeteksi di tab Saham dan Screening mengikuti urutan checklist di atas, hanya dilakukan otomatis:' },
    { poin: [
      'Swing dari zigzag dengan beberapa ambang sekaligus, agar pola kecil dan besar sama-sama terbaca.',
      'Lima swing terakhir diuji sebagai X, A, B, C, D. Rasio AB/XA, BC/AB, AD/XA, dan CD/BC dicocokkan dengan tabel pola, toleransi ±5% (proyeksi BC ±10%).',
      'PRZ adalah irisan rentang D dari kaki XA dan rentang proyeksi BC. Bila irisannya kosong, pola tidak dianggap ada.',
      'Di tab Saham, panel "Kenapa titik X di sini?" menuliskan harga dan tanggal X, besar gerak ke A, ambang zigzag yang dipakai, dan batas batal pola itu.',
      'Status pola (menuju PRZ, di PRZ, berbalik dari PRZ, batal) menunjukkan posisi harga terakhir terhadap PRZ.',
    ] },
    { tabel: { kolom: ['Timeframe', 'Ambang pembalikan zigzag'], baris: [
      ['Harian (1D)', '4%, 6%, 10%, 15%'], ['Mingguan (1W)', '8%, 12%, 18%, 25%'], ['Bulanan (1M)', '12%, 18%, 25%, 35%'],
    ] } },
    { kotak: { jenis: 'info', judul: 'Hasil mesin tetap perlu dicek mata', teks: 'Mesin hanya melihat angka. Pakai checklist di atas untuk memeriksa apakah X yang dipilih masuk akal di grafik, misalnya bukan lembah sesaat akibat aksi korporasi atau gap harga yang tidak wajar.' } },
  ] },
]

// ------------------------------------------------------------ pemeriksa titik ----
const BATAL_X = new Set(['gartley', 'bat', 'cypher'])
const r3 = v => Math.round(v * 1000) / 1000

// Rasio B dan C dari harga X, A, B, C, lalu pola XABCD yang cocok (urut skor, paling pas dulu) beserta PRZ dan
// batas batalnya. Hasil { galat } bila titik belum lengkap atau urutan puncak/lembah tidak berselang-seling.
export function periksaTitik({ x, a, b, c } = {}) {
  const v = [x, a, b, c].map(Number)
  if (v.some(n => !isFinite(n) || n <= 0)) return { galat: 'Isi harga X, A, B, dan C (angka lebih dari 0).' }
  const [X, A, B, C] = v
  if (X === A) return { galat: 'X dan A tidak boleh sama: kaki XA adalah penggaris pola.' }
  const bull = A > X
  if (bull ? !(B < A && C > B) : !(B > A && C < B))
    return { galat: bull ? 'Untuk pola bullish (A di atas X), B harus di bawah A dan C di atas B.' : 'Untuk pola bearish (A di bawah X), B harus di atas A dan C di bawah B.' }
  const r = rasioXabcd(X, A, B, C)
  const cocok = []
  for (const [k, p] of Object.entries(POLA)) {
    if (!bentukOk(k, X, A, B, C)) continue
    const skor = skorPola(k, r)
    if (skor == null) continue
    const prz = przPola(k, X, A, B, C)
    if (!prz || prz[1] <= 0) continue   // D di bawah nol (saham murah, pola ekstensi) tidak mungkin
    const batal = k === 'fiveo' ? C + (B - C) * 0.618 : BATAL_X.has(k) ? X : bull ? prz[0] : prz[1]
    cocok.push({ k, nama: p.nama, skor, prz: prz.map(r3), batal: r3(batal) })
  }
  cocok.sort((p, q) => p.skor - q.skor)
  return {
    arah: bull ? 'bullish' : 'bearish',
    rasio: { b: r.b, c: r.c, cx: r.cx },
    lewatX: bull ? B < X : B > X, lewatA: bull ? C > A : C < A,
    cocok, toleransi: TOL,
  }
}
