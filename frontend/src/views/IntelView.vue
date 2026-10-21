<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api.js'
import { big, fmt } from '../lib/domain.js'

// Intel Pasar seluruh BEI dari snapshot tradersaham.com (diperbarui server tiap jam):
// sinyal teknikal+broker, gems, arus asing, dan net broker besar. Bisa dicari dan diurutkan.
const route = useRoute(), router = useRouter()
const REGIME = {
  ACCUMULATION: ['akumulasi', 'up'], ACCUM: ['akumulasi', 'up'], MILD_ACCUMULATION: ['akumulasi ringan', 'up'], FLIP_BUY: ['berbalik beli', 'up'],
  DISTRIBUTION: ['distribusi', 'dn'], DIST: ['distribusi', 'dn'], MILD_DISTRIBUTION: ['distribusi ringan', 'dn'], FLIP_SELL: ['berbalik jual', 'dn'],
  NEUTRAL: ['netral', ''],
}
const n = v => v == null || v === '' ? null : Number(v)
const pct = v => n(v) == null ? '–' : (n(v) > 0 ? '+' : '') + fmt(n(v), 2) + '%'
const rpNet = v => n(v) == null ? '–' : (n(v) < 0 ? '−' : '') + big(Math.abs(n(v)))
const tone = v => n(v) == null ? '' : n(v) > 0 ? 'up' : n(v) < 0 ? 'dn' : ''

// Kolom per sumber: k = field, l = label, f = format, t = kelas warna, num = rata kanan.
const SETS = {
  signals: { l: 'Sinyal', note: 'Teknikal dan akumulasi broker harian, semua emiten.', sort: 'netAccumulationScore', cols: [
    { k: 'stockCode', l: 'Kode', tk: true }, { k: 'companyName', l: 'Nama', w: true }, { k: 'sector', l: 'Sektor' },
    { k: 'closePrice', l: 'Harga', num: true, f: v => fmt(n(v)) }, { k: 'priceChangePct', l: 'Δ', num: true, f: pct, t: tone },
    { k: 'rsi14', l: 'RSI', num: true, f: v => fmt(n(v), 1) }, { k: 'emaTrend', l: 'Tren EMA' },
    { k: 'regimeSignal', l: 'Regime', f: v => REGIME[v]?.[0] || v || '–', t: v => REGIME[v]?.[1] || '' },
    { k: 'netAccumulationScore', l: 'Skor akum.', num: true, f: v => fmt(n(v), 1) },
    { k: 'dominantAccumBroker', l: 'Broker dominan' }, { k: 'volumeSpikeRatio', l: 'Vol ×', num: true, f: v => fmt(n(v), 2) }] },
  gems: { l: 'Gems', note: 'Saringan "permata": akumulasi, stabilitas harga, lonjakan volume.', sort: 'accumScore7dAvg', cols: [
    { k: 'stockCode', l: 'Kode', tk: true }, { k: 'stockName', l: 'Nama', w: true },
    { k: 'closePrice', l: 'Harga', num: true, f: v => fmt(n(v)) }, { k: 'priceChangePct', l: 'Δ', num: true, f: pct, t: tone },
    { k: 'regimeSignal', l: 'Regime', f: v => REGIME[v]?.[0] || v || '–', t: v => REGIME[v]?.[1] || '' },
    { k: 'regimeConfidence', l: 'Yakin %', num: true, f: v => fmt(n(v)) }, { k: 'accumScore7dAvg', l: 'Akum. 7h', num: true, f: v => fmt(n(v), 1) },
    { k: 'maxVolSpike10d', l: 'Vol maks 10h ×', num: true, f: v => fmt(n(v), 2) }, { k: 'marketCap', l: 'Kap. pasar', num: true, f: v => big(n(v)) },
    { k: 'foreignNetVal', l: 'Asing net', num: true, f: rpNet, t: tone }] },
  'foreign-flow': { l: 'Arus asing', note: 'Emiten dengan arus beli asing paling konsisten (30 hari).', sort: 'score', cols: [
    { k: 'stock_code', l: 'Kode', tk: true }, { k: 'stock_name', l: 'Nama', w: true }, { k: 'score', l: 'Skor', num: true, f: v => fmt(n(v)) },
    { k: 'net_value', l: 'Net asing', num: true, f: rpNet, t: tone }, { k: 'streak', l: 'Beruntun (h)', num: true, f: v => fmt(n(v)) },
    { k: 'flow_intensity', l: 'Intensitas', num: true, f: v => fmt(n(v), 1) }, { k: 'foreign_pct', l: 'Porsi asing', num: true, f: v => fmt(n(v), 2) + '%' },
    { k: 'last_price', l: 'Harga', num: true, f: v => fmt(n(v)) }, { k: 'price_change_pct', l: 'Δ', num: true, f: pct, t: tone },
    { k: 'ksei_status', l: 'KSEI' }] },
  'broker-scanner': { l: 'Broker besar', note: 'Net beli/jual per kelompok pelaku: bandar, paus, ritel.', sort: 'smartMoneyNet', cols: [
    { k: 'stockCode', l: 'Kode', tk: true }, { k: 'currentPrice', l: 'Harga', num: true, f: v => fmt(n(v)) },
    { k: 'priceChange', l: 'Δ', num: true, f: pct, t: tone }, { k: 'smartMoneyNet', l: 'Smart money', num: true, f: rpNet, t: tone },
    { k: 'bandarNet', l: 'Bandar', num: true, f: rpNet, t: tone }, { k: 'whaleNet', l: 'Paus', num: true, f: rpNet, t: tone },
    { k: 'retailNet', l: 'Ritel', num: true, f: rpNet, t: tone }, { k: 'bandarAvgPrice', l: 'Rata bandar', num: true, f: v => fmt(n(v)) },
    { k: 'bandarFloatPL', l: 'P/L bandar', num: true, f: pct, t: tone }] },
}
const ORDER = Object.keys(SETS)
const set = ref(ORDER.includes(route.query.s) ? route.query.s : 'signals')
const q = ref('')
const sortK = ref(''), sortDir = ref(-1)
const shown = ref(100)
const cache = {}
const data = ref(null), err = ref(''), loading = ref(false)

