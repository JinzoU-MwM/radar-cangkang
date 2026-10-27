<script setup>
// POV: pola pikir akun Stockbit prioritas + trending (dari posting ide publik), konsensus saham yang diincar,
// dicocokkan dengan sikap analis radar; ditambah ringkasan metode KakdrWay (kakdr.com).
import { computed, onMounted, ref } from 'vue'
import { api, loadJson } from '../api.js'
import { store } from '../store.js'
import { fmt, fmtDate } from '../lib/domain.js'
import SikapTag from '../components/SikapTag.vue'
import PovDetail from '../components/PovDetail.vue'

const data = ref(null), err = ref(''), kd = ref(null)
// Analisa KakdrWay disembunyikan sampai tombolnya diklik.
const kdOpen = ref(false)
// POV dan KakdrWay dimuat paralel: tombol KakdrWay tidak menunggu data POV.
onMounted(() => {
  api.get('/api/pov').then(v => { data.value = v }, e => { err.value = e.message })
  loadJson('kakdrway.json').then(v => { kd.value = v }, () => {})
})
const sikap = t => store.pandangan?.[t]?.sikap || ''
// Rekomendasi cara membaca konsensus terhadap sikap analis radar.
function saran(a) {
  const s = sikap(a.t)
  if (!a.radar || !s) return a.nada === 'bullish' ? 'Ramai dibahas bullish: cek fundamental dan dokumen sebelum ikut.' : 'Pantau; belum ada analisa radar.'
  if (/hindari/i.test(s) && a.nada === 'bullish') return 'Waspada euforia: banyak yang bullish, tetapi analisa radar menilai Hindari.'
  if (/asimetri/i.test(s) && a.nada === 'bullish') return 'Konfirmasi: pandangan akun sejalan dengan analisa radar.'
  if (a.nada === 'bearish') return 'Sentimen akun bearish: tunggu konfirmasi sebelum masuk.'
  return 'Bandingkan alasan akun dengan analisa radar.'
}
// Ringkasan pola pikir satu akun (kalimat baku dari data posting).
function pola(u) {
  const [s1, s2] = u.styles
  const out = []
  if (s1?.n) out.push(`Gaya dominan ${s1.k.toLowerCase()} (${s1.pct}% posting)${s2?.n ? `, diikuti ${s2.k.toLowerCase()} (${s2.pct}%)` : ''}.`)
  if (u.horizon) out.push(`Horizon cenderung ${u.horizon}.`)
  out.push(u.avgChars < 90 ? 'Posting singkat: lebih banyak sinyal dan kode saham daripada argumen.' : u.avgChars > 600 ? 'Posting panjang: argumen dan data diuraikan rinci.' : 'Posting sedang: sinyal disertai alasan singkat.')
  if (u.radarHits.length) out.push(`Membahas ${u.radarHits.length} saham radar backdoor: ${u.radarHits.slice(0, 5).join(', ')}.`)
  return out
}
const users = computed(() => data.value?.users || [])
// Akun yang detailnya sedang dibuka (klik kartu).
const buka = ref(null)
</script>

