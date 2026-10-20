<script setup>
import { computed } from 'vue'
import { store } from '../../store.js'
import { fmtDate } from '../../lib/domain.js'
import Modal from './Modal.vue'

// Data aset yang diinjeksi, dari relasi-verified.json → <T>.injeksi.
const props = defineProps({ ticker: { type: String, required: true } })
const emit = defineEmits(['close'])
const d = computed(() => store.relasi[props.ticker]?.injeksi || null)
const vmax = computed(() => Math.max(...(d.value?.valuasi?.baris || []).map(b => b.v), 0))
const LEVEL = { rendah: 'warn', 'sangat-rendah': 'strong' }
</script>

<template>
  <Modal labelledby="injTitle" close-label="Tutup data aset" @close="emit('close')">
    <template #title>
      <div class="lbl">Aset yang diinjeksi ke {{ ticker }}</div>
      <h2 id="injTitle" class="t">{{ d?.judul || 'Data aset belum ada' }}</h2>
      <div v-if="d?.sub" class="small muted">{{ d.sub }}</div>
    </template>

    <p v-if="!d" class="muted">Data aset untuk {{ ticker }} belum ada.</p>
    <template v-else>
      <section v-if="d.nilai?.length" class="sec">
        <h3 class="lbl">Nilai dan skema bayar</h3>
        <dl class="facts">
          <div v-for="n in d.nilai" :key="n.l"><dt class="lbl">{{ n.l }}</dt><dd class="v">{{ n.v }}</dd><dd class="s">{{ n.s }}</dd></div>
        </dl>
        <p v-if="d.nilaiCatatan">{{ d.nilaiCatatan }}</p>
      </section>

      <section v-if="d.valuasi?.baris?.length" class="sec">
        <h3 class="lbl">{{ d.valuasi.judul || 'Pembanding valuasi' }}</h3>
        <div v-for="b in d.valuasi.baris" :key="b.l" class="vrow">
          <div class="vh"><span>{{ b.l }}</span><b>{{ b.teks }}</b></div>
          <div class="bar" aria-hidden="true"><i :class="{ main: b.utama }" :style="{ width: (b.v / vmax * 100) + '%' }"></i></div>
        </div>
        <p v-if="d.valuasi.catatan" class="small muted">{{ d.valuasi.catatan }}</p>
      </section>

      <section v-if="d.kinerja" class="sec">
        <h3 class="lbl">{{ d.kinerja.judul || 'Kinerja keuangan' }}</h3>
        <p v-if="d.kinerja.peringatan || d.kinerja.peringatanTegas" class="alert"><b>{{ d.kinerja.peringatanTegas }}</b>{{ d.kinerja.peringatan }}</p>
        <div class="scroll">
          <table class="ledger">
            <thead><tr><th class="lbl">Data</th><th class="lbl">Isi</th><th class="lbl">Keandalan</th></tr></thead>
            <tbody>
              <tr v-for="r in d.kinerja.baris" :key="r.data">
                <td>{{ r.data }}</td>
                <td :class="{ muted: !r.isi }">{{ r.isi || 'belum ada' }}</td>
                <td :class="LEVEL[r.level] || 'muted'">{{ r.andal }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="d.operasional?.length" class="sec">
        <h3 class="lbl">Operasional</h3>
        <dl class="ops">
          <div v-for="o in d.operasional" :key="o.l"><dt>{{ o.l }}</dt><dd>{{ o.t }}</dd></div>
        </dl>
      </section>

      <section v-if="d.dampak?.length" class="sec">
        <h3 class="lbl">Dampak ke {{ ticker }}</h3>
        <dl class="facts">
          <div v-for="n in d.dampak" :key="n.l"><dt class="lbl">{{ n.l }}</dt><dd class="v">{{ n.v }}</dd><dd class="s">{{ n.s }}</dd></div>
        </dl>
        <p v-if="d.dampakCatatan">{{ d.dampakCatatan }}</p>
      </section>

      <section v-if="d.dokumen?.length" class="sec">
        <h3 class="lbl">Dokumen yang ditunggu</h3>
        <ul><li v-for="x in d.dokumen" :key="x">{{ x }}</li></ul>
      </section>

      <section v-if="d.sumber?.length" class="sec">
        <h3 class="lbl">Sumber</h3>
        <ul class="small">
          <li v-for="s in d.sumber" :key="s.t">
            <a v-if="s.url" :href="s.url" target="_blank" rel="noopener">{{ s.t }}</a><template v-else>{{ s.t }}</template>
            <template v-if="s.ket"> · {{ s.ket }}</template>
          </li>
        </ul>
        <p v-if="d.asOf" class="small muted">Data per {{ fmtDate(d.asOf) }}, relasi-verified.json.</p>
      </section>
    </template>
  </Modal>
</template>

<style scoped>
.t{font-size:30px;line-height:1.05;margin:2px 0}
.lbl{margin:0 0 6px}
.sec{border-top:2px solid var(--ink);padding-top:10px}
.sec p{margin:8px 0 0;font-size:13px}
/* Baris fakta bergaris: label, angka besar, keterangan; bukan kartu. */
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin:0;border-top:1px solid var(--rule-2)}
.facts>div{padding:8px 12px 8px 0;border-bottom:1px solid var(--rule-2)}
.facts dt{margin:0}
.facts dd{margin:0}
.v{font:700 24px/1.1 var(--f-display)}
.s{font-size:12px;color:var(--ink-2)}
.vrow{margin:6px 0;font-size:13px}
.vh{display:flex;justify-content:space-between;gap:12px}
.bar{height:12px;background:var(--rule-2);border-radius:2px;margin-top:3px;overflow:hidden}
.bar i{display:block;height:100%;background:var(--rail-mute)}
.bar i.main{background:var(--accent)}
.alert{background:var(--strong-bg);padding:10px 14px;margin:0 0 8px!important}
.alert b{color:var(--strong)}
.scroll{overflow-x:auto}
.ledger{font-size:13px}
.warn{color:var(--warn)}
.strong{color:var(--strong)}
.ops{margin:0;font-size:13px}
.ops>div{display:grid;grid-template-columns:110px 1fr;gap:12px;padding:6px 0;border-bottom:1px solid var(--rule-2)}
.ops dt{font-weight:600}
.ops dd{margin:0}
ul{margin:0;padding-left:18px;font-size:13px}
li{margin:3px 0}
@media (max-width:760px){.ops>div{grid-template-columns:1fr;gap:2px}}
</style>
