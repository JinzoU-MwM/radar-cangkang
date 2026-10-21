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
import { useRouter } from 'vue-router'
import { store } from '../store.js'
import { progressOf } from '../lib/domain.js'
import { CYC_MIN, CYC_MAX, CYCLE_PHASES, cycleModel, daysSince, dayTxt, phaseOf, ratioOf, xTxt } from '../lib/cycle.js'

// Siklus saham backdoor: harga ÷ harga saat PTW terhadap hari sejak PTW (skala log).
// Pita = kuartil 1–3 transaksi historis, garis = median, titik = posisi emiten radar hari ini.
const props = defineProps({ items: { type: Array, default: () => [] } })
const router = useRouter()

const deals = computed(() => props.items.filter(d => d.tender?.start)
  .map(d => `${d.ticker}:${d.tender.start.slice(0, 10)}`).join(','))
const loading = ref(false), error = ref(''), bm = ref(null)
watch(deals, async v => {
  if (!v) { bm.value = null; return }
  loading.value = true; error.value = ''
  try { bm.value = await getBenchmark(v) } catch (e) { error.value = e.message; bm.value = null }
  loading.value = false
}, { immediate: true })

const model = computed(() => cycleModel(bm.value))
const ready = computed(() => model.value.pts.length >= 10)

// Fase tiap emiten radar (termasuk yang belum PTW), tahapan dilengkapi data aset/verified.
const ctx = computed(() => ({ aset: store.aset, verified: store.verified }))
const phases = computed(() => props.items.map(d => ({ d, ph: phaseOf(d, model.value, { ms: progressOf(d, ctx.value).ms, verified: store.verified }) })))
const byPhase = computed(() => Object.fromEntries(CYCLE_PHASES.map(p => [p.id, phases.value.filter(o => o.ph === p.id).map(o => o.d.ticker).sort()])))

const dots = computed(() => phases.value.filter(o => o.d.tender?.start).map(({ d, ph }) => {
  const day = daysSince(d.tender.start), ratio = ratioOf(d, model.value)
  return ratio > 0 && day >= CYC_MIN && day <= CYC_MAX ? { t: d.ticker, day, ratio, ph } : null
}).filter(Boolean))

const W = 1000, H = 330, L = 46, R = 16, T = 14, B = 34
const yr = computed(() => {
  const ys = [...model.value.pts.flatMap(p => [p.q1, p.q3]), ...dots.value.map(o => o.ratio)]
  return { lo: Math.max(0.05, Math.min(...ys) * 0.8), hi: Math.max(...ys) * 1.25 }
})
const x = d => L + (d - CYC_MIN) / (CYC_MAX - CYC_MIN) * (W - L - R)
const y = v => T + (Math.log(yr.value.hi) - Math.log(Math.max(v, yr.value.lo))) / (Math.log(yr.value.hi) - Math.log(yr.value.lo)) * (H - T - B)
const f1 = n => n.toFixed(1)
const medPath = computed(() => model.value.pts.map((p, i) => `${i ? 'L' : 'M'}${f1(x(p.x))},${f1(y(p.md))}`).join(''))
const bandPath = computed(() => {
  const P = model.value.pts
  return `M${P.map(p => `${f1(x(p.x))},${f1(y(p.q3))}`).join('L')}L${[...P].reverse().map(p => `${f1(x(p.x))},${f1(y(p.q1))}`).join('L')}Z`
})
const yTicks = computed(() => [0.1, 0.25, 0.5, 1, 2, 4, 8, 16, 32].filter(v => v >= yr.value.lo && v <= yr.value.hi))
const xTicks = [-240, -120, 0, 120, 240, 360, 480, 600, 720]
const xLbl = d => d === 0 ? 'PTW' : (d > 0 ? '+' : '') + d + ' hr'

// Pita fase mengikuti data: titik dasar & puncak median (puncak bisa terjadi sebelum PTW).
const bands = computed(() => {
  const bD = model.value.baseDay ?? -150, pD = Math.min(model.value.peakDay ?? 0, 0)
  return [[CYC_MIN, bD, 'Akumulasi'], [bD, pD - 10, 'Rumor & run-up'], [pD - 10, 45, 'Puncak & PTW'], [45, 360, 'Distribusi & koreksi'], [360, CYC_MAX, 'Gelombang 2 / normalisasi']]
    .map(([a, b, t]) => ({ x: x(a), w: Math.max(0, x(b) - x(a)), t }))
})

