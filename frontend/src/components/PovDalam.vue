<script setup>
// Analisa mendalam satu emiten (POV): data ditarik server saat tombol diklik (pekerjaan latar, maks. 15 menit),
// lalu dipantau tiap beberapa detik. Isi: kepemilikan & jaringan pengendali di emiten lain, emiten grup,
// riwayat kepemilikan, orang dalam, aksi korporasi, kinerja, diskusi komunitas, dugaan tujuan, dan yang diselidiki.
import { computed, onBeforeUnmount, ref } from 'vue'
import { api } from '../api.js'
import { fmt, fmtDate } from '../lib/domain.js'

const props = defineProps({ ticker: { type: String, required: true } })
const st = ref(null), err = ref(''), busyPdf = ref(false)
let timer = null
const hasil = computed(() => st.value?.status === 'selesai' ? st.value.hasil : null)
const p2 = v => v == null ? '–' : fmt(v, 2) + '%'
const menit = s => s >= 90 ? `± ${Math.round(s / 60)} menit` : `± ${Math.max(10, Math.round(s / 10) * 10)} detik`

async function tanya(mulai = false) {
  try {
    st.value = await api.get('/api/pov-dalam', { ticker: props.ticker, ...(mulai ? { mulai: 1 } : {}) })
    err.value = ''
  } catch (e) { err.value = e.message || String(e) }
  clearTimeout(timer)
  if (st.value?.status === 'jalan') timer = setTimeout(() => tanya(), 4000)
}
tanya()
onBeforeUnmount(() => clearTimeout(timer))

async function unduh() {
  busyPdf.value = true
  try {
    const [{ jsPDF }, P] = await Promise.all([import('jspdf'), import('../lib/povDalamPdf.js')])
    ;(await P.povDalamPdf(hasil.value, jsPDF)).save(P.povDalamPdfName(hasil.value))
  } catch (e) { err.value = 'PDF gagal: ' + (e.message || e) } finally { busyPdf.value = false }
}
</script>

