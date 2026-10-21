<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '../../api.js'
import { store, itemOf, saveItem, toast, getBenchmark } from '../../store.js'
import { big, num, pctTxt, rp, stageOf } from '../../lib/domain.js'

const props = defineProps({ ticker: { type: String, required: true } })
const item = computed(() => itemOf(props.ticker))

const p = ref(null)
const bm = ref(null)
const err = ref('')
const loading = ref(true)


// Simpan kapitalisasi, free float, dan pengendali ke data radar (dipakai skor), hanya bila berubah.
async function writeBack(pr) {
  const it = item.value
  if (!it || !(pr.stats?.marketCap || pr.stats?.freeFloat)) return
  const ctrl = (pr.shareholders || []).filter(h => h.pengendali)
  const next = {
    ...it,
    mcap: pr.stats.marketCap ? Math.round(pr.stats.marketCap / 1e8) / 10 : it.mcap,
    float: pr.stats.freeFloat ?? it.float,
    ctrlPct: ctrl.length ? Math.round(ctrl.reduce((s, h) => s + parseFloat(h.pct), 0) * 100) / 100 : it.ctrlPct,
    ctrlName: ctrl.length ? ctrl.map(h => h.name).join(', ') : it.ctrlName,
  }
  if (['mcap', 'float', 'ctrlPct', 'ctrlName'].some(k => next[k] !== it[k])) {
    try { await saveItem(next) } catch (e) { toast('Gagal menyimpan data profil: ' + e.message, true) }
  }
}

onMounted(async () => {
  try {
    p.value = await api.get('/api/profile', { ticker: props.ticker })
    writeBack(p.value)
    bm.value = await getBenchmark().catch(() => null)
  } catch (e) {
    err.value = e.message || 'server lokal tidak merespons'
  } finally {
    loading.value = false
  }
})

const price = computed(() => num(item.value?.price) ?? (p.value?.chart?.length ? p.value.chart[p.value.chart.length - 1].v : null))
const isCandidate = computed(() => !item.value || stageOf(item.value) === 'radar')
const dec = v => String(v).replace('.', ',')
const bg = v => v == null ? 'belum ada' : big(v)
const idn = v => (+v).toLocaleString('id-ID')

const kpi = computed(() => {
  const m = p.value.metrics || {}, s = p.value.stats || {}
  return [
    ['Harga', price.value != null ? rp(price.value) : 'belum ada'],
    ['Kap. pasar', s.marketCap ? big(s.marketCap) : 'belum ada'],
    ['Free float', s.freeFloat != null ? idn(s.freeFloat) + '%' : 'belum ada'],
    ['PBV', m.pbv != null ? idn(m.pbv) + '×' : 'belum ada'],
    ['Return 1 th', m.ret1y || 'belum ada'],
    ['YTD', m.ytd || 'belum ada'],
  ]
})

// Level acuan harga + skenario backdoor dari kasus nyata (port openProfile lama). Bukan rekomendasi.
const levels = computed(() => {
  const m = p.value.metrics || {}, d = item.value || {}, rows = []
  if (m.bvps != null) rows.push(['Nilai buku per saham (PBV 1×)', m.bvps, 'Batas fundamental; PBV saat ini ' + (m.pbv ?? 'belum ada') + '×'])
  if (d.tender?.price) rows.push(['Harga penawaran tender wajib', d.tender.price, `PTW ${d.tender.start || ''} s.d. ${d.tender.end || ''}`])
  if (m.low52 != null) rows.push(['Terendah 52 minggu', m.low52, ''])
  if (m.high52 != null) rows.push(['Tertinggi 52 minggu', m.high52, ''])
  const b = bm.value, own = b?.deals?.find(r => r.ticker === props.ticker)
  if (own) {
    rows.push(['Harga pra-rumor', own.base, 'Terendah 240 hari sebelum PTW'])
    rows.push(['Puncak siklus backdoor', own.peak, `${dec((own.peak / own.base).toFixed(1))}× harga pra-rumor`])
  } else if (isCandidate.value && b?.n && price.value) {
    rows.push([`Pola backdoor kuartil 1 (${dec(b.runupQ1)}×)`, price.value * b.runupQ1, `Dari ${b.n} kasus · dasar harga sekarang`])
    rows.push([`Pola backdoor median (${dec(b.runupMedian)}×)`, price.value * b.runupMedian, `Dari ${b.n} kasus · dasar harga sekarang`])
  }
  return rows.sort((a, b2) => a[1] - b2[1])
})

