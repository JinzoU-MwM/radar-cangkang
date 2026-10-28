<script setup>
// Astronacci: gabungan siklus bulan (Financial Astrology) dan Fibonacci untuk IHSG dari /api/ihsg-astro.
// Level harga Fibonacci (retracement/ekstensi), hitungan waktu Fibonacci dari titik balik utama, fase bulan
// berikutnya (dihitung astronomis), jendela waktu bila keduanya berdekatan, dan uji historis keandalannya.
import { computed, ref } from 'vue'
import { api } from '../api.js'
import { fmt, fmtDate } from '../lib/domain.js'

const d = ref(null), err = ref('')
api.get('/api/ihsg-astro').then(r => { if (r.error) err.value = r.error; else d.value = r }, e => { err.value = e.message || String(e) })

const n0 = v => v == null ? '–' : Math.round(v).toLocaleString('id-ID')
const pct = v => v == null ? '–' : (v > 0 ? '+' : '') + fmt(v, 2) + '%'
const IKON = { 'Bulan baru': '●', 'Kuartal pertama': '◐', Purnama: '○', 'Kuartal akhir': '◑' }
const hariIni = new Date().toISOString().slice(0, 10)

// Tangga level: gabungan level dua ayunan + harga kini, urut dari atas.
const tangga = computed(() => {
  if (!d.value) return []
  const rows = d.value.ayunan.flatMap(a => a.level.map(l => ({ ...l, ay: a.nama.startsWith('Ayunan besar') ? '1 tahun' : '60 hari' })))
  rows.push({ v: d.value.harga, kini: true })
  return rows.sort((a, b) => b.v - a.v)
})
const jarak = v => (v / d.value.harga - 1) * 100
</script>

