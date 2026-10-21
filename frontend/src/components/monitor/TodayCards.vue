<script setup>
import { computed, onMounted } from 'vue'
import { store, loadDiff, diffOf } from '../../store.js'
import { tlEvents, fmtDate, num } from '../../lib/domain.js'
import { chText, meaningful, fmtPct } from '../../lib/diff.js'
import SikapTag from '../SikapTag.vue'
import StageTrack from '../StageTrack.vue'

// Tampilan "Hari ini": satu kartu per emiten yang punya alasan untuk dilihat sekarang
// (laporan baru, jatuh tempo ≤ 3 hari, harga ±5% atau volume ≥ 3×, perubahan sejak kemarin).
// Bawaan di HP; rows = baris Monitor yang sudah tersaring.
const props = defineProps({ rows: { type: Array, required: true } })
onMounted(() => loadDiff(1))

const day = n => { const t = new Date(Date.now() + n * 864e5); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` }
const cards = computed(() => {
  const today = day(0), soon = day(3)
  return props.rows.map(r => {
    const why = []
    if (r.isNew && r.rep) why.push({ cls: 'now', text: 'Laporan baru: ' + r.rep.title })
    for (const e of tlEvents(r.item).filter(e => e.date >= today && e.date <= soon)) why.push({ cls: 'now', text: `${e.label} ${fmtDate(e.date)}` })
    const chg = num(r.item.chgPct)
    if (chg != null && Math.abs(chg) >= 5) why.push({ cls: chg > 0 ? 'up' : 'dn', text: 'Harga ' + fmtPct(chg) + ' sesi terakhir' })
    if (r.item.volRatio >= 3) why.push({ cls: 'now', text: `Volume ${String(r.item.volRatio).replace('.', ',')}× rata-rata` })
    for (const c of meaningful(diffOf(r.t)).filter(c => c.k !== 'reports' || !r.isNew)) why.push({ cls: '', text: 'Sejak kemarin: ' + chText(c, r.item, { verified: store.verified }) })
    return { r, why }
  }).filter(c => c.why.length).sort((a, b) => b.why.length - a.why.length || a.r.t.localeCompare(b.r.t))
})
const quiet = computed(() => props.rows.length - cards.value.length)
</script>

<template>
  <section aria-label="Hari ini" class="today">
    <p v-if="!cards.length" class="muted empty">Tidak ada laporan baru, jatuh tempo, atau pergerakan besar di emiten hasil filter hari ini.</p>
    <article v-for="{ r, why } in cards" :key="r.t" class="card">
      <header class="top">
        <RouterLink class="ticker" :to="'/emiten/' + r.t">{{ r.t }}</RouterLink>
        <SikapTag :sikap="r.sikap" short />
        <span class="px">
          <b>{{ r.price != null ? r.price.toLocaleString('id-ID') : '–' }}</b>
          <span v-if="num(r.item.chgPct) != null" :class="r.item.chgPct > 0 ? 'up' : r.item.chgPct < 0 ? 'dn' : ''">{{ fmtPct(r.item.chgPct) }}</span>
        </span>
      </header>
      <div v-if="r.item.name" class="nm small muted">{{ r.item.name }}</div>
      <div class="stg"><StageTrack :item="r.item" /><span class="small muted">{{ r.pos.now }}</span></div>
      <ul class="why">
        <li v-for="(w, i) in why" :key="i" :class="w.cls">{{ w.text }}</li>
      </ul>
    </article>
    <p v-if="cards.length && quiet" class="small muted rest">{{ quiet }} emiten lain tanpa perubahan berarti hari ini.</p>
  </section>
</template>

<style scoped>
.today{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.empty,.rest{grid-column:1 / -1;margin:0}
.empty{padding:14px 16px;background:var(--sheet);border:1px solid var(--rule)}
.card{background:var(--sheet);border:1px solid var(--rule);border-top:2px solid var(--ink);padding:12px 14px;display:flex;flex-direction:column;gap:6px;min-width:0}
.top{display:flex;align-items:center;gap:8px}
.top .ticker{font-size:22px}
.px{margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;font-family:var(--f-display);line-height:1.1}
.px b{font-size:18px}
.px span{font-size:13px;font-weight:600;color:var(--ink-2)}
.up{color:var(--good)!important}.dn{color:var(--strong)!important}
.nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.stg{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.why{list-style:none;margin:2px 0 0;padding:0;display:flex;flex-direction:column;gap:4px;font-size:13.5px}
.why li{padding-left:12px;position:relative}
.why li::before{content:"";position:absolute;left:0;top:.55em;width:5px;height:5px;border-radius:50%;background:var(--ink-2)}
.why li.now::before{background:var(--now)}
.why li.up::before{background:var(--good)}
.why li.dn::before{background:var(--strong)}
</style>
