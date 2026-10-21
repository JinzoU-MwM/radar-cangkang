<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { store } from '../../store.js'
import { buildPlan, moneyMgmt, MM_DEF, ceilTick } from '../../lib/ta.js'
import { fmt, fmtDate, rp, pctTxt } from '../../lib/domain.js'
import { useOhlc } from './ta/useOhlc.js'
import ProsCons from './ProsCons.vue'
import { analyzePatterns, bestBullPattern, polaPlan, structureChecks, verdictOf, spProsCons } from '../../lib/patterns.js'

const props = defineProps({ ticker: String })
const emit = defineEmits(['goto'])
const { loading, error, bars, ind, sig } = useOhlc(() => props.ticker)

// Parameter money management disimpan per browser (kunci sama dengan versi lama).
const MM_KEY = 'radar-cangkang.mm'
let saved = {}
try { saved = JSON.parse(localStorage.getItem(MM_KEY) || '{}') } catch {}
const mm = reactive({ ...MM_DEF, ...saved })
watch(mm, v => { try { localStorage.setItem(MM_KEY, JSON.stringify(v)) } catch {} })

const INPUTS = [
  ['modal', 'Modal trading (Rp)', 1000000, 'total dana untuk trading'],
  ['risk', 'Risiko per transaksi (%)', 0.25, 'umumnya 0,5–2% modal'],
  ['maxPos', 'Maks. porsi per saham (%)', 5, 'batas konsentrasi'],
  ['fb', 'Biaya beli (%)', 0.01, 'fee broker'],
  ['fs', 'Biaya jual (%)', 0.01, 'fee + pajak 0,1%'],
]

const pa = computed(() => store.pandangan[props.ticker] || null)
// Dasar rencana: indikator teknikal (buildPlan) atau pola bullish terbaik bila ada.
const basis = ref('indikator')
watch(() => props.ticker, () => { basis.value = 'indikator' })
const adv = computed(() => {
  if (!bars.value) return null
  try { return analyzePatterns(bars.value, ind.value) } catch (e) { console.error('analyzePatterns', e); return null }
})
const bp = computed(() => bestBullPattern(adv.value))
const pl = computed(() => {
  const base = buildPlan(bars.value, ind.value, sig.value)
  return basis.value === 'pola' && bp.value ? polaPlan(base, bp.value) : base
})
const res = computed(() => {
  const r = moneyMgmt(pl.value, mm, { valDay: sig.value.valDay, sikap: pa.value?.sikap || null })
  // Kelayakan juga memeriksa pola dan divergensi bearish.
  const checklist = [...r.checklist, ...structureChecks(adv.value)]
  return { ...r, checklist, verdict: verdictOf(pl.value, checklist) }
})
const pc = computed(() => spProsCons(pl.value, pa.value))
const stopPct = computed(() => pl.value.entry ? (pl.value.entry - pl.value.stop) / pl.value.entry : null)
const pctModal = (v, d) => (v / (+mm.modal || 1) * 100).toFixed(d).replace('.', ',') + '% modal'
const setupTone = computed(() => pl.value.entry ? (sig.value.score >= 2 || pl.value.usePola ? 'good' : 'warn') : 'strong')
const zone = p => rp(p.entryLo) + (p.entryHi !== p.entryLo ? ' – ' + rp(p.entryHi) : '')
const signed = v => (v < 0 ? '−' : '+') + rp(Math.abs(v))
</script>

