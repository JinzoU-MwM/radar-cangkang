<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store, itemOf, pandanganOf, storyOf, autoRefresh, loadStories } from '../store.js'
import { fmtDate, rp, scoreOf, statusOf, STATUS_LABEL } from '../lib/domain.js'
import SikapTag from '../components/SikapTag.vue'
import StageTrack from '../components/StageTrack.vue'
import OwnershipFlow from '../components/OwnershipFlow.vue'
import TabRingkasan from '../components/emiten/TabRingkasan.vue'
import TabStory from '../components/emiten/TabStory.vue'
import TabAnalisa from '../components/emiten/TabAnalisa.vue'
import TabTeknikal from '../components/emiten/TabTeknikal.vue'
import TabSpekulasi from '../components/emiten/TabSpekulasi.vue'
import TabProfil from '../components/emiten/TabProfil.vue'
import TabBerita from '../components/emiten/TabBerita.vue'

const props = defineProps({ ticker: { type: String, required: true } })
const route = useRoute()
const router = useRouter()

const TABS = [
  { id: 'ringkasan', name: 'Ringkasan' },
  { id: 'story', name: 'Story & Pengendali' },
  { id: 'analisa', name: 'Analisa' },
  { id: 'teknikal', name: 'Teknikal' },
  { id: 'spekulasi', name: 'Spekulasi' },
  { id: 'profil', name: 'Profil' },
  { id: 'berita', name: 'Berita' },
]

const T = computed(() => props.ticker.toUpperCase())
const item = computed(() => itemOf(T.value))
const pv = computed(() => pandanganOf(T.value))
const story = computed(() => storyOf(T.value))
const known = computed(() => !!(item.value || pv.value || store.verified[T.value]))
// Kode di luar radar tetap bisa dianalisa selama formatnya kode saham BEI (4 huruf).
const valid = computed(() => /^[A-Z]{4}$/.test(T.value))
// Tab yang hanya berisi data radar/story; untuk kode bebas ditulis "belum ada".
const RADAR_ONLY = ['ringkasan', 'story']

const tab = computed(() => TABS.some(t => t.id === route.query.tab) ? route.query.tab : known.value ? 'ringkasan' : 'analisa')
function pick(id) { router.replace({ query: { ...route.query, tab: id } }) }

// Panah kiri/kanan, Home/End di daftar tab (pola tab WAI-ARIA, aktivasi otomatis).
const tabEls = ref([])
function onTabKey(e, i) {
  const n = TABS.length
  const j = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key]
  if (j === undefined) return
  e.preventDefault()
  pick(TABS[j].id)
  nextTick(() => tabEls.value[j]?.focus())
}

const dm = iso => new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
const tenderUntil = computed(() => {
  const end = item.value?.tender?.end
  return end && end.slice(0, 10) >= new Date().toISOString().slice(0, 10) ? 's.d. ' + dm(end) : ''
})

const lama = computed(() => story.value?.lama || '')
const baru = computed(() => story.value?.baru || store.verified[T.value]?.baru || '')

const price = computed(() => item.value?.price ?? pv.value?.hargaAcuan ?? null)
const priceNote = computed(() => {
  const it = item.value, p = pv.value
  if (it?.price != null) {
    const at = it.updatedAt ? new Date(it.updatedAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
    const ref = p?.hargaAcuan != null && p.hargaAcuan !== it.price ? ` · acuan analisa ${rp(p.hargaAcuan)} (${fmtDate(p.asOf)})` : ''
    return `harga radar${at ? ', diperbarui ' + at : ''}${ref}`
  }
  return p?.hargaAcuan != null ? `harga acuan analisa ${fmtDate(p.asOf)}` : 'belum ada harga'
})

const score = computed(() => item.value ? scoreOf(item.value) : null)

// Riwayat kode yang pernah dianalisa (maks. 8, terbaru di depan), per browser.
const RECENT_KEY = 'radar-cangkang.anRecent'
const readRecent = () => { try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(v) ? v.filter(x => /^[A-Z]{4}$/.test(x)) : [] } catch { return [] } }
const recent = ref(readRecent())
watch(() => [T.value, tab.value], ([t, tb]) => {
  if (tb !== 'analisa' || !valid.value) return
  recent.value = [t, ...readRecent().filter(x => x !== t)].slice(0, 8)
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent.value)) } catch {}
}, { immediate: true })

const flow = ref(false)
const flowFocus = ref(null)
function openFlow(focus = null) { flowFocus.value = focus; flow.value = true }
// Panel ditutup saat pindah emiten atau tab (lewat URL), supaya tidak menutupi konten baru.
watch(() => [route.params.ticker, route.query.tab, route.query.flow], () => { flow.value = !!route.query.flow })

onMounted(() => {
  autoRefresh('reports'); loadStories([props.ticker]).catch(() => {})
  // ?flow=1 (mis. dari panel Pembaruan) langsung membuka panel Alur saham.
  if (route.query.flow) openFlow()
})
watch(() => props.ticker, t => loadStories([t]).catch(() => {}))
</script>

