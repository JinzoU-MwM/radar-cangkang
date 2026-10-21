<script setup>
import { computed } from 'vue'
import { rp } from '../../lib/domain.js'
import StageTrack from '../StageTrack.vue'
import Timeline from './Timeline.vue'

// Sel baris set "Potensi" (port renderPotensi PR #1). r.pot dari potensiOf + harga dasar/puncak benchmark.
const props = defineProps({ r: Object })
const p = computed(() => props.r.pot)
const pc = v => v == null ? null : { cls: v >= 0 ? 'up' : 'down', txt: `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)}%` }
const x1 = v => v.toFixed(1).replace('.', ',') + '×'
// Rentang pra-rumor → puncak (skala log), penanda PTW dan harga kini.
const rng = computed(() => {
  const { base, peak, price, ptw } = p.value
  if (!base || !peak || !price) return null
  const lo = Math.min(base, price, ptw || Infinity), hi = Math.max(peak, price)
  const pos = v => +(Math.log(v / lo) / Math.log(hi / lo || 2) * 100).toFixed(1)
  return { a: pos(base), b: pos(peak), ptw: ptw ? pos(ptw) : null, now: pos(price),
    tip: `Pra-rumor ${rp(base)} · PTW ${rp(ptw)} · kini ${rp(price)} · puncak ${rp(peak)}` }
})
</script>

<template>
  <td class="em">
    <RouterLink class="ticker" :to="'/emiten/' + r.t">{{ r.t }}</RouterLink>
    <div class="nm" :title="r.item.name">{{ r.item.name }}</div>
  </td>
  <td><span class="deal" :class="r.deal">{{ r.deal === 'selesai' ? 'Selesai' : 'Proses' }}</span><StageTrack :item="r.item" /></td>
  <td><Timeline :item="r.item" /></td>
  <td class="num">{{ rp(p.price) }}</td>
  <td class="num">{{ rp(p.ptw) }}
    <div v-if="p.ptw && p.price" class="small muted"><span :class="pc(p.price / p.ptw - 1).cls">{{ pc(p.price / p.ptw - 1).txt }}</span> dari PTW</div>
  </td>
  <td>
    <div v-if="rng" class="rng" :title="rng.tip" role="img" :aria-label="rng.tip">
      <i class="tr" :style="{ left: rng.a + '%', right: (100 - rng.b) + '%' }"></i>
      <i v-if="rng.ptw != null" class="ptw" :style="{ left: rng.ptw + '%' }"></i>
      <i class="now" :style="{ left: rng.now + '%' }"></i>
    </div>
    <span v-else class="muted">–</span>
  </td>
  <td class="num">{{ rp(p.peak) }}
    <div v-if="p.runupPeak" class="small muted">{{ x1(p.runupPeak) }} dari pra-rumor {{ rp(p.base) }}</div>
  </td>
  <td class="num"><span v-if="pc(p.up)" :class="pc(p.up).cls">{{ pc(p.up).txt }}</span><template v-else>–</template></td>
  <td class="num">
    <template v-if="p.down == null">–</template>
    <template v-else-if="p.down > 0"><span class="up">di bawah PTW</span><div class="small muted">{{ pc(p.down).txt }} ke PTW</div></template>
    <span v-else :class="pc(p.down).cls">{{ pc(p.down).txt }}</span>
  </td>
  <td class="nx small">{{ r.prog.next?.label || (r.prog.pct === 100 ? 'Transaksi tuntas' : '–') }}</td>
</template>

<style scoped>
.em{min-width:140px;max-width:190px}
.nm{font-size:12px;color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.deal{display:inline-block;font-size:12px;font-weight:600;padding:1px 8px;border-radius:2px;margin-bottom:4px;box-shadow:inset 0 0 0 1px var(--ink)}
.deal.selesai{background:var(--accent);color:var(--accent-ink);box-shadow:none}
.num{text-align:right;white-space:nowrap;min-width:90px}
.num .small{white-space:normal;min-width:110px;max-width:150px;margin-left:auto}
.up{color:var(--good)} .down{color:var(--strong)}
.rng{position:relative;width:140px;height:14px}
.rng::before{content:"";position:absolute;left:0;right:0;top:4px;height:6px;border-radius:3px;background:var(--rule-2)}
.rng .tr{position:absolute;top:4px;height:6px;border-radius:3px;background:var(--range)}
.rng .ptw{position:absolute;top:0;width:2px;height:14px;margin-left:-1px;background:var(--warn)}
.rng .now{position:absolute;top:2px;width:10px;height:10px;margin-left:-5px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 2px var(--sheet)}
.nx{min-width:160px;max-width:240px;color:var(--ink-2)}
</style>
