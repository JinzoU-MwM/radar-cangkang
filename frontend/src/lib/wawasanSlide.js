// Presentasi per slide untuk topik tab Wawasan. Topik "Pola market maker" punya deck tulisan tangan dengan analogi
// bergambar, alat interaktif, dan latihan. Topik lain memakai deck yang disusun otomatis dari isi kartunya (alasan,
// wawasan, penjelasan, contoh, kesalahan umum). Skema slide mengikuti materi Harmonic (judul, sub, paragraf, poin,
// tabel, rujukan) ditambah: analogi (teks perumpamaan), gambar (kunci ilustrasi di WawasanGambar.vue), alat
// (orderbook | kalkulator), pilihan (latihan: situasi + opsi dengan satu jawaban paling tepat), periksa (daftar
// centang). Semua angka di skenario adalah contoh rekaan, bukan data emiten. Data murni.

export const MARKET_MAKER = [
  {
    id: 'mm-judul', bagian: 'Pengantar', judul: 'Membaca Pola Market Maker',
    sub: 'Supaya tidak ikut panik saat harga jatuh dan tidak ikut mengejar saat harga terbang',
    paragraf: ['Beli, lalu harga langsung turun. Jual karena takut, lalu harga naik lagi. Hampir semua trader ritel pernah mengalaminya, dan rasanya seperti ada yang mengintip posisi kita. Materi ini membahas kenapa hal itu sering terjadi dan kebiasaan apa yang membuat kita tidak mudah dipancing.'],
    tabel: { kolom: ['Bagian', 'Isi'], baris: [
      ['Pengantar', 'Kenapa terasa seperti dibaca'],
      ['Cara kerja pemain besar', 'Butuh lawan transaksi, akumulasi, shakeout, distribusi, antrean palsu, jam rawan'],
      ['Cara bertahan', 'Rencana sebelum pasar buka, cara beli, cara jual, ukuran posisi'],
      ['Latihan', 'Tiga situasi dan daftar periksa sebelum klik'],
    ] },
  },
  {
    id: 'mm-rasa', bagian: 'Pengantar', judul: 'Terasa seperti dibaca algoritma', sub: 'Yang bisa dibuktikan dan yang tidak',
    paragraf: ['Dari luar, kita tidak bisa membuktikan ada program yang khusus mengincar akun ritel. Yang jelas, order book, running trade, dan broker summary dilihat semua orang, termasuk pemain besar. Ditambah lagi, kebiasaan ritel itu mirip satu sama lain.'],
    poin: [
      'Ramai membeli setelah harga hijau beberapa menit berturut-turut.',
      'Memasang stop di tempat yang sama: persis di bawah support yang terlihat jelas.',
      'Antre beli di angka bulat, misalnya Rp100, Rp200, Rp500.',
      'Jual bersamaan saat harga dibuka turun di pagi hari.',
    ],
    analogi: 'Seperti menyimpan kunci rumah di bawah keset. Pencuri tidak perlu membaca pikiran kita. Cukup tahu bahwa kebanyakan orang menyimpan kunci di situ.',
    gambar: 'keset',
  },
  {
    id: 'mm-lawan', bagian: 'Cara kerja pemain besar', judul: 'Pemain besar butuh lawan transaksi', sub: 'Inti dari semua pola di materi ini',
    paragraf: ['Setiap transaksi butuh dua pihak. Pihak yang ingin menjual puluhan juta lembar harus menemukan banyak pembeli, dan pihak yang ingin membeli sebanyak itu harus menemukan banyak penjual.'],
    poin: [
      'Mau menjual banyak: paling mudah saat harga sedang naik dan sahamnya ramai dibicarakan, karena pembeli datang sendiri.',
      'Mau membeli banyak: paling mudah saat orang sedang takut dan ingin cepat keluar.',
      'Jadi saat kita paling bersemangat atau paling takut, sering itulah saat mereka bertransaksi dengan kita.',
    ],
    analogi: 'Pedagang yang membawa satu truk mangga tidak bisa menjual semuanya ke satu orang. Dia menunggu pasar ramai. Kalau pasar sepi dan dia memaksa jual, harganya harus dibanting.',
    gambar: 'grosir',
  },
  {
    id: 'mm-akumulasi', bagian: 'Cara kerja pemain besar', judul: 'Fase mengumpulkan barang (akumulasi)', sub: 'Biasanya sepi dan membosankan',
    poin: [
      'Harga bergerak datar atau turun pelan selama berminggu-minggu, beritanya sepi.',
      'Volume harian kecil, tetapi sesekali muncul transaksi besar di harga bawah.',
      'Di broker summary beberapa hari, broker yang banyak dipakai ritel cenderung jual, sementara beberapa broker lain terus membeli dengan harga rata-rata yang berdekatan.',
      'Menjelang akhir fase, support kadang sengaja dijebol sebentar. Itu yang dibahas di slide berikutnya.',
    ],
    gambar: 'akumulasi', rujukan: 'Metode Wyckoff: fase akumulasi',
  },
  {
    id: 'mm-shakeout', bagian: 'Cara kerja pemain besar', judul: 'Shakeout: pohonnya digoyang', sub: 'Harga dijatuhkan supaya pemegang yang ragu melepas barang',
    poin: [
      'Harga dijatuhkan cepat sampai menembus support, sering di menit-menit awal.',
      'Stop ritel di bawah support terpicu berantai, running trade merah semua.',
      'Barang yang dilepas dengan panik ditampung di harga murah.',
      'Harga kembali ke atas support, sering masih di hari yang sama.',
    ],
    analogi: 'Mangga yang tangkainya belum kuat akan jatuh saat pohonnya digoyang. Yang menggoyang tinggal memungut di bawah. Coba tekan tombolnya.',
    gambar: 'pohon', rujukan: 'Metode Wyckoff: spring',
  },
  {
    id: 'mm-shakeout-grafik', bagian: 'Cara kerja pemain besar', judul: 'Seperti apa shakeout di grafik', sub: 'Tembus sebentar, volume besar, lalu ditutup di atas support',
    paragraf: ['Yang membedakan shakeout dari harga yang memang jatuh adalah apa yang terjadi sesudahnya. Shakeout kembali ke atas support dengan cepat. Kalau harga ditutup di bawah support dan besoknya tetap di bawah, itu bukan shakeout lagi.'],
    poin: [
      'Perhatikan harga penutupan, bukan harga terendah di siang hari.',
      'Ekor bawah yang panjang di candle harian adalah jejak umum shakeout.',
      'Bandingkan dengan broker summary hari itu: siapa yang menjual, siapa yang menampung.',
    ],
    gambar: 'shakeout',
  },
  {
    id: 'mm-distribusi', bagian: 'Cara kerja pemain besar', judul: 'Fase membagikan barang (distribusi)', sub: 'Biasanya ramai dan menyenangkan',
    poin: [
      'Harga sudah naik jauh dan sahamnya ramai di grup dan media sosial.',
      'Antrean beli terlihat tebal, seolah semua orang ingin masuk.',
      'Volume sangat besar, tetapi harga tidak naik lagi.',
      'Ekor atas panjang: pagi dinaikkan, siang sampai sore dijual sedikit demi sedikit.',
      'Broker ritel menjadi pembeli terbesar, sedangkan broker yang dulu mengumpulkan sekarang menjual.',
    ],
    gambar: 'distribusi', rujukan: 'Metode Wyckoff: fase distribusi dan upthrust',
  },
  {
    id: 'mm-antrean', bagian: 'Cara kerja pemain besar', judul: 'Antrean bisa palsu', sub: 'Order bisa dibatalkan, transaksi tidak',
    poin: [
      'Antrean bid atau offer yang sangat tebal bisa ditarik kapan saja sebelum tersentuh harga.',
      'Order besar juga bisa disembunyikan dan dicicil sedikit demi sedikit, jadi yang terlihat di antrean hanya sebagian.',
      'Yang lebih bisa dipercaya adalah transaksi yang benar-benar terjadi.',
      'Membuat gambaran semu tentang perdagangan dilarang UU Pasar Modal, tetapi praktiknya tetap ada.',
    ],
    analogi: 'Warung baru menyuruh beberapa orang berdiri mengantre supaya terlihat laris. Begitu pembeli sungguhan ikut mengantre, orang-orang suruhan tadi pergi satu per satu.',
    gambar: 'antrean', rujukan: 'UU No. 8 Tahun 1995 tentang Pasar Modal',
  },
  {
    id: 'mm-orderbook', bagian: 'Cara kerja pemain besar', judul: 'Coba sendiri: antrean beli yang tiba-tiba hilang', sub: 'Order book rekaan',
    paragraf: ['Di order book ini ada antrean beli 80.000 lot di Rp150, jauh lebih tebal dari harga lain. Banyak orang merasa aman membeli tepat di atasnya. Tekan tombolnya untuk melihat apa yang bisa terjadi.'],
    alat: 'orderbook',
  },
  {
    id: 'mm-jam', bagian: 'Cara kerja pemain besar', judul: 'Jam-jam yang paling memancing', sub: 'Keputusan karena kaget paling sering diambil di sini',
    tabel: { kolom: ['Waktu', 'Yang sering terjadi', 'Sikap'], baris: [
      ['Pra-pembukaan dan menit awal', 'Harga dibuka loncat naik atau turun, lalu diayun cepat', 'Jangan langsung bereaksi. Tunggu harga lebih tenang.'],
      ['Tengah sesi', 'Pergerakan lebih wajar', 'Waktu yang lebih baik untuk menilai dan menjalankan rencana'],
      ['Pra-penutupan', 'Harga penutupan bisa digeser order besar di menit terakhir', 'Satu penutupan yang aneh belum tentu berarti. Lihat hari berikutnya.'],
    ] },
    rujukan: 'Jadwal sesi resmi di idx.co.id',
  },
  {
    id: 'mm-rencana', bagian: 'Cara bertahan', judul: 'Rencana dibuat sebelum pasar buka', sub: 'Pertahanan pertama dan paling murah',
    poin: [
      'Tulis harga beli, stop, target, jumlah lot, dan alasannya sebelum jam sembilan.',
      'Pasang order limit di harga itu, lalu biarkan harga yang datang.',
      'Kalau harga sudah lari jauh dari rencana, anggap kesempatan itu lewat. Saham lain masih banyak.',
      'Selama jam bursa, tugas kita menjalankan rencana, bukan membuat rencana baru.',
    ],
    analogi: 'Orang yang ke supermarket membawa daftar belanja jarang tergoda promo di tiap lorong. Yang datang tanpa daftar pulang membawa barang yang tidak dibutuhkan.',
    gambar: 'belanja',
  },
  {
    id: 'mm-beli', bagian: 'Cara bertahan', judul: 'Saat ingin membeli', sub: 'Biarkan harga yang datang ke kita',
    poin: [
      'Beli di area yang sudah dihitung: support, PRZ Harmonic, atau area akumulasi.',
      'Jangan HAKA setelah running trade hijau beruntun. Di situlah penjual besar paling senang.',
      'Bagi pembelian menjadi dua atau tiga bagian. Kalau ada shakeout, masih ada sisa untuk dipakai.',
      'Lihat broker summary beberapa hari, jangan hanya satu hari.',
    ],
  },
  {
    id: 'mm-jual', bagian: 'Cara bertahan', judul: 'Saat ingin menjual atau cut loss', sub: 'Stop jangan diletakkan di tempat semua orang',
    poin: [
      'Beri jarak beberapa fraksi di bawah support yang terlihat semua orang. Di saham murah, satu fraksi bisa lebih dari 1%.',
      'Kalau rencananya memakai candle harian, nilai stop dari harga penutupan, bukan harga terendah siang hari.',
      'Turun cepat di pagi hari lalu kembali ke atas support adalah ciri shakeout, bukan alasan ikut menjual.',
      'Kalau penutupan memang di bawah stop, jalankan. Rencana yang dilanggar sekali akan dilanggar lagi.',
    ],
    gambar: 'stop',
  },
  {
    id: 'mm-ukuran', bagian: 'Cara bertahan', judul: 'Ukuran posisi: rem yang paling bisa diandalkan', sub: 'Shakeout tidak menakutkan kalau ruginya sudah diterima sejak awal',
    paragraf: ['Orang panik saat ruginya lebih besar dari yang sanggup ditanggung. Tentukan dulu berapa rupiah yang rela hilang kalau stop kena, baru hitung jumlah lot. Coba geser angkanya.'],
    alat: 'kalkulator',
  },
  {
    id: 'mm-latih-1', bagian: 'Latihan', judul: 'Latihan 1: pagi yang merah', sub: 'Skenario rekaan',
    pilihan: {
      situasi: 'Saham bertahan di Rp200 selama dua minggu. Jam 09.10 harga jatuh ke Rp188 dan running trade merah semua. Rencana awal: keluar kalau harga penutupan di bawah Rp196. Apa yang dilakukan?',
      opsi: [
        { teks: 'Jual sekarang sebelum turun lebih dalam', alasan: 'Ini keputusan karena kaget. Rencananya memakai harga penutupan, dan pagi hari adalah jam favorit untuk shakeout.' },
        { teks: 'Tunggu harga penutupan sesuai rencana', benar: true, alasan: 'Tepat. Siang hari harga kembali ke Rp202 dan ditutup Rp205. Yang jual panik di Rp190 menyerahkan barangnya ke pembeli besar.' },
        { teks: 'Tambah beli sebanyak-banyaknya karena sudah murah', alasan: 'Menambah posisi tanpa rencana melipatgandakan risiko. Boleh menambah hanya kalau cicilan itu sudah ada di rencana dan stop tetap dipakai.' },
      ],
    },
    gambar: 'shakeout',
  },
  {
    id: 'mm-latih-2', bagian: 'Latihan', judul: 'Latihan 2: saham yang sedang ramai', sub: 'Skenario rekaan',
    pilihan: {
      situasi: 'Saham naik 60% dalam seminggu dan ramai di grup. Hari ini volumenya terbesar dalam sebulan. Pagi naik 8%, sore tinggal naik 1%. Di broker summary, broker ritel menjadi pembeli bersih terbesar. Apa yang dilakukan?',
      opsi: [
        { teks: 'Ikut beli besok pagi, volumenya besar berarti kuat', alasan: 'Volume besar tanpa kenaikan harga dan ekor atas panjang lebih sering menjadi tanda distribusi. Pembeli besarnya ritel, penjualnya siapa?' },
        { teks: 'Tidak masuk. Kalau sudah punya, amankan sebagian', benar: true, alasan: 'Tepat. Ciri distribusi terlihat: ramai, volume besar, harga tidak maju, dan barang berpindah ke ritel.' },
        { teks: 'Pasang antrean beli di bawah supaya dapat harga murah', alasan: 'Kalau ini distribusi, harga murah itu bisa jauh lebih murah lagi. Tunggu sampai polanya jelas.' },
      ],
    },
    gambar: 'distribusi',
  },
  {
    id: 'mm-latih-3', bagian: 'Latihan', judul: 'Latihan 3: antrean tebal', sub: 'Skenario rekaan',
    pilihan: {
      situasi: 'Ada antrean beli 80.000 lot di Rp150, jauh lebih tebal dari harga lain. Rasanya aman membeli di Rp151 karena ada yang menahan. Bagaimana sebaiknya?',
      opsi: [
        { teks: 'Aman, beli dan tidak perlu stop', alasan: 'Antrean bisa ditarik kapan saja. Kalau hilang, tidak ada lagi yang menahan, dan posisi tanpa stop paling sakit saat itu terjadi.' },
        { teks: 'Boleh beli kalau memang sesuai rencana, tetapi stop tetap ditentukan sendiri', benar: true, alasan: 'Tepat. Anggap antrean tebal sebagai niat yang bisa dibatalkan. Keputusan tetap bersandar pada rencana dan stop sendiri.' },
      ],
    },
    gambar: 'antrean',
  },
  {
    id: 'mm-periksa', bagian: 'Latihan', judul: 'Daftar periksa sebelum klik', sub: 'Centang semuanya sebelum menekan tombol beli atau jual',
    periksa: true,
    poin: [
      'Keputusan ini ada di rencana tertulis.',
      'Saya tidak sedang bereaksi pada pergerakan beberapa menit terakhir.',
      'Saya tahu siapa yang kemungkinan menjadi lawan transaksi saya sekarang.',
      'Saya sudah melihat broker summary beberapa hari, bukan satu hari.',
      'Saya tahu berapa rupiah ruginya kalau ternyata salah, dan saya rela.',
    ],
  },
  {
    id: 'mm-ingat', bagian: 'Latihan', judul: 'Yang perlu diingat', sub: 'Ringkasan',
    poin: [
      'Pemain besar butuh lawan transaksi. Saat kita paling semangat atau paling takut, mereka sering sedang bertransaksi dengan kita.',
      'Akumulasi itu sepi, distribusi itu ramai.',
      'Shakeout menembus support sebentar lalu ditutup kembali di atasnya.',
      'Antrean adalah niat yang bisa dibatalkan. Transaksi adalah fakta.',
      'Rencana dan ukuran posisi dibuat sebelum pasar buka.',
    ],
    rujukan: 'Tab Pola Broker di menu IHSG Radar · Richard D. Wyckoff, metode akumulasi dan distribusi',
  },
]

