<script setup>
// Analisa Harmonic Pattern satu saham, tampil di tempat (tanpa pindah halaman): chart candlestick dengan pola, skor
// kualitas beserta rinciannya, struktur kaki, validasi rasio, konfirmasi di PRZ, rencana (entry, stop, target, R:R),
// skenario, narasi, keterangan titik/PRZ/level, dan unduhan PDF. Data dari /api/harmonik?ticker= (harga harian 1 tahun;
// pola tanpa saringan likuiditas). Tanpa pola valid: pola terdekat dari swing terakhir dan syarat yang meleset.
import { computed, ref, watch } from 'vue'
import { api } from '../api.js'
import HarmonikChart from './HarmonikChart.vue'
import { HM_STATUS, przTeks, rentang, cekRasio, analisaHarmonik, detailHarmonik, kandidatTerdekat } from '../lib/harmonik.js'

const props = defineProps({ ticker: { type: String, required: true }, pola: { type: String, default: '' } })
const d = ref(null), err = ref(''), muat = ref(false), pilih = ref(0)
const rp = v => v == null ? '–' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: 2 })

async function tarik() {
  muat.value = true; err.value = ''; d.value = null
  try {
    d.value = await api.get('/api/harmonik', { ticker: props.ticker })
    const i = (d.value.rows || []).findIndex(r => r.pola === props.pola)
    pilih.value = i < 0 ? 0 : i
  } catch (e) { err.value = e.message || String(e) } finally { muat.value = false }
}
watch(() => props.ticker, tarik, { immediate: true })

const row = computed(() => d.value?.rows?.[pilih.value] || null)
const meta = computed(() => (d.value?.pola || []).find(p => p.k === row.value?.pola) || {})
const a = computed(() => analisaHarmonik(row.value, d.value?.bars || [], d.value?.pola || [], d.value?.likuid))
const cek = computed(() => cekRasio(row.value, d.value?.pola || []))
const nada = computed(() => !a.value ? '' : a.value.skor >= 70 ? 't-good' : a.value.skor >= 45 ? 't-warn' : 't-strong')
const det = computed(() => detailHarmonik(row.value, meta.value, d.value?.bars?.at(-1)?.c))
const dekat = computed(() => row.value ? null : kandidatTerdekat(d.value?.pivot || [], d.value?.pola || []))
const pctTeks = v => v == null ? '–' : `${v > 0 ? '+' : ''}${rp(v)}%`

// Unduh analisa yang sedang tampil (PDF); jsPDF dimuat saat tombol ditekan.
const busyPdf = ref(false), errPdf = ref('')
async function unduh() {
  busyPdf.value = true; errPdf.value = ''
  try {
    const [{ jsPDF }, P] = await Promise.all([import('jspdf'), import('../lib/harmonikPdf.js')])
    ;(await P.harmonikPdf(d.value, pilih.value, jsPDF)).save(P.harmonikPdfName(d.value.t))
  } catch (e) { errPdf.value = 'PDF gagal dibuat: ' + (e.message || e) } finally { busyPdf.value = false }
}
</script>

