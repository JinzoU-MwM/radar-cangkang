# Radar Backdoor

Pemantauan emiten BEI calon backdoor listing (pengambilalihan & perubahan pengendalian). Pemakaian pribadi.

## Struktur folder

```
radar-cangkang/
├── Jalankan-Radar.bat           Windows: server lokal + buka browser (hanya komputer ini)
├── Jalankan-Radar-LAN.bat       Windows: bisa dibuka perangkat lain di jaringan yang sama (pakai kunci)
├── Izinkan-LAN.bat / Cabut-LAN.bat   Windows (Run as administrator): izin/cabut port 8765 + firewall
├── jalankan-radar.sh            Linux: jalankan server (PowerShell 7 / pwsh)
├── test-cache.ps1               Tes cache SQLite
├── DESIGN.md / PRODUCT.md       Catatan desain & produk
├── README.md
├── .gitignore                   Mencegah token, kunci, dan cache ikut terunggah
├── website/                     Website mandiri (tanpa Claude)
│   ├── index.html               Halaman utama
│   ├── serve.ps1                Server lokal + proxy Stockbit (port 8765)
│   ├── stockbit.config.json     URL endpoint & pemetaan field Stockbit
│   ├── story-verified.json      Story emiten terverifikasi
│   ├── pengendali-verified.json Profil pengendali baru
│   ├── pandangan-analis.json    Pandangan analis per emiten
│   ├── analisa.json             Catatan analis
│   ├── aset-verified.json       Aset injeksi, transaksi & status KJPP per emiten
│   ├── profil-pengendali.json   Profil pengendali per orang, pengurus & afiliasi pihak lawan
│   ├── hsc.json                 Daftar saham HSC BEI
│   ├── changelog.json           Catatan panel "Pembaruan Website"
│   ├── .stockbit-token          token Bearer Stockbit, JANGAN dibagikan
│   └── .lan-key                 kunci akses mode LAN, JANGAN dibagikan selain lewat link
└── versi-claude/
    └── radar-cangkang.html      Sumber versi artifact Claude (database tim)
```

## Menjalankan (Windows)

Klik dua kali `Jalankan-Radar.bat`, lalu buka http://localhost:8765

## Membuka dari perangkat lain (jaringan lokal)

1. Sekali saja: klik kanan `Izinkan-LAN.bat` > **Run as administrator** (izin port 8765 + aturan firewall jaringan *Public* & *Private*, hanya dari subnet yang sama).
2. Jalankan `Jalankan-Radar-LAN.bat`. Jendelanya menampilkan **link berkunci**, mis. `http://192.168.18.109:8765/?key=...`.
3. Bagikan link lengkap itu. Tanpa `?key=...` akses dari perangkat lain ditolak (401); komputer ini sendiri tidak perlu kunci. Ganti kunci: hapus `website\.lan-key` lalu jalankan ulang.

Jangan jalankan `Jalankan-Radar.bat` dan `Jalankan-Radar-LAN.bat` bersamaan (port sama). Data radar tersimpan di browser masing-masing perangkat; semua perangkat memakai token Stockbit di komputer ini.

## Menjalankan (Linux)

Butuh PowerShell 7 (`pwsh`).

```
./jalankan-radar.sh            # terbuka ke jaringan lokal, tetap pakai kunci akses
./jalankan-radar.sh --local    # hanya komputer ini
```

## Token Stockbit

Simpan token Bearer di `website/.stockbit-token`. Token berlaku 24 jam; sisa masa berlakunya tampil di sidebar kiri (kuning < 2 jam, merah bila habis). Token baru langsung terbaca tanpa menjalankan ulang server.

`stockbit-token-watcher.py` (Linux/systemd, opsional) dapat memperpanjang token otomatis memakai *refresh token* di `website/.stockbit-refresh`. Tidak dipakai di Windows; pertimbangkan risikonya: refresh token memberi akses akun yang jauh lebih luas daripada token harian, jadi simpan hanya di komputer pribadi.

## Cache SQLite (opsional)

Bila CLI `sqlite3` terpasang, server menyimpan respons Stockbit dan sumber berita di `website/.cache.sqlite` sehingga Stockbit hanya dipanggil saat salinan kedaluwarsa. Tanpa `sqlite3`, server tetap berjalan normal tanpa cache.

| Data | Umur salinan |
|---|---|
| Harga, chart, orderbook | 10 menit saat jam bursa, 6 jam di luar jam bursa |
| Stockbit Reports (keterbukaan) | 20 menit |
| Berita media | 15 menit |
| Tender, pemegang saham, profil, keuangan | 6 jam |

Tombol **Perbarui** manual mengambil data segar (`?fresh=1`); pembaruan otomatis saat membuka menu memakai cache. Hapus cache: hapus `website\.cache.sqlite*`.

## Pembaruan otomatis

Membuka menu memperbarui datanya dari Stockbit (paling sering sekali per 15 menit per jenis data): Update → laporan & berita; Story → laporan, profil & pengendali; Progress/Potensi → tender, harga & kepemilikan. Tombol **Perbarui** tetap tersedia.

## Data terverifikasi

`story-verified.json`, `pengendali-verified.json`, dan `pandangan-analis.json` berisi hasil pengecekan Stockbit Reports dan media (sumber dicatat per emiten). Website tidak menyediakan input manual; koreksi dilakukan dengan memperbarui file ini. Field kosong berarti memang belum diungkap.

## Berita (menu Update Emiten)

**Perbarui berita** mengambil Stockbit Reports (butuh token) dan berita media dari IDX Channel, Bloomberg Technoz, Investor.id, CNBC Indonesia, CNN Indonesia, Kontan, Katadata, EmitenNews, Bisnis.com, detikFinance. Sumber dan kata kunci diatur di `website/stockbit.config.json` bagian `news`.

## Versi Claude

Versi dengan database bersama: https://claude.ai/artifact/G3idsMaViH1CKpKyory3mE (sumber `versi-claude/radar-cangkang.html`). Data versi `website/` tersimpan di browser (localStorage), terpisah dari versi Claude.
