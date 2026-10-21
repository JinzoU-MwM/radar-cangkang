<script setup>
import { computed } from 'vue'
import { store, userRefresh } from '../../store.js'
import { UTYPES, fmtDate } from '../../lib/domain.js'

const props = defineProps({ ticker: { type: String, required: true } })
const list = computed(() => store.updates.filter(u => u.ticker === props.ticker)
  .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))))
const typeName = id => (UTYPES.find(t => t.id === id) || { name: 'Lainnya' }).name
const isNew = u => store.seenAt && (u.updatedAt || u.date || '') > store.seenAt
const safe = url => /^https?:\/\//.test(url || '')
</script>

<template>
  <section class="rule-top">
    <div class="bar">
      <h2 class="lbl">Laporan dan berita {{ ticker }}</h2>
      <button type="button" class="btn" :disabled="store.busy.reports" @click="userRefresh('reports')">
        {{ store.busy.reports ? 'Memperbarui…' : 'Perbarui berita' }}
      </button>
    </div>
    <p v-if="!list.length" class="muted">Belum ada laporan atau berita untuk {{ ticker }}.</p>
    <div v-else class="scroll">
      <table class="ledger">
        <thead><tr><th class="lbl">Tanggal</th><th class="lbl">Judul</th><th class="lbl">Sumber</th><th class="lbl">Jenis</th></tr></thead>
        <tbody>
          <tr v-for="u in list" :key="u.id">
            <td class="dt" :class="{ fresh: isNew(u) }">{{ u.date ? fmtDate(String(u.date).slice(0, 10)) : 'belum ada' }}</td>
            <td>
              <a v-if="safe(u.url)" :href="u.url" target="_blank" rel="noopener">{{ u.title }}</a>
              <template v-else>{{ u.title }}</template>
            </td>
            <td class="muted">{{ u.source || (/^sb-report-/.test(u.id) ? 'Stockbit Reports' : 'belum ada') }}</td>
            <td><span class="tag t-calm">{{ typeName(u.type) }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.bar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap}
.lbl{margin:0}
.scroll{overflow-x:auto;background:var(--sheet);border:1px solid var(--rule)}
.dt{white-space:nowrap}
.dt.fresh{color:var(--now-ink);font-weight:600}
td a{font-weight:600}
@media (max-width:760px){
  .ledger thead{display:none}
  .ledger tr{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;padding:8px 10px;border-bottom:1px solid var(--rule-2)}
  .ledger td{border:0;padding:0;background:none!important}
  .ledger td:nth-child(2){grid-column:1/-1}
}
</style>
