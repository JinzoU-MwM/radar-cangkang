# Radar Backdoor

Pemantauan emiten BEI calon backdoor listing (pengambilalihan & perubahan pengendalian). Pemakaian pribadi.

## Struktur folder

```
radar-cangkang/
├── jalankan-radar.sh            Bangun frontend bila perlu, lalu jalankan server
├── stockbit-token-watcher.py    Perbarui token Stockbit otomatis (systemd timer)
├── frontend/                    Aplikasi Vue 3 (Vite)
│   ├── src/views/               Monitor, Kandidat, Berita, Emiten
│   ├── src/components/          Komponen (tab emiten, panel alur saham, dll)
│   ├── src/lib/                 Logika murni: tahap, skor, indikator teknikal, analisa, sinkronisasi
│   └── CONTRACTS.md             Kontrak antarmodul
├── website/                     Backend Python + data
│   ├── server.py                Server lokal + proxy Stockbit + API data tim (port 8765, stdlib)
│   ├── dist/                    Hasil build frontend (tidak di-commit)
│   ├── *-verified.json          Data terverifikasi: story, pengendali, relasi (alur saham)
│   ├── pandangan-analis.json    Pandangan analis per emiten
│   ├── stockbit.config.json     URL endpoint & pemetaan field Stockbit
│   ├── .radar.sqlite            Data radar tim (item, berita, posisi diagram), JANGAN dihapus
│   ├── .cache.sqlite            Cache respons Stockbit, aman dihapus
│   ├── .stockbit-token          token Bearer Stockbit, JANGAN dibagikan
│   └── .stockbit-refresh        refresh token Stockbit, JANGAN dibagikan
└── versi-claude/
    └── radar-cangkang.html      Sumber versi artifact Claude (database tim)
```

## Menjalankan

Butuh Python 3 (stdlib) dan Node.js 20+ untuk membangun frontend.

```
./jalankan-radar.sh            # terbuka ke jaringan lokal (LAN/Tailscale)
./jalankan-radar.sh --local    # hanya komputer ini
```

Skrip membangun `website/dist` otomatis bila belum ada. Setelah mengubah kode frontend: `cd frontend && npm run build`. Untuk pengembangan: jalankan server, lalu `cd frontend && npm run dev` (Vite meneruskan `/api` ke port 8765).

Buka http://localhost:8765, atau dari perangkat lain `http://<ip-host>:8765/` (alamat tercetak di terminal). Kalau ufw aktif, sekali saja: `sudo ufw allow from 192.168.0.0/16 to any port 8765 proto tcp`.

Tanpa kunci akses: siapa pun di jaringan lokal (IP privat 10/8, 172.16/12, 192.168/16, Tailscale 100.64/10) bisa membuka radar, mengubah data tim, dan memakai proxy Stockbit dengan token komputer ini. Permintaan dari IP publik ditolak (403). Di Wi-Fi publik pakai `--local`.

Data radar tim tersimpan di `website/.radar.sqlite` dan sama untuk semua perangkat. Saat pertama dibuka setelah pembaruan ini, isi localStorage browser lama dipindah ke server sekali (hanya bila server masih kosong).

Uji: `python3 website/test_server.py` dan `cd frontend && npm test`.

## Story Emiten terverifikasi

`website/story-verified.json` berisi bisnis baru, injeksi aset, target, nominal, dan target penyelesaian tiap emiten yang sudah dicek dengan Stockbit Reports (15 Okt 2026), lengkap dengan tanggal laporan dan catatan.
Prioritas tampilan: koreksi manual (field `story` pada item) > file ini > data otomatis. Field kosong = memang belum disebut di laporan.

## Menyambungkan Stockbit

1. Simpan token Bearer di `website/.stockbit-token`.
2. Isi `url` di `website/stockbit.config.json` dari DevTools (F12 > Network) stockbit.com; ganti kode saham dengan `{ticker}`.
3. Jalankan ulang server, buka http://localhost:8765/api/raw?ticker=NAYZ, lalu isi `fields` (mis. `data.lastprice`).
4. Klik **Perbarui dari Stockbit** di menu Monitor.

## Berita

Tombol **Perbarui berita** mengambil:
- **Stockbit Reports**: keterbukaan informasi BEI + ringkasan AI Stockbit, untuk tiap emiten di radar (butuh token).
- **Berita media** dari IDX Channel, Bloomberg Technoz, Investor.id, CNBC Indonesia, CNN Indonesia, Kontan, Katadata, EmitenNews, Bisnis.com, detikFinance. Hanya judul yang cocok kata kunci backdoor (`news.keywords`) atau menyebut emiten di radar.

Sumber, kata kunci, dan pola URL diatur di `website/stockbit.config.json` bagian `news`.

## Alur saham

`website/relasi-verified.json` berisi pihak-pihak dalam tiap kasus (orang, badan hukum, aset), garis hubungan (kepemilikan, jabatan, transaksi rencana, batal), dan profil per pihak dengan sumber. Dibuka lewat tombol **Alur saham** di halaman emiten; posisi kotak yang digeser disimpan di server per emiten.

## Versi Claude

Versi dengan database bersama: https://claude.ai/artifact/G3idsMaViH1CKpKyory3mE
Sumbernya `versi-claude/radar-cangkang.html`.

Data di versi `website/` tersimpan di `website/.radar.sqlite`, terpisah dari versi Claude.

## Token Stockbit otomatis (Linux)

`stockbit-token-watcher.py` jalan tiap jam (systemd user timer `stockbit-token-watcher.timer`) dan memperbarui `website/.stockbit-token` bila sisa umurnya < 3 jam, memakai refresh token di `website/.stockbit-refresh`. Gagal = notifikasi desktop.

Mengisi refresh token (sekali, atau tiap kali rantainya putus):
1. Buka jendela **incognito**, login stockbit.com, F12 > Network sebelum halaman dimuat ulang.
2. Muat ulang halaman, cari request `login/refresh`; dari tab **Response** salin nilai refresh token (JWT `eyJ...`, di field yang namanya mengandung `refresh`).
3. Simpan ke `website/.stockbit-refresh`, **tutup jendela incognito tanpa logout** (refresh token berotasi; browser yang masih terbuka akan menghanguskannya).
4. Uji: `python3 stockbit-token-watcher.py --force`.

## Cache SQLite

Server menyimpan respons Stockbit dan sumber berita di `website/.cache.sqlite` (modul sqlite3 bawaan Python; selalu tersedia). Semua perangkat memakai salinan yang sama; Stockbit hanya dipanggil saat salinan kedaluwarsa:

| Data | Umur salinan |
|---|---|
| Harga, chart, orderbook | 10 menit saat jam bursa, 6 jam di luar jam bursa |
| Stockbit Reports (keterbukaan) | 20 menit |
| Berita media | 15 menit |
| Tender, pemegang saham, profil, keuangan | 6 jam |

Tombol **Perbarui** manual mengambil data segar (`?fresh=1`); pembaruan otomatis memakai cache. Bila Stockbit gagal/limit, salinan lama dipakai. Hapus cache: `rm website/.cache.sqlite*`. 