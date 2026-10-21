# Refaktor frontend Radar Backdoor ke Vue

Tanggal: 20 Okt 2026 · Status: disetujui (mockup https://claude.ai/artifact/HbgTDzcgFKHUXALdYfY1Vw)

## Tujuan

Frontend vanilla (`website/index.html` + `js/app.js` 2.192 baris) diganti aplikasi Vue 3 yang interaktif, dan data radar pindah dari localStorage per browser ke SQLite di server supaya semua perangkat tim melihat data yang sama.

Di luar cakupan: screener otomatis seluruh BEI untuk menu Kandidat (sub-proyek 2), versi `versi-claude/`.

## Keputusan

| Hal | Pilihan |
|---|---|
| Framework | Vue 3 + Vite + SFC di `frontend/`, build ke `website/dist/` |
| Routing | `vue-router` mode hash: `#/`, `#/kandidat`, `#/berita`, `#/emiten/:ticker` |
| State | satu modul `reactive` (`src/store.js`), tanpa Pinia |
| Chart OHLC | `lightweight-charts` |
| Diagram alur saham | `@vue-flow/core` (drag, zoom, pan) |
| Infografis lain | komponen SVG/CSS sendiri |
| Backend | `server.py` tetap Python stdlib; tambah `.radar.sqlite` dan endpoint tulis |
| Gaya | token `DESIGN.md` ("Jadwal Aksi Korporasi"), tema terang dan gelap |

`PRODUCT.md` prinsip 4 ("nol build") diganti: build dengan `npm run build`, server hanya menyajikan hasil build. `PRODUCT.md` diperbarui.

## Halaman

1. **Monitor** (`#/`). Satu tabel 48 emiten, header lengket. Kolom: kode, trek tahap 5 ruas (PPJB, PTW, RUPSLB, Injeksi, Selesai) + nama tahap, sikap, harga, bar harga terhadap rentang nilai wajar + selisih % (lebar tetap, rata kanan), laporan terakhir (tanggal oranye bila baru sejak kunjungan terakhir). Filter pil tahap dan sikap dengan jumlah; urut kode, selisih, laporan terbaru (default). Satu baris ringkasan "sejak dibuka …" di atas tabel. Tanpa kotak KPI.
2. **Kandidat** (`#/kandidat`). Buku sinyal: baris = emiten tahap penyaringan, kolom = 9 sinyal `SIGNALS` dengan bobot; sel berisi tanggal temuan, status aktif / batal (coret) / tidak ada / belum dicek (arsir). Klik sel = bukti bertanggal + sumber di bawah tabel. Form "Lacak kode baru".
3. **Berita** (`#/berita`). Feed dikelompokkan per tanggal, filter jenis (`UTYPES`) dan sumber, pencarian. Latar oranye = belum dilihat.
4. **Emiten** (`#/emiten/:ticker`). Kepala: kode, sikap, tahap + tenggat, harga, tombol **Alur saham**. Tab: Ringkasan, Story & Pengendali, Teknikal, Spekulasi, Berita.
   - Ringkasan: tangga harga, dilusi publik, pengendali lama melepas, likuiditas, linimasa, Pantau, Tesis gugur bila, tesis lengkap dilipat. Data dari `pandangan-analis.json`.
   - Story & Pengendali: kartu pengendali (klik = dialog profil + orang di baliknya + rekam jejak) dan kartu injeksi (klik = dialog data aset). Data dari `story-verified.json`, `pengendali-verified.json`, `relasi-verified.json`.
   - Teknikal: candlestick + Bollinger, SAR, RSI, MACD, garis PTW dan rentang wajar. Port fungsi indikator yang ada.
   - Spekulasi: rencana trading lama, diport.
   - Alur saham: panel layar penuh, node bisa diseret, zoom/pan, pas layar otomatis di tengah, klik node = laci detail (identitas, peran, peringatan, hubungan, rekam jejak, belum terverifikasi, sumber). Posisi node disimpan per emiten di server.

Semua fitur lama yang tidak disebut di atas (Analisa, profil emiten, story refresh dari Stockbit Reports, status token, auto-refresh, pintasan keyboard, tema) diport tanpa mengubah perilaku.

## Data

`.radar.sqlite` (gitignore), terpisah dari `.cache.sqlite` supaya cache bisa dihapus tanpa kehilangan data tim:

```sql
CREATE TABLE items  (ticker TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE updates(id TEXT PRIMARY KEY, data TEXT NOT NULL, date TEXT);
CREATE TABLE layout (ticker TEXT PRIMARY KEY, data TEXT NOT NULL);
```

`data` adalah JSON bentuk item/update yang sama dengan localStorage sekarang, supaya logika lama bisa diport tanpa skema baru. `relasi-verified.json` (baru, di repo) berisi node, garis, dan info orang/badan hukum per emiten; mulai dengan NAYZ.

API baru (semua JSON, LAN saja):

| Metode | Path | Isi |
|---|---|---|
| GET | `/api/items` | semua item |
| PUT | `/api/items/{T}` | simpan satu item |
| DELETE | `/api/items/{T}` | hapus item |
| GET | `/api/updates` | semua update |
| POST | `/api/updates` | upsert banyak update |
| POST | `/api/migrate` | impor localStorage lama; hanya bila tabel kosong |
| GET/PUT | `/api/layout/{T}` | posisi node diagram |

Penulisan wajib `Content-Type: application/json` (memaksa preflight CORS dari situs lain, yang tidak dijawab server), body ≤1 MB, kode saham `^[A-Z]{4}$`.

Migrasi: saat pertama dibuka, bila server mengembalikan item kosong dan localStorage lama (`radar-cangkang.v1`, `radar-cangkang.updates.v1`) ada isinya, frontend mengirimnya ke `/api/migrate`, lalu memakai data server.

## Perbaikan server yang ikut

1. `/api/ohlc`: `UnboundLocalError` dari walrus di dict literal; endpoint selalu 500.
2. `/api/viz/summary`: ekspresi `exclude` mati; `verified` menghitung emiten di luar `include`.
3. `/api/raw`: tambah `guard_ticker`.
4. `serve_static`: `is_relative_to` menggantikan cek prefix string.

## Aturan copy UI

Bahasa Indonesia. Tanpa kotak KPI generik, eyebrow, emoji, kontras biner, colon reveal, atau kalimat penutup yang menyuruh pembaca menyimpulkan. Angka selalu dengan sumber dan tanggal. Data yang belum ada ditulis "belum ada" atau "belum dicek", tidak dikarang.

## Uji

- `vitest` untuk fungsi murni: indikator teknikal, skor, progres tahap, selisih nilai wajar, migrasi.
- `unittest` Python untuk endpoint tulis (DB sementara): validasi kode, batas body, content-type, migrasi sekali.
- `npm run build` lolos; server menyajikan `dist/`; cek manual tiap halaman di browser.
