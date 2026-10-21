# Intel Pasar — Data tradersaham.com

Sumber data pasar pendukung dari tradersaham.com untuk radar: indikator
teknikal gabungan, perilaku broker, arus dana asing, dan pemegang saham besar.
Data ini **tidak statis** — server menyegarkannya otomatis tiap jam, dan
script tarik mandiri tersedia untuk pembaruan manual.

## Gambaran

- Backend API: `https://apiv2.tradersaham.com/api` (situs utama
  `www.tradersaham.com` hanya frontend; data lewat apiv2).
- Otentikasi: `Authorization: Bearer <token>` dari Firebase (email/password).
  Kredensial akun sinkron ada di `website/.tsa-creds.json` (diabaikan git).
- Anti-bot: sebagian endpoint menuntut header `X-RQ-T` (epoch ms) dan
  `X-RQ-S` — dihasilkan otomatis oleh script (`rq_headers()` di
  `tsa_refresh.py`).
- Batas pemakaian: 3.000 request / 15 menit per IP. Script tarik penuh butuh
  ±20 request — jauh di bawah batas.
- Data bursa diperbarui situs setelah sesi tutup; tanggal data efektif ada di
  `/api/analytics/screener/latest-date`.

## Endpoint API (apiv2)

Semua butuh Bearer kecuali `/health`. Format respons umum:
`{"status":"success","data":{...}}` untuk auth/credits, dan objek ber-"data"
untuk analytics. Error: `{"error":"...","code":"..."}`.

### Kesehatan & akun
| Endpoint | Ket | Parameter utama |
|---|---|---|
| `GET /health` | status layanan (tanpa auth) | — |
| `POST /auth/login` | sinkron user ke backend | body `idToken` (string apa pun cukup) |
| `POST /auth/update-avatar` | update avatar | body `avatarSeed` |
| `GET /credits/balance` | saldo kredit + status langganan | — |
| `GET /credits/transactions` | riwayat kredit | — |
| `GET /credits/subscription-history` | riwayat langganan | — |
| `POST /credits/activate` | aktifkan paket setelah bayar | body `orderId` |
| `GET /profile/credits` | kredit via profil | — |

### Pembayaran (Pakasir + Saweria)
| Endpoint | Ket |
|---|---|
| `GET /payments/methods` | daftar metode bayar |
| `POST /payments/pakasir/create` | buat QR — body `amount` (min 10.000, maks 5.000.000) |
| `GET /payments/pakasir/orders` | daftar order |
| `GET /payments/pakasir/status/:orderId` | status satu order |
| `POST /payments/pakasir/cancel/:orderId` | batalkan order |

### Analytics — smart money & sektor
| Endpoint | Ket | Parameter utama |
|---|---|---|
| `GET /analytics/smart-money` | net akumulasi smart money per saham (window ~3 bulan tetap) | `period`, `limit` (diabaikan) |
| `GET /analytics/sector-trends` | arus per sektor | `period` ∈ 1d/1w/1m/1y/all (efektif) |
| `GET /analytics/sector-date-range` | rentang tanggal data sektor | — |
| `GET /analytics/sector-history` | riwayat satu sektor | `sector=<nama>` (wajib) |
| `GET /analytics/sectors-comparison` | banding sektor | `period` |
| `GET /analytics/scripless-changes` | perubahan kepemilikan scripless | `start_date`, `end_date` |
| `GET /analytics/divergence-analysis` | divergensi smart money vs retail | `start_date`, `end_date` |
| `GET /analytics/available-months` | bulan-bulan yang tersedia | — |

### Analytics — broker
| Endpoint | Ket | Parameter utama |
|---|---|---|
| `GET /analytics/broker-data-availability` | rentang + jumlah hari data | — |
| `GET /analytics/broker-scanner` | net flow per kelas broker per saham (smart money/bandar/whale) | `start_date`, `end_date` (wajib); `min_net_value`, `type` ∈ net/gross; butuh header X-RQ |
| `GET /analytics/broker-scanner/trading-days` | daftar hari bursa terakhir | `days=<int>` |
| `GET /analytics/broker/:code/daily-stats` | ⛔ terkunci langganan | `start_date`, `end_date`, `investor_type` |
| `GET /analytics/broksum` | rekap broker per saham per tanggal | `stock_code` (wajib), `date` |

