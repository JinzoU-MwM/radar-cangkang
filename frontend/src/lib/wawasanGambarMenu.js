// Perumpamaan dan gambar analogi per slide untuk topik menu Berita, Monitor, Kandidat, IHSG, Harmonic Pattern, dan
// Rekomendasi pada presentasi bergambar (dipakai lib/wawasanGambarSlide.js). Format sama dengan GAMBAR_SLIDE:
// { m: motif, teks: perumpamaan, a/b/c/d: label gambar }. Angka di perumpamaan adalah contoh rekaan. Data murni.

const G = (m, teks, label = {}) => ({ m, teks, ...label })

export const GAMBAR_MENU = {
  // Berita: sumber
  'berita-sumber-1': G('jebakan', 'Kabar "katanya" seperti umpan di perangkap: kelihatan menggiurkan, tetapi yang menggigit duluan yang terjepit.', { a: 'kabar tanpa dokumen' }),
  'berita-sumber-d0': G('palu', 'Keterbukaan informasi seperti surat resmi dari kelurahan: ada cap dan tanda tangan, jadi bisa dipegang. Permintaan penjelasan bursa seperti panggilan RT untuk menjelaskan keramaian.', { a: 'dokumen resmi' }),
  'berita-sumber-d2': G('lampu', 'Sumber berita seperti lampu lalu lintas: dokumen resmi hijau, media kuning, grup dan forum merah. Merah bukan berarti salah, tetapi berhenti dan cek dulu.', { a: 'grup dan forum', b: 'media', c: 'dokumen resmi' }),
  'berita-sumber-k': G('rambu', 'Membaca judul tanpa membuka isinya seperti membeli buku hanya dari sampulnya.', { a: 'buka dokumen aslinya' }),
  'berita-sumber-p': G('catatan', 'Seperti wartawan yang selalu menelusuri kabar sampai narasumber pertamanya.', { a: 'keterbukaan di IDX', b: 'permintaan penjelasan', c: 'asal berita' }),
  // Berita: sudah tercermin di harga
  'berita-harga-1': G('gunung', 'Datang ke pesta saat makanan sudah habis. Yang datang awal sudah kenyang dan bersiap pulang.', { a: 'berita keluar', b: 'yang datang telat' }),
  'berita-harga-d0': G('kalender', 'Seperti tiket konser: yang dapat bocoran jadwal membeli lebih dulu, harga calo sudah naik sebelum pengumuman resmi.', { a: 'harga naik', b: 'volume naik', c: 'berita resmi' }),
  'berita-harga-c': G('struk', 'Angka rekaan: naik dulu, berita keluar, lalu turun. Yang beli di hari berita langsung rugi.', { a: 'Rp100 ke Rp160', b: 'berita: Rp165', c: 'lalu Rp140' }),
  'berita-harga-k': G('rambu', 'Mengejar bus yang sudah jalan: tenaga habis, dan kalaupun terkejar, kursinya sudah penuh.', { a: 'jangan kejar di hari berita' }),
  'berita-harga-p': G('catatan', 'Seperti pemancing yang mencatat jam ikan paling sering makan umpan.', { a: 'buy the rumor', b: 'volume sebelum berita', c: 'reaksi 1, 5, 20 hari' }),
  // Monitor: tender offer
  'monitor-to-1': G('kaca', 'Pemilik baru kompleks perumahan wajib menawar rumah warga yang tersisa. Warga perlu tahu harga tawarannya sebelum buru-buru menjual ke orang lain.', { a: 'harga tender offer' }),
  'monitor-to-d0': G('palu', 'Aturannya seperti kewajiban pembeli tanah mayoritas untuk menawar juga tanah tetangga dengan harga yang adil, kecuali ada pengecualian tertentu.', { a: 'wajib menawar' }),
  'monitor-to-d2': G('toples', 'Kalau hampir semua kue dimakan satu orang, sebagian harus dikembalikan ke piring tamu. Saat dikembalikan, kue sering dijual murah.', { a: 'porsi publik kecil', b: 'wajib dilepas lagi' }),
  'monitor-to-k': G('rambu', 'Mengira tawaran pembeli rumah sebelah pasti jauh di atas harga pasaran.', { a: 'harga belum tentu tinggi' }),
  'monitor-to-p': G('catatan', 'Seperti membaca isi perjanjian jual beli sebelum menandatangani.', { a: 'siapa pengendali', b: 'harga dan jadwal', c: 'kewajiban lepas lagi' }),
  // Monitor: transaksi material
  'monitor-transaksi-1': G('peta', 'Backdoor seperti pindah rumah: ada surat pindah, ada penilai barang, ada rapat keluarga. Setiap tahap meninggalkan jejak.', { a: 'rencana', b: 'selesai' }),
  'monitor-transaksi-d0': G('timbangan', 'Transaksi material seperti membeli barang yang harganya hampir sama dengan seluruh tabungan keluarga: harus ditaksir orang luar dan disetujui keluarga. Kalau penjualnya saudara sendiri, yang memutuskan anggota keluarga lain.', { a: 'nilai transaksi', b: 'ekuitas', berat: 'a' }),
  'monitor-transaksi-d2': G('kalender', 'Seperti jadwal pernikahan yang ditempel di dinding: tahap demi tahap, dan setiap tahap ada undangannya.', { a: 'rencana', b: 'penilai', c: 'RUPS' }),
  'monitor-transaksi-k': G('rambu', 'Lupa bahwa keputusan harus disetujui anggota keluarga yang tidak ikut berkepentingan.', { a: 'pemegang saham independen' }),
  'monitor-transaksi-p': G('catatan', 'Seperti membaca rapor penilaian sebelum membeli rumah bekas.', { a: 'batas wajib RUPS', b: 'transaksi afiliasi', c: 'laporan penilai' }),
  // Monitor: menilai aset
  'monitor-aset-1': G('timbangan', 'Membayar harga mobil baru untuk mobil bekas biasa. Yang rugi pembelinya, bukan penjualnya.', { a: 'harga dibayar', b: 'nilai sebenarnya', berat: 'a' }),
  'monitor-aset-d0': G('kaca', 'Menaksir rumah bisa dengan tiga cara: dari uang sewanya, dari harga rumah sebelah, atau dari biaya membangun ulang. Cara uang sewa paling mudah dibuat terlalu optimis.', { a: 'tiga cara menaksir' }),
  'monitor-aset-c': G('struk', 'Rumah yang uang sewanya Rp20 juta setahun dijual Rp1 miliar: butuh 50 tahun balik modal, padahal rumah sejenis cukup 10 sampai 15 tahun.', { a: 'nilai Rp1 triliun', b: 'laba Rp20 miliar', c: 'PER 50 kali' }),
  'monitor-aset-k': G('rambu', 'Mengira rumah besar pasti murah tanpa melihat harga per meternya.', { a: 'besar belum tentu murah' }),
  'monitor-aset-p': G('catatan', 'Seperti belajar menawar di pasar: tahu harga wajar sebelum tawar-menawar.', { a: 'metode KJPP', b: 'PER, PBV, EV/EBITDA', c: 'tanda dibesar-besarkan' }),
  // Monitor: backdoor yang batal
  'monitor-gagal-1': G('kaca', 'Rapor yang hanya mencatat nilai bagus tidak memberi tahu pelajaran apa yang perlu diulang.', { a: 'yang batal tidak tercatat' }),
  'monitor-gagal-d0': G('toples', 'Kita mendengar cerita pemenang undian, bukan ribuan orang yang kalah. Base rate adalah jumlah seluruh kupon, bukan hanya yang menang.', { a: 'yang terdengar: menang', b: 'yang banyak: kalah' }),
  'monitor-gagal-k': G('jebakan', 'Penundaan acara tidak selalu berarti acaranya makin meriah. Sering justru tanda acaranya batal.', { a: 'penundaan dianggap baik' }),
  'monitor-gagal-p': G('catatan', 'Seperti dokter yang mencatat semua pasien, termasuk yang tidak sembuh.', { a: 'seberapa sering selesai', b: 'ciri yang batal', c: 'bias survivorship' }),
  // Kandidat: free float
  'kandidat-freefloat-1': G('ember', 'Kolam kecil cepat keruh kalau ada yang berenang. Saham dengan porsi publik kecil cepat bergerak, dan bisa ditutup pengelolanya.', { a: 'porsi publik kecil' }),
  'kandidat-freefloat-d0': G('palu', 'Seperti syarat jumlah anggota agar koperasi tetap diakui. Kalau kurang, koperasi diberi tanda peringatan dan bisa dibubarkan.', { a: 'syarat minimal publik' }),
  'kandidat-freefloat-d2': G('lampu', 'Papan Pemantauan Khusus seperti jalur khusus di gerbang tol untuk kendaraan yang perlu diperiksa: lewatnya bergiliran, tidak bisa ngebut.', { a: 'full call auction', b: 'dipantau', c: 'reguler' }),
  'kandidat-freefloat-k': G('rambu', 'Membeli obat tanpa membaca tanda di kemasannya.', { a: 'baca notasi khusus' }),
  'kandidat-freefloat-p': G('catatan', 'Seperti membaca label peringatan di bungkus rokok sebelum membeli.', { a: 'syarat free float', b: 'notasi khusus', c: 'pemantauan khusus' }),
  // Kandidat: likuiditas
  'kandidat-likuid-1': G('kaca', 'Harga di etalase belum tentu harga yang didapat saat menjual seratus barang sekaligus ke pasar yang sepi.', { a: 'harga di layar' }),
  'kandidat-likuid-d0': G('timbangan', 'Jangan bawa barang dagangan lebih banyak daripada jumlah pembeli harian di pasar itu. Spread seperti selisih harga beli dan jual di toko emas.', { a: 'posisi kita', b: 'transaksi harian', berat: 'a' }),
  'kandidat-likuid-c': G('struk', 'Membawa 100 kardus ke pasar yang biasanya hanya laku 200 kardus sehari: separuh pasar harus membeli dari kita.', { a: 'transaksi Rp200 juta', b: 'posisi Rp100 juta', c: 'separuh pasar' }),
  'kandidat-likuid-k': G('rambu', 'Satu hari pasar malam yang ramai bukan berarti setiap hari seramai itu.', { a: 'satu hari ramai' }),
  'kandidat-likuid-p': G('catatan', 'Seperti mengecek ramainya pembeli di pasar sebelum membuka lapak.', { a: 'nilai transaksi dan spread', b: 'order book', c: 'full call auction' }),
  // IHSG: makro
  'ihsg-makro-1': G('kalender', 'Kalender bilang Desember musim hujan, tetapi tetap lihat langit sebelum berangkat. Pola musiman menjawab "kapan", bukan "kenapa".', { a: 'pola musiman', b: 'cek makro', c: 'baru putuskan' }),
  'ihsg-makro-d0': G('termometer', 'Suku bunga seperti suhu ruangan: naik sedikit, semua orang mencari tempat yang lebih adem seperti deposito. Kurs seperti harga bensin bagi yang belanja bahan baku dari luar negeri.', { a: 'suku bunga dan kurs' }),
  'ihsg-makro-d2': G('roda', 'Komoditas seperti musim panen: batu bara, CPO, dan nikel bergiliran ramai, dan sektornya ikut bergerak.', { a: 'batu bara', b: 'CPO', c: 'nikel', d: 'emas' }),
  'ihsg-makro-k': G('rambu', 'Berangkat piknik hanya karena kalender bilang musim kemarau, tanpa melihat langit yang mendung.', { a: 'abaikan makro' }),
  'ihsg-makro-p': G('catatan', 'Seperti belajar membaca peta cuaca sebelum berlayar.', { a: 'suku bunga dan kurs', b: 'arus asing', c: 'komoditas' }),
  // IHSG: statistik
  'ihsg-statistik-1': G('toples', 'Mengambil 10 kelereng dari toples lalu menyimpulkan isi seluruh toples. Bisa saja kebetulan yang terambil banyak merahnya.', { a: '10 data saja', b: 'bisa kebetulan' }),
  'ihsg-statistik-d0': G('timbangan', 'Satu murid bernilai 100 di kelas yang lain bernilai 60 membuat rata-rata terlihat bagus. Median melihat murid di tengah. Overfitting seperti baju jahitan yang terlalu pas: dipakai setelah makan langsung sesak.', { a: 'rata-rata', b: 'median' }),
  'ihsg-statistik-d2': G('kaca', 'Kalau koin biasa memang keluar gambar separuh waktu, maka dapat 6 dari 10 belum istimewa.', { a: 'bandingkan dengan biasa' }),
  'ihsg-statistik-c': G('struk', 'Satu tahun luar biasa mengangkat rata-rata, padahal tahun-tahun lain biasa saja.', { a: 'rata-rata +3%', b: 'satu tahun +15%', c: 'median +1%' }),
  'ihsg-statistik-k': G('rambu', 'Membuat kunci jawaban dari soal yang sama dengan ujiannya: pasti lulus, tetapi tidak terbukti pintar.', { a: 'uji di data yang sama' }),
  'ihsg-statistik-p': G('catatan', 'Seperti belajar membaca survei: berapa orang yang ditanya, dan siapa saja.', { a: 'sampel dan median', b: 'overfitting', c: 'uji out-of-sample' }),
  // IHSG: cara indeks dihitung
  'ihsg-indeks-1': G('timbangan', 'Satu gajah di satu sisi timbangan bisa mengalahkan seratus kucing di sisi lain. Saham bank besar adalah gajahnya.', { a: 'beberapa saham besar', b: 'ratusan saham kecil', berat: 'a' }),
  'ihsg-indeks-d0': G('kaca', 'Market breadth seperti menghitung jumlah murid yang nilainya naik, bukan hanya melihat rata-rata kelas.', { a: 'berapa yang naik?' }),
  'ihsg-indeks-d2': G('toples', 'Saham HSC seperti kelereng yang dikeluarkan dari toples hitungan: bergerak seperti apa pun, tidak lagi memengaruhi angka di label.', { a: 'HSC dikeluarkan', b: 'tidak dihitung' }),
  'ihsg-indeks-k': G('rambu', 'Rata-rata kelas naik bukan berarti nilai kita ikut naik.', { a: 'IHSG naik belum tentu semua' }),
  'ihsg-indeks-p': G('catatan', 'Seperti tahu cara guru menghitung nilai rapor.', { a: 'bobot kapitalisasi', b: 'market breadth', c: 'dampak HSC' }),
  // IHSG: laporan keuangan lebih dalam
  'ihsg-lk-1': G('kaca', 'Bonus tahunan membuat gaji setahun terlihat besar, padahal gaji bulanannya tidak naik.', { a: 'laba sekali terjadi' }),
  'ihsg-lk-d0': G('timbangan', 'Kualitas laba seperti membandingkan slip gaji dengan uang yang masuk rekening. Uang dari menjual motor bukan gaji.', { a: 'laba', b: 'kas masuk', berat: 'a' }),
  'ihsg-lk-d2': G('timbangan', 'DER seperti membandingkan cicilan dengan tabungan sendiri. Wajar tidaknya tergantung pekerjaan: pengusaha properti memang biasa berutang lebih banyak.', { a: 'utang', b: 'modal sendiri' }),
  'ihsg-lk-c': G('struk', 'Gaji setahun Rp50 juta, tetapi Rp40 juta dari jual tanah warisan. Gaji sebenarnya hanya Rp10 juta.', { a: 'laba Rp50 miliar', b: 'jual tanah Rp40 miliar', c: 'inti Rp10 miliar' }),
  'ihsg-lk-k': G('jebakan', 'Mengira tetangga sudah sembuh dari kesulitan keuangan karena baru saja menjual mobilnya.', { a: 'berbalik laba dari jual aset' }),
  'ihsg-lk-p': G('catatan', 'Seperti membaca rekening koran, bukan hanya slip gaji.', { a: 'arus kas', b: 'DER dan bunga', c: 'pos luar biasa' }),
  // IHSG: broker
  'ihsg-broker-1': G('kaca', 'Satu kode broker seperti satu loket bank: yang antre ribuan nasabah dengan urusan masing-masing.', { a: 'satu kode, banyak orang' }),
  'ihsg-broker-d0': G('jebakan', 'Barang yang pindah lewat pintu belakang toko tidak terlihat di kasir depan. Pasar negosiasi dan crossing seperti pintu belakang itu.', { a: 'transaksi di luar layar' }),
  'ihsg-broker-d2': G('palu', 'Bukti paling kuat bukan siapa yang sering terlihat di toko, tetapi nama siapa yang tertulis di sertifikat. Data kepemilikan KSEI adalah sertifikatnya.', { a: 'data kepemilikan' }),
  'ihsg-broker-k': G('rambu', 'Menyimpulkan seseorang kaya dari satu kali melihatnya belanja banyak.', { a: 'satu hari tidak cukup' }),
  'ihsg-broker-p': G('catatan', 'Seperti detektif yang mencocokkan beberapa bukti sebelum menyimpulkan.', { a: 'reguler, nego, crossing', b: 'data KSEI', c: 'distribusi terselubung' }),
  // IHSG: Astronacci
  'ihsg-astro-1': G('kaca', 'Kita mengingat mimpi yang kebetulan jadi nyata dan melupakan ratusan mimpi yang tidak terjadi.', { a: 'yang cocok saja diingat' }),
  'ihsg-astro-d0': G('timbangan', 'Uji yang adil membandingkan ramalan dengan lempar koin di hari yang sama. Kalau sama saja, ramalan itu tidak menambah apa-apa.', { a: 'metode', b: 'tebakan acak' }),
  'ihsg-astro-k': G('rambu', 'Mencatat hanya tebakan yang benar di buku harian.', { a: 'catat yang gagal juga' }),
  'ihsg-astro-p': G('catatan', 'Seperti juri yang menilai dengan daftar nilai, bukan dengan kesan.', { a: 'bias konfirmasi', b: 'pembanding acak' }),
  // Harmonic: reaksi atau pembalikan
  'harmonic-reaksi-1': G('gunung', 'Pantulan bola belum tentu membawa bola naik ke atas meja. Bisa saja jatuh lagi.', { a: 'pantulan', b: 'kembali turun' }),
  'harmonic-reaksi-d0': G('tangga', 'Reaksi seperti naik beberapa anak tangga. Pembalikan berarti sampai di lantai berikutnya. Amankan sebagian hasil di anak tangga pertama.', { a: 'reaksi dulu', b: 'baru pembalikan' }),
  'harmonic-reaksi-c': G('struk', 'Contoh HRME: D di 71, PRZ 68–78, lalu turun ke 53. Itu baru pantulan; pembalikan penuh perlu bukti lanjutan.', { a: 'D di 71', b: 'PRZ 68–78', c: 'turun ke 53' }),
  'harmonic-reaksi-k': G('rambu', 'Menunggu bola memantul setinggi gedung, padahal pantulannya sudah habis.', { a: 'reaksi bisa habis' }),
  'harmonic-reaksi-p': G('catatan', 'Seperti pemain bola yang tahu kapan menembak dan kapan mengoper.', { a: 'zona konfirmasi', b: 'bagi posisi', c: 'kapan pola gagal' }),
  // Harmonic: kualitas swing
  'harmonic-swing-1': G('timbangan', 'Dua kaki yang panjangnya jauh berbeda membuat jalan pincang. Pola dengan kaki 5 bulan dan 2 minggu juga pincang.', { a: 'X ke A: 5 bulan', b: 'C ke D: 2 minggu', berat: 'a' }),
  'harmonic-swing-d0': G('kaca', 'Menancapkan paku harus tepat di ujung kayu, bukan di tengah. Titik pola juga harus di ujung sumbu candle.', { a: 'ujung sumbu' }),
  'harmonic-swing-d2': G('jamPasir', 'Kaki yang terlalu cepat biasanya didorong kejadian khusus, seperti orang yang tiba-tiba berlari karena dikejar anjing, bukan langkah biasa.', { a: 'terlalu cepat' }),
  'harmonic-swing-c': G('struk', 'Contoh KOTA: candlenya sudah benar, tetapi pakunya tidak tepat di ujung kayu.', { a: 'benar: 71-210-140-252-50', b: 'manual: 72-139-250-49' }),
  'harmonic-swing-k': G('rambu', 'Memasang paku di tengah papan, lalu heran kenapa bingkainya miring.', { a: 'titik di badan candle' }),
  'harmonic-swing-p': G('catatan', 'Seperti tukang kayu yang mengukur dua kali sebelum memotong.', { a: 'simetri waktu', b: 'swing utama', c: 'Strong magnet' }),
  // Harmonic: indikator
  'harmonic-indikator-1': G('peta', 'PRZ seperti alamat tujuan, bukan jam tiba. Indikator membantu menilai apakah kendaraannya mulai melambat.', { a: 'arah datang', b: 'PRZ' }),
  'harmonic-indikator-d0': G('termometer', 'Divergensi seperti suhu badan yang mulai turun walau batuknya masih terdengar: tanda sakitnya mulai reda.', { a: 'momentum melemah' }),
  'harmonic-indikator-k': G('rambu', 'Menunggu semua lampu hijau di sepanjang jalan sebelum berangkat. Tidak pernah berangkat.', { a: 'terlalu banyak indikator' }),
  'harmonic-indikator-p': G('catatan', 'Seperti dokter yang memakai satu-dua alat yang tepat, bukan semua alat sekaligus.', { a: 'divergensi RSI', b: 'RSI BAMM', c: 'secukupnya' }),
  // Harmonic: data harga
  'harmonic-data-1': G('kaca', 'Dua peta kota dari penerbit berbeda bisa menaruh titik sedikit bergeser. Pakai satu peta untuk satu perjalanan.', { a: 'beda platform' }),
  'harmonic-data-d0': G('tangga', 'Setelah stock split, harga lama dihitung ulang seperti tangga yang anak tangganya dibagi dua: tingginya sama, jumlahnya berubah.', { a: 'harga disesuaikan' }),
  'harmonic-data-k': G('rambu', 'Mengukur separuh meja dengan penggaris sentimeter dan separuh lagi dengan inci.', { a: 'satu sumber data' }),
  'harmonic-data-p': G('catatan', 'Seperti memeriksa timbangan sebelum menimbang barang.', { a: 'harga disesuaikan', b: 'TERP', c: 'cek OHLC' }),
  // Harmonic: statistik hasil
  'harmonic-statistik-1': G('kaca', 'Menemukan ratusan pola tanpa mencatat hasilnya seperti memancing tanpa pernah menghitung ikan yang didapat.', { a: 'hasil belum dicatat' }),
  'harmonic-statistik-d0': G('timbangan', 'Pedagang yang sering rugi kecil tetapi sesekali untung besar tetap bisa kaya. Yang ditimbang bukan seberapa sering menang, tetapi besar menang dibanding kalahnya.', { a: '8 untung x 2R', b: '12 rugi x 1R', berat: 'a' }),
  'harmonic-statistik-c': G('struk', 'Struk akhir bulan: 8 kali untung dua kali lipat, 12 kali rugi satu kali lipat, sisanya masih untung.', { a: '0,4 x 2 = 0,8', b: '0,6 x 1 = 0,6', c: 'hasil +0,2R' }),
  'harmonic-statistik-k': G('rambu', 'Menilai pedagang dari seberapa sering ia tersenyum, bukan dari isi lacinya.', { a: 'bukan winrate saja' }),
  'harmonic-statistik-p': G('catatan', 'Seperti pelatih yang mencatat statistik setiap pemain.', { a: 'expectancy per pola', b: 'R-multiple', c: 'jurnal transaksi' }),
  // Rekomendasi: risiko portofolio
  'rek-risiko-1': G('ember', 'Banyak ember yang diisi dari satu keran yang sama: kalau kerannya mati, semua ember kosong bersamaan.', { a: 'satu grup, satu nasib' }),
  'rek-risiko-d0': G('timbangan', 'Risiko per transaksi seperti jatah uang jajan harian. Total risiko seperti jatah bulanan: jangan habis dalam seminggu.', { a: 'per transaksi', b: 'total terbuka' }),
  'rek-risiko-d2': G('tangga', 'Turun 5 lantai cepat, naik lagi 10 lantai berat. Rugi 50% butuh naik 100% untuk kembali.', { a: 'turun 50%', b: 'naik 100%' }),
  'rek-risiko-c': G('struk', 'Hitungannya seperti membagi uang belanja per barang.', { a: 'risiko Rp1 juta', b: 'jarak stop Rp16', c: '625 lot' }),
  'rek-risiko-k': G('rambu', 'Menentukan berapa banyak membeli dari rasa yakin, bukan dari isi dompet.', { a: 'lot dari jarak stop' }),
  'rek-risiko-p': G('catatan', 'Seperti menyusun anggaran rumah tangga.', { a: 'risiko per transaksi', b: 'korelasi dan grup', c: 'drawdown' }),
  // Rekomendasi: mekanisme bursa
  'rek-bursa-1': G('peta', 'Rencana perjalanan di atas kertas bisa terhalang jalan tutup, lampu merah, atau jam buka gerbang tol.', { a: 'rencana', b: 'kenyataan' }),
  'rek-bursa-d0': G('jebakan', 'Stop seperti pintu darurat yang bisa macet saat semua orang berebut keluar. Suspensi seperti pintunya dikunci sementara.', { a: 'stop tidak dijamin' }),
  'rek-bursa-k': G('rambu', 'Mengira rem darurat selalu menghentikan mobil di titik yang kita mau.', { a: 'stop bukan jaminan' }),
  'rek-bursa-p': G('catatan', 'Seperti hafal jam buka-tutup jalan tol sebelum berangkat.', { a: 'fraksi dan auto rejection', b: 'sesi', c: 'suspensi' }),
  // Rekomendasi: evaluasi
  'rek-evaluasi-1': G('kaca', 'Tanpa catatan, kita tidak tahu resep mana yang sebenarnya disukai pembeli.', { a: 'sumber mana yang berguna?' }),
  'rek-evaluasi-d0': G('timbangan', 'Pemain yang menendang dengan teknik benar lalu ditepis kiper tetap pemain yang baik. Pisahkan keputusan dari hasilnya.', { a: 'keputusan', b: 'hasil' }),
  'rek-evaluasi-k': G('rambu', 'Ganti koki setelah dua piring tidak habis dimakan.', { a: 'data belum cukup' }),
  'rek-evaluasi-p': G('catatan', 'Seperti buku kas warung yang dicatat setiap hari.', { a: 'jurnal transaksi', b: 'per sumber sinyal', c: 'disiplin' }),
}
