<script setup>
// Analisa tanggapan emiten atas permintaan penjelasan BEI yang terakhir (ri-dokumen.json → penjelasanBursa):
// tiap pertanyaan, jawaban emiten, analisa, dan nadanya, ditutup kesimpulan dampak.
import { fmtDate } from '../../lib/domain.js'
defineProps({ pb: { type: Object, required: true } })
const NADA = { positif: ['Positif', 't-good'], netral: ['Netral', 't-calm'], negatif: ['Negatif', 't-strong'] }
const n = x => NADA[x] || NADA.netral
</script>

<template>
  <section class="pb rule-top">
    <h2 class="lbl">Analisa penjelasan atas permintaan penjelasan bursa (terakhir)</h2>
    <p class="small muted">
      {{ pb.tanggal ? fmtDate(pb.tanggal) : '' }} · {{ pb.judul }}
      <a v-if="/^https:\/\/emitten-announcement\.stockbit\.com\//.test(pb.url || '')" :href="pb.url" target="_blank" rel="noopener">PDF</a>
    </p>
    <p v-if="pb.ringkas" class="lead">{{ pb.ringkas }}</p>
    <div class="scroll">
      <table class="ledger">
        <thead><tr><th>Topik</th><th>Pertanyaan BEI</th><th>Jawaban emiten</th><th>Analisa</th><th>Nada</th></tr></thead>
        <tbody>
          <tr v-for="(x, i) in pb.poin || []" :key="i">
            <td><b>{{ x.topik }}</b></td>
            <td class="small">{{ x.tanya }}</td>
            <td class="small">{{ x.jawab }}</td>
            <td class="small">{{ x.analisa }}</td>
            <td><span class="tag" :class="n(x.nada)[1]">{{ n(x.nada)[0] }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="pb.kesimpulan" class="kes" :class="'k-' + (pb.dampak || 'netral')"><b>Kesimpulan:</b> {{ pb.kesimpulan }}</p>
  </section>
</template>

<style scoped>
.pb{margin-bottom:14px}
.lead{font-weight:600;max-width:100ch;margin:6px 0}
.pb td{vertical-align:top}
.kes{margin:10px 0 0;padding:10px 12px;border:1px solid var(--rule);border-left:4px solid var(--rule-2);background:var(--sheet);max-width:100ch}
.k-negatif{border-left-color:var(--strong)} .k-positif{border-left-color:var(--good)}
</style>
