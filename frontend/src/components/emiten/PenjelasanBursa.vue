<script setup>
// Analisa tanggapan emiten atas permintaan penjelasan BEI yang terakhir (ri-dokumen.json → penjelasanBursa):
// tiap pertanyaan, jawaban emiten, kelengkapan jawabannya, dan analisa, ditutup kesimpulan dampak.
import { fmtDate, PB_JAWABAN, PB_KRITERIA } from '../../lib/domain.js'
import { computed } from 'vue'
const props = defineProps({ pb: { type: Object, required: true } })
// Nomor pertanyaan BEI (1a, 2b, ...) bila datanya tersedia.
const adaNo = computed(() => (props.pb.poin || []).some(x => x.no))
const n = x => PB_JAWABAN[x] || PB_JAWABAN.sebagian
</script>

<template>
  <section class="pb rule-top">
    <h2 class="lbl">Analisa penjelasan atas permintaan penjelasan bursa (terakhir)</h2>
    <p class="small muted">
      {{ pb.tanggal ? fmtDate(pb.tanggal) : '' }} · {{ pb.judul }}
      <a v-if="/^https:\/\/(emitten-announcement\.stockbit\.com|www\.idx\.co\.id\/StaticData)\//.test(pb.url || '')" :href="pb.url" target="_blank" rel="noopener">PDF</a>
    </p>
    <p v-if="pb.ringkas" class="lead">{{ pb.ringkas }}</p>
    <div class="scroll">
      <table class="ledger">
        <thead><tr><th v-if="adaNo">No</th><th>Topik</th><th>Pertanyaan BEI</th><th>Jawaban emiten</th><th>Kelengkapan jawaban</th><th>Analisa</th></tr></thead>
        <tbody>
          <tr v-for="(x, i) in pb.poin || []" :key="i">
            <td v-if="adaNo" class="num">{{ x.no }}</td>
            <td><b>{{ x.topik }}</b></td>
            <td class="small">{{ x.tanya }}</td>
            <td class="small">{{ x.jawab }}</td>
            <td><span class="tag" :class="'t-' + n(x.jawaban)[1]">{{ n(x.jawaban)[0] }}</span><div v-if="x.kurang" class="dasar">{{ x.kurang }}</div></td>
            <td class="small">{{ x.analisa }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="small muted">{{ PB_KRITERIA }}</p>
    <p v-if="pb.kesimpulan" class="kes" :class="'k-' + (pb.dampak || 'netral')"><b>Kesimpulan:</b> {{ pb.kesimpulan }}</p>
  </section>
</template>

<style scoped>
.pb{margin-bottom:14px}
.lead{font-weight:600;max-width:100ch;margin:6px 0}
.pb td{vertical-align:top}
.dasar{font-size:11px;color:var(--muted);margin-top:4px;min-width:150px}
.kes{margin:10px 0 0;padding:10px 12px;border:1px solid var(--rule);border-left:4px solid var(--rule-2);background:var(--sheet);max-width:100ch}
.k-negatif{border-left-color:var(--strong)} .k-positif{border-left-color:var(--good)}
</style>
