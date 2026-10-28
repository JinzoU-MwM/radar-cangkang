<script setup>
// Recovery: saham yang sudah turun >= 30% dari puncak 52 minggu dan masih dekat dasar kejatuhannya, diberi skor
// dukungan Seasonality (bulan terpilih) dan Pola Broker (akumulasi net bandar) dari /api/recovery.
// Skor 0-100 = kedalaman turun 30 + Seasonality 25 + akumulasi broker 25 + konfirmasi teknikal 20.
import { computed, reactive, ref, watch } from 'vue'
import { api } from '../api.js'
import { fmt } from '../lib/domain.js'
import { HSC_OPSI, isHsc, lolosHsc, hscInfo } from '../lib/hsc.js'
import RingPct from './RingPct.vue'

const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const bulan = ref((new Date().getMonth() + 1) % 12 + 1)
const data = ref(null), err = ref(''), loading = ref(false)
async function load() {
  loading.value = true; err.value = ''
  try {
    const r = await api.get('/api/recovery', { bulan: bulan.value })
    if (r.error) { err.value = r.error; data.value = null } else data.value = r
  } catch (e) { err.value = e.message || String(e) } finally { loading.value = false }
}
watch(bulan, load, { immediate: true })

const f = reactive({ hsc: '', status: '', musim: false, broker: false })
const STATUS = ['Siap rebound', 'Mulai pulih', 'Pantau']
const rows = computed(() => (data.value?.saham || []).filter(x =>
  lolosHsc(x.t, f.hsc) && (!f.status || x.status === f.status) &&
  (!f.musim || (x.season?.prob ?? 0) >= 60) && (!f.broker || (x.broker && !x.broker.dist && x.broker.net > 0))))
const unggulan = computed(() => rows.value.filter(x => x.status !== 'Pantau').slice(0, 4))
const hitung = computed(() => Object.fromEntries(STATUS.map(s => [s, (data.value?.saham || []).filter(x => lolosHsc(x.t, f.hsc) && x.status === s).length])))

const buka = ref('')
const rp = v => v == null ? '–' : 'Rp' + Math.round(v).toLocaleString('id-ID')
const pct = v => v == null ? '–' : (v > 0 ? '+' : '') + fmt(v, 1) + '%'
const miliar = v => v == null ? '–' : (v >= 0 ? '+' : '−') + 'Rp' + fmt(Math.abs(v) / 1e9, 1) + ' M'
const cls = s => s === 'Siap rebound' ? 'c-good' : s === 'Mulai pulih' ? 'c-warn' : 'muted'
</script>

