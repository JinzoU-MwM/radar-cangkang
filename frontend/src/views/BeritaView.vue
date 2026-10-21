<script setup>
import { computed, onMounted, ref } from 'vue'
import { store, autoRefresh, userRefresh } from '../store.js'
import { UTYPES, fmtDate } from '../lib/domain.js'
import { isBackdoorNews, newsTake } from '../lib/news.js'

const TAG = { good: 't-good', warn: 't-warn', bad: 't-strong', calm: 't-calm' }
// Arah dampak tiap poin terhadap pemegang saham publik; bentuk SVG: segitiga naik, segitiga turun, bulat.
const TONE = {
  1: { cls: 'pos', name: 'Positif', d: 'M5 1.5 9 8.5H1z' },
  '-1': { cls: 'neg', name: 'Negatif atau risiko', d: 'M1 1.5h8L5 8.5z' },
  0: { cls: 'mid', name: 'Perlu dicermati', d: 'M5 1.75a3.25 3.25 0 1 0 0 6.5a3.25 3.25 0 1 0 0-6.5z' },
}
const typeName = id => (UTYPES.find(t => t.id === id) || UTYPES[UTYPES.length - 1]).name
// Sumber dari prefiks id: "sb-report-" = Stockbit Reports, "news-" = media.
const srcOf = u => /^sb-report-/.test(u.id) ? 'stockbit' : /^news-/.test(u.id) ? 'media' : ''

const type = ref('')
const src = ref('')
const q = ref('')

const feed = computed(() => store.updates.filter(u => isBackdoorNews(u, store.items)))
const types = computed(() => [{ id: '', name: 'Semua', n: feed.value.length },
  ...UTYPES.map(t => ({ ...t, n: feed.value.filter(u => u.type === t.id).length })).filter(t => t.n)])

const inItems = computed(() => new Set(store.items.map(i => i.ticker)))
const nameOf = computed(() => new Map(store.items.map(i => [i.ticker, i.name || ''])))
// Pencarian: kode, nama emiten, judul, ringkasan, atau nama sumber.
const hay = u => [u.ticker, nameOf.value.get(u.ticker), u.title, u.summary, u.source].join(' ').toLowerCase()

const list = computed(() => {
  const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return feed.value
    .filter(u => (!type.value || u.type === type.value) && (!src.value || srcOf(u) === src.value) && words.every(w => hay(u).includes(w)))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, 200)
})

