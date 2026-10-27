<script setup>
// Pola Broker: akumulasi/distribusi per broker per bulan (tahun berjalan) dari /api/broker-pola.
// Dua tampilan: per saham (agregat semua broker pada bulan terpilih) dan per broker (bulan demi bulan).
import { computed, ref, watch } from 'vue'
import { api } from '../api.js'
import { big, fmt } from '../lib/domain.js'
import { h } from 'vue'

const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const bulan = ref(new Date().getMonth() + 1)
const jenis = ref('')            // '' | 'asing' | 'domestik'
const mode = ref('saham')        // 'saham' | 'broker'
const broker = ref('')
const data = ref(null), err = ref(''), loading = ref(false)
async function load() {
  loading.value = true; err.value = ''
  try {
    const r = await api.get('/api/broker-pola', { bulan: bulan.value, jenis: jenis.value, broker: mode.value === 'broker' ? broker.value : '' })
    if (r.error) { err.value = r.error; data.value = null } else {
      data.value = r
      if (!broker.value && r.brokers?.length) broker.value = r.brokers[0].kode
    }
  } catch (e) { err.value = e.message || String(e) } finally { loading.value = false }
}
watch([bulan, jenis, mode, broker], load, { immediate: true })

const rp = v => v == null ? '–' : (v < 0 ? '−' : '') + 'Rp' + big(Math.abs(v)).replace(/^Rp/, '')
const lot = v => v == null ? '–' : (v < 0 ? '−' : '') + fmt(Math.abs(v), 0)
const avg = v => v == null ? '–' : 'Rp' + fmt(v, v < 200 ? 1 : 0)
const brokerList = computed(() => (data.value?.brokers || []).filter(b => !jenis.value || (jenis.value === 'asing') === (b.jenis === 'Asing')))
const B = computed(() => data.value?.broker || null)
const bulanB = computed(() => B.value ? Object.entries(B.value.bulan).map(([m, x]) => ({ m: +m, ...x })).sort((a, b) => b.m - a.m) : [])
// Tanda potensi repo: kuat (keterbukaan bertujuan repo/gadai) atau crossing nego broker yang sama; alasan di tooltip & teks.
const RepoTag = props => props.r
  ? h('span', { title: props.r.alasan.join(' · ') }, [h('span', { class: 'tag ' + (props.r.kuat ? 't-strong' : 't-warn') }, props.r.kuat ? 'Potensi repo (keterbukaan)' : 'Potensi repo (crossing nego)'), h('div', { class: 'muted' }, props.r.alasan[0])])
  : h('span', { class: 'muted' }, 'Bukan')
RepoTag.props = ['r']
const tag = j => j === 'Asing' ? 't-calm' : j === 'Pemerintah' ? 't-warn' : 't-good'
</script>

