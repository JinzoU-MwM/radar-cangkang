<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

// Kerangka dialog modal bersama: scrim, Esc, fokus dikunci di dalam, fokus kembali ke pemicu saat ditutup.
const props = defineProps({ labelledby: String, closeLabel: { type: String, default: 'Tutup' } })
const emit = defineEmits(['close'])
const box = ref(null)
let opener = null

const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,summary,[tabindex]:not([tabindex="-1"])'

function onKey(e) {
  if (e.key === 'Escape') { e.stopPropagation(); emit('close'); return }
  if (e.key !== 'Tab' || !box.value) return
  const els = [...box.value.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null)
  if (!els.length) return
  const first = els[0], last = els[els.length - 1]
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}

onMounted(async () => {
  opener = document.activeElement
  document.body.style.overflow = 'hidden'
  await nextTick()
  box.value?.focus()
})
onBeforeUnmount(() => {
  document.body.style.overflow = ''
  if (opener && document.contains(opener)) opener.focus()
})
</script>

<template>
  <Teleport to="body">
    <div class="scrim" @click.self="emit('close')" @keydown="onKey">
      <div ref="box" class="dialog" role="dialog" aria-modal="true" :aria-labelledby="labelledby" tabindex="-1">
        <div class="head">
          <div class="title"><slot name="title" /></div>
          <button type="button" class="btn icon x" :aria-label="closeLabel" @click="emit('close')">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2 2 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
          </button>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog:focus{outline:none}
.head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.title{min-width:0}
.x{width:44px;min-height:44px;flex:none}
@media (max-width:760px){.dialog{padding:16px}}
</style>
