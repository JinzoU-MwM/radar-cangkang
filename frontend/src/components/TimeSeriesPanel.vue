<script setup>
// Time Series: proyeksi IHSG dari model runtun waktu klasik (AR, MA, ARMA, ARIMA, SARIMA, pemulusan eksponensial)
// yang dihitung server (/api/ihsg-runtun), digabung dengan bobot 1/galat uji mundur, lalu ditambah faktor
// sentimen berita, flow asing, dan musiman bulan kalender. Perkiraan statistik, bukan kepastian.
import { computed, ref } from 'vue'
import { api } from '../api.js'
import { fmt, fmtDate } from '../lib/domain.js'

const d = ref(null), err = ref(''), pilih = ref('')
api.get('/api/ihsg-runtun').then(r => { if (r.error) err.value = r.error; else d.value = r }, e => { err.value = e.message || String(e) })

const n0 = v => v == null ? '–' : Math.round(v).toLocaleString('id-ID')
const pct = v => v == null ? '–' : (v > 0 ? '+' : '') + fmt(v, 2) + '%'
const arahCls = v => v > 0.2 ? 'c-good' : v < -0.2 ? 'c-strong' : 'muted'

// Grafik: 120 hari terakhir + jalur 21 hari model terpilih (atau semua model tipis) + kisaran gabungan.
const W = 760, Hh = 240, PAD = 34
const chart = computed(() => {
  if (!d.value) return null
  const hist = d.value.riwayat, models = d.value.model, n = hist.length, total = n + 21
  // Skala dari riwayat + kisaran gabungan; jalur model yang keluar kisaran dipotong (clipPath).
  const all = [...hist.map(x => x.c), ...d.value.proyeksi.flatMap(x => [x.bawah, x.atas])]
  const lo = Math.min(...all), hi = Math.max(...all)
  const X = i => PAD + (i / (total - 1)) * (W - PAD - 8), Y = v => 10 + (1 - (v - lo) / (hi - lo || 1)) * (Hh - 30)
  const path = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('')
  const last = n - 1, p0 = hist[last].c
  const lines = models.map(m => ({ k: m.kunci, nama: m.nama, d: path([[last, p0], ...m.jalur.map((v, i) => [last + 1 + i, v])]) }))
  // Kisaran 80% gabungan (esok, 1 minggu, 1 bulan) sebagai poligon.
  const pr = d.value.proyeksi
  const band = `M${X(last)},${Y(p0)} ` + pr.map(x => `L${X(last + x.h)},${Y(x.atas)}`).join(' ') + ' ' + [...pr].reverse().map(x => `L${X(last + x.h)},${Y(x.bawah)}`).join(' ') + 'Z'
  const gab = path([[last, p0], ...pr.map(x => [last + x.h, x.sentimen])])
  const ticks = [lo, (lo + hi) / 2, hi].map(v => ({ y: Y(v), t: n0(v) }))
  return { hist: path(hist.map((x, i) => [i, x.c])), lines, band, gab, ticks, xNow: X(last), dNow: hist[last].d, dAwal: hist[0].d }
})
</script>