<template>
  <div class="pov">
    <header>
      <h1>POV</h1>
      <p class="muted small">Pola pikir akun Stockbit prioritas dan trending dari posting ide publik {{ data?.asOf ? '· diperbarui ' + fmtDate(String(data.asOf).slice(0, 10)) : '' }}. Bukan rekomendasi beli/jual.</p>
    </header>
    <p v-if="err" class="muted">Gagal memuat POV: {{ err }}</p>
    <p v-else-if="!data" class="muted">Memuat…</p>
    <p v-else-if="!users.length" class="muted">Data POV sedang disiapkan server; coba lagi beberapa menit lagi.</p>

    <section v-if="data?.consensus?.length" class="rule-top">
      <h2>Konsensus saham yang diincar</h2>
      <div class="scroll">
        <table class="ledger">
          <thead><tr><th>Saham</th><th class="num">Akun</th><th class="num">Sebutan</th><th>Nada</th><th>Analisa radar</th><th>Rekomendasi analisa</th></tr></thead>
          <tbody>
            <tr v-for="a in data.consensus" :key="a.t">
              <td><RouterLink v-if="a.radar" :to="'/emiten/' + a.t" class="ticker">{{ a.t }}</RouterLink><b v-else>{{ a.t }}</b></td>
              <td class="num" :title="a.users.join(', ')">{{ a.users.length }}</td>
              <td class="num">{{ a.n }}</td>
              <td><span class="tag" :class="a.nada === 'bullish' ? 't-good' : a.nada === 'bearish' ? 't-strong' : 't-calm'">{{ a.nada }}</span></td>
              <td><SikapTag v-if="sikap(a.t)" :sikap="sikap(a.t)" /><span v-else class="muted small">bukan radar</span></td>
              <td class="small">{{ saran(a) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="users.length" class="rule-top">
      <h2>Pola pikir per akun</h2>
      <div class="cards">
        <article v-for="u in users" :key="u.username" class="card klik" tabindex="0" role="button" :aria-label="'Detail akun ' + u.username" @click="buka = u" @keydown.enter.self="buka = u">
          <div class="ch">
            <a :href="u.url" target="_blank" rel="noopener" @click.stop><b>@{{ u.username }}</b></a>
            <span v-if="u.priority" class="tag t-now">prioritas</span><span v-if="u.trending" class="tag t-warn">trending</span>
            <span v-if="u.hit?.rate != null" class="tag" :class="u.hit.rate >= 60 ? 't-good' : u.hit.rate >= 40 ? 't-calm' : 't-strong'">ketepatan {{ u.hit.rate }}%</span>
            <span class="small muted more">Klik untuk detail ›</span>
          </div>
          <p class="small muted">{{ u.posts }} posting ide ({{ u.from ? fmtDate(u.from) : '–' }} – {{ u.to ? fmtDate(u.to) : '–' }}) · {{ fmt(u.perDay, 1) }}/hari · rata-rata {{ fmt(u.avgLikes, 0) }} suka<template v-if="u.followers"> · {{ fmt(u.followers, 0) }} pengikut</template><template v-if="u.terbatas"> · data terbatas (posting terbaru saja)</template></p>
          <ul class="small pola"><li v-for="x in pola(u)" :key="x">{{ x }}</li></ul>
          <div class="sty">
            <span v-for="s in u.styles.filter(x => x.n)" :key="s.k" class="st"><i :style="{ width: Math.max(4, s.pct) + '%' }"></i>{{ s.k }} {{ s.pct }}%</span>
          </div>
          <h4>Saham incaran</h4>
          <div class="tk">
            <span v-for="e in u.tickers.slice(0, 8)" :key="e.t" class="tag" :class="e.nada === 'bullish' ? 't-good' : e.nada === 'bearish' ? 't-strong' : 't-calm'" :title="e.sample">
              <RouterLink v-if="e.radar" :to="'/emiten/' + e.t" @click.stop>{{ e.t }}</RouterLink><template v-else>{{ e.t }}</template> ×{{ e.n }}
            </span>
          </div>
          <details v-if="u.latest.length" class="small" @click.stop>
            <summary>Posting terbaru</summary>
            <ul><li v-for="p in u.latest" :key="p.url"><a :href="p.url" target="_blank" rel="noopener">{{ fmtDate(p.d) }}</a> · {{ p.text }}</li></ul>
          </details>
        </article>
      </div>
    </section>

    <PovDetail v-if="buka" :u="buka" @close="buka = null" />

    <section class="rule-top">
      <h2>Rekomendasi analisa terbaik</h2>
      <ol class="small rek">
        <li>Jadikan konsensus akun sebagai <b>radar ide</b>, bukan alasan membeli: saham yang ramai dibahas sering sudah naik lebih dulu.</li>
        <li>Akun bergaya momentum/scalping cocok untuk membaca arus jangka pendek; akun bergaya fundamental dan aksi korporasi lebih relevan untuk saham backdoor yang bergantung pada dokumen.</li>
        <li>Untuk saham radar, cocokkan nada akun dengan <b>kewajaran aset dan dokumen keterbukaan</b> di tab Analisa: bila akun bullish tetapi analisa radar Hindari, perlakukan sebagai tanda euforia.</li>
        <li>Perhatikan ketika beberapa akun prioritas berbalik bearish bersamaan pada saham yang sama: sering menjadi tanda distribusi.</li>
        <li>Terapkan disiplin dana ala KakdrWay: uang dingin, semampu siap hilang, dan masuk bertahap.</li>
      </ol>
    </section>

    <section v-if="kd" class="rule-top">
      <button type="button" class="btn kdbtn" :aria-expanded="String(kdOpen)" aria-controls="kd-isi" @click="kdOpen = !kdOpen">
        Analisa KakdrWay <span class="muted">({{ kd.julukan }})</span> <span aria-hidden="true">{{ kdOpen ? '▴' : '▾' }}</span>
      </button>
      <div v-if="kdOpen" id="kd-isi">
      <div class="kd">
        <div>
          <h4>Screening standar</h4>
          <dl><div v-for="x in kd.screening" :key="x.k"><dt>{{ x.k }}</dt><dd class="small">{{ x.isi }}</dd></div></dl>
          <p class="small muted">{{ kd.skor }}</p>
        </div>
        <div>
          <h4>Pengelolaan posisi</h4>
          <ul class="small"><li v-for="x in kd.kelola" :key="x">{{ x }}</li></ul>
          <h4>Siklus dividen 4-4-4</h4>
          <ul class="small"><li v-for="x in kd.siklus444" :key="x.fase"><b>{{ x.fase }}:</b> {{ x.isi }}</li></ul>
        </div>
      </div>
      <h4>Relevansi terhadap saham backdoor</h4>
      <ul class="small"><li v-for="x in kd.terhadapBackdoor" :key="x">{{ x }}</li></ul>
      <h4>Artikel</h4>
      <ul class="small"><li v-for="a in kd.artikel" :key="a.url"><a :href="a.url" target="_blank" rel="noopener">{{ a.judul }}</a> <span class="muted">· {{ fmtDate(a.d) }}</span></li></ul>
      </div>
    </section>
  </div>
</template>

<style scoped>
.pov{display:flex;flex-direction:column;gap:14px}
header h1{margin:0}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}
.card{border:1px solid var(--rule);background:var(--sheet);padding:12px 14px;display:flex;flex-direction:column;gap:6px}
.card.klik{cursor:pointer;transition:box-shadow .2s,border-color .2s}.card.klik:hover,.card.klik:focus-visible{border-color:var(--now-ink);box-shadow:0 2px 10px rgba(0,0,0,.08)}
.more{margin-left:auto}
.ch{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.pola{margin:0;padding-left:18px}
.sty{display:flex;flex-direction:column;gap:3px}
.st{position:relative;font-size:11.5px;padding:1px 6px;z-index:0}
.st i{position:absolute;left:0;top:0;bottom:0;background:var(--sheet-2);z-index:-1}
.tk{display:flex;flex-wrap:wrap;gap:5px}
h4{margin:6px 0 2px;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.num{text-align:right}
.rek{padding-left:20px;display:flex;flex-direction:column;gap:4px;max-width:100ch}
.kdbtn{font-weight:700;margin-bottom:8px}
.kd{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
.kd dl div{margin-bottom:6px}
.kd dt{font-weight:700;font-size:13px}
.kd dd{margin:0}
</style>
