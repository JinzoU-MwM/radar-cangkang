<script setup>
// Kondisi IHSG di Seasonality: grafik 1 tahun (tutup, EMA50, EMA200, support/resistance), tren & rekomendasi
// teknikal, sentimen berita pasar, dan probabilitas pola musiman berulang (/api/ihsg-outlook).
import { computed, ref, watch } from 'vue'
import { api } from '../api.js'
import { fmt, fmtDate } from '../lib/domain.js'

const props = defineProps({ bulan: { type: Number, required: true }, namaBulan: { type: String, default: '' } })
const d = ref(null), err = ref(''), semua = ref(false), busy = ref(false)
// Unduh riset IHSG (PDF): sampul, analisa teknikal & flow, seasonality & sentimen, disclaimer.
async function unduh() {
  if (!d.value) return
  busy.value = true
  try {
    const [{ jsPDF }, { ihsgPdf, ihsgPdfName }] = await Promise.all([import('jspdf'), import('../lib/ihsgPdf.js')])
    ;(await ihsgPdf(d.value, jsPDF)).save(ihsgPdfName(d.value.bulan))
  } catch (e) { err.value = 'PDF gagal dibuat: ' + (e.message || e) } finally { busy.value = false }
}
watch(() => props.bulan, async b => {
  err.value = ''
  try { const r = await api.get('/api/ihsg-outlook', { bulan: b }); if (r.error) err.value = r.error; else d.value = r } catch (e) { err.value = e.message || String(e) }
}, { immediate: true })

const W = 760, H = 220, P = 6
const chart = computed(() => {
  const t = d.value?.tek
  if (!t?.seri?.length) return null
  const s = t.seri, lv = [...(t.support || []), ...(t.resistance || [])].map(x => x.v)
  const ys = [...s.map(x => x.c), ...s.map(x => x.e50), ...s.map(x => x.e200), ...lv]
  const lo = Math.min(...ys) * 0.99, hi = Math.max(...ys) * 1.01
  const x = i => P + i / (s.length - 1) * (W - 2 * P), y = v => H - P - (v - lo) / (hi - lo) * (H - 2 * P)
  const path = k => s.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join('')
  return { c: path('c'), e50: path('e50'), e200: path('e200'), y,
    lines: [...(t.support || []).map(v => ({ ...v, k: 'S' })), ...(t.resistance || []).map(v => ({ ...v, k: 'R' }))],
    awal: s[0].d, akhir: s[s.length - 1].d }
})
const nf = v => v == null ? '–' : fmt(v, 0)
const tone = n => n === 'good' ? 'c-good' : n === 'bad' ? 'c-strong' : ''
const lbl = l => l === 'Tinggi' ? 'c-good' : l === 'Rendah' ? 'c-strong' : ''
</script>

