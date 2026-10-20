<script>
import { api } from '../api.js'

// Benchmark per kumpulan transaksi (kode:tanggal mulai PTW), disimpan 6 jam selama tab terbuka.
const cache = new Map()
async function getBenchmark(deals) {
  const hit = cache.get(deals)
  if (hit && Date.now() - hit.at < 6 * 3600e3) return hit.v
  const v = await api.get('/api/benchmark', { deals })
  cache.set(deals, { v, at: Date.now() })
  return v
}
</script>

<script setup>
import { computed, ref, watch } from 'vue'

// Siklus saham backdoor: harga ÷ harga saat PTW dimulai, terhadap hari sejak PTW (skala log).
// Garis tipis = tiap transaksi, garis tebal = median per 10 hari (minimal 5 transaksi pada hari itu).
const props = defineProps({ items: { type: Array, default: () => [] } })

const deals = computed(() => props.items.filter(d => d.tender?.start)
  .map(d => `${d.ticker}:${d.tender.start.slice(0, 10)}`).join(','))
const loading = ref(false), error = ref(''), bm = ref(null)
watch(deals, async v => {
  if (!v) { bm.value = null; return }
  loading.value = true; error.value = ''
  try { bm.value = await getBenchmark(v) } catch (e) { error.value = e.message; bm.value = null }
  loading.value = false
}, { immediate: true })

const series = computed(() => (bm.value?.deals || []).filter(d => d.series?.length > 1))

const W = 960, H = 320, L = 44, R = 14, T = 12, B = 30
const X0 = -240
const xMax = computed(() => Math.min(720, Math.max(60, ...series.value.map(d => d.series[d.series.length - 1][0]))))
const yr = computed(() => {
  const ys = series.value.flatMap(d => d.series.map(p => p[1])).filter(v => v > 0)
  return { lo: Math.max(0.05, Math.min(1, ...ys) * 0.9), hi: Math.max(1.2, ...ys) * 1.1 }
})
const x = d => L + (d - X0) / (xMax.value - X0) * (W - L - R)
const y = v => T + (Math.log(yr.value.hi) - Math.log(Math.max(v, yr.value.lo))) / (Math.log(yr.value.hi) - Math.log(yr.value.lo)) * (H - T - B)
const line = pts => pts.filter(p => p[0] >= X0 && p[0] <= xMax.value && p[1] > 0)
  .map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('')

// Interpolasi linier nilai deret pada hari h; null di luar rentang deret.
function at(s, h) {
  if (h < s[0][0] || h > s[s.length - 1][0]) return null
  const i = s.findIndex(p => p[0] >= h)
  if (i <= 0) return s[0][1]
  const [x0, y0] = s[i - 1], [x1, y1] = s[i]
  return y0 + (y1 - y0) * (h - x0) / ((x1 - x0) || 1)
}
const median = computed(() => {
  const out = []
  for (let h = X0; h <= xMax.value; h += 10) {
    const ys = series.value.map(d => at(d.series, h)).filter(v => v != null && v > 0).sort((a, b) => a - b)
    if (ys.length < Math.min(5, series.value.length)) continue
    const m = ys.length / 2
    out.push([h, ys.length % 2 ? ys[Math.floor(m)] : (ys[m - 1] + ys[m]) / 2])
  }
  return out
})

const yTicks = computed(() => [0.1, 0.25, 0.5, 1, 2, 4, 8, 16].filter(v => v >= yr.value.lo && v <= yr.value.hi))
const xTicks = computed(() => [-240, -120, 0, 120, 240, 360, 480, 600, 720].filter(d => d <= xMax.value))
const xLbl = d => d === 0 ? 'PTW' : (d > 0 ? '+' : '') + d + ' hr'
const xTxt = v => v == null ? '–' : (Math.round(v * 100) / 100).toLocaleString('id-ID') + '×'
const dayTxt = d => d == null ? '–' : d === 0 ? 'saat PTW' : `${Math.abs(d)} hari ${d < 0 ? 'sebelum' : 'sesudah'} PTW`

// Hover: transaksi terdekat secara vertikal pada hari di bawah kursor.
const hover = ref(null)
function onMove(e) {
  const box = e.currentTarget.getBoundingClientRect()
  const px = (e.clientX - box.left) / box.width * W, py = (e.clientY - box.top) / box.height * H
  const h = Math.round(X0 + (px - L) / (W - L - R) * (xMax.value - X0))
  let best = null
  for (const d of series.value) {
    const v = at(d.series, h)
    if (v == null || v <= 0) continue
    const dist = Math.abs(y(v) - py)
    if (!best || dist < best.dist) best = { t: d.ticker, h, v, dist }
  }
  hover.value = best && best.dist < 40 ? best : null
}
const medAt = h => median.value.length > 1 ? at(median.value, h) : null
</script>

