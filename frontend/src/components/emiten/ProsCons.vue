<script setup>
// Dua kolom bergaris: kelebihan (hijau) dan kekurangan (bata). Butir berjudul sama dibuang, maks. 7 per sisi.
import { computed } from 'vue'

const props = defineProps({ pros: { type: Array, default: () => [] }, cons: { type: Array, default: () => [] },
  title: { type: String, default: '' },
  proLabel: { type: String, default: 'Kelebihan' }, conLabel: { type: String, default: 'Kekurangan & risiko' } })
const dedupe = arr => arr.filter((x, i) => x && arr.findIndex(y => y && y.t === x.t) === i).slice(0, 7)
const P = computed(() => dedupe(props.pros))
const C = computed(() => dedupe(props.cons))
</script>

<template>
  <section :class="{ 'rule-top': title }">
    <h2 v-if="title" class="ttl">{{ title }}</h2>
    <div class="pc">
      <div class="col ok">
        <h3 class="lbl">{{ proLabel }} <span class="n">{{ P.length }}</span></h3>
        <ul v-if="P.length"><li v-for="x in P" :key="x.t"><b>{{ x.t }}</b><span v-if="x.d">{{ x.d }}</span></li></ul>
        <p v-else class="muted small">Tidak ada yang menonjol.</p>
      </div>
      <div class="col no">
        <h3 class="lbl">{{ conLabel }} <span class="n">{{ C.length }}</span></h3>
        <ul v-if="C.length"><li v-for="x in C" :key="x.t"><b>{{ x.t }}</b><span v-if="x.d">{{ x.d }}</span></li></ul>
        <p v-else class="muted small">Tidak ada yang menonjol.</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ttl{margin:0 0 10px}
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
