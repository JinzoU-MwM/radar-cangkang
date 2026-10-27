<script setup>
// Seasonality: pola bulanan berulang IHSG, sektor, dan saham (5/10 tahun) + sinyal broker, katalis, dan
// alasan historis (aksi korporasi). Data dari /api/seasonality (diperbarui otomatis Senin-Sabtu pukul 00.01 WIB).
import { computed, ref, watch } from 'vue'
import { api } from '../api.js'
import { fmt } from '../lib/domain.js'

const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
// Default bulan depan (Desember -> Januari).
const bulan = ref((new Date().getMonth() + 1) % 12 + 1)
const tahun = ref(10)
const data = ref(null), err = ref(''), loading = ref(false)
async function load() {
  loading.value = true; err.value = ''
  try {
    const r = await api.get('/api/seasonality', { bulan: bulan.value, tahun: tahun.value })
    if (r.error) { err.value = r.error; data.value = null } else data.value = r
  } catch (e) { err.value = e.message || String(e) } finally { loading.value = false }
}
watch([bulan, tahun], load, { immediate: true })
const top5 = computed(() => (data.value?.saham || []).slice(0, 5))
const pct = v => v == null ? '–' : (v > 0 ? '+' : '') + fmt(v, 2) + '%'
const tone = p => p >= 70 ? 'c-good' : p >= 50 ? '' : 'c-strong'
const rp = v => v == null ? '–' : 'Rp' + Math.round(v).toLocaleString('id-ID')
const rpr = e => e ? (e[0] === e[1] ? rp(e[0]) : `${rp(e[0])}–${rp(e[1])}`) : '–'
</script>

