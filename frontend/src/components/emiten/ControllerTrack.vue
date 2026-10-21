<script setup>
// Rekam jejak harga pengendali: untuk setiap emiten yang pernah/sedang dipegang ≥5% atas nama pengendali
// (/api/controller), harga pasar saat masuk, puncak sesudahnya, saat keluar, dan sekarang (candle mingguan 3 tahun).
import { computed, ref, watch } from 'vue'
import { api } from '../../api.js'
import { fmtDate, rp } from '../../lib/domain.js'
import { trackStats, trackSummary } from '../../lib/profil.js'
import TickerText from '../TickerText.vue'

const props = defineProps({
  c: { type: Object, default: null },        // respons /api/controller
  self: { type: String, default: '' },       // emiten yang sedang dibuka
  oldCtrl: { type: Boolean, default: false }, // nama di kolom pengendali = pengendali lama/penjual
})
const MAX = 10
const rows = ref([])
const loading = ref(false)

watch(() => props.c, async c => {
  const hs = (c?.holdings || []).filter(h => h.symbol && h.since).slice(0, MAX)
  if (!hs.length) { rows.value = []; return }
  loading.value = true
  rows.value = await Promise.all(hs.map(async h => {
    try {
      const j = await api.get('/api/ohlc', { ticker: h.symbol, tf: '3y' })
      const stats = trackStats(j.bars, h)
      return stats ? { h, stats } : { h, err: 'tanpa data harga' }
    } catch (e) { return { h, err: e.status === 503 ? 'kuota mode publik habis' : 'gagal memuat' } }
  }))
  loading.value = false
}, { immediate: true })

const sum = computed(() => trackSummary(rows.value))
const pct = v => (v >= 0 ? '+' : '−') + Math.abs(Math.round(v * 100)) + '%'
const fd = s => s ? fmtDate(String(s).slice(0, 10)) : '–'
</script>

<template>
  <section class="rule-top trk">
    <h2>Rekam jejak harga pengendali <span class="muted small">{{ c?.name || '' }}{{ oldCtrl ? ' (pengendali lama/penjual)' : '' }}</span></h2>
    <p v-if="!c" class="muted">Data pengendali dari Stockbit belum dimuat.</p>
    <p v-else-if="!rows.length && !loading" class="muted">
      {{ c.holderId ? 'Riwayat kepemilikan 5% ke atas atas nama ini hanya di emiten ini.' : 'Nama pengendali tidak ditemukan di riwayat pemegang saham Stockbit; rekam jejak harga tidak bisa dihitung.' }}
    </p>
    <p v-else-if="loading" class="muted">Menghitung {{ c.holdings?.length || 0 }} emiten dari riwayat kepemilikan Stockbit…</p>
    <template v-else>
      <dl class="kv kpi">
        <div><dt>Emiten tercatat</dt><dd>{{ sum.n }}</dd></div>
        <div><dt>Hasil positif bagi yang ikut masuk</dt><dd>{{ sum.wins }} dari {{ sum.n }}</dd></div>
        <div><dt>Median hasil</dt><dd><span v-if="sum.median != null" :class="sum.median >= 0 ? 'up' : 'dn'">{{ pct(sum.median) }}</span><template v-else>–</template></dd></div>
      </dl>
      <div class="scroll">
        <table class="ledger">
          <thead><tr><th class="lbl">Emiten</th><th class="lbl">Harga pasar saat masuk</th><th class="lbl r">Puncak sesudahnya</th><th class="lbl r">Keluar</th><th class="lbl r">Sekarang</th><th class="lbl r">Hasil</th></tr></thead>
          <tbody>
            <tr v-for="r in rows" :key="r.h.symbol" :class="{ self: r.h.symbol === self }">
              <td><b><TickerText :text="r.h.symbol" /></b><span v-if="r.h.symbol === self" class="small muted"> emiten ini</span>
                <div class="small muted">{{ r.h.pct > 0 ? 'masih ' + (+r.h.pct).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + '%' : 'sudah keluar' }}</div></td>
              <template v-if="r.stats">
                <td class="num">{{ rp(r.stats.p0) }}<div class="small muted">{{ fd(r.stats.d0) }}{{ r.stats.short ? ' (awal data)' : '' }}</div></td>
                <td class="r num">{{ rp(r.stats.peak) }} <span :class="r.stats.peakChg >= 0 ? 'up' : 'dn'">{{ pct(r.stats.peakChg) }}</span><div class="small muted">{{ fd(r.stats.dPeak) }}</div></td>
                <td class="r num">{{ r.stats.exit != null ? rp(r.stats.exit) : '–' }}</td>
                <td class="r num">{{ rp(r.stats.now) }}</td>
                <td class="r num"><span :class="r.stats.result >= 0 ? 'up' : 'dn'">{{ pct(r.stats.result) }}</span></td>
              </template>
              <td v-else colspan="5" class="small muted">{{ r.err }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="small muted">Harga penutupan mingguan Stockbit (3 tahun). Masuk = pertama tercatat 5% ke atas di KSEI/IDX; keluar = transaksi terakhir saat porsi menjadi 0. Hasil = perubahan harga bagi investor yang membeli di harga pasar saat pengendali masuk, sampai pengendali keluar atau sampai sekarang. Kepemilikan lewat entitas lain milik UBO yang sama tidak tercatat.</p>
    </template>
  </section>
</template>

<style scoped>
.trk h2{margin-bottom:8px}
.scroll{overflow-x:auto}
.ledger{font-size:13px}
.r{text-align:right}
.self td{background:var(--sheet-2)}
.up{color:var(--good);font-weight:600}
.dn{color:var(--strong);font-weight:600}
.kv{margin:0 0 8px;font-size:13.5px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px 16px}
.kv>div{border-top:1px solid var(--rule-2);padding-top:4px}
.kv dt{font:600 12px var(--f-display);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.kv dd{margin:0;font:700 18px var(--f-display)}
</style>
