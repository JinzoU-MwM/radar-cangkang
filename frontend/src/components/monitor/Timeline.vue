<script setup>
import { computed } from 'vue'
import { tlX, tlEvents, TL_TODAY, fmtDate } from '../../lib/domain.js'

// Kolom Jadwal: sumbu waktu sama di tiap baris (−4 bln s.d. +2 bln), garis oranye = hari ini.
// head = isi judul kolom (label sumbu); tanpa head = sel baris untuk `item`.
const props = defineProps({ item: Object, head: Boolean })
const today = new Date().toISOString().slice(0, 10)
const ev = computed(() => props.item ? tlEvents(props.item) : [])
const marks = computed(() => ev.value.map(e => ({ ...e, x: tlX(e.date), fut: e.date > today })).filter(e => e.x != null))
const bar = computed(() => {
  const t = props.item?.tender
  const a = t?.start ? tlX(t.start.slice(0, 10)) : null, b = t?.end ? tlX(t.end.slice(0, 10)) : null
  return a != null && b != null
    ? { left: a, width: (b - a).toFixed(2), tip: `Penawaran tender wajib ${fmtDate(t.start.slice(0, 10))} s.d. ${fmtDate(t.end.slice(0, 10))}` } : null
})
const last = computed(() => [...ev.value].reverse().find(e => e.date <= today))
const next = computed(() => ev.value.find(e => e.date > today))
</script>

<template>
  <span v-if="head" class="ax" aria-hidden="true">
    <span style="left:0">−4 bln</span><span class="tn" :style="{ left: TL_TODAY + '%' }">Hari ini</span><span style="right:0">+2 bln</span>
  </span>
  <span v-else-if="!ev.length && !bar" class="muted small">belum bertanggal</span>
  <div v-else class="tlw">
    <div class="tl">
      <i class="today" :style="{ left: TL_TODAY + '%' }" title="Hari ini"></i>
      <span v-if="bar" class="span" :style="{ left: bar.left + '%', width: bar.width + '%' }" :title="bar.tip"></span>
      <span v-for="(e, i) in marks" :key="i" class="ev" :class="{ fut: e.fut }" :style="{ left: e.x + '%' }" :title="`${e.label} · ${fmtDate(e.date)}`"></span>
    </div>
    <div class="cap small">
      <template v-if="last">{{ last.label }} <b>{{ fmtDate(last.date) }}</b></template>
      <template v-if="last && next"> · </template>
      <span v-if="next" class="nx">{{ next.label }} <b>{{ fmtDate(next.date) }}</b></span>
    </div>
  </div>
</template>

<style scoped>
.ax{position:relative;display:block;height:14px;margin-top:2px;font-size:11px;text-transform:none;letter-spacing:0}
.ax span{position:absolute;top:0;white-space:nowrap}
.ax .tn{transform:translateX(-50%);color:var(--now-ink)}
.tlw{min-width:200px}
.tl{position:relative;height:16px}
.tl::before{content:"";position:absolute;left:0;right:0;top:7px;height:1px;background:var(--rule-2)}
.today{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:var(--now)}
.span{position:absolute;top:5px;height:6px;border-radius:3px;background:var(--range);box-shadow:inset 0 0 0 1px var(--accent)}
.ev{position:absolute;top:3px;width:9px;height:9px;margin-left:-4.5px;border-radius:50%;background:var(--accent);border:1px solid var(--sheet)}
.ev.fut{background:var(--sheet);border:2px solid var(--now)}
.cap{color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px}
.cap b{font-weight:600;color:var(--ink)}
.nx,.nx b{color:var(--now-ink)}
</style>
