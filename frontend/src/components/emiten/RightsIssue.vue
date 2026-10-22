<script setup>
// Analisa PMHMETD / PMTHMETD / penerbitan saham merger: nilai injeksi aset, nilai penerbitan (aset + tunai),
// siapa harus menyetor, TERP & nilai HMETD, dampak per lot, dan porsi publik. Harga pelaksanaan dan tingkat
// penebusan publik bisa digeser untuk simulasi; nilai awal dari data kurasi.
import { computed, ref, watch } from 'vue'
import { fmt, rp, big } from '../../lib/domain.js'
import { riCalc, riRange, riVerdict, noRights } from '../../lib/rightsIssue.js'

const props = defineProps({ c: { type: Object, required: true } })
const range = computed(() => riRange(props.c))
const P = ref(0), U = ref(0)
watch(() => props.c, c => { P.value = riRange(c).start; U.value = 0 }, { immediate: true })
const r = computed(() => riCalc(props.c, +P.value, (+U.value || 0) / 100))
const verdict = computed(() => riVerdict(props.c, r.value))
const nr = computed(() => noRights(props.c))
const pct = (v, d = 1) => v == null ? '–' : fmt(v * 100, d) + '%'
const sh = v => v == null ? '–' : v >= 1e9 ? fmt(v / 1e9, 2) + ' miliar' : fmt(v / 1e6, 0) + ' jt'
const pSrc = computed(() => {
  const c = props.c, p = +P.value
  if (c.ex && p === Math.round(c.ex)) return c.exAssumed ? 'asumsi data' : 'data resmi'
  if (c.implied && p === Math.round(c.implied)) return 'tersirat: nilai aset ÷ saham baru'
  return 'simulasi'
})
// Komposisi nilai penerbitan vs nilai aset injeksi (lebar relatif 0–100).
const bars = computed(() => {
  const x = r.value
  if (!x) return null
  const m = Math.max(x.total, props.c.inj || 0) || 1
  return { aset: x.aset / m * 100, tunai: x.tunai / m * 100, inj: (props.c.inj || 0) / m * 100 }
})
const STATUS = { rencana: 'Rencana', berjalan: 'Berjalan', tereksekusi: 'Sudah tereksekusi' }
</script>