<template>
  <div class="bp">
    <p class="muted small">Akumulasi (net beli) dan distribusi (net jual) tiap broker per bulan tahun {{ data?.tahun || new Date().getFullYear() }}: saham, net lot, net nominal, dan harga rata-rata beli/jual. Sumber: broker activity Stockbit, pasar reguler. Diperbarui otomatis Senin–Sabtu pukul 00.01 WIB.</p>
    <div class="ctl">
      <div role="group" aria-label="Tampilan">
        <button type="button" class="pill sm" :aria-pressed="String(mode === 'saham')" @click="mode = 'saham'">Per saham</button>
        <button type="button" class="pill sm" :aria-pressed="String(mode === 'broker')" @click="mode = 'broker'">Per broker</button>
      </div>
      <div role="group" aria-label="Jenis broker">
        <button type="button" class="pill sm" :aria-pressed="String(jenis === '')" @click="jenis = ''">Semua</button>
        <button type="button" class="pill sm" :aria-pressed="String(jenis === 'asing')" @click="jenis = 'asing'">Asing</button>
        <button type="button" class="pill sm" :aria-pressed="String(jenis === 'domestik')" @click="jenis = 'domestik'">Domestik</button>
      </div>
    </div>
    <div v-if="mode === 'saham'" class="bln" role="group" aria-label="Bulan">
      <button v-for="(b, i) in BLN" :key="b" type="button" class="pill sm" :disabled="data && !data.bulanAda?.includes(i + 1)" :aria-pressed="String(bulan === i + 1)" @click="bulan = i + 1">{{ b }}</button>
    </div>
    <label v-else class="small">Broker
      <select v-model="broker" class="field">
        <option v-for="b in brokerList" :key="b.kode" :value="b.kode">{{ b.kode }} · {{ b.nama }} ({{ b.jenis }})</option>
      </select>
    </label>

    <p v-if="loading" class="muted">Memuat pola broker…</p>
    <p v-else-if="err" class="muted">{{ err }}</p>
    <template v-else-if="data">
      <!-- Per saham: agregat semua broker (sesuai filter) pada bulan terpilih. -->
      <template v-if="mode === 'saham' && data.saham">
        <div class="two">
          <section v-for="side in [['akumulasi', 'Paling diakumulasi', 'c-good'], ['distribusi', 'Paling didistribusi', 'c-strong']]" :key="side[0]">
            <h3 :class="side[2]">{{ side[1] }} · {{ BLN[bulan - 1] }} {{ data.tahun }}</h3>
            <div class="scroll">
              <table class="ledger">
                <thead><tr><th>Saham</th><th class="num">Net nominal</th><th class="num">Net lot</th><th class="num">Asing</th><th class="num">Domestik</th><th>Broker utama (avg)</th><th>Potensi repo</th></tr></thead>
                <tbody>
                  <tr v-for="x in data.saham[side[0]].slice(0, 25)" :key="x.s">
                    <td><RouterLink :to="{ path: '/emiten/' + x.s, query: { tab: 'analisa' } }"><b>{{ x.s }}</b></RouterLink></td>
                    <td class="num" :class="side[2]">{{ rp(x.net) }}</td>
                    <td class="num">{{ lot(x.lot) }}</td>
                    <td class="num small">{{ rp(x.asing) }}</td>
                    <td class="num small">{{ rp(x.domestik) }}</td>
                    <td class="small">
                      <span v-for="z in (side[0] === 'akumulasi' ? x.akum : x.dist)" :key="z.b" class="bk"><b>{{ z.b }}</b> {{ rp(z.val) }} @{{ avg(z.avg) }}</span>
                      <span class="muted">· {{ side[0] === 'akumulasi' ? x.nAkum : x.nDist }} broker</span>
                    </td>
                    <td class="small"><RepoTag :r="x.repo" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </template>

      <!-- Per broker: bulan demi bulan, akumulasi dan distribusi terbesar. -->
      <template v-else-if="mode === 'broker' && B">
        <h3>{{ B.kode }} · {{ B.nama }} <span class="tag" :class="tag(B.jenis)">{{ B.jenis }}</span></h3>
        <details v-for="(x, k) in bulanB" :key="x.m" class="mo" :open="k === 0">
          <summary><b>{{ BLN[x.m - 1] }} {{ data.tahun }}</b> <span class="muted small">s.d. {{ x.sampai }} · transaksi {{ rp(x.gross) }}</span></summary>
          <div class="two">
            <section v-for="side in [['beli', 'Akumulasi', 'c-good', 'avgB'], ['jual', 'Distribusi', 'c-strong', 'avgS']]" :key="side[0]">
              <h4 :class="side[2]">{{ side[1] }}</h4>
              <table class="ledger">
                <thead><tr><th>Saham</th><th class="num">Net lot</th><th class="num">Net nominal</th><th class="num">Avg {{ side[0] }}</th><th>Potensi repo</th></tr></thead>
                <tbody>
                  <tr v-for="r in x[side[0]].slice(0, 15)" :key="r.s">
                    <td><RouterLink :to="{ path: '/emiten/' + r.s, query: { tab: 'analisa' } }"><b>{{ r.s }}</b></RouterLink></td>
                    <td class="num">{{ lot(r.lot) }}</td>
                    <td class="num" :class="side[2]">{{ rp(r.val) }}</td>
                    <td class="num">{{ avg(r[side[3]]) }}</td>
                    <td class="small"><RepoTag :r="r.repo" /></td>
                  </tr>
                </tbody>
              </table>
            </section>
          </div>
        </details>
      </template>
      <p class="muted small">Data per {{ data.updated }}. Net = beli − jual pada pasar reguler; harga rata-rata = nilai ÷ (lot × 100). Potensi repo: keterbukaan pemegang saham bertujuan repo/gadai/jaminan di bulan itu, atau crossing di pasar negosiasi oleh broker yang sama (lot selisih ≤10%, nilai ≥ Rp1 M); bukan kepastian. Bukan rekomendasi beli/jual.</p>
    </template>
  </div>
</template>

<style scoped>
.ctl{display:flex;gap:12px;flex-wrap:wrap;justify-content:space-between;margin:6px 0}
.bln{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px}
.two{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
.two section{min-width:0}.scroll{overflow-x:auto}
.mo .two{grid-template-columns:repeat(2,minmax(0,1fr))}
.bk{display:inline-block;margin-right:8px;white-space:nowrap}
.mo{border-top:1px solid var(--rule);padding:6px 0}
.mo summary{cursor:pointer}
h4{margin:6px 0}
.field{margin-left:6px;max-width:360px}
@media (max-width:1100px){.mo .two{grid-template-columns:1fr}}
</style>
