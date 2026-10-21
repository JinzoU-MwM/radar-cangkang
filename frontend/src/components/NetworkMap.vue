<script setup>
// Peta jaringan pengendali. Tanpa `focus`: seluruh radar (bawaan hanya keterkaitan lintas emiten).
// Dengan `focus`: jaringan satu emiten dalam jarak 2 langkah. Klik simpul = sorot hubungannya;
// klik lagi simpul emiten yang tersorot = buka halaman emitennya.
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { store } from '../store.js'
import { buildNetwork, bridgesOf, crossOnly, egoOf, layoutNet, NET_TYPE } from '../lib/netGraph.js'

const props = defineProps({ focus: { type: String, default: '' }, heading: { type: Boolean, default: true } })
const router = useRouter()
const scope = ref('cross')   // 'cross' | 'all' (mode global)
const sel = ref('')

const G = computed(() => buildNetwork({ profil: store.profil || {}, relasi: store.relasi || {} }))
const bridges = computed(() => bridgesOf(G.value))
const view = computed(() => {
  if (props.focus) return egoOf(G.value, props.focus)
  return scope.value === 'all' ? G.value : crossOnly(G.value)
})
const W = computed(() => props.focus ? 760 : 1100)
const H = computed(() => props.focus ? Math.min(460, 220 + view.value.nodes.length * 12)
  : scope.value === 'all' ? 900 : Math.min(760, 260 + view.value.nodes.length * 9))
const pos = computed(() => {
  const P = layoutNet(view.value.nodes, view.value.edges, W.value, H.value)
  return new Map(view.value.nodes.map((n, i) => [n.id, P[i]]))
})
const r = n => n.type === 'emiten' ? 15 : n.em.size >= 2 ? 9 : 6
const short = s => s.length > 26 ? s.slice(0, 25) + '…' : s
const neigh = computed(() => {
  if (!sel.value) return null
  const s = new Set([sel.value])
  for (const e of view.value.edges) { if (e.a === sel.value) s.add(e.b); if (e.b === sel.value) s.add(e.a) }
  return s
})
const lit = e => !sel.value || e.a === sel.value || e.b === sel.value
const cross = e => /rekam|rangkap|jaringan|alur saham/.test(e.label)

function pick(n) {
  if (sel.value === n.id && n.type === 'emiten') { router.push('/emiten/' + n.label); return }
  sel.value = sel.value === n.id ? '' : n.id
}
const other = computed(() => props.focus ? view.value.others : [])
</script>