<template>
  <section class="as">
    <p class="small muted intro">Perhitungan <b>Astronacci</b>: menggabungkan <b>siklus bulan</b> (Financial Astrology) dengan <b>Fibonacci</b> harga dan waktu untuk IHSG.
      Fase bulan dihitung astronomis (waktu WIB); level dan tanggal Fibonacci dihitung otomatis dari titik balik harga harian 1 tahun.</p>
    <p v-if="err" class="muted">{{ err }}</p>
    <p v-else-if="!d" class="muted">Menghitung siklus bulan dan Fibonacci…</p>
    <template v-else>
      <div class="top">
        <article class="card">
          <div class="lbl">IHSG {{ fmtDate(d.tanggal) }}</div>
          <div class="big">{{ n0(d.harga) }}</div>
          <div class="small">Support Fibonacci: <b>{{ d.support.map(n0).join(' · ') || '–' }}</b></div>
          <div class="small">Resistance Fibonacci: <b>{{ d.resistance.map(n0).join(' · ') || '–' }}</b></div>
        </article>
        <article class="card">
          <div class="lbl">Fase bulan berikutnya</div>
          <ul class="fase">
            <li v-for="f in d.fase" :key="f.tgl + f.fase" :class="{ utama: f.utama }"><span class="ik" aria-hidden="true">{{ IKON[f.fase] }}</span>
              <b>{{ f.fase }}</b> <span class="muted">{{ fmtDate(f.tgl) }} · {{ f.jam }} WIB</span></li>
          </ul>
        </article>
        <article class="card">
          <div class="lbl">Jendela waktu (Fibonacci × bulan)</div>
          <ul v-if="d.jendela.length" class="fase">
            <li v-for="w in d.jendela" :key="w.tgl + w.dari" :class="{ dekat: w.tgl >= hariIni }"><b>{{ fmtDate(w.tgl) }}</b>
              <span class="small muted">· {{ w.hitungan }} hari bursa dari {{ w.dari }} · dekat {{ fmtDate(w.bulan) }}</span></li>
          </ul>
          <p v-else class="small muted">Tidak ada tanggal Fibonacci yang berdekatan dengan bulan baru/purnama dalam 75 hari ke depan.</p>
        </article>
      </div>

      <div class="grid2">
        <div>
          <h3 class="lbl">Tangga level Fibonacci</h3>
          <table class="ledger">
            <thead><tr><th>Level</th><th>Ayunan</th><th class="r">Harga</th><th class="r">Jarak</th></tr></thead>
            <tbody>
              <tr v-for="(l, i) in tangga" :key="i" :class="{ kini: l.kini }">
                <td v-if="l.kini" colspan="2"><b>Harga kini</b></td>
                <template v-else><td>{{ l.jenis }} {{ fmt(l.rasio * 100, 1) }}%</td><td class="small muted">{{ l.ay }}</td></template>
                <td class="r num">{{ n0(l.v) }}</td>
                <td class="r small" :class="l.kini ? '' : jarak(l.v) > 0 ? 'c-good' : 'c-strong'">{{ l.kini ? '' : pct(jarak(l.v)) }}</td>
              </tr>
            </tbody>
          </table>
          <p v-for="a in d.ayunan" :key="a.nama" class="small muted">{{ a.nama }}: {{ a.arah }} dari {{ fmtDate(a.dari) }} ke {{ fmtDate(a.ke) }} ({{ n0(a.rendah) }}–{{ n0(a.tinggi) }}).</p>
        </div>
        <div>
          <h3 class="lbl">Hitungan waktu Fibonacci</h3>
          <table class="ledger">
            <thead><tr><th>Tanggal</th><th>Dari titik balik</th><th class="r">Hitungan</th></tr></thead>
            <tbody>
              <tr v-for="w in d.waktu" :key="w.tgl + w.dari" :class="{ kini: w.bulan }">
                <td><b>{{ fmtDate(w.tgl) }}</b><span v-if="w.bulan" class="tag t-calm">dekat fase bulan</span></td>
                <td class="small">{{ w.dari }}</td><td class="r">{{ w.hitungan }}</td>
              </tr>
            </tbody>
          </table>

          <h3 class="lbl">Uji historis 1 tahun</h3>
          <table class="ledger">
            <thead><tr><th>Fase</th><th class="r">Kejadian</th><th class="r" title="Persentase fase bulan yang diikuti titik balik IHSG dalam ±2 hari bursa">Titik balik ±2 hari</th><th class="r">Hari acak</th><th class="r">Return 5 hari</th></tr></thead>
            <tbody>
              <tr v-for="u in d.uji" :key="u.fase">
                <td>{{ IKON[u.fase] }} {{ u.fase }}</td><td class="r">{{ u.n }}</td>
                <td class="r" :class="u.balik - u.acak >= 10 ? 'c-good' : 'muted'"><b>{{ u.balik }}%</b></td><td class="r muted">{{ u.acak }}%</td>
                <td class="r small">{{ pct(u.ret5) }} <span class="muted">(naik {{ u.naik5 }}%)</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p class="verdict">{{ d.kesimpulan }}</p>
      <p class="small muted">{{ d.catatan }}</p>
    </template>
  </section>
</template>

<style scoped>
.intro{margin:0 0 12px;max-width:95ch}
.top{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-bottom:14px}
.card{border:1px solid var(--rule);background:var(--sheet);padding:10px 14px}
.big{font:700 28px/1.1 var(--f-display);margin:4px 0}
.fase{list-style:none;margin:6px 0 0;padding:0;font-size:13px}.fase li{padding:3px 0;border-bottom:1px solid var(--rule-2)}
.fase li.utama b,.fase li.dekat b{color:var(--now-ink)}
.ik{display:inline-block;width:18px;text-align:center}
.grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}
.r{text-align:right}.num{font-weight:700;white-space:nowrap}
tr.kini td{background:var(--accent-soft)}
.tag{margin-left:6px}
.lbl{margin:10px 0 6px}
.verdict{padding:8px 12px;background:var(--sheet);border-left:3px solid var(--now-ink);font-weight:600}
@media (max-width:860px){.grid2{grid-template-columns:1fr}}
</style>
