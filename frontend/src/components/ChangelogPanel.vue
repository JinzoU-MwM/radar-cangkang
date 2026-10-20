<script setup>
import { computed, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import { store } from '../store.js'
import { fmtDate, stageOf } from '../lib/domain.js'

// Tombol rail "Pembaruan" + panel kanan berisi changelog.json, dikelompokkan per tanggal rilis.
const LS_SEEN = 'radar-cangkang.changelogSeen'
const JENIS = { fitur: ['Fitur baru', 't-good'], tampilan: ['Tampilan', 't-calm'], data: ['Data', 't-calm'], perbaikan: ['Perbaikan', 't-warn'], keamanan: ['Keamanan', 't-strong'] }
const router = useRouter()

const rilis = computed(() => (store.changelog?.rilis || []).slice().sort((a, b) => b.tanggal.localeCompare(a.tanggal)))
const lsSeen = () => { try { return localStorage.getItem(LS_SEEN) || '' } catch { return '' } }
const seen = ref(lsSeen())
const unseen = computed(() => !!rilis.value[0] && rilis.value[0].tanggal > seen.value)

const open = ref(false)
const seenAtOpen = ref('')   // patokan tanda "baru" selama panel terbuka
const panel = ref(null)
let opener = null
function show(e) {
  opener = e.currentTarget
  seenAtOpen.value = seen.value
  open.value = true
  // Dibuka = semua rilis yang tampil dianggap sudah dilihat.
  seen.value = rilis.value[0]?.tanggal || ''
  try { localStorage.setItem(LS_SEEN, seen.value) } catch {}
  nextTick(() => panel.value?.focus())
}
function close() { open.value = false; opener?.focus() }

// Tautan "Buka" dari field `buka` lama (view/analisa/mode/anchor) ke rute baru.
function target(b) {
  if (!b) return null
  if (b.analisa) return { path: '/emiten/' + b.analisa, query: { tab: b.mode === 'teknikal' || b.mode === 'spekulasi' ? b.mode : 'analisa' } }
  if (b.view === 'update') return { path: '/berita' }
  if (b.view === 'story') {
    // Story tidak menyebut emiten: pakai emiten backdoor pertama menurut abjad.
    const t = store.items.filter(d => stageOf(d) !== 'radar').map(d => d.ticker).sort()[0]
    return t ? { path: '/emiten/' + t, query: { tab: 'story' } } : { path: '/' }
  }
  if (b.view === 'progress' || b.view === 'potensi') return { path: '/', hash: b.anchor ? '#' + b.anchor : '' }
  return null
}
async function go(b) {
  const to = target(b)
  open.value = false
  // Router memakai hash untuk rute, jadi jangkar dicari manual setelah halaman tampil.
  await router.push({ path: to.path, query: to.query })
  if (!to.hash) return
  setTimeout(() => {
    const el = document.getElementById(to.hash.slice(1))
    if (!el) return
    if (el.tagName === 'DETAILS') el.open = true
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 120)
}
</script>

<template>
  <button type="button" class="cl-btn" :aria-expanded="String(open)" aria-haspopup="dialog" @click="show">
    Pembaruan
    <span v-if="unseen" class="dot" title="Ada pembaruan yang belum dilihat"><span class="sr-only">ada yang baru</span></span>
  </button>
  <!-- Ke body: rail memakai position:sticky (konteks tumpukan sendiri), panel harus di atas seluruh halaman. -->
  <Teleport to="body"><div v-if="open" class="cl-scrim" @click.self="close" @keydown.esc="close">
    <aside ref="panel" class="cl-panel" role="dialog" aria-modal="true" aria-labelledby="cl-h" tabindex="-1">
      <header class="cl-head">
        <h2 id="cl-h">Pembaruan website</h2>
        <button type="button" class="btn" @click="close">Tutup</button>
      </header>
      <p v-if="!rilis.length" class="muted">Belum ada catatan pembaruan.</p>
      <section v-for="r in rilis" :key="r.tanggal" class="rel">
        <h3 class="lbl">{{ fmtDate(r.tanggal) }}<span v-if="r.tanggal > seenAtOpen" class="tag t-now">baru</span></h3>
        <p v-if="r.judul" class="rj">{{ r.judul }}</p>
        <ul>
          <li v-for="i in r.item" :key="i.id">
            <div class="it-h">
              <span class="tag" :class="(JENIS[i.jenis] || ['', 't-calm'])[1]">{{ (JENIS[i.jenis] || [i.jenis])[0] }}</span>
              <b>{{ i.judul }}</b>
            </div>
            <p v-if="i.detail" class="muted small">{{ i.detail }}</p>
            <button v-if="target(i.buka)" type="button" class="link small" @click="go(i.buka)">Buka</button>
          </li>
        </ul>
      </section>
    </aside>
  </div></Teleport>
</template>

<style scoped>
.cl-btn{display:flex;align-items:center;gap:8px;width:100%;padding:10px 12px;min-height:24px;border:0;border-radius:3px;background:none;font:inherit;font-weight:600;color:var(--rail-mute);cursor:pointer;text-align:left}
.cl-btn:hover{color:var(--rail-ink);background:var(--rail-2)}
@media (max-width:760px){.cl-btn{width:auto}}
.dot{width:8px;height:8px;border-radius:50%;background:var(--now);flex:none}
.cl-scrim{position:fixed;inset:0;z-index:40;background:rgb(15 32 25 / .45);display:flex;justify-content:flex-end}
.cl-panel{background:var(--sheet);color:var(--ink);width:min(440px,100%);height:100%;overflow:auto;padding:18px 20px 32px;box-shadow:var(--shadow);outline:none}
.cl-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-bottom:10px;border-bottom:2px solid var(--ink)}
.rel{padding-top:14px}
.rel h3{display:flex;gap:8px;align-items:center;margin:0}
.rj{margin:2px 0 6px;font-weight:600}
ul{list-style:none;margin:0;padding:0}
li{padding:9px 0;border-bottom:1px solid var(--rule-2)}
.it-h{display:flex;gap:8px;align-items:baseline}
.it-h .tag{flex:none}
li p{margin:3px 0 0}
.link{border:0;background:none;padding:0;margin-top:4px;color:var(--accent);text-decoration:underline;text-underline-offset:3px;cursor:pointer}
</style>
