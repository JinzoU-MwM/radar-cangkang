<script setup>
// Dua kolom bergaris: kelebihan (hijau) dan kekurangan (bata). Butir berjudul sama dibuang, maks. 7 per sisi.
import { computed } from 'vue'

const props = defineProps({ pros: { type: Array, default: () => [] }, cons: { type: Array, default: () => [] },
  title: { type: String, default: '' },
  proLabel: { type: String, default: 'Kelebihan' }, conLabel: { type: String, default: 'Kekurangan & risiko' } })
const dedupe = arr => arr.filter((x, i) => x && arr.findIndex(y => y && y.t === x.t) === i).slice(0, 7)
const P = computed(() => dedupe(props.pros))
const C = computed(() => dedupe(props.cons))
// Porsi kelebihan dari seluruh butir (50% bila keduanya kosong).
const bal = computed(() => P.value.length + C.value.length ? Math.round(P.value.length / (P.value.length + C.value.length) * 100) : 50)
</script>

<template>
  <section :class="{ 'rule-top': title }">
    <h2 v-if="title" class="ttl">{{ title }}</h2>
    <div class="bal">
      <span class="bar" role="img" :aria-label="`Keseimbangan: ${P.length} kelebihan dan ${C.length} kekurangan`"><i :style="{ width: bal + '%' }"></i></span>
      <span class="small muted">{{ P.length }} kelebihan · {{ C.length }} kekurangan</span>
    </div>
    <div class="pc">
      <div class="col ok">
        <h3 class="lbl">{{ proLabel }} <span class="n">{{ P.length }}</span></h3>
        <ul v-if="P.length"><li v-for="x in P" :key="x.t"><i class="mk" aria-hidden="true"></i><div><b>{{ x.t }}</b><span v-if="x.d">{{ x.d }}</span></div></li></ul>
        <p v-else class="muted small">Tidak ada yang menonjol.</p>
      </div>
      <div class="col no">
        <h3 class="lbl">{{ conLabel }} <span class="n">{{ C.length }}</span></h3>
        <ul v-if="C.length"><li v-for="x in C" :key="x.t"><i class="mk" aria-hidden="true"></i><div><b>{{ x.t }}</b><span v-if="x.d">{{ x.d }}</span></div></li></ul>
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
li{display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--rule-2);font-size:13.5px}
li div{display:flex;flex-direction:column;gap:2px;min-width:0}
li span{font-size:12.5px;color:var(--ink-2)}
/* Penanda arah: segitiga naik (kelebihan) / turun (kekurangan) dari ikon SVG di tokens.css. */
.mk{flex:none;width:10px;height:12px;margin-top:3px;background:var(--good);-webkit-mask:var(--ic-up) center/contain no-repeat;mask:var(--ic-up) center/contain no-repeat}
.no .mk{background:var(--strong);-webkit-mask-image:var(--ic-down);mask-image:var(--ic-down)}
.bal{display:flex;align-items:center;gap:10px;margin:0 0 10px;flex-wrap:wrap}
.bar{flex:0 1 220px;height:8px;background:var(--strong);border-radius:2px;overflow:hidden;display:block}
.bar i{display:block;height:100%;background:var(--good)}
@media (max-width:760px){.pc{grid-template-columns:1fr}}
</style>
