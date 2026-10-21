<script setup>
// Sikap analis dari pandangan-analis.json: Hindari / Spekulatif tinggi / Netral / Asimetri positif.
const props = defineProps({ sikap: String, short: Boolean })
const CLS = { 'Hindari': 't-strong', 'Spekulatif tinggi': 't-warn', 'Netral': 't-calm', 'Asimetri positif': 't-good' }
const SHORT = { 'Spekulatif tinggi': 'Spekulatif', 'Asimetri positif': 'Asimetri+' }
</script>

<template>
  <span v-if="sikap" class="tag" :class="CLS[sikap] || 't-calm'" :title="short ? sikap : undefined">{{ short ? (SHORT[sikap] || sikap) : sikap }}</span>
  <span v-else class="muted small">belum ada</span>
</template>
