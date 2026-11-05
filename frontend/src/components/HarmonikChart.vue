<script setup>
// Chart candlestick harian untuk analisa Harmonic Pattern (POV): candle + volume, garis XABCD, pita PRZ, stop,
// target, dan crosshair OHLC saat diarahkan. Tanpa pola: garis swing (pivot zigzag) terakhir.
import { computed, ref } from 'vue'
import { idxTanggal } from '../lib/harmonik.js'

const props = defineProps({
  bars: { type: Array, required: true },
  row: { type: Object, default: null },
  pivot: { type: Array, default: () => [] },
})
const W = 760, HP = 270, HV = 60, PAD_L = 8, PAD_R = 78, PAD_T = 14
const H = HP + HV + 18
const rp = v => v == null ? '–' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: 2 })

// Rentang tampil: dari 15 bar sebelum X (atau pivot pertama) sampai bar terakhir, minimal 90 bar.
const awal = computed(() => {
  const b = props.bars, d0 = props.row?.titik?.[0]?.d || props.pivot?.[0]?.d
  const i = d0 ? idxTanggal(b, d0) - 15 : b.length - 120
  return Math.max(0, Math.min(i, b.length - 90))
})
const vis = computed(() => props.bars.slice(awal.value))
const n = computed(() => vis.value.length)
const lebar = computed(() => (W - PAD_L - PAD_R) / Math.max(1, n.value))
const x = i => PAD_L + (i + 0.5) * lebar.value

const tambahan = computed(() => {
  const r = props.row
  return r ? [...(r.prz || []), r.stop, ...(r.target || [])].filter(v => v != null) : []
})
const rng = computed(() => {
  const lo = Math.min(...vis.value.map(b => b.l), ...tambahan.value), hi = Math.max(...vis.value.map(b => b.h), ...tambahan.value)
  const pad = (hi - lo) * 0.04 || 1
  return [lo - pad, hi + pad]
})
const y = v => PAD_T + (HP - PAD_T) * (1 - (v - rng.value[0]) / (rng.value[1] - rng.value[0]))
const vMaks = computed(() => Math.max(...vis.value.map(b => b.v), 1))
const yv = v => HP + 18 + HV * (1 - v / vMaks.value)

// Titik pola (atau pivot) pada indeks bar yang tampil.
const titik = computed(() => {
  const src = props.row?.titik?.length ? props.row.titik : props.pivot.map((p, i) => ({ n: p.tentatif ? '•' : String(i + 1), d: p.d, p: p.p }))
  return src.map(t => ({ ...t, i: idxTanggal(props.bars, t.d) - awal.value })).filter(t => t.i >= 0)
})
const jalur = computed(() => titik.value.map((t, k) => `${k ? 'L' : 'M'}${x(t.i).toFixed(1)},${y(t.p).toFixed(1)}`).join(' '))
const puncak = t => {
  const k = titik.value.indexOf(t), a = titik.value[k - 1], b = titik.value[k + 1]
  return (!a || t.p >= a.p) && (!b || t.p >= b.p)
}
// PRZ dari titik C (pola menuju) atau D sampai tepi kanan.
const przX = computed(() => {
  const r = props.row
  if (!r?.prz) return null
  const t = titik.value.find(z => z.n === 'D') || titik.value.find(z => z.n === 'C')
  return t ? x(t.i) : x(n.value - 20)
})
const garis = computed(() => {
  const r = props.row
  if (!r) return []
  return [{ v: r.stop, k: 'stop', teks: 'Stop ' + rp(r.stop) },
    ...(r.target || []).map((v, i) => ({ v, k: 'tgt', teks: `T${i + 1} ${rp(v)}` }))].filter(g => g.v != null)
})

// Crosshair.
const svg = ref(null), hov = ref(null)
function gerak(e) {
  const b = svg.value.getBoundingClientRect()
  const px = (e.clientX - b.left) / b.width * W
  const i = Math.floor((px - PAD_L) / lebar.value)
  hov.value = i >= 0 && i < n.value ? i : null
}
const info = computed(() => hov.value == null ? vis.value[n.value - 1] : vis.value[hov.value])
</script>

