<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { store, itemOf } from '../../store.js'
import { taVerdict, rpx } from '../../lib/ta.js'
import { fmt, fmtDate, rp, big, pctTxt } from '../../lib/domain.js'
import { useOhlc } from './ta/useOhlc.js'
import TaChart from './ta/TaChart.vue'
import PolaPanel from './ta/PolaPanel.vue'
import ProCon from './ta/ProCon.vue'
import { analyzePatterns, levels, taProsCons } from '../../lib/patterns.js'

const props = defineProps({ ticker: String })
const { loading, error, bars, ind, sig: s } = useOhlc(() => props.ticker)
const range = ref(120)
const sel = ref(null)

// Struktur harga dihitung sekali per data; Fibonacci & volume profile mengikuti rentang chart.
const adv = computed(() => {
  if (!bars.value) return null
  try { return analyzePatterns(bars.value, ind.value) } catch (e) { console.error('analyzePatterns', e); return null }
})
const lv = computed(() => bars.value && levels(bars.value, range.value))
watch(() => props.ticker, () => { sel.value = null })

// Lapisan chart yang bisa dinyalakan/dimatikan (kunci localStorage sama dengan versi lama).
const LAYERS_KEY = 'radar-cangkang.taLayers'
const LAYERS = [['pola', 'Pola chart'], ['candle', 'Candlestick'], ['div', 'Divergensi'], ['fib', 'Fibonacci'], ['vp', 'Volume profile'], ['zona', 'Zona volume']]
let savedLy = {}
try { savedLy = JSON.parse(localStorage.getItem(LAYERS_KEY) || '{}') } catch {}
const layers = reactive({ pola: true, candle: true, div: true, fib: false, vp: true, zona: true, ...savedLy })
watch(layers, v => { try { localStorage.setItem(LAYERS_KEY, JSON.stringify(v)) } catch {} })
// Menyorot satu pola otomatis menyalakan lapisan pola.
const chartRef = ref()
function pick(id) {
  sel.value = id
  if (!id) return
  layers.pola = true
  chartRef.value?.$el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
const pc = computed(() => taProsCons(bars.value, ind.value, s.value, pa.value, adv.value))

const last = computed(() => bars.value[bars.value.length - 1])
const prev = computed(() => bars.value[bars.value.length - 2])
const pa = computed(() => store.pandangan[props.ticker] || null)
const frozen = computed(() => s.value.hi20 === s.value.lo20 || bars.value.slice(-10).every(x => !x.v))
const noVol = computed(() => bars.value.slice(-10).every(x => !x.v))
const conflict = computed(() => pa.value && ((s.value.score >= 2 && /hindari|spekulatif/i.test(pa.value.sikap)) || (s.value.score <= -2 && /asimetri/i.test(pa.value.sikap))))
const tone = k => k === 'good' ? 'c-good' : k === 'bad' ? 'c-strong' : 'c-warn'

// Garis harga horizontal: PTW (biaya masuk pengendali) dan rentang nilai wajar analis.
const lines = computed(() => {
  const out = [], tp = itemOf(props.ticker)?.tender?.price, nw = pa.value?.nilaiWajar
  if (tp) out.push({ price: tp, title: 'PTW', tone: 'ink' })
  if (nw?.bawah != null) out.push({ price: nw.bawah, title: 'Wajar bawah', tone: 'good' })
  if (nw?.atas != null && nw.atas !== nw.bawah) out.push({ price: nw.atas, title: 'Wajar atas', tone: 'good' })
  return out
})
const RANGES = computed(() => [[60, '3B', '3 bulan'], [120, '6B', '6 bulan'], [bars.value.length, '1T', '1 tahun']])
const GAUGE = ['Jual kuat', 'Jual', 'Netral', 'Beli', 'Beli kuat']
</script>

<template>
  <p v-if="loading" class="load muted">Menghitung analisa teknikal {{ ticker }} dari candle harian Stockbit…</p>
  <div v-else-if="error" class="err"><strong>Teknikal {{ ticker }} gagal dimuat</strong><span>{{ error }}.</span></div>
  <div v-else class="tt">
    <p class="head">
      <span class="muted">Candle harian · data hingga {{ fmtDate(last.d) }}</span>
      <span>Penutupan <b class="cond">{{ rp(last.c) }}</b> <span class="muted">{{ pctTxt(last.c, prev?.c) }}</span>
        · O {{ rp(last.o) }} H {{ rp(last.h) }} L {{ rp(last.l) }} · volume {{ fmt(last.v, 0) }} lot</span>
    </p>
    <p v-if="frozen" class="warn"><b>Perhatian:</b> harga tidak bergerak{{ noVol ? ' dan tanpa volume' : '' }} dalam beberapa pekan terakhir (kemungkinan suspensi atau harga lantai). Indikator teknikal di bawah tidak bermakna untuk saham ini.</p>

    <div class="bar">
      <div role="group" aria-label="Rentang chart" class="rng">
        <button v-for="[n, l, full] in RANGES" :key="l" type="button" class="pill" :aria-pressed="range === n" :aria-label="full" @click="range = n">{{ l }}</button>
      </div>
      <span class="leg small muted">
        <span><i class="sw a"></i>Bollinger 20,2</span><span><i class="sw c"></i>MA50</span>
        <span><i class="dot"></i>Parabolic SAR</span><span v-if="lines.length"><i class="sw k"></i>PTW / nilai wajar</span>
      </span>
    </div>
    <div v-if="adv" class="layers" role="group" aria-label="Lapisan analisa di chart">
      <span class="small muted">Tampilkan di chart</span>
      <button v-for="[k, l] in LAYERS" :key="k" type="button" class="pill" :aria-pressed="!!layers[k]" @click="layers[k] = !layers[k]">{{ l }}</button>
      <button v-if="sel" type="button" class="pill" @click="sel = null">Tampilkan semua pola</button>
    </div>
    <TaChart ref="chartRef" :bars="bars" :ind="ind" :lines="lines" :range="range" :adv="adv" :lv="lv" :layers="layers" :sel="sel" />
    <p v-if="!adv" class="small muted">Analisa pola chart tidak tersedia untuk saham ini.</p>

    <div class="grid">
      <section class="rule-top">
        <h2>Sinyal teknikal</h2>
        <p class="score">
          <b class="cond" :class="tone(s.sig[1])">{{ s.score > 0 ? '+' : '' }}{{ s.score }}</b><span class="muted cond">/±6</span>
          <strong :class="tone(s.sig[1])">{{ s.sig[0] }}</strong>
        </p>
        <div class="gauge" aria-hidden="true">
          <i :style="{ left: ((s.score + 6) / 12 * 100) + '%' }"></i>
          <span v-for="g in GAUGE" :key="g">{{ g }}</span>
        </div>
        <p class="verdict"><b>{{ s.sig[0] }}</b> — {{ taVerdict(s) }}</p>
        <table class="ledger">
          <thead><tr><th class="lbl">Indikator</th><th class="lbl r">Suara</th></tr></thead>
          <tbody>
            <tr v-for="v in s.votes" :key="v.k">
              <td><b>{{ v.k }}</b><div class="small muted">{{ v.txt }}</div></td>
              <td class="r"><span class="tag" :class="v.s > 0 ? 't-good' : v.s < 0 ? 't-strong' : 't-calm'">{{ v.s > 0 ? '+1 Beli' : v.s < 0 ? '−1 Jual' : '0 Netral' }}</span></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="rule-top">
        <h2>Level kunci</h2>
        <table class="ledger">
          <tbody>
            <tr><td>Resistance terdekat<div class="small muted">pita atas / SAR / tertinggi 20 hari</div></td><td class="r num">{{ rpx(s.res) }}</td><td class="r muted">{{ pctTxt(s.res, last.c) }}</td></tr>
            <tr><td>Support terdekat<div class="small muted">pita bawah / SAR / terendah 20 hari</div></td><td class="r num">{{ rpx(s.sup) }}</td><td class="r muted">{{ pctTxt(s.sup, last.c) }}</td></tr>
            <tr><td>Level invalidasi<div class="small muted">{{ s.stop === s.lo20 ? 'terendah 20 hari' : 'Parabolic SAR' }} — sinyal batal bila ditutup di bawahnya</div></td><td class="r num">{{ rpx(s.stop) }}</td><td class="r muted">{{ pctTxt(s.stop, last.c) }}</td></tr>
          </tbody>
        </table>
        <p v-if="s.rr != null" class="small muted">Rasio imbal-risiko ke resistance {{ s.rr.toFixed(1).replace('.', ',') }} : 1{{ s.rr < 1.5 ? ' — kurang menarik secara teknikal.' : '.' }}</p>
        <p v-if="s.valDay < 5e8" class="warn">Likuiditas tipis (transaksi harian rata-rata {{ big(s.valDay) }}): indikator teknikal mudah terdistorsi oleh satu-dua transaksi besar.</p>
        <p v-else class="small muted">Transaksi harian rata-rata {{ big(s.valDay) }}.</p>
        <p v-if="pa" :class="conflict ? 'warn' : 'small muted'"><b>Dibanding pandangan analis ({{ pa.sikap }}):</b>
          {{ conflict ? 'sinyal teknikal bertentangan dengan pandangan fundamental — perlakukan sebagai momentum jangka pendek, bukan perubahan tesis.' : 'sinyal teknikal sejalan atau tidak bertentangan dengan pandangan fundamental.' }}</p>
      </section>
    </div>
    <PolaPanel v-if="adv && lv" :bars="bars" :adv="adv" :lv="lv" :sel="sel" @sel="pick" />
    <ProCon :pros="pc[0]" :cons="pc[1]" title="Kelebihan vs kekurangan setup teknikal" />
    <p class="disc small muted">Sinyal dihitung otomatis dari 6 indikator (tren MA, Parabolic SAR, RSI, MACD, Bollinger, volume) atas candle harian Stockbit. Bersifat umum, bukan saran investasi personal; bukan dari penasihat berlisensi.</p>
  </div>
</template>

<style scoped>
.load{padding:18px 0}
.err{display:flex;flex-direction:column;gap:4px;padding:14px 0;border-top:2px solid var(--strong)}
.err strong{color:var(--strong)}
.tt{display:flex;flex-direction:column;gap:14px}
.head{display:flex;flex-direction:column;gap:2px;margin:0}
.head b{font-size:20px}
.warn{margin:0;padding:8px 12px;background:var(--warn-bg);color:var(--warn);border-left:3px solid var(--warn)}
.bar{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px}
.rng{display:flex;gap:6px}
.layers{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.layers .small{margin-right:4px}
.leg{display:flex;flex-wrap:wrap;gap:12px}
.leg span{display:inline-flex;align-items:center;gap:5px}
.sw{display:inline-block;width:16px;height:2px}
.sw.a{background:var(--viz-a)} .sw.c{background:var(--viz-c)}
.sw.k{border-top:2px dashed var(--ink);height:0}
.dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--good);box-shadow:7px 0 0 var(--strong);margin-right:7px}
.grid{display:grid;grid-template-columns:1.2fr 1fr;gap:24px}
section h2{margin-bottom:8px}
.score{display:flex;align-items:baseline;gap:6px;margin:0 0 10px}
.score b{font-size:40px;line-height:1;font-weight:700}
.score strong{font:700 20px var(--f-display);margin-left:10px}
.c-good{color:var(--good)} .c-warn{color:var(--warn)} .c-strong{color:var(--strong)}
.gauge{position:relative;display:grid;grid-template-columns:repeat(5,1fr);border-top:6px solid var(--rule-2);padding-top:6px;margin:0 0 12px;font-size:11.5px;color:var(--ink-2)}
.gauge span{text-align:center}
.gauge i{position:absolute;top:-10px;width:3px;height:14px;background:var(--ink);transform:translateX(-50%)}
.verdict{margin:0 0 12px}
.r{text-align:right}
.num{font:700 16px var(--f-display);white-space:nowrap}
.ledger td.muted{white-space:nowrap}
.disc{margin:0}
@media (max-width:760px){.grid{grid-template-columns:1fr}}
</style>
