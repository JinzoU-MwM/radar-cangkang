// Versi ringkas untuk mode presentasi tab Materi (sekitar 20 slide + kuis): inti tiap bagian dari materi lengkap
// (harmonikMateri.js, 76 slide) yang tetap dipakai untuk dibaca dan diunduh PDF. Isi diringkas dari slide lengkap
// (ringkasan Carney, Harmonic Trading Vol. 1, dan metodologi halaman ini). Skema slide sama. Data murni.

export const RINGKAS = [
  {
    id: 'r-judul', bagian: 'Pendahuluan', judul: 'Harmonic Pattern pada Saham BEI',
    sub: 'Ringkasan Harmonic Trading Vol. 1 (Scott M. Carney) dan penerapannya di Radar Backdoor',
    tabel: { kolom: ['Bagian', 'Isi'], baris: [
      ['Landasan teori', 'Konsep harmonic trading, rasio Fibonacci, struktur XABCD, PRZ'],
      ['Pola', 'AB=CD, Gartley, Bat, Crab, Butterfly'],
      ['Eksekusi dan manajemen', 'Aksi harga di PRZ, target, stop, pola gagal'],
      ['Metodologi', 'Cara halaman ini mendeteksi pola otomatis'],
      ['Penerapan di BEI', 'Penyesuaian karakter saham Indonesia, kesimpulan'],
    ] },
  },
  {
    id: 'r-latar', bagian: 'Pendahuluan', judul: 'Latar belakang dan tujuan', sub: 'Dari harga yang tampak acak ke kerangka terukur',
    poin: [
      'Banyak keputusan beli dan jual saham diambil tanpa titik masuk, batas rugi, dan target yang jelas.',
      'Harmonic trading mengenali struktur harga tertentu lalu memvalidasinya dengan rasio Fibonacci, sehingga zona pembalikan, batas batal, dan target bisa dihitung di depan.',
      'Tujuan: memahami aturan pola menurut Carney, cara eksekusi dan manajemennya, serta penerapannya secara otomatis pada saham BEI.',
    ],
  },
  {
    id: 'r-konsep', bagian: 'Landasan Teori', judul: 'Tiga tahap harmonic trading', sub: 'Carney, Bab 1',
    tabel: { kolom: ['Tahap', 'Yang dikerjakan'], baris: [
      ['1. Identifikasi', 'Kenali pola dan cek rasio tiap titiknya'],
      ['2. Eksekusi', 'Nilai aksi harga di PRZ, lalu masuk atau lewati'],
      ['3. Manajemen', 'Kelola target, stop loss, dan trailing stop sampai posisi ditutup'],
    ] },
    poin: ['Semua parameter (entry, stop loss, target) ditetapkan sebelum masuk, bukan saat harga bergerak.'],
    rujukan: 'Carney, Bab 1',
  },
  {
    id: 'r-fibo', bagian: 'Landasan Teori', judul: 'Rasio Fibonacci yang dipakai', sub: 'Kekuatannya ada pada kombinasi, bukan satu angka',
    tabel: { kolom: ['Kelompok', 'Rasio'], baris: [
      ['Utama', '0,618 · 1,618'],
      ['Turunan primer', '0,786 · 0,886 · 1,13 · 1,27'],
      ['Pelengkap', '0,382 · 0,5 · 0,707 · 1,41 · 2,0 · 2,24 · 2,618 · 3,14 · 3,618'],
    ] },
    poin: ['0,886 menjadi penanda Bat, 1,27 penanda Butterfly, dan proyeksi besar (2,618 ke atas) khas Crab.'],
    alat: 'fib', rujukan: 'Carney, Bab 2',
  },
  {
    id: 'r-xabcd', bagian: 'Landasan Teori', judul: 'Struktur X-A-B-C-D dan PRZ', sub: 'Titik B menentukan pola, PRZ menentukan entry',
    poin: [
      'Lima titik, empat kaki (XA, AB, BC, CD). Titik B dibaca dulu, lalu titik D.',
      'PRZ (zona pembalikan potensial) adalah area tempat tiga angka Fibonacci atau lebih berkumpul: retracement XA, proyeksi BC, dan AB=CD.',
      'Makin banyak dan makin rapat angkanya, makin penting zonanya; kaki yang lebih besar (mingguan) lebih berbobot daripada harian.',
      'Rasio yang keluar rentang berarti bukan polanya; penyelarasan tidak boleh dilonggarkan.',
    ],
    pola: 'gartley', alat: 'xabcd', rujukan: 'Carney, Bab 3',
  },
  {
    id: 'r-abcd', bagian: 'Pembahasan Pola', judul: 'AB=CD: fondasi semua pola', sub: 'Dua kaki setara, C menentukan proyeksi BC',
    poin: [
      'Harga bergerak A ke B, menarik balik ke C (0,382–0,886 AB), lalu bergerak ke D sejauh AB.',
      'Varian: CD setara AB (minimum) atau 1,27 / 1,618 kali AB (alternatif).',
    ],
    tabel: { kolom: ['Titik C', 'Proyeksi BC pasangannya'], baris: [['0,382', '2,24–2,618'], ['0,5', '2,0'], ['0,618', '1,618'], ['0,786', '1,27'], ['0,886', '1,13']] },
    pola: 'abcd', alat: 'ext', rujukan: 'Carney, Bab 4',
  },
  {
    id: 'r-gartley', bagian: 'Pembahasan Pola', judul: 'Gartley', sub: 'Pola retracement klasik',
    tabel: { kolom: ['Titik', 'Syarat'], baris: [['B', 'Tepat 0,618 XA'], ['C', '0,382–0,886 AB'], ['Proyeksi BC', 'Maksimal 1,618'], ['AB=CD', 'Setara'], ['D', '0,786 XA; tidak melewati X']] },
    pola: 'gartley', alat: 'xabcd', rujukan: 'Carney, Bab 6',
  },
  {
    id: 'r-bat', bagian: 'Pembahasan Pola', judul: 'Bat', sub: 'Retracement dalam di 0,886',
    tabel: { kolom: ['Titik', 'Syarat'], baris: [['B', 'Di bawah 0,618 XA (ideal 0,5 atau 0,382)'], ['C', '0,382–0,886 AB'], ['Proyeksi BC', '1,618–2,618; 1,27 membatalkan Bat'], ['AB=CD', 'Biasanya alternatif 1,27'], ['D', '0,886 XA, angka terpenting']] },
    poin: ['Pembalikan cenderung cepat dan tajam, dengan stop loss relatif kecil.'],
    pola: 'bat', alat: 'xabcd', rujukan: 'Carney, Bab 5',
  },
  {
    id: 'r-crab', bagian: 'Pembahasan Pola', judul: 'Crab dan Deep Crab', sub: 'Ekstensi paling ekstrem di 1,618 XA',
    tabel: { kolom: ['Titik', 'Crab', 'Deep Crab'], baris: [['B', '0,618 XA atau kurang', '0,886 XA'], ['Proyeksi BC', '2,618–3,618 (3,14)', '2,24–3,618'], ['AB=CD', 'Alternatif 1,27 atau 1,618', 'Alternatif 1,27'], ['D', '1,618 XA', '1,618 XA']] },
    poin: ['Menandai kondisi jenuh ekstrem; pembalikan sering tajam, jadi disiplin stop loss sangat penting.'],
    pola: 'crab', alat: 'xabcd', rujukan: 'Carney, Bab 7',
  },
  {
    id: 'r-butterfly', bagian: 'Pembahasan Pola', judul: 'Butterfly', sub: 'Ekstensi 1,27 XA, sering di akhir tren',
    tabel: { kolom: ['Titik', 'Syarat'], baris: [['B', 'Tepat 0,786 XA'], ['C', '0,382–0,886 AB'], ['Proyeksi BC', 'Minimal 1,618, rapat dengan 1,27 XA'], ['AB=CD', 'Alternatif 1,27 paling umum'], ['D', '1,27 XA (bukan 1,618)']] },
    pola: 'butterfly', alat: 'xabcd', rujukan: 'Carney, Bab 8',
  },
  {
    id: 'r-beda', bagian: 'Pembahasan Pola', judul: 'Membedakan empat pola', sub: 'Lihat titik B dulu, lalu titik D',
    tabel: { kolom: ['Pola', 'Titik B', 'Titik D', 'Jenis', 'Batas batal'], baris: [
      ['Gartley', '0,618', '0,786 XA', 'Retracement', 'Titik X'],
      ['Bat', '< 0,618', '0,886 XA', 'Retracement', 'Titik X'],
      ['Butterfly', '0,786', '1,27 XA', 'Ekstensi', 'Luar PRZ'],
      ['Crab', '≤ 0,618', '1,618 XA', 'Ekstensi', 'Luar PRZ'],
    ] },
  },
  {
    id: 'r-eksekusi', bagian: 'Eksekusi dan Manajemen', judul: 'Eksekusi di PRZ', sub: 'Pola yang benar baru separuh pekerjaan',
    poin: [
      'Tunggu harga menguji seluruh angka di PRZ. Bar yang mengujinya (T-bar) menjadi acuan: pembalikan valid ditandai harga stabil lalu bergerak tegas berbalik.',
      'Tanda bahaya: gap yang melompati seluruh PRZ, ekspansi harga ekstrem menembus zona, atau harga hanya berkonsolidasi lalu melanjutkan tren lama.',
      'Tiga kemungkinan setelah entry: menembus PRZ (ambil rugi), reaksi kecil (amankan untung cepat), atau berbalik tegas (kelola posisi).',
    ],
    alat: 'xabcd', rujukan: 'Carney, Bab 9–10',
  },
  {
    id: 'r-manajemen', bagian: 'Eksekusi dan Manajemen', judul: 'Manajemen posisi', sub: 'Aturan keluar ditetapkan sebelum entry',
    tabel: { kolom: ['Istilah', 'Fungsi'], baris: [
      ['PRZ', 'Zona entry'],
      ['SLZ', 'Stop loss di luar PRZ; bila tertembus, pola tidak valid'],
      ['IPO', 'Target awal: retracement 0,382 atau 0,618 dari rentang pola'],
      ['PPZ', 'Lindungi untung: jangan biarkan untung berubah jadi rugi'],
      ['Trailing 0,382', 'Sisa posisi keluar bila harga menembus retracement 0,382 dari gerak pembalikan'],
    ] },
    poin: ['Bagi posisi: sebagian ditutup di IPO, sisanya berjalan dengan stop yang digeser.'],
    alat: 'long', rujukan: 'Carney, Bab 11',
  },
  {
    id: 'r-gagal', bagian: 'Eksekusi dan Manajemen', judul: 'Pola gagal', sub: 'Semua pola tidak sama, semua pembalikan tidak sama',
    poin: [
      'Bila harga menembus T-bar dan PRZ, pola gagal: tren dominan masih kuat.',
      'Kebanyakan pola hanya memberi reaksi singkat, bukan pembalikan besar.',
      'Support harmonik yang jebol sering berubah menjadi resistance, dan sebaliknya.',
    ],
    rujukan: 'Carney, Bab 12',
  },
  {
    id: 'r-metode', bagian: 'Metodologi', judul: 'Cara halaman ini mendeteksi pola', sub: 'Aturan yang sama untuk semua saham',
    poin: [
      'Data: candle Stockbit harian (1 tahun) dan mingguan (3 tahun); screening malam hanya saham dengan nilai transaksi minimal sekitar Rp1 miliar per hari.',
      'Swing dicari dengan zigzag (ambang 4–15% harian, 8–25% mingguan) supaya titik X sampai D objektif.',
      'Rasio dicocokkan dengan toleransi ±5% (proyeksi BC ±10%); PRZ = irisan rentang D dan proyeksi BC.',
      'Pola dinyatakan batal bila setelah D ada penutupan yang menembus batas batal.',
    ],
    alat: 'xabcd',
  },
  {
    id: 'r-saring', bagian: 'Metodologi', judul: 'Konfirmasi dan rencana posisi', sub: 'Memilah pola yang layak diambil',
    tabel: { kolom: ['Komponen', 'Aturan'], baris: [
      ['Konfirmasi di D', 'Candle pembalikan, divergence RSI, tembus struktur minor, volume ≥ 1,5x; minimal 2 dari 4'],
      ['Tren besar', 'Searah EMA200 lebih layak; melawan tren kecilkan posisi'],
      ['Entry dan stop', 'Entry di D; stop satu fraksi di balik X atau luar PRZ'],
      ['Target', '0,382 dan 0,618 kaki AD (Cypher: CD), lalu titik C'],
      ['Ambil atau lewati', 'Ambil bila R:R target 2 minimal 2'],
    ] },
    alat: 'long',
  },
  {
    id: 'r-bei', bagian: 'Penerapan di Saham BEI', judul: 'Penerapan di saham BEI', sub: 'Yang berbeda dari contoh di buku',
    poin: [
      'Utamakan candle harian dan mingguan; timeframe kecil penuh pola palsu karena gap antarhari.',
      'Pilih saham likuid dan bebas notasi khusus, UMA, atau risiko suspensi.',
      'Waspadai ARB/ARA dan gap pagi yang melompati PRZ; tunggu bar berikutnya.',
      'Pastikan swing tidak terpotong aksi korporasi (stock split, rights issue).',
      'Pola bearish bagi investor ritel adalah tanda jual atau menunda beli; short selling di BEI terbatas.',
    ],
  },
  {
    id: 'r-simpulan', bagian: 'Penutup', judul: 'Kesimpulan', sub: 'Inti yang perlu diingat',
    poin: [
      'Pola harmonik hanya sah bila rasio tiap titiknya sesuai aturan; titik B dan D adalah pembeda utama.',
      'Nilai pola ada di PRZ: tunggu zona diuji dan pembalikan terlihat, stop di luar PRZ, target 0,382 lalu 0,618.',
      'Di saham BEI aturan ini dijalankan otomatis dengan penyaring likuiditas, tren besar, konfirmasi di D, dan fraksi harga.',
      'Bahan belajar analisa teknikal, bukan saran membeli atau menjual efek.',
    ],
  },
]
