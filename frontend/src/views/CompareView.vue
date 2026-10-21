<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { store, itemOf, pandanganOf, storyOf, toggleCompare, COMPARE_MAX } from '../store.js'
import { progressOf, posisiOf, dealOf, scoreOf, tlEvents, fmtDate, num } from '../lib/domain.js'
import { fmtPct } from '../lib/diff.js'
import SikapTag from '../components/SikapTag.vue'
import StageTrack from '../components/StageTrack.vue'
import FairBar from '../components/FairBar.vue'

// Bandingkan 2–3 emiten berdampingan. ?t=A,B,C di URL (bisa dibagikan) mengikuti daftar di browser.
const route = useRoute(), router = useRouter()
watch(() => route.query.t, v => {
  const list = String(v || '').toUpperCase().split(',').filter(t => /^[A-Z]{4}$/.test(t)).slice(0, COMPARE_MAX)
  if (list.length && list.join() !== store.compare.join()) {
    store.compare.filter(t => !list.includes(t)).forEach(toggleCompare)
    list.filter(t => !store.compare.includes(t)).forEach(toggleCompare)
  }
}, { immediate: true })
watch(() => store.compare.join(), v => router.replace({ query: v ? { t: v } : {} }))

const rp = v => v == null ? '–' : 'Rp' + Number(v).toLocaleString('id-ID')
const today = new Date().toISOString().slice(0, 10)
const ctx = computed(() => ({ aset: store.aset, verified: store.verified }))
const cols = computed(() => store.compare.map(t => {
  const item = itemOf(t)
  if (!item) return { t, missing: true }
  const prog = progressOf(item, ctx.value)
  const pa = pandanganOf(t), st = storyOf(t) || {}
  const price = num(item.price) ?? pa?.hargaAcuan ?? null
  const lo = pa?.nilaiWajar?.bawah ?? null, hi = pa?.nilaiWajar?.atas ?? null
  const ptw = item.tender?.price ?? null
  const rep = store.updates.filter(u => u.ticker === t && u.date).sort((a, b) => b.date.localeCompare(a.date))[0]
  const next = tlEvents(item).filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]
  return { t, item, prog, pos: posisiOf(item, prog, ctx.value), deal: dealOf(item, prog, ctx.value), pa, st, price, lo, hi,
    ptw, vsPtw: price && ptw ? (price / ptw - 1) * 100 : null, score: scoreOf(item), rep, next }
}))

// Tambah emiten dari daftar radar.
const pickT = ref('')
const options = computed(() => store.items.filter(i => !store.compare.includes(i.ticker)).map(i => i.ticker).sort())
function add() { if (pickT.value) { toggleCompare(pickT.value); pickT.value = '' } }

const ROWS = [
  ['Harga', c => c.price], ['Tahap', null], ['Posisi', c => c.pos.now], ['Selanjutnya', c => c.pos.next || '–'],
  ['Pengendali baru', null], ['Pengendali lama', c => [c.st.oldName, c.st.oldPct != null ? c.st.oldPct + '%' : ''].filter(Boolean).join(' · ') || '–'],
  ['Bisnis lama → baru', c => (c.st.lama || '–') + ' → ' + (c.st.baru || '–')],
  ['Injeksi aset', c => [c.st.inject, c.st.nominal].filter(Boolean).join(' · ') || '–'],
  ['PTW', null], ['Nilai wajar', null], ['Skor sinyal', c => c.score + ' / 100'],
  ['Jadwal berikutnya', c => c.next ? `${c.next.label} · ${fmtDate(c.next.date)}` : '–'],
  ['Laporan terakhir', c => c.rep ? `${fmtDate(c.rep.date.slice(0, 10))} · ${c.rep.title}` : '–'],
]
</script>