<template>
  <div class="pd">
    <p v-if="err" class="small c-strong">{{ err }}</p>
    <template v-if="!st || st.status === 'kosong' || st.status === 'gagal' || st.status === 'antre'">
      <p v-if="st?.galat" class="small c-strong">{{ st.galat }}</p>
      <button type="button" class="btn" :disabled="!st" @click="tanya(true)">🔎 Analisa mendalam {{ ticker }}</button>
      <p class="small muted">Server menarik profil, pemegang saham, jaringan kepemilikan di emiten lain, keterbukaan 1 tahun, berita, kinerja, dan posting publik Stockbit.
        Lama proses bergantung banyaknya data (umumnya 2–5 menit, paling lama 15 menit); perkiraannya ditampilkan setelah diklik.</p>
    </template>
    <div v-else-if="st.status === 'jalan'" class="prog" role="status">
      <b>Menarik data {{ ticker }}…</b> perkiraan {{ menit(st.estimasi || 180) }} · berjalan {{ menit(st.berjalan || 0).replace('± ', '') }}
      <div class="bar"><i :style="{ width: Math.min(100, Math.round(((st.langkah || 0) / (st.total || 8)) * 100)) + '%' }"></i></div>
      <span class="small muted">Tahap {{ st.langkah || 0 }}/{{ st.total || 8 }} · {{ st.label }}. Halaman boleh ditinggal; hasil disimpan 12 jam.</span>
    </div>

    <template v-if="hasil">
      <div class="hd">
        <span class="small muted">Dianalisa {{ hasil.dibuat }} · {{ hasil.durasi ? Math.round(hasil.durasi / 60 * 10) / 10 + ' menit' : '' }} ·
          {{ hasil.sumber.pemegang }} pemegang, {{ hasil.sumber.jaringan }} emiten jaringan, {{ hasil.sumber.keterbukaan }} keterbukaan, {{ hasil.sumber.posting }} posting</span>
        <button type="button" class="btn" :disabled="busyPdf" @click="unduh">{{ busyPdf ? 'Menyiapkan PDF…' : '⬇ Unduh analisa mendalam (PDF)' }}</button>
      </div>
      <ul class="small rk"><li v-for="r in hasil.ringkas" :key="r">{{ r }}</li></ul>

      <h3>Dugaan tujuan</h3>
      <p v-if="!hasil.dugaan.length" class="small muted">Belum ada bukti yang cukup untuk menyusun dugaan tujuan.</p>
      <div v-for="g in hasil.dugaan" :key="g.judul" class="dg" :class="g.arah > 0 ? 'pos' : ''">
        <b>{{ g.judul }}</b> <span class="tag t-calm">keyakinan {{ g.keyakinan }}</span>
        <ul class="small"><li v-for="b in g.bukti" :key="b">{{ b }}</li></ul>
      </div>

      <template v-if="hasil.radarSikap">
        <h3>Sikap analisa radar: {{ hasil.radarSikap.sikap }}</h3>
        <p class="small">{{ hasil.radarSikap.ringkas }}<template v-if="hasil.radarSikap.nilaiWajar?.atas"> · nilai wajar Rp{{ hasil.radarSikap.nilaiWajar.bawah || '–' }}–{{ hasil.radarSikap.nilaiWajar.atas }}</template></p>
      </template>

      <h3>Skenario nilai</h3>
      <p class="small muted">Harga terakhir {{ hasil.identitas.harga ? 'Rp' + fmt(hasil.identitas.harga, 0) : '–' }}<template v-if="hasil.identitas.mcap"> · kapitalisasi Rp{{ fmt(hasil.identitas.mcap / 1e9, 0) }} M</template></p>
      <ul class="small"><li v-for="s in hasil.skenario" :key="s.label">{{ s.label }}: Rp{{ fmt(s.harga, 0) }} (<b :class="s.selisih >= 0 ? 'c-good' : 'c-strong'">{{ s.selisih > 0 ? '+' : '' }}{{ fmt(s.selisih, 1) }}%</b> dari harga sekarang)</li>
        <li v-if="hasil.broker">Broker 30 hari: <b :class="hasil.broker.bandar > 0 ? 'c-good' : 'c-strong'">{{ hasil.broker.bandar > 0 ? 'akumulasi' : 'distribusi' }} Rp{{ fmt(Math.abs(hasil.broker.bandar) / 1e9, 2) }} M</b>
          · pembeli {{ hasil.broker.akum.join(', ') || '–' }} · penjual {{ hasil.broker.dist.join(', ') || '–' }}</li></ul>

      <h3>Kepemilikan · non-publik {{ p2(hasil.kepemilikan.nonPublik) }} · free float {{ p2(hasil.identitas.freeFloat) }}</h3>
      <ul class="small">
        <li v-for="p in hasil.kepemilikan.pemegang" :key="p.name"><b>{{ p.name }}</b> {{ p2(p.pct) }}<span v-if="p.pengendali" class="tag t-warn">pengendali</span><span v-if="p.pengurus" class="tag t-calm">pengurus: {{ p.pengurus }}</span></li>
        <li v-if="hasil.kepemilikan.ubo.length">UBO: {{ hasil.kepemilikan.ubo.join(', ') }}</li>
      </ul>
      <p class="small muted">Direksi: {{ hasil.kepemilikan.direksi.join(', ') || '–' }} · Komisaris: {{ hasil.kepemilikan.komisaris.join(', ') || '–' }}</p>

      <h3>Jaringan pemegang saham di emiten lain</h3>
      <p v-if="!hasil.jaringan.some(r => r.emiten.length)" class="small muted">Pemegang saham utama tidak tercatat memiliki emiten lain.</p>
      <ul class="small">
        <li v-for="r in hasil.jaringan.filter(r => r.emiten.length)" :key="r.nama"><b>{{ r.nama }}</b> ({{ p2(r.pct) }}):
          <template v-for="(e, i) in r.emiten" :key="e.t"><span v-if="i">, </span><RouterLink :to="'/emiten/' + e.t">{{ e.t }}</RouterLink> {{ p2(e.pct) }}</template></li>
        <li v-for="x in hasil.bersama" :key="'b' + x.t"><b>{{ x.t }}</b> dimiliki bersama oleh {{ x.pemegang.join(', ') }}</li>
      </ul>
      <template v-if="hasil.grup?.length">
        <h4>Emiten grup</h4>
        <ul class="small"><li v-for="g in hasil.grup" :key="g.t"><b>{{ g.t }}</b> {{ g.nama }} <span class="muted">{{ g.sektor }}</span> — {{ g.pemegang.map(p => p.name + ' ' + (p.pct || '')).join('; ') }}</li></ul>
      </template>

      <h3>Riwayat kepemilikan (3 tahun) dan orang dalam (180 hari)</h3>
      <p v-if="!hasil.riwayat.length" class="small muted">Tidak ada perubahan kepemilikan besar.</p>
      <ul class="small"><li v-for="r in hasil.riwayat" :key="r.date + r.nama">{{ fmtDate(r.date) }} · {{ r.teks }}</li></ul>
      <ul v-if="hasil.insider.length" class="small"><li v-for="x in hasil.insider" :key="x.nama">{{ x.nama }}<span v-if="x.role"> ({{ x.role }})</span>:
        <b :class="x.chg > 0 ? 'c-good' : 'c-strong'">{{ x.chg > 0 ? '+' : '' }}{{ fmt(x.chg, 2) }} poin</b>, {{ x.n }} transaksi, terakhir {{ fmtDate(x.akhir) }}</li></ul>

      <template v-if="hasil.kronologi?.length">
        <h3>Kronologi</h3>
        <ul class="small kr"><li v-for="k in hasil.kronologi" :key="k.date + k.teks"><b>{{ fmtDate(k.date) }}</b> <span class="tag" :class="k.jenis === 'aksi' ? 't-calm' : 't-warn'">{{ k.jenis }}</span> {{ k.teks }}</li></ul>
      </template>

      <h3>Aksi korporasi (1 tahun)</h3>
      <p v-if="!hasil.aksi.length" class="small muted">Tidak ada keterbukaan aksi korporasi yang terbaca.</p>
      <ul class="small"><li v-for="x in hasil.aksi" :key="x.url + x.judul">{{ fmtDate(x.date) }} · <a :href="x.url" target="_blank" rel="noopener">{{ x.judul }}</a><span v-if="x.inti" class="muted"> — {{ x.inti }}</span></li></ul>

      <h3>Diskusi komunitas Stockbit ({{ hasil.komunitas.jumlah }} posting publik)</h3>
      <p v-if="hasil.komunitas.nama.length" class="small">Tokoh disebut:
        <span v-for="e in hasil.komunitas.nama" :key="e.nama" class="tag" :class="e.terverifikasi ? 't-good' : 't-calm'" :title="e.terverifikasi ? 'Cocok dengan data pemegang saham/pengurus' : 'Belum terkonfirmasi data'">{{ e.nama }} ×{{ e.n }}</span></p>
      <p v-if="hasil.komunitas.terkait.length" class="small">Saham disebut bersamaan:
        <span v-for="x in hasil.komunitas.terkait" :key="x.t" class="tag t-calm">{{ x.t }} ×{{ x.n }}</span></p>
      <ul class="small"><li v-for="p in hasil.komunitas.posts" :key="p.url"><a :href="p.url" target="_blank" rel="noopener">@{{ p.user || '–' }} · {{ fmtDate(p.d) }}</a> · {{ p.likes }} suka — {{ p.txt }}</li></ul>

      <h3>Yang perlu diselidiki</h3>
      <ol class="small"><li v-for="s in hasil.selidiki" :key="s">{{ s }}</li></ol>
      <p v-if="hasil.catatan?.length" class="small muted">Catatan: {{ hasil.catatan.join(' · ') }}</p>
      <p class="small muted">Disusun otomatis dari data Stockbit; klaim komunitas yang belum terkonfirmasi perlu diverifikasi di dokumen sumber. Bukan rekomendasi beli/jual.</p>
    </template>
  </div>
</template>

<style scoped>
.pd h3{margin:14px 0 4px;font-size:15px}.pd h4{margin:8px 0 2px;font-size:13px}
.pd ul,.pd ol{margin:4px 0;padding-left:18px}
.hd{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:4px 0}
.prog{border:1px solid var(--rule);background:var(--sheet);padding:10px 12px;margin:8px 0}
.bar{height:6px;background:var(--rule);border-radius:3px;margin:6px 0}.bar i{display:block;height:100%;background:var(--now-ink);border-radius:3px;transition:width .4s}
.dg{border-left:3px solid var(--rule);padding:2px 0 2px 10px;margin:6px 0}.dg.pos{border-left-color:var(--now-ink)}
.rk{margin:6px 0}
</style>