<template>
  <div class="sz">
    <header>
      <h1>Seasonality</h1>
      <p class="muted small">Pola kenaikan berulang di bulan yang sama selama {{ tahun }} tahun: IHSG, sektor, dan saham, dipadukan dengan sinyal broker dan katalis. Probabilitas historis, bukan kepastian; bukan rekomendasi beli/jual.</p>
      <div class="ctl">
        <div class="bln" role="group" aria-label="Bulan">
          <button v-for="(b, i) in BLN" :key="b" type="button" class="pill sm" :aria-pressed="String(bulan === i + 1)" @click="bulan = i + 1">{{ b }}</button>
        </div>
        <div role="group" aria-label="Rentang">
          <button type="button" class="pill sm" :aria-pressed="String(tahun === 5)" @click="tahun = 5">5 tahun</button>
          <button type="button" class="pill sm" :aria-pressed="String(tahun === 10)" @click="tahun = 10">10 tahun</button>
        </div>
      </div>
    </header>

    <p v-if="loading" class="muted">Menghitung pola…</p>
    <p v-else-if="err" class="muted">{{ err }}</p>
    <template v-else-if="data">
      <!-- Pasar: IHSG bulan terpilih + peluang naik 12 bulan. -->
      <section class="rule-top">
        <h2>Pasar (IHSG) · {{ BLN[bulan - 1] }}</h2>
        <p v-if="data.ihsg" class="big"><b :class="tone(data.ihsg.prob)">{{ data.ihsg.prob }}%</b> peluang naik <span class="muted small">({{ data.ihsg.up }} dari {{ data.ihsg.n }} tahun · median {{ pct(data.ihsg.median) }})</span></p>
        <div class="months">
          <button v-for="(m, i) in data.ihsgBulan" :key="i" type="button" class="mo" :class="{ on: bulan === i + 1 }" @click="bulan = i + 1">
            <span class="bar"><i :style="{ height: (m?.prob || 0) + '%' }" :class="tone(m?.prob || 0)" /></span>
            <b>{{ m ? m.prob + '%' : '–' }}</b><small>{{ BLN[i] }}</small>
          </button>
        </div>
      </section>

      <section class="rule-top">
        <h2>Prioritas {{ BLN[bulan - 1] }}</h2>
        <p class="muted small">Skor 0–100 = pola saham {{ data.bobot.pola }} + sektor {{ data.bobot.sektor }} + IHSG {{ data.bobot.ihsg }} + akumulasi broker {{ data.bobot.broker }} + katalis {{ data.bobot.katalis }}. Pola memakai peluang naik terkoreksi sampel kecil (Wilson).</p>
        <div class="cards">
          <RouterLink v-for="x in top5" :key="x.t" class="card" :to="{ path: '/emiten/' + x.t, query: { tab: 'analisa' } }">
            <div class="ch"><b>{{ x.t }}</b><span class="skor">{{ x.skor }}</span></div>
            <span class="small muted">{{ x.sektorNama || 'sektor –' }}</span>
            <span>Naik <b>{{ x.up }}/{{ x.n }}</b> tahun · median {{ pct(x.median) }}</span>
            <span class="small">Broker: {{ x.broker }}<template v-if="x.radar"> · {{ x.radar }}</template></span>
            <span v-if="x.alasan[0]" class="small muted">{{ x.alasan[0] }}</span>
            <dl v-if="x.plan" class="tp">
              <dt>Beli</dt><dd>{{ rpr(x.plan.entry) }}</dd>
              <dt>Batas rugi</dt><dd class="c-strong">{{ rp(x.plan.sl) }} ({{ x.plan.slPct }}%)</dd>
              <dt>Ambil untung</dt><dd class="c-good">{{ rp(x.plan.tp1) }} / {{ rp(x.plan.tp2) }}</dd>
              <dt>Waktu</dt><dd>{{ x.plan.timeframe }}</dd>
            </dl>
          </RouterLink>
        </div>
      </section>

      <!-- Trading plan prioritas: rinci dan dapat diuji ulang dengan data historis bulan yang sama. -->
      <section v-if="top5.some(x => x.plan)" class="rule-top">
        <h2>Trading plan {{ BLN[bulan - 1] }}</h2>
        <p class="muted small">Area beli = harga terkini s.d. EMA20 (maks. 5% di bawah harga). Batas rugi = median penurunan di tahun-tahun turun (4–10%). TP1 = median kenaikan di tahun-tahun naik; TP2 = kenaikan kuartil atas. Uji historis memakai penutupan bulan.</p>
        <div class="scroll">
          <table class="ledger">
            <thead><tr><th>Saham</th><th class="num">Harga</th><th>Area beli</th><th class="num">Batas rugi</th><th class="num">TP1</th><th class="num">TP2</th><th class="num">R/R</th><th>Masuk</th><th>Keluar</th><th class="num">Uji historis</th></tr></thead>
            <tbody>
              <tr v-for="x in top5.filter(y => y.plan)" :key="x.t">
                <td><RouterLink :to="{ path: '/emiten/' + x.t, query: { tab: 'analisa' } }"><b>{{ x.t }}</b></RouterLink></td>
                <td class="num">{{ rp(x.plan.harga) }}</td>
                <td>{{ rpr(x.plan.entry) }}</td>
                <td class="num c-strong">{{ rp(x.plan.sl) }} <span class="small">({{ x.plan.slPct }}%)</span></td>
                <td class="num c-good">{{ rp(x.plan.tp1) }} <span class="small">(+{{ x.plan.tp1Pct }}%)</span></td>
                <td class="num c-good">{{ rp(x.plan.tp2) }} <span class="small">(+{{ x.plan.tp2Pct }}%)</span></td>
                <td class="num" :class="{ 'c-strong': x.plan.rr != null && x.plan.rr < 1 }" :title="x.plan.rr != null && x.plan.rr < 1 ? 'R/R di bawah 1: tunggu harga mendekati batas bawah area beli' : ''">{{ x.plan.rr ?? '–' }}</td>
                <td class="small">{{ x.plan.masuk }}</td>
                <td class="small">{{ x.plan.keluar }}</td>
                <td class="num small">TP1 {{ x.plan.kenaTp1 }}/{{ x.plan.n }} · SL {{ x.plan.kenaSl }}/{{ x.plan.n }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="muted small">R/R merah = di bawah 1: tunggu harga mendekati batas bawah area beli. Jangka waktu swing ±1 bulan. Posisi kecil, disiplin batas rugi; keluar lebih awal bila TP tercapai atau pola bulan ini gagal di pekan pertama.</p>
      </section>

      <section class="rule-top">
        <h2>Sektor · {{ BLN[bulan - 1] }}</h2>
        <div class="sek">
          <div v-for="s in data.sektor" :key="s.kode" class="sr">
            <span>{{ s.nama }}</span>
            <span class="track"><i :style="{ width: s.prob + '%' }" :class="tone(s.prob)" /></span>
            <b :class="tone(s.prob)">{{ s.prob }}%</b>
            <span class="small muted">{{ s.up }}/{{ s.n }} · {{ pct(s.median) }}</span>
          </div>
        </div>
      </section>

      <section class="rule-top">
        <h2>Saham berpola naik di {{ BLN[bulan - 1] }} <span class="muted small">({{ data.total }} saham dihitung · data {{ data.updated }})</span></h2>
        <div class="scroll">
          <table class="ledger">
            <thead><tr><th>Saham</th><th>Sektor</th><th class="num">Naik</th><th class="num">Peluang</th><th class="num">Median</th><th class="num">Terburuk</th><th class="num">&gt; IHSG</th><th>Broker</th><th>Katalis &amp; alasan historis</th><th>Trading plan</th><th class="num">Skor</th></tr></thead>
            <tbody>
              <tr v-for="x in data.saham" :key="x.t">
                <td><RouterLink :to="{ path: '/emiten/' + x.t, query: { tab: 'analisa' } }"><b>{{ x.t }}</b></RouterLink><span v-if="x.radar" class="tag t-calm">{{ x.radar }}</span></td>
                <td class="small">{{ x.sektorNama || '–' }}</td>
                <td class="num">{{ x.up }}/{{ x.n }}</td>
                <td class="num" :class="tone(x.prob)">{{ x.prob }}%</td>
                <td class="num">{{ pct(x.median) }}</td>
                <td class="num">{{ pct(x.worst) }}</td>
                <td class="num">{{ x.beatN ? x.beat + '/' + x.beatN : '–' }}</td>
                <td class="small">{{ x.broker }}</td>
                <td class="small">
                  <div v-for="k in x.katalis" :key="k.tanggal + k.jenis">Akan datang: {{ k.jenis }} {{ k.tanggal }}</div>
                  <div v-for="a in x.alasan" :key="a" class="muted">{{ a }}</div>
                </td>
                <td class="small nowrap">
                  <template v-if="x.plan">Beli {{ rpr(x.plan.entry) }}<br><span class="c-strong">SL {{ rp(x.plan.sl) }}</span> · <span class="c-good">TP {{ rp(x.plan.tp1) }}/{{ rp(x.plan.tp2) }}</span></template>
                  <span v-else class="muted">harga belum tersedia</span>
                </td>
                <td class="num"><b>{{ x.skor }}</b></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.sz header{margin-bottom:8px}
.ctl{display:flex;gap:12px;flex-wrap:wrap;justify-content:space-between;align-items:center}
.bln{display:flex;gap:4px;flex-wrap:wrap}
.big{font-size:18px;margin:4px 0 10px}.big b{font-size:28px}
.months{display:grid;grid-template-columns:repeat(12,1fr);gap:6px}
.mo{display:flex;flex-direction:column;align-items:center;gap:2px;background:none;border:1px solid transparent;padding:4px 0;cursor:pointer;font:inherit;color:inherit}
.mo.on{border-color:var(--now-ink)}
.mo .bar{height:60px;width:60%;background:var(--rule);display:flex;align-items:flex-end}
.mo .bar i{display:block;width:100%;background:var(--strong)}.mo .bar i.c-good{background:var(--good)}.mo .bar i:not(.c-good):not(.c-strong){background:var(--warn,#c79a1a)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.card{display:flex;flex-direction:column;gap:3px;border:1px solid var(--rule);border-top:4px solid var(--good);padding:10px 12px;background:var(--sheet);color:inherit;text-decoration:none}
.ch{display:flex;justify-content:space-between;align-items:baseline}.ch b{font-size:20px}.skor{font-weight:700;color:var(--good)}
.sek{display:grid;gap:6px;max-width:760px}
.sr{display:grid;grid-template-columns:190px 1fr 50px 110px;gap:10px;align-items:center}
.track{height:12px;background:var(--rule);border-radius:6px;overflow:hidden}.track i{display:block;height:100%;background:var(--strong)}.track i.c-good{background:var(--good)}.track i:not(.c-good):not(.c-strong){background:var(--warn,#c79a1a)}
.tag{margin-left:6px}
.tp{display:grid;grid-template-columns:auto 1fr;gap:1px 8px;margin:6px 0 0;font-size:12px}.tp dt{color:var(--muted)}.tp dd{margin:0;font-weight:600}
.nowrap{white-space:nowrap}
@media (max-width:700px){.months{grid-template-columns:repeat(6,1fr)}.sr{grid-template-columns:1fr 1fr 44px}.sr .small{display:none}}
</style>
