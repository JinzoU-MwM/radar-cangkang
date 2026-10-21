<script setup>
// Teks biasa yang kode saham radar di dalamnya (mis. "masuk NINE lalu PIPA") menjadi tautan ke halaman emiten.
import { computed } from 'vue'
import { store } from '../store.js'
import { tickerParts } from '../lib/profil.js'

const props = defineProps({ text: { type: String, default: '' } })
const known = computed(() => new Set(Object.keys(store.profil || {}).filter(k => /^[A-Z]{4}$/.test(k))))
const parts = computed(() => tickerParts(props.text, known.value))
</script>

<template>
  <template v-for="(p, i) in parts" :key="i"><RouterLink v-if="p.ticker" class="tk" :to="'/emiten/' + p.ticker">{{ p.ticker }}</RouterLink><template v-else>{{ p.text }}</template></template>
</template>

<style scoped>
.tk{font-weight:700;color:var(--accent);text-decoration:underline dotted}
</style>