<template>
  <div class="cyc">
    <p v-if="loading" class="muted">Menghitung siklus dari harga Stockbit…</p>
    <p v-else-if="error" class="muted">Gagal memuat data siklus: {{ error }}</p>
    <p v-else-if="!series.length" class="muted">Belum ada data siklus. Butuh token Stockbit dan emiten dengan tanggal PTW.</p>
    <template v-else>
      <p class="muted small cap">
        Harga ÷ harga saat PTW dimulai, {{ series.length }} transaksi, skala log. Garis tebal = median, garis tipis = tiap emiten.
      </p>
      <p class="read small" aria-live="polite">
        <template v-if="hover"><b class="ticker">{{ hover.t }}</b> {{ xTxt(hover.v) }} harga PTW, {{ dayTxt(hover.h) }}
          <span class="muted"> · median {{ xTxt(medAt(hover.h)) }}</span></template>
        <span v-else class="muted">Arahkan kursor ke garis untuk melihat kodenya.</span>
      </p>
      <div class="plot">
      <svg :viewBox="`0 0 ${W} ${H}`" class="svg" role="img" :aria-label="`Kurva siklus ${series.length} saham backdoor terhadap harga PTW`"
        @pointermove="onMove" @pointerleave="hover = null">
        <g class="grid">
          <line v-for="v in yTicks" :key="v" :x1="L" :x2="W - R" :y1="y(v)" :y2="y(v)" />
        </g>
        <text v-for="v in yTicks" :key="'y' + v" class="ax" :x="L - 6" :y="y(v) + 4" text-anchor="end">{{ String(v).replace('.', ',') }}×</text>
        <text v-for="d in xTicks" :key="'x' + d" class="ax" :x="x(d)" :y="H - 10" text-anchor="middle">{{ xLbl(d) }}</text>
        <line class="ref" :x1="x(0)" :x2="x(0)" :y1="T" :y2="H - B" />
        <line class="ref" :x1="L" :x2="W - R" :y1="y(1)" :y2="y(1)" />
        <path v-for="d in series" :key="d.ticker" class="deal" :class="{ on: hover?.t === d.ticker }" :d="line(d.series)"><title>{{ d.ticker }}</title></path>
        <path v-if="median.length > 1" class="med" :d="line(median)" />
        <circle v-if="hover" class="dot" :cx="x(hover.h)" :cy="y(hover.v)" r="5" />
      </svg>
      </div>
      <details class="tbl small">
        <summary>Tabel per transaksi</summary>
        <table class="ledger">
          <thead><tr><th class="lbl">Kode</th><th class="lbl">Mulai PTW</th><th class="lbl num">Puncak</th><th class="lbl">Hari puncak</th><th class="lbl num">Kini</th></tr></thead>
          <tbody>
            <tr v-for="d in series" :key="d.ticker">
              <td class="ticker">{{ d.ticker }}</td><td>{{ d.start }}</td>
              <td class="num">{{ xTxt(d.peak / d.p0) }}</td><td>{{ dayTxt(d.peakDay) }}</td><td class="num">{{ xTxt(d.last / d.p0) }}</td>
            </tr>
          </tbody>
        </table>
      </details>
    </template>
    <p class="muted small cap">Pola historis, bukan ramalan; tiap saham bisa menyimpang jauh dari median.</p>
  </div>
</template>

<style scoped>
.cyc{display:flex;flex-direction:column;gap:6px;padding-bottom:14px}
.cap,.read{margin:0}
.read{min-height:22px}
.read .ticker{font-size:15px}
/* Di layar sempit grafik digeser mendatar agar label sumbu tetap terbaca. */
.plot{overflow-x:auto}
.svg{width:100%;min-width:620px;height:auto;display:block}
.grid line{stroke:var(--rule-2);stroke-width:1}
.ax{fill:var(--ink-2);font:12px var(--f-body)}
.ref{stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3}
.deal{fill:none;stroke:var(--calm);stroke-width:1;opacity:.35;stroke-linejoin:round}
.deal.on{stroke:var(--viz-a);stroke-width:2;opacity:1}
.med{fill:none;stroke:var(--ink);stroke-width:2.5;stroke-linejoin:round;pointer-events:none}
.dot{fill:var(--viz-a);stroke:var(--sheet);stroke-width:2}
.tbl summary{cursor:pointer;color:var(--ink-2)}
.tbl table{margin-top:6px}
.num{text-align:right}
</style>
