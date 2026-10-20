<script setup>
import { computed, ref } from 'vue'
import { store, storyOf, itemOf } from '../../store.js'
import { big, fmtDate, num, x2 } from '../../lib/domain.js'
import { storyValuation } from '../../lib/emitenExtra.js'
import ControllerDialog from './ControllerDialog.vue'
import InjeksiDialog from './InjeksiDialog.vue'

const props = defineProps({ ticker: { type: String, required: true } })
const emit = defineEmits(['flow'])

const story = computed(() => storyOf(props.ticker))
const pg = computed(() => store.pengendali[props.ticker] || null)
const v = computed(() => store.verified[props.ticker] || null)
// Kartu injeksi bisa diklik bila ada data aset (aset-verified.json) atau relasi injeksi.
const inj = computed(() => !!(store.aset[props.ticker] || store.relasi[props.ticker]?.injeksi))
const sval = computed(() => {
  const mc = num(itemOf(props.ticker)?.mcap)
  return storyValuation(store.aset[props.ticker], { sv: v.value, mcapRp: mc != null ? mc * 1e9 : null })
})

const lama = computed(() => story.value?.lama || '')
const baru = computed(() => story.value?.baru || v.value?.baru || '')
const injText = computed(() => {
  if (v.value?.injectType || v.value?.injectTarget) return [v.value.injectType, v.value.injectTarget].filter(Boolean).join(' · ')
  return story.value?.inject || ''
})
const nominal = computed(() => v.value?.nominal || story.value?.nominal || '')
const ctrl = computed(() => itemOf(props.ticker)?.ctrlName || itemOf(props.ticker)?.acquirer || '')
const target = computed(() => v.value?.target || story.value?.target || '')

const sources = computed(() => {
  const out = []
  if (pg.value?.sumberJudul) out.push(pg.value.sumberJudul + (pg.value.sumberTanggal ? ' · ' + fmtDate(pg.value.sumberTanggal) : ''))
  if (v.value?.sourceTitle) out.push(v.value.sourceTitle + (v.value.sourceDate ? ' · ' + fmtDate(v.value.sourceDate) : ''))
  for (const s of v.value?.sumberTambahan || []) if (!/diakses/i.test(s)) out.push(s)
  return [...new Set(out)]
})

const dlg = ref('')
function toFlow(node) { dlg.value = ''; emit('flow', node) }
</script>

<template>
  <div class="st">
    <button type="button" class="card rule-top click" aria-haspopup="dialog" @click="dlg = 'ctrl'">
      <h2 class="lbl">Siapa pengendali baru</h2>
      <p>{{ pg?.siapa || ctrl || 'belum ada' }}</p>
      <span class="go">Lihat profil lengkap</span>
    </button>

    <section class="card rule-top">
      <h2 class="lbl">Bisnis lama ke baru</h2>
      <div class="biz">
        <span class="chip old">{{ lama || 'belum ada' }}</span>
        <svg width="34" height="14" viewBox="0 0 34 14" role="img" aria-label="menjadi"><path d="M1 7h30M25 1.5 31 7l-6 5.5" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>
        <span class="chip new">{{ baru || 'belum ada' }}</span>
      </div>
    </section>

    <component :is="inj ? 'button' : 'section'" :type="inj ? 'button' : undefined" class="card rule-top" :class="{ click: inj }"
      :aria-haspopup="inj ? 'dialog' : undefined" @click="inj && (dlg = 'inj')">
      <h2 class="lbl">Injeksi</h2>
      <p>{{ injText || 'belum ada' }}<template v-if="nominal"> · {{ nominal }}</template></p>
      <p v-if="sval" class="val">
        <span v-if="sval.sektor" class="tag t-calm">{{ sval.sektor }}</span>
        <span v-if="sval.val" class="small"><b>{{ big(sval.val) }}</b><template v-if="sval.ratio"> · {{ x2(sval.ratio) }} kapitalisasi</template></span>
        <span class="tag" :class="'t-' + sval.kjpp.tone">{{ sval.kjpp.label }}</span>
      </p>
      <p v-if="v?.note" class="small muted">{{ v.note }}</p>
      <span v-if="inj" class="go">Lihat aset, KJPP, dan simulasi</span>
    </component>

    <section class="card rule-top">
      <h2 class="lbl">Rencana</h2>
      <p>{{ pg?.rencana || 'belum ada' }}</p>
    </section>

    <section class="card rule-top judge">
      <h2 class="lbl">Catatan</h2>
      <p>{{ pg?.catatan || 'belum ada' }}</p>
    </section>

    <section class="card rule-top">
      <h2 class="lbl">Target</h2>
      <p>{{ target || 'belum ada' }}</p>
    </section>

    <section class="card rule-top wide">
      <h2 class="lbl">Sumber</h2>
      <ul v-if="sources.length" class="small"><li v-for="s in sources" :key="s">{{ s }}</li></ul>
      <p v-else class="muted">belum ada</p>
    </section>

    <ControllerDialog v-if="dlg === 'ctrl'" :ticker="ticker" @close="dlg = ''" @flow="toFlow" />
    <InjeksiDialog v-if="dlg === 'inj'" :ticker="ticker" @close="dlg = ''" />
  </div>
</template>

<style scoped>
.st{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:22px 20px}
.card{display:block;width:100%;text-align:left;font:inherit;color:inherit;background:none;border-left:0;border-right:0;border-bottom:0;padding:12px 0 0;margin:0}
.card p{margin:0 0 6px;max-width:80ch}
.lbl{margin:0 0 8px}
.click{cursor:pointer}
.click:hover .go{text-decoration:underline}
.click:hover{background:var(--accent-soft)}
.go{display:inline-flex;align-items:center;gap:6px;margin-top:6px;font-weight:600;color:var(--accent)}
.go::after{content:"";width:8px;height:8px;border-top:2px solid currentColor;border-right:2px solid currentColor;transform:rotate(45deg)}
.biz{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.biz svg{color:var(--ink-2);flex:none}
.chip{padding:6px 10px;border-radius:3px}
.chip.old{background:var(--calm-bg)}
.chip.new{background:var(--accent-soft);border:1px solid var(--accent);font-weight:600}
.val{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}
.judge{background:var(--sheet-2);padding:12px 14px}
.wide{grid-column:1/-1}
ul{margin:0;padding-left:18px}
li{margin:3px 0}
@media (max-width:760px){.st{grid-template-columns:1fr}}
</style>