<template>
  <section class="rule-top ri">
    <div class="hd">
      <h2>Analisa {{ c.label }}</h2>
      <span class="tag" :class="c.status === 'tereksekusi' ? 't-good' : c.status === 'berjalan' ? 't-now' : 't-warn'">{{ STATUS[c.status] }}</span>
      <span v-if="c.jadwal" class="small muted">{{ c.jadwal }}</span>
    </div>

    <div v-if="r" class="kpi">
      <div v-if="c.inj" class="k">
        <span class="lbl">Nilai transaksi injeksi aset</span>
        <b>{{ big(c.inj) }}</b>
        <em class="small muted">{{ c.injTarget || 'aset injeksi' }}<template v-if="c.kjpp"> · KJPP {{ big(c.kjpp) }} ({{ c.inj >= c.kjpp ? '+' : '' }}{{ fmt((c.inj / c.kjpp - 1) * 100, 0) }}%)</template><template v-else-if="c.kjppStatus === 'belum'"> · KJPP belum terbit</template></em>
      </div>
      <div class="k">
        <span class="lbl">Nilai penerbitan saham</span>
        <b>{{ big(r.total) }}</b>
        <em class="small muted">{{ sh(r.N) }} saham × {{ rp(P) }}<template v-if="r.vsMcap != null"> · {{ fmt(r.vsMcap, 1) }}× kapitalisasi</template></em>
      </div>
      <div class="k">
        <span class="lbl">Kebutuhan dana tunai</span>
        <b>{{ big(r.tunai) }}</b>
        <em class="small muted"><template v-if="r.aset">sisanya {{ big(r.aset) }} disetor non-tunai (aset/konversi utang)</template><template v-else>seluruhnya tunai</template></em>
      </div>
      <div class="k">
        <span class="lbl">Harga pelaksanaan</span>
        <b>{{ rp(P) }}</b>
        <em class="small muted">{{ pSrc }}<template v-if="r.disc != null"> · {{ r.disc >= 0 ? 'premi' : 'diskon' }} {{ fmt(Math.abs(r.disc) * 100, 0) }}% vs pasar {{ rp(c.price) }}</template></em>
      </div>
    </div>

    <!-- Simulasi. -->
    <div class="sim">
      <label class="sl">
        <span class="small">Harga pelaksanaan <b>{{ rp(P) }}</b></span>
        <input v-model.number="P" type="range" :min="range.lo" :max="range.hi" :step="range.step" aria-label="Harga pelaksanaan">
        <span class="ends small muted"><span>{{ c.nominal ? 'nominal ' : '' }}{{ rp(range.lo) }}</span><span v-if="c.price">pasar {{ rp(c.price) }}</span><span>{{ rp(range.hi) }}</span></span>
      </label>
      <label v-if="!nr" class="sl">
        <span class="small">Publik menebus <b>{{ U }}%</b></span>
        <input v-model.number="U" type="range" min="0" max="100" step="5" aria-label="Persentase publik menebus">
        <span class="ends small muted"><span>0% (tidak ikut)</span><span>100%</span></span>
      </label>
      <p v-if="!c.N" class="small muted span">Jumlah saham baru belum diumumkan: dihitung dari nilai yang perlu dibiayai ÷ harga pelaksanaan.</p>
    </div>

    <template v-if="r">
      <!-- Komposisi penerbitan vs nilai aset. -->
      <div v-if="bars" class="fund">
        <div v-if="c.inj" class="row"><span class="small">Nilai aset injeksi</span><div class="track"><i class="inj" :style="{ width: bars.inj + '%' }" /></div><b>{{ big(c.inj) }}</b></div>
        <div class="row"><span class="small">Nilai penerbitan</span>
          <div class="track"><i class="as" :style="{ width: bars.aset + '%' }" /><i class="tu" :style="{ width: bars.tunai + '%' }" /></div><b>{{ big(r.total) }}</b></div>
        <p class="small muted legend"><i class="sw as" />non-tunai (inbreng/konversi utang) <i class="sw tu" />tunai
          <template v-if="c.laterInj"> · Aset {{ big(c.laterInj) }} dibayar saham di tahap lanjutan: setara {{ sh(r.injShares) }} saham pada {{ rp(P) }}.</template>
          <template v-else-if="r.gap > c.inj * 0.05"> · Kekurangan {{ big(r.gap) }} harus ditutup utang, kas internal, atau tahap lanjutan.</template>
        </p>
        <p v-if="c.injCara" class="small muted">{{ c.injCara }}</p>
      </div>

      <div class="grid">
        <div v-if="!nr" class="box">
          <h3 class="lbl">Siapa harus menyetor</h3>
          <table class="ledger">
            <tbody>
              <tr><td>Bagian pengendali ({{ fmt(c.ctrlPct || 0, 2) }}%)</td><td class="r num">{{ big(r.ctrlPart) }}</td></tr>
              <tr><td>Bagian publik ({{ fmt(c.float || 0, 2) }}%) bila menebus semua</td><td class="r num">{{ big(r.pubPart) }}</td></tr>
              <tr><td>Sisa publik diserap pembeli siaga/pengendali</td><td class="r num"><b>{{ big(r.standby) }}</b></td></tr>
              <tr><td>Porsi pengendali bila menyerap sisa</td><td class="r num">{{ fmt(c.ctrlPct || 0, 2) }}% → <b>{{ pct(r.ctrlAfterAbsorb, 2) }}</b></td></tr>
            </tbody>
          </table>
        </div>
        <div v-else class="box">
          <h3 class="lbl">{{ c.kind === 'merger' ? 'Pemegang saham pihak yang digabung' : 'Investor baru' }}</h3>
          <table class="ledger">
            <tbody>
              <tr><td>Porsi penerima saham baru</td><td class="r num"><b>{{ pct(r.newHolder, 2) }}</b></td></tr>
              <tr><td>Porsi pengendali sekarang → setelah</td><td class="r num">{{ fmt(c.ctrlPct || 0, 2) }}% → {{ pct(r.ctrlAfterNr, 2) }}</td></tr>
              <tr><td>{{ r.aset ? 'Nilai aset masuk' : 'Dana masuk' }}</td><td class="r num">{{ big(r.total) }}</td></tr>
            </tbody>
          </table>
        </div>
        <div class="box">
          <h3 class="lbl">Untuk investor (per 1 lot = 100 saham)</h3>
          <table class="ledger">
            <tbody>
              <tr v-if="!nr"><td>HMETD diterima</td><td class="r num">{{ fmt(r.perLot.hak, 1) }} hak <span class="small muted">(rasio {{ fmt(r.ratio, 2) }}:1)</span></td></tr>
              <tr v-if="!nr"><td>Dana untuk menebus semua hak</td><td class="r num">{{ rp(r.perLot.dana) }}</td></tr>
              <tr v-if="r.terp != null"><td>Harga teoretis setelah penerbitan (TERP)</td><td class="r num"><b>{{ rp(r.terp) }}</b> <span class="small muted">{{ r.terp >= c.price ? '+' : '' }}{{ pct(r.terp / c.price - 1, 0) }}</span></td></tr>
              <tr v-if="!nr && r.hak != null"><td>Nilai teoretis 1 HMETD</td><td class="r num">{{ r.hak > 0 ? rp(r.hak) : 'Rp0 (harga tebus ≥ TERP)' }}</td></tr>
              <tr><td>Porsi kepemilikan bila tidak ikut</td><td class="r num">turun {{ pct(r.dilusi) }}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="steps">
        <div class="st"><span class="small muted">Publik sekarang</span><b>{{ fmt(c.float || 0, 2) }}%</b></div>
        <span class="arr" aria-hidden="true">→</span>
        <div class="st"><span class="small muted">Setelah penerbitan{{ nr ? '' : ` (publik menebus ${U}%)` }}</span><b :class="{ warn: r.pubAfter < 0.075 }">{{ pct(r.pubAfter, 2) }}</b></div>
        <template v-if="r.pubAfterInj != null">
          <span class="arr" aria-hidden="true">→</span>
          <div class="st"><span class="small muted">Setelah injeksi aset tahap lanjutan</span><b :class="{ warn: r.pubAfterInj < 0.075 }">{{ pct(r.pubAfterInj, 2) }}</b></div>
        </template>
      </div>

      <p v-if="verdict" class="verdict"><b>Kesimpulan:</b> {{ verdict }}</p>
    </template>
    <p v-else class="small muted">Jumlah saham baru atau nilai dana belum diketahui dari keterbukaan; perhitungan menunggu prospektus.</p>
    <details v-if="c.notes.length" class="small muted src"><summary>Dasar angka</summary><p v-for="n in c.notes" :key="n">{{ n }}</p></details>
  </section>
