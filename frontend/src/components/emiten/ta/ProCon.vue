<script setup>
// Kelebihan vs kekurangan (port proConHtml): dua kolom, maksimum 7 butir per sisi, judul duplikat dibuang.
import { computed } from 'vue'

const props = defineProps({
  pros: { type: Array, required: true },   // [{ t, d }]
  cons: { type: Array, required: true },
  title: { type: String, default: 'Kelebihan vs kekurangan' },
})
const dedupe = arr => arr.filter((x, i) => x && arr.findIndex(y => y && y.t === x.t) === i).slice(0, 7)
const P = computed(() => dedupe(props.pros))
const C = computed(() => dedupe(props.cons))
const bal = computed(() => P.value.length + C.value.length ? Math.round(P.value.length / (P.value.length + C.value.length) * 100) : 50)
</script>

<template>
  <section class="pc rule-top">
    <div class="pc-h">
      <h2>{{ title }}</h2>
      <div class="bal small muted">
        <span class="bar" aria-hidden="true"><i :style="{ width: bal + '%' }"></i></span>
        {{ P.length }} kelebihan · {{ C.length }} kekurangan
      </div>
    </div>
    <div class="cols">
      <div v-for="[list, ok, head] in [[P, true, 'Kelebihan'], [C, false, 'Kekurangan & risiko']]" :key="head" :class="ok ? 'ok' : 'no'">
        <h3 class="lbl">{{ head }}</h3>
        <ul>
          <li v-for="x in list" :key="x.t">
            <svg viewBox="0 0 10 10" aria-hidden="true"><path :d="ok ? 'M5 1.5 9 8.5H1z' : 'M5 8.5 1 1.5h8z'"/></svg>
            <div><b>{{ x.t }}</b><span v-if="x.d" class="small muted">{{ x.d }}</span></div>
          </li>
          <li v-if="!list.length" class="small muted">Tidak ada yang menonjol.</li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pc-h{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:10px}
.bal{display:flex;align-items:center;gap:8px}
.bar{display:inline-block;width:120px;height:6px;background:var(--strong-bg);border-radius:1px;overflow:hidden}
.bar i{display:block;height:100%;background:var(--good)}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:24px}
h3{margin:0 0 6px}
.ok h3{color:var(--good)} .no h3{color:var(--strong)}
ul{list-style:none;margin:0;padding:0}
li{display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--rule-2)}
li div{display:flex;flex-direction:column}
svg{flex:none;width:10px;height:10px;margin-top:5px}
.ok svg{fill:var(--good)} .no svg{fill:var(--strong)}
@media (max-width:760px){.cols{grid-template-columns:1fr}}
</style>
