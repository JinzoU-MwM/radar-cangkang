# Kontrak modul frontend (untuk pengerjaan paralel)

Spec: `docs/superpowers/specs/2026-10-20-vue-refactor-design.md`.
Sumber lama: `website/js/app.js`, `website/js/lib/domain.js`. Mockup desain: `/tmp/claude-1000/-home-jamnas-Code-Coding-radar-cangkang/935f2d15-e0a2-46b0-936a-01eb6c5b8b12/scratchpad/design/project/*.dc.html` (Main = Monitor, Emiten, Kandidat, Berita).

Aturan umum:
- Vue 3 `<script setup>` SFC, JavaScript (bukan TS). Komentar bahasa Indonesia, hanya di bagian rumit.
- Gaya: pakai kelas dan variabel CSS di `src/tokens.css` (`--ink`, `--now`, `.ledger`, `.pill`, `.tag t-strong`, `.btn`, `.tabs/.tab`, `.scrim/.dialog`, `.lbl`, `.ticker`, `.rule-top`, `.sheet`). CSS khusus komponen di `<style scoped>`. Warna selalu lewat variabel (tema gelap harus jalan).
- Copy UI bahasa Indonesia, tanpa kotak KPI generik, eyebrow, emoji, glyph unicode sebagai ikon. Data kosong ditulis "belum ada", jangan dikarang.
- Jangan menyentuh file di luar yang ditugaskan.

## `src/lib/` (logika murni, tanpa DOM/Vue)

`domain.js`
- `STAGES, SIGNALS, MILESTONES, STAGE_PCT, UTYPES` (salin dari domain.js lama)
- `progressOf(item)`, `stageOf(item)`, `scoreOf(item)`, `statusOf(score)`, `fmtDate(iso)`, `rp(n)`, `big(n)`, `pctTxt(x)`
- `STAGE_TRACK = ['spa','tender','rupslb','injeksi','selesai']` dan `trackIndex(item)` → 0..4 (posisi di trek 5 ruas; `radar` → -1)
- `fairGap(price, lo, hi)` → persen bulat: >0 di atas `hi`, <0 di bawah `lo`, 0 di dalam rentang

`ta.js`
- `sma, ema, bollinger, rsi, macd, psar` (port objek `TA`), `atr(bars, n=14)`
- `indicators(bars)` → `{ ma20, ma50, bb:{mid,up,lo}, rsi, macd:{m,sg,h}, sar:{sar,up}, atr, vma }`
- `taSignals(bars, ind)` → `{ votes, score, sig, sup, res, stop, hi20, lo20, valDay, rr }`
- `taVerdict(...)`, `tick, floorTick, ceilTick, rpx`
- `buildPlan(bars, ind, s)` → bentuk sama dengan lama
- `MM_DEF`, `moneyMgmt(plan, mm, { valDay, sikap })` → `{ lossPS, lots, capLots, liqLots, finalLots, breakeven, pnl1, pnl2, checklist[], verdict }`

`analysis.js`
- `buildAnalysis({ ticker, item, profile, reports, insider, quote, verified, pengendali, pandangan, analisa, benchmark })` → objek yang sama dengan `buildAnalysis` lama (dimensi, skor, sikap, level harga, tesis, checklist)
- `nominalRp(text)`, `KURS`

`story.js`
- `deriveStory(item, { verified, updates })` → objek story lama (lama, baru, oldName, oldPct, inject, injType, injCo, nominal, target, verified, source, …)

`news.js`
- `isBackdoorNews(update, items)`, `newsTake(update, { items, pandangan })` → `{ level, points[], nominalText, sikapLine }`

`sync.js` (async, fetcher disuntikkan; mengembalikan salinan baru, tidak memutasi input)
- `syncTenders(items, api)` → `items`
- `syncStockbit(items, api)` → `items`
- `syncReports(items, updates, api, { news, tickers })` → `{ items, updates, errors }` (termasuk `inferMilestones`)
- `api` = `{ get(path, params) }` mengembalikan JSON atau melempar `Error` dengan `.status`

Tiap modul punya tes vitest di `src/lib/__tests__/<nama>.test.js` untuk logika bercabang.

## `src/api.js` (sudah ada)
`api.get(path, params)`, `api.put(path, body)`, `api.post(path, body)`, `api.del(path)`; `api.freshFor(ms)` menambah `fresh=1` ke GET selama jendela waktu.

## `src/store.js` (sudah ada)
`store` = `reactive({ items, updates, verified, pandangan, analisa, pengendali, relasi, status, features, seenAt, ready, busy:{stockbit,reports} })`
- `itemOf(ticker)`, `saveItem(item)`, `saveItems(list)`, `saveUpdates(list)`
- `runSyncStockbit()`, `runSyncReports()`, `autoRefresh(kind)`
- `toast(text)` dan `store.toasts`
- `pandanganOf(t)`, `storyOf(t)` (memoized `deriveStory`)

## Rute (`src/router.js`, sudah ada)
- `/` → `views/MonitorView.vue`
- `/kandidat` → `views/KandidatView.vue`
- `/berita` → `views/BeritaView.vue`
- `/emiten/:ticker` → `views/EmitenView.vue` (tab lewat query `?tab=ringkasan|story|teknikal|spekulasi|berita|analisa`)

## Komponen bersama (`src/components/`, sudah ada)
- `StageTrack.vue` props `item` (trek 5 ruas + nama tahap)
- `SikapTag.vue` props `sikap`
- `FairBar.vue` props `price, lo, hi` (bar + selisih %)