<template>
  <figure class="hc">
    <figcaption class="small">
      <b>{{ String(info?.d || '').slice(0, 10) }}</b> · O {{ rp(info?.o) }} · H {{ rp(info?.h) }} · L {{ rp(info?.l) }} · C {{ rp(info?.c) }} ·
      Vol {{ rp(info ? info.v : null) }} lot
    </figcaption>
    <svg ref="svg" :viewBox="`0 0 ${W} ${H}`" class="cv" role="img" aria-label="Chart candlestick harian dengan pola harmonik" @mousemove="gerak" @mouseleave="hov = null">
      <rect v-if="przX != null" :x="przX" :width="W - PAD_R - przX" :y="y(row.prz[1])" :height="Math.max(3, y(row.prz[0]) - y(row.prz[1]))" class="prz" />
      <text v-if="przX != null" :x="W - PAD_R + 4" :y="(y(row.prz[1]) + y(row.prz[0])) / 2 + 4" class="lbl prz-t">PRZ</text>
      <g v-for="g in garis" :key="g.teks">
        <line :x1="PAD_L" :x2="W - PAD_R" :y1="y(g.v)" :y2="y(g.v)" class="gl" :class="g.k" />
        <text :x="W - PAD_R + 4" :y="y(g.v) + 4" class="lbl" :class="g.k">{{ g.teks }}</text>
      </g>
      <g v-for="(b, i) in vis" :key="b.d">
        <line :x1="x(i)" :x2="x(i)" :y1="y(b.h)" :y2="y(b.l)" class="sumbu" :class="b.c >= b.o ? 'up' : 'dn'" />
        <rect :x="x(i) - Math.max(1, lebar * 0.35)" :width="Math.max(2, lebar * 0.7)" :y="y(Math.max(b.o, b.c))" :height="Math.max(1, Math.abs(y(b.o) - y(b.c)))" class="bd" :class="b.c >= b.o ? 'up' : 'dn'" />
        <rect :x="x(i) - Math.max(1, lebar * 0.35)" :width="Math.max(2, lebar * 0.7)" :y="yv(b.v)" :height="HP + 18 + HV - yv(b.v)" class="vol" :class="b.c >= b.o ? 'up' : 'dn'" />
      </g>
      <path :d="jalur" class="pola" :class="{ pivot: !row }" />
      <g v-for="t in titik" :key="t.n + t.d">
        <circle :cx="x(t.i)" :cy="y(t.p)" r="4.5" class="tt" />
        <text :x="x(t.i)" :y="puncak(t) ? y(t.p) - 9 : y(t.p) + 18" class="tl">{{ t.n }} {{ rp(t.p) }}</text>
      </g>
      <line v-if="hov != null" :x1="x(hov)" :x2="x(hov)" :y1="PAD_T" :y2="H" class="ch" />
      <line :x1="PAD_L" :x2="W - PAD_R" :y1="HP + 10" :y2="HP + 10" class="pisah" />
      <text :x="W - PAD_R + 4" :y="y(vis[n - 1].c) + 4" class="lbl now">{{ rp(vis[n - 1].c) }}</text>
    </svg>
  </figure>
</template>

<style scoped>
.hc{margin:0}
.hc figcaption{font-family:var(--f-data);color:var(--ink-2);margin-bottom:4px;min-height:1.4em}
.cv{width:100%;height:auto;max-height:420px;background:var(--sheet);border:1px solid var(--rule);display:block}
.sumbu{stroke-width:1}.sumbu.up,.bd.up{stroke:var(--good);fill:var(--good)}.sumbu.dn,.bd.dn{stroke:var(--strong);fill:var(--strong)}
.vol{opacity:.35}.vol.up{fill:var(--good)}.vol.dn{fill:var(--strong)}
.prz{fill:var(--warn-bg);stroke:var(--warn);stroke-dasharray:3 3;opacity:.9}
.gl{stroke-width:1.2;stroke-dasharray:6 4}.gl.stop{stroke:var(--strong)}.gl.tgt{stroke:var(--good)}
.pola{fill:none;stroke:var(--accent);stroke-width:2.5;stroke-linejoin:round}.pola.pivot{stroke-dasharray:5 4;stroke-width:1.6}
.tt{fill:var(--sheet);stroke:var(--accent);stroke-width:2.5}
.tl{font:700 12px var(--f-data);fill:var(--ink);text-anchor:middle;paint-order:stroke;stroke:var(--sheet);stroke-width:3px}
.lbl{font:600 11px var(--f-data);fill:var(--ink-2)}.lbl.stop{fill:var(--strong)}.lbl.tgt{fill:var(--good)}.lbl.prz-t{fill:var(--warn)}.lbl.now{fill:var(--now-ink);font-weight:800}
.ch{stroke:var(--ink-2);stroke-width:.8;stroke-dasharray:2 3}
.pisah{stroke:var(--rule)}
</style>