<template>
  <div class="ha">
    <p v-if="muat" class="small muted">Menarik harga harian {{ ticker }} dan mencari pola…</p>
    <p v-else-if="err" class="small c-strong">{{ err }}</p>
    <template v-else-if="d">
      <header class="hh">
        <div><h4>{{ d.t }} <span class="muted">{{ d.nama }}</span></h4>
          <span class="small muted">Data: {{ d.sumber }} sampai {{ String(d.bars.at(-1)?.d || '').slice(0, 10) }} · nilai transaksi rata-rata 20 hari Rp{{ rp(Math.round(d.nilai / 1e6)) }} juta
            <template v-if="!d.likuid"> · di bawah batas screening (Rp{{ rp(d.minNilai / 1e9) }} miliar), struktur bisa kurang representatif</template></span></div>
        <div class="seg">
          <button type="button" class="btn" :disabled="busyPdf" @click="unduh">{{ busyPdf ? 'Menyiapkan PDF…' : 'Unduh analisa ' + d.t + ' (PDF)' }}</button>
        </div>
      </header>
      <p v-if="errPdf" class="small c-strong">{{ errPdf }}</p>
      <div v-if="d.rows.length > 1" class="seg"><span class="small muted">Pola ditemukan:</span>
          <button v-for="(r, i) in d.rows" :key="r.pola + i" type="button" class="pill sm" :aria-pressed="String(pilih === i)" @click="pilih = i">
            {{ (d.pola.find(p => p.k === r.pola) || {}).nama }} {{ r.arah }} <span class="muted">X {{ r.titik[0].d }}</span></button>
      </div>

      <HarmonikChart :bars="d.bars" :row="row" :pivot="row ? [] : d.pivot" />

      <div v-if="!row" class="kartu">
        <span class="ik">Belum ada pola harmonik valid</span>
        <p class="small">Swing terakhir {{ d.t }} (garis putus-putus) belum memenuhi rasio Gartley, Bat, Butterfly, Crab, maupun Cypher dengan toleransi ±5%,
          atau D sudah menembus PRZ. Pola harmonik memang jarang terbentuk sempurna; jangan dipaksakan.</p>
        <p class="small muted">Swing terakhir: {{ d.pivot.map(p => `${p.k === 'H' ? 'puncak' : 'lembah'} ${rp(p.p)} (${p.d})`).join(' → ') }}</p>
        <template v-if="dekat">
          <span class="ik">Pola terdekat: {{ dekat.nama }} {{ dekat.arah }} ({{ dekat.cocok }} dari {{ dekat.total }} syarat terpenuhi)</span>
          <p class="small">Lima swing terakhir dibaca sebagai {{ dekat.titik.map(t => `${t.n} ${rp(t.p)} (${t.d})`).join(', ') }}.
            {{ dekat.titik.length < 5 ? 'Titik D belum terbentuk.' : '' }}</p>
          <ul class="cek small"><li v-for="c in dekat.cek" :key="c.label" :class="c.ok ? 'ok' : 'no'">{{ c.label }} {{ rp(c.nilai) }}: {{ c.ok ? 'sesuai' : 'di luar' }} kriteria {{ rentang(c.kriteria) }}</li></ul>
          <p class="small muted">Pola baru dianggap valid bila semua syarat terpenuhi dan PRZ (retracement XA bertemu extension BC) tidak ditembus. Pantau lagi setelah swing baru terbentuk.</p>
        </template>
      </div>

      <template v-else>
        <div class="atas">
          <div class="skor kartu">
            <span class="ik">Kualitas pola</span>
            <b class="besar">{{ a.skor }}<small>/100</small></b>
            <span class="tag" :class="nada">{{ a.label }}</span>
            <span class="tag" :class="HM_STATUS[row.status][1]">{{ HM_STATUS[row.status][0] }}</span>
            <ul class="rinci small">
              <li v-for="x in a.rincian" :key="x.k"><span>{{ x.k }}</span><i><em :style="{ width: (x.nilai / x.maks * 100) + '%' }"></em></i><b>{{ Math.round(x.nilai) }}/{{ x.maks }}</b>
                <small class="muted">{{ x.ket }}</small></li>
            </ul>
          </div>
          <div class="kartu">
            <span class="ik">Ringkasan analisa</span>
            <ul class="small nar"><li v-for="t in a.narasi" :key="t">{{ t }}</li></ul>
            <p class="small muted">{{ meta.ket }}</p>
          </div>
        </div>

        <div class="g4">
          <div class="kartu"><span class="ik">Area entry</span><b class="bn">{{ przTeks(row) }}</b>
            <p class="small muted">{{ row.status === 'menuju' ? 'Tunggu D terbentuk dan konfirmasi' : row.status === 'berbalik' ? 'Sudah berbalik; kini ' + rp(row.harga) : 'Setelah konfirmasi di PRZ' }}</p></div>
          <div class="kartu"><span class="ik">Stop loss</span><b class="bn c-strong">{{ rp(row.stop) }}</b><p class="small muted">risiko {{ rp(a.rencana?.risikoPct) }}% dari entry</p></div>
          <div class="kartu"><span class="ik">Target 0,382 / 0,618</span><b class="bn c-good">{{ rp(a.rencana?.t1) }} / {{ rp(a.rencana?.t2) }}</b><p class="small muted">R:R {{ rp(a.rencana?.rr1) }} / {{ rp(a.rencana?.rr2) }}</p></div>
          <div class="kartu"><span class="ik">Target C / A</span><b class="bn">{{ row.targetCA ? rp(row.targetCA[0]) + ' / ' + rp(row.targetCA[1]) : '–' }}</b><p class="small muted">alternatif Maxco</p></div>
        </div>

        <div class="tiga">
          <div class="kartu">
            <span class="ik">Struktur kaki</span>
            <table class="ledger small"><thead><tr><th>Kaki</th><th class="num">Perubahan</th><th class="num">Hari bursa</th></tr></thead>
              <tbody><tr v-for="k in a.kaki" :key="k.n"><td>{{ k.n }}</td><td class="num" :class="k.pct >= 0 ? 'c-good' : 'c-strong'">{{ k.pct > 0 ? '+' : '' }}{{ rp(k.pct) }}%</td><td class="num">{{ k.bar }}</td></tr></tbody></table>
            <p class="small muted">{{ row.titik.map(t => `${t.n} ${rp(t.p)} (${t.d})`).join(' · ') }}</p>
          </div>
          <div class="kartu">
            <span class="ik">Validasi rasio</span>
            <ul class="cek small"><li v-for="c in cek" :key="c.label" :class="c.ok ? 'ok' : 'no'">{{ c.label }}: {{ rp(c.nilai) }} <span class="muted">(kriteria {{ rentang(c.kriteria) }})</span></li>
              <li class="ok">PRZ {{ przTeks(row) }}: retracement XA bertemu extension BC</li>
              <li v-if="a.simetri" :class="Math.abs(a.simetri.harga - 1) <= 0.5 ? 'ok' : 'no'">AB=CD: CD {{ rp(a.simetri.harga) }}× AB, durasi {{ rp(a.simetri.waktu) }}×</li></ul>
            <span class="ik">Konfirmasi di PRZ</span>
            <ul class="cek small"><li v-for="k in row.konfirmasi" :key="k" class="ok">{{ k }}</li>
              <li v-if="!row.konfirmasi?.length" class="no">{{ row.status === 'menuju' ? 'Titik D belum terbentuk' : 'Belum ada candle pembalikan, divergence RSI, atau tembus struktur minor' }}</li></ul>
          </div>
          <div class="kartu">
            <span class="ik">Konteks teknikal</span>
            <ul class="small kv">
              <li><span>Tren besar</span><b>{{ a.tren }}</b></li>
              <li><span>Searah tren</span><b :class="a.searah ? 'c-good' : 'c-strong'">{{ a.searah ? 'ya' : 'tidak' }}</b></li>
              <li><span>EMA50 / EMA200</span><b>{{ rp(a.e50 && Math.round(a.e50)) }} / {{ rp(a.e200 && Math.round(a.e200)) }}</b></li>
              <li><span>RSI(14)</span><b>{{ rp(a.rsi) }}</b></li>
              <li v-if="a.volD != null"><span>Volume di D</span><b>{{ rp(a.volD) }}× rata-rata</b></li>
            </ul>
          </div>
        </div>

        <div class="dua">
          <div class="kartu">
            <span class="ik">Keterangan titik</span>
            <table class="ledger small"><thead><tr><th>Titik</th><th>Tanggal</th><th class="num">Harga</th><th class="num">vs kini</th><th>Peran</th></tr></thead>
              <tbody><tr v-for="t in det.titik" :key="t.n"><td><b>{{ t.n }}</b></td><td>{{ t.d }}</td><td class="num">{{ rp(t.p) }}</td><td class="num">{{ pctTeks(t.jarak) }}</td><td>{{ t.peran }}</td></tr></tbody></table>
          </div>
          <div class="kartu">
            <span class="ik">Asal-usul PRZ</span>
            <ol class="small nar"><li v-for="x in det.prz" :key="x">{{ x }}</li></ol>
            <span class="ik">Level penting vs harga kini {{ rp(d.bars.at(-1)?.c) }}</span>
            <ul class="small kv"><li v-for="l in det.level" :key="l.k"><span>{{ l.k }}</span><b>{{ l.teks }} <small class="muted">({{ pctTeks(l.jarak) }})</small></b></li></ul>
          </div>
        </div>

        <details class="kartu baca small">
          <summary><b>Cara membaca analisa ini</b></summary>
          <ul class="nar">
            <li><b>Status</b>: "Menuju PRZ" berarti X-A-B-C sudah terbentuk dan harga masih bergerak ke zona D; "Di PRZ" berarti titik D sedang berada di zona; "Berbalik dari PRZ" berarti D terkonfirmasi dan harga mulai berbalik.</li>
            <li><b>PRZ</b> adalah area, bukan satu harga: pertemuan retracement kaki XA dengan proyeksi extension kaki BC. Makin banyak level bertumpuk, makin kuat zonanya.</li>
            <li><b>Skor kualitas</b> menjumlahkan presisi rasio (30), konfirmasi di PRZ (25), keselarasan dengan tren besar EMA50/EMA200 (20), simetri AB=CD (15), dan likuiditas (10). Skor bukan peluang berhasil.</li>
            <li><b>Konfirmasi</b> yang dicari: candle pembalikan (pin bar, engulfing, outside bar), divergence RSI antara B dan D, atau penutupan yang menembus struktur minor 3 bar sebelum D.</li>
            <li><b>Stop</b> sedikit di balik X (Gartley, Bat, Cypher) atau di luar PRZ (Butterfly, Crab). <b>Target</b> 0,382 dan 0,618 kaki AD; alternatif titik C lalu A.</li>
            <li>R:R dihitung dari tepi PRZ (atau harga kini bila sudah berbalik) ke stop dan target.</li>
          </ul>
        </details>

        <div class="kartu">
          <span class="ik">Skenario</span>
          <ol class="sk small"><li v-for="x in a.skenario" :key="x.k"><b>{{ x.k }}.</b> {{ x.teks }}</li></ol>
          <p class="small muted">Analisa otomatis dari harga penutupan harian; titik awal untuk dicek di chart, bukan rekomendasi beli/jual.</p>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.ha{display:flex;flex-direction:column;gap:10px;padding:6px 0}