const groups = computed(() => {
  const out = []
  for (const u of list.value) {
    const d = (u.date || '').slice(0, 10)
    let g = out[out.length - 1]
    if (!g || g.d !== d) out.push(g = { d, label: d ? fmtDate(d) : 'Tanpa tanggal', rows: [] })
    const take = newsTake(u, { items: store.items, pandangan: store.pandangan })
    g.rows.push({ u, take, points: take.points.map((text, i) => ({ text, tone: TONE[take.tones[i]] })),
      fresh: !!store.seenAt && (u.updatedAt || u.date || '') > store.seenAt,
      url: /^https?:\/\//.test(u.url || '') ? u.url : '' })
  }
  return out
})

const canRefresh = computed(() => !!(store.status?.reports || store.status?.news))
onMounted(() => autoRefresh('reports'))
</script>

<template>
  <div class="ber">
    <header class="head">
      <div>
        <h1>Berita</h1>
        <p class="muted small sub">Stockbit Reports dan media, hanya emiten di radar atau judul yang cocok kata kunci backdoor.</p>
      </div>
      <div class="tools">
        <label for="nq" class="sr-only">Cari berita</label>
        <input id="nq" v-model="q" data-search type="search" class="field" placeholder="Cari kode, nama, atau judul">
        <label for="nsrc" class="sr-only">Sumber</label>
        <select id="nsrc" v-model="src" class="field">
          <option value="">Semua sumber</option>
          <option value="stockbit">Stockbit Reports</option>
          <option value="media">Media</option>
        </select>
        <button v-if="!store.status?.readOnly" type="button" class="btn primary" :disabled="store.busy.reports || !canRefresh"
          :title="canRefresh ? 'Tarik laporan dan berita terbaru' : 'Sumber laporan dan berita belum aktif di server'" @click="userRefresh('reports')">
          {{ store.busy.reports ? 'Memperbarui…' : 'Perbarui berita' }}
        </button>
      </div>
    </header>

    <div role="group" aria-label="Saring jenis" class="types">
      <button v-for="t in types" :key="t.id" type="button" class="pill" :aria-pressed="String(type === t.id)" @click="type = t.id">{{ t.name }}<b>{{ t.n }}</b></button>
      <span v-if="feed.length" class="muted small count">{{ list.length }} pengumuman</span>
    </div>

    <section aria-label="Daftar berita" class="sheet list">
      <p v-if="!feed.length" class="muted empty">Belum ada berita. Tekan Perbarui berita untuk menarik laporan Stockbit dan media.</p>
      <p v-else-if="!list.length" class="muted empty">Tidak ada berita yang cocok<template v-if="q.trim()"> dengan “{{ q.trim() }}”</template>. Ubah kata kunci atau saringan.</p>
      <div v-for="g in groups" :key="g.d">
        <h2 class="lbl gd">{{ g.label }}</h2>
        <article v-for="r in g.rows" :key="r.u.id" class="item" :class="{ fresh: r.fresh }">
          <div class="tk">
            <RouterLink v-if="r.u.ticker && inItems.has(r.u.ticker)" class="ticker" :to="'/emiten/' + r.u.ticker">{{ r.u.ticker }}</RouterLink>
            <span v-else-if="r.u.ticker" class="ticker" title="Emiten belum ada di radar">{{ r.u.ticker }}</span>
          </div>
          <div class="body">
            <a v-if="r.url" class="title" :href="r.url" target="_blank" rel="noopener">{{ r.u.title || 'Tanpa judul' }}</a>
            <span v-else class="title">{{ r.u.title || 'Tanpa judul' }}</span>
            <p v-if="r.u.summary" class="sum muted">{{ r.u.summary }}</p>
            <div class="small muted">{{ r.u.source || 'Sumber belum ada' }}</div>
            <div class="take small">
              <div class="tags">
                <span class="tag" :class="TAG[r.take.cls]">{{ r.take.label }}</span>
                <span class="tag" :class="TAG[r.take.arah.cls]" :title="`${r.take.arah.pos} poin positif, ${r.take.arah.neg} poin negatif`">{{ r.take.arah.label }}</span>
                <RouterLink v-if="r.take.canAnalyze" class="an" :to="{ path: '/emiten/' + r.u.ticker, query: { tab: 'analisa' } }">Analisa {{ r.u.ticker }}</RouterLink>
              </div>
              <ul class="pts">
                <li v-for="(p, i) in r.points" :key="i" :title="p.tone.name">
                  <svg class="tone" :class="p.tone.cls" viewBox="0 0 10 10" role="img" :aria-label="p.tone.name"><path :d="p.tone.d" /></svg>
                  <span>{{ p.text }}</span>
                </li>
              </ul>
              <p v-if="r.take.sikapLine" class="sk"><span class="tag" :class="TAG[r.take.sikapLine.cls]">{{ r.take.sikapLine.ticker }} · {{ r.take.sikapLine.sikap }}</span> <span class="muted">{{ r.take.sikapLine.ringkas }}</span></p>
            </div>
          </div>
          <span class="tag t-calm ty">{{ typeName(r.u.type) }}</span>
        </article>
      </div>
    </section>
    <p class="muted foot">Latar oranye = belum dilihat sejak terakhir buka. Tingkat sinyal, arah dampak, dan poin dibaca otomatis dari judul dan ringkasan. Penanda poin: segitiga naik hijau = positif bagi pemegang saham publik, segitiga turun merah = negatif atau risiko, bulat kuning = perlu dicermati.</p>
  </div>
</template>

<style scoped>
.ber{display:flex;flex-direction:column;gap:14px}
.head{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;justify-content:space-between}
.sub{margin:2px 0 0}
.tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.tools input{width:220px;max-width:100%}
.tools select{padding:0 8px}
.types{display:flex;flex-wrap:wrap;gap:8px}
.list{border-radius:4px}
.empty{margin:0;padding:14px 16px}
.gd{margin:0;padding:10px 16px 6px;background:var(--sheet-2);border-bottom:1px solid var(--rule-2);font-family:var(--f-display);font-size:12.5px}
.item{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:4px 14px;padding:12px 16px;border-bottom:1px solid var(--rule-2);align-items:baseline}
.item.fresh{background:var(--now-bg)}
.title{font-weight:600;color:var(--ink)}
a.title{text-decoration:none}
a.title:hover{text-decoration:underline}
.sum{margin:2px 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-clamp:2;overflow:hidden}
.take{margin-top:6px;display:flex;flex-direction:column;gap:4px;align-items:flex-start}
.tags{display:flex;flex-wrap:wrap;gap:6px}
.pts{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:3px}
/* Penanda arah: bentuk + warna, jadi tetap terbaca tanpa membedakan warna. */
.pts li{display:flex;gap:7px;align-items:baseline}
.tone{flex:none;width:9px;height:9px;fill:var(--warn);transform:translateY(1px)}
.tone.pos{fill:var(--good)}
.tone.neg{fill:var(--strong)}
.an{color:var(--accent);font-weight:600;text-underline-offset:3px;align-self:center}
.count{margin-left:auto;align-self:center}
.sk{margin:0}
.foot{margin:0;font-size:12px}
@media (max-width:760px){
  .item{grid-template-columns:1fr}
  .ty{justify-self:start}
}
</style>
