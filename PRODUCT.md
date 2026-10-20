# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Tim investasi kecil yang memburu saham "cangkang" di BEI: emiten yang sedang atau akan diambil alih pengendali baru (backdoor listing). Dibuka di laptop sepanjang jam bursa dan dicek berulang; beberapa anggota membuka dari perangkat lain lewat LAN/Tailscale.

## Product Purpose
Mengumpulkan sinyal backdoor listing di satu tempat (keterbukaan informasi BEI via Stockbit Reports, berita media, daftar tender offer, perubahan pengendali) lalu menilai mana yang layak dikejar. Sukses = tim melihat perkembangan baru lebih cepat dan memutuskan masuk/keluar dengan dasar yang tercatat.

## Positioning
Bukan screener umum: seluruh sudut pandangnya adalah siklus pengambilalihan (pengendali baru, MTO, RUPSLB, rights issue/PMTHMETD, injeksi aset), dengan story tiap emiten yang diverifikasi manual dari laporan.

## Operating Context
- Empat menu, urutan pentingnya: Potensi Emiten (skor + Analisa, Teknikal, Spekulasi) > Story Emiten > Progress Emiten > Update Emiten (berita).
- Server lokal PowerShell (`website/serve.ps1`) mem-proxy Stockbit dengan token pribadi; data radar per browser (localStorage).
- Ada versi kembar sebagai artifact Claude (`versi-claude/radar-cangkang.html`) dengan database bersama.

## Capabilities and Constraints
- Satu file `website/index.html` (HTML+CSS+JS inline), tanpa build step; harus tetap begitu.
- Harus tetap jalan offline sebagian (data page Stockbit tanpa token) dan memberi status token.
- Bahasa antarmuka: Indonesia.
- Tema terang & gelap sudah ada (toggle).

## Evidence on Hand
Data nyata: `story-verified.json`, `pengendali-verified.json`, `pandangan-analis.json`, `analisa.json`, daftar emiten di `stockbit.config.json`. Jangan mengarang emiten, angka, atau sinyal.

## Product Principles
1. Kecepatan baca saat jam bursa mengalahkan dekorasi: yang berubah hari ini harus terlihat pertama.
2. Setiap angka punya sumber dan tanggal.
3. Penilaian (skor, sinyal) dibedakan tegas dari fakta (laporan, harga).
4. Satu file, nol build, bisa dibuka siapa pun di jaringan tim.
