<script setup>
import { computed } from 'vue'
import { store, userRefresh } from '../../store.js'
import { fmtDate } from '../../lib/domain.js'
import { newsConclusion } from '../../lib/newsConclusion.js'
import NewsItem from '../NewsItem.vue'
import PenjelasanBursa from './PenjelasanBursa.vue'

const props = defineProps({ ticker: { type: String, required: true } })
const list = computed(() => store.updates.filter(u => u.ticker === props.ticker)
  .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))))
// Dikelompokkan per tanggal, sama seperti halaman Berita.
const groups = computed(() => {
  const out = []
  for (const u of list.value) {
    const d = String(u.date || '').slice(0, 10)
    let g = out[out.length - 1]
    if (!g || g.d !== d) out.push(g = { d, label: d ? fmtDate(d) : 'Tanpa tanggal', rows: [] })
    g.rows.push(u)
  }
  return out
})
const sum = computed(() => newsConclusion(list.value, { ticker: props.ticker }))
// Server memperbarui berita otomatis tiap 2 jam (newsAt = waktu pembaruan terakhir).
const newsAt = computed(() => store.status?.newsAt ? new Date(store.status.newsAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '')
</script>

<template>
  <PenjelasanBursa v-if="store.riDoc?.[ticker]?.penjelasanBursa" :pb="store.riDoc[ticker].penjelasanBursa" />
  <section class="rule-top">
    <div class="bar">
      <h2 class="lbl">Laporan dan berita {{ ticker }}</h2>
      <button v-if="!store.status?.readOnly" type="button" class="btn" :disabled="store.busy.reports" @click="userRefresh('reports')">
        {{ store.busy.reports ? 'Memperbarui…' : 'Perbarui berita' }}
      </button>
    </div>
    <p v-if="newsAt" class="muted small">Diperbarui otomatis tiap 2 jam; pembaruan terakhir {{ newsAt }}.</p>
    <p v-if="!list.length" class="muted">Belum ada laporan atau berita untuk {{ ticker }}.</p>
    <div v-else class="sheet list">
      <div v-for="g in groups" :key="g.d">
        <h3 class="lbl gd">{{ g.label }}</h3>
        <NewsItem v-for="u in g.rows" :key="u.id" :u="u" :show-ticker="false" />
      </div>
    </div>
    <div v-if="sum" class="concl" :class="'c-' + sum.tone">
      <h3 class="lbl">Kesimpulan akhir</h3>
      <p v-for="(p, i) in sum.paras" :key="i">{{ p }}</p>
      <template v-if="sum.points.length">
        <p class="muted small">Keterbukaan material 30 hari terakhir:</p>
        <ul><li v-for="(p, i) in sum.points" :key="i">{{ p }}</li></ul>
      </template>
      <p class="verdict">{{ sum.verdict }}</p>
    </div>
    <p v-if="list.length" class="muted foot">Latar oranye = belum dilihat sejak terakhir buka. Tingkat sinyal, arah dampak, dan poin dibaca otomatis dari judul dan ringkasan. Penanda poin: segitiga naik hijau = positif bagi pemegang saham publik, segitiga turun merah = negatif atau risiko, bulat kuning = perlu dicermati.</p>
  </section>
</template>

<style scoped>
.bar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap}
.lbl{margin:0}
.list{border-radius:4px}
.gd{margin:0;padding:10px 16px 6px;background:var(--sheet-2);border-bottom:1px solid var(--rule-2);font-family:var(--f-display);font-size:12.5px}
.small{font-size:12px;margin:0 0 8px}
.foot{margin:10px 0 0;font-size:12px}
.concl{margin-top:14px;padding:12px 14px;background:var(--sheet);border:1px solid var(--rule);border-left:3px solid var(--rule-2)}
.concl.c-now{border-left-color:var(--now-ink)}
.concl.c-warn{border-left-color:#ca8a04}
.concl h3{margin:0 0 8px}
.concl p{margin:0 0 6px;line-height:1.55}
.concl ul{margin:0 0 8px;padding-left:18px}
.concl .verdict{font-weight:600;margin:8px 0 0}
</style>
