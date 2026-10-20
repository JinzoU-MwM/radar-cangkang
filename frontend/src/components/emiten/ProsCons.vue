<script setup>
// Dua kolom bergaris: kelebihan (hijau) dan kekurangan (bata). Isi dari lib/emitenExtra.js.
defineProps({ pros: { type: Array, default: () => [] }, cons: { type: Array, default: () => [] },
  proLabel: { type: String, default: 'Kelebihan' }, conLabel: { type: String, default: 'Kekurangan & risiko' } })
</script>

<template>
  <div class="pc">
    <div class="col ok">
      <h3 class="lbl">{{ proLabel }} <span class="n">{{ pros.length }}</span></h3>
      <ul v-if="pros.length"><li v-for="x in pros" :key="x.t"><b>{{ x.t }}</b><span v-if="x.d">{{ x.d }}</span></li></ul>
      <p v-else class="muted small">Tidak ada yang menonjol.</p>
    </div>
    <div class="col no">
      <h3 class="lbl">{{ conLabel }} <span class="n">{{ cons.length }}</span></h3>
      <ul v-if="cons.length"><li v-for="x in cons" :key="x.t"><b>{{ x.t }}</b><span v-if="x.d">{{ x.d }}</span></li></ul>
      <p v-else class="muted small">Tidak ada yang menonjol.</p>
    </div>
  </div>
</template>

<style scoped>
.pc{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.col{border-top:2px solid var(--good);padding-top:8px;min-width:0}
.col.no{border-top-color:var(--strong)}
.lbl{margin:0 0 4px;display:flex;justify-content:space-between}
.ok .lbl{color:var(--good)}
.no .lbl{color:var(--strong)}
.n{font-size:16px}
ul{list-style:none;margin:0;padding:0}
li{display:flex;flex-direction:column;gap:2px;padding:7px 0;border-bottom:1px solid var(--rule-2);font-size:13.5px}
li span{font-size:12.5px;color:var(--ink-2)}
@media (max-width:760px){.pc{grid-template-columns:1fr}}
</style>