### Analytics — screener (inti produk)
| Endpoint | Ket | Parameter utama |
|---|---|---|
| `GET /analytics/screener/latest-date` | tanggal data terbaru | — |
| `GET /analytics/screener/all-stocks` | daftar seluruh saham (1005) | `page`, `limit` (maks 100), `sort_by`, `sort_order`, `search` |
| `GET /analytics/screener/composition` | komposisi pemegang saham per emiten | `page`, `limit` |
| `GET /analytics/screener/gems` | skor komposit gems + preset | `page`, `preset` ∈ top/silent_accumulation/associate_homecoming/regime_flip/dual_confirmation/block_absorption/oversold/spike_then_quiet/distribution_watch/broad_exit/overbought_dist; `sector`, `date`, `search`, `liquidity`, `mcap_min`, `mcap_max`, `min_gem_score`, `sort_by` |
| `GET /analytics/screener/gems/presets` | metadata preset | — |
| `GET /analytics/screener/signals-v2` | teknikal + sinyal per saham (963 emiten) | `page`, `limit`, `search`, `sort_by`, `sector`, `date` |
| `GET /analytics/screener/relative-strength` | RS per saham vs indeks | `period` |
| `GET /analytics/screener/msci-candidates` | kandidat masuk MSCI | `page` |
| `GET /analytics/screener/foreign-flow` | net arus asing 30 hari | `page`, `period` ∈ 7/30/…, `direction` ∈ in/out, `search` |
| `GET /analytics/screener/foreign-flow/detail` | ⛔ terkunci langganan | `stock_code`, `period` |
| `GET /analytics/screener/msci-history-bulk` | riwayat MSCI massal | — |

### Analytics — harga
| Endpoint | Ket | Parameter utama |
|---|---|---|
| `GET /analytics/latest-prices` | harga terakhir banyak saham | `codes=BBCA,TLKM,…` |
| `GET /analytics/stock-price-history` | OHLCV historis satu saham | `stock_code` (wajib), `days=<int>` |
| `GET /analytics/market-rs-trends` | timeseries RS per grup | `groupBy` ∈ sector/konglo, `days`, `groups` |
| `GET /stocks/search` | autocomplete kode/nama | `q=` |

### Pemegang saham > 1% (gate berbeda: header `Origin`)
Endpoint ini menuntut `Origin: https://www.tradersaham.com` persis — tanpa
itu 403. Bearer + X-RQ tetap perlu.

| Endpoint | Ket | Parameter utama |
|---|---|---|
| `GET /one-percent/statistics` | statistik pemegang besar | — |
| `GET /one-percent/search-investors` | cari investor | `q=`, `limit` |
| `GET /one-percent/search-stocks` | cari saham | `q=` |
| `GET /one-percent/investor-details` | detail satu investor | `investor_name` (wajib, nama persis) |
| `GET /one-percent/investor-portfolio` | portofolio investor | `investor_name` |
| `GET /one-percent/investor-snapshots` | snapshot historis | `investor_name` |
| `GET /one-percent/network` | jaringan antar investor | `investor_name` |
| `GET /one-percent/monthly-changes` | perubahan bulanan | `investor_name`, `month` |
| `GET /one-percent/monthly-changes-summary` | ringkasan bulanan | — |
| `GET /shareholders/changes` | perubahan pemegang ≥5% | — |

### Contoh minimal (Python, tanpa dependensi)

```python
import json, time, urllib.request

TOKEN = "...idToken-dari-Firebase..."

def get(path, rq=False):
    req = urllib.request.Request("https://apiv2.tradersaham.com/api" + path)
    req.add_header("Authorization", f"Bearer {TOKEN}")
    if rq:  # sebagian endpoint butuh header ini
        t = str(int(time.time() * 1000))
        import base64
        s = base64.b64encode((path[-4:] + t + "trs_idx_v2_2024").encode()).decode()
        req.add_header("X-RQ-T", t)
        req.add_header("X-RQ-S", s[5:21])
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

print(get("/analytics/screener/latest-date"))          # {"date": "2026-10-20"}
print(get("/analytics/screener/signals-v2?limit=2"))   # 2 emiten pertama
print(get("/analytics/screener/gems?preset=top&limit=2"))
print(get("/analytics/broker-scanner?start_date=2026-10-20&end_date=2026-10-20", rq=True))
```

## Data yang disimpan radar (`website/tsa-*.json`)

Hasil tarik disimpan sebagai snapshot keyed-by-ticker; inilah yang dibaca
endpoint `/api/tsa/summary` dan tab "Intel Pasar" di frontend.

| File | Isi | Emiten |
|---|---|---|
| `tsa-signals.json` | teknikal+broker: harga, perubahan %, RSI(14), stokastik, tren EMA, spike volume/nilai, likuiditas, akumulasi bersih, broker dominan/afiliasi, regime | ±963 |
| `tsa-gems.json` | skor komposit gems, tier, bukti, breakdown | ±926 |
| `tsa-foreign-flow.json` | arus dana asing 30 hari | ±60 (yang relevan radar) |
| `tsa-broker-scanner.json` | net per kelas broker (smart money, bandar, whale, retail) | ±80 |
| `tsa-meta.json` | sumber, waktu tarik, tanggal data efektif | — |