</template>

<style scoped>
.hd{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.hd h2{margin:0}
.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin-bottom:12px}
.k{background:var(--sheet);border:1px solid var(--rule);padding:10px 12px;display:flex;flex-direction:column;gap:2px}
.k b{font-size:22px;line-height:1.2}
.k .lbl{margin:0}
.sim{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px 20px;background:var(--sheet);border:1px solid var(--rule);padding:12px;margin-bottom:12px}
.sim .span{grid-column:1/-1;margin:0}
.sl{display:flex;flex-direction:column;gap:4px}
.sl input{width:100%;accent-color:var(--now-ink)}
.ends{display:flex;justify-content:space-between}
.fund{margin-bottom:12px}
.fund .row{display:grid;grid-template-columns:150px 1fr 110px;gap:10px;align-items:center;margin-bottom:6px}
.fund .row b{text-align:right}
.track{height:12px;background:var(--rule-2);border-radius:6px;overflow:hidden;display:flex}
.track i{display:block;height:100%}
.inj,.sw.inj{background:var(--ink);opacity:.55}
.as,.sw.as{background:var(--warn, #c98a1b)}
.tu,.sw.tu{background:var(--good)}
.legend .sw{display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 4px 0 8px;vertical-align:middle}
.legend .sw:first-child{margin-left:0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-bottom:12px}
.box .lbl{margin:0 0 6px}
.steps{display:flex;align-items:stretch;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.st{background:var(--sheet);border:1px solid var(--rule);padding:8px 12px;display:flex;flex-direction:column;min-width:140px}
.st b{font-size:20px}
.st b.warn{color:var(--strong, #c0392b)}
.arr{align-self:center;opacity:.5}
.verdict{margin:6px 0}
.src p{margin:4px 0}
@media (max-width:760px){ .fund .row{grid-template-columns:1fr 90px}.fund .row .track{grid-column:1/-1;grid-row:2} }
</style>