// Label kode hanya bila tidak menimpa label lain yang sudah ditaruh.
const placed = computed(() => {
  const used = []
  return dots.value.map(o => {
    const px = x(o.day), py = y(o.ratio)
    const lbl = !used.some(([qx, qy]) => Math.abs(qx - px) < 42 && Math.abs(qy - py) < 12)
    if (lbl) used.push([px, py])
    return { ...o, px, py, lbl }
  })
})
const href = t => router.resolve({ path: '/emiten/' + t, query: { tab: 'analisa' } }).href
const go = t => router.push({ path: '/emiten/' + t, query: { tab: 'analisa' } })

const ariaLabel = computed(() => {
  const m = model.value
  const counts = CYCLE_PHASES.map(p => `${p.name} ${byPhase.value[p.id].length}`).join(', ')
  return `Kurva siklus median ${m.n} transaksi backdoor, harga dibanding harga saat PTW. Titik dasar median ${dayTxt(m.baseDay)}, puncak median ${dayTxt(m.peakDay)} pada ${xTxt(m.peakX)} harga PTW. Emiten radar per fase: ${counts}.`
})
</script>

<template>
  <div class="cyc">
    <p v-if="loading" class="muted">Menghitung siklus dari harga Stockbit…</p>
    <p v-else-if="error" class="muted">Gagal memuat data siklus: {{ error }}</p>
    <p v-else-if="!ready" class="muted">Data siklus belum tersedia. Butuh token Stockbit dan emiten dengan tanggal PTW.</p>
    <template v-else>
      <p class="muted small cap">
        Kurva median {{ model.n }} transaksi (area arsir = kuartil 1–3), harga ÷ harga saat PTW, skala log.
        Titik = posisi emiten radar hari ini, klik untuk analisa.
      </p>
      <p class="kpi small">
        <span>Titik dasar median <b>{{ dayTxt(model.baseDay) }}</b> ({{ xTxt(model.baseX) }} harga PTW)</span>
        <span>Puncak median <b>{{ dayTxt(model.peakDay) }}</b> ({{ xTxt(model.peakX) }} harga PTW<template v-if="model.peakDay < 0">, pasar sudah memuncak sebelum tender dibuka</template>)</span>
        <span>Kenaikan dasar ke puncak <b>{{ xTxt(bm?.runupMedian) }}</b></span>
        <span>Harga kini vs saat PTW <b>{{ xTxt(bm?.postMedian) }}</b> (median)</span>
      </p>
      <div class="plot">
        <svg :viewBox="`0 0 ${W} ${H}`" class="svg" role="img" :aria-label="ariaLabel">
          <g v-for="(b, i) in bands" :key="b.t">
            <rect class="ph" :class="{ alt: i % 2 }" :x="b.x" :y="T" :width="b.w" :height="H - T - B" />
            <!-- Label pita hanya bila muat; pita sempit tetap terbaca dari pita sebelahnya. -->
            <text v-if="b.w > b.t.length * 6.4 + 8" class="phl" :x="b.x + 4" :y="T + 12">{{ b.t }}</text>
          </g>
          <line v-for="v in yTicks" :key="v" class="grid" :x1="L" :x2="W - R" :y1="y(v)" :y2="y(v)" />
          <text v-for="v in yTicks" :key="'y' + v" class="ax" :x="L - 6" :y="y(v) + 4" text-anchor="end">{{ String(v).replace('.', ',') }}×</text>
          <text v-for="d in xTicks" :key="'x' + d" class="ax" :x="x(d)" :y="H - 12" text-anchor="middle">{{ xLbl(d) }}</text>
          <path class="band" :d="bandPath" />
          <path class="med" :d="medPath" />
          <line class="ref" :x1="x(0)" :x2="x(0)" :y1="T" :y2="H - B" />
          <line class="ref" :x1="L" :x2="W - R" :y1="y(1)" :y2="y(1)" />
          <a v-for="o in placed" :key="o.t" class="dot" :class="'ph-' + o.ph" :href="href(o.t)" @click.prevent="go(o.t)"
            :aria-label="`${o.t}, ${dayTxt(o.day)}, ${xTxt(o.ratio)} harga saat PTW. Buka analisa`">
            <circle :cx="o.px" :cy="o.py" r="6" />
            <text v-if="o.lbl" :x="o.px + 9" :y="o.py + 4">{{ o.t }}</text>
            <title>{{ o.t }} · {{ dayTxt(o.day) }} · {{ xTxt(o.ratio) }} harga saat PTW</title>
          </a>
        </svg>
      </div>
      <div class="phases">
        <section v-for="p in CYCLE_PHASES" :key="p.id" class="phase" :class="'ph-' + p.id">
          <h3><i class="sw" aria-hidden="true"></i>{{ p.name }} <span class="n">{{ byPhase[p.id].length }}</span></h3>
          <p class="small muted">{{ p.tip }}</p>
          <div class="chips">
            <RouterLink v-for="t in byPhase[p.id]" :key="t" class="chip" :to="{ path: '/emiten/' + t, query: { tab: 'analisa' } }">{{ t }}</RouterLink>
            <span v-if="!byPhase[p.id].length" class="small muted">belum ada</span>
          </div>
        </section>
      </div>
      <details class="tbl small">
        <summary>Tabel per transaksi</summary>
        <div class="scroll">
          <table class="ledger">
            <thead><tr><th class="lbl">Kode</th><th class="lbl">Mulai PTW</th><th class="lbl num">Puncak</th><th class="lbl">Hari puncak</th><th class="lbl num">Kini</th></tr></thead>
            <tbody>
              <tr v-for="d in model.deals" :key="d.ticker">
                <td class="ticker">{{ d.ticker }}</td><td>{{ d.start }}</td>
                <td class="num">{{ xTxt(d.peak / d.p0) }}</td><td>{{ dayTxt(d.peakDay) }}</td><td class="num">{{ xTxt(d.last / d.p0) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </template>
    <p class="muted small cap">Fase ditentukan dari hari sejak PTW, posisi harga terhadap harga PTW, dan status injeksi aset. Pola historis, bukan ramalan; tiap saham bisa menyimpang dari kurva median.</p>
  </div>
</template>

<style scoped>
.cyc{display:flex;flex-direction:column;gap:8px;padding-bottom:14px}
.cap{margin:0}
.kpi{margin:0;display:flex;flex-wrap:wrap;gap:4px 18px;color:var(--ink-2)}
.kpi b{color:var(--ink);font:700 15px var(--f-display)}
/* Di layar sempit grafik digeser mendatar agar label sumbu tetap terbaca. */
.plot,.scroll{overflow-x:auto}
.svg{width:100%;min-width:620px;height:auto;display:block}
.ph{fill:var(--sheet-2)}
.ph.alt{fill:var(--sheet)}
.phl{fill:var(--ink-2);font:600 11.5px var(--f-display);letter-spacing:.04em}
.grid{stroke:var(--rule-2);stroke-width:1}
.ax{fill:var(--ink-2);font:12px var(--f-body)}
.ref{stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3}
.band{fill:var(--range);opacity:.55}
.med{fill:none;stroke:var(--ink);stroke-width:2.5;stroke-linejoin:round}

/* Warna fase: dipakai titik grafik dan garis atas tiap bagian fase. */
.ph-pra{--ph:var(--viz-a)}
.ph-ptw{--ph:var(--ink)}
.ph-euf{--ph:var(--strong)}
.ph-dist{--ph:var(--viz-b)}
.ph-bawah{--ph:var(--calm)}
.ph-inj{--ph:var(--good)}
.dot{cursor:pointer}
.dot circle{fill:var(--ph);stroke:var(--sheet);stroke-width:2}
.dot text{fill:var(--ink);font:700 12.5px var(--f-display);paint-order:stroke;stroke:var(--sheet);stroke-width:3px}
.dot:hover circle,.dot:focus-visible circle{stroke:var(--ink);r:8}
.dot:focus{outline:none}

.phases{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px 20px;margin-top:6px}
.phase{border-top:3px solid var(--ph);padding-top:8px;display:flex;flex-direction:column;gap:4px}
.phase h3{margin:0;font:700 16px var(--f-display);display:flex;align-items:center;gap:8px}
.phase p{margin:0}
.sw{width:10px;height:10px;border-radius:50%;background:var(--ph);flex:none}
.n{margin-left:auto;font-size:20px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.chip{border:1px solid var(--rule);border-radius:999px;padding:2px 10px;font:700 13px var(--f-display);letter-spacing:.02em;color:var(--ink);text-decoration:none;background:var(--sheet);min-height:28px;display:inline-flex;align-items:center}
.chip:hover{border-color:var(--ink)}

.tbl summary{cursor:pointer;color:var(--ink-2)}
.tbl table{margin-top:6px}
.num{text-align:right}
</style>