<template>
  <p v-if="loading" class="load muted">Menyusun trading plan {{ ticker }} dari candle harian Stockbit…</p>
  <div v-else-if="error" class="err"><strong>Spekulasi {{ ticker }} gagal dimuat</strong><span>{{ error }}.</span></div>
  <div v-else class="sp">
    <div class="head">
      <p>
        <span class="muted">Trading plan & money management · data hingga {{ fmtDate(bars[bars.length - 1].d) }}</span><br>
        Harga <b class="cond">{{ rp(pl.c) }}</b> · ATR 14 hari {{ rp(pl.atr) }} ({{ (pl.atr / pl.c * 100).toFixed(1).replace('.', ',') }}%) · sinyal teknikal <b>{{ sig.sig[0] }}</b> ({{ sig.score > 0 ? '+' : '' }}{{ sig.score }}/±6)
      </p>
      <button class="btn" type="button" @click="emit('goto', 'teknikal')">Lihat chart teknikal</button>
    </div>
    <p v-if="pl.frozen" class="warn"><b>Tidak dapat diperdagangkan:</b> harga tidak bergerak/tanpa volume (kemungkinan suspensi atau harga lantai). Rencana di bawah hanya ilustrasi.</p>

    <div class="basis" role="group" aria-label="Dasar rencana">
      <span class="small muted">Dasar rencana</span>
      <button type="button" class="pill" :aria-pressed="!pl.usePola" @click="basis = 'indikator'">Indikator teknikal</button>
      <button v-if="bp" type="button" class="pill" :aria-pressed="!!pl.usePola" @click="basis = 'pola'">Pola {{ bp.name }} ({{ bp.conf }}%)</button>
      <span v-else class="small muted">belum ada pola bullish yang layak (siap/breakout, keyakinan ≥ 45%)</span>
    </div>

    <section class="setup" :class="'s-' + setupTone">
      <span class="lbl">Setup</span>
      <p class="type">{{ pl.type }}</p>
      <p class="small">{{ pl.note }}</p>
    </section>

    <div class="grid">
      <section class="rule-top">
        <h2>Trading plan</h2>
        <table class="ledger">
          <tbody>
            <template v-if="pl.entry">
              <tr><td><b>Zona entry</b><div class="small muted">{{ pl.usePola ? (pl.bp.status === 'breakout' ? 'retest level breakout pola, limit order' : 'aktif bila ditutup di atas level breakout pola') : sig.score >= 2 ? 'beli bertahap, limit order' : 'aktif bila ditutup di atas resistance' }}</div></td><td class="r num">{{ zone(pl) }}</td><td class="r muted">{{ pctTxt(pl.entry, pl.c) }}</td></tr>
              <tr><td><b>Harga entry acuan</b></td><td class="r num">{{ rp(pl.entry) }}</td><td></td></tr>
            </template>
            <tr><td><b>Stop loss</b><div class="small muted">{{ pl.usePola ? `di bawah level invalidasi pola ${rp(pl.bp.inv)}` : pl.entry ? (pl.sUp && pl.stop <= pl.sar ? 'di bawah Parabolic SAR' : 'di bawah support/terendah 20 hari') + ', ≥1× ATR dari entry' : 'batas keluar penuh bagi pemegang' }}</div></td><td class="r num c-strong">{{ rp(pl.stop) }}</td><td class="r muted">{{ pctTxt(pl.stop, pl.entry || pl.c) }}</td></tr>
            <template v-if="pl.entry">
              <tr><td><b>Target 1</b><div class="small muted">{{ pl.usePola ? 'maks. 1,5R dan separuh jalan ke target pola' : '1,5R' }}; jual 50%, naikkan stop ke titik impas</div></td><td class="r num c-good">{{ rp(pl.tp1) }}</td><td class="r muted">{{ pctTxt(pl.tp1, pl.entry) }}</td></tr>
              <tr><td><b>Target 2</b><div class="small muted">{{ pl.usePola ? 'target pola' : '3R' }}; sisa posisi, trailing stop Parabolic SAR</div></td><td class="r num c-good">{{ rp(pl.tp2) }}</td><td class="r muted">{{ pctTxt(pl.tp2, pl.entry) }}</td></tr>
              <tr><td><b>Risiko per saham (R)</b><div class="small muted">entry − stop</div></td><td class="r num">{{ rp(pl.R) }}</td><td class="r muted">{{ pctTxt(pl.stop, pl.entry) }}</td></tr>
              <tr><td><b>Imbal-risiko</b><div class="small muted">Target 1 / Target 2 terhadap R</div></td><td class="r num">{{ pl.usePola ? `${((pl.tp1 - pl.entry) / pl.R).toFixed(1).replace('.', ',')} : 1 · ${((pl.tp2 - pl.entry) / pl.R).toFixed(1).replace('.', ',')} : 1` : '1,5 : 1 · 3 : 1' }}</td><td></td></tr>
            </template>
            <tr v-else><td><b>Area jual saat pantulan</b><div class="small muted">resistance terdekat</div></td><td class="r num">{{ rp(sig.res) }}</td><td class="r muted">{{ pctTxt(sig.res, pl.c) }}</td></tr>
          </tbody>
        </table>
        <p v-if="pl.resBlock" class="warn">Resistance {{ rp(pl.resBlock) }} berada sebelum Target 1 — pertimbangkan ambil sebagian di sana.</p>
        <p v-if="stopPct != null && stopPct > 0.1" class="warn">Jarak stop {{ (stopPct * 100).toFixed(1).replace('.', ',') }}% dari entry — lebar; ukuran posisi otomatis mengecil.</p>
      </section>

      <section class="rule-top">
        <h2>Money management</h2>
        <div class="inputs">
          <label v-for="[k, label, step, hint] in INPUTS" :key="k" class="in">
            <span class="small">{{ label }}</span>
            <input v-model.number="mm[k]" class="field" type="number" :step="step" min="0">
            <em class="small muted">{{ hint }}</em>
          </label>
        </div>
        <p v-if="!pl.entry" class="small muted">Tidak ada posisi beli yang dihitung karena tidak ada setup beli. Pakai parameter ini saat setup muncul.</p>
        <template v-else>
          <dl class="out">
            <div><dt>Jumlah</dt><dd><b>{{ fmt(res.finalLots, 0) }} lot</b><span>{{ fmt(res.shares, 0) }} saham</span></dd></div>
            <div><dt>Nilai posisi</dt><dd><b>{{ rp(res.pos) }}</b><span>{{ pctModal(res.pos, 1) }}</span></dd></div>
            <div><dt>Rugi maks. (kena stop)</dt><dd><b class="c-strong">−{{ rp(res.maxLoss) }}</b><span>{{ pctModal(res.maxLoss, 2) }}</span></dd></div>
            <div><dt>Laba di Target 1 (50%)</dt><dd><b :class="res.pnl1 >= 0 ? 'c-good' : 'c-strong'">{{ signed(res.pnl1) }}</b></dd></div>
            <div><dt>Laba di Target 2 (50%)</dt><dd><b :class="res.pnl2 >= 0 ? 'c-good' : 'c-strong'">{{ signed(res.pnl2) }}</b></dd></div>
            <div><dt>Titik impas</dt><dd><b>{{ rp(res.breakeven) }}</b><span>setelah biaya beli+jual</span></dd></div>
          </dl>
          <p v-if="res.why.length" class="small muted">Ukuran {{ res.why.join('; ') }}.</p>
          <p v-if="res.finalLots === 0" class="warn">Modal/risiko terlalu kecil untuk 1 lot pada jarak stop ini, atau likuiditas tidak cukup.</p>
        </template>
      </section>
    </div>

    <div class="grid">
      <section class="rule-top">
        <h2>Eksekusi bertahap</h2>
        <ol v-if="pl.entry" class="steps">
          <li>Pasang <b>limit order</b> di zona {{ zone(pl).replace(' – ', '–') }}; batal bila harga lari di atas {{ rp(ceilTick((pl.entryHi || pl.entry) + 0.5 * pl.atr)) }} (jangan mengejar).</li>
          <li>Segera pasang <b>stop loss</b> (auto order) di {{ rp(pl.stop) }} — penutupan harian di bawahnya berarti keluar tanpa tawar-menawar.</li>
          <li>Di <b>Target 1</b> {{ rp(pl.tp1) }} jual 50% dan pindahkan stop ke titik impas.</li>
          <li>Sisa 50% diikat <b>trailing stop</b> Parabolic SAR menuju Target 2 {{ rp(pl.tp2) }}.</li>
          <li><b>Batas waktu</b>: bila dalam 10 hari bursa harga tidak bergerak ke Target 1, keluar — modal punya biaya peluang.</li>
        </ol>
        <ol v-else class="steps">
          <li>Tidak membuka posisi baru selama sinyal teknikal {{ sig.sig[0] }}.</li>
          <li>Bagi pemegang: kurangi posisi saat pantulan ke {{ rp(sig.res) }}.</li>
          <li>Keluar penuh bila harga ditutup di bawah {{ rp(pl.stop) }}.</li>
          <li>Tinjau ulang setup bila Parabolic SAR berbalik ke bawah harga dan MACD memotong ke atas garis sinyal.</li>
        </ol>
      </section>
      <section class="rule-top">
        <h2>Kelayakan transaksi</h2>
        <ul class="check">
          <li v-for="c in res.checklist" :key="c.text" :class="c.ok ? 'ok' : 'no'">
            <svg viewBox="0 0 12 12" aria-hidden="true"><path v-if="c.ok" d="M2 6.5 5 9.5 10 3"/><path v-else d="M3 3l6 6M9 3 3 9"/></svg>
            <span class="sr-only">{{ c.ok ? 'Lulus:' : 'Gagal:' }}</span>{{ c.text }}
          </li>
        </ul>
        <p class="verdict" :class="'v-' + res.verdict.cls">{{ res.verdict.text }}</p>
      </section>
    </div>
    <ProsCons :pros="pc[0]" :cons="pc[1]" title="Kelebihan vs kekurangan rencana transaksi" />
    <p class="small muted">Rencana dihitung otomatis dari indikator teknikal dan parameter yang Anda isi; bersifat umum, bukan saran investasi personal dan bukan dari penasihat berlisensi. Saham tipis rawan gap melewati stop loss — kerugian nyata bisa lebih besar dari perhitungan.</p>
  </div>
