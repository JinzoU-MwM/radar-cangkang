<script setup>
// Tab intel pasar: snapshot data tradersaham.com (teknikal+broker, skor gems,
// arus asing, net broker besar) untuk satu emiten. Sumber: /api/tsa/summary.
import { computed, ref, watch } from 'vue'
import { api } from '../../api.js'
import { big, fmt } from '../../lib/domain.js'

const props = defineProps({ ticker: String })

const data = ref(null)
const err = ref('')
const loading = ref(false)

async function load(t) {
  data.value = null
  err.value = ''
  if (!/^[A-Z]{4}$/.test(t)) return
  loading.value = true
  try { data.value = await api.get('/api/tsa/summary', { ticker: t }) }
  catch (e) { err.value = e.message || 'gagal memuat' }
  finally { loading.value = false }
}
watch(() => props.ticker, t => load(t?.toUpperCase()), { immediate: true })

const sig = computed(() => data.value?.signals || null)
const gems = computed(() => data.value?.gems || null)
const ff = computed(() => data.value?.foreignFlow || null)
const bs = computed(() => data.value?.brokerScanner || null)
const meta = computed(() => data.value?.meta || null)

const takAda = computed(() => data.value && !data.value.ada)

// Regime (arah akumulasi/distribusi broker dominan) diterjemahkan jadi label + kelas warna.
const REGIME = {
  ACCUMULATION: ['akumulasi', 'c-good'], ACCUM: ['akumulasi', 'c-good'],
  MILD_ACCUMULATION: ['akumulasi ringan', 'c-good'],
  FLIP_BUY: ['berbalik beli', 'c-good'],
  DISTRIBUTION: ['distribusi', 'c-strong'], DIST: ['distribusi', 'c-strong'],
  MILD_DISTRIBUTION: ['distribusi ringan', 'c-strong'],
  FLIP_SELL: ['berbalik jual', 'c-strong'],
  NEUTRAL: ['netral', 'c-warn'],
}
function regimeW(v) { return REGIME[v] || [v || '–', 'c-warn'] }
const rpFmt = v => v == null ? '–' : big(Math.abs(v)) + (v >= 0 ? '' : ' (keluar)')
</script>

