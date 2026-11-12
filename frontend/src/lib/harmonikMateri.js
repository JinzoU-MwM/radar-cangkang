// Materi presentasi tab "Materi" halaman Harmonic Pattern: ringkasan Scott M. Carney, Harmonic Trading Vol. 1
// (terjemahan Indonesia yang dilampirkan pengguna), ditulis ulang dengan kata sendiri dan difokuskan ke saham BEI.
// Tiap slide: judul, sub, poin, tabel { kolom, baris }, pola (diagram ideal dari POLA harmonikAlat, atau 'abcd'),
// alat (tombol "Coba di chart" membuka tab Saham dengan alat itu aktif), dan catatan kaki. Data murni.

export const SLIDE = [
  {
    id: 'pembuka', judul: 'Harmonic Trading untuk saham BEI', sub: 'Ringkasan Harmonic Trading Vol. 1 (Scott M. Carney), difokuskan untuk saham',
    poin: [
      'Harmonic trading mengenali struktur harga berulang, lalu memvalidasinya dengan rasio Fibonacci untuk mencari titik pembalikan berpeluang tinggi.',
      'Tiga tahap kerja: identifikasi pola dan rasionya, eksekusi di zona pembalikan, lalu manajemen posisi sampai ditutup.',
      'Semua parameter (entry, stop loss, target) ditetapkan sebelum masuk, bukan saat harga bergerak.',
    ],
    tabel: { kolom: ['Tahap', 'Yang dikerjakan', 'Di halaman ini'], baris: [
      ['1. Identifikasi', 'Kenali pola dan cek rasio titik demi titik', 'Tombol XABCD, Fib, Ext'],
      ['2. Eksekusi', 'Nilai aksi harga di PRZ, putuskan masuk atau lewati', 'Konfirmasi di D, panah skenario'],
      ['3. Manajemen', 'Target, stop loss, trailing stop', 'Long / Short position, ukuran lot'],
    ] },
  },
  {
    id: 'fibonacci', judul: 'Rasio Fibonacci yang dipakai', sub: 'Hanya rasio ini yang menentukan pola',
    poin: [
      'Deret Fibonacci: 0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89. Satu angka dibagi angka berikutnya mendekati 0,618; dibalik mendekati 1,618.',
      'Kekuatan analisa ada pada kombinasi beberapa rasio di satu area, bukan satu angka tunggal.',
    ],
    tabel: { kolom: ['Kelompok', 'Rasio', 'Keterangan'], baris: [
      ['Utama', '0,618 · 1,618', 'Langsung dari deret Fibonacci'],
      ['Turunan primer', '0,786 · 0,886 · 1,13 · 1,27', 'Akar dari rasio utama; 0,886 penanda Bat, 1,27 penanda Butterfly'],
      ['Pelengkap', '0,382 · 0,5 · 0,707 · 1,41 · 2,0 · 2,24 · 2,618 · 3,14 · 3,618', 'Membedakan struktur yang mirip; proyeksi besar khas Crab'],
    ] },
    alat: 'fib',
  },
  {
    id: 'xabcd', judul: 'Struktur X-A-B-C-D', sub: 'Lima titik, empat kaki: XA, AB, BC, CD',
    poin: [
      'Titik B paling menentukan: lihat B dulu, lalu D. Struktur yang mirip belum tentu pola yang sama (Bat dan Gartley sering tertukar).',
      'Penyelarasan rasio tiap pola tidak boleh dilonggarkan. Jika satu rasio keluar rentang, itu bukan polanya.',
      'Bullish: D berupa lembah, area beli potensial. Bearish: D berupa puncak, area jual potensial.',
      'Titik X = swing awal pola (lembah untuk bullish, puncak untuk bearish); kaki XA menjadi penggaris semua rasio.',
    ],
    pola: 'gartley', alat: 'xabcd',
  },
  {
    id: 'prz', judul: 'PRZ: zona pembalikan potensial', sub: 'Area tempat tiga angka Fibonacci atau lebih berkumpul',
    poin: [
      'Konvergensi: cari area tempat retracement XA, proyeksi BC, dan penyelesaian AB=CD bertemu.',
      'Makin banyak dan makin rapat angkanya, makin penting zonanya.',
      'Kaki harga lebih besar lebih signifikan: pola mingguan mengalahkan pola harian.',
      'PRZ adalah area, bukan satu harga. Lihat reaksi harga di dalam zona.',
    ],
    alat: 'xabcd',
  },
  {
    id: 'abcd', judul: 'AB=CD: fondasi semua pola', sub: 'Dua kaki setara dengan retracement di titik C',
    poin: [
      'Harga bergerak A ke B, menarik balik sebagian ke C, lalu bergerak ke D sejauh AB.',
      'C adalah retracement 0,382–0,886 dari AB. Makin dangkal C, makin jauh proyeksi BC.',
      'Varian: CD = AB (setara, syarat minimum), atau CD = 1,27 / 1,618 × AB (alternatif).',
    ],
    tabel: { kolom: ['Titik C (retracement AB)', 'Proyeksi BC pasangannya'], baris: [
      ['0,382', '2,618'], ['0,5', '2,0'], ['0,618', '1,618'], ['0,707', '1,41'], ['0,786', '1,27'], ['0,886', '1,13'],
    ] },
    pola: 'abcd', alat: 'ext',
  },
  {
    id: 'gartley', judul: 'Gartley', sub: 'Pola retracement klasik',
    poin: [
      'Titik B tepat 0,618 XA, syarat paling ketat dari semua pola.',
      'Titik D di 0,786 XA, bertemu AB=CD setara. Proyeksi BC tidak lebih dari 1,618.',
      'D tidak boleh melewati X. Bila harga menembus X, pola batal.',
    ],
    pola: 'gartley', alat: 'xabcd',
  },
  {
    id: 'bat', judul: 'Bat', sub: 'Retracement dalam di 0,886',
    poin: [
      'Titik B di bawah 0,618 XA, idealnya 0,5 atau 0,382. B tepat 0,5 hampir pasti Bat.',
      'Titik D di 0,886 XA, angka terpenting di PRZ. Proyeksi BC 1,618–2,618; proyeksi 1,27 membatalkan Bat.',
      'Pembalikannya cenderung cepat dan tajam, dengan stop loss relatif kecil.',
    ],
    pola: 'bat', alat: 'xabcd',
  },
  {
    id: 'gartleyBat', judul: 'Gartley atau Bat?', sub: 'Mulai dari titik B, lalu cek proyeksi BC dan titik D',
    tabel: { kolom: ['Elemen', 'Gartley', 'Bat'], baris: [
      ['Titik B', 'Tepat 0,618 XA', 'Di bawah 0,618 XA (0,382–0,5)'],
      ['Proyeksi BC', 'Maksimal 1,618', '1,618–2,618'],
      ['Titik D', '0,786 XA', '0,886 XA'],
      ['AB=CD', 'Setara', 'Setara minimum, sering 1,27'],
      ['Batas batal', 'Harga menembus X', 'Harga menembus X'],
    ] },
  },
  {
    id: 'butterfly', judul: 'Butterfly', sub: 'Pola ekstensi: D melewati X',
    poin: [
      'Titik B tepat 0,786 XA; penyelarasan ketat di B menyaring banyak struktur palsu.',
      'Titik D di 1,27 XA (bukan 1,618). Proyeksi BC minimal 1,618, biasanya 1,618–2,24.',
      'Sering muncul di harga tertinggi atau terendah baru, menandai akhir tren.',
    ],
    pola: 'butterfly', alat: 'xabcd',
  },
  {
    id: 'crab', judul: 'Crab dan Deep Crab', sub: 'Ekstensi paling ekstrem di 1,618 XA',
    poin: [
      'Crab: B 0,618 XA atau kurang, D di 1,618 XA, proyeksi BC ekstrem 2,618–3,618.',
      'Deep Crab: B dalam di 0,886 XA, D tetap 1,618 XA, proyeksi BC 2,24–3,618.',
      'Menandai kondisi jenuh ekstrem; pembalikannya sering tajam, jadi disiplin stop loss sangat penting.',
    ],
    pola: 'crab', alat: 'xabcd',
  },
  {
    id: 'retEks', judul: 'Retracement atau ekstensi?', sub: 'Menentukan di mana batas batal pola',
    tabel: { kolom: ['', 'Retracement (Gartley, Bat)', 'Ekstensi (Butterfly, Crab)'], baris: [
      ['Titik D', 'Di dalam kaki XA', 'Melewati X'],
      ['Batas batal', 'Titik X: jelas dan objektif', 'Sisi luar PRZ: lebih subjektif'],
      ['Risiko eksekusi', 'Lebih kecil', 'Lebih besar; gerak ke PRZ sering tajam'],
      ['Stop di halaman ini', 'Satu fraksi di balik X', 'Satu fraksi di luar PRZ'],
    ] },
  },
  {
    id: 'eksekusi', judul: 'Eksekusi di PRZ', sub: 'Pola yang benar baru separuh pekerjaan',
    poin: [
      'Tiga kemungkinan setelah entry: menembus PRZ (ambil rugi), reaksi kecil lalu tren lama berlanjut (amankan untung cepat), atau berbalik tegas.',
      'Terminal Price Bar (T-bar): bar yang menguji semua angka PRZ. Pembalikan valid ditandai harga stabil lalu bergerak jelas ke arah pembalikan.',
      'Tanda bahaya: gap yang melompati seluruh PRZ tanpa mengujinya, ekspansi harga ekstrem menembus zona, atau harga hanya berkonsolidasi di zona lalu melanjutkan tren lama.',
      'Tes awal PRZ sering terjadi cepat: siapkan daftar kandidat sebelumnya.',
    ],
    alat: 'xabcd',
  },
  {
    id: 'manajemen', judul: 'Manajemen posisi', sub: 'Aturan keluar ditetapkan sebelum entry',
    tabel: { kolom: ['Istilah', 'Fungsi'], baris: [
      ['PRZ', 'Zona entry, tempat proyeksi Fibonacci bertemu'],
      ['SLZ', 'Zona stop loss di luar PRZ; bila tertembus, pola tidak valid'],
      ['IPO', 'Target awal: retracement 0,382 atau 0,618 dari rentang pola (AD)'],
      ['PPZ', 'Zona perlindungan untung: jangan biarkan untung berubah jadi rugi'],
      ['Trailer 0,382', 'Setelah IPO, keluar bila harga menembus retracement 0,382 dari gerak pembalikan'],
    ] },
    poin: ['Bagi posisi: sebagian ditutup di target 1 (IPO), sisanya berjalan dengan stop digeser sampai ada sinyal keluar.'],
    alat: 'long',
  },
  {
    id: 'waktu', judul: 'Waktu dan garis tren', sub: 'Waktu penting, tetapi tidak sepenting harga',
    poin: [
      'Waktu setara: durasi X ke B diproyeksikan dari B untuk memperkirakan selesainya pola simetris.',
      'Rasio waktu alternatif 0,382–1,618. Pola yang selesai lebih cepat dari 0,382 waktu X ke B patut dicurigai.',
      'Pola bullish: garis tren dari puncak A ke C. Target 0,382 sering bertemu garis ini.',
      'Pembalikan valid biasanya curam dan tegas; bergerak menyamping adalah tanda awal kegagalan.',
    ],
  },
  {
    id: 'gagal', judul: 'Pola gagal', sub: 'Semua pola tidak sama, semua pembalikan tidak sama',
    poin: [
      'Bila harga menembus T-bar dan PRZ, pola gagal: tren dominan masih kuat.',
      'Kebanyakan pola hanya memberi reaksi singkat, bukan pembalikan besar.',
      'Support harmonik yang jebol sering berubah menjadi resistance, dan sebaliknya.',
      'Panah putus-putus di chart menunjukkan jalur bila pola gagal (stop tertembus).',
    ],
    alat: 'xabcd',
  },
  {
    id: 'saham', judul: 'Rekomendasi penerapan di saham BEI', sub: 'Yang perlu disesuaikan dari buku ke saham',
    poin: [
      'Utamakan candle harian dan mingguan. Saham hanya diperdagangkan di jam bursa dan sering gap antarhari, jadi timeframe kecil penuh pola palsu.',
      'Pilih saham likuid (nilai transaksi rata-rata minimal sekitar Rp1 miliar per hari); swing saham sepi tidak representatif.',
      'Waspadai ARB/ARA dan gap pagi yang melompati PRZ. Tunggu bar berikutnya sebelum memutuskan.',
      'Pastikan swing X sampai D tidak terpotong aksi korporasi (stock split, rights issue) yang mengubah harga historis.',
      'Pola bearish bagi investor ritel adalah tanda ambil untung atau menunda beli; short selling di BEI terbatas.',
      'Ambil hanya bila R:R target 2 minimal 2 dan ada minimal dua konfirmasi di D (candle pembalikan, divergence RSI, struktur minor, volume).',
      'Cek notasi khusus, UMA, dan suspensi; saham yang disuspensi tidak bisa dijual di stop loss.',
    ],
  },
  {
    id: 'periksa', judul: 'Daftar periksa sebelum masuk', sub: 'Centang satu per satu sebelum entry', periksa: true,
    poin: [
      'Ada pola, dan saya tahu namanya.',
      'Saya tahu di mana AB=CD selesai.',
      'Tiga angka Fibonacci atau lebih berkumpul di PRZ.',
      'Simetri waktu (X ke B) masuk akal.',
      'Tidak ada tanda bahaya: gap besar, ARB/ARA, ekspansi ekstrem.',
      'Batas batal pola (stop loss) sudah ditentukan.',
      'Risiko per transaksi dan jumlah lot sudah dihitung.',
      'Alasan masuk atau lewati sudah dicatat di jurnal.',
    ],
  },
  {
    id: 'belajar', judul: 'Rencana belajar 7 hari', sub: 'Centang hari yang sudah selesai', belajar: true,
    tabel: { kolom: ['Hari', 'Fokus', 'Latihan di halaman ini'], baris: [
      ['1', 'Konsep dan rasio Fibonacci (Bab 1–3)', 'Hafalkan tabel rasio; klik Fib di beberapa saham'],
      ['2', 'Pola AB=CD (Bab 4)', 'Klik Ext, cek level 1 dan 1,27 dekat PRZ'],
      ['3', 'Gartley dan Bat (Bab 5–6)', 'Cari Gartley/Bat di tab Screening, buka chartnya'],
      ['4', 'Butterfly dan Crab (Bab 7–8)', 'Bandingkan titik B dan D pada pola ekstensi'],
      ['5', 'Eksekusi dan PRZ (Bab 9–10)', 'Baca konfirmasi di D pada 5 saham'],
      ['6', 'Manajemen posisi dan pola gagal (Bab 11–12)', 'Klik Long/Short, hitung lot dan R:R'],
      ['7', 'Latihan terpadu dan jurnal', 'Unduh PDF analisa 10 saham, catat hasilnya'],
    ] },
  },
]

export const totalSlide = SLIDE.length + 1   // slide terakhir: kuis (dari harmonikBelajar.KUIS)

// Bentuk AB=CD ideal (C 0,618 AB, CD = AB) dalam kotak 0..1 untuk diagram slide.
export function diagramAbcd(arah = 'bullish') {
  const bull = arah === 'bullish'
  const v = { A: 1, B: 0.3, C: 0.3 + 0.618 * 0.7, D: 0.3 + 0.618 * 0.7 - 0.7 }
  const lo = Math.min(...Object.values(v)), hi = Math.max(...Object.values(v))
  // y 0 = atas: bullish (A puncak, D lembah terendah) dibalik dari nilai harga.
  const titik = ['A', 'B', 'C', 'D'].map((n, j) => { const t = (v[n] - lo) / (hi - lo); return { n, x: j / 3, y: bull ? 1 - t : t } })
  return { titik, garis: [{ a: titik[0], b: titik[2], teks: '0,382–0,886' }, { a: titik[1], b: titik[3], teks: '1,13–2,618' }], bull }
}
