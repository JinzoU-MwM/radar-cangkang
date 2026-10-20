<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { store, pandanganOf, autoRefresh, userRefresh, canSync } from '../store.js'
import { stageOf, trackIndex, fairGap, num, progressOf, dealOf, posisiOf } from '../lib/domain.js'
import { nominalRp } from '../lib/analysis.js'
import StageTrack from '../components/StageTrack.vue'
import SikapTag from '../components/SikapTag.vue'
import FairBar from '../components/FairBar.vue'
import CycleChart from '../components/CycleChart.vue'

const TRACK = ['PPJB', 'PTW', 'RUPSLB', 'Injeksi', 'Selesai']
const SIKAP = [['Hindari', 'Hindari'], ['Spekulatif tinggi', 'Spekulatif'], ['Netral', 'Netral'], ['Asimetri positif', 'Asimetri+']]

const q = ref('')
const stage = ref(-1)
const sikap = ref('')
const sort = ref('date')

// Saringan injeksi aset: beberapa bisa aktif sekaligus (logika DAN). Pilihan & rentang diingat di browser ini.
const LS_INJ = 'radar-cangkang.progInj'
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const saved = lsGet(LS_INJ, {})
const inj = ref(Array.isArray(saved.on) ? saved.on : [])
const ptw = ref(saved.ptw || '')
const pg = ref({ lo: 40, hi: 60, ...saved.pg })
watch([inj, ptw, pg], () => { try { localStorage.setItem(LS_INJ, JSON.stringify({ on: inj.value, ptw: ptw.value, pg: pg.value })) } catch {} }, { deep: true })
const today = () => new Date().toISOString().slice(0, 10)
// Status PTW sejak pengendali masuk: belum dibuka, sedang berjalan, atau selesai (dibayar / masa tender lewat).
function ptwOf(item, ms) {
  const t = item.tender || {}
  if (ms.to_selesai || (t.end && t.end.slice(0, 10) < today())) return 'selesai'
  if (ms.to_umum || (t.start && t.start.slice(0, 10) <= today())) return 'sedang'
  return 'belum'
}
// Nilai aset injeksi: data aset terverifikasi, bila kosong dari nominal story.
const asetRp = t => store.aset[t]?.transaksi?.nilaiRp ?? nominalRp(store.verified[t]?.nominal) ?? 0
const INJ = {
  nonHsc: { label: 'Injeksi aset non-HSC', tip: 'Ada data aset injeksi terverifikasi dan bukan saham HSC BEI',
    test: r => !!store.aset[r.t] && !store.hsc.kode.includes(r.t) },
  ctrlIn: { label: 'Pengendali sudah masuk', tip: 'Akuisisi oleh pengendali baru sudah efektif; PTW belum dibuka, sedang berjalan, atau selesai',
    test: r => !!r.prog.ms.akuisisi && !store.pengendali[r.t]?.bukanPengambilAlih && (!ptw.value || r.ptw === ptw.value) },
  big: { label: 'Aset ≥ Rp1 T', tip: 'Nilai aset atau transaksi injeksi minimal Rp1 triliun', test: r => asetRp(r.t) >= 1e12 },
  prog: { label: 'Progress', tip: 'Penyelesaian transaksi (bukan perkiraan) dalam rentang ini',
    test: r => !r.prog.est && r.prog.pct >= pg.value.lo && r.prog.pct <= pg.value.hi },
}
const PTW = [['', 'PTW apa saja'], ['belum', 'PTW belum'], ['sedang', 'PTW berjalan'], ['selesai', 'PTW selesai']]
const passInj = (r, keys = inj.value) => keys.every(k => !INJ[k] || INJ[k].test(r))
function toggleInj(k) { inj.value = inj.value.includes(k) ? inj.value.filter(x => x !== k) : [...inj.value, k] }

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
  const ctx = { aset: store.aset, verified: store.verified }
  const prog = progressOf(item, ctx)
  const pa = pandanganOf(t)
  const price = num(item.price) ?? pa?.hargaAcuan ?? null
  const lo = pa?.nilaiWajar?.bawah ?? null, hi = pa?.nilaiWajar?.atas ?? null
  const rep = lastReport(t)
  return { item, t, prog, deal: dealOf(item, prog, ctx), pos: posisiOf(item, prog, ctx), ptw: ptwOf(item, prog.ms), sikap: pa?.sikap || '', price, lo, hi, gap: fairGap(price, lo, hi), ti: trackIndex(item), rep,
    isNew: !!(rep && store.seenAt && rep.stamp > store.seenAt) }
}))

const searched = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return all.value
  return all.value.filter(r => [r.t, r.item.name, r.item.acquirer, r.item.ctrlName].some(v => (v || '').toLowerCase().includes(s)))
})

