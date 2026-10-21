<script setup>
import { computed, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import { store } from '../store.js'
import { fmtDate, stageOf } from '../lib/domain.js'

// Tombol rail "Pembaruan" + panel kanan berisi changelog.json, dikelompokkan per tanggal rilis.
// Status "sudah dibaca" dicatat per item (id) di localStorage, sama dengan versi lama.
const LS_SEEN = 'radar-cangkang.clSeen'
const LS_OLD = 'radar-cangkang.changelogSeen'   // versi Vue awal: tanggal rilis terakhir yang dibuka
const JENIS = { fitur: ['Fitur baru', 't-good'], tampilan: ['Tampilan', 't-calm'], data: ['Data', 't-calm'], perbaikan: ['Perbaikan', 't-warn'], keamanan: ['Keamanan', 't-strong'] }
// Fitur yang sudah dibuang dari aplikasi; catatannya tidak ditampilkan.
const HIDDEN = new Set(['2026-10-20-lan'])
const router = useRouter()

// Urut sesuai nomor poin permintaan (field "poin", mis. "8–9" → 8); catatan tanpa poin di akhir.
const pn = i => (i.poin ? parseInt(i.poin, 10) : NaN) || 999
const rilis = computed(() => (store.changelog?.rilis || []).slice().sort((a, b) => b.tanggal.localeCompare(a.tanggal))
  .map(r => ({ ...r, item: (r.item || []).filter(i => !HIDDEN.has(i.id)).sort((a, b) => pn(a) - pn(b)) })))
const allItems = computed(() => rilis.value.flatMap(r => r.item))

function loadSeen() {
  let ids = []
  try { ids = JSON.parse(localStorage.getItem(LS_SEEN) || '[]') } catch {}
  const s = new Set(ids)
  let old = ''
  try { old = localStorage.getItem(LS_OLD) || '' } catch {}
  if (old) for (const r of store.changelog?.rilis || []) if (r.tanggal <= old) for (const i of r.item || []) s.add(i.id)
  return s
}
const seen = ref(loadSeen())
function mark(ids) {
  const s = new Set(seen.value)
  ids.forEach(i => s.add(i))
  seen.value = s
  try { localStorage.setItem(LS_SEEN, JSON.stringify([...s])) } catch {}
}
const nNew = computed(() => allItems.value.filter(i => !seen.value.has(i.id)).length)

// Chip jenis dengan jumlah; saringan berlaku untuk semua rilis.
const jenis = ref('')
const chips = computed(() => [{ id: '', name: 'Semua', n: allItems.value.length },
  ...Object.entries(JENIS).map(([id, [name]]) => ({ id, name, n: allItems.value.filter(i => i.jenis === id).length })).filter(c => c.n)])
const shown = computed(() => rilis.value.map(r => ({ ...r, item: r.item.filter(i => !jenis.value || i.jenis === jenis.value) })).filter(r => r.item.length))

const open = ref(false)
const panel = ref(null)
let opener = null
function show(e) {
  opener = e.currentTarget
  open.value = true
  nextTick(() => panel.value?.focus())
}
function close() { open.value = false; opener?.focus() }

// Tautan "Buka" dari field `buka` lama (view/analisa/mode/anchor) ke rute baru.
function target(b) {
  if (!b) return null
  if (b.analisa) return { path: '/emiten/' + b.analisa, query: { tab: b.mode === 'teknikal' || b.mode === 'spekulasi' ? b.mode : 'analisa' } }
  // Jangkar lama "feedQ" (kotak cari berita) = #nq di BeritaView.
  if (b.view === 'update') return { path: '/berita', hash: b.anchor === 'feedQ' ? '#nq' : '' }
  if (b.view === 'story') {
    // Story tidak menyebut emiten: pakai emiten backdoor pertama menurut abjad.
    const t = store.items.filter(d => stageOf(d) !== 'radar').map(d => d.ticker).sort()[0]
    return t ? { path: '/emiten/' + t, query: { tab: 'story' } } : { path: '/' }
  }
  if (b.view === 'progress' || b.view === 'potensi') return { path: '/', hash: b.anchor ? '#' + b.anchor : '' }
  return null
}

// Sorot singkat elemen tujuan. Lewat Web Animations karena elemennya di luar komponen ini (style scoped).
function flash(el) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const c = getComputedStyle(document.documentElement).getPropertyValue('--now').trim()
  el.animate([{ boxShadow: `0 0 0 3px ${c}` }, { boxShadow: '0 0 0 3px transparent' }], { duration: 1600, easing: 'ease-out' })
}

