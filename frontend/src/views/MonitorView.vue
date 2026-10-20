<script setup>
import { computed, onMounted, ref } from 'vue'
import { store, pandanganOf, autoRefresh, userRefresh, canSync } from '../store.js'
import { stageOf, trackIndex, fairGap, num } from '../lib/domain.js'
import StageTrack from '../components/StageTrack.vue'
import SikapTag from '../components/SikapTag.vue'
import FairBar from '../components/FairBar.vue'

const TRACK = ['PPJB', 'PTW', 'RUPSLB', 'Injeksi', 'Selesai']
const SIKAP = [['Hindari', 'Hindari'], ['Spekulatif tinggi', 'Spekulatif'], ['Netral', 'Netral'], ['Asimetri positif', 'Asimetri+']]

const q = ref('')
const stage = ref(-1)
const sikap = ref('')
const sort = ref('date')

const shortDate = iso => new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })

// Laporan terbaru per kode dari feed; cadangan dari sumberTambahan "Judul — Sumber, YYYY-MM-DD".
const latestUpd = computed(() => {
  const m = {}
  for (const u of store.updates) {
    if (!u.ticker || !u.date) continue
    const cur = m[u.ticker]
    if (!cur || u.date > cur.date || (u.date === cur.date && (u.updatedAt || '') > (cur.updatedAt || ''))) m[u.ticker] = u
  }
  return m
})
function lastReport(t) {
  const u = latestUpd.value[t]
  if (u) return { date: u.date.slice(0, 10), title: u.title || '', src: u.source || '', stamp: u.updatedAt || u.date }
  let best = null
  for (const s of store.verified[t]?.sumberTambahan || []) {
    if (typeof s !== 'string' || /diakses/i.test(s)) continue
    const m = s.match(/^(.*) — (.*), (\d{4}-\d\d-\d\d)$/)
    if (m && (!best || m[3] > best.date)) best = { date: m[3], title: m[1], src: m[2], stamp: m[3] }
  }
  return best
}

const all = computed(() => store.items.filter(i => stageOf(i) !== 'radar').map(item => {
  const t = item.ticker
  const pa = pandanganOf(t)
  const price = num(item.price) ?? pa?.hargaAcuan ?? null
  const lo = pa?.nilaiWajar?.bawah ?? null, hi = pa?.nilaiWajar?.atas ?? null
  const rep = lastReport(t)
  return { item, t, sikap: pa?.sikap || '', price, lo, hi, gap: fairGap(price, lo, hi), ti: trackIndex(item), rep,
    isNew: !!(rep && store.seenAt && rep.stamp > store.seenAt) }
}))

const searched = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return all.value
  return all.value.filter(r => [r.t, r.item.name, r.item.acquirer, r.item.ctrlName].some(v => (v || '').toLowerCase().includes(s)))
})

const rows = computed(() => {
  const list = searched.value.filter(r => (stage.value < 0 || r.ti === stage.value) && (!sikap.value || r.sikap === sikap.value))
  const cmp = {
    ticker: (a, b) => a.t.localeCompare(b.t),
    gap: (a, b) => (b.gap ?? -Infinity) - (a.gap ?? -Infinity),
    date: (a, b) => (b.rep?.date || '').localeCompare(a.rep?.date || ''),
  }[sort.value]
  return list.slice().sort(cmp)
})

const stagePills = computed(() => [{ i: -1, label: 'Semua', n: searched.value.length },
  ...TRACK.map((label, i) => ({ i, label, n: searched.value.filter(r => r.ti === i).length }))])
const sikapPills = computed(() => SIKAP.map(([id, label]) => ({ id, label, n: searched.value.filter(r => r.sikap === id).length })))

const seenTxt = computed(() => {
  if (!store.seenAt) return ''
  const d = new Date(store.seenAt)
  return isNaN(d) ? '' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':')
})
const nNew = computed(() => all.value.filter(r => r.isNew).length)

// Tenggat PTW terdekat dalam 14 hari ke depan.
const deadline = computed(() => {
  const today = new Date(new Date().toDateString())
  let best = null
  for (const r of all.value) {
    const end = r.item.tender?.end?.slice(0, 10)
    if (!end) continue
    const days = Math.round((new Date(end + 'T00:00:00') - today) / 864e5)
    if (days >= 0 && days <= 14 && (!best || days < best.days)) best = { t: r.t, end, days }
  }
  return best
})

const syncTitle = computed(() => store.busy.stockbit ? 'Sedang memperbarui'
  : canSync() ? 'Tarik harga, kepemilikan, dan tender terbaru'
  : !store.status ? 'Server belum terhubung' : !store.status.configured ? 'Konfigurasi Stockbit belum diisi' : 'Token Stockbit belum dimuat')

onMounted(() => autoRefresh('stockbit'))
</script>