</template>

<style scoped>
.load{padding:18px 0}
.err{display:flex;flex-direction:column;gap:4px;padding:14px 0;border-top:2px solid var(--strong)}
.err strong{color:var(--strong)}
.sp{display:flex;flex-direction:column;gap:18px}
.head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
.head p{margin:0}
.head b.cond{font-size:20px}
.warn{margin:0;padding:8px 12px;background:var(--warn-bg);color:var(--warn);border-left:3px solid var(--warn)}
.basis{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.basis .small:first-child{margin-right:4px}
.setup{padding:10px 14px;border-left:4px solid var(--calm);background:var(--sheet)}
.setup.s-good{border-color:var(--good);background:var(--good-bg)}
.setup.s-warn{border-color:var(--warn);background:var(--warn-bg)}
.setup.s-strong{border-color:var(--strong);background:var(--strong-bg)}
.setup p{margin:2px 0 0}
.type{font:700 19px var(--f-display)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
section h2{margin-bottom:8px}
.r{text-align:right}
.num{font:700 16px var(--f-display);white-space:nowrap}
.ledger td.muted{white-space:nowrap}
.c-good{color:var(--good)} .c-strong{color:var(--strong)}
.inputs{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px 14px;margin-bottom:12px}
.in{display:flex;flex-direction:column;gap:3px}
.in input{width:100%;font:700 16px var(--f-display)}
.in em{font-style:normal}
.out{display:grid;grid-template-columns:1fr 1fr;margin:0;border-top:1px solid var(--rule)}
.out div{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:7px 10px 7px 0;border-bottom:1px solid var(--rule-2)}
.out div:nth-child(odd){padding-right:16px}
.out dt{color:var(--ink-2);font-size:13px}
.out dd{margin:0;text-align:right;display:flex;flex-direction:column}
.out dd b{font:700 17px var(--f-display);white-space:nowrap}
.out dd span{font-size:12px;color:var(--ink-2)}
.steps{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px}
.check{list-style:none;margin:0 0 12px;padding:0}
.check li{display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--rule-2)}
.check svg{flex:none;width:16px;height:16px;margin-top:2px;padding:2px;border-radius:2px;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.check .ok svg{stroke:var(--good);background:var(--good-bg)}
.check .no svg{stroke:var(--strong);background:var(--strong-bg)}
.verdict{margin:0;font:700 20px var(--f-display);padding-top:8px;border-top:2px solid currentColor}
.v-good{color:var(--good)} .v-warn{color:var(--warn)} .v-bad{color:var(--strong)}
@media (max-width:760px){.grid,.out{grid-template-columns:1fr}.out div:nth-child(odd){padding-right:10px}}
</style>