<template>
  <div class="intel">
    <p v-if="loading" class="muted none">memuat data intel pasar…</p>
    <p v-else-if="err" class="warn none">{{ err }}</p>
    <p v-else-if="takAda" class="muted none">belum ada data tradersaham untuk {{ ticker }}.</p>

    <template v-else>
      <div v-if="meta" class="muted small src">Sumber: tradersaham.com · data tanggal {{ meta.tanggal_data }} · snapshot {{ meta.tarik }}</div>

      <!-- Teknikal + broker (signals-v2) -->
      <section v-if="sig" class="ledger">
        <h3>Teknikal &amp; Broker</h3>
        <div class="row"><span>Harga / perubahan</span><b>{{ fmt(sig.close) }} <span :class="sig.chg >= 0 ? 'c-good' : 'c-strong'">{{ sig.chg == null ? '' : (sig.chg >= 0 ? '+' : '') + fmt(sig.chg, 2) + '%' }}</span></b></div>
        <div class="row"><span>RSI(14)</span><b :class="sig.rsi14 >= 70 ? 'c-strong' : sig.rsi14 <= 30 ? 'c-good' : ''">{{ fmt(sig.rsi14, 1) }}</b></div>
        <div class="row"><span>Tren EMA</span><b>{{ sig.emaTrend || '–' }}</b></div>
        <div class="row"><span>Regime broker</span><b :class="regimeW(sig.regime)[1]">{{ regimeW(sig.regime)[0] }}<template v-if="sig.regimeConf != null"> ({{ fmt(sig.regimeConf, 0) }}%)</template></b></div>
        <div class="row"><span>Skor akumulasi bersih</span><b>{{ fmt(sig.netAccum, 0) }}</b></div>
        <div class="row" v-if="sig.domBroker"><span>Broker dominan</span><b>{{ sig.domBroker }} <span class="muted" v-if="sig.domShare != null">({{ fmt(sig.domShare, 1) }}%)</span></b></div>
        <div class="row" v-if="sig.assocBroker"><span>Broker afiliasi</span><b>{{ sig.assocBroker }} <span class="muted">{{ sig.assocRegime || '' }}</span></b></div>
        <div class="row"><span>Spike volume / nilai</span><b>{{ sig.volSpike == null ? '–' : fmt(sig.volSpike, 1) + '×' }} / {{ sig.valSpike == null ? '–' : fmt(sig.valSpike, 1) + '×' }}</b></div>
        <div class="row"><span>Likuaditas</span><b>{{ sig.liqTier || '–' }}</b><template v-if="sig.negoVal != null"><span class="lbl-inline">negosiasi</span> <b>{{ big(sig.negoVal) }}</b></template></div>
      </section>

      <!-- Skor gems -->
      <section v-if="gems" class="ledger">
        <h3>Skor Gems</h3>
        <div class="row"><span>Skor komposit</span><b class="c-good">{{ fmt(gems.gemScore, 0) }} <span class="muted small">({{ gems.gemTier || '–' }})</span></b></div>
        <div class="row" v-if="gems.accum7d != null"><span>Rata-rata akumulasi 7 hari</span><b>{{ fmt(gems.accum7d, 1) }}</b></div>
        <div class="row" v-if="gems.regimeStreak != null"><span>Regime bertahan</span><b>{{ fmt(gems.regimeStreak, 0) }} hari</b></div>
        <div class="row" v-if="gems.priceVs20dHigh != null"><span>Jarak dari puncak 20 hari</span><b>{{ fmt(gems.priceVs20dHigh, 1) }}%</b></div>
        <p v-if="gems.evidence" class="small muted">{{ gems.evidence }}</p>
        <ul v-if="gems.breakdown && gems.breakdown.length" class="small muted">
          <li v-for="(b, i) in gems.breakdown" :key="i">{{ b }}</li>
        </ul>
      </section>

      <!-- Arus asing (list) -->
      <section v-if="ff" class="ledger">
        <h3>Arus Asing ({{ ff.days }} hari)</h3>
        <div class="row"><span>Skor arus</span><b>{{ fmt(ff.score, 0) }}</b></div>
        <div class="row"><span>Nilai bersih</span><b :class="ff.net_value >= 0 ? 'c-good' : 'c-strong'">{{ rpFmt(ff.net_value) }}</b></div>
        <div class="row"><span>Intensitas / akselerasi</span><b>{{ fmt(ff.flow_intensity, 1) }} / {{ fmt(ff.accel, 1) }}</b></div>
        <div class="row" v-if="ff.float_absorbed != null"><span>Float terserap</span><b>{{ fmt(ff.float_absorbed, 2) }}%</b></div>
        <div class="row" v-if="ff.streak != null"><span>Berturut-turut</span><b>{{ fmt(ff.streak, 0) }} hari</b></div>
        <div class="row" v-if="ff.ksei_status"><span>KSEI</span><b>{{ ff.ksei_status }} <span class="muted">{{ ff.ksei_date || '' }}</span></b></div>
      </section>

      <!-- Broker besar (scanner) -->
      <section v-if="bs" class="ledger">
        <h3>Broker Besar (harian)</h3>
        <div class="row"><span>Smart money (net)</span><b :class="(bs.smartMoneyNet || 0) >= 0 ? 'c-good' : 'c-strong'">{{ rpFmt(bs.smartMoneyNet) }}</b></div>
        <div class="row" v-if="bs.bandarNet != null"><span>Bandar (net)</span><b :class="(bs.bandarNet || 0) >= 0 ? 'c-good' : 'c-strong'">{{ rpFmt(bs.bandarNet) }}</b></div>
        <div class="row" v-if="bs.whaleNet != null"><span>Whale (net)</span><b :class="(bs.whaleNet || 0) >= 0 ? 'c-good' : 'c-strong'">{{ rpFmt(bs.whaleNet) }}</b></div>
        <div class="row" v-if="bs.retailNet != null"><span>Retail (net)</span><b :class="(bs.retailNet || 0) >= 0 ? 'c-good' : 'c-strong'">{{ rpFmt(bs.retailNet) }}</b></div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.ledger { margin-bottom: 1rem; }
.row { display: flex; gap: .75rem; padding: .2rem 0; align-items: baseline; flex-wrap: wrap; }
.row > span:first-child { min-width: 12rem; color: var(--ink-muted, #888); }
.src { margin-bottom: .75rem; }
.lbl-inline { color: var(--ink-muted, #888); margin-left: .75rem; }
</style>
