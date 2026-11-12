<script setup>
// Tab Screening halaman Harmonic Pattern: saham BEI yang sedang membentuk pola harmonik dari screening malam server
// (/api/harmonik, saham likuid), dengan alasan (rasio aktual vs kriteria pola, konfirmasi di D, jarak ke PRZ).
// Klik baris membuka chart saham itu di tab Saham dengan XABCD aktif.
import { computed, onMounted, ref } from 'vue'
import { api } from '../api.js'
import { HM_STATUS, hitungHarmonik, rentang } from '../lib/harmonik.js'

const emit = defineEmits(['buka'])
const data = ref(null), err = ref('')
onMounted(() => api.get('/api/harmonik').then(v => { data.value = v }, e => { err.value = e.message || String(e) }))

const fStatus = ref('semua'), fArah = ref('semua'), fRadar = ref(false), q = ref(''), fPola = ref('')
const rows = computed(() => data.value?.rows || [])
const n = computed(() => hitungHarmonik(rows.value))
const tampil = computed(() => {
  const x = q.value.trim().toLowerCase()
  return rows.value.filter(r => (fStatus.value === 'semua' || r.status === fStatus.value) && (fArah.value === 'semua' || r.arah === fArah.value)
    && (!fPola.value || r.pola === fPola.value)
    && (!fRadar.value || r.radar) && (!x || r.t.toLowerCase().startsWith(x) || (r.nama || '').toLowerCase().includes(x)))
})
const kriteria = computed(() => Object.fromEntries((data.value?.pola || []).map(p => [p.k, p])))
// Jenis pola yang muncul di hasil, untuk saringan.
const jenisPola = computed(() => [...new Set(rows.value.map(r => r.pola))].map(k => ({ k, nama: kriteria.value[k]?.nama || k, n: rows.value.filter(r => r.pola === k).length })))
const fh = v => v == null ? '–' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: v < 200 ? 1 : 0 })
const fr = v => v == null ? '–' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: 3 })

// Alasan: rasio terukur dibanding kriteria pola di server (B dari XA, C dari AB atau XC dari XA).
function alasan(r) {
  if (r.alasan?.length) return r.alasan.join(' · ')   // server baru: rasio aktual vs kriteria materi
  const p = kriteria.value[r.pola] || {}, a = r.rasio || {}, out = []
  if (a.b != null) out.push(`B ${fr(a.b)} XA (kriteria ${rentang(p.b)})`)
  if (a.c != null) out.push(`C ${fr(a.c)} AB (kriteria ${rentang(p.c)})`)
  if (a.cx != null) out.push(`C ${fr(a.cx)} XA, melewati A (kriteria ${rentang(p.cx)})`)
  if (p.d) out.push(`D di ${rentang(p.d)} XA`)
  if (p.dxc) out.push(`D di ${rentang(p.dxc)} XC`)
  return out.join(' · ')
}
const posisi = r => r.status === 'menuju' ? `${fh(r.jarak)}% dari PRZ` : r.status === 'berbalik' && r.reaksi != null ? `reaksi ${r.reaksi > 0 ? '+' : ''}${fh(r.reaksi)}% dari D` : 'di dalam PRZ'
</script>