<template>
  <section class="rule-top io">
    <h2>Kondisi IHSG & probabilitas pola {{ namaBulan }} berulang</h2>
    <p v-if="err" class="muted small">{{ err }}</p>
    <template v-else-if="d">
      <!-- Kesimpulan di depan: probabilitas berulang dan komponennya. -->
      <div class="top">
        <div class="big"><b :class="lbl(d.berulang.label)">{{ d.berulang.prob }}%</b><span>Probabilitas pola {{ namaBulan }} berulang · <b :class="lbl(d.berulang.label)">{{ d.berulang.label }}</b></span></div>
        <ul class="small komp">
          <li v-for="k in d.berulang.komponen" :key="k.nama"><b>{{ k.nama }}</b>: {{ k.nilai }}% <span class="muted">(bobot {{ Math.round(k.bobot * 100) }}%)</span></li>
        </ul>
      </div>

      <!-- Analisa Teknikal & Flow (gaya riset) + unduh PDF. -->
      <div v-if="d.riset" class="riset">
        <div class="rh">
          <h3>Analisa Teknikal & Flow IHSG</h3>
          <button type="button" class="btn" :disabled="busy" @click="unduh">{{ busy ? 'Menyiapkan PDF…' : '⬇ Unduh riset IHSG (PDF)' }}</button>
        </div>
        <div class="lvl">
          <div><span>Area beli</span><b class="c-teal">{{ nf(d.riset.level.beli[0]) }}–{{ nf(d.riset.level.beli[1]) }}</b></div>
          <div><span>Target</span><b class="c-good">{{ nf(d.riset.level.target[0]) }} / {{ nf(d.riset.level.target[1]) }}</b></div>
          <div><span>Risiko (tutup harian &lt;)</span><b class="c-strong">{{ nf(d.riset.level.risiko) }}</b></div>
        </div>
        <p class="small"><b>Struktur:</b> {{ d.riset.struktur }}</p>
        <p v-if="d.riset.flow" class="small"><b>Flow:</b> {{ d.riset.flow }}</p>
        <p class="small"><b>Rencana:</b> {{ d.riset.rencana }}</p>
      </div>

      <div class="grid">
        <div class="card">
          <h3>Tren & teknikal</h3>
          <p class="tr"><b :class="tone(d.tek.nada)">{{ d.tek.tren }}</b> · IHSG {{ nf(d.tek.harga) }} <span class="muted small">({{ fmtDate(d.tek.tanggal) }})</span></p>
          <svg v-if="chart" :viewBox="`0 0 ${W} ${H}`" class="ch" role="img" :aria-label="'Grafik IHSG ' + d.tek.tren">
            <line v-for="l in chart.lines" :key="l.k + l.v" :x1="0" :x2="W" :y1="chart.y(l.v)" :y2="chart.y(l.v)" :class="l.k === 'S' ? 'ls' : 'lr'" />
            <path :d="chart.e200" class="e200" /><path :d="chart.e50" class="e50" /><path :d="chart.c" class="cl" />
          </svg>
          <p class="small muted leg"><span class="k cl" /> IHSG <span class="k e50" /> EMA50 {{ nf(d.tek.ema50) }} <span class="k e200" /> EMA200 {{ nf(d.tek.ema200) }} · {{ fmtDate(chart?.awal) }} – {{ fmtDate(chart?.akhir) }}</p>
          <dl class="lv small">
            <dt>Resistance</dt><dd>{{ d.tek.resistance.map(x => nf(x.v)).join(' · ') || '–' }} <span class="muted">(+{{ fmt(d.tek.jarakResistance, 1) }}%)</span></dd>
            <dt>Support</dt><dd>{{ d.tek.support.map(x => nf(x.v)).join(' · ') || '–' }} <span class="muted">(−{{ fmt(d.tek.jarakSupport, 1) }}%)</span></dd>
            <dt>52 minggu</dt><dd>{{ nf(d.tek.rendah52) }} – {{ nf(d.tek.tinggi52) }}</dd>
          </dl>
          <p class="small rek"><b>Rekomendasi teknikal:</b> {{ d.tek.rekomendasi }}</p>
        </div>

        <div class="card">
          <h3>Sentimen ke depan <span class="small" :class="d.sentimen.arah === 'positif' ? 'c-good' : d.sentimen.arah === 'negatif' ? 'c-strong' : ''">({{ d.sentimen.arah }}: {{ d.sentimen.nPos }} positif / {{ d.sentimen.nNeg }} negatif)</span></h3>
          <h4 class="c-good">Positif</h4>
          <ul class="small news"><li v-for="x in d.sentimen.positif.slice(0, semua ? 99 : 3)" :key="x.url"><a :href="x.url" target="_blank" rel="noopener">{{ x.judul }}</a> <span class="muted">{{ fmtDate(x.d) }}</span></li></ul>
          <div class="sbar" :title="`${d.sentimen.nPos} positif / ${d.sentimen.nNeg} negatif`"><i class="p" :style="{ width: (d.sentimen.nPos / Math.max(1, d.sentimen.nPos + d.sentimen.nNeg) * 100) + '%' }" /></div>
          <!-- Topik berita: jumlah, arah, dan implikasinya (rincian berita ada di PDF). -->
          <ul v-if="d.sentimen.topik?.length" class="tpk small">
            <li v-for="t in d.sentimen.topik" :key="t.nama" :title="t.implikasi">
              <b>{{ t.nama }}</b> <span :class="t.arah === 'positif' ? 'c-good' : t.arah === 'negatif' ? 'c-strong' : 'muted'">{{ t.nPos }}+ / {{ t.nNeg }}−</span>
              <span class="muted">· {{ t.implikasi }}</span>
            </li>
          </ul>
          <h4 class="c-strong">Negatif</h4>
          <ul class="small news"><li v-for="x in d.sentimen.negatif.slice(0, semua ? 99 : 3)" :key="x.url"><a :href="x.url" target="_blank" rel="noopener">{{ x.judul }}</a> <span class="muted">{{ fmtDate(x.d) }}</span></li></ul>
          <button v-if="d.sentimen.positif.length > 3 || d.sentimen.negatif.length > 3" type="button" class="lnk small" @click="semua = !semua">{{ semua ? 'Ringkas' : 'Lihat semua berita' }}</button>
        </div>

        <div class="card">
          <h3>Apakah pola {{ namaBulan }} akan berulang?</h3>
          <p class="small"><b>Pola musiman 10 tahun:</b> naik {{ d.musiman?.up }} dari {{ d.musiman?.n }} tahun ({{ d.musiman?.prob }}%), median {{ fmt(d.musiman?.median, 2) }}%.</p>
          <p class="small"><b>Pada kondisi tren yang sama</b> (akhir bulan sebelumnya IHSG di {{ d.kondisi.kondisi }} rata-rata 10 bulan, seperti sekarang):
            naik {{ d.kondisi.up }} dari {{ d.kondisi.n }} tahun<template v-if="d.kondisi.prob != null"> ({{ d.kondisi.prob }}%)</template>.
            <span class="muted">Semua bulan dengan kondisi ini: {{ d.kondisi.semuaBulanProb }}% naik dari {{ d.kondisi.semuaBulanN }} bulan.</span></p>
          <ul class="small yr"><li v-for="y in d.kondisi.tahun" :key="y.tahun">{{ y.tahun }}: <span :class="y.ret > 0 ? 'c-good' : 'c-strong'">{{ y.ret > 0 ? '+' : '' }}{{ fmt(y.ret, 2) }}%</span></li></ul>
          <p class="small"><b>Sentimen:</b> {{ d.sentimen.arah }} (skor {{ d.sentimen.skor }}).</p>
          <p class="small muted">Probabilitas berulang = pola musiman (50%) + kondisi tren sama (30%, bila ≥ 3 tahun) + sentimen (20%: positif 65, netral 50, negatif 35). Data per {{ d.updated }}; diperbarui tiap 2 jam. Bukan kepastian.</p>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.riset{border:1px solid var(--rule);border-left:4px solid var(--now-ink);background:var(--sheet);padding:10px 14px;margin-bottom:12px}