const DECK = { 'dunia-market-maker': MARKET_MAKER }

// Deck otomatis dari isi kartu topik: pembuka, wawasan baru, penjelasan (dua butir per slide), contoh, kesalahan
// umum, dan penutup berisi yang perlu dipelajari beserta sumbernya.
export function deckTopik(k, menu = '') {
  if (DECK[k.id]) return DECK[k.id]
  const s = [{ id: k.id + '-1', bagian: 'Pengantar', judul: k.judul, sub: menu ? `Wawasan · ${menu}` : 'Wawasan', paragraf: [k.kenapa] },
    { id: k.id + '-2', bagian: 'Pengantar', judul: 'Wawasan baru', paragraf: [k.wawasan] }]
  const d = k.detail || []
  for (let i = 0; i < d.length; i += 2) {
    s.push({ id: `${k.id}-d${i}`, bagian: 'Pembahasan', judul: d.length > 2 ? `Penjelasan (${i / 2 + 1}/${Math.ceil(d.length / 2)})` : 'Penjelasan', poin: d.slice(i, i + 2) })
  }
  if (k.contoh) s.push({ id: k.id + '-c', bagian: 'Pembahasan', judul: 'Contoh', paragraf: [k.contoh] })
  if (k.keliru?.length) s.push({ id: k.id + '-k', bagian: 'Pembahasan', judul: 'Kesalahan umum', poin: k.keliru })
  s.push({ id: k.id + '-p', bagian: 'Penutup', judul: 'Yang perlu dipelajari', poin: k.pelajari, rujukan: k.sumber.join(' · ') })
  return s
}

