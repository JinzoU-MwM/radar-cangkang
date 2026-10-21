<script setup>
import { computed } from 'vue'
import { storyOf } from '../../store.js'
import { STAGES, stageOf, num, fmt, fmtDate } from '../../lib/domain.js'

// Sel baris set "Story": ringkasan cerita backdoor (bisnis lama ke baru, pengendali, injeksi, progress).
const props = defineProps({ r: Object })
const s = computed(() => storyOf(props.r.t) || {})
const d = computed(() => props.r.item)
const ctrl = computed(() => num(d.value.ctrlPct))
const stName = computed(() => (STAGES.find(x => x.id === stageOf(d.value)) || STAGES[0]).name)
const to = computed(() => ({ path: '/emiten/' + props.r.t, query: { tab: 'story' } }))
</script>

<template>
  <td class="em">
    <RouterLink class="ticker" :to="to">{{ r.t }}</RouterLink>
    <div class="nm" :title="d.name">{{ d.name }}</div>
    <span class="deal" :class="r.deal">{{ r.deal === 'selesai' ? 'Selesai' : 'Proses' }}</span>
  </td>
  <td class="biz">
    <div class="old"><span class="lbl">Lama</span> {{ s.lama || (s.loaded ? 'belum ada' : 'belum dimuat') }}</div>
    <div class="new"><span class="lbl">Baru</span> {{ s.baru || 'belum terungkap di laporan' }}</div>
  </td>
  <td class="who">
    <div class="nmw">{{ s.oldName || (s.loaded ? 'tidak tercatat' : 'belum dimuat') }}
      <span v-if="s.oldInferred" class="tag t-calm" title="Penjual tidak tercatat; ini pemegang 20% ke atas terakhir sebelum pengambilalihan">perkiraan</span></div>
    <template v-if="s.oldPct"><span class="pct">{{ fmt(Math.min(100, s.oldPct), 2) }}%</span><span class="hbar old"><i :style="{ width: Math.min(100, s.oldPct) + '%' }"></i></span></template>
  </td>
  <td class="who">
    <div class="nmw">{{ d.ctrlName || d.acquirer || '–' }}</div>
    <div v-if="s.takeoverDate" class="small muted">sejak {{ fmtDate(s.takeoverDate) }}</div>
    <template v-if="ctrl != null"><span class="pct">{{ fmt(ctrl, 2) }}%</span><span class="hbar"><i :style="{ width: Math.min(100, ctrl) + '%' }"></i></span></template>
  </td>
  <td class="inj" :title="s.inject || ''">
    <template v-if="s.inject"><b>{{ s.injType || s.inject }}</b><div v-if="s.injCo" class="small muted">{{ s.injCo }}</div></template>
    <span v-else class="muted">Belum diumumkan</span>
    <div v-if="s.nominal" class="small">{{ s.nominal }}</div>
  </td>
  <td class="pg">
    <div class="row"><span class="n">{{ r.prog.est ? '±' : '' }}{{ r.prog.pct }}%</span><span class="hbar" :class="{ est: r.prog.est }"><i :style="{ width: r.prog.pct + '%' }"></i></span></div>
    <div class="small muted">{{ stName }}</div>
  </td>
</template>

<style scoped>
.em{min-width:130px;max-width:180px}
.nm{font-size:12px;color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.deal{display:inline-block;font-size:12px;font-weight:600;padding:1px 8px;border-radius:2px;margin-top:3px;box-shadow:inset 0 0 0 1px var(--ink)}
.deal.selesai{background:var(--accent);color:var(--accent-ink);box-shadow:none}
.biz{min-width:240px;max-width:340px;font-size:13px}
.biz > div{padding:2px 6px;border-radius:2px;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2}
.biz .old{background:var(--calm-bg)}
.biz .new{background:var(--accent-soft);margin-top:3px}
.biz .lbl{font-size:11px;margin-right:4px}
.who{min-width:150px;max-width:220px;font-size:13px}
.nmw{overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2}
.pct{font-weight:600;font-size:12.5px}
.hbar{display:block;height:6px;border-radius:3px;background:var(--rule-2);overflow:hidden;margin-top:2px;max-width:130px}
.hbar i{display:block;height:100%;background:var(--accent);border-radius:3px}
.hbar.old i{background:var(--calm)}
.hbar.est i{background:repeating-linear-gradient(90deg,var(--accent) 0 4px,transparent 4px 7px)}
.inj{min-width:150px;max-width:220px;font-size:13px}
.pg{min-width:140px}
.row{display:flex;align-items:center;gap:8px}
.row .hbar{flex:1;margin:0}
.n{font:700 16px var(--f-display);min-width:40px}
</style>
