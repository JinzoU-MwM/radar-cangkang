<script setup>
// Peta jaringan pengendali. Tanpa `focus`: seluruh radar (bawaan hanya keterkaitan lintas emiten).
// Dengan `focus`: jaringan satu emiten dalam jarak 2 langkah. Klik simpul = sorot hubungannya;
// klik lagi simpul emiten yang tersorot = buka halaman emitennya.
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { store } from '../store.js'
import { buildNetwork, bridgesOf, egoOf, layoutNet, layoutBipartite, NET_TYPE } from '../lib/netGraph.js'

const props = defineProps({ focus: { type: String, default: '' }, heading: { type: Boolean, default: true } })
const router = useRouter()
const scope = ref('cross')   // 'cross' | 'all' (mode global)
const sel = ref('')

const G = computed(() => buildNetwork({ profil: store.profil || {}, relasi: store.relasi || {} }))
const bridges = computed(() => bridgesOf(G.value))
const view = computed(() => props.focus ? egoOf(G.value, props.focus) : G.value)
// Mode lintas emiten (bawaan global): dua kolom penghubung → emiten, bukan grafik pegas.
const bip = computed(() => !props.focus && scope.value === 'cross' ? layoutBipartite(bridges.value) : null)
const typeOf = computed(() => new Map(G.value.nodes.map(n => [n.id, n.type])))
const bsel = ref('')   // penghubung atau emiten yang disorot di mode dua kolom
const bLit = l => !bsel.value || l.from === bsel.value || l.t === bsel.value
const curve = (x1, y1, x2, y2) => { const m = (x1 + x2) / 2; return `M${x1},${y1} C${m},${y1} ${m},${y2} ${x2},${y2}` }
const W = computed(() => props.focus ? 760 : 1100)
const H = computed(() => props.focus ? Math.min(460, 220 + view.value.nodes.length * 12) : 900)
const pos = computed(() => {
  if (bip.value) return new Map()
  const P = layoutNet(view.value.nodes, view.value.edges, W.value, H.value)
  return new Map(view.value.nodes.map((n, i) => [n.id, P[i]]))
})
const r = n => n.type === 'emiten' ? 15 : n.em.size >= 2 ? 9 : 6
// Label bawah bertabrakan dengan label simpul lain yang berdekatan (kiri-kanan) → pindah ke atas simpul.
const labelUp = computed(() => {
  const up = new Set(), placed = []
  for (const n of view.value.nodes) {
    if (n.type === 'emiten') continue
    const p = pos.value.get(n.id)
    if (!p) continue
    const w = Math.min(26, n.label.length) * 6.2
    const clash = placed.some(q => Math.abs(q.x - p.x) < (w + q.w) / 2 + 6 && Math.abs(q.y - p.y) < 18)
    if (clash) up.add(n.id); else placed.push({ x: p.x, y: p.y, w })
  }
  return up
})
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
        <span v-for="n in bridges.slice(0, 16)" :key="n.id" class="br">{{ n.label }}<RouterLink v-for="t in [...n.em]" :key="t" class="tk" :to="'/emiten/' + t">{{ t }}</RouterLink></span>
      </div>
      <p v-else class="small muted">Belum ada orang atau badan usaha yang tercatat menghubungkan dua emiten atau lebih.</p>
    </template>

    <div v-if="bip && bip.left.length" class="scroll">
      <svg :viewBox="`0 0 ${bip.W} ${bip.H}`" class="svg bip" role="img" :aria-label="'Penghubung lintas emiten, ' + bip.left.length + ' pihak'" @click.self="bsel = ''">
        <path v-for="(l, i) in bip.links" :key="'l' + i" class="bl" :class="{ on: bsel && bLit(l), off: bsel && !bLit(l) }"
          :d="curve(bip.xL, l.y1, bip.xR, l.y2)" />
        <g v-for="b in bip.left" :key="b.id" class="bn" :class="[typeOf.get(b.id), { on: bsel === b.id }]" tabindex="0" role="button"
          :transform="`translate(${bip.xL},${b.y})`" :aria-label="b.label + ', menghubungkan ' + b.em.join(', ')"
          @click.stop="bsel = bsel === b.id ? '' : b.id" @keydown.enter.prevent="bsel = bsel === b.id ? '' : b.id">
          <circle r="6" /><text x="-12" dy="4" class="bl-t">{{ b.label.length > 44 ? b.label.slice(0, 43) + '…' : b.label }}</text>
          <title>{{ b.label }} · {{ b.em.join(', ') }}</title>
        </g>
        <g v-for="r in bip.right" :key="r.t" class="bn emiten" :class="{ on: bsel === r.t }" tabindex="0" role="button"
          :transform="`translate(${bip.xR},${r.y})`" :aria-label="r.t" @click.stop="bsel === r.t ? $router.push('/emiten/' + r.t) : (bsel = r.t)"
          @keydown.enter.prevent="$router.push('/emiten/' + r.t)">
          <circle r="13" /><text dy="4" class="tk-l">{{ r.t }}</text><title>{{ r.t }} · klik lagi untuk membuka</title>
        </g>
      </svg>
    </div>
    <div v-else-if="!bip && view.nodes.length > 1" class="scroll">
      <svg :viewBox="`0 0 ${W} ${H}`" class="svg" :class="{ hl: sel }" role="img" :aria-label="'Diagram jaringan, ' + view.nodes.length + ' simpul'" @click.self="sel = ''">
        <line v-for="(e, i) in view.edges" :key="'e' + i" class="e" :class="{ x: cross(e), on: sel && lit(e) }"
          :x1="pos.get(e.a)?.x" :y1="pos.get(e.a)?.y" :x2="pos.get(e.b)?.x" :y2="pos.get(e.b)?.y"><title>{{ e.label }}</title></line>
        <g v-for="n in view.nodes" :key="n.id" class="n" :class="[n.type, { multi: n.em.size >= 2, focus: n.id === 'em:' + focus, on: neigh?.has(n.id) }]"
          :transform="`translate(${pos.get(n.id).x.toFixed(1)},${pos.get(n.id).y.toFixed(1)})`" tabindex="0" role="button"
          :aria-label="n.label + ', ' + NET_TYPE[n.type]" @click.stop="pick(n)" @keydown.enter.prevent="pick(n)">
          <circle :r="r(n)" />
          <text v-if="n.type === 'emiten'" class="tk-l" dy="4">{{ n.label }}</text>
          <text v-else class="lb" :dy="labelUp.has(n.id) ? -(r(n) + 5) : r(n) + 11">{{ short(n.label) }}</text>
          <title>{{ n.label }} · {{ NET_TYPE[n.type] }}{{ n.em.size ? ' · emiten: ' + [...n.em].join(', ') : '' }}</title>
        </g>
      </svg>
    </div>
    <p v-else class="small muted">Belum ada keterkaitan yang tercatat.</p>

    <div class="leg small">
      <span v-for="(l, k) in NET_TYPE" :key="k"><i class="dot" :class="k"></i>{{ l }}</span>
      <span><i class="line"></i>lintas emiten (rekam jejak, rangkap, jaringan, Alur saham)</span>
      <span class="muted">Klik pihak atau emiten untuk menyorot hubungannya; klik lagi kode emiten untuk membukanya.</span>
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
.br .tk{margin-left:6px}
.bip{min-width:640px}
.bl{fill:none;stroke:var(--now);stroke-width:1.4;opacity:.55}
.bl.on{stroke:var(--ink);stroke-width:2;opacity:1}
.bl.off{opacity:.08}
.bn{cursor:pointer;outline:none}
.bn circle{stroke:var(--sheet);stroke-width:2;fill:var(--viz-a, var(--accent))}
.bn.entitas circle{fill:var(--viz-c, var(--good))}.bn.pihak circle{fill:var(--viz-b, var(--warn))}.bn.pengurus circle{fill:var(--calm)}
.bn.emiten circle{fill:var(--accent)}
.bn.on circle,.bn:focus-visible circle{stroke:var(--ink);stroke-width:3}
.bl-t{font:600 12px var(--f-body);fill:var(--ink);text-anchor:end}
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