watch(set, async s => {
  router.replace({ query: s === 'signals' ? {} : { s } })
  sortK.value = SETS[s].sort; sortDir.value = -1; shown.value = 100; err.value = ''
  if (cache[s]) { data.value = cache[s]; return }
  loading.value = true; data.value = null
  try { data.value = cache[s] = await api.get('/api/tsa/' + s) } catch (e) { err.value = e.message } finally { loading.value = false }
}, { immediate: true })

const cfg = computed(() => SETS[set.value])
const codeK = computed(() => cfg.value.cols.find(c => c.tk).k)
const rows = computed(() => {
  const s = q.value.trim().toLowerCase()
  const list = (data.value?.rows || []).filter(r => !s || cfg.value.cols.some(c => !c.num && String(r[c.k] ?? '').toLowerCase().includes(s)))
  const k = sortK.value
  return list.slice().sort((a, b) => {
    const x = a[k], y = b[k]
    if (x == null || x === '') return 1
    if (y == null || y === '') return -1
    const nx = Number(x), ny = Number(y)
    return (isNaN(nx) || isNaN(ny) ? String(x).localeCompare(String(y)) : nx - ny) * sortDir.value
  })
})
function sortBy(k) { if (sortK.value === k) sortDir.value = -sortDir.value; else { sortK.value = k; sortDir.value = -1 } }
const meta = computed(() => data.value?.meta || null)
// Cakupan dari server: akun tradersaham tanpa akses penuh hanya mendapat pratinjau sebagian emiten.
const cakupan = computed(() => meta.value?.cakupan?.[set.value] || meta.value?.cakupan?.[set.value + '-v2'] || null)
</script>

