<script setup>
// Alat interaktif di presentasi Wawasan: simulasi order book rekaan (antrean tebal ditarik sebelum tersentuh) dan
// kalkulator ukuran posisi dari rugi yang rela ditanggung. Logika di lib/wawasanSlide.js.
import { computed, ref } from 'vue'
import { LANGKAH_OB, lotRisiko } from '../lib/wawasanSlide.js'

defineProps({ nama: { type: String, required: true } })

// Order book: lima harga beli di bawah harga terakhir, antrean Rp150 tebal sampai ditarik.
const n = ref(0)
const kini = computed(() => LANGKAH_OB[n.value])
const BID = { 152: 1200, 151: 900, 150: 80000, 149: 1500, 148: 700, 147: 1100, 146: 2400, 145: 900 }
const baris = computed(() => {
  const h = kini.value.harga
  // Tangga harga tetap (Rp152 sampai Rp145) supaya baris Rp150 tetap terlihat; harga yang sudah dilewati dipudarkan.
  return [152, 151, 150, 149, 148, 147, 146, 145].map(p => ({ p, lot: BID[p], tebal: p === 150 && kini.value.tebal, hilang: p === 150 && !kini.value.tebal, lewat: p >= h && p !== 150 }))
})
const lebar = lot => Math.max(4, Math.min(100, lot / 800))
const rp = v => v.toLocaleString('id-ID')

// Kalkulator ukuran posisi (angka awal rekaan).
const modal = ref(100_000_000), risiko = ref(1), beli = ref(200), stop = ref(188)
const hasil = computed(() => lotRisiko({ modal: modal.value, risiko: risiko.value, beli: beli.value, stop: stop.value }))
</script>

<template>
  <div v-if="nama === 'orderbook'" class="ob">
    <div class="papan">
      <div class="hrg">Harga terakhir <b>Rp{{ kini.harga }}</b></div>
      <table>
        <thead><tr><th>Bid</th><th>Lot</th><th></th></tr></thead>
        <tbody>
          <tr v-for="b in baris" :key="b.p" :class="{ tebal: b.tebal, hilang: b.hilang, lewat: b.lewat }">
            <td>{{ b.p }}</td><td>{{ b.hilang ? 'ditarik' : rp(b.lot) }}</td>
            <td class="bar"><i :style="{ width: (b.hilang ? 0 : lebar(b.lot)) + '%' }"></i></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="cerita" :class="{ bahaya: n >= 3 }" aria-live="polite">{{ kini.ket }}</p>
    <div class="aksi">
      <button v-if="n < LANGKAH_OB.length - 1" type="button" class="maju" @click="n++">Lanjut ({{ n + 1 }}/{{ LANGKAH_OB.length }})</button>
      <button v-else type="button" class="maju" @click="n = 0">Ulangi</button>
    </div>
  </div>

  <div v-else-if="nama === 'kalkulator'" class="kal">
    <label>Modal (Rp)<input v-model.number="modal" type="number" min="0" step="1000000" /></label>
    <label><span>Rugi yang rela ditanggung: <b>{{ String(risiko).replace('.', ',') }}%</b> dari modal</span><input v-model.number="risiko" type="range" min="0.25" max="5" step="0.25" /></label>
    <div class="dua">
      <label>Harga beli<input v-model.number="beli" type="number" min="1" /></label>
      <label>Stop<input v-model.number="stop" type="number" min="1" /></label>
    </div>
    <div v-if="hasil" class="out">
      <p>Boleh beli <b>{{ rp(hasil.lot) }} lot</b> (nilai Rp{{ rp(hasil.nilai) }}).</p>
      <p>Kalau stop kena, rugi sekitar <b>Rp{{ rp(Math.round(hasil.rugi)) }}</b>. Batasnya Rp{{ rp(Math.round(hasil.rugiMaks)) }}.</p>
      <p class="kecil">Jarak stop {{ hasil.persenStop.toFixed(1).replace('.', ',') }}% dari harga beli. Stop makin jauh, lot makin sedikit, ruginya tetap sama.</p>
    </div>
    <p v-else class="out bahaya">Stop harus di bawah harga beli dan semua angka harus lebih dari nol.</p>
    <p class="kecil">Belum termasuk komisi dan pajak. Angka awal hanya contoh.</p>
  </div>
</template>

<style scoped>
.ob,.kal{display:grid;gap:10px;font-size:13px;cursor:default}
.papan{background:var(--sheet-2);border-radius:10px;padding:10px 12px}
.hrg{font-size:13px;color:var(--ink-2);margin-bottom:6px}
.hrg b{font:700 16px var(--f-data);color:var(--ink)}
table{width:100%;border-collapse:collapse;font-family:var(--f-data);font-size:13px}
th{text-align:left;color:var(--ink-2);font-weight:600;padding:3px 6px}
td{padding:4px 6px;border-top:1px solid var(--rule-2);transition:background .3s,color .3s}
td.bar{width:55%}
.bar i{display:block;height:9px;border-radius:3px;background:var(--good);transition:width .5s}
tr.tebal td{background:var(--good-bg);font-weight:700}
tr.hilang td{color:var(--strong);font-style:italic;background:var(--strong-bg)}
tr.lewat td{opacity:.35}
.cerita{margin:0;line-height:1.5;min-height:3em}
.bahaya{color:var(--strong)}
.aksi{display:flex;gap:6px}
.maju{border:0;background:var(--accent);color:var(--sheet);border-radius:8px;padding:6px 14px;font:700 13px var(--f-body);cursor:pointer}
.kal label{display:grid;gap:4px;font-weight:600;color:var(--ink-2)}
.kal input[type=number]{font:14px var(--f-data);padding:6px 8px;border:1px solid var(--rule);border-radius:6px;background:var(--sheet);color:var(--ink)}
.kal input[type=range]{accent-color:var(--accent)}
.dua{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.out{background:var(--accent-soft);border-radius:8px;padding:8px 12px;margin:0}
.out p{margin:0 0 4px;line-height:1.5}
.out b{font-family:var(--f-data)}
.kecil{font-size:12px;color:var(--ink-2);margin:0}
</style>
