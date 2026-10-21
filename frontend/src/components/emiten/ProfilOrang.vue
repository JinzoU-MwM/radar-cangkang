<script setup>
// Profil pengendali per orang, struktur pengurus, dan afiliasi pihak lawan (profil-pengendali.json).
// Markup disalin dari ControllerDialog supaya tampilan di kartu Analisa sama.
import { computed } from 'vue'
import { relationTone } from '../../lib/emitenExtra.js'

const props = defineProps({ profil: { type: Object, required: true } })
const pengurus = computed(() => [
  ...(props.profil.pengurus?.direksi || []).map(x => ({ ...x, grp: 'Direksi' })),
  ...(props.profil.pengurus?.komisaris || []).map(x => ({ ...x, grp: 'Komisaris' })),
])
const af = computed(() => props.profil.afiliasi?.pihakLawan ? props.profil.afiliasi : null)
const rel = computed(() => relationTone(af.value?.hubungan))
const VER = /terverifikasi/i
const noRisk = r => !r || /^tidak (ditemukan|ada)\b/i.test(r.trim())
</script>

<template>
  <section class="rule-top pf">
    <h2>Profil pengendali ({{ profil.pengendali?.length || 0 }} pihak)</h2>
    <p v-if="profil.ringkas" class="sum">{{ profil.ringkas }}</p>

    <article v-for="o in profil.pengendali || []" :key="o.nama" class="pp">
      <header><b class="pn">{{ o.nama }}</b><span class="small muted">{{ [o.peran, o.entitas].filter(Boolean).join(' · ') }}</span></header>
      <dl class="kv">
        <div><dt>Porsi</dt><dd>{{ o.porsi || 'belum ada' }}</dd></div>
        <div><dt>Latar</dt><dd>{{ o.latar || 'belum ada' }}</dd></div>
        <div><dt>Pengalaman</dt><dd>{{ o.pengalaman || 'belum ada' }}</dd></div>
        <div v-if="o.karakteristik"><dt>Karakter</dt><dd>{{ o.karakteristik }}</dd></div>
        <div v-if="o.jaringan?.length"><dt>Jaringan</dt><dd>
          <ul class="net">
            <li v-for="j in o.jaringan" :key="j.dengan">
              <b>{{ j.dengan }}</b> <span class="tag" :class="VER.test(j.keyakinan || '') ? 't-good' : 't-warn'">{{ VER.test(j.keyakinan || '') ? 'terverifikasi' : 'disebut media' }}</span>
              <span v-if="j.hubungan" class="small muted"> {{ j.hubungan }}</span>
            </li>
          </ul>
        </dd></div>
        <div><dt>Risiko</dt><dd :class="{ flag: !noRisk(o.risiko) }">{{ o.risiko || 'belum ada' }}</dd></div>
      </dl>
      <details v-if="o.sumber?.length" class="more"><summary>Sumber ({{ o.sumber.length }})</summary><ul class="small"><li v-for="x in o.sumber" :key="x">{{ x }}</li></ul></details>
    </article>

    <template v-if="pengurus.length">
      <h3 class="lbl">Struktur direksi & komisaris</h3>
      <div class="scroll">
        <table class="ledger">
          <thead><tr><th class="lbl">Nama</th><th class="lbl">Jabatan</th><th class="lbl">Asal</th><th class="lbl">Latar</th></tr></thead>
          <tbody>
            <tr v-for="x in pengurus" :key="x.grp + x.nama">
              <td><b>{{ x.nama }}</b><div class="small muted">{{ x.grp }}</div></td>
              <td>{{ x.jabatan || 'belum ada' }}<template v-if="x.independen"> <span class="tag t-calm">independen</span></template></td>
              <td><span class="tag" :class="x.orangPengendaliBaru ? 't-good' : 't-calm'">{{ x.orangPengendaliBaru ? 'orang pengendali baru' : 'pengurus lama' }}</span></td>
              <td class="small">{{ x.latar || 'belum ada' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-if="af">
      <h3 class="lbl">Afiliasi pihak lawan transaksi</h3>
      <dl class="kv">
        <div><dt>Pihak lawan</dt><dd>{{ af.pihakLawan }}</dd></div>
        <div v-if="af.pemilikAset"><dt>Pemilik aset</dt><dd>{{ af.pemilikAset }}</dd></div>
        <div><dt>Pengendali/UBO</dt><dd>{{ af.pengendaliPihakLawan || 'belum ada' }}</dd></div>
        <div v-if="af.karakteristik"><dt>Karakteristik</dt><dd>{{ af.karakteristik }}</dd></div>
        <div :class="{ hot: rel }"><dt>Hubungan</dt><dd>
          <span v-if="rel" class="tag t-strong">{{ rel === 'afiliasi' ? 'terafiliasi' : 'perlu dicermati' }}</span>
          {{ af.hubungan || 'belum ada' }}
        </dd></div>
      </dl>
      <details v-if="af.sumber?.length" class="more"><summary>Sumber ({{ af.sumber.length }})</summary><ul class="small"><li v-for="x in af.sumber" :key="x">{{ x }}</li></ul></details>
    </template>

    <details v-if="profil.tidakDitemukan?.length" class="more">
      <summary>Belum ditemukan di sumber publik ({{ profil.tidakDitemukan.length }})</summary>
      <ul class="small"><li v-for="x in profil.tidakDitemukan" :key="x">{{ x }}</li></ul>
    </details>
  </section>
</template>

<style scoped>
.pf h2{margin-bottom:8px}
.sum{margin:0 0 6px;max-width:80ch}
h3.lbl{margin:14px 0 6px}
ul{margin:0;padding-left:18px}
.scroll{overflow-x:auto}
.ledger{font-size:13px}
.more{margin-top:8px}
.more summary{cursor:pointer;font-weight:600;min-height:28px}
.pp{border-top:1px solid var(--rule);padding:8px 0 4px}
.pp+.pp{margin-top:8px}
.pp header{display:flex;flex-direction:column;margin-bottom:4px}
.pn{font-size:15px}
.flag{color:var(--strong)}
/* Baris label-isi bergaris, label sempit di kiri. */
.kv{margin:0;font-size:13.5px}
.kv>div{display:grid;grid-template-columns:120px 1fr;gap:12px;padding:6px 0;border-bottom:1px solid var(--rule-2)}
.kv dt{font:600 12.5px var(--f-display);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.kv dd{margin:0;max-width:80ch}
.kv>div.hot{background:var(--strong-bg);padding-left:8px;padding-right:8px}
.net{list-style:none;padding:0;margin:0}
.net li{margin:2px 0 4px}
@media (max-width:760px){.kv>div{grid-template-columns:1fr;gap:2px}}
</style>
