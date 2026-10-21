<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '../../api.js'
import { store, itemOf, storyOf, relasiOf } from '../../store.js'
import { fmtDate, rp, stageOf } from '../../lib/domain.js'
import { ctrlProsCons, relationTone } from '../../lib/emitenExtra.js'
import Modal from './Modal.vue'
import ProsCons from './ProsCons.vue'

// Profil pengendali baru: data Stockbit (/api/controller) + profil terverifikasi + orang di baliknya (relasi-verified.json).
const props = defineProps({ ticker: { type: String, required: true } })
const emit = defineEmits(['close', 'flow'])

const item = computed(() => itemOf(props.ticker))
const story = computed(() => storyOf(props.ticker))
const pg = computed(() => store.pengendali[props.ticker] || null)
const rs = computed(() => relasiOf(props.ticker))

// Bila pengendali lebih dari satu ("A, B"), pakai nama pertama untuk pencarian.
const name = computed(() => String(item.value?.ctrlName || item.value?.acquirer || '')
  .replace(/\s*\(.*\)$/, '').split(/,\s*(?=[A-Z])/)[0].trim())

const c = ref(null)
const err = ref('')
const loading = ref(false)
onMounted(async () => {
  if (!name.value) return
  loading.value = true
  try { c.value = await api.get('/api/controller', { ticker: props.ticker, name: name.value }) }
  catch (e) { err.value = e.message || 'server lokal tidak merespons' }
  finally { loading.value = false }
})

// Node pengendali di diagram relasi: node kunci (k = "key").
const ctrlNode = computed(() => rs.value?.nodes?.find(n => n.k === 'key') || null)
const nodeOf = id => rs.value?.nodes?.find(n => n.id === id)
const ctrlInfo = computed(() => ctrlNode.value ? rs.value.info?.[ctrlNode.value.id] || null : null)
const people = computed(() => {
  const id = ctrlNode.value?.id
  if (!id) return []
  return (rs.value.edges || []).filter(e => e[1] === id && (e[2] === 'own' || e[2] === 'role'))
    .map(([from, , kind, label]) => ({ id: from, node: nodeOf(from), info: rs.value.info?.[from] || {}, kind, label }))
    .filter(p => p.node)
})
const outEdges = computed(() => {
  const id = ctrlNode.value?.id
  if (!id) return []
  return (rs.value.edges || []).filter(e => e[0] === id).map(([, to, kind, label]) => ({ to: nodeOf(to)?.t || to, kind, label }))
})

const title = computed(() => c.value?.name || ctrlNode.value?.t || name.value || 'Pengendali ' + props.ticker)
const ctrlPct = computed(() => c.value?.pct || (item.value?.ctrlPct != null ? (+item.value.ctrlPct).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + '%' : ''))

const holds = computed(() => (c.value?.holdings || []).filter(h => h.symbol !== props.ticker))
const active = computed(() => holds.value.filter(h => h.pct > 0))
const exited = computed(() => holds.value.filter(h => !(h.pct > 0)))
const inRadar = t => store.items.find(x => x.ticker === t && stageOf(x) !== 'radar')
const act = a => a === 'BUY' ? 'Beli' : a === 'SELL' ? 'Jual' : a || 'belum ada'
const fd = s => s ? fmtDate(String(s).slice(0, 10)) : 'belum ada'

// Emiten radar lain dengan nama pengendali yang sama.
const normName = s => String(s || '').toUpperCase().replace(/\bPT\.?\s*|\bTBK\.?|[.,]/g, ' ').replace(/\s+/g, ' ').trim()
const group = computed(() => {
  const key = normName(c.value?.name || name.value)
  return key ? store.items.filter(x => x.ticker !== props.ticker && normName(x.ctrlName).includes(key)) : []
})
// Profil per orang, pengurus, dan afiliasi pihak lawan (profil-pengendali.json).
const pf = computed(() => store.profil[props.ticker] || null)
const pengurus = computed(() => [
  ...(pf.value?.pengurus?.direksi || []).map(x => ({ ...x, grp: 'Direksi' })),
  ...(pf.value?.pengurus?.komisaris || []).map(x => ({ ...x, grp: 'Komisaris' })),
])
const af = computed(() => pf.value?.afiliasi || null)
const rel = computed(() => relationTone(af.value?.hubungan))
const VER = /terverifikasi/i
const noRisk = r => !r || /^tidak (ditemukan|ada)\b/i.test(r.trim())
const pc = computed(() => ctrlProsCons({ profil: pf.value, pv: pg.value, c: c.value, active: active.value, exited: exited.value,
  radarTickers: active.value.map(h => h.symbol).filter(inRadar), group: group.value.map(x => x.ticker) }))