<template>
  <div class="cmp">
    <header class="head">
      <h1>Bandingkan</h1>
      <form v-if="store.compare.length < COMPARE_MAX" class="add" @submit.prevent="add">
        <label for="cmpAdd" class="small muted">Tambah emiten</label>
        <select id="cmpAdd" v-model="pickT" class="field">
          <option value="">Pilih kode…</option>
          <option v-for="t in options" :key="t" :value="t">{{ t }}</option>
        </select>
        <button type="submit" class="btn" :disabled="!pickT">Tambah</button>
      </form>
    </header>

    <p v-if="!cols.length" class="muted empty sheet">Belum ada emiten dibandingkan. Pilih kode di atas, atau tekan “Bandingkan” di halaman emiten. Maksimal {{ COMPARE_MAX }}.</p>

    <div v-else class="sheet box">
      <table class="ledger grid" :style="{ '--n': cols.length }">
        <thead><tr>
          <th class="lbl rh"><span class="sr-only">Aspek</span></th>
          <th v-for="c in cols" :key="c.t" class="colh">
            <div class="ch">
              <RouterLink class="ticker" :to="'/emiten/' + c.t">{{ c.t }}</RouterLink>
              <button type="button" class="btn icon x" :aria-label="'Hapus ' + c.t + ' dari perbandingan'" @click="toggleCompare(c.t)">×</button>
            </div>
            <div v-if="!c.missing" class="small muted nm">{{ c.item.name }}</div>
            <SikapTag v-if="!c.missing" :sikap="c.pa?.sikap" short />
          </th>
        </tr></thead>
        <tbody>
          <tr v-for="[label, f] in ROWS" :key="label">
            <th class="lbl rh" scope="row">{{ label }}</th>
            <td v-for="c in cols" :key="c.t">
              <span v-if="c.missing" class="muted small">tidak ada di radar</span>
              <template v-else-if="label === 'Harga'">
                <b class="big">{{ rp(c.price) }}</b>
                <span v-if="num(c.item.chgPct) != null" class="chg" :class="c.item.chgPct > 0 ? 'up' : c.item.chgPct < 0 ? 'dn' : ''"> {{ fmtPct(c.item.chgPct) }}</span>
              </template>
              <template v-else-if="label === 'Tahap'">
                <StageTrack :item="c.item" /> <span class="small muted">{{ c.prog.est ? '±' : '' }}{{ c.prog.pct }}% · {{ c.deal }}</span>
              </template>
              <template v-else-if="label === 'Pengendali baru'">
                {{ c.item.acquirer || c.item.ctrlName || '–' }}<span v-if="num(c.item.ctrlPct) != null" class="muted"> · {{ String(c.item.ctrlPct).replace('.', ',') }}%</span>
              </template>
              <template v-else-if="label === 'PTW'">
                <template v-if="c.ptw">{{ rp(c.ptw) }}<span v-if="c.vsPtw != null" class="muted"> · harga {{ fmtPct(c.vsPtw) }} dari PTW</span>
                  <div v-if="c.item.tender?.start" class="small muted">{{ fmtDate(c.item.tender.start.slice(0, 10)) }} – {{ c.item.tender.end ? fmtDate(c.item.tender.end.slice(0, 10)) : '?' }}</div>
                </template><span v-else class="muted">–</span>
              </template>
              <template v-else-if="label === 'Nilai wajar'">
                <template v-if="c.lo != null || c.hi != null">{{ rp(c.lo) }} – {{ rp(c.hi) }}
                  <FairBar :price="c.price" :lo="c.lo" :hi="c.hi" />
                </template><span v-else class="muted">–</span>
              </template>
              <template v-else>{{ f(c) }}</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.cmp{display:flex;flex-direction:column;gap:16px}
.head{display:flex;flex-wrap:wrap;gap:12px 24px;align-items:flex-end;justify-content:space-between}
.add{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.add .field{min-height:36px;padding:0 8px}
.empty{margin:0;padding:16px}
.box{overflow-x:auto}
.grid{table-layout:fixed;min-width:calc(150px + var(--n) * 240px)}
.grid .rh{width:150px;text-align:left;vertical-align:top;background:var(--sheet-2)}
.grid td{vertical-align:top;font-size:13.5px}
.colh{text-align:left;vertical-align:top}
.ch{display:flex;justify-content:space-between;align-items:center;gap:6px}
.ch .ticker{font-size:22px}
.x{width:32px;min-height:32px;font-size:18px;line-height:1}
.nm{margin:2px 0 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.big{font:700 18px var(--f-display)}
.chg{font:600 13px var(--f-display)}
.up{color:var(--good)}.dn{color:var(--strong)}
</style>
