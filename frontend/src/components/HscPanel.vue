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
</script>

<template>
  <section>
    <p class="small muted intro">Saham <b>HSC</b> (High Shareholding Concentration): kepemilikan saham terkonsentrasi pada sedikit pihak.
      Mulai <b>{{ hsc.berlaku || '2 November 2026' }}</b> saham HSC dikeluarkan dari perhitungan IHSG, tetapi tetap tercatat dan dapat
      diperdagangkan di BEI. {{ hsc.evaluasi }}</p>
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
</style>
