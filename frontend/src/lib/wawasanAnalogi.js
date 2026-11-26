// Perumpamaan sehari-hari untuk setiap topik tab Wawasan. Gambarnya ada di WawasanAnalogi.vue dengan kunci yang
// sama dengan id topik; tombol berisi label untuk gambar yang bisa dimainkan. Topik market maker memakai deck
// tulisan tangan (lib/wawasanSlide.js) dengan analoginya sendiri. Data murni.

export const ANALOGI = {
  'berita-sumber': {
    teks: 'Kabar tetangga mau pindah rumah paling pasti kalau ada surat dari RT. Kalau dengarnya dari tukang sayur, mungkin benar, mungkin tidak. Kalau cuma "katanya" di grup WhatsApp, anggap belum ada apa-apa.',
  },
  'berita-harga': {
    teks: 'Waktu promo diumumkan di televisi, raknya sudah kosong karena yang tahu duluan sudah memborong sejak kemarin. Yang datang setelah pengumuman hanya kebagian sisa.',
  },
  'monitor-to': {
    teks: 'Ada orang yang membeli hampir semua rumah di satu kompleks sampai ia yang mengatur kompleks itu. Aturannya, ia juga harus menawar rumah warga yang tersisa dengan harga yang adil, supaya warga kecil tidak ditinggal.',
    tombol: ['Sebelum diambil alih', 'Setelah diambil alih'],
  },
  'monitor-transaksi': {
    teks: 'Seperti urutan pernikahan: lamaran, tunangan, akad, lalu resepsi. Kalau tahapnya terus diundur tanpa kabar, kemungkinan batal makin besar.',
    tombol: ['Tahap berikutnya', 'Ulangi'],
  },
  'monitor-aset': {
    teks: 'Penjual mobil bekas pasti bilang mobilnya mahal. Pembeli yang teliti melihat kilometer, catatan servis, dan harga mobil sejenis di pasar sebelum percaya.',
  },
  'monitor-gagal': {
    teks: 'Koki yang mencatat resep gagal lebih cepat pintar daripada koki yang hanya mengingat masakan yang berhasil.',
  },
  'kandidat-freefloat': {
    teks: 'Kue yang hampir semuanya dipegang satu orang, sementara tamu lain berebut sepotong kecil. Sedikit saja ada yang mengambil, potongan itu langsung habis, dan pemilik kue bisa memutuskan acara selesai.',
  },
  'kandidat-likuid': {
    teks: 'Masuk bioskop bisa pelan-pelan satu per satu. Tapi kalau semua orang ingin keluar bersamaan lewat pintu yang kecil, yang paling belakang terjebak paling lama.',
    tombol: ['Semua ingin keluar', 'Ulangi'],
  },
  'ihsg-makro': {
    teks: 'Kalender bilang Desember biasanya musim hujan. Tetap saja, sebelum berangkat kita lihat langit dan ramalan cuaca hari itu. Pola musiman adalah kalender, data makro adalah cuaca hari ini.',
  },
  'ihsg-statistik': {
    teks: 'Lempar koin lima kali dan dapat empat kali gambar tidak membuktikan koinnya curang. Setelah dilempar seratus kali, hasilnya biasanya kembali mendekati separuh-separuh.',
    tombol: ['Lempar 100 kali', 'Kembali ke 5 kali'],
  },
  'ihsg-indeks': {
    teks: 'Nilai rata-rata satu kelas bisa naik hanya karena satu murid yang nilainya melonjak, padahal sebagian besar murid lain nilainya turun.',
  },
  'ihsg-lk': {
    teks: 'Slip gaji tertulis besar, tetapi kalau uangnya tidak pernah masuk rekening, belanja bulan ini tetap tidak bisa dibayar. Laba adalah slip gaji, arus kas adalah uang yang masuk rekening.',
  },
  'ihsg-broker': {
    teks: 'Satu kode broker seperti satu kasir supermarket. Antreannya panjang, tetapi yang membayar di sana ribuan orang dengan belanjaan masing-masing, bukan satu orang.',
  },
  'ihsg-astro': {
    teks: 'Boleh membaca ramalan, asal kita juga punya catatan berapa kali ramalan itu benar. Kalau tepatnya tidak jauh dari tebakan lempar koin, jangan dijadikan alasan utama.',
  },
  'harmonic-reaksi': {
    teks: 'Bola yang jatuh ke lantai memantul dulu. Dari pantulan pertama kita belum tahu bola itu akan naik tinggi atau jatuh lagi, jadi amankan sebagian hasil di pantulan itu.',
  },
  'harmonic-swing': {
    teks: 'Orang berjalan dengan langkah yang kira-kira sama panjang. Kalau satu langkah sangat pendek lalu langkah berikutnya sangat jauh, cara jalannya terlihat aneh. Pola harga juga begitu.',
    tombol: ['Lihat langkah yang timpang', 'Lihat langkah wajar'],
  },
  'harmonic-indikator': {
    teks: 'Mobil yang mau berhenti tidak langsung diam. Jarumnya turun dulu walau mobil masih bergerak maju. Divergensi RSI seperti jarum itu: harga masih turun, tetapi tenaganya mulai habis.',
  },
  'harmonic-data': {
    teks: 'Mengukur meja dengan penggaris sentimeter lalu menyambungnya dengan penggaris inci, hasilnya pasti kacau. Stock split mengubah skala harga, jadi grafiknya harus disesuaikan dulu.',
  },
  'harmonic-statistik': {
    teks: 'Penendang penalti yang mencatat setiap tendangannya akan tahu sudut mana yang paling sering masuk. Tanpa catatan, yang diingat hanya gol yang indah.',
  },
  'rek-risiko': {
    teks: 'Jangan taruh semua telur di satu keranjang. Kalau keranjang itu jatuh, semuanya pecah. Kalau dibagi ke beberapa keranjang, satu jatuh masih ada yang selamat.',
    tombol: ['Jatuhkan satu keranjang', 'Ulangi'],
  },
  'rek-bursa': {
    teks: 'Auto rejection seperti lift yang dalam sehari hanya boleh naik atau turun beberapa lantai. Kalau rencana kita butuh lift turun sepuluh lantai, rencana itu tidak bisa dijalankan dalam sehari.',
  },
  'rek-evaluasi': {
    teks: 'Rapor dipisah per pelajaran supaya ketahuan mana yang lemah. Kalau semua digabung jadi satu angka, kita tidak tahu harus belajar apa.',
  },
  'dunia-valuasi': {
    teks: 'Rumah Rp500 juta belum tentu lebih murah dari rumah Rp900 juta. Hitung harga per meter dulu. Saham juga begitu: bandingkan harganya dengan laba atau aset yang didapat.',
  },
  'dunia-lk': {
    teks: 'Laba rugi itu video kegiatan satu tahun. Neraca itu foto pada satu hari: apa yang dimiliki dan apa utangnya. Arus kas itu isi dompet: uang yang benar-benar ada.',
  },
  'dunia-aksi': {
    teks: 'Stock split seperti pizza yang dipotong jadi lebih banyak bagian, ukurannya tetap. Rights issue seperti pizza baru yang dibagi lagi: yang tidak ikut membayar, bagiannya mengecil.',
    tombol: ['Rights issue', 'Stock split'],
  },
  'dunia-mekanisme': {
    teks: 'Harga naik turun seperti tangga. Di saham murah, satu anak tangga tinggi sekali dibanding badannya, jadi turun satu anak tangga saja sudah terasa jauh.',
  },
  'dunia-dividen': {
    teks: 'Dividen seperti memindahkan air dari ember ke gelas. Gelasnya terisi, tetapi air di ember berkurang sama banyak. Harga saham turun kira-kira sebesar dividen di tanggal ex.',
    tombol: ['Masuk tanggal ex', 'Sebelum tanggal ex'],
  },
  'dunia-pajak': {
    teks: 'Setiap perjalanan bayar tol dan parkir. Sekali jalan terasa kecil, tetapi kalau bolak-balik setiap hari ongkosnya menumpuk. Komisi dan pajak transaksi juga begitu.',
  },
  'dunia-siklus': {
    teks: 'Buah punya musimnya sendiri: ada musim durian, ada musim rambutan. Sektor saham juga bergiliran ramai mengikuti keadaan ekonomi.',
    tombol: ['Fase berikutnya', 'Fase berikutnya'],
  },
  'dunia-psikologi': {
    teks: 'Kehilangan uang Rp1 juta terasa jauh lebih berat daripada senangnya mendapat Rp1 juta. Karena itu orang sering menahan saham yang rugi dan buru-buru menjual saham yang untung.',
  },
  'dunia-gorengan': {
    teks: 'Balon yang terus ditiup makin besar dan makin menarik dilihat, sampai akhirnya meletus. Yang rugi adalah yang memegang balon saat meletus.',
    tombol: ['Tiup lagi', 'Ulangi'],
  },
}

// Topik yang gambar analoginya sudah dibuat di WawasanAnalogi.vue (sisanya menyusul; sementara teks saja).
export const ADA = ['dunia-valuasi', 'dunia-lk', 'dunia-aksi', 'dunia-mekanisme', 'dunia-dividen', 'dunia-pajak', 'dunia-siklus', 'dunia-psikologi', 'dunia-gorengan']