<template>
  <section class="ts">
    <p class="small muted intro">Proyeksi IHSG dengan <b>model matematika runtun waktu (statistik)</b>. Setiap model dihitung otomatis dari harga harian 1 tahun,
      diuji mundur pada 40 hari terakhir, lalu digabung (model yang galatnya lebih kecil berbobot lebih besar) dan ditambah faktor sentimen.</p>
    <p v-if="err" class="muted">{{ err }}</p>
    <p v-else-if="!d" class="muted">Menghitung model runtun waktu…</p>
    <template v-else>
      <div class="cards">
        <article v-for="p in d.proyeksi" :key="p.h" class="card">
          <div class="lbl">{{ p.nama }}</div>
          <div class="big" :class="arahCls(p.ubah)">{{ n0(p.sentimen) }}</div>
          <div class="small"><b :class="arahCls(p.ubah)">{{ pct(p.ubah) }}</b> dari {{ n0(d.harga) }}</div>
          <div class="small muted">Kisaran 80%: {{ n0(p.bawah) }}–{{ n0(p.atas) }}</div>
          <div class="small muted">Model murni {{ n0(p.murni) }} · {{ p.setuju }}% bobot model memperkirakan naik</div>
        </article>
      </div>

      <div class="chartbox">
        <svg :viewBox="`0 0 ${W} ${Hh}`" role="img" :aria-label="'Grafik IHSG 120 hari dan proyeksi 21 hari bursa dari ' + d.model.length + ' model runtun waktu'">
          <g v-for="t in chart.ticks" :key="t.y"><line :x1="34" :x2="W - 8" :y1="t.y" :y2="t.y" class="grid" /><text x="2" :y="t.y + 4" class="ax">{{ t.t }}</text></g>
          <line :x1="chart.xNow" :x2="chart.xNow" y1="6" :y2="Hh - 18" class="now" />
          <path :d="chart.band" class="band" />
          <path :d="chart.hist" class="hist" />
          <defs><clipPath id="ts-clip"><rect x="0" y="6" :width="W" :height="Hh - 24" /></clipPath></defs>
          <path v-for="l in chart.lines" :key="l.k" :d="l.d" clip-path="url(#ts-clip)" class="mdl" :class="{ on: pilih === l.k, off: pilih && pilih !== l.k }" />
          <path :d="chart.gab" class="gab" />
          <text :x="34" :y="Hh - 4" class="ax">{{ fmtDate(chart.dAwal) }}</text>
          <text :x="chart.xNow - 4" :y="Hh - 4" class="ax" text-anchor="end">{{ fmtDate(chart.dNow) }}</text>
          <text :x="W - 8" :y="Hh - 4" class="ax" text-anchor="end">+21 hari bursa</text>
        </svg>
        <p class="small muted leg"><span class="k hist" /> IHSG <span class="k gab" /> proyeksi gabungan + sentimen <span class="k band" /> kisaran 80% <span class="k mdl" /> jalur tiap model (klik baris tabel untuk menyorot)</p>
      </div>

      <h3 class="lbl">Model runtun waktu</h3>
      <div class="scroll">
        <table class="ledger">
          <thead><tr><th>Model</th><th class="r">Esok</th><th class="r">1 minggu</th><th class="r">1 bulan</th><th class="r" title="Galat rata-rata ramalan 1 hari / 5 hari pada uji mundur 40 hari">Galat 1h / 5h</th><th class="r" title="Ketepatan arah ramalan 1 hari pada uji mundur">Arah tepat</th><th class="r">Bobot</th></tr></thead>
          <tbody>
            <tr v-for="m in d.model" :key="m.kunci" class="row" :class="{ open: pilih === m.kunci }" tabindex="0" @click="pilih = pilih === m.kunci ? '' : m.kunci" @keydown.enter="pilih = pilih === m.kunci ? '' : m.kunci">
              <td><b>{{ m.nama }}</b><div class="small muted">{{ m.ket }} <span class="mono">({{ m.param }})</span></div></td>
              <td v-for="h in ['1', '5', '21']" :key="h" class="r num" :class="arahCls((m.proy[h] / d.harga - 1) * 100)">{{ n0(m.proy[h]) }}</td>
              <td class="r small">{{ m.uji.mape1 ?? '–' }}% / {{ m.uji.mape5 ?? '–' }}%</td>
              <td class="r small">{{ m.uji.arah ?? '–' }}%</td>
              <td class="r small"><b>{{ d.bobot[m.kunci] ?? 0 }}%</b></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="small muted">Model dengan galat terkecil saat ini: <b>{{ d.terbaik.join(', ') }}</b>. Arah tepat 50% setara menebak; di atas 55% baru bermakna.</p>

      <h3 class="lbl">Faktor sentimen yang ditambahkan</h3>
      <ul class="fk">
        <li v-for="f in d.faktor" :key="f.nama"><b>{{ f.nama }}</b>:
          <span :class="f.arah === 'positif' ? 'c-good' : f.arah === 'negatif' ? 'c-strong' : 'muted'">{{ f.arah }}</span>
          <template v-if="f.nama.startsWith('Sentimen')"> (skor {{ f.nilai }}; {{ d.sentimen.nPos }} berita positif, {{ d.sentimen.nNeg }} negatif)</template>
          <template v-else-if="f.nama.startsWith('Musiman') && f.nilai != null"> (median bulan ini {{ pct(f.nilai) }})</template>
          · efek {{ f.efek }}</li>
      </ul>
      <p class="small muted">Data per {{ fmtDate(d.tanggal) }} ({{ d.n }} hari bursa) · diperbarui otomatis bersama kartu IHSG. Proyeksi statistik dari pola harga masa lalu; peristiwa baru di luar data (kebijakan, geopolitik) tidak tertangkap model.</p>
    </template>
  </section>
</template>

<style scoped>
.intro{margin:0 0 12px;max-width:95ch}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:14px}
.card{border:1px solid var(--rule);background:var(--sheet);padding:10px 14px}
.big{font:700 28px/1.1 var(--f-display);margin:4px 0}
.chartbox{border:1px solid var(--rule);background:var(--sheet);padding:8px 10px;margin-bottom:14px}
.chartbox svg{display:block;width:100%;height:auto}
.grid{stroke:var(--rule-2);stroke-width:1}
.ax{font:11px var(--f-body);fill:var(--muted)}
.now{stroke:var(--muted);stroke-dasharray:3 3}
.hist{fill:none;stroke:var(--ink);stroke-width:1.6}
.mdl{fill:none;stroke:var(--rail-mute,#9aa);stroke-width:1;opacity:.6}
.mdl.on{stroke:var(--accent);stroke-width:2.2;opacity:1}.mdl.off{opacity:.15}
.gab{fill:none;stroke:var(--now-ink,#0a7);stroke-width:2.6}
.band{fill:var(--accent-soft,#dfeee9);opacity:.7}
.leg{margin:4px 0 0}.k{display:inline-block;width:14px;height:3px;vertical-align:middle;margin:0 4px 0 10px;background:var(--ink)}
.k.gab{background:var(--now-ink,#0a7)}.k.band{background:var(--accent-soft,#dfeee9);height:8px}.k.mdl{background:var(--rail-mute,#9aa)}
.scroll{overflow-x:auto}.r{text-align:right}.num{font-weight:700;white-space:nowrap}
.row{cursor:pointer}.row:hover,.row.open{background:var(--accent-soft)}
.mono{font-family:var(--f-data,monospace);font-size:11px}
.fk{margin:4px 0 10px;padding-left:18px;font-size:13px}.fk li{margin:3px 0}
.lbl{margin:10px 0 6px}
</style>