// Urutan bagian sesuai kemunculan pertama di deck (untuk ikhtisar dan bab PDF).
export const bagianDeck = deck => [...new Set(deck.map(s => s.bagian))]

// Butir yang muncul bertahap di satu slide (sama dengan butirSlide materi Harmonic). Slide latihan, daftar
// periksa, dan alat interaktif tampil utuh.
export function butirWawasan(s) {
  if (!s || s.periksa || s.pilihan || s.alat) return []
  return [...(s.paragraf || []).map((t, i) => ({ jenis: 'p', i })), ...(s.poin || []).map((t, i) => ({ jenis: 'li', i })),
    ...(s.tabel?.baris || []).map((t, i) => ({ jenis: 'tr', i }))]
}

// Kalkulator ukuran posisi: rugi maksimal (modal x risiko%) dibagi rugi per lembar (beli - stop), dibulatkan ke
// bawah per lot 100 lembar. Mengembalikan null bila stop tidak di bawah harga beli atau masukan tidak valid.
export function lotRisiko({ modal, risiko, beli, stop }) {
  const m = Number(modal), r = Number(risiko), b = Number(beli), s = Number(stop)
  if (!(m > 0 && r > 0 && b > 0 && s > 0 && s < b)) return null
  const rugiMaks = m * r / 100
  const lot = Math.min(Math.floor(rugiMaks / (b - s) / 100), Math.floor(m / b / 100))
  return { lot, rugiMaks, rugi: lot * 100 * (b - s), nilai: lot * 100 * b, persenStop: (b - s) / b * 100 }
}

// Langkah simulasi order book di slide antrean: harga turun mendekati antrean tebal, antrean ditarik, harga jatuh.
export const LANGKAH_OB = [
  { harga: 153, tebal: true, ket: 'Harga Rp153. Antrean 80.000 lot di Rp150 terlihat seperti tembok.' },
  { harga: 152, tebal: true, ket: 'Harga turun ke Rp152. Banyak yang membeli karena merasa ada yang menahan di bawah.' },
  { harga: 151, tebal: true, ket: 'Harga Rp151, tinggal satu fraksi lagi ke antrean tebal.' },
  { harga: 151, tebal: false, ket: 'Antrean 80.000 lot ditarik sebelum tersentuh. Tidak ada satu lot pun yang ditransaksikan di sana.' },
  { harga: 146, tebal: false, ket: 'Tanpa penahan, harga jatuh ke Rp146. Yang membeli di Rp151-152 tanpa stop kini rugi lebih dari 3%.' },
]
