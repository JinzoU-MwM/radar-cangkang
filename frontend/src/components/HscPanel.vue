<script setup>
// HSC: daftar saham High Shareholding Concentration (kepemilikan terkonsentrasi tinggi) dari hsc.json,
// urut alfabet. Saham HSC dikeluarkan dari perhitungan IHSG namun tetap diperdagangkan di BEI.
import { computed, ref } from 'vue'
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
// Analisa dampak HSC ke IHSG (hsc.json "analisa"); poin IHSG per 1% gerak big-4 bank = bobot x basis / 100.
const an = computed(() => hsc.value.analisa || null)
const id = (v, n = 2) => v == null ? '–' : v.toLocaleString('id-ID', { minimumFractionDigits: n, maximumFractionDigits: n })
const poinBank = computed(() => an.value?.bank4 ? Math.round(an.value.bank4.ke * an.value.bank4.basis / 100 / 100 * 10) / 10 : null)
</script>

<template>
  <section>
    <p class="small muted intro">Saham <b>HSC</b> (High Shareholding Concentration): kepemilikan saham terkonsentrasi pada sedikit pihak.
      Mulai <b>{{ hsc.berlaku || '2 November 2026' }}</b> saham HSC dikeluarkan dari perhitungan IHSG, tetapi tetap tercatat dan dapat
      diperdagangkan di BEI. {{ hsc.evaluasi }}</p>
    <!-- Analisa dampak pengecualian HSC terhadap IHSG -->
    <article v-if="an" class="an">
      <h2>{{ an.judul }}</h2>
      <p>{{ an.ringkas }}</p>
      <div class="ag">
        <div>
          <h3>Fakta kunci</h3>
          <ul class="small"><li v-for="f in an.fakta" :key="f">{{ f }}</li></ul>
        </div>
        <div>
          <h3>Penggerak baru <span class="muted small">(estimasi bobot)</span></h3>
          <ul class="small">
            <li v-for="p in an.penggerak" :key="p.t"><b>{{ p.t }}</b> {{ id(p.dari) }}% → <b class="c-good">{{ id(p.ke) }}%</b>
              <span class="muted">(+{{ id(p.ke - p.dari) }} poin persen)</span></li>
            <li v-if="an.bank4">Bobot big-4 bank naik dari {{ id(an.bank4.dari) }}% ke <b>{{ id(an.bank4.ke) }}%</b>.</li>
            <li v-if="poinBank">Setiap 1% pergerakan big-4 bank ≈ <b>{{ id(poinBank, 1) }} poin IHSG</b>
              <span class="muted">(basis {{ an.bank4.basis.toLocaleString('id-ID') }})</span>.</li>
          </ul>
        </div>
        <div>
          <h3>Implikasi</h3>
          <ul class="small"><li v-for="f in an.implikasi" :key="f">{{ f }}</li></ul>
        </div>
      </div>
      <p v-if="an.catatan" class="small muted">{{ an.catatan }}</p>
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
.mh{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.mh h2{margin:6px 0}
.flt{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px}
.cari{min-width:260px;max-width:100%;padding:6px 10px;border:1px solid var(--rule);border-radius:8px;background:var(--sheet);color:inherit}
.scroll{overflow-x:auto}
.src{margin-top:10px;max-width:120ch}
.an{border:1px solid var(--rule);border-radius:10px;padding:12px 14px;margin:6px 0 14px;background:var(--sheet)}
.an h2{margin:0 0 4px}.an h3{margin:8px 0 4px;font-size:1rem}.an ul{margin:0;padding-left:18px}.an li{margin:2px 0}
.ag{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:4px 18px}
</style>
