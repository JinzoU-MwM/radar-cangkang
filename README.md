# Radar Backdoor

Pemantauan emiten BEI calon backdoor listing (pengambilalihan & perubahan pengendalian). Pemakaian pribadi.

## Struktur folder

```
radar-cangkang/
├── jalankan-radar.sh            Jalankan server + buka browser
├── stockbit-token-watcher.py    Perbarui token Stockbit otomatis (systemd timer)
├── README.md
├── .gitignore                   Mencegah token ikut terunggah
├── website/                     Website mandiri (frontend + backend Python)
│   ├── index.html               Markup halaman utama
│   ├── styles.css               Seluruh gaya (dipecah dari index.html)
│   ├── js/app.js                Logika UI (entry ES module)
│   ├── js/lib/domain.js         Modul domain murni: konstanta, skor, util
│   ├── server.py                Server lokal + proxy Stockbit (port 8765, Python stdlib)
│   ├── stockbit.config.json     URL endpoint & pemetaan field Stockbit
│   ├── .stockbit-token          token Bearer Stockbit, JANGAN dibagikan
│   └── .stockbit-refresh        refresh token Stockbit, JANGAN dibagikan
└── versi-claude/
    └── radar-cangkang.html      Sumber versi artifact Claude (database tim)
```

## Menjalankan

Butuh Python 3 (stdlib murni, tanpa pip install).

```
./jalankan-radar.sh            # terbuka ke jaringan lokal (LAN/Tailscale)
./jalankan-radar.sh --local    # hanya komputer ini
```

Buka http://localhost:8765, atau dari perangkat lain `http://<ip-host>:8765/` (alamat tercetak di terminal). Kalau ufw aktif, sekali saja: `sudo ufw allow from 192.168.0.0/16 to any port 8765 proto tcp`.

Tanpa kunci akses: siapa pun di jaringan lokal (IP privat 10/8, 172.16/12, 192.168/16, Tailscale 100.64/10) bisa membuka radar dan memakai proxy Stockbit dengan token komputer ini. Permintaan dari IP publik ditolak (403). Di Wi-Fi publik pakai `--local`. Data radar tersimpan di browser masing-masing perangkat.

## Story Emiten terverifikasi

`website/story-verified.json` berisi bisnis baru, injeksi aset, target, nominal, dan target penyelesaian tiap emiten yang sudah dicek dengan Stockbit Reports (15 Okt 2026), lengkap dengan tanggal laporan dan catatan.
Prioritas tampilan: koreksi manual (tombol *Ubah story*) > file ini > data otomatis. Field kosong = memang belum disebut di laporan.

## Menyambungkan Stockbit

1. Simpan token Bearer di `website/.stockbit-token`.
2. Isi `url` di `website/stockbit.config.json` dari DevTools (F12 > Network) stockbit.com; ganti kode saham dengan `{ticker}`.
3. Jalankan ulang server, buka http://localhost:8765/api/raw?ticker=NAYZ, lalu isi `fields` (mis. `data.lastprice`).
4. Klik **Perbarui dari Stockbit** di menu Progress emiten / Potensi emiten.

## Berita (menu Update Emiten)

Tombol **Perbarui berita** mengambil:
- **Stockbit Reports**: keterbukaan informasi BEI + ringkasan AI Stockbit, untuk tiap emiten di radar (butuh token).
- **Berita media** dari IDX Channel, Bloomberg Technoz, Investor.id, CNBC Indonesia, CNN Indonesia, Kontan, Katadata, EmitenNews, Bisnis.com, detikFinance. Hanya judul yang cocok kata kunci backdoor (`news.keywords`) atau menyebut emiten di radar.

Sumber, kata kunci, dan pola URL diatur di `website/stockbit.config.json` bagian `news`.

## Versi Claude

Versi dengan database bersama: https://claude.ai/artifact/G3idsMaViH1CKpKyory3mE
Sumbernya `versi-claude/radar-cangkang.html`.

Data di versi `website/` tersimpan di browser (localStorage), terpisah dari versi Claude.

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