const injected = computed(() => searched.value.filter(r => passInj(r)))
// Saring tahap & sikap tanpa injeksi: dasar hitungan tombol injeksi.
const baseInj = computed(() => searched.value.filter(r => (stage.value < 0 || r.ti === stage.value) && (!sikap.value || r.sikap === sikap.value)))
// Angka di tombol injeksi = jumlah emiten bila tombol itu ikut digabung dengan pilihan aktif.
const injPills = computed(() => Object.entries(INJ).map(([k, f]) => ({ k, ...f, on: inj.value.includes(k),
  n: baseInj.value.filter(r => passInj(r, [...new Set([...inj.value, k])])).length })))
const ptwPills = computed(() => PTW.map(([id, label]) => ({ id, label,
  n: baseInj.value.filter(r => passInj(r, inj.value.filter(k => k !== 'ctrlIn')) && r.prog.ms.akuisisi && !store.pengendali[r.t]?.bukanPengambilAlih && (!id || r.ptw === id)).length })))
function setPg(k, v) {
  const n = Math.max(0, Math.min(100, Math.round(+v || 0)))
  pg.value = { ...pg.value, [k]: n }
  if (!inj.value.includes('prog')) inj.value = [...inj.value, 'prog']
}

const rows = computed(() => {
  const list = injected.value.filter(r => (stage.value < 0 || r.ti === stage.value) && (!sikap.value || r.sikap === sikap.value))
  const cmp = {
    ticker: (a, b) => a.t.localeCompare(b.t),
    gap: (a, b) => (b.gap ?? -Infinity) - (a.gap ?? -Infinity),
    date: (a, b) => (b.rep?.date || '').localeCompare(a.rep?.date || ''),
    prog: (a, b) => b.prog.pct - a.prog.pct,
  }[sort.value]
  return list.slice().sort(cmp)
})

const stagePills = computed(() => [{ i: -1, label: 'Semua', n: injected.value.length },
  ...TRACK.map((label, i) => ({ i, label, n: injected.value.filter(r => r.ti === i).length }))])
const sikapPills = computed(() => SIKAP.map(([id, label]) => ({ id, label, n: injected.value.filter(r => r.sikap === id).length })))

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