<template>
  <div class="intel">
    <header class="head">
      <div>
        <h1>Intel Pasar</h1>
        <p v-if="meta" class="small muted sub">Sumber tradersaham.com · data tanggal {{ meta.tanggal_data }} · diperbarui {{ meta.tarik }}</p>
      </div>
      <input v-model="q" data-search type="search" class="field" placeholder="Cari kode, nama, sektor" @input="shown = 100">
    </header>

    <div class="bar-row">
      <div role="group" aria-label="Sumber data" class="seg">
        <button v-for="k in ORDER" :key="k" type="button" :aria-pressed="String(set === k)" @click="set = k">{{ SETS[k].l }}</button>
      </div>
      <span class="small muted">{{ cfg.note }} {{ rows.length.toLocaleString('id-ID') }} emiten.</span>
    </div>

    <p v-if="cakupan?.pratinjau" class="note small">Pratinjau: akun tradersaham yang dipakai hanya mendapat {{ cakupan.diambil }} dari {{ cakupan.total.toLocaleString('id-ID') }} emiten untuk {{ cfg.l.toLowerCase() }}. Data lengkap butuh akses berbayar di tradersaham.</p>
    <p v-if="loading" class="muted">Memuat…</p>
    <p v-else-if="err" class="warn">{{ err }}</p>
    <section v-else class="sheet box" aria-label="Tabel intel pasar">
      <table class="ledger">
        <thead><tr>
          <th v-for="c in cfg.cols" :key="c.k" class="lbl" :class="{ num: c.num }" :aria-sort="sortK === c.k ? (sortDir > 0 ? 'ascending' : 'descending') : 'none'">
            <button type="button" class="sortb" :class="sortK === c.k ? (sortDir > 0 ? 'asc' : 'desc') : ''" @click="sortBy(c.k)">{{ c.l }}</button>
          </th>
        </tr></thead>
        <tbody>
          <tr v-for="r in rows.slice(0, shown)" :key="r[codeK]">
            <td v-for="c in cfg.cols" :key="c.k" :class="[{ num: c.num, w: c.w }, c.t ? c.t(r[c.k]) : '']">
              <RouterLink v-if="c.tk" class="ticker" :to="{ path: '/emiten/' + r[c.k], query: { tab: 'intel' } }">{{ r[c.k] }}</RouterLink>
              <template v-else>{{ c.f ? c.f(r[c.k]) : (r[c.k] ?? '–') }}</template>
            </td>
          </tr>
          <tr v-if="!rows.length"><td :colspan="cfg.cols.length" class="muted">Tidak ada yang cocok.</td></tr>
        </tbody>
      </table>
    </section>
    <button v-if="rows.length > shown" type="button" class="btn more" @click="shown += 200">Tampilkan lebih banyak ({{ (rows.length - shown).toLocaleString('id-ID') }} lagi)</button>
  </div>
</template>

<style scoped>
.intel{display:flex;flex-direction:column;gap:14px;padding-bottom:56px}
.head{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;justify-content:space-between}
.head .field{width:260px;max-width:100%}
.sub{margin:2px 0 0}
.bar-row{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between}
.seg{display:flex;flex-wrap:wrap}
.seg button{min-height:32px;padding:0 14px;border:1px solid var(--rule);background:var(--sheet);color:var(--ink);font-weight:600;font-size:13.5px;cursor:pointer;margin-left:-1px}
.seg button:first-child{border-radius:3px 0 0 3px;margin-left:0}
.seg button:last-child{border-radius:0 3px 3px 0}
.seg button[aria-pressed="true"]{background:var(--ink);border-color:var(--ink);color:var(--paper);position:relative}
.box{overflow:auto;max-height:74vh}
.ledger thead th{position:sticky;top:0;z-index:1;background:var(--sheet-2)}
.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.w{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
td{font-size:13.5px}
.up{color:var(--good)}.dn{color:var(--strong)}
.more{align-self:center}
.warn{color:var(--strong)}
.note{margin:0;padding:8px 12px;background:var(--warn-bg);color:var(--warn);border-radius:3px}
</style>