<template>
  <section class="rc">
    <p class="small muted intro">Saham yang sudah <b>turun ≥ {{ data?.minTurun ?? 30 }}%</b> dari puncak 52 minggu dan masih dekat dasar kejatuhannya
      (≤ {{ data?.maxDariDasar ?? 40 }}% di atas dasar), diurutkan menurut dukungan <b>Seasonality</b> bulan terpilih, <b>akumulasi broker</b>, dan
      konfirmasi teknikal. Diperbarui otomatis Senin–Sabtu pukul 00.01 WIB.</p>

    <div class="ctl">
      <div class="bln" role="group" aria-label="Bulan Seasonality">
        <button v-for="(b, i) in BLN" :key="b" type="button" class="pill sm" :aria-pressed="String(bulan === i + 1)" @click="bulan = i + 1">{{ b }}</button>
      </div>
      <div class="flt" role="group" aria-label="Saringan">
        <button v-for="s in STATUS" :key="s" type="button" class="pill sm" :aria-pressed="String(f.status === s)" @click="f.status = f.status === s ? '' : s">{{ s }} <span class="muted">{{ hitung[s] }}</span></button>
        <button type="button" class="pill sm" :aria-pressed="String(f.musim)" @click="f.musim = !f.musim">Seasonality ≥ 60%</button>
        <button type="button" class="pill sm" :aria-pressed="String(f.broker)" @click="f.broker = !f.broker">Broker akumulasi</button>
        <span class="hscg" role="group" aria-label="Saham HSC" :title="hscInfo()">
          <span class="small muted">HSC:</span>
          <button v-for="[v, l] in HSC_OPSI" :key="v" type="button" class="pill sm" :aria-pressed="String(f.hsc === v)" @click="f.hsc = v">{{ l }}</button>
        </span>
      </div>
    </div>

    <p v-if="loading" class="muted">Memuat data Recovery…</p>
    <p v-else-if="err" class="muted">{{ err }}</p>
    <template v-else-if="data">
      <!-- Kandidat terkuat: didukung minimal dua dari Seasonality, akumulasi broker, dan teknikal. -->
      <div v-if="unggulan.length" class="cards">
        <article v-for="x in unggulan" :key="x.t" class="card">
          <div class="ch">
            <RingPct :v="x.skor" :size="52" label="Skor recovery" />
            <div><RouterLink :to="{ path: '/emiten/' + x.t, query: { tab: 'analisa' } }"><b class="kode">{{ x.t }}</b></RouterLink>
              <span v-if="isHsc(x.t)" class="tag t-warn">HSC</span>
              <div class="small" :class="cls(x.status)">{{ x.status }}</div></div>
          </div>
          <p class="small">Turun <b>{{ fmt(x.tek.turun, 0) }}%</b> · {{ rp(x.tek.harga) }} · dari dasar {{ pct(x.tek.dariDasar) }}</p>
          <p class="small muted">{{ x.dukung.join(' · ') }}</p>
          <p class="small">Beli {{ rp(x.plan.entry[0]) }}–{{ rp(x.plan.entry[1]) }} · TP {{ rp(x.plan.tp1) }} / {{ rp(x.plan.tp2) }} · SL {{ rp(x.plan.sl) }}</p>
        </article>
      </div>

      <div class="mh"><h2>Kandidat rebound</h2><span class="small muted">{{ rows.length }} dari {{ data.saham.length }} saham turun dalam ({{ data.total }} dipindai) · data {{ data.updated }}<template v-if="data.bulanBroker"> · broker {{ BLN[data.bulanBroker - 1] }}</template></span></div>
      <div class="scroll">
        <table class="ledger">
          <thead><tr>
            <th>Saham</th><th>Status</th><th class="num">Turun</th><th class="num">Dari dasar</th><th class="num">RSI</th>
            <th class="num">Seasonality {{ BLN[bulan - 1] }}</th><th class="num">Net bandar</th><th class="num">Avg broker</th><th class="num">R/R</th><th class="num">Skor</th>
          </tr></thead>
          <tbody>
            <template v-for="x in rows" :key="x.t">
              <tr class="row" :class="{ open: buka === x.t }" tabindex="0" @click="buka = buka === x.t ? '' : x.t" @keydown.enter="buka = buka === x.t ? '' : x.t">
                <td><span class="car">{{ buka === x.t ? '▾' : '▸' }}</span> <b>{{ x.t }}</b>
                  <span v-if="isHsc(x.t)" class="tag t-warn" title="Saham HSC: dikeluarkan dari perhitungan IHSG">HSC</span>
                  <span v-if="x.radar" class="tag t-calm">{{ x.radar }}</span></td>
                <td class="small" :class="cls(x.status)">{{ x.status }}</td>
                <td class="num c-strong">−{{ fmt(x.tek.turun, 0) }}%</td>
                <td class="num">{{ pct(x.tek.dariDasar) }}</td>
                <td class="num" :class="{ 'c-good': x.tek.rsi != null && x.tek.rsi < 35 }">{{ x.tek.rsi ?? '–' }}</td>
                <td class="num" :class="{ 'c-good': (x.season?.prob ?? 0) >= 60 }">{{ x.season ? `${x.season.prob}% (${x.season.up}/${x.season.n})` : '–' }}</td>
                <td class="num" :class="x.broker ? (x.broker.net > 0 ? 'c-good' : 'c-strong') : ''">{{ x.broker ? miliar(x.broker.net) : '–' }}</td>
                <td class="num">{{ x.broker?.avg ? rp(x.broker.avg) : '–' }}</td>
                <td class="num">{{ x.plan.rr ?? '–' }}</td>
                <td class="num"><b>{{ x.skor }}</b></td>
              </tr>
              <tr v-if="buka === x.t" class="det">
                <td colspan="10">
                  <div class="dg">
                    <div>
                      <h4>Alasan</h4>
                      <ul class="small"><li v-for="a in x.alasan" :key="a">{{ a }}</li></ul>
                      <p class="small muted">Komponen skor: turun {{ x.komponen.turun }}/30 · Seasonality {{ x.komponen.seasonality }}/25 · broker {{ x.komponen.broker }}/25 · teknikal {{ x.komponen.teknikal }}/20</p>
                    </div>
                    <div>
                      <h4>Trading plan rebound</h4>
                      <dl class="small pl">
                        <dt>Area beli</dt><dd>{{ rp(x.plan.entry[0]) }}–{{ rp(x.plan.entry[1]) }}</dd>
                        <dt>Ambil untung</dt><dd class="c-good">{{ rp(x.plan.tp1) }} lalu {{ rp(x.plan.tp2) }}</dd>
                        <dt>Batas rugi</dt><dd class="c-strong">{{ rp(x.plan.sl) }} (tutup harian di bawahnya)</dd>
                        <dt>Puncak / dasar</dt><dd>{{ rp(x.tek.tinggi52) }} / {{ rp(x.tek.rendah52) }}</dd>
                        <dt>EMA20 / EMA50</dt><dd>{{ rp(x.tek.ema20) }} / {{ rp(x.tek.ema50) }}</dd>
                      </dl>
                      <p class="small"><RouterLink :to="{ path: '/emiten/' + x.t, query: { tab: 'analisa' } }">Buka analisa {{ x.t }} ›</RouterLink></p>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <p class="small muted">Target = retracement 38,2% dan 50% dari kejatuhan (dibatasi +25% / +60% dari harga; target pertama memakai avg broker
        akumulasi bila lebih dekat). Batas rugi di bawah dasar kejatuhan. Status: <b>Siap rebound</b> = Seasonality ≥ 60%, broker akumulasi, dan
        teknikal pulih (di atas EMA20 + higher low/pantulan ≥ 8%); <b>Mulai pulih</b> = dua dari tiga. Saham turun dalam bisa terus turun —
        bukan rekomendasi beli/jual.</p>
    </template>
  </section>
</template>

<style scoped>
.intro{max-width:120ch;margin:6px 0 10px}
.ctl{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
.bln,.flt{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.hscg{display:inline-flex;align-items:center;gap:4px;margin-left:8px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin-bottom:14px}
.card{border:1px solid var(--rule);background:var(--sheet);padding:10px 12px}.card p{margin:4px 0}
.ch{display:flex;gap:10px;align-items:center}.kode{font-size:18px}
.mh{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.mh h2{margin:6px 0}
.scroll{overflow-x:auto}
.row{cursor:pointer}.row:hover,.row.open{background:var(--accent-soft)}
.car{color:var(--muted)}.tag{margin-left:6px}
.det td{background:var(--sheet)}.dg{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.dg h4{margin:4px 0}.dg ul{margin:0;padding-left:18px}
.pl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:0}.pl dt{color:var(--muted)}.pl dd{margin:0;font-weight:600}
.c-warn{color:var(--warn,#c79a1a)}
</style>