<template>
  <section class="sc">
    <header class="kepala">
      <div>
        <h2>Screening Harmonic Pattern</h2>
        <p class="small mute" v-if="data">Diperbarui {{ data.updated || '–' }} · {{ data.dinilai }} saham likuid dinilai (nilai transaksi rata-rata minimal Rp{{ fh((data.minNilai || 1e9) / 1e9) }} miliar per hari) · {{ rows.length }} pola aktif. Klik baris untuk membuka chartnya.</p>
      </div>
    </header>
    <p v-if="err" class="err" role="alert">{{ err }}</p>
    <p v-else-if="!data" class="small mute">Memuat hasil screening…</p>
    <template v-else>
      <div class="saring">
        <div class="seg" role="group" aria-label="Status pola">
          <button v-for="s in ['semua', 'prz', 'berbalik', 'menuju']" :key="s" type="button" :class="{ on: fStatus === s }" @click="fStatus = s">
            {{ s === 'semua' ? 'Semua' : HM_STATUS[s][0] }} <b>{{ n[s] || 0 }}</b></button>
        </div>
        <div class="seg" role="group" aria-label="Arah pola">
          <button v-for="a in ['semua', 'bullish', 'bearish']" :key="a" type="button" :class="{ on: fArah === a }" @click="fArah = a">{{ a === 'semua' ? 'Semua arah' : a }} <b v-if="a !== 'semua'">{{ n[a] || 0 }}</b></button>
        </div>
        <select v-model="fPola" class="sel" aria-label="Jenis pola">
          <option value="">Semua pola</option>
          <option v-for="p in jenisPola" :key="p.k" :value="p.k">{{ p.nama }} ({{ p.n }})</option>
        </select>
        <label class="small"><input v-model="fRadar" type="checkbox" /> Hanya saham radar</label>
        <input v-model="q" class="q" placeholder="Cari kode/nama" aria-label="Cari kode atau nama saham" />
      </div>
      <div class="wrap">
        <table class="tb">
          <thead><tr><th>Saham</th><th>Pola</th><th>Status</th><th class="r">Harga</th><th class="r">PRZ</th><th>Posisi harga</th><th>Alasan</th><th>Konfirmasi di D</th><th class="r">Stop / Target</th></tr></thead>
          <tbody>
            <tr v-for="r in tampil" :key="[r.t, r.pola, r.arah, r.status, ...r.titik.map(x => x.d)].join('|')" tabindex="0" @click="emit('buka', r)" @keydown.enter="emit('buka', r)">
              <td><b class="kode">{{ r.t }}</b><span v-if="r.radar" class="tag">radar</span><br><span class="small mute">{{ r.nama }}</span></td>
              <td :class="r.arah === 'bullish' ? 'up' : 'dn'"><b>{{ kriteria[r.pola]?.nama || r.pola }}</b><br>{{ r.arah }}</td>
              <td><span class="st" :class="r.status">{{ HM_STATUS[r.status][0] }}</span></td>
              <td class="r">{{ fh(r.harga) }}</td>
              <td class="r">{{ fh(r.prz[0]) }}–{{ fh(r.prz[1]) }}</td>
              <td class="small">{{ posisi(r) }}</td>
              <td class="small">{{ alasan(r) }}</td>
              <td class="small">{{ r.konfirmasi?.length ? r.konfirmasi.join(', ') : (r.status === 'menuju' ? 'D belum terbentuk' : 'belum ada') }}</td>
              <td class="r small"><span class="dn">{{ fh(r.stop) }}</span> / <span class="up">{{ fh(r.target?.[0]) }}, {{ fh(r.target?.[1]) }}</span></td>
            </tr>
            <tr v-if="!tampil.length"><td colspan="9" class="small mute">Tidak ada pola yang cocok dengan saringan ini.</td></tr>
          </tbody>
        </table>
      </div>
      <p class="small mute">Screening malam memakai aturan yang sama dengan tab Saham: Gartley, Bat, Alternate Bat, Butterfly, Crab, Deep Crab, Cypher, Shark, 5-0, Three Drives, AB=CD, dan Alternate AB=CD pada candle harian (maksimal empat pola per saham; pola "menuju" hanya bila harga dalam 12% dari PRZ; AB=CD hanya bila D sudah di PRZ). Status: Di PRZ = D sedang terbentuk di zona; Berbalik = D terkonfirmasi dan harga mulai berbalik; Menuju = X-A-B-C terbentuk, D belum.</p>
    </template>
  </section>
</template>

<style scoped>
.sc{display:grid;gap:10px}
.kepala h2{font-family:var(--f-display);margin:0 0 2px}
.kepala p{margin:0}
.saring{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.seg{display:flex;gap:2px;flex-wrap:wrap}
.seg button{border:1px solid var(--rule);background:var(--sheet);color:var(--ink-2);border-radius:14px;padding:4px 10px;cursor:pointer;font:600 12px var(--f-body);text-transform:capitalize}
.seg button.on{background:var(--accent-soft);color:var(--accent-ink);border-color:transparent}
.seg b{font-family:var(--f-data);margin-left:2px}
.sel{font:13px var(--f-body);padding:5px 8px;border:1px solid var(--rule);border-radius:6px;background:var(--sheet);color:var(--ink)}
.q{font:13px var(--f-body);padding:5px 10px;border:1px solid var(--rule);border-radius:6px;background:var(--sheet);color:var(--ink);margin-left:auto}
.wrap{overflow-x:auto;border:1px solid var(--rule);border-radius:8px;background:var(--sheet)}
.tb{border-collapse:collapse;width:100%;font-size:13px}
.tb th,.tb td{padding:7px 9px;border-bottom:1px solid var(--rule-2);text-align:left;vertical-align:top}
.tb th{background:var(--sheet-2);color:var(--ink-2);font-weight:600;white-space:nowrap;position:sticky;top:0}
.tb .r{text-align:right;white-space:nowrap}
.tb tbody tr{cursor:pointer}
.tb tbody tr:hover,.tb tbody tr:focus{background:var(--zebra);outline:none}
.kode{font-family:var(--f-data)}
.tag{margin-left:6px;font-size:10px;padding:1px 5px;border-radius:8px;background:var(--accent-soft);color:var(--accent-ink)}
.st{font-size:11px;font-weight:700;padding:2px 7px;border-radius:10px;white-space:nowrap}
.st.prz{background:var(--warn-bg);color:var(--warn)}.st.berbalik{background:var(--good-bg);color:var(--good)}.st.menuju{background:var(--calm-bg);color:var(--calm)}
.up{color:var(--good)}.dn{color:var(--strong)}.mute{color:var(--ink-2)}.small{font-size:12px}
.err{color:var(--strong)}
</style>
