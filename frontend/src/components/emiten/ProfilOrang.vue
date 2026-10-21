<script setup>
// Profil pengendali per orang, struktur pengurus, dan afiliasi pihak lawan (profil-pengendali.json),
// termasuk hasil riset pendalaman: rekam jejak, grup usaha, perkara, riwayat & rangkap jabatan pengurus,
// rantai kepemilikan aset target, keuangan target, dan temuan hubungan tidak langsung.
// Dipakai di kartu Analisa dan dialog pengendali (satu markup).
import { computed } from 'vue'
import { relationTone } from '../../lib/emitenExtra.js'
import { yakinOf, perkaraState, risikoText, chainLayers, boardStats } from '../../lib/profil.js'
import TickerText from '../TickerText.vue'

const props = defineProps({ profil: { type: Object, required: true }, title: { type: String, default: '' } })
const pengurus = computed(() => [
  ...(props.profil.pengurus?.direksi || []).map(x => ({ ...x, grp: 'Direksi' })),
  ...(props.profil.pengurus?.komisaris || []).map(x => ({ ...x, grp: 'Komisaris' })),
])
const board = computed(() => boardStats(props.profil.pengurus))
const af = computed(() => props.profil.afiliasi?.pihakLawan ? props.profil.afiliasi : null)
const rel = computed(() => relationTone(af.value?.hubungan))
const layers = computed(() => chainLayers(af.value?.strukturKepemilikan))
// Kalimat pertama (maks. ±180 karakter) sebagai ringkasan satu baris.
const firstSentence = t => { const m = String(t || '').match(/^.{20,180}?[.;](\s|$)/); return m ? m[0].trim() : String(t || '').slice(0, 180) + (String(t || '').length > 180 ? '…' : '') }
</script>

