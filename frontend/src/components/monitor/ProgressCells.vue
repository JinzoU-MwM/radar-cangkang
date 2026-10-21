<script setup>
import { computed } from 'vue'
import { store } from '../../store.js'
import { SIGNALS, STATUS_LABEL, num, fmt } from '../../lib/domain.js'
import StageTrack from '../StageTrack.vue'
import Timeline from './Timeline.vue'
import ProgressCell from './ProgressCell.vue'

// Sel baris set "Progress" (port tableFor PR #1). maxCap = kapitalisasi terbesar di daftar, skala bar log.
const props = defineProps({ r: Object, maxCap: Number })
const d = computed(() => props.r.item)
const price = computed(() => num(d.value.price))
const vsPtw = computed(() => price.value && d.value.tender?.price ? price.value / d.value.tender.price - 1 : null)
const cap = computed(() => num(d.value.mcap))
const ctrl = computed(() => num(d.value.ctrlPct))
const fl = computed(() => num(d.value.float))
const active = computed(() => SIGNALS.filter(s => s.auto ? s.auto(d.value) : (d.value.flags || {})[s.id]))
const capW = computed(() => cap.value ? (Math.log10(cap.value + 1) / Math.log10((props.maxCap || 1) + 1) * 100).toFixed(0) : 0)
</script>

<template>
  <td class="em">
    <RouterLink class="ticker" :to="'/emiten/' + r.t">{{ r.t }}</RouterLink>
    <div class="nm" :title="d.name">{{ d.name }}<template v-if="d.acquirer"> ke {{ d.acquirer }}</template></div>
  </td>
  <td class="st">
    <span class="deal" :class="r.deal">{{ r.deal === 'selesai' ? 'Selesai' : 'Proses' }}</span>
    <StageTrack :item="d" />
    <div class="small"><b>Posisi:</b> {{ r.pos.now }}</div>
    <div v-if="r.pos.next" class="small muted clamp" :title="r.pos.next"><b>Selanjutnya:</b> {{ r.pos.next }}</div>
  </td>
  <td><Timeline :item="d" /></td>
  <td><ProgressCell :prog="r.prog" :kjpp="store.aset[r.t]?.kjpp" /></td>
  <td>
    <div class="score"><span class="n">{{ r.score }}</span><span class="bar" :class="r.status"><i :style="{ width: r.score + '%' }"></i></span></div>
    <span class="tag" :class="'st-' + r.status">{{ STATUS_LABEL[r.status] }}</span>
  </td>
  <td class="num">
    <b>{{ price != null ? 'Rp' + fmt(price) : '–' }}</b>
    <div v-if="vsPtw != null" class="small"><span :class="vsPtw >= 0 ? 'up' : 'down'">{{ vsPtw >= 0 ? '+' : '' }}{{ (vsPtw * 100).toFixed(0) }}%</span> vs PTW</div>
    <div class="small muted">Kap. {{ cap != null ? fmt(cap, 1) + ' M' : '–' }}</div>
    <span v-if="cap" class="hbar"><i :style="{ width: capW + '%' }"></i></span>
  </td>
  <td class="num ctrl" :title="d.ctrlGuess ? 'Stockbit tidak memberi label pengendali; ditampilkan pemegang terbesar selain publik' : ''">
    <template v-if="ctrl != null">
      <b>{{ fmt(ctrl, 2) }}%</b>
      <span class="hbar"><i :style="{ width: Math.min(100, ctrl) + '%' }"></i></span>
      <div v-if="d.ctrlName" class="small muted holder">{{ d.ctrlName }}{{ d.ctrlGuess ? ' (pemegang terbesar*)' : '' }}</div>
    </template>
    <span v-else>–</span>
    <div class="small">Publik <b v-if="fl != null">{{ fmt(fl, 1) }}%</b><template v-else>–</template>
      <span v-if="fl != null && fl < 7.5" class="tag t-strong" title="Di bawah batas minimum BEI 7,5%; pengendali wajib refloat dalam 2 tahun">&lt; 7,5%</span></div>
    <span v-if="fl != null" class="hbar pub" :class="{ low: fl < 7.5 }"><i :style="{ width: Math.min(100, fl) + '%' }"></i></span>
  </td>
  <td>
    <div class="chips"><span v-for="s in active" :key="s.id" class="chip" :class="'c-' + s.id">{{ s.short }}</span></div>
  </td>
</template>

<style scoped>
.em{min-width:150px;max-width:200px}
.nm{font-size:12px;color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.st{min-width:200px;max-width:260px}
.st .small{line-height:1.35;margin-top:2px}
.clamp{overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;line-clamp:3}
.deal{display:inline-block;font-size:12px;font-weight:600;padding:1px 8px;border-radius:2px;margin-bottom:4px;box-shadow:inset 0 0 0 1px var(--ink)}
.deal.selesai{background:var(--accent);color:var(--accent-ink);box-shadow:none}
.num{text-align:right;min-width:120px}
.score{display:flex;align-items:center;gap:6px;margin-bottom:3px}
.score .n{font:700 16px var(--f-display);min-width:24px}
.bar{width:64px;height:6px;border-radius:3px;background:var(--rule-2);overflow:hidden}
.bar i{display:block;height:100%;border-radius:3px}
.bar.strong i{background:var(--accent)} .bar.warn i{background:var(--warn)} .bar.calm i{background:var(--calm)}
.hbar{display:block;height:6px;border-radius:3px;background:var(--rule-2);overflow:hidden;margin:3px 0 3px auto;width:100%;max-width:120px}
.hbar i{display:block;height:100%;margin-left:auto;background:var(--accent);border-radius:3px}
.hbar.pub i{background:var(--calm)}
.hbar.pub.low i{background:var(--strong)}
.holder{max-width:170px;margin-left:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ctrl .tag{margin-left:4px}
.up{color:var(--good)} .down{color:var(--strong)}
.chips{display:flex;flex-wrap:wrap;gap:4px;min-width:160px;max-width:240px}
.chip{font-size:12px;padding:0 6px;border:1px solid var(--rule);border-radius:2px;white-space:nowrap;color:var(--ink-2)}
.c-akuisisi{background:var(--accent-soft);color:var(--ink);border-color:var(--accent-soft)}
.c-rights,.c-kbli{background:var(--warn-bg);color:var(--warn);border-color:var(--warn-bg)}
.c-uma,.c-volume{background:var(--strong-bg);color:var(--strong);border-color:var(--strong-bg)}
</style>
