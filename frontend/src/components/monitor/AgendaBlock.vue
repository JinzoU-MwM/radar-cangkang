<script setup>
import { computed, ref, watch } from 'vue'
import { api } from '../../api.js'
import { store } from '../../store.js'
import { tlEvents, fmtDate } from '../../lib/domain.js'
import { isBackdoorNews, backdoorTickers } from '../../lib/news.js'

// Tiga panel kerja: yang berubah sejak kemarin/7 hari (snapshot harian server), keterbukaan backdoor
// 3 hari terakhir, dan tanggal jatuh tempo 14 hari ke depan.
// note = ringkasan laporan baru sejak ditandai dilihat (dari MonitorView); seen = tombol tandai.
defineProps({ note: String, canMark: Boolean })
const emit = defineEmits(['seen'])
// Tanggal lokal YYYY-MM-DD, n hari dari sekarang.
const day = n => { const t = new Date(Date.now() + n * 864e5); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` }
const today = day(0)
const fresh = computed(() => {
  const set = backdoorTickers(store.items)
  return store.updates.filter(u => u.date && u.date.slice(0, 10) >= day(-3) && isBackdoorNews(u, store.items, set))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6)
})
// Diff harian dari /api/diff: perubahan harga (≥ 3%), porsi pengendali, tonggak, tender, laporan baru.
const MS_SHORT = { spa: 'PPJB', akuisisi: 'akuisisi efektif', to_umum: 'PTW diumumkan', to_selesai: 'PTW selesai', rupslb: 'RUPSLB',
  rights: 'rights issue', kjpp: 'KJPP terbit', inbreng: 'injeksi efektif', bisnis: 'usaha baru' }
const pct = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '%'
const rp = v => v == null ? '–' : Number(v).toLocaleString('id-ID')
function chText(c) {
  if (c.k === 'price') return `harga ${rp(c.from)} → ${rp(c.to)} (${pct(c.pct)})`
  if (c.k === 'ctrl') return `pengendali ${c.from == null ? '–' : rp(c.from) + '%'} → ${rp(c.to)}%${c.name ? ' (' + c.name + ')' : ''}`
  if (c.k === 'ms') return 'tahap: ' + c.added.map(m => MS_SHORT[m] || m).join(', ')
  if (c.k === 'tender') return `harga tender ${rp(c.from)} → ${rp(c.to)}`
  if (c.k === 'reports') return `${c.n} laporan baru`
  if (c.k === 'new') return 'baru masuk radar'
  return ''
}
const span = ref(1)
const diff = ref(null), diffErr = ref('')
watch(span, async d => {
  diffErr.value = ''
  try { diff.value = await api.get('/api/diff', { days: d }) } catch (e) { diffErr.value = e.message }
}, { immediate: true })
// Harga hanya ditampilkan bila bergerak ≥ 3%, supaya daftar berisi perubahan yang berarti.
const changed = computed(() => (diff.value?.items || [])
  .map(x => ({ t: x.ticker, ch: x.changes.filter(c => c.k !== 'price' || Math.abs(c.pct) >= 3) }))
  .filter(x => x.ch.length)
  .sort((a, b) => b.ch.length - a.ch.length || a.t.localeCompare(b.t)))
const baseTxt = computed(() => diff.value?.base ? fmtDate(diff.value.base) : '')

const due = computed(() => store.items.flatMap(d => tlEvents(d).filter(e => e.date >= today && e.date <= day(14)).map(e => ({ ...e, t: d.ticker })))
  .sort((a, b) => a.date.localeCompare(b.date)))
</script>

<template>
  <div class="agenda">
    <section class="chg">
      <div class="hd">
        <h2>Berubah</h2>
        <div role="group" aria-label="Rentang perubahan" class="rng">
          <button v-for="[d, l] in [[1, 'sejak kemarin'], [7, '7 hari']]" :key="d" type="button" class="pill sm" :aria-pressed="String(span === d)" @click="span = d">{{ l }}</button>
        </div>
      </div>
      <p v-if="diffErr" class="muted small">Perubahan belum bisa dimuat: {{ diffErr }}</p>
      <ol v-else-if="changed.length" class="cl">
        <li v-for="x in changed" :key="x.t">
          <RouterLink class="tk" :to="'/emiten/' + x.t">{{ x.t }}</RouterLink>
          <span class="tx">{{ x.ch.map(chText).join(' · ') }}</span>
        </li>
      </ol>
      <p v-else class="muted small">{{ diff ? (diff.base ? `Belum ada perubahan berarti sejak ${baseTxt}.` : 'Snapshot pertama baru diambil hari ini; perubahan tampil mulai besok.') : 'Memuat…' }}</p>
    </section>
    <section>
      <h2>Masuk 3 hari</h2>
      <p v-if="note" class="note small">{{ note }}
        <button v-if="canMark" type="button" class="linkbtn small" @click="emit('seen')">Tandai sudah dilihat</button>
      </p>
      <ol v-if="fresh.length">
        <li v-for="u in fresh" :key="u.id || u.title">
          <span class="d" :class="{ hot: u.date.slice(0, 10) === today }">{{ fmtDate(u.date.slice(0, 10)) }}</span>
          <RouterLink v-if="u.ticker" class="tk" :to="'/emiten/' + u.ticker">{{ u.ticker }}</RouterLink><span v-else></span>
          <span class="tx">{{ u.title }}</span>
        </li>
      </ol>
      <p v-else class="muted small">Belum ada keterbukaan baru tentang emiten backdoor dalam 3 hari terakhir.</p>
    </section>
    <section>
      <h2>Jatuh tempo 14 hari</h2>
      <ol v-if="due.length">
        <li v-for="(e, i) in due" :key="i">
          <span class="d" :class="{ hot: e.date <= day(3) }">{{ fmtDate(e.date) }}</span>
          <RouterLink class="tk" :to="'/emiten/' + e.t">{{ e.t }}</RouterLink>
          <span class="tx">{{ e.label }}</span>
        </li>
      </ol>
      <p v-else class="muted small">Tidak ada tanggal tender atau tahapan yang jatuh dalam 14 hari ke depan.</p>
    </section>
  </div>
</template>

<style scoped>
.agenda{display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:18px}
.hd{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}
.rng{display:flex;gap:4px}
.pill.sm{min-height:26px;font-size:12.5px;padding:2px 8px}
.cl{max-height:236px;overflow:auto}
.cl li{grid-template-columns:56px 1fr}
@media (max-width:1199px){.agenda{grid-template-columns:1fr 1fr}.chg{grid-column:1 / -1}}
section{background:var(--sheet);border:1px solid var(--rule);border-top:2px solid var(--ink);padding:12px 14px;min-width:0}
h2{font-size:16px;text-transform:uppercase;margin-bottom:6px}
.note{margin:0 0 6px;color:var(--ink-2)}
ol{list-style:none;margin:0;padding:0}
li{display:grid;grid-template-columns:86px 56px 1fr;gap:8px;align-items:baseline;padding:5px 0;border-top:1px solid var(--rule-2)}
li:first-child{border-top:0}
.d{font:600 14px var(--f-display);color:var(--ink-2)}
.d.hot{color:var(--now-ink)}
.tk{font:700 15px var(--f-display);color:var(--ink);text-decoration:none;letter-spacing:.02em}
.tk:hover{text-decoration:underline}
.tx{min-width:0;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;font-size:13px}
@media (max-width:760px){.agenda{grid-template-columns:1fr}}
@media (max-width:420px){li{grid-template-columns:72px 48px 1fr}}
</style>
