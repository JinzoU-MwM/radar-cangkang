// Versi bergambar presentasi Wawasan: setiap slide diberi gambar analogi diam (lib/wawasanMotif.js) dan satu
// kalimat perumpamaan, tanpa mengurangi penjelasannya. Kunci = id slide dari deckTopik / MARKET_MAKER.
// Topik menu lain ada di lib/wawasanGambarMenu.js. gambarUmum hanya cadangan bila ada slide baru yang belum diberi
// perumpamaan.
// Semua angka di perumpamaan adalah contoh rekaan. Data murni.
import { MARKET_MAKER, deckTopik } from './wawasanSlide.js'
import { GAMBAR_MENU } from './wawasanGambarMenu.js'

const G = (m, teks, label = {}) => ({ m, teks, ...label })

export const GAMBAR_SLIDE = {
  // Valuasi
  'dunia-valuasi-1': G('kaca', 'Bungkus kecil Rp5.000 bisa lebih mahal per gram daripada bungkus besar Rp50.000. Yang dibandingkan isinya, bukan label harganya.', { a: 'harga per gram' }),
  'dunia-valuasi-d0': G('jamPasir', 'PER seperti menghitung berapa tahun uang sewa yang dibutuhkan sampai rumah yang dibeli balik modal. PBV seperti membandingkan harga jual rumah dengan nilai tanah dan bangunannya.', { a: '20 tahun balik modal' }),
  'dunia-valuasi-d2': G('timbangan', 'Dua warung dengan modal sama. Warung yang untungnya lebih besar per rupiah modal wajar ditawar lebih mahal. EV/EBITDA seperti ikut menghitung utang warung saat menawar.', { a: 'untung 20%', b: 'untung 5%', berat: 'a' }),
  'dunia-valuasi-c': G('struk', 'Angkanya rekaan. Yang penting urutan hitungnya, seperti membaca struk belanja dari atas ke bawah.', { a: 'PER 20 kali', b: 'PBV 1,25 kali', c: 'ROE 6,25%' }),
  'dunia-valuasi-k': G('rambu', 'Harga sekilo daging dan sekilo beras sama-sama per kilo, tetapi barangnya beda. PER bank dan PER tambang juga tidak bisa dibandingkan langsung.', { a: 'beda jenis, beda ukuran' }),
  'dunia-valuasi-p': G('catatan', 'Seperti belajar membaca label gizi: sekali paham, semua kemasan bisa dibandingkan.', { a: 'PER dan PBV', b: 'ROE', c: 'EV/EBITDA' }),
  // Laporan keuangan
  'dunia-lk-1': G('kaca', 'Orang terlihat kaya dari mobilnya, padahal cicilannya menumpuk. Laba rugi itu mobilnya. Neraca dan arus kas memperlihatkan cicilan dan isi dompetnya.', { a: 'cicilan di balik mobil' }),
  'dunia-lk-d0': G('timbangan', 'Laba rugi seperti catatan dagang setahun. Neraca seperti timbangan pada satu hari: harta di satu sisi, utang dan modal di sisi lain, selalu seimbang.', { a: 'aset', b: 'utang + modal' }),
  'dunia-lk-d2': G('struk', 'Arus kas seperti mutasi rekening: uang dari usaha, untuk beli alat, dan dari pinjaman. Laporan kuartalan kumulatif seperti odometer mobil: yang dibaca selisihnya.', { a: 'operasi', b: 'investasi', c: 'pendanaan' }),
  'dunia-lk-c': G('struk', 'Odometer 9 bulan menunjukkan 120, odometer 6 bulan 100, jadi perjalanan kuartal ketiga hanya 20.', { a: '9 bulan: 120', b: '6 bulan: 100', c: 'kuartal 3: 20' }),
  'dunia-lk-k': G('rambu', 'Membaca odometer sebagai jarak hari ini membuat kita mengira mobil baru saja menempuh ribuan kilometer.', { a: 'angka kumulatif' }),
  'dunia-lk-p': G('catatan', 'Seperti membaca hasil cek darah: angkanya banyak, tetapi beberapa saja yang paling menentukan.', { a: 'margin', b: 'perputaran piutang', c: 'opini auditor' }),
  // Aksi korporasi
  'dunia-aksi-1': G('kaca', 'Aksi korporasi seperti renovasi rumah yang ditinggali bersama. Ada yang menambah kamar, ada yang menjual sebagian. Penghuni lama perlu tahu bagiannya berubah atau tidak.', { a: 'bagian saya berubah?' }),
  'dunia-aksi-d0': G('timbangan', 'Stock split seperti menukar selembar Rp100.000 dengan lima lembar Rp20.000: nilainya sama. Rights issue seperti ajakan ikut patungan; yang tidak ikut, bagiannya mengecil.', { a: '1 x Rp100.000', b: '5 x Rp20.000' }),
  'dunia-aksi-d2': G('rambu', 'Private placement seperti pemilik kos memasukkan penghuni baru tanpa bertanya ke penghuni lama. Buyback seperti pemilik membeli kembali kamar dari penghuninya.', { a: 'tanpa hak pemegang lama' }),
  'dunia-aksi-c': G('toples', 'Kopi Rp200 dicampur kopi Rp100 sama banyak, harga rata-rata satu toplesnya Rp150.', { a: '200 + 100', b: 'rata-rata 150' }),
  'dunia-aksi-k': G('rambu', 'Mengira uang berkurang karena selembar Rp100.000 ditukar jadi lima lembar Rp20.000.', { a: 'nilainya tetap' }),
  'dunia-aksi-p': G('kalender', 'Seperti jadwal arisan: telat sehari, giliran bisa hilang.', { a: 'cum', b: 'ex', c: 'batas HMETD' }),
  // Mekanisme BEI
  'dunia-mekanisme-1': G('lampu', 'Seperti aturan jalan tol: ada batas kecepatan, ada jam buka gerbang, ada lajur. Tanpa tahu aturannya, rencana perjalanan bisa gagal.', { a: 'auto rejection', b: 'sesi', c: 'fraksi' }),
  'dunia-mekanisme-d0': G('tangga', 'Fraksi seperti anak tangga yang tingginya beda di tiap gedung. Di gedung saham murah, satu anak tangga tinggi sekali dibanding badan kita.', { a: 'Rp60: 1,7%', b: 'Rp4.000: 0,25%' }),
  'dunia-mekanisme-d2': G('palu', 'Auto rejection seperti batas kecepatan harian. Call auction seperti lelang ikan: penawaran dikumpulkan dulu, lalu diputus di satu harga.', { a: 'satu harga lelang' }),
  'dunia-mekanisme-c': G('tangga', 'Turun delapan anak tangga di gedung bertangga tinggi jauh lebih terasa daripada di gedung bertangga rendah.', { a: '8 tick = 6,7%', b: '8 tick = 2%' }),
  'dunia-mekanisme-k': G('kalender', 'Uang hasil jual seperti paket kiriman: sudah dibayar, tetapi baru sampai dua hari kemudian.', { a: 'jual', b: 'T+1', c: 'T+2 dana masuk' }),
  'dunia-mekanisme-p': G('catatan', 'Seperti hafal rambu sebelum ujian SIM.', { a: 'fraksi', b: 'sesi dan order', c: 'reguler, nego, tunai' }),
  // Dividen
  'dunia-dividen-1': G('ember', 'Mengambil air dari ember ke gelas: gelasnya terisi, embernya berkurang. Kalau hanya melihat gelas, kita merasa dapat air gratis.', { a: 'harga turun saat ex' }),
  'dunia-dividen-d0': G('kalender', 'Tanggal cum seperti batas daftar arisan: yang terdaftar sampai hari itu ikut menerima. Yield tinggi seperti diskon besar: bisa menarik, bisa tanda barangnya bermasalah.', { a: 'cum', b: 'ex', c: 'bayar' }),
  'dunia-dividen-d2': G('toples', 'Payout di atas 100% seperti orang tua memberi uang jajan melebihi gajinya. Bisa sebentar dari tabungan, tidak bisa selamanya.', { a: 'tabungan', b: 'makin habis' }),
  'dunia-dividen-c': G('timbangan', 'Gelas terisi Rp20, ember turun dari Rp400 ke sekitar Rp380. Totalnya hampir sama.', { a: 'dividen Rp20', b: 'harga turun Rp20' }),
  'dunia-dividen-k': G('rambu', 'Datang ke arisan setelah pendaftaran ditutup, lalu berharap tetap dapat giliran.', { a: 'lewat tanggal cum' }),
  'dunia-dividen-p': G('catatan', 'Seperti memastikan warung langganan masih ramai sebelum menitip uang di sana.', { a: 'jadwal', b: 'yield', c: 'payout' }),
  // Pajak
  'dunia-pajak-1': G('ember', 'Ongkos kecil seperti bocor kecil di ember: sehari tidak terasa, sebulan airnya banyak hilang.', { a: 'pajak + komisi' }),
  'dunia-pajak-d0': G('struk', 'Seperti menghitung untung jualan online: harga jual dikurangi modal, ongkos kirim, dan biaya admin.', { a: 'pajak 0,1%', b: 'komisi beli', c: 'komisi jual' }),
  'dunia-pajak-c': G('struk', 'Struk penjualan Rp10 juta: dipotong pajak Rp10.000, belum termasuk komisi.', { a: 'jual Rp10 juta', b: 'PPh Rp10.000', c: '+ komisi' }),
  'dunia-pajak-k': G('rambu', 'Menargetkan untung Rp5.000 dari jualan yang ongkos kirimnya Rp7.000.', { a: 'untung habis di ongkos' }),
  'dunia-pajak-p': G('catatan', 'Seperti tahu tarif tol sebelum berangkat.', { a: 'PPh final', b: 'pajak dividen', c: 'komisi' }),
  // Siklus
  'dunia-siklus-1': G('roda', 'Pedagang buah yang pintar ganti dagangan mengikuti musim. Kios yang memaksa jual durian di luar musim sepi pembeli.', { a: 'pemulihan', b: 'ekspansi', c: 'puncak', d: 'perlambatan' }),
  'dunia-siklus-d0': G('termometer', 'Suku bunga seperti harga bensin bagi pengusaha angkot. Saat turun, yang paling senang yang paling banyak memakai.', { a: 'suku bunga' }),
  'dunia-siklus-d2': G('kalender', 'Kalender musim tetap dicocokkan dengan ramalan cuaca tahun ini.', { a: 'pola musiman', b: 'fase siklus', c: 'cocok?' }),
  'dunia-siklus-k': G('gunung', 'Membeli saat laba di puncak seperti mendaki tepat saat matahari mau terbenam: sisa jalannya turun.', { a: 'laba di puncak', b: 'sisanya turun' }),
  'dunia-siklus-p': G('catatan', 'Seperti petani yang belajar membaca musim sebelum menanam.', { a: 'fase siklus', b: 'siklikal vs defensif', c: 'suku bunga' }),
  // Psikologi
  'dunia-psikologi-1': G('rambu', 'Belanja saat lapar: rencana di kepala kalah oleh perut.', { a: 'keputusan emosional' }),
  'dunia-psikologi-d0': G('timbangan', 'FOMO seperti ikut antre panjang karena takut kehabisan, padahal belum tahu yang dijual apa. Loss aversion seperti timbangan yang sisi ruginya selalu lebih berat.', { a: 'rugi Rp1 juta', b: 'untung Rp1 juta', berat: 'a' }),
  'dunia-psikologi-d2': G('jebakan', 'Sunk cost seperti tetap menonton film jelek karena tiketnya sudah dibayar. Bias konfirmasi seperti hanya bertanya ke teman yang pasti setuju.', { a: 'sudah terlanjur' }),
  'dunia-psikologi-k': G('peta', 'Memindahkan stop seperti memundurkan garis finis setiap kali hampir kalah.', { a: 'stop awal', b: 'dipindah terus' }),
  'dunia-psikologi-p': G('catatan', 'Seperti atlet yang menonton ulang rekaman pertandingannya sendiri.', { a: 'jurnal transaksi', b: 'tinjauan berkala', c: 'aturan tertulis' }),
  // Gorengan
  'dunia-gorengan-1': G('gunung', 'Naik secepat roket, turun secepat batu jatuh. Yang terakhir naik paling sakit jatuhnya.', { a: 'naik tajam', b: 'turun sama tajam' }),
  'dunia-gorengan-d0': G('jebakan', 'Pump and dump seperti penjual yang menyewa orang pura-pura antre. Wash trade seperti dua orang saling jual-beli barang yang sama supaya terlihat laris.', { a: 'ramai semu' }),
  'dunia-gorengan-d2': G('lampu', 'UMA dan suspensi seperti lampu kuning dan merah: tanda berhati-hati dan berhenti, bukan aba-aba ngebut.', { a: 'suspensi', b: 'UMA', c: 'normal' }),
  'dunia-gorengan-k': G('rambu', 'Mengira peluit wasit sebagai tanda gol.', { a: 'UMA bukan sinyal beli' }),
  'dunia-gorengan-p': G('kaca', 'Seperti belajar mengenali uang palsu: dilihat, diraba, diterawang.', { a: 'cek keterbukaan' }),
  // Market maker: slide yang belum bergambar di deck utamanya
  'mm-judul': G('peta', 'Seperti belajar membaca langkah lawan sebelum main catur: kita tidak bisa mengatur lawan, tetapi bisa tidak terpancing.', { a: 'panik dan mengejar', b: 'rencana' }),
  'mm-jam': G('lampu', 'Seperti jam sibuk di jalan. Berangkat saat semua orang berangkat pasti macet; keputusan di jam ramai lebih sering keliru.', { a: 'pembukaan', b: 'pra-penutupan', c: 'tengah sesi' }),
  'mm-beli': G('tangga', 'Membeli bertahap seperti naik tangga satu per satu. Kalau satu anak tangga licin, kaki yang lain masih berpijak.', { a: 'beli bertahap' }),
  'mm-periksa': G('catatan', 'Pilot tetap membaca daftar periksa sebelum lepas landas walau sudah ribuan kali terbang.', { a: 'ada di rencana', b: 'bukan reaksi sesaat', c: 'rugi sudah diterima' }),
  // Slide market maker yang sudah bergambar grafik atau alat: hanya ditambah perumpamaan.
  'mm-akumulasi': G(null, 'Seperti pedagang yang memborong cabai diam-diam saat pasar sepi dan harganya murah, sebelum orang lain sadar harga akan naik.'),
  'mm-shakeout-grafik': G(null, 'Seperti orang yang terpeleset lalu langsung berdiri lagi. Yang dilihat adalah di mana ia berdiri sore harinya, bukan saat jatuh.'),
  'mm-distribusi': G(null, 'Seperti pedagang yang menghabiskan dagangan saat pasar malam paling ramai, lalu pulang sebelum pengunjung sadar barangnya kemahalan.'),
  'mm-orderbook': G(null, 'Seperti kursi kosong yang ditaruh di depan panggung supaya acara terlihat penuh. Begitu kursinya diangkat, penontonnya ternyata sedikit.'),
  'mm-jual': G(null, 'Semua orang menaruh kunci di bawah keset. Kunci kita sebaiknya disimpan sedikit lebih jauh.'),
  'mm-ukuran': G(null, 'Seperti menentukan uang yang dibawa ke pasar malam. Kalau kalah main, yang hilang hanya isi saku, bukan isi rekening.'),
  'mm-latih-1': G(null, 'Ingat pohon mangga yang digoyang: yang menjual karena kaget, barangnya dipungut murah.'),
  'mm-latih-2': G(null, 'Ingat pedagang di pasar malam yang paling ramai: ia sedang menghabiskan dagangannya.'),
  'mm-latih-3': G(null, 'Ingat antrean suruhan di warung: bisa pergi kapan saja.'),
  'mm-ingat': G('kompas','Saat bingung di tengah hutan, kompas mengembalikan kita ke arah yang sudah ditentukan. Rencana tertulis adalah kompasnya.', { a: 'rencana tertulis' }),
}