.hh{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;flex-wrap:wrap}
.hh h4{margin:0;font:800 18px var(--f-display)}
.seg{display:flex;gap:6px;flex-wrap:wrap}
.kartu{border:1px solid var(--rule);border-top:3px solid var(--accent);background:var(--paper);padding:10px 12px}
.kartu p{margin:6px 0}
.ik{display:block;font:700 11px var(--f-data);letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin:2px 0 4px}
.atas{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:10px}
.g4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.tiga{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.dua{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:10px}
.baca summary{cursor:pointer}
.besar{display:inline-block;font:800 40px/1 var(--f-display);margin:4px 8px 6px 0}.besar small{font-size:14px;color:var(--ink-2)}
.bn{display:block;font:800 18px var(--f-display);margin-top:2px}
.rinci{list-style:none;padding:0;margin:8px 0 0}
.rinci li{display:grid;grid-template-columns:1fr 70px 44px;gap:6px;align-items:center;margin:5px 0}
.rinci small{grid-column:1/-1;margin-top:-3px}
.rinci i{height:6px;background:var(--rule-2);border-radius:3px;overflow:hidden}.rinci em{display:block;height:100%;background:var(--accent)}
.rinci b{text-align:right;font-family:var(--f-data)}
.nar{margin:4px 0;padding-left:18px}.nar li{margin:3px 0}
.cek{list-style:none;padding:0;margin:4px 0 8px}.cek li{padding-left:20px;position:relative;margin:3px 0}
.cek li::before{position:absolute;left:0;font-weight:800}.cek li.ok::before{content:'✓';color:var(--good)}.cek li.no::before{content:'–';color:var(--ink-2)}
.kv{list-style:none;padding:0;margin:0}.kv li{display:flex;justify-content:space-between;border-bottom:1px dotted var(--rule);padding:4px 0}
.sk{margin:4px 0;padding-left:20px}.sk li{margin:4px 0}
@media (max-width:860px){.atas,.tiga,.dua{grid-template-columns:1fr}.g4{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
