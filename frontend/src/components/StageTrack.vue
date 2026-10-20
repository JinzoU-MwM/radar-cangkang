<script setup>
import { computed } from 'vue'
import { STAGES, trackIndex } from '../lib/domain.js'

// Trek 5 ruas (PPJB, PTW, RUPSLB, Injeksi, Selesai) dengan skala sama di tiap baris.
const props = defineProps({ item: Object })
const NAMES = ['PPJB', 'PTW', 'RUPSLB', 'Injeksi', 'Selesai']
const idx = computed(() => trackIndex(props.item))
const label = computed(() => idx.value < 0 ? (STAGES[0].name) : NAMES[idx.value])
</script>

<template>
  <div class="st" :aria-label="idx < 0 ? 'Tahap: penyaringan' : `Tahap ${idx + 1} dari 5: ${label}`">
    <div class="track" aria-hidden="true">
      <i v-for="(n, i) in NAMES" :key="n" :class="{ d: i < idx, n: i === idx }"></i>
    </div>
    <span class="name">{{ label }}</span>
  </div>
</template>

<style scoped>
.st{display:flex;align-items:center;gap:12px}
.track{display:grid;grid-template-columns:repeat(5,16px);gap:3px;align-items:center;flex:none}
i{height:6px;border-radius:1px;background:var(--rule-2)}
i.d{background:var(--accent)}
i.n{background:var(--now);height:10px}
.name{font:700 15px var(--f-display);letter-spacing:.02em;min-width:56px}
</style>