async function go(i) {
  mark([i.id])
  const to = target(i.buka)
  open.value = false
  // Router memakai hash untuk rute, jadi jangkar dicari manual setelah halaman tampil.
  await router.push({ path: to.path, query: to.query })
  if (!to.hash) return
  setTimeout(() => {
    const el = document.getElementById(to.hash.slice(1))
    if (!el) return
    if (el.tagName === 'DETAILS') el.open = true
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    flash(el)
  }, 250)
}
</script>

<template>
  <button type="button" class="cl-btn" :aria-expanded="String(open)" aria-haspopup="dialog" @click="show">
    Pembaruan
    <span v-if="nNew" class="cnt" :title="`${nNew} catatan belum dibaca`">{{ nNew }}<span class="sr-only"> belum dibaca</span></span>
  </button>
  <!-- Ke body: rail memakai position:sticky (konteks tumpukan sendiri), panel harus di atas seluruh halaman. -->
  <Teleport to="body"><div v-if="open" class="cl-scrim" @click.self="close" @keydown.esc="close">
    <aside ref="panel" class="cl-panel" role="dialog" aria-modal="true" aria-labelledby="cl-h" tabindex="-1">
      <header class="cl-head">
        <h2 id="cl-h">Pembaruan website</h2>
        <span v-if="nNew" class="tag t-now">{{ nNew }} baru</span>
        <button type="button" class="btn" @click="close">Tutup</button>
      </header>
      <p v-if="!allItems.length" class="muted">Belum ada catatan pembaruan.</p>
      <template v-else>
        <div class="bar">
          <div role="group" aria-label="Saring jenis" class="chips">
            <button v-for="c in chips" :key="c.id" type="button" class="pill" :aria-pressed="String(jenis === c.id)" @click="jenis = c.id">{{ c.name }}<b>{{ c.n }}</b></button>
          </div>
          <button type="button" class="link small" :disabled="!nNew" @click="mark(allItems.map(i => i.id))">Tandai semua dibaca</button>
        </div>
        <section v-for="r in shown" :key="r.tanggal" class="rel">
          <h3 class="lbl">{{ fmtDate(r.tanggal) }}</h3>
          <p v-if="r.judul" class="rj">{{ r.judul }}</p>
          <ul>
            <li v-for="i in r.item" :key="i.id" :class="{ fresh: !seen.has(i.id) }" @click="mark([i.id])">
              <div class="it-h">
                <span class="tag" :class="(JENIS[i.jenis] || ['', 't-calm'])[1]">{{ (JENIS[i.jenis] || [i.jenis])[0] }}</span>
                <b>{{ i.judul }}</b>
                <span v-if="!seen.has(i.id)" class="tag t-now nw">baru</span>
              </div>
              <p v-if="i.detail" class="muted small">{{ i.detail }}</p>
              <button v-if="target(i.buka)" type="button" class="link small" @click.stop="go(i)">Buka halaman</button>
            </li>
          </ul>
        </section>
      </template>
    </aside>
  </div></Teleport>
</template>

<style scoped>
.cl-btn{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:10px 12px;min-height:24px;border:0;border-radius:3px;background:none;font:inherit;font-weight:600;color:var(--rail-mute);cursor:pointer;text-align:left}
.cl-btn:hover{color:var(--rail-ink);background:var(--rail-2)}
.cl-btn .cnt{font-family:var(--f-display);font-weight:700;color:var(--now)}
@media (max-width:760px){.cl-btn{width:auto}}
.cl-scrim{position:fixed;inset:0;z-index:40;background:rgb(15 32 25 / .45);display:flex;justify-content:flex-end}
.cl-panel{background:var(--sheet);color:var(--ink);width:min(440px,100%);height:100%;overflow:auto;padding:18px 20px 32px;box-shadow:var(--shadow);outline:none;box-sizing:border-box}
.cl-head{display:flex;align-items:center;gap:10px;padding-bottom:10px;border-bottom:2px solid var(--ink)}
.cl-head h2{margin:0;margin-right:auto}
.bar{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding-top:12px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.rel{padding-top:14px}
.rel h3{margin:0}
.rj{margin:2px 0 6px;font-weight:600}
ul{list-style:none;margin:0;padding:0}
li{padding:9px 8px;margin:0 -8px;border-bottom:1px solid var(--rule-2)}
li.fresh{background:var(--now-bg)}
.it-h{display:flex;gap:8px;align-items:baseline}
.it-h .tag{flex:none}
.nw{margin-left:auto}
li p{margin:3px 0 0}
.link{border:0;background:none;padding:0;margin-top:4px;color:var(--accent);text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.link:disabled{color:var(--ink-2);text-decoration:none;cursor:default}
</style>