<template>
  <div class="em">
    <RouterLink to="/" class="back">‹ Monitor</RouterLink>

    <section v-if="!valid && !known" class="empty rule-top">
      <h1>{{ T }}</h1>
      <p>{{ T }} bukan kode saham BEI. Kode saham terdiri dari 4 huruf, misalnya BBCA.</p>
      <RouterLink to="/">Kembali ke Monitor</RouterLink>
    </section>

    <template v-else>
      <header class="hd">
        <div class="id">
          <div class="line1">
            <h1 class="tk">{{ T }}</h1>
            <SikapTag :sikap="pv?.sikap" />
            <span v-if="score != null" class="tag score" :class="'st-' + statusOf(score)">Skor {{ score }} · {{ STATUS_LABEL[statusOf(score)] }}</span>
            <span v-if="!known" class="tag t-calm">di luar radar</span>
            <span v-if="item" class="stage"><StageTrack :item="item" /><span v-if="tenderUntil" class="tag t-now">{{ tenderUntil }}</span></span>
          </div>
          <p class="nm">
            <span v-if="item?.name">{{ item.name }}</span>
            <span v-if="lama || baru" class="biz">
              {{ lama || 'usaha lama belum ada' }}
              <svg width="16" height="10" viewBox="0 0 16 10" aria-label="menjadi" role="img"><path d="M1 5h13M10 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" /></svg>
              {{ baru || 'usaha baru belum ada' }}
            </span>
          </p>
        </div>
        <div class="right">
          <button type="button" class="btn primary" aria-haspopup="dialog" @click="openFlow()">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="4" cy="4" r="2.2" /><circle cx="14" cy="4" r="2.2" /><circle cx="9" cy="14" r="2.2" /><path d="M5.5 5.6 8 12M12.5 5.6 10 12" /></svg>
            Alur saham
          </button>
          <div class="px">
            <div class="pv">{{ price != null ? rp(price) : 'belum ada' }}</div>
            <div class="small muted">{{ priceNote }}</div>
          </div>
        </div>
      </header>
      <div class="recent">
        <nav v-if="recent.length" class="chips" aria-label="Riwayat analisa">
          <RouterLink v-for="t in recent" :key="t" class="chip" :class="{ on: t === T }" :aria-current="t === T ? 'page' : undefined"
            :to="{ path: '/emiten/' + t, query: { tab: 'analisa' } }">{{ t }}</RouterLink>
        </nav>
      </div>

      <div class="tabs" role="tablist" aria-label="Bagian emiten">
        <button v-for="(t, i) in TABS" :key="t.id" :ref="el => (tabEls[i] = el)" type="button" role="tab" class="tab"
          :id="'tab-' + t.id" :aria-selected="tab === t.id" :aria-controls="'panel-' + t.id" :tabindex="tab === t.id ? 0 : -1"
          @click="pick(t.id)" @keydown="onTabKey($event, i)">{{ t.name }}</button>
      </div>

      <div :id="'panel-' + tab" role="tabpanel" :aria-labelledby="'tab-' + tab" class="panel">
        <p v-if="!known && RADAR_ONLY.includes(tab)" class="muted none">{{ T }} belum ada di radar, jadi {{ tab === 'story' ? 'story dan pengendali' : 'ringkasan transaksi' }} belum ada. Tab Analisa, Teknikal, Spekulasi, Profil, dan Berita tetap memakai data Stockbit.</p>
        <TabRingkasan v-else-if="tab === 'ringkasan'" :ticker="T" />
        <TabStory v-else-if="tab === 'story'" :ticker="T" @flow="openFlow" />
        <TabAnalisa v-else-if="tab === 'analisa'" :ticker="T" />
        <TabTeknikal v-else-if="tab === 'teknikal'" :ticker="T" />
        <TabSpekulasi v-else-if="tab === 'spekulasi'" :ticker="T" @goto="pick" />
        <TabProfil v-else-if="tab === 'profil'" :ticker="T" />
        <TabBerita v-else-if="tab === 'berita'" :ticker="T" />
      </div>
    </template>

    <OwnershipFlow v-if="flow" :key="T" :ticker="T" :focus="flowFocus" @close="flow = false" />
  </div>
</template>

<style scoped>
.em{display:flex;flex-direction:column;gap:16px;max-width:1200px}
.back{font-size:13px;text-decoration:none;align-self:flex-start}
.back:hover{text-decoration:underline}
.empty{display:grid;gap:8px;justify-items:start}
.hd{display:flex;flex-wrap:wrap;gap:12px 24px;align-items:flex-end;justify-content:space-between}
.id{min-width:0;flex:1 1 520px}
.line1{display:flex;gap:10px 14px;align-items:center;flex-wrap:wrap}
.tk{font-size:40px;line-height:1}
.stage{display:inline-flex;align-items:center;gap:10px}
.nm{margin:6px 0 0;color:var(--ink-2);display:flex;flex-wrap:wrap;gap:4px 14px}
.biz{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}
.biz svg{color:var(--ink-2);flex:none}
.right{display:flex;gap:20px;align-items:flex-end;flex:none;margin-left:auto}
.right .btn{min-height:40px}
.px{text-align:right}
.pv{font:700 36px/1 var(--f-display)}
.panel{min-width:0}
.score{border-radius:999px;padding:2px 10px}
.none{padding:14px 0;margin:0;max-width:72ch}
.recent{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between;margin-top:12px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{border:1px solid var(--rule);border-radius:999px;padding:2px 10px;font:700 13px var(--f-display);letter-spacing:.02em;color:var(--ink);text-decoration:none;background:var(--sheet);min-height:28px;display:inline-flex;align-items:center}
.chip:hover{border-color:var(--ink)}
.chip.on{background:var(--ink);border-color:var(--ink);color:var(--paper)}
@media (max-width:760px){
  .hd{align-items:flex-start}
  .right{width:100%;justify-content:space-between}
  .tabs{flex-wrap:nowrap;overflow-x:auto}
  .tab{white-space:nowrap}
}
</style>