const srcs = computed(() => [ctrlInfo.value?.src, ...people.value.map(p => p.info.src)].filter(Boolean))
</script>

<template>
  <Modal labelledby="ctrlTitle" close-label="Tutup profil pengendali" @close="emit('close')">
    <template #title>
      <div class="lbl">Profil pengendali baru · {{ ticker }}</div>
      <h2 id="ctrlTitle" class="t">{{ title }}</h2>
      <div class="small muted">
        {{ [ctrlInfo?.kind, ctrlPct && `${ctrlPct} ${ticker}`, story?.takeoverDate && 'sejak ' + fmtDate(story.takeoverDate)].filter(Boolean).join(' · ') || item?.name }}
      </div>
    </template>

    <div v-if="ctrlNode" class="acts">
      <button type="button" class="btn" @click="emit('flow', ctrlNode.id)">
        <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="4" cy="4" r="2.2" /><circle cx="14" cy="4" r="2.2" /><circle cx="9" cy="14" r="2.2" /><path d="M5.5 5.6 8 12M12.5 5.6 10 12" /></svg>
        Buka alur saham
      </button>
    </div>

    <dl class="kv kpi">
      <div><dt>Jumlah saham</dt><dd>{{ c?.shares || (loading ? 'memuat' : 'belum ada') }}</dd></div>
      <div><dt>Pengendali lama</dt><dd>{{ story?.oldName || 'belum ada' }}</dd></div>
      <div><dt>Afiliasi aktif</dt><dd>{{ c ? active.length + ' emiten' : (loading ? 'memuat' : 'belum ada') }}</dd></div>
    </dl>

    <section v-if="pg" class="sec">
      <h3 class="lbl">Siapa dan apa rencananya</h3>
      <p v-if="pg.bukanPengambilAlih" class="note">Nama di kolom pengendali {{ ticker }} adalah pengendali lama/penjual atau bukan pengambil alih. Data kepemilikan dan afiliasi di bawah milik nama tersebut.</p>
      <p>{{ pg.siapa }}</p>
      <p v-if="pg.grup"><b>Latar belakang grup:</b> {{ pg.grup }}</p>
      <p v-if="pg.rencana"><b>Rencana:</b> {{ pg.rencana }}</p>
      <p v-if="pg.catatan" class="catat"><b>Catatan investor:</b> {{ pg.catatan }}</p>
      <p v-if="pg.sumberJudul" class="small muted">Sumber: {{ pg.sumberJudul }}<template v-if="pg.sumberTanggal"> · {{ fmtDate(pg.sumberTanggal) }}</template></p>
    </section>

    <section v-if="pf?.ringkas" class="sec">
      <h3 class="lbl">Ringkasan</h3>
      <p>{{ pf.ringkas }}</p>
    </section>

    <section v-if="pf || pg || c" class="sec">
      <h3 class="lbl">Kekuatan vs kelemahan pengendali</h3>
      <ProsCons :pros="pc.pros" :cons="pc.cons" pro-label="Kekuatan" con-label="Kelemahan & red flag" />
    </section>

    <section v-if="pf?.pengendali?.length" class="sec">
      <h3 class="lbl">Profil pengendali per orang ({{ pf.pengendali.length }})</h3>
      <article v-for="o in pf.pengendali" :key="o.nama" class="pp">
        <header><b class="pn">{{ o.nama }}</b><span class="small muted">{{ [o.peran, o.entitas].filter(Boolean).join(' · ') }}</span></header>
        <dl class="kv">
          <div><dt>Porsi</dt><dd>{{ o.porsi || 'belum ada' }}</dd></div>
          <div><dt>Latar</dt><dd>{{ o.latar || 'belum ada' }}</dd></div>
          <div><dt>Pengalaman</dt><dd>{{ o.pengalaman || 'belum ada' }}</dd></div>
          <div v-if="o.karakteristik"><dt>Karakter</dt><dd>{{ o.karakteristik }}</dd></div>
          <div v-if="o.jaringan?.length"><dt>Jaringan</dt><dd>
            <ul class="net">
              <li v-for="j in o.jaringan" :key="j.dengan">
                <b>{{ j.dengan }}</b> <span class="tag" :class="VER.test(j.keyakinan || '') ? 't-good' : 't-warn'">{{ VER.test(j.keyakinan || '') ? 'terverifikasi' : 'disebut media' }}</span>
                <span v-if="j.hubungan" class="small muted"> {{ j.hubungan }}</span>
              </li>
            </ul>
          </dd></div>
          <div><dt>Risiko</dt><dd :class="{ flag: !noRisk(o.risiko) }">{{ o.risiko || 'belum ada' }}</dd></div>
        </dl>
        <details v-if="o.sumber?.length" class="more"><summary>Sumber ({{ o.sumber.length }})</summary><ul class="small"><li v-for="x in o.sumber" :key="x">{{ x }}</li></ul></details>
      </article>
    </section>

    <section v-if="ctrlInfo" class="sec">
      <h3 class="lbl">Struktur</h3>
      <p v-if="ctrlInfo.who">{{ ctrlInfo.who }}</p>
      <p v-if="ctrlInfo.role">{{ ctrlInfo.role }}</p>
      <ul v-if="outEdges.length" class="plain">
        <li v-for="e in outEdges" :key="e.to" :class="{ void: e.kind === 'void' }"><b>{{ e.to }}</b> <span class="muted">{{ e.label }}</span></li>
      </ul>
    </section>

    <section v-if="people.length" class="sec">
      <h3 class="lbl">Orang di balik {{ ctrlNode.t }}</h3>
      <div class="people">
        <article v-for="p in people" :key="p.id" class="person">
          <div><b class="pn">{{ p.node.t }}</b><br><span class="muted small">{{ [p.info.kind, p.label].filter(Boolean).join(' · ') }}</span></div>
          <p v-if="p.info.who">{{ p.info.who }}</p>
          <p v-if="p.info.role"><span class="lbl">Peran</span><br>{{ p.info.role }}</p>
          <p v-if="p.info.flag" class="flag">{{ p.info.flag }}</p>
          <div v-if="p.info.track?.length">
            <span class="lbl">{{ p.info.trackTitle || 'Rekam jejak' }}</span>
            <ol class="trk"><li v-for="(t, i) in p.info.track" :key="i"><b v-if="t[0] && t[0] !== '—'">{{ t[0] }}</b><template v-if="t[0] && t[0] !== '—'"> · </template>{{ t[1] }}</li></ol>
          </div>
          <p v-if="p.info.note" class="warn small">{{ p.info.note }}</p>
          <p v-if="p.info.open?.length" class="muted small">Belum terverifikasi: {{ p.info.open.join('; ') }}</p>
        </article>
      </div>
    </section>

    <section v-if="ctrlInfo?.track?.length" class="sec alert">
      <h3 class="lbl">{{ ctrlInfo.trackTitle || 'Rekam jejak' }} {{ ctrlNode.t }}</h3>
      <ol class="trk"><li v-for="(t, i) in ctrlInfo.track" :key="i"><b>{{ t[0] }}</b> · {{ t[1] }}</li></ol>
      <p v-if="ctrlInfo.flag">{{ ctrlInfo.flag }}</p>
      <p v-if="ctrlInfo.open?.length" class="small muted">Belum terverifikasi: {{ ctrlInfo.open.join('; ') }}</p>
    </section>

    <section v-if="pengurus.length" class="sec">
      <h3 class="lbl">Struktur direksi & komisaris</h3>
      <div class="scroll">
        <table class="ledger">
          <thead><tr><th class="lbl">Nama</th><th class="lbl">Jabatan</th><th class="lbl">Asal</th><th class="lbl">Latar</th></tr></thead>
          <tbody>
            <tr v-for="x in pengurus" :key="x.grp + x.nama">
              <td><b>{{ x.nama }}</b><div class="small muted">{{ x.grp }}</div></td>
              <td>{{ x.jabatan || 'belum ada' }}<template v-if="x.independen"> <span class="tag t-calm">independen</span></template></td>
              <td><span class="tag" :class="x.orangPengendaliBaru ? 't-good' : 't-calm'">{{ x.orangPengendaliBaru ? 'orang pengendali baru' : 'pengurus lama' }}</span></td>
              <td class="small">{{ x.latar || 'belum ada' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="af" class="sec">
      <h3 class="lbl">Afiliasi pihak lawan transaksi</h3>
      <dl class="kv">
        <div><dt>Pihak lawan</dt><dd>{{ af.pihakLawan || 'belum ada' }}</dd></div>
        <div><dt>Pemilik aset</dt><dd>{{ af.pemilikAset || 'belum ada' }}</dd></div>
        <div><dt>Pengendali/UBO</dt><dd>{{ af.pengendaliPihakLawan || 'belum ada' }}</dd></div>
        <div v-if="af.karakteristik"><dt>Karakteristik</dt><dd>{{ af.karakteristik }}</dd></div>
        <div :class="{ hot: rel }"><dt>Hubungan</dt><dd>
          <span v-if="rel" class="tag t-strong">{{ rel === 'afiliasi' ? 'terafiliasi' : 'perlu dicermati' }}</span>
          {{ af.hubungan || 'belum ada' }}
        </dd></div>
      </dl>
      <details v-if="af.sumber?.length" class="more"><summary>Sumber ({{ af.sumber.length }})</summary><ul class="small"><li v-for="x in af.sumber" :key="x">{{ x }}</li></ul></details>
    </section>

    <p v-if="loading" class="muted">Memuat data pengendali {{ name }} dari Stockbit…</p>
    <p v-else-if="err" class="muted">Data Stockbit untuk pengendali tidak bisa dimuat: {{ err }}.</p>
    <p v-else-if="!name" class="muted">Nama pengendali di data radar belum ada, jadi data Stockbit tidak dicari.</p>

    <template v-if="c">
      <div class="grid2">
        <section class="sec">
          <h3 class="lbl">Pemilik manfaat (UBO)</h3>
          <p>{{ c.beneficiary?.join(', ') || 'Tidak tercatat di Stockbit' }}</p>
          <template v-if="!pengurus.length"><h3 class="lbl">Pengurus {{ ticker }}</h3>
          <p><b>Direksi:</b> {{ c.directors?.join(', ') || 'belum ada' }}</p>
          <p><b>Komisaris:</b> {{ c.commissioners?.join(', ') || 'belum ada' }}</p></template>
        </section>
        <section class="sec">
          <h3 class="lbl">Grup yang sama di radar</h3>
          <p v-if="!group.length" class="muted">Tidak ada emiten radar lain dengan pengendali ini.</p>
          <p v-for="x in group" :key="x.ticker">
            <RouterLink class="ticker" :to="'/emiten/' + x.ticker">{{ x.ticker }}</RouterLink> {{ x.name }}
            <template v-if="x.ctrlPct != null"> · {{ (+x.ctrlPct).toLocaleString('id-ID') }}%</template>
          </p>
          <template v-if="story?.injCo"><h3 class="lbl">Aset yang diinjeksikan</h3><p>{{ [story.injType, story.injCo, story.nominal].filter(Boolean).join(' · ') }}</p></template>
          <template v-if="item?.tender?.price"><h3 class="lbl">Harga PTW</h3><p>{{ rp(item.tender.price) }}</p></template>
        </section>
      </div>

      <section class="sec">
        <h3 class="lbl">Kepemilikan di emiten lain</h3>
        <div v-if="active.length" class="scroll">
          <table class="ledger">
            <thead><tr><th class="lbl">Emiten</th><th class="lbl r">Porsi terakhir</th><th class="lbl">Transaksi terakhir</th><th class="lbl">Pertama tercatat</th></tr></thead>
            <tbody>
              <tr v-for="h in active" :key="h.symbol">
                <td><b class="cond">{{ h.symbol }}</b> <span v-if="inRadar(h.symbol)" class="tag t-calm">Di radar</span></td>
                <td class="r num">{{ (+h.pct).toLocaleString('id-ID', { maximumFractionDigits: 2 }) }}%</td>
                <td>{{ act(h.lastAction) }} · {{ fd(h.lastDate) }}</td>
                <td>{{ fd(h.since) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="muted">Tidak ada kepemilikan 5% atau lebih di emiten lain yang tercatat atas nama ini.</p>
        <details v-if="exited.length" class="more">
          <summary>Pernah memiliki ({{ exited.length }})</summary>
          <div class="scroll">
            <table class="ledger">
              <thead><tr><th class="lbl">Emiten</th><th class="lbl">Transaksi terakhir</th><th class="lbl">Pertama tercatat</th></tr></thead>
              <tbody>
                <tr v-for="h in exited" :key="h.symbol"><td><b class="cond">{{ h.symbol }}</b></td><td>{{ act(h.lastAction) }} · {{ fd(h.lastDate) }}</td><td>{{ fd(h.since) }}</td></tr>
              </tbody>
            </table>
          </div>
        </details>
        <p class="small muted">
          Sumber: riwayat pemegang saham 5% ke atas (KSEI/IDX) di Stockbit atas nama badan hukum ini<template v-if="!c.holderId">; nama tidak ditemukan di riwayat sehingga afiliasi tidak bisa dilacak</template>.
          Kepemilikan lewat entitas lain milik UBO yang sama tidak ikut tercatat.
        </p>
      </section>
    </template>

    <details v-if="pf?.tidakDitemukan?.length" class="more">
      <summary>Belum ditemukan di sumber publik ({{ pf.tidakDitemukan.length }})</summary>
      <ul class="small"><li v-for="x in pf.tidakDitemukan" :key="x">{{ x }}</li></ul>
    </details>

    <section v-if="srcs.length" class="sec">
      <h3 class="lbl">Sumber relasi</h3>
      <ul class="small"><li v-for="s in srcs" :key="s">{{ s }}</li></ul>
      <p class="small muted">Hanya data korporat dan publik.</p>
    </section>
  </Modal>
</template>

<style scoped>
.t{font-size:30px;line-height:1.05;margin:2px 0}
.lbl{margin:0 0 6px}
.acts{display:flex;gap:8px;flex-wrap:wrap}
.sec{border-top:2px solid var(--ink);padding-top:10px}
.sec p{margin:0 0 6px;font-size:13.5px}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.people{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px 18px;font-size:13px}
.person{border-top:1px solid var(--rule);padding-top:8px;display:flex;flex-direction:column;gap:6px}
.person p{margin:0}
.pn{font-size:15px}
.flag{color:var(--strong)}
.warn{color:var(--warn)}
.alert{background:var(--strong-bg);padding:10px 14px}
.alert .lbl{color:var(--strong)}
.trk{margin:2px 0 6px;padding-left:18px;font-size:13px;display:flex;flex-direction:column;gap:2px}
.plain{list-style:none;margin:6px 0 0;padding:0;font-size:13px}
.plain li{padding:3px 0;border-top:1px solid var(--rule-2)}
.plain li.void b{text-decoration:line-through}
ul{margin:0;padding-left:18px}
.scroll{overflow-x:auto}
.ledger{font-size:13px}
.r{text-align:right}
.more{margin-top:8px}
.pp{border-top:1px solid var(--rule);padding:8px 0 4px}
.pp+.pp{margin-top:8px}
.pp header{display:flex;flex-direction:column;margin-bottom:4px}
/* Baris label-isi bergaris, label sempit di kiri. */
.kv{margin:0;font-size:13.5px}
.kv>div{display:grid;grid-template-columns:120px 1fr;gap:12px;padding:6px 0;border-bottom:1px solid var(--rule-2)}
.kv dt{font:600 12.5px var(--f-display);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.kv dd{margin:0;max-width:80ch}
.kv>div.hot{background:var(--strong-bg);padding-left:8px;padding-right:8px}
.net{list-style:none;padding:0;margin:0}
.net li{margin:2px 0 4px}
@media (max-width:760px){.kv>div{grid-template-columns:1fr;gap:2px}}
.more summary{cursor:pointer;font-weight:600;min-height:28px}
.kpi{margin:0 0 4px}
.note{padding:8px 12px;background:var(--warn-bg);color:var(--warn)}
.catat{background:var(--sheet-2);padding:8px 12px}
</style>
