<script setup>
import { computed } from 'vue'
import { fairGap } from '../lib/domain.js'

// Bar kecil: hijau = rentang nilai wajar, garis = harga; angka selisih lebar tetap.
const props = defineProps({ price: Number, lo: Number, hi: Number })
const ok = computed(() => props.price != null && props.lo != null && props.hi != null)
const geo = computed(() => {
  if (!ok.value) return null
  const max = Math.max(props.price, props.hi) * 1.15
  const pct = v => Math.min(99, v / max * 100) + '%'
  return { zl: pct(props.lo), zw: ((props.hi - props.lo) / max * 100) + '%', px: pct(props.price) }
})
const gap = computed(() => ok.value ? fairGap(props.price, props.lo, props.hi) : null)
</script>

<template>
  <div v-if="ok" class="fb">
    <div class="bar" aria-hidden="true">
      <i class="zone" :style="{ left: geo.zl, width: geo.zw }"></i>
      <i class="tick" :style="{ left: geo.px }"></i>
    </div>
    <span class="gap" :class="gap > 0 ? 'up' : gap < 0 ? 'down' : ''">{{ gap > 0 ? '+' + gap : gap < 0 ? '−' + -gap : '0' }}%</span>
  </div>
  <span v-else class="muted small">belum ada</span>
</template>

<style scoped>
.fb{display:flex;align-items:center;gap:10px}
.bar{position:relative;width:110px;height:8px;background:var(--rule-2);flex:none}
.zone{position:absolute;top:0;bottom:0;background:var(--range)}
.tick{position:absolute;top:-4px;height:16px;width:2px;background:var(--ink)}
.gap{display:inline-block;width:52px;text-align:right;white-space:nowrap;font:700 16px var(--f-display);color:var(--ink-2)}
.gap.up{color:var(--strong)}
.gap.down{color:var(--good)}
</style>
