<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { store, autoKandidat } from '../store.js'
import { stageOf } from '../lib/domain.js'
import Modal from './emiten/Modal.vue'

// Lompat ke emiten mana pun (Ctrl/⌘ K): cari kode atau nama di Monitor dan Kandidat,
// atau ketik kode BEI 4 huruf apa saja lalu Enter.
const emit = defineEmits(['close'])
const router = useRouter()
const q = ref('')
const at = ref(0)

const pool = computed(() => {
  const seen = new Set()
  return [...store.items.map(i => ({ t: i.ticker, name: i.name || '', where: stageOf(i) === 'radar' ? 'Kandidat' : 'Monitor' })),
    ...autoKandidat().map(k => ({ t: k.ticker, name: k.name, where: 'Kandidat otomatis' }))]
    .filter(x => !seen.has(x.t) && seen.add(x.t))
})
const hits = computed(() => {
  const s = q.value.trim().toUpperCase()
  if (!s) return pool.value.slice(0, 8)
  const list = pool.value.filter(x => x.t.startsWith(s) || x.name.toUpperCase().includes(s))
    .sort((a, b) => b.t.startsWith(s) - a.t.startsWith(s) || a.t.localeCompare(b.t)).slice(0, 8)
  // Kode 4 huruf yang belum dipantau tetap bisa dibuka (halaman emiten menerima kode bebas).
  if (/^[A-Z]{4}$/.test(s) && !list.some(x => x.t === s)) list.push({ t: s, name: 'Buka kode ini', where: 'BEI' })
  return list
})
function go(h) {
  if (!h) return
  router.push('/emiten/' + h.t)
  emit('close')
}
function onKey(e) {
  const n = hits.value.length
  if (e.key === 'ArrowDown') { e.preventDefault(); at.value = n ? (at.value + 1) % n : 0 }
  else if (e.key === 'ArrowUp') { e.preventDefault(); at.value = n ? (at.value - 1 + n) % n : 0 }
  else if (e.key === 'Enter') { e.preventDefault(); go(hits.value[at.value]) }
}
</script>

<template>
  <Modal labelledby="tjT" close-label="Tutup pencarian" @close="emit('close')">
    <template #title><h2 id="tjT" class="tj-t">Buka emiten</h2></template>
    <input v-model="q" class="field tj-q" type="search" placeholder="Kode atau nama, mis. NAYZ" autofocus
      role="combobox" aria-controls="tjL" :aria-activedescendant="hits.length ? 'tj-' + at : undefined"
      aria-autocomplete="list" @input="at = 0" @keydown="onKey">
    <ul id="tjL" class="tj-l" role="listbox" aria-label="Hasil">
      <li v-for="(h, i) in hits" :id="'tj-' + i" :key="h.t" role="option" :aria-selected="i === at" :class="{ on: i === at }"
        @mousemove="at = i" @click="go(h)">
        <span class="ticker">{{ h.t }}</span><span class="nm">{{ h.name }}</span><span class="wh small muted">{{ h.where }}</span>
      </li>
      <li v-if="!hits.length" class="muted small none">Tidak ada yang cocok. Ketik kode 4 huruf untuk membuka emiten mana pun.</li>
    </ul>
    <p class="small muted tj-h">↑↓ pilih · Enter buka · Esc tutup</p>
  </Modal>
</template>

<style scoped>
.tj-t{margin:0;font:700 22px var(--f-display)}
.tj-q{width:100%;min-height:44px;font-size:17px;box-sizing:border-box}
.tj-l{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.tj-l li{display:grid;grid-template-columns:72px minmax(0,1fr) auto;gap:10px;align-items:baseline;padding:9px 10px;border-radius:3px;cursor:pointer}
.tj-l li.on{background:var(--accent-soft)}
.tj-l li.none{display:block;cursor:default}
.nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink-2)}
.tj-h{margin:0}
</style>
