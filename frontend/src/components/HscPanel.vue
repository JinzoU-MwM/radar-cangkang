<script setup>
// HSC: daftar saham High Shareholding Concentration (kepemilikan terkonsentrasi tinggi) dari hsc.json,
// urut alfabet. Saham HSC dikeluarkan dari perhitungan IHSG namun tetap diperdagangkan di BEI.
// Di atasnya analisa dampak ke IHSG yang dihitung server (/api/hsc-analisa): penggerak baru & kontribusi poin,
// skenario big-4 bank, keranjang HSC vs non-HSC, arus asing, kesimpulan; dapat diunduh sebagai PDF riset.
import { computed, ref } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import HargaSaham from './HargaSaham.vue'

const cari = ref('')
const hsc = computed(() => store.hsc || { kode: [] })
// Urut alfabet; pencarian mencocokkan kode atau nama perusahaan.
const daftar = computed(() => {
  const q = cari.value.trim().toUpperCase()
  return [...(hsc.value.kode || [])].sort()
    .map(t => ({ t, nama: hsc.value.nama?.[t] || '', baru: hsc.value.baru?.[t] || '' }))
    .filter(x => !q || x.t.includes(q) || x.nama.toUpperCase().includes(q))
})

// Teks sumber (fakta & implikasi) dari hsc.json; angka analisa dihitung server.
const an = computed(() => hsc.value.analisa || null)
const a = ref(null), err = ref('')
async function load() {
  try {
    const r = await api.get('/api/hsc-analisa')
    if (r.error) err.value = r.error; else { a.value = r; err.value = '' }
  } catch (e) { err.value = e.message || String(e) }
}
load()

const id = (v, n = 2) => v == null ? '–' : (+v).toLocaleString('id-ID', { minimumFractionDigits: n, maximumFractionDigits: n })
const pct = v => v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + id(Math.abs(v), 1) + '%'
const poin = v => v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + id(Math.abs(v), 1)
const nada = v => v == null ? 'muted' : v > 0 ? 'c-good' : v < 0 ? 'c-strong' : 'muted'
const miliar = v => v == null ? '–' : (v < 0 ? '−' : '+') + 'Rp' + id(Math.abs(v) / 1e9, 1) + ' M'
const PER = [['d', '1D'], ['w', '1W'], ['m', '1M']]

// Unduh riset (PDF, format sama dengan riset IHSG): analisa & harga diambil ulang agar data terbaru.
const busy = ref(false), errPdf = ref('')
async function unduh() {
  busy.value = true; errPdf.value = ''
  try {
    const [{ jsPDF }, mod] = await Promise.all([import('jspdf'), import('../lib/hscPdf.js')])
    await load()
    let hg = {}
    try { const r = await api.get('/api/harga-saham'); if (!r.error) hg = r } catch { /* tanpa harga: tabel menampilkan "-" */ }
    ;(await mod.hscPdf(a.value, hsc.value, hg, jsPDF)).save(mod.hscPdfName())
  } catch (e) { errPdf.value = 'PDF gagal dibuat: ' + (e.message || e) } finally { busy.value = false }
}
</script>

