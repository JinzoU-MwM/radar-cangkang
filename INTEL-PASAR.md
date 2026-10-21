# Intel Pasar — Data tradersaham.com

Ringkasan integrasi data pasar dari tradersaham.com ke Radar Backdoor: apa
isinya, di mana filenya, bagaimana server dan frontend memakainya, dan cara
menyegarkannya.

## Sumber data

Snapshot manual dari API publik tradersaham.com (backend IDX, mode baca-saja),
diambil tanggal **2026-10-21** dengan data pasar per **2026-10-20**. Data
mencakup seluruh emiten BEI yang tercakup situs tersebut (±960 emiten).

## File data (`website/tsa-*.json`)

| File | Isi | Cakupan |
|---|---|---|
| `tsa-signals.json` | Indikator teknikal + perilaku broker per emiten: harga, perubahan %, RSI(14), stokastik, tren EMA, spike volume/nilai, tingkat likuiditas, skor akumulasi bersih, broker dominan + porsinya, broker afiliasi, regime akumulasi/distribusi | 963 emiten (keyed by ticker) |
| `tsa-gems.json` | Skor komposit "gems" + tier (SILVER/BRONZE/NONE), bukti dan breakdown skornya, regime, posisi harga vs puncak 20 hari, umur listing | 926 emiten (keyed by ticker) |
| `tsa-foreign-flow.json` | Arus dana asing 30 hari per emiten: nilai bersih, intensitas, akselerasi, float terserap, streak, delta KSEI | 445 emiten (paling likuid) |
| `tsa-broker-scanner.json` | Net beli/jual harian per kelas broker: smart money, bandar, whale, retail | beberapa ratus emiten aktif |
| `tsa-meta.json` | Metadata: sumber, tanggal tarik, tanggal data, catatan | — |

Semua file statis dan dilayani server seperti file JSON statis lainnya.

## Endpoint server

```
GET /api/tsa/summary?ticker=XXXX
```

Satu panggilan menggabungkan keempat sumber untuk satu emiten:

```json
{
  "ticker": "ASPI",
  "meta": { "sumber": "...", "tarik": "2026-10-21", "tanggal_data": "2026-10-20" },
  "ada": true,
  "signals": { "close": 825, "chg": 7.84, "rsi14": 35.2, "regime": "FLIP_SELL", "...": "..." },
  "gems": { "gemScore": 31, "gemTier": "NONE", "evidence": "...", "breakdown": ["..."] },
  "foreignFlow": null,
  "brokerScanner": { "smartMoneyNet": 0, "...": "..." }
}
```

- Ticker wajib 4 huruf (kode BEI); selain itu `400`.
- Bila emiten tidak ada di salah satu sumber, fieldnya `null`.
- `ada: false` bila tidak ada satu pun sumber yang punya data emiten itu.
- Data dibaca dari file dengan memo 5 menit, jadi menimpa file tidak perlu
  restart server.

Helper di `server.py`: `tsa_load(name)` dan `tsa_summary(ticker)`.

## Frontend

Tab baru **"Intel Pasar"** di halaman emiten (`EmitenView.vue`), dikerjakan
oleh komponen `frontend/src/components/emiten/TabIntel.vue`. Panel menampilkan:

- **Teknikal & Broker** — harga/perubahan, RSI dengan penanda overbought/
  oversold, tren EMA, regime broker (diterjemahkan ke label Indonesia:
  `ACCUMULATION` → akumulasi, `MILD_DISTRIBUTION` → distribusi ringan,
  `FLIP_BUY` → berbalik beli, dst.), skor akumulasi bersih, broker dominan
  dan afiliasi, spike volume/nilai, likuiditas, nilai pasar negosiasi.
- **Skor Gems** — skor komposit + tier, bukti, dan butir breakdown.
- **Arus Asing** — nilai bersih (masuk/keluar diberi warna), intensitas,
  akselerasi, float terserap, streak, status KSEI.
- **Broker Besar** — net harian per kelas (smart money, bandar, whale, retail).

Tab bekerja untuk kode di luar radar juga — data yang ditampilkan murni dari
snapshot tradersaham, tidak menggabungkan data Stockbit.

## Menyegarkan data

Snapshot dibuat sekali tarik. Untuk memperbarui:

1. Tarik ulang data dari API tradersaham ( skrip tarik di
   `/tmp/_scratch/tradersaham-recon/`, lihat `API_ENDPOINTS.md` di sana).
2. Jalankan lagi konversi → timpa `website/tsa-*.json` dengan struktur sama:
   - `tsa-signals.json` / `tsa-gems.json`: objek `{ TIKER: {...} }`.
   - `tsa-foreign-flow.json`: array baris dengan `stock_code`.
   - `tsa-broker-scanner.json`: objek dengan array `stocks` berisi `stockCode`.
   - Perbarui `tsa-meta.json` (tanggal tarik & tanggal data).
3. Selesai — server membaca ulang otomatis lewat memo 5 menit; frontend
   membaca file saat tab dibuka.

## Nilai regime yang dikenal

`ACCUMULATION`, `MILD_ACCUMULATION`, `NEUTRAL`, `MILD_DISTRIBUTION`,
`DISTRIBUTION`, `FLIP_BUY`, `FLIP_SELL` — semua sudah punya label Indonesia
di `TabIntel.vue`; nilai baru akan tampil apa adanya dengan warna netral.

## Catatan

Sifat data ini pihak ketiga (tradersaham.com), dihitung otomatis dari data
bursa — bersifat umum, bukan saran investasi. Distribusi tier gems saat ini:
5 SILVER, 47 BRONZE, sisanya NONE — mayoritas emiten memang tidak masuk
daftar gems.

## Uji

- `python3 website/test_server.py` — 16 test, termasuk helper `tsa_summary`
  dan endpoint (200 untuk ticker valid, 400 untuk ticker salah format).
- `cd frontend && npx vitest run` — 85 test.

Keduanya hijau pada commit `e82ecbb`.