.riset p{margin:5px 0;max-width:120ch}.rh{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.rh h3{margin:0}
.lvl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:8px 0}
.lvl div{border:1px solid var(--rule);padding:6px 10px;display:flex;flex-direction:column}.lvl span{font-size:11px;color:var(--muted)}.lvl b{font-size:18px}
.c-teal{color:#0d9488}
.top{display:flex;gap:20px;align-items:center;flex-wrap:wrap;margin:6px 0 10px}
.big{display:flex;flex-direction:column}.big > b{font-size:34px;line-height:1}.big span{font-size:13px}.big span b{font-size:inherit}
.komp{margin:0;padding-left:18px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;align-items:start}
.card{border:1px solid var(--rule);background:var(--sheet);padding:10px 12px}
.card h3{margin:0 0 6px;font-size:14px}.card h4{margin:6px 0 2px;font-size:12px;text-transform:uppercase}
.tr{margin:2px 0 6px}.tr b{font-size:18px}
.ch{width:100%;height:auto;display:block;background:var(--paper,transparent)}
.cl{fill:none;stroke:var(--ink,#1f2937);stroke-width:1.6}.e50{fill:none;stroke:#0d9488;stroke-width:1.3}.e200{fill:none;stroke:#c2410c;stroke-width:1.3;stroke-dasharray:4 3}
.ls{stroke:var(--good,#15803d);stroke-dasharray:3 4;stroke-width:1}.lr{stroke:var(--strong,#b91c1c);stroke-dasharray:3 4;stroke-width:1}
.leg .k{display:inline-block;width:14px;height:0;border-top:2px solid;vertical-align:middle;margin:0 3px 0 8px}
.leg .k.cl{border-color:var(--ink,#1f2937)}.leg .k.e50{border-color:#0d9488}.leg .k.e200{border-color:#c2410c;border-top-style:dashed}
.lv{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:6px 0}.lv dt{color:var(--muted)}.lv dd{margin:0;font-weight:600}
.rek{margin:6px 0 0}
.news{margin:0;padding-left:16px}
.tpk{margin:4px 0 6px;padding-left:16px}.tpk li{margin:2px 0}
.sbar{height:8px;background:var(--strong);border-radius:4px;overflow:hidden;margin:6px 0}.sbar .p{display:block;height:100%;background:var(--good)}
.lnk{background:none;border:0;padding:0;color:var(--now-ink);text-decoration:underline;cursor:pointer;margin-top:4px}.news li{margin:2px 0}
.yr{margin:2px 0;padding-left:16px;columns:2}
</style>