## Pembaruan otomatis

`server.py` menjalankan thread `tsa_loop()`: setiap **1 jam** memanggil
`tsa_refresh.py` sebagai proses anak. Kegagalan jaringan/auth tidak menghentikan
loop — dicatat ke log server, dicoba lagi di siklus berikutnya. File lama tetap
dipakai sampai tarik baru sukses (server membaca dengan memo 5 menit, jadi
tanpa restart).

Halaman data: tsa_refresh.py mengambil seluruh halaman endpoint ber-paginasi
(limit 100/halaman, maks 12 halaman pengaman per sumber) — signals ±10 halaman,
gems ±10, foreign-flow ±5.

## Pembaruan manual

```bash
cd website
python3 tsa_refresh.py              # tarik semua sumber (≈15 detik)
python3 tsa_refresh.py --tanpa-ff   # lewati foreign-flow (lebih cepat)
```

Kredensial: `website/.tsa-creds.json` berisi `{"email": "...", "password":
"..."}` — atau env `TSA_EMAIL`/`TSA_PASSWORD`. Token Firebase cache 45 menit
di `/tmp/tsa_token.json` (berlaku 1 jam; diperbarui otomatis bila kedaluwarsa).
Akun baru otomatis didaarkan bila login gagal (fallback signUp).

## Endpoint radar yang membaca data ini

```
GET /api/tsa/summary?ticker=XXXX
```

Menggabungkan signals + gems + foreignFlow + brokerScanner untuk satu emiten.
Ticker wajib 4 huruf (kode BEI) → selain itu 400. `ada: false` bila tidak ada
satu pun sumber. Contoh: `/api/tsa/summary?ticker=ASPI` →

```json
{
  "ticker": "ASPI",
  "meta": {"sumber": "...", "tarik": "...", "tanggal_data": "2026-10-20"},
  "ada": true,
  "signals": {"close": 825, "chg": 7.84, "rsi14": 35.2, "regime": "FLIP_SELL", "...": "..."},
  "gems": {"gemScore": 31, "gemTier": "NONE", "evidence": "...", "breakdown": ["..."]},
  "foreignFlow": null,
  "brokerScanner": {"smartMoneyNet": 0, "...": "..."}
}
```

## Frontend

Tab **"Intel Pasar"** di halaman emiten (`EmitenView.vue`), komponen
`frontend/src/components/emiten/TabIntel.vue`:

- **Teknikal & Broker** — harga/perubahan, RSI (overbought/oversold diberi
  warna), tren EMA, regime broker (label Indonesia: `ACCUMULATION` →
  akumulasi, `MILD_DISTRIBUTION` → distribusi ringan, `FLIP_BUY` → berbalik
  beli, dst.), akumulasi bersih, broker dominan/afiliasi, spike volume/nilai,
  likuiditas, nilai negosiasi.
- **Skor Gems** — skor + tier + bukti + breakdown.
- **Arus Asing** — nilai bersih (warna masuk/keluar), intensitas, akselerasi,
  float terserap, streak, KSEI.
- **Broker Besar** — net harian smart money/bandar/whale/retail.

Tab bekerja untuk kode apa pun berformat 4 huruf BEI — tidak terbatas emiten
radar; data murni dari snapshot tradersaham, tak bercampur data Stockbit.

## Nilai regime yang dikenal

`ACCUMULATION`, `MILD_ACCUMULATION`, `NEUTRAL`, `MILD_DISTRIBUTION`,
`DISTRIBUTION`, `FLIP_BUY`, `FLIP_SELL` — semuanya sudah punya label Indonesia
di `TabIntel.vue`; nilai baru tampil apa adanya dengan warna netral.

## Catatan

- Sifat data pihak ketiga (tradersaham.com), dihitung otomatis dari bursa —
  bersifat umum, bukan saran investasi.
- Distribusi tier gems (per 2026-10-20): 5 SILVER, 47 BRONZE, sisanya NONE.
- Pakai sesuai ketentuan layanan situs sumber; jangan membanjiri endpoint di
  luar kebutuhan (batas 3.000 req/15 menit per IP, pembaruan hanya 1/jam).

## Uji

```bash
python3 website/test_server.py       # 16 test server
cd frontend && npx vitest run        # 85 test frontend
python3 website/tsa_refresh.py       # tarik manual, periksa output
```

Ketiganya hijau pada commit terakhir yang menyentuh file terkait
(`e82ecbb` integrasi awal, penambahan refresh menyusul).