<template>
  <div class="mon">
    <header class="head">
      <h1>Monitor</h1>
      <div class="tools">
        <label for="mq" class="sr-only">Cari emiten</label>
        <input id="mq" v-model="q" data-search type="search" class="field" placeholder="Cari kode atau pengendali">
        <button type="button" class="btn primary" :disabled="store.busy.stockbit || !canSync()" :title="syncTitle" @click="userRefresh('stockbit')">
          {{ store.busy.stockbit ? 'Memperbarui…' : 'Perbarui dari Stockbit' }}
        </button>
      </div>
    </header>

    <p v-if="seenTxt || deadline" class="summary">
      <template v-if="seenTxt">
        <span class="muted">Sejak dibuka {{ seenTxt }}: </span>
        <b :class="{ now: nNew }">{{ nNew }} emiten punya laporan baru</b>
      </template>
      <template v-if="deadline">
        <span v-if="seenTxt" class="muted"> · </span>{{ deadline.t }} masa PTW berakhir <b>{{ shortDate(deadline.end) }}</b>
        ({{ deadline.days ? deadline.days + ' hari' : 'hari ini' }})
      </template>
    </p>

    <div class="filters">
      <div role="group" aria-label="Saring tahap" class="grp">
        <span class="lbl">Tahap</span>
        <button v-for="p in stagePills" :key="p.i" type="button" class="pill" :aria-pressed="String(stage === p.i)" @click="stage = p.i">{{ p.label }}<b>{{ p.n }}</b></button>
      </div>
      <div role="group" aria-label="Saring sikap" class="grp">
        <span class="lbl">Sikap</span>
        <button v-for="p in sikapPills" :key="p.id" type="button" class="pill" :aria-pressed="String(sikap === p.id)" @click="sikap = sikap === p.id ? '' : p.id">{{ p.label }}<b>{{ p.n }}</b></button>
      </div>
    </div>

    <section aria-label="Daftar emiten" class="sheet box">
      <table class="ledger">
        <thead><tr>
          <th class="lbl"><button type="button" class="sortb" :aria-pressed="String(sort === 'ticker')" @click="sort = 'ticker'">Kode</button></th>
          <th class="lbl" title="PPJB, PTW, RUPSLB, Injeksi, Selesai">Tahap</th>
          <th class="lbl">Sikap</th>
          <th class="lbl num">Harga</th>
          <th class="lbl"><button type="button" class="sortb" :aria-pressed="String(sort === 'gap')" title="Jarak harga dari batas rentang nilai wajar. 0% = di dalam rentang." @click="sort = 'gap'">Selisih nilai wajar</button></th>
          <th class="lbl wide"><button type="button" class="sortb" :aria-pressed="String(sort === 'date')" @click="sort = 'date'">Laporan terakhir</button></th>
        </tr></thead>
        <tbody>
          <tr v-for="r in rows" :key="r.t">
            <td><RouterLink class="ticker" :to="'/emiten/' + r.t">{{ r.t }}</RouterLink></td>
            <td><StageTrack :item="r.item" /></td>
            <td><SikapTag :sikap="r.sikap" short /></td>
            <td class="num price">{{ r.price != null ? r.price.toLocaleString('id-ID') : '–' }}</td>
            <td><FairBar :price="r.price" :lo="r.lo" :hi="r.hi" /></td>
            <td>
              <div v-if="r.rep" class="rep">
                <span class="dd" :class="{ now: r.isNew }">{{ shortDate(r.rep.date) }}</span>
                <span class="ev">{{ r.rep.title }} <span v-if="r.rep.src" class="muted small">· {{ r.rep.src }}</span></span>
              </div>
              <span v-else class="muted small">belum ada</span>
            </td>
          </tr>
          <tr v-if="!rows.length"><td colspan="6" class="muted empty">Tidak ada emiten yang cocok dengan saringan ini.</td></tr>
        </tbody>
      </table>
    </section>
    <p class="muted foot">Bar hijau = rentang nilai wajar dari pandangan analis, garis hitam = harga. Selisih merah = di atas batas atas, hijau = di bawah batas bawah, 0% = di dalam rentang. Tanggal oranye = laporan baru sejak kunjungan terakhir.</p>
  </div>
</template>

<style scoped>
.mon{display:flex;flex-direction:column;gap:14px}
.head{display:flex;flex-wrap:wrap;gap:10px 24px;align-items:flex-end;justify-content:space-between}
.tools{display:flex;flex-wrap:wrap;gap:8px}
.tools .field{width:240px;max-width:100%}
.summary{margin:0;padding:10px 0;border-top:2px solid var(--ink);border-bottom:1px solid var(--rule)}
.now{color:var(--now-ink)}
.filters{display:flex;flex-wrap:wrap;gap:8px 20px;align-items:center}
.grp{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.grp .lbl{margin-right:2px}
.box{overflow:auto;max-height:72vh}
.num{text-align:right}
.wide{width:44%}
.price{font:700 16px var(--f-display)}
.sortb[aria-pressed="true"]::after{content:"";display:inline-block;width:8px;height:10px;margin-left:5px;background:currentColor;-webkit-mask:var(--ic-down) center/contain no-repeat;mask:var(--ic-down) center/contain no-repeat}
.rep{display:flex;gap:10px;align-items:baseline}
.dd{flex:none;width:46px;font:700 15px var(--f-display);color:var(--ink-2)}
.dd.now{color:var(--now-ink)}
.ev{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:460px}
.empty{padding:14px}
.foot{margin:0;font-size:12px}
</style>