<template>
  <section class="rule-top pf">
    <h2>{{ title || `Profil pengendali (${profil.pengendali?.length || 0} pihak)` }}</h2>
    <p v-if="profil.ringkas" class="sum"><TickerText :text="profil.ringkas" /></p>

    <article v-for="o in profil.pengendali || []" :key="o.nama" class="pp">
      <header><b class="pn">{{ o.nama }}</b><span class="small muted">{{ [o.peran, o.entitas].filter(Boolean).join(' · ') }}</span></header>
      <dl class="kv">
        <div><dt>Porsi</dt><dd>{{ o.porsi || 'belum ada' }}</dd></div>
        <div><dt>Latar</dt><dd>{{ o.latar || 'belum ada' }}</dd></div>
        <div><dt>Pengalaman</dt><dd><TickerText v-if="o.pengalaman" :text="o.pengalaman" /><template v-else>belum ada</template></dd></div>
        <div v-if="o.rekamJejak?.length"><dt>Rekam jejak</dt><dd>
          <ul class="rj">
            <!-- Satu baris per emiten; paragraf hasil dan sumber dilipat di "Rincian". -->
            <li v-for="(r, i) in o.rekamJejak" :key="i">
              <div class="rjh">
                <span v-if="r.kode" class="rk"><TickerText :text="r.kode" /></span>
                <b>{{ r.entitas }}</b>
                <span class="tag" :class="yakinOf(r.keyakinan).cls">{{ yakinOf(r.keyakinan).label }}</span>
              </div>
              <div v-if="r.peran || r.periode" class="small muted">{{ [r.peran, r.periode].filter(Boolean).join(' · ') }}</div>
              <div v-if="r.hasil" class="small lead1"><TickerText :text="firstSentence(r.hasil)" /></div>
              <details v-if="r.hasil && r.hasil.length > firstSentence(r.hasil).length + 5 || r.sumber" class="rjd">
                <summary class="small">Rincian</summary>
                <div v-if="r.hasil" class="small"><TickerText :text="r.hasil" /></div>
                <div v-if="r.sumber" class="small muted src">{{ r.sumber }}</div>
              </details>
            </li>
          </ul>
        </dd></div>
        <div v-if="o.perusahaan?.length"><dt>Grup usaha</dt><dd>
          <ul class="co">
            <li v-for="(c, i) in o.perusahaan" :key="i" :title="c.sumber || ''"><b>{{ c.nama }}</b><span class="small muted">{{ [c.peran, c.bidang].filter(Boolean).map(s => ' · ' + s).join('') }}</span></li>
          </ul>
        </dd></div>
        <div v-if="perkaraState(o.perkara) !== 'belum'" :class="{ hot: perkaraState(o.perkara) === 'ada' }"><dt>Perkara & sanksi</dt><dd>
          <template v-if="perkaraState(o.perkara) === 'bersih'"><span class="tag t-good">bersih</span> Tidak ditemukan perkara bisnis, PKPU/pailit, atau sanksi OJK/BEI di sumber publik.</template>
          <ul v-else class="net">
            <li v-for="(c, i) in o.perkara" :key="i">
              <b>{{ c.jenis || 'Perkara' }}{{ c.tahun ? ' · ' + c.tahun : '' }}</b> <span class="tag" :class="yakinOf(c.keyakinan).cls">{{ yakinOf(c.keyakinan).label }}</span>
              <div>{{ c.uraian }}</div>
              <div v-if="c.status" class="small muted">Status: {{ c.status }}</div>
              <div v-if="c.sumber" class="small muted">{{ c.sumber }}</div>
            </li>
          </ul>
        </dd></div>
        <div v-if="o.karakteristik"><dt>Karakter</dt><dd>{{ o.karakteristik }}</dd></div>
        <div v-if="o.jaringan?.length"><dt>Jaringan</dt><dd>
          <ul class="net">
            <li v-for="j in o.jaringan" :key="j.dengan">
              <b><TickerText :text="j.dengan" /></b> <span class="tag" :class="yakinOf(j.keyakinan).cls">{{ yakinOf(j.keyakinan).label }}</span>
              <span v-if="j.hubungan" class="small muted"> {{ j.hubungan }}</span>
            </li>
          </ul>
        </dd></div>
        <div><dt>Risiko</dt><dd :class="{ flag: !!risikoText(o.risiko) }">{{ risikoText(o.risiko) || o.risiko || 'belum ada' }}</dd></div>
      </dl>
      <details v-if="o.sumber?.length" class="more"><summary>Sumber ({{ o.sumber.length }})</summary><ul class="small"><li v-for="x in o.sumber" :key="x">{{ x }}</li></ul></details>
    </article>

    <template v-if="pengurus.length">
      <h3 class="lbl">Struktur direksi & komisaris <span class="muted">({{ board.n }} orang · {{ board.baru }} orang pengendali baru)</span></h3>
      <div class="scroll">
        <table class="ledger">
          <thead><tr><th class="lbl">Nama</th><th class="lbl">Jabatan</th><th class="lbl">Asal</th><th class="lbl">Latar, riwayat & hubungan</th></tr></thead>
          <tbody>
            <tr v-for="x in pengurus" :key="x.grp + x.nama">
              <td><b>{{ x.nama }}</b><div class="small muted">{{ x.grp }}</div></td>
              <td>{{ x.jabatan || 'belum ada' }}<template v-if="x.independen"> <span class="tag t-calm">independen</span></template></td>
              <td><span class="tag" :class="x.orangPengendaliBaru ? 't-good' : 't-calm'">{{ x.orangPengendaliBaru ? 'orang pengendali baru' : 'pengurus lama' }}</span></td>
              <td class="small">
                {{ x.latar || 'belum ada' }}
                <div v-if="x.riwayat?.length" class="mini"><b>Riwayat:</b> {{ x.riwayat.join(' · ') }}</div>
                <div v-if="x.rangkap?.length" class="mini"><b>Rangkap jabatan:</b> <template v-for="(r, i) in x.rangkap" :key="i"><template v-if="i"> · </template><TickerText :text="r" /></template></div>
                <div v-if="x.hubungan" class="mini" :class="{ relt: /pengendali|pihak lawan|afiliasi/i.test(x.hubungan) }">
                  <b>Hubungan:</b> <TickerText :text="x.hubungan" />
                  <span v-if="x.keyakinan" class="tag" :class="yakinOf(x.keyakinan).cls">{{ yakinOf(x.keyakinan).label }}</span>
                </div>
              </td>
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
        <div v-if="layers.length"><dt>Rantai kepemilikan</dt><dd>
          <p class="small muted chain-note">Lapis 1 = pemegang langsung, berlanjut sampai UBO.</p>
          <div class="chain">
            <template v-for="(L, i) in layers" :key="L.lapis">
              <span v-if="i" class="arr" aria-hidden="true"></span>
              <div class="lv">
                <span class="lbl">Lapis {{ L.lapis }}</span>
                <div v-for="(c, j) in L.items" :key="j" class="node"><b>{{ c.pemilik || 'belum ada' }}</b><span class="small muted">{{ c.porsi ? c.porsi + ' · ' : '' }}di {{ c.entitas }}</span></div>
              </div>
            </template>
          </div>
        </dd></div>
        <div v-if="af.keuanganTarget"><dt>Keuangan target</dt><dd>{{ af.keuanganTarget }}</dd></div>
        <div v-if="af.karakteristik"><dt>Karakteristik</dt><dd>{{ af.karakteristik }}</dd></div>
        <div :class="{ hot: rel }"><dt>Hubungan</dt><dd>
          <span v-if="rel" class="tag t-strong">{{ rel === 'afiliasi' ? 'terafiliasi' : 'perlu dicermati' }}</span>
          <TickerText :text="af.hubungan || 'belum ada'" />
        </dd></div>
        <div v-if="af.temuanTersembunyi?.length" class="hot-warn"><dt>Temuan tidak langsung</dt><dd>
          <ul class="net">
            <li v-for="(h, i) in af.temuanTersembunyi" :key="i">
              <TickerText :text="h.temuan" /> <span class="tag" :class="yakinOf(h.keyakinan).cls">{{ yakinOf(h.keyakinan).label }}</span>
              <div v-if="h.sumber" class="small muted">{{ h.sumber }}</div>
            </li>
          </ul>
        </dd></div>
        <div v-if="perkaraState(af.perkaraPihakLawan) !== 'belum'" :class="{ hot: perkaraState(af.perkaraPihakLawan) === 'ada' }"><dt>Perkara pihak lawan</dt><dd>
          <template v-if="perkaraState(af.perkaraPihakLawan) === 'bersih'"><span class="tag t-good">bersih</span> Tidak ditemukan di sumber publik.</template>
          <ul v-else class="net">
            <li v-for="(c, i) in af.perkaraPihakLawan" :key="i">
              <b>{{ c.jenis || 'Perkara' }}{{ c.tahun ? ' · ' + c.tahun : '' }}</b> <span class="tag" :class="yakinOf(c.keyakinan).cls">{{ yakinOf(c.keyakinan).label }}</span>
              <div>{{ c.uraian }}</div>
              <div v-if="c.status" class="small muted">Status: {{ c.status }}</div>
            </li>
          </ul>
        </dd></div>
      </dl>
      <details v-if="af.sumber?.length" class="more"><summary>Sumber ({{ af.sumber.length }})</summary><ul class="small"><li v-for="x in af.sumber" :key="x">{{ x }}</li></ul></details>
    </template>

    <details v-if="profil.koreksi?.length" class="more">
      <summary>Koreksi atas data sebelumnya ({{ profil.koreksi.length }})</summary>
      <ul class="small"><li v-for="x in profil.koreksi" :key="x">{{ x }}</li></ul>
    </details>
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
.kv>div{display:grid;grid-template-columns:120px minmax(0,1fr);gap:12px;padding:6px 0;border-bottom:1px solid var(--rule-2)}
.kv dt{font:600 12.5px var(--f-display);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.kv dd{margin:0;max-width:80ch;min-width:0}
.kv>div.hot{background:var(--strong-bg);padding-left:8px;padding-right:8px}
.kv>div.hot-warn{background:var(--warn-bg);padding-left:8px;padding-right:8px}
.net,.rj,.co{list-style:none;padding:0;margin:0}
.net li,.rj li{margin:2px 0 6px}
.rj li{border-left:2px solid var(--rule);padding-left:8px}
.rjh{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 8px}
.rk{font-family:var(--f-display);font-size:15px}
.lead1{margin-top:2px}
.rjd summary{cursor:pointer;color:var(--accent);font-weight:600;min-height:24px;display:inline-flex;align-items:center}
.rjd > div{margin-top:4px;max-width:80ch}
.src{overflow-wrap:anywhere}
.co{display:flex;flex-wrap:wrap;gap:4px 14px}
.tag{margin-left:2px}
.tk{font-weight:700;color:var(--accent);text-decoration:underline dotted}
.mini{margin-top:4px;color:var(--ink-2)}
.mini b{color:var(--ink)}
.relt{background:var(--warn-bg);padding:2px 5px}
.chain-note{margin:0 0 4px}
.chain{display:flex;flex-wrap:wrap;align-items:flex-start;gap:6px}
.lv{display:grid;gap:4px;align-content:start}
.node{display:grid;gap:1px;border:1px solid var(--rule);background:var(--sheet);padding:5px 8px;max-width:260px}
.arr{align-self:center;width:9px;height:9px;border-top:2px solid var(--ink-2);border-right:2px solid var(--ink-2);transform:rotate(45deg);margin:0 4px}
@media (max-width:760px){.kv>div{grid-template-columns:1fr;gap:2px}}
</style>
