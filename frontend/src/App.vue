<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { store, toast, loadKandidat, autoKandidat } from './store.js'
import { stageOf } from './lib/domain.js'
import ChangelogPanel from './components/ChangelogPanel.vue'

const router = useRouter()
const now = ref(Date.now())
let timer

const nRadar = computed(() => store.items.filter(i => stageOf(i) === 'radar').length)
const nKandidat = computed(() => nRadar.value + autoKandidat().length)
const nMonitor = computed(() => store.items.length - nRadar.value)
const nBaru = computed(() => store.updates.filter(u => (u.updatedAt || u.date || '') > store.seenAt).length)

// Status token Stockbit (masa berlaku ±24 jam) di kaki rail.
const token = computed(() => {
  const exp = store.status?.tokenExp
  if (!exp) return null
  const left = exp * 1000 - now.value
  const until = new Date(exp * 1000).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const h = Math.floor(left / 3600e3), m = Math.max(0, Math.floor(left % 3600e3 / 60e3))
  if (left <= 0) return { cls: 'bad', text: 'Token kedaluwarsa. Simpan token baru di .stockbit-token' }
  if (left < 2 * 3600e3) return { cls: 'warn', text: `Token habis dalam ${h ? h + ' jam ' : ''}${m} menit (${until})` }
  return { cls: 'ok', text: `Token berlaku s.d. ${until}` }
})

// Peringatan sekali saat sisa token < 1 jam; diulang hanya setelah token diganti (sisa > 2 jam lagi).
let tokenWarned = false
watch([() => store.status?.tokenExp, now], ([exp, t]) => {
  if (!exp || store.status?.readOnly) return
  const left = exp * 1000 - t
  if (left > 0 && left < 3600e3 && !tokenWarned) {
    tokenWarned = true
    toast(`Token Stockbit habis dalam ${Math.floor(left / 60e3)} menit. Siapkan token baru di .stockbit-token`, true)
  }
  if (left > 2 * 3600e3) tokenWarned = false
}, { immediate: true })

const theme = ref(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  if (theme.value === 'dark') document.documentElement.dataset.theme = 'dark'
  else delete document.documentElement.dataset.theme
  try { localStorage.setItem('radar-cangkang.theme', theme.value) } catch {}
}

// Pintasan: / cari, 1–3 pindah menu. Tidak aktif saat mengetik atau dialog terbuka.
function onKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.querySelector('[role="dialog"]')) return
  const to = { 1: '/', 2: '/kandidat', 3: '/berita' }[e.key]
  if (to) { router.push(to); return }
  if (e.key === '/') {
    e.preventDefault()
    const q = document.querySelector('[data-search]')
    if (q) q.focus()
    else router.push('/').then(() => setTimeout(() => document.querySelector('[data-search]')?.focus(), 50))
  }
}

onMounted(() => {
  timer = setInterval(() => { now.value = Date.now() }, 60e3)
  addEventListener('keydown', onKey)
})
// Pemindaian kandidat bisa lama saat belum ada hasil jadi: mulai setelah data utama termuat
// supaya tidak memakan jatah koneksi browser saat pemuatan awal.
watch(() => store.ready, r => r && loadKandidat(), { immediate: true })
onBeforeUnmount(() => { clearInterval(timer); removeEventListener('keydown', onKey) })
</script>

<template>
  <div class="shell">
    <nav class="rail" aria-label="Menu utama">
      <div class="brand">
        <b>Radar Backdoor</b>
        <span>Pengambilalihan emiten · BEI</span>
      </div>
      <RouterLink class="nav" to="/" :class="{ on: $route.name === 'monitor' || $route.name === 'emiten' }">Monitor <span class="cnt">{{ nMonitor }}</span></RouterLink>
      <RouterLink class="nav" to="/kandidat" active-class="on">Kandidat <span class="cnt">{{ nKandidat }}</span></RouterLink>
      <RouterLink class="nav" to="/berita" active-class="on">Berita <span class="cnt">{{ nBaru || '' }}</span></RouterLink>
      <ChangelogPanel />
      <div class="foot">
        <span v-if="store.status?.readOnly" class="tok">Versi publik · hanya baca</span>
        <span v-else-if="token" class="tok" :class="token.cls">{{ token.text }}</span>
        <span v-else-if="store.status && !store.status.configured" class="tok">Stockbit: config belum diisi</span>
        <span>/ cari · 1–3 pindah menu</span>
        <button type="button" class="theme" @click="toggleTheme">{{ theme === 'dark' ? 'Tema terang' : 'Tema gelap' }}</button>
      </div>
    </nav>
    <main class="content">
      <p v-if="!store.ready" class="muted">Memuat data…</p>
      <RouterView v-else />
    </main>
    <div class="toasts" aria-live="polite">
      <div v-for="t in store.toasts" :key="t.id" class="toast" :class="{ warn: t.warn }">{{ t.text }}</div>
    </div>
  </div>
</template>

<style scoped>
.shell{display:flex;flex-wrap:wrap;min-height:100vh}
.rail{flex:1 1 216px;max-width:232px;background:var(--rail);color:var(--rail-ink);padding:22px 12px;display:flex;flex-direction:column;gap:2px;position:sticky;top:0;height:100vh;box-sizing:border-box}
.brand{padding:0 12px 18px;display:grid;gap:2px}
.brand b{font-family:var(--f-display);font-size:24px;line-height:1;color:#fff}
.brand span{font-size:12px;color:var(--rail-mute)}
.nav{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:3px;color:var(--rail-mute);text-decoration:none;font-weight:600;min-height:24px;box-shadow:inset 3px 0 0 transparent}
.nav:hover{color:var(--rail-ink);background:var(--rail-2)}
.nav.on{color:#fff;background:var(--rail-2);box-shadow:inset 3px 0 0 var(--now)}
.cnt{font-family:var(--f-display);font-weight:700}
.foot{margin-top:auto;padding:12px;border-top:1px solid var(--rail-rule);display:flex;flex-direction:column;gap:8px;font-size:12px;color:var(--rail-mute)}
.tok{font-weight:600}
.tok.ok{color:#bfe6d1}.tok.warn{color:#ffd28a}.tok.bad{color:#ffb4a9}
.theme{align-self:flex-start;background:none;border:1px solid var(--rail-rule);color:var(--rail-ink);border-radius:3px;padding:5px 10px;cursor:pointer}
.content{flex:999 1 560px;min-width:0;padding:22px 28px 48px;box-sizing:border-box}
.toasts{position:fixed;right:18px;bottom:18px;display:flex;flex-direction:column;gap:8px;z-index:50;max-width:380px}
.toast{background:var(--ink);color:var(--paper);padding:10px 14px;border-radius:3px;box-shadow:var(--shadow)}
.toast.warn{background:var(--strong)}
@media (max-width:760px){.rail{position:static;height:auto;max-width:none;flex-basis:100%;flex-direction:row;flex-wrap:wrap;align-items:center}.brand{padding:0 12px 0 0}.foot{flex-basis:100%;margin:6px 0 0;padding:6px 12px 0}.foot>:not(.tok){display:none}.foot:not(:has(.tok)){display:none}.content{padding:16px}}
</style>
