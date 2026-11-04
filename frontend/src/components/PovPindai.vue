<script setup>
// Pemindai calon cangkang (server, tiap malam 01.30 WIB, bergiliran) + alarm penjual cangkang & broker market maker,
// peta grup pengendali, dan ringkasan harian siap salin. Klik saham -> buka analisa mendalam (emit 'pilih').
import { computed, ref } from 'vue'
import { api } from '../api.js'
import { fmt } from '../lib/domain.js'

const emit = defineEmits(['pilih'])
const data = ref(null), err = ref(''), tab = ref('pindai'), cari = ref(''), disalin = ref(false)
api.get('/api/pindai').then(r => { data.value = r }, e => { err.value = e.message || String(e) })
const TAB = [['pindai', 'Pemindai calon cangkang'], ['alarm', 'Alarm'], ['peta', 'Peta grup pengendali'], ['ringkas', 'Ringkasan harian']]
const rows = computed(() => {
  const q = cari.value.trim().toUpperCase()
  return (data.value?.rows || []).filter(r => !q || r.t.includes(q) || (r.nama || '').toUpperCase().includes(q) || (r.pengendali || '').toUpperCase().includes(q))
})
const peta = computed(() => {
  const q = cari.value.trim().toUpperCase()
  return (data.value?.peta || []).filter(p => !q || p.nama.toUpperCase().includes(q) || p.aktif.some(([t]) => t.includes(q)) || p.keluar.some(([t]) => t.includes(q)))
})
const p2 = v => v == null ? '–' : fmt(v, 2) + '%'
const rpM = v => v == null ? '–' : (v > 0 ? '+' : '') + 'Rp' + fmt(v / 1e9, 2) + ' M'
async function salin() {
  try { await navigator.clipboard.writeText(data.value?.ringkasan?.teks || ''); disalin.value = true; setTimeout(() => { disalin.value = false }, 2000) } catch {}
}
</script>

