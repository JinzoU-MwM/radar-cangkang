<script setup>
// Satu pengumuman/berita beserta bacaan otomatisnya (sinyal, arah dampak, poin, sikap emiten).
// Dipakai halaman Berita dan tab Berita tiap emiten.
import { computed } from 'vue'
import { store } from '../store.js'
import { UTYPES, isNewSince, SIKAP_CLS } from '../lib/domain.js'
import { newsTake } from '../lib/news.js'

const props = defineProps({ u: { type: Object, required: true }, showTicker: { type: Boolean, default: true } })

const TAG = { good: 't-good', warn: 't-warn', bad: 't-strong', calm: 't-calm' }
// Arah dampak tiap poin terhadap pemegang saham publik; bentuk SVG: segitiga naik, segitiga turun, bulat.
const TONE = {
  1: { cls: 'pos', name: 'Positif', d: 'M5 1.5 9 8.5H1z' },
  '-1': { cls: 'neg', name: 'Negatif atau risiko', d: 'M1 1.5h8L5 8.5z' },
  0: { cls: 'mid', name: 'Perlu dicermati', d: 'M5 1.75a3.25 3.25 0 1 0 0 6.5a3.25 3.25 0 1 0 0-6.5z' },
}
const typeName = id => (UTYPES.find(t => t.id === id) || UTYPES[UTYPES.length - 1]).name

const take = computed(() => newsTake(props.u, { items: store.items, pandangan: store.pandangan }))
const points = computed(() => take.value.points.map((text, i) => ({ text, tone: TONE[take.value.tones[i]] })))
const fresh = computed(() => isNewSince(props.u, store.seenAt))
const url = computed(() => /^https?:\/\//.test(props.u.url || '') ? props.u.url : '')
const inItems = computed(() => store.items.some(i => i.ticker === props.u.ticker))
const source = computed(() => props.u.source || (/^sb-report-/.test(props.u.id) ? 'Stockbit Reports' : 'Sumber belum ada'))
</script>

<template>
  <article class="item" :class="{ fresh, solo: !showTicker }">
    <div v-if="showTicker" class="tk">
      <RouterLink v-if="u.ticker && inItems" class="ticker" :to="'/emiten/' + u.ticker">{{ u.ticker }}</RouterLink>
      <span v-else-if="u.ticker" class="ticker" title="Emiten belum ada di radar">{{ u.ticker }}</span>
    </div>
    <div class="body">
      <a v-if="url" class="title" :href="url" target="_blank" rel="noopener">{{ u.title || 'Tanpa judul' }}</a>
      <span v-else class="title">{{ u.title || 'Tanpa judul' }}</span>
      <p v-if="u.summary" class="sum muted">{{ u.summary }}</p>
      <div class="small muted">{{ source }}</div>
      <div class="take small">
        <div class="tags">
          <span class="tag" :class="TAG[take.cls]">{{ take.label }}</span>
          <span class="tag" :class="TAG[take.arah.cls]" :title="`${take.arah.pos} poin positif, ${take.arah.neg} poin negatif`">{{ take.arah.label }}</span>
          <RouterLink v-if="showTicker && take.canAnalyze" class="an" :to="{ path: '/emiten/' + u.ticker, query: { tab: 'analisa' } }">Analisa {{ u.ticker }}</RouterLink>
        </div>
        <ul class="pts">
          <li v-for="(p, i) in points" :key="i" :title="p.tone.name">
            <svg class="tone" :class="p.tone.cls" viewBox="0 0 10 10" role="img" :aria-label="p.tone.name"><path :d="p.tone.d" /></svg>
            <span>{{ p.text }}</span>
          </li>
        </ul>
        <p v-if="take.sikapLine" class="sk"><span class="tag" :class="SIKAP_CLS[take.sikapLine.sikap] || TAG[take.sikapLine.cls]">{{ take.sikapLine.ticker }} · {{ take.sikapLine.sikap }}</span> <span class="muted">{{ take.sikapLine.ringkas }}</span></p>
      </div>
    </div>
    <span class="tag t-calm ty">{{ typeName(u.type) }}</span>
  </article>
</template>

<style scoped>
.item{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:4px 14px;padding:12px 16px;border-bottom:1px solid var(--rule-2);align-items:baseline}
.item.solo{grid-template-columns:minmax(0,1fr) auto}
.item.fresh{background:var(--now-bg)}
.title{font-weight:600;color:var(--ink)}
a.title{text-decoration:none}
a.title:hover{text-decoration:underline}
.sum{max-width:78ch;margin:2px 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-clamp:2;overflow:hidden}
.take{margin-top:6px;display:flex;flex-direction:column;gap:4px;align-items:flex-start}
.tags{display:flex;flex-wrap:wrap;gap:6px}
.pts{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:3px}
/* Penanda arah: bentuk + warna, jadi tetap terbaca tanpa membedakan warna. */
.pts li{display:flex;gap:7px;align-items:baseline}
.tone{flex:none;width:9px;height:9px;fill:var(--warn);transform:translateY(1px)}
.tone.pos{fill:var(--good)}
.tone.neg{fill:var(--strong)}
.an{color:var(--accent);font-weight:600;text-underline-offset:3px;align-self:center}
.sk{margin:0}
@media (max-width:760px){
  .item,.item.solo{grid-template-columns:1fr}
  .ty{justify-self:start}
}
</style>