<template>
  <section class="net" :class="{ 'rule-top': heading }" :aria-label="focus ? 'Peta jaringan ' + focus : 'Peta jaringan pengendali'">
    <div class="head">
      <h2 v-if="heading">{{ focus ? 'Peta jaringan ' + focus : 'Peta jaringan pengendali' }}</h2>
      <div v-if="!focus" role="group" aria-label="Cakupan peta" class="seg">
        <button type="button" :aria-pressed="String(scope === 'cross')" @click="scope = 'cross'; sel = ''">Lintas emiten</button>
        <button type="button" :aria-pressed="String(scope === 'all')" @click="scope = 'all'; sel = ''">Semua ({{ G.nodes.length }} simpul)</button>
      </div>
    </div>
    <p v-if="focus" class="small muted">
      {{ view.nodes.length }} simpul<template v-if="other.length"> · terhubung ke {{ other.length }} emiten radar lain:
        <template v-for="(t, i) in other" :key="t"><template v-if="i">, </template><RouterLink class="tk" :to="'/emiten/' + t">{{ t }}</RouterLink></template></template>
    </p>
    <template v-else>
      <p class="small muted">Orang, badan usaha, pengurus, dan pihak lawan yang menghubungkan emiten di radar, dari riset profil pengendali (rekam jejak, rangkap jabatan, jaringan) dan Alur saham.</p>
      <div v-if="bridges.length" class="bridges small">
        <b>Penghubung lintas emiten ({{ bridges.length }}):</b>
        <span v-for="n in bridges.slice(0, 16)" :key="n.id" class="br">{{ n.label }}
          <template v-for="t in [...n.em]" :key="t"> <RouterLink class="tk" :to="'/emiten/' + t">{{ t }}</RouterLink></template></span>
      </div>
      <p v-else class="small muted">Belum ada orang atau badan usaha yang tercatat menghubungkan dua emiten atau lebih.</p>
    </template>

    <div v-if="view.nodes.length > 1" class="scroll">
      <svg :viewBox="`0 0 ${W} ${H}`" class="svg" :class="{ hl: sel }" role="img" :aria-label="'Diagram jaringan, ' + view.nodes.length + ' simpul'" @click.self="sel = ''">
        <line v-for="(e, i) in view.edges" :key="'e' + i" class="e" :class="{ x: cross(e), on: sel && lit(e) }"
          :x1="pos.get(e.a)?.x" :y1="pos.get(e.a)?.y" :x2="pos.get(e.b)?.x" :y2="pos.get(e.b)?.y"><title>{{ e.label }}</title></line>
        <g v-for="n in view.nodes" :key="n.id" class="n" :class="[n.type, { multi: n.em.size >= 2, focus: n.id === 'em:' + focus, on: neigh?.has(n.id) }]"
          :transform="`translate(${pos.get(n.id).x.toFixed(1)},${pos.get(n.id).y.toFixed(1)})`" tabindex="0" role="button"
          :aria-label="n.label + ', ' + NET_TYPE[n.type]" @click.stop="pick(n)" @keydown.enter.prevent="pick(n)">
          <circle :r="r(n)" />
          <text v-if="n.type === 'emiten'" class="tk-l" dy="4">{{ n.label }}</text>
          <text v-else class="lb" :dy="r(n) + 11">{{ short(n.label) }}</text>
          <title>{{ n.label }} · {{ NET_TYPE[n.type] }}{{ n.em.size ? ' · emiten: ' + [...n.em].join(', ') : '' }}</title>
        </g>
      </svg>
    </div>
    <p v-else class="small muted">Belum ada keterkaitan yang tercatat.</p>

    <div class="leg small">
      <span v-for="(l, k) in NET_TYPE" :key="k"><i class="dot" :class="k"></i>{{ l }}</span>
      <span><i class="line"></i>lintas emiten (rekam jejak, rangkap, jaringan, Alur saham)</span>
      <span class="muted">Klik simpul untuk menyorot hubungannya; klik lagi kode emiten untuk membukanya.</span>
    </div>
  </section>
</template>

<style scoped>
.net{display:grid;gap:8px}
.head{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:baseline;justify-content:space-between}
.head h2{margin:0}
.seg{display:flex;gap:4px}
.seg button{font-size:12.5px;padding:3px 10px;border:1px solid var(--rule);background:var(--sheet);color:var(--ink-2);cursor:pointer}
.seg button[aria-pressed="true"]{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.bridges{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:baseline}
.br{border:1px solid var(--rule);padding:2px 8px;background:var(--sheet)}
.tk{font-weight:700;color:var(--accent);text-decoration:underline dotted}
.scroll{overflow-x:auto}
.svg{display:block;width:100%;min-width:560px;height:auto;background:var(--sheet);border:1px solid var(--rule)}
.e{stroke:var(--rule);stroke-width:1.2}
.e.x{stroke:var(--now);stroke-width:1.6;stroke-dasharray:4 3}
.n{cursor:pointer;outline:none}
.n circle{stroke:var(--sheet);stroke-width:2}
.n.emiten circle{fill:var(--accent)}
.n.orang circle{fill:var(--viz-a, var(--accent))}
.n.entitas circle{fill:var(--viz-c, var(--good))}
.n.pihak circle{fill:var(--viz-b, var(--warn))}
.n.pengurus circle{fill:var(--calm)}
.n.multi circle{stroke:var(--now);stroke-width:3}
.n.focus circle,.n:focus-visible circle{stroke:var(--ink);stroke-width:3}
.tk-l{font:700 10px var(--f-display);fill:var(--accent-ink);text-anchor:middle;pointer-events:none}
.lb{font:600 10px var(--f-body);fill:var(--ink-2);text-anchor:middle;paint-order:stroke;stroke:var(--sheet);stroke-width:3px;pointer-events:none}
.svg.hl .n:not(.on){opacity:.18}
.svg.hl .e:not(.on){opacity:.08}
.svg.hl .e.on{stroke:var(--ink);stroke-width:2}
.leg{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center}
.dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:-1px}
.dot.emiten{background:var(--accent)}.dot.orang{background:var(--viz-a, var(--accent))}.dot.entitas{background:var(--viz-c, var(--good))}
.dot.pihak{background:var(--viz-b, var(--warn))}.dot.pengurus{background:var(--calm)}
.line{display:inline-block;width:18px;border-top:2px dashed var(--now);margin-right:5px;vertical-align:3px}
</style>