// Semua perumpamaan per slide: Dunia saham dan market maker (di atas) ditambah topik menu lain.
const SEMUA = { ...GAMBAR_SLIDE, ...GAMBAR_MENU }

// Gambar umum untuk slide yang belum punya perumpamaan khusus, menurut jenis slidenya (akhiran id).
const pendek = t => (t.length > 26 ? t.slice(0, 25).replace(/\s+\S*$/, '') + '…' : t)
export function gambarUmum(s, k) {
  const id = s.id.slice(k.id.length)
  if (id === '-1') return G('rambu', '', { a: 'kenapa ini penting' })
  if (id.startsWith('-d')) return G('kaca', '', { a: 'lihat lebih dekat' })
  if (id === '-c') return G('struk', '', { a: 'contoh hitungan', b: 'angka rekaan' })
  if (id === '-k') return G('jebakan', '', { a: 'jebakan yang sering kena' })
  if (id === '-p') return G('catatan', '', { a: pendek(k.pelajari[0] || ''), b: pendek(k.pelajari[1] || ''), c: pendek(k.pelajari[2] || '') })
  return null
}

// Deck bergambar: deck biasa ditambah motif dan perumpamaan per slide. Slide yang sudah punya gambar (adegan analogi
// atau grafik) dibiarkan.
export function deckBergambar(k, menu = '') {
  const deck = k.id === 'dunia-market-maker' ? MARKET_MAKER : deckTopik(k, menu)
  return deck.map(s => {
    if (s.gambar || s.alat) return SEMUA[s.id] ? { ...s, analogi: SEMUA[s.id].teks } : s
    const g = (SEMUA[s.id]?.m && SEMUA[s.id]) || gambarUmum(s, k)
    if (!g) return s
    const { teks, ...motif } = g
    return { ...s, motif, analogi: teks || s.analogi }
  })
}