// Garis harga 1 tahun sebagai SVG polyline.
const W = 320, H = 72
const spark = computed(() => {
  const c = (p.value?.chart || []).filter(x => x.v != null)
  if (c.length < 2) return null
  const vs = c.map(x => x.v), lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1
  const pts = c.map((x, i) => `${(i / (c.length - 1) * W).toFixed(1)},${(H - 4 - (x.v - lo) / span * (H - 8)).toFixed(1)}`).join(' ')
  return { pts, lo, hi, first: c[0], last: c[c.length - 1] }
})
const safe = url => /^https?:\/\//.test(url || '')
</script>

<template>
  <p v-if="loading" class="muted">Memuat profil {{ ticker }} dari Stockbit…</p>
  <p v-else-if="err" class="muted">Profil tidak bisa dimuat: {{ err }}. Profil butuh server lokal (jalankan-radar.sh) dan token Stockbit yang masih berlaku.</p>

  <div v-else class="pf">
    <p v-if="p.sector || p.industry" class="small muted">{{ [p.sector, p.industry].filter(Boolean).join(' · ') }}</p>
    <dl class="kpi">
      <div v-for="[k, v] in kpi" :key="k"><dt class="lbl">{{ k }}</dt><dd>{{ v }}</dd></div>
    </dl>

    <div class="grid2">
      <section class="rule-top">
        <h2 class="lbl">Pengendali dan pemegang saham</h2>
        <div class="scroll">
          <table class="ledger">
            <thead><tr><th class="lbl">Pemegang</th><th class="lbl r">Porsi</th><th class="lbl r">Saham</th></tr></thead>
            <tbody>
              <tr v-if="!p.shareholders?.length"><td colspan="3" class="muted">belum ada</td></tr>
              <tr v-for="h in p.shareholders" :key="h.name">
                <td>{{ h.name }} <span v-if="h.pengendali" class="tag t-calm">Pengendali</span></td>
                <td class="r">{{ h.pct }}</td><td class="r">{{ h.value }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="p.beneficiary?.length" class="small">Pemilik manfaat (UBO): {{ p.beneficiary.join(', ') }}</p>
      </section>

      <section class="rule-top">
        <h2 class="lbl">Potensi target harga</h2>
        <div class="scroll">
          <table class="ledger">
            <thead><tr><th class="lbl">Level acuan</th><th class="lbl r">Harga</th><th class="lbl r">vs harga kini</th></tr></thead>
            <tbody>
              <tr v-if="!levels.length"><td colspan="3" class="muted">Data belum cukup</td></tr>
              <tr v-for="r in levels" :key="r[0]">
                <td>{{ r[0] }}<div v-if="r[2]" class="small muted">{{ r[2] }}</div></td>
                <td class="r num">{{ rp(r[1]) }}</td>
                <td class="r num">{{ pctTxt(r[1], price) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="bm?.n" class="small muted">
          Dari {{ bm.n }} transaksi backdoor di radar, harga naik median {{ dec(bm.runupMedian) }}× dari titik terendah pra-rumor ke puncak,
          lalu median harga kini {{ dec(bm.postMedian) }}× harga saat PTW. Kenaikan umumnya terjadi sebelum atau saat pengumuman dan sering tidak bertahan.
          <template v-if="isCandidate"> Untuk kandidat, pola ini hanya berlaku bila emiten benar-benar menjadi target backdoor.</template>
        </p>
        <p class="small muted">Level acuan, bukan rekomendasi beli atau jual.</p>
      </section>

      <section class="rule-top">
        <h2 class="lbl">Harga 1 tahun</h2>
        <template v-if="spark">
          <svg class="spark" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" role="img"
            :aria-label="`Harga 1 tahun dari ${rp(spark.first.v)} ke ${rp(spark.last.v)}, terendah ${rp(spark.lo)}, tertinggi ${rp(spark.hi)}`">
            <polyline :points="spark.pts" fill="none" stroke="var(--accent)" stroke-width="1.6" vector-effect="non-scaling-stroke" />
          </svg>
          <div class="small muted sp">
            <span>{{ spark.first.d }} · {{ rp(spark.first.v) }}</span>
            <span>rentang {{ rp(spark.lo) }}–{{ rp(spark.hi) }}</span>
            <span>{{ spark.last.d }} · {{ rp(spark.last.v) }}</span>
          </div>
        </template>
        <p v-else class="muted">belum ada</p>
      </section>

      <section class="rule-top">
        <h2 class="lbl">Pengurus</h2>
        <p><b>Direksi:</b> {{ p.directors?.join(', ') || 'belum ada' }}</p>
        <p><b>Komisaris:</b> {{ p.commissioners?.join(', ') || 'belum ada' }}</p>
        <h2 class="lbl">Fundamental</h2>
        <p>Ekuitas {{ bg(p.metrics?.equity) }} · Kas {{ bg(p.metrics?.cash) }} · Aset {{ bg(p.metrics?.assets) }}</p>
        <p>EPS (disetahunkan) {{ p.metrics?.epsAnn ?? 'belum ada' }} · Pertumbuhan pendapatan (YoY) {{ p.metrics?.revGrowth || 'belum ada' }} · Margin laba bersih {{ p.metrics?.netMargin || 'belum ada' }}</p>
      </section>
    </div>

    <section class="rule-top">
      <h2 class="lbl">Profil perusahaan</h2>
      <p class="prose">{{ p.background || 'belum ada' }}</p>
      <p class="small muted">
        <template v-if="p.office">{{ p.office }} · </template>
        <template v-if="safe(p.website)"><a :href="p.website" target="_blank" rel="noopener">{{ p.website }}</a> · </template>
        <a :href="'https://stockbit.com/symbol/' + ticker" target="_blank" rel="noopener">Stockbit</a>
      </p>
    </section>

    <section v-if="item?.notes" class="rule-top">
      <h2 class="lbl">Catatan radar</h2>
      <p class="prose">{{ item.notes }}</p>
    </section>
  </div>
</template>

<style scoped>
.pf{display:flex;flex-direction:column;gap:20px}
.pf>p{margin:0}
.lbl{margin:0 0 8px}
section p{margin:0 0 6px}
section .lbl+p,section p+.lbl{margin-top:4px}
/* Baris KPI ringkas bergaris, bukan kartu. */
.kpi{display:flex;flex-wrap:wrap;margin:0;border-top:2px solid var(--ink);border-bottom:1px solid var(--rule)}
.kpi>div{padding:8px 18px 8px 0;margin-right:18px;border-right:1px solid var(--rule-2)}
.kpi>div:last-child{border-right:0}
.kpi dt{margin:0}
.kpi dd{margin:0;font:700 22px/1.1 var(--f-display)}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:22px 20px}
.scroll{overflow-x:auto}
.ledger{font-size:13px}
.r{text-align:right}
.spark{width:100%;height:72px;display:block;background:var(--sheet);border-bottom:1px solid var(--rule)}
.sp{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:4px}
.prose{max-width:90ch}
@media (max-width:760px){.grid2{grid-template-columns:1fr}.kpi>div{border-right:0;padding-right:0}}
</style>