<template>
  <section class="pp rule-top">
    <h2>Radar calon cangkang</h2>
    <p class="small muted">Analisa mendalam otomatis (kepemilikan, afiliasi, backdoor, bandar) untuk saham Kandidat, radar, dan Saham 50, bergiliran tiap malam
      pukul 01.30 WIB<template v-if="data?.updated"> · terakhir {{ data.updated }}</template><template v-if="data?.jalan?.aktif"> · sedang memindai {{ data.jalan.selesai }}/{{ data.jalan.total }}</template>.</p>
    <p v-if="err" class="small c-strong">{{ err }}</p>
    <p v-else-if="!data" class="small muted">Memuat…</p>
    <p v-else-if="!data.rows.length" class="small muted">Pemindaian pertama sedang disiapkan server (± 15 menit setelah deploy, lalu bertahap).</p>
    <template v-else>
      <div class="flt" role="tablist">
        <button v-for="[k, l] in TAB" :key="k" type="button" role="tab" class="pill sm" :aria-selected="String(tab === k)" :aria-pressed="String(tab === k)" @click="tab = k">
          {{ l }}<span v-if="k === 'alarm' && data.alarm.length" class="muted"> {{ data.alarm.length }}</span></button>
        <input v-if="tab === 'pindai' || tab === 'peta'" v-model="cari" type="search" class="cari" placeholder="Cari kode, nama, atau pihak…" aria-label="Cari" />
      </div>

      <div v-if="tab === 'pindai'" class="scroll">
        <table class="ledger small">
          <thead><tr><th>Saham</th><th class="num">Skor backdoor</th><th>Arah teratas</th><th>Pengendali</th><th class="num">Terafiliasi</th><th class="num">Bandar 1 bln</th><th>Tanda utama</th></tr></thead>
          <tbody><tr v-for="r in rows" :key="r.t" class="row" tabindex="0" @click="emit('pilih', r.t)" @keydown.enter="emit('pilih', r.t)">
            <td><b>{{ r.t }}</b> <span v-if="r.radar" class="tag t-calm">radar</span><div class="muted nm">{{ r.nama }}</div></td>
            <td class="num"><b :class="r.skor >= 70 ? 'c-good' : ''">{{ r.skor }}</b></td>
            <td>{{ r.arah || '–' }}<span v-if="r.skorArah" class="muted"> ({{ r.skorArah }})</span></td>
            <td>{{ r.pengendali || '–' }} <span class="muted">{{ p2(r.pctPengendali) }}</span></td>
            <td class="num">{{ p2(r.terafiliasi) }}</td>
            <td class="num" :class="(r.bandar30 || 0) > 0 ? 'c-good' : 'c-strong'">{{ rpM(r.bandar30) }}</td>
            <td><b v-if="r.jejak.length">Penjual cangkang. </b>{{ (r.bersamaan[0] || r.gantiPengendali[0] || r.bukti[0] || '').slice(0, 130) }}</td>
          </tr></tbody>
        </table>
        <p class="small muted">Klik baris untuk membuka analisa mendalam lengkap. Skor dari tanda-tanda yang biasa mendahului backdoor; bukan rekomendasi.</p>
      </div>

      <div v-else-if="tab === 'alarm'">
        <p v-if="!data.alarm.length" class="small muted">Belum ada alarm dari pemindaian terakhir.</p>
        <div v-for="a in data.alarm" :key="a.teks" class="al" :class="a.jenis === 'penjual cangkang' ? 'pc' : ''">
          <span class="tag" :class="a.jenis === 'penjual cangkang' ? 't-warn' : 't-calm'">{{ a.jenis }}</span>
          <a href="#" @click.prevent="emit('pilih', a.t)"><b>{{ a.t }}</b></a> — {{ a.teks }}
        </div>
        <p class="small muted">Penjual cangkang: pihak yang pernah melepas emiten saat emiten itu berganti pengendali, lalu masuk/menambah saham lain
          ({{ Object.keys(data.penjual || {}).length }} pihak dipantau). Broker market maker: broker yang dipakai orang dalam kembali menjadi pembeli utama 1 minggu.</p>
      </div>

      <div v-else-if="tab === 'peta'">
        <p v-if="!peta.length" class="small muted">Belum ada pihak dengan 2+ emiten di data pemindaian.</p>
        <div v-for="p in peta" :key="p.nama" class="pg">
          <b>{{ p.nama }}</b>
          <div class="small"><span v-for="[t, pct] in p.aktif" :key="t" class="tag t-calm chip" @click="emit('pilih', t)">{{ t }} {{ pct ? p2(pct) : '' }}</span>
            <span v-for="[t, tgl] in p.keluar" :key="'k' + t" class="tag t-warn chip" :title="'dilepas ' + (tgl || '')" @click="emit('pilih', t)">{{ t }} dilepas</span></div>
        </div>
      </div>

      <div v-else>
        <div class="unduh"><button type="button" class="btn" @click="salin">{{ disalin ? 'Tersalin ✓' : 'Salin teks ringkasan' }}</button></div>
        <pre class="rk small">{{ data.ringkasan?.teks || 'Ringkasan muncul setelah pemindaian pertama selesai.' }}</pre>
      </div>
    </template>
  </section>
</template>

<style scoped>
.flt{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0}
.cari{padding:5px 8px;border:1px solid var(--rule);border-radius:6px;background:var(--sheet);color:inherit;min-width:200px}
.scroll{overflow-x:auto}.row{cursor:pointer}.nm{max-width:200px}
.al{border-left:3px solid var(--rule);padding:4px 0 4px 10px;margin:6px 0}.al.pc{border-left-color:var(--now-ink)}
.pg{padding:6px 0;border-bottom:1px solid var(--rule)}.chip{cursor:pointer;margin:2px 4px 2px 0}
.unduh{display:flex;justify-content:flex-end;margin:4px 0}.rk{white-space:pre-wrap;background:var(--sheet);border:1px solid var(--rule);padding:10px;line-height:1.5}
</style>
