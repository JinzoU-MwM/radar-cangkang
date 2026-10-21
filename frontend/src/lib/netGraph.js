// Peta jaringan pengendali: orang ↔ badan usaha ↔ emiten ↔ pihak lawan, dari profil riset
// (profil-pengendali.json) dan indeks entitas Alur saham (relasi-verified.json). Logika murni, tanpa DOM.
import { entityKey, buildEntityIndex } from './relasiAuto.js'

export const NET_TYPE = {
  emiten: 'Emiten radar', orang: 'Pengendali/UBO', entitas: 'Badan usaha pengendali',
  pihak: 'Pihak lawan/aset target', pengurus: 'Pengurus rangkap',
}
// Teks pengisi di kolom entitas/pihak lawan yang bukan nama pihak.
const FILLER = /^\s*(langsung|pribadi|perorangan|atas nama sendiri|tidak|belum|tanpa|bukan|n\/a|-|–)/i
const TICK = /\b[A-Z]{4}\b/g

export function buildNetwork({ profil = {}, relasi = {} } = {}) {
  const tickers = Object.keys(profil).filter(k => /^[A-Z]{4}$/.test(k))
  const known = new Set(tickers)
  const nodes = new Map(), edges = [], seen = new Set()
  const node = (id, label, type) => {
    if (!nodes.has(id)) nodes.set(id, { id, label, type, em: new Set() })
    return nodes.get(id)
  }
  const link = (a, b, label) => {
    if (!a || !b || a === b) return
    const k = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id
    if (seen.has(k)) return
    seen.add(k); edges.push({ a: a.id, b: b.id, label: label || '' })
  }
  const em = t => node('em:' + t, t, 'emiten')
  const codesIn = (s, self) => (String(s || '').match(TICK) || []).filter(c => c !== self && known.has(c))
  tickers.forEach(em)

  for (const t of tickers) {
    const p = profil[t] || {}
    for (const o of p.pengendali || []) {
      const pn = node('p:' + entityKey(o.nama), o.nama, 'orang'); pn.em.add(t)
      link(pn, em(t), o.peran || 'pengendali')
      // Badan usaha pengendali (bukan teks porsi atau "langsung").
      String(o.entitas || '').split(/;|\s+dan\s+|,(?=\s*PT\b)/).map(s => s.trim())
        .filter(s => s.length > 3 && entityKey(s) !== entityKey(o.nama) && !FILLER.test(s) && !/\d+(,\d+)?\s*%/.test(s))
        .slice(0, 2).forEach(s => {
          // Buang keterangan dalam kurung, termasuk kurung yang terpotong oleh pemisah ("PT X (Triple B").
          const label = s.replace(/\s*\(.*$/, '').replace(/^\s*(grup|melalui)\s+/i, '').replace(/\)\s*$/, '').trim()
          const en = node('e:' + entityKey(label), label, 'entitas'); en.em.add(t)
          link(pn, en, 'pemilik'); link(en, em(t), 'pengendali')
        })
      for (const r of o.rekamJejak || []) {
        if (r.kode && r.kode !== t && known.has(r.kode)) { pn.em.add(r.kode); link(pn, em(r.kode), 'rekam jejak: ' + (r.peran || '')) }
      }
    }
    const af = p.afiliasi || {}
    if (af.pihakLawan && !FILLER.test(af.pihakLawan)) {
      const nm = String(af.pihakLawan).split(/[,(;]/)[0].trim().slice(0, 60)
      const cn = node('x:' + entityKey(nm), nm, 'pihak'); cn.em.add(t)
      link(em(t), cn, 'pihak lawan / aset target')
    }
    // Pengurus yang merangkap jabatan di emiten radar lain.
    for (const x of [...(p.pengurus?.direksi || []), ...(p.pengurus?.komisaris || [])]) {
      const others = (x.rangkap || []).flatMap(r => codesIn(r, t))
      if (!others.length) continue
      const bn = node('p:' + entityKey(x.nama), x.nama, nodes.has('p:' + entityKey(x.nama)) ? nodes.get('p:' + entityKey(x.nama)).type : 'pengurus')
      bn.em.add(t); link(bn, em(t), x.jabatan || 'pengurus')
      for (const c of others) { bn.em.add(c); link(bn, em(c), 'rangkap jabatan') }
    }
  }
  // Jaringan: hubungkan bila yang disebut orang/entitas yang sudah ada, atau sebuah kode emiten radar.
  for (const t of tickers) {
    for (const o of profil[t].pengendali || []) {
      const pn = nodes.get('p:' + entityKey(o.nama))
      for (const j of o.jaringan || []) {
        const k = entityKey(j.dengan)
        const hit = k && [...nodes.values()].find(n => n !== pn && n.type !== 'emiten' &&
          (entityKey(n.label) === k || (entityKey(n.label).length > 8 && k.includes(entityKey(n.label)))))
        if (hit) link(pn, hit, String(j.hubungan || 'jaringan').slice(0, 60))
        for (const c of codesIn(j.dengan, t)) { pn.em.add(c); link(pn, em(c), 'jaringan') }
      }
    }
  }
  // Pihak yang muncul di Alur saham ≥2 emiten (indeks entitas yang sama dengan "muncul juga di").
  for (const [k, set] of buildEntityIndex(relasi)) {
    const ts = [...set].filter(x => known.has(x))
    if (ts.length < 2) continue
    const ex = [...nodes.values()].find(n => n.type !== 'emiten' && entityKey(n.label) === k)
    const n = ex || node('r:' + k, labelFromRelasi(relasi, ts[0], k) || k, 'entitas')
    for (const t of ts) { n.em.add(t); link(n, em(t), 'alur saham') }
  }
  return { nodes: [...nodes.values()], edges }
}

function labelFromRelasi(relasi, t, k) {
  return (relasi[t]?.nodes || []).find(n => entityKey(n.t) === k)?.t || ''
}

// Penghubung lintas emiten: simpul non-emiten yang menyentuh ≥2 emiten, terbanyak dulu.
export const bridgesOf = G => G.nodes.filter(n => n.type !== 'emiten' && n.em.size >= 2)
  .sort((a, b) => b.em.size - a.em.size || a.label.localeCompare(b.label))

// Subgraf: hanya penghubung lintas emiten beserta emiten dan entitas perantaranya.
export function crossOnly(G) {
  const bridge = new Set(bridgesOf(G).map(n => n.id))
  const keep = new Set(bridge)
  for (const n of G.nodes) if (bridge.has(n.id)) n.em.forEach(t => keep.add('em:' + t))
  const type = new Map(G.nodes.map(n => [n.id, n.type]))
  for (const e of G.edges) {
    if (bridge.has(e.a) && type.get(e.b) === 'entitas') keep.add(e.b)
    if (bridge.has(e.b) && type.get(e.a) === 'entitas') keep.add(e.a)
  }
  return { nodes: G.nodes.filter(n => keep.has(n.id)), edges: G.edges.filter(e => keep.has(e.a) && keep.has(e.b)) }
}

// Jaringan satu emiten: simpul dalam jarak 2 langkah.
export function egoOf(G, t) {
  const root = 'em:' + t, adj = new Map()
  for (const e of G.edges) {
    if (!adj.has(e.a)) adj.set(e.a, []); if (!adj.has(e.b)) adj.set(e.b, [])
    adj.get(e.a).push(e.b); adj.get(e.b).push(e.a)
  }
  const keep = new Set([root])
  for (const a of adj.get(root) || []) { keep.add(a); for (const b of adj.get(a) || []) keep.add(b) }
  const nodes = G.nodes.filter(n => keep.has(n.id))
  return { nodes, edges: G.edges.filter(e => keep.has(e.a) && keep.has(e.b)),
    others: nodes.filter(n => n.type === 'emiten' && n.id !== root).map(n => n.label) }
}

// Tata letak gaya (force-directed) deterministik: posisi awal spiral, tanpa acak, agar stabil antar-render.
export function layoutNet(nodes, edges, W, H, iters = 260) {
  const idx = new Map(nodes.map((n, i) => [n.id, i]))
  const P = nodes.map((n, i) => ({ x: W / 2 + Math.cos(i * 2.4) * (40 + i * 3), y: H / 2 + Math.sin(i * 2.4) * (40 + i * 3) * 0.7, vx: 0, vy: 0 }))
  const E = edges.map(e => [idx.get(e.a), idx.get(e.b)]).filter(([a, b]) => a != null && b != null)
  const k = Math.sqrt(W * H / Math.max(1, nodes.length)) * 0.55
  for (let it = 0; it < iters; it++) {
    const temp = 1 - it / iters
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const dx = P[i].x - P[j].x, dy = P[i].y - P[j].y, d2 = dx * dx + dy * dy || 0.01, f = k * k / d2
      P[i].vx += dx * f; P[i].vy += dy * f; P[j].vx -= dx * f; P[j].vy -= dy * f
    }
    for (const [a, b] of E) {
      const dx = P[b].x - P[a].x, dy = P[b].y - P[a].y, d = Math.hypot(dx, dy) || 0.01, f = (d - k) / d * 0.06
      P[a].vx += dx * f; P[a].vy += dy * f; P[b].vx -= dx * f; P[b].vy -= dy * f
    }
    for (const p of P) {
      p.vx += (W / 2 - p.x) * 0.004; p.vy += (H / 2 - p.y) * 0.006
      const v = Math.hypot(p.vx, p.vy), m = Math.min(v, 18 * temp + 1)
      p.x += p.vx / (v || 1) * m; p.y += p.vy / (v || 1) * m; p.vx *= 0.5; p.vy *= 0.5
      p.x = Math.max(30, Math.min(W - 30, p.x)); p.y = Math.max(20, Math.min(H - 20, p.y))
    }
  }
  return P.map(({ x, y }) => ({ x, y }))
}