<template>
  <section>
    <p class="small muted intro">Saham <b>HSC</b> (High Shareholding Concentration): kepemilikan saham terkonsentrasi pada sedikit pihak.
      Mulai <b>{{ hsc.berlaku || '2 November 2026' }}</b> saham HSC dikeluarkan dari perhitungan IHSG, tetapi tetap tercatat dan dapat
      diperdagangkan di BEI. {{ hsc.evaluasi }}</p>
    <div class="unduh">
      <span v-if="errPdf" class="small c-strong">{{ errPdf }}</span>
      <button type="button" class="btn" :disabled="busy || !a" @click="unduh">{{ busy ? 'Menyiapkan PDF…' : '⬇ Unduh riset HSC (PDF)' }}</button>
    </div>

    <!-- Analisa dampak pengecualian HSC terhadap IHSG (angka dihitung dari data situs) -->
    <article v-if="an" class="an">
      <h2>{{ an.judul }}</h2>
      <p>{{ an.ringkas }}</p>
      <p v-if="err" class="small muted">{{ err }}</p>
      <template v-if="a">
        <div class="kpi">
          <div><span class="small muted">IHSG ({{ a.ihsgSumber }})</span><b>{{ id(a.ihsg, 0) }}</b></div>
          <div><span class="small muted">Bobot big-4 bank</span><b>{{ id(a.bank4.dari) }}% → {{ id(a.bank4.ke) }}%</b></div>
          <div><span class="small muted">1% gerak big-4 bank</span><b>≈ {{ id(a.bank4.sens, 1) }} poin</b></div>
          <div><span class="small muted">Big-4 bank 1W (tertimbang)</span><b :class="nada(a.bank4.ret?.['1W'])">{{ pct(a.bank4.ret?.['1W']) }}</b></div>
        </div>

        <h3>Kesimpulan</h3>
        <ul class="ks">
          <li v-for="k in a.kesimpulan" :key="k.teks"><span class="dot" :class="k.nada === 'naik' ? 'bg-good' : k.nada === 'turun' ? 'bg-strong' : 'bg-muted'"></span>{{ k.teks }}</li>
        </ul>

        <h3>Penggerak baru <span class="muted small">(bobot estimasi; poin = bobot × perubahan harga × IHSG)</span></h3>
        <div class="scroll">
          <table class="ledger">
            <thead><tr><th>Saham</th><th class="num">Harga</th><th class="num">Bobot</th>
              <th v-for="[k, l] in PER" :key="k" class="num">{{ l }}</th><th class="num">Poin 1W</th><th class="num">Poin 1M</th><th class="num">Asing (bln {{ a.bulanBroker || '–' }})</th></tr></thead>
            <tbody>
              <tr v-for="x in a.penggerak" :key="x.t">
                <td><b>{{ x.t }}</b><span v-if="x.turunan" class="muted" title="Bobot diturunkan dari total big-4 bank dikurangi tiga bank lain">*</span></td>
                <td class="num"><HargaSaham :kode="x.t" /></td>
                <td class="num">{{ id(x.dari) }}% → <b>{{ id(x.ke) }}%</b></td>
                <td v-for="[k] in PER" :key="k" class="num" :class="nada(x.ret[k])">{{ pct(x.ret[k]) }}</td>
                <td class="num" :class="nada(x.poin.w)" :title="`Dengan bobot lama: ${poin(x.poinLama.w)}`">{{ poin(x.poin.w) }}</td>
                <td class="num" :class="nada(x.poin.m)" :title="`Dengan bobot lama: ${poin(x.poinLama.m)}`">{{ poin(x.poin.m) }}</td>
                <td class="num" :class="nada(x.arus?.asing)">{{ x.arus ? miliar(x.arus.asing) : '–' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="ag">
          <div>
            <h3>Skenario big-4 bank</h3>
            <table class="ledger">
              <thead><tr><th>Gerak big-4</th><th class="num">Dampak</th><th class="num">Level IHSG</th></tr></thead>
              <tbody><tr v-for="s in a.skenario" :key="s.gerak">
                <td>{{ s.gerak > 0 ? '+' : '' }}{{ s.gerak }}%</td><td class="num" :class="nada(s.poin)">{{ poin(s.poin) }} poin</td><td class="num">{{ id(s.level, 0) }}</td>
              </tr></tbody>
            </table>
          </div>
          <div>
            <h3>Saham HSC vs non-HSC <span class="muted small">(median)</span></h3>
            <table class="ledger">
              <thead><tr><th>Periode</th><th class="num">HSC</th><th class="num">Non-HSC</th><th class="num">HSC naik</th></tr></thead>
              <tbody><tr v-for="p in ['1D', '1W', '1M', 'YTD']" :key="p">
                <td>{{ p }}</td>
                <td class="num" :class="nada(a.keranjang.hsc[p]?.median)">{{ pct(a.keranjang.hsc[p]?.median) }}</td>
                <td class="num" :class="nada(a.keranjang.non[p]?.median)">{{ pct(a.keranjang.non[p]?.median) }}</td>
                <td class="num">{{ a.keranjang.hsc[p]?.naik ?? '–' }}%</td>
              </tr></tbody>
            </table>
            <p class="small"><span class="muted">Paling turun 1M:</span> <span v-for="x in a.terburuk" :key="x.t" class="chip">{{ x.t }} <span :class="nada(x.m)">{{ pct(x.m) }}</span></span></p>
            <p class="small"><span class="muted">Paling naik 1M:</span> <span v-for="x in a.terbaik" :key="x.t" class="chip">{{ x.t }} <span :class="nada(x.m)">{{ pct(x.m) }}</span></span></p>
            <p v-if="a.sorot?.length" class="small"><span class="muted">Bobot besar:</span> <span v-for="x in a.sorot" :key="x.t" class="chip">{{ x.t }} <span :class="nada(x.m)">{{ pct(x.m) }}</span></span></p>
          </div>
        </div>
      </template>

      <details class="sumber">
        <summary class="small">Catatan sumber (fakta kunci &amp; implikasi)</summary>
        <div class="ag">
          <div><h3>Fakta kunci</h3><ul class="small"><li v-for="f in an.fakta" :key="f">{{ f }}</li></ul></div>
          <div><h3>Implikasi</h3><ul class="small"><li v-for="f in an.implikasi" :key="f">{{ f }}</li></ul></div>
        </div>
      </details>
      <p class="small muted">{{ an.catatan }} Data harga per {{ a?.updated || '–' }}<template v-if="a?.ihsgWaktu">, IHSG {{ a.ihsgWaktu }}</template>.</p>
    </article>

    <div class="mh">
      <h2>Daftar saham HSC</h2>
      <span class="small muted">{{ (hsc.kode || []).length }} saham, urut alfabet · per {{ hsc.tanggal || '–' }}</span>
    </div>
    <div class="flt">
      <input v-model="cari" type="search" class="cari" placeholder="Cari kode atau nama perusahaan" aria-label="Cari saham HSC">
      <span v-if="cari" class="small muted">{{ daftar.length }} cocok</span>
    </div>
    <div class="scroll">
      <table class="ledger">
        <thead><tr><th class="num">No</th><th>Kode</th><th>Nama perusahaan</th><th class="num">Harga</th><th>Keterangan</th></tr></thead>
        <tbody>
          <tr v-for="(x, i) in daftar" :key="x.t">
            <td class="num muted">{{ i + 1 }}</td>
            <td><RouterLink :to="{ path: '/emiten/' + x.t, query: { tab: 'analisa' } }"><b>{{ x.t }}</b></RouterLink></td>
            <td>{{ x.nama || '–' }}</td>
            <td class="num"><HargaSaham :kode="x.t" /></td>
            <td class="small"><span v-if="x.baru" class="tag t-warn">Baru</span> <span class="muted">{{ x.baru }}</span></td>
          </tr>
          <tr v-if="!daftar.length"><td colspan="5" class="muted">Tidak ada saham yang cocok.</td></tr>
        </tbody>
      </table>
    </div>
    <p class="small muted src">Sumber: <a v-if="hsc.url" :href="hsc.url" target="_blank" rel="noopener">{{ hsc.sumber }}</a><span v-else>{{ hsc.sumber }}</span>
      <template v-for="s in hsc.sumberLain || []" :key="s.url"> · <a :href="s.url" target="_blank" rel="noopener">{{ s.judul }}</a></template></p>
  </section>
</template>

<style scoped>
.intro{max-width:120ch;margin:6px 0 10px}
.unduh{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin:0 0 10px}
.mh{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.mh h2{margin:6px 0}
.flt{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px}
.cari{min-width:260px;max-width:100%;padding:6px 10px;border:1px solid var(--rule);border-radius:8px;background:var(--sheet);color:inherit}
.scroll{overflow-x:auto}
.src{margin-top:10px;max-width:120ch}
.an{border:1px solid var(--rule);border-radius:10px;padding:12px 14px;margin:6px 0 14px;background:var(--sheet)}
.an h2{margin:0 0 4px}.an h3{margin:14px 0 6px;font-size:1rem}.an ul{margin:0;padding-left:18px}.an li{margin:2px 0}
.ag{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:4px 22px}
.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin:10px 0 4px}
.kpi>div{border:1px solid var(--rule);border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:2px}
.kpi b{font-size:1.15rem}
.ks{list-style:none;padding-left:0 !important}.ks li{display:flex;gap:8px;align-items:baseline;margin:4px 0}
.dot{flex:0 0 8px;height:8px;border-radius:50%;transform:translateY(-1px)}
.bg-good{background:var(--good)}.bg-strong{background:var(--strong)}.bg-muted{background:var(--ink-2)}
.chip{display:inline-block;margin:2px 6px 2px 0;white-space:nowrap}
.sumber{margin-top:12px}.sumber summary{cursor:pointer}
</style>
