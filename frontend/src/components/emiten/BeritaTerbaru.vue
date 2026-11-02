<script setup>
// Analisa otomatis laporan/berita TERBARU emiten ini (lib/beritaTerbaru.js), lengkap dengan unduhan PDF berformat
// riset Seasonality. Diperbarui sendiri setiap sinkron berita server (tiap 2 jam); hanya dokumen terakhir yang dianalisa.
import { computed, ref } from 'vue'
import { store } from '../../store.js'
import { fmtDate } from '../../lib/domain.js'
import { beritaTerakhir, analisaBerita } from '../../lib/beritaTerbaru.js'

const props = defineProps({ ticker: { type: String, required: true } })
const a = computed(() => analisaBerita(beritaTerakhir(store.updates, props.ticker), { items: store.items, pandangan: store.pandangan }))
const busy = ref(false), err = ref('')
async function unduh() {
  busy.value = true; err.value = ''
  try {
    const [{ jsPDF }, mod] = await Promise.all([import('jspdf'), import('../../lib/beritaPdf.js')])
    ;(await mod.beritaPdf(a.value, jsPDF)).save(mod.beritaPdfName(a.value))
  } catch (e) {
    err.value = 'PDF gagal dibuat: ' + (e.message || e)
  } finally {
    busy.value = false
  }
}
// Kelas tag global: t-good / t-warn / t-calm / t-strong (tidak ada t-bad).
const tag = c => 't-' + (c === 'bad' ? 'strong' : c)
const nadaCls = n => n > 0 ? 'c-good' : n < 0 ? 'c-strong' : 'muted'
const nadaTanda = n => n > 0 ? '▲' : n < 0 ? '▼' : '●'
</script>

<template>
  <section v-if="a" class="bt rule-top">
    <div class="hd">
      <h2 class="lbl">Analisa berita terbaru</h2>
      <span class="small muted">{{ a.laporan ? 'Keterbukaan resmi' : 'Berita media' }} · {{ fmtDate(a.tanggal) }} · {{ a.jenis }}</span>
      <button type="button" class="btn" :disabled="busy" @click="unduh">{{ busy ? 'Menyiapkan PDF…' : '⬇ Unduh analisa (PDF)' }}</button>
    </div>
    <p v-if="err" class="small c-strong">{{ err }}</p>

    <div class="top" :class="'k-' + a.dampak.cls">
      <div class="row">
        <a v-if="a.url" :href="a.url" target="_blank" rel="noopener"><b class="ttl">{{ a.judul }}</b></a><b v-else class="ttl">{{ a.judul }}</b>
        <span class="tag" :class="tag(a.sinyal.cls)">{{ a.sinyal.label }}</span>
        <span class="tag" :class="tag(a.dampak.cls)">Dampak bagi publik: {{ a.dampak.label }}</span>
      </div>
      <p class="small">{{ a.kesimpulan }}</p>
    </div>

    <div class="grid">
      <div class="card">
        <h3>Isi dokumen</h3>
        <p v-if="a.ringkas" class="small">{{ a.ringkas }}</p>
        <ul v-if="a.poin.length"><li v-for="p in a.poin" :key="p">{{ p }}</li></ul>
      </div>
      <div class="card">
        <h3>Dampak bagi pemegang saham publik</h3>
        <p class="small muted">{{ a.sinyal.why }}</p>
        <ul class="nd"><li v-for="x in a.dampak.alasan" :key="x.teks"><span :class="nadaCls(x.nada)">{{ nadaTanda(x.nada) }}</span> {{ x.teks }}</li></ul>
      </div>
      <div class="card">
        <h3>Kaitan dengan tesis</h3>
        <template v-if="a.tesis">
          <p class="small"><b>{{ a.tesis.sikap }}</b> · analisa per {{ fmtDate(a.tesis.asOf) }}</p>
          <p class="small">{{ a.tesis.ringkas }}</p>
          <p v-if="a.tesis.posisi" class="small muted">{{ a.tesis.posisi }}</p>
        </template>
        <p v-else class="small muted">{{ ticker }} belum memiliki analisa kurasi; dampak dinilai hanya dari isi dokumen.</p>
        <template v-if="a.fakta.length"><h3 class="sub">Fakta aset dan transaksi</h3><ul><li v-for="f in a.fakta" :key="f">{{ f }}</li></ul></template>
      </div>
      <div class="card">
        <h3>Yang dipantau</h3>
        <ul v-if="a.pantau.length"><li v-for="p in a.pantau" :key="p">{{ p }}</li></ul>
        <p v-else class="small muted">Keterbukaan berikutnya dari emiten.</p>
        <template v-if="a.salahBila.length"><h3 class="sub">Tesis salah bila</h3><ul><li v-for="p in a.salahBila" :key="p">{{ p }}</li></ul></template>
      </div>
    </div>
    <p class="small muted">Dibaca otomatis dari judul, ringkasan, dan poin kunci dokumen terakhir; diperbarui setiap sinkron berita. ▲ positif bagi pemegang saham publik, ▼ negatif atau risiko, ● perlu dicermati.</p>
  </section>
</template>

<style scoped>
.hd{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 12px;margin-bottom:8px}.hd .btn{margin-left:auto}.lbl{margin:0}
.top{border:1px solid var(--rule);border-left-width:4px;padding:10px 12px;background:var(--sheet);margin-bottom:10px}
.top.k-good{border-left-color:var(--good)}.top.k-bad{border-left-color:var(--strong)}.top.k-calm{border-left-color:var(--ink-2)}
.row{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:baseline}.ttl{font-size:15px}.top p{margin:6px 0 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}
.card{border:1px solid var(--rule);padding:10px 12px;background:var(--sheet)}
.card h3{font-size:12px;letter-spacing:.04em;text-transform:uppercase;margin:0 0 6px}.card h3.sub{margin-top:10px}
.card ul{margin:0;padding-left:18px}.card li{margin:2px 0}.nd{list-style:none;padding-left:0 !important}
</style>