// Grafik siklus baru dimuat saat dibuka: datanya ditarik dari Stockbit per emiten.
const cycOpen = ref(false)

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
      <div id="progInj" role="group" aria-label="Saring injeksi aset, bisa digabung" class="grp">
        <span class="lbl">Injeksi</span>
        <button type="button" class="pill" :aria-pressed="String(!inj.length)" @click="inj = []">Semua<b>{{ baseInj.length }}</b></button>
        <template v-for="p in injPills" :key="p.k">
          <button type="button" class="pill" :aria-pressed="String(p.on)" :title="p.tip" @click="toggleInj(p.k)">
            {{ p.k === 'prog' ? `Progress ${pg.lo}–${pg.hi}%` : p.label }}<b>{{ p.n }}</b>
          </button>
          <span v-if="p.k === 'ctrlIn' && p.on" class="sub" role="group" aria-label="Status PTW">
            <button v-for="o in ptwPills" :key="o.id" type="button" class="pill sm" :aria-pressed="String(ptw === o.id)" @click="ptw = o.id">{{ o.label }}<b>{{ o.n }}</b></button>
          </span>
          <span v-if="p.k === 'prog'" class="range">
            <label for="pglo" class="sr-only">Progress minimum (%)</label>
            <input id="pglo" class="field" type="number" min="0" max="100" step="5" :value="pg.lo" @change="setPg('lo', $event.target.value)">
            <span class="muted">–</span>
            <label for="pghi" class="sr-only">Progress maksimum (%)</label>
            <input id="pghi" class="field" type="number" min="0" max="100" step="5" :value="pg.hi" @change="setPg('hi', $event.target.value)">
            <span class="muted small">%</span>
          </span>
        </template>
      </div>
    </div>

    <section id="progTable" aria-label="Daftar emiten" class="sheet box">
      <table class="ledger">
        <thead><tr>
          <th class="lbl"><button type="button" class="sortb" :aria-pressed="String(sort === 'ticker')" @click="sort = 'ticker'">Kode</button></th>
          <th class="lbl" title="PPJB, PTW, RUPSLB, Injeksi, Selesai"><button type="button" class="sortb" :aria-pressed="String(sort === 'prog')" title="Urutkan menurut persen penyelesaian transaksi" @click="sort = 'prog'">Tahap</button></th>
          <th class="lbl">Posisi</th>
          <th class="lbl c-next">Selanjutnya</th>
          <th class="lbl">Sikap</th>
          <th class="lbl num c-opt">Harga</th>
          <th class="lbl c-opt"><button type="button" class="sortb" :aria-pressed="String(sort === 'gap')" title="Jarak harga dari batas rentang nilai wajar. 0% = di dalam rentang." @click="sort = 'gap'">Selisih nilai wajar</button></th>
          <th class="lbl wide"><button type="button" class="sortb" :aria-pressed="String(sort === 'date')" @click="sort = 'date'">Laporan terakhir</button></th>
        </tr></thead>
        <tbody>
          <tr v-for="r in rows" :key="r.t">
            <td><RouterLink class="ticker" :to="'/emiten/' + r.t">{{ r.t }}</RouterLink></td>
            <td>
              <StageTrack :item="r.item" />
              <span class="pct small" :title="r.prog.est ? 'Perkiraan dari tahap; tahapan belum terisi' : 'Penyelesaian transaksi'">{{ r.prog.est ? '±' : '' }}{{ r.prog.pct }}%</span>
            </td>
            <td class="pos">
              <span v-if="r.deal === 'selesai'" class="tag done">Selesai</span>
              <span class="clamp">{{ r.pos.now }}</span>
            </td>
            <td class="nx c-next"><span class="clamp" :title="r.pos.next">{{ r.pos.next || '–' }}</span></td>
            <td><SikapTag :sikap="r.sikap" short /></td>
            <td class="num price c-opt">{{ r.price != null ? r.price.toLocaleString('id-ID') : '–' }}</td>
            <td class="c-opt"><FairBar :price="r.price" :lo="r.lo" :hi="r.hi" /></td>
            <td class="rp">
              <div v-if="r.rep" class="rep">
                <span class="dd" :class="{ now: r.isNew }">{{ shortDate(r.rep.date) }}</span>
                <span class="ev">{{ r.rep.title }} <span v-if="r.rep.src" class="muted small">· {{ r.rep.src }}</span></span>
              </div>
              <span v-else class="muted small">belum ada</span>
            </td>
          </tr>
          <tr v-if="!rows.length"><td colspan="8" class="muted empty">Tidak ada emiten yang cocok dengan saringan ini.</td></tr>
        </tbody>
      </table>
    </section>
    <details id="cycleBox" class="sheet cyc" @toggle="cycOpen = cycOpen || $event.target.open">
      <summary><h2>Siklus saham backdoor</h2></summary>
      <CycleChart v-if="cycOpen" :items="store.items" />
    </details>
    <p class="muted foot">Persen di kolom Tahap = penyelesaian transaksi (± = perkiraan dari tahap). Bar hijau = rentang nilai wajar dari pandangan analis, garis hitam = harga. Selisih merah = di atas batas atas, hijau = di bawah batas bawah, 0% = di dalam rentang. Tanggal oranye = laporan baru sejak kunjungan terakhir.</p>
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
.wide{width:24%}
.sub,.range{display:inline-flex;flex-wrap:wrap;gap:4px;align-items:center}
.pill.sm{min-height:26px;font-size:12.5px;padding:2px 8px}
.range .field{width:64px;min-height:30px;padding:0 6px}
.pct{display:block;margin-top:2px;color:var(--ink-2);font-family:var(--f-display);font-weight:600}
.pos,.nx{min-width:140px;max-width:240px;font-size:13px}
.nx{color:var(--ink-2)}
.clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-clamp:2;overflow:hidden}
.done{background:var(--accent);color:var(--accent-ink);margin-bottom:2px}
.cyc{padding:0 16px}
.cyc summary{cursor:pointer;padding:12px 0;list-style-position:inside}
.cyc summary h2{display:inline;font-size:19px}
.cyc[open] summary{border-bottom:1px solid var(--rule-2);margin-bottom:12px}
@media (max-width:1199px){.c-opt{display:none}}
@media (max-width:760px){.c-next{display:none}.pos{min-width:130px}}
.price{font:700 16px var(--f-display)}
.sortb[aria-pressed="true"]::after{content:"";display:inline-block;width:8px;height:10px;margin-left:5px;background:currentColor;-webkit-mask:var(--ic-down) center/contain no-repeat;mask:var(--ic-down) center/contain no-repeat}
.rep{display:flex;gap:10px;align-items:baseline}
.dd{flex:none;width:46px;font:700 15px var(--f-display);color:var(--ink-2)}
.dd.now{color:var(--now-ink)}
.rp{max-width:0}   /* sel mengisi sisa lebar; judul laporan dipotong elipsis */
.rep{min-width:0}
.ev{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.empty{padding:14px}
.foot{margin:0;font-size:12px}
</style>
