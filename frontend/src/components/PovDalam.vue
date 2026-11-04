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
// Hanya klaim yang didukung data yang ditampilkan.
const klaimValid = computed(() => (hasil.value?.klaim || []).filter(c => c.status === 'didukung data'))
// Informasi publik: yang cocok dengan data kepemilikan dulu, lalu rumor/klaim beserta sumbernya.
const verif = computed(() => {
  const k = hasil.value?.komunitas || {}
  return [...(k.relasi || []).filter(r => r.terverifikasi).map(r => ({ k: r.orang + r.badan, teks: `${r.orang} melalui ${r.badan} (@${r.user})`, url: r.url })),
    ...(k.nama || []).filter(e => e.terverifikasi).map(e => ({ k: e.nama, teks: `${e.nama}: tercatat di data pemegang saham/pengurus (disebut ${e.n}x)` }))]
})
const rumor = computed(() => {
  const k = hasil.value?.komunitas || {}
  return [...(k.relasi || []).filter(r => !r.terverifikasi).map(r => ({ k: r.orang + r.badan, teks: `${r.orang} melalui ${r.badan} (@${r.user})`, url: r.url })),
    ...(k.klaim || []).slice(0, 8).map(c => ({ k: c.teks, teks: `${c.teks} (@${c.user}, ${fmtDate(c.d)})`, url: c.url }))]
})
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

      <template v-if="hasil.arah">
        <h3>Membaca arah pengendali</h3>
        <p v-for="n in hasil.arah.narasi" :key="n" class="small nar">{{ n }}</p>
        <h4>Skenario ke mana saham dibawa</h4>
        <div v-for="(s, i) in hasil.arah.skenario" :key="s.nama" class="sk">
          <div class="skh"><b>{{ i + 1 }}. {{ s.nama }}</b><span class="skb"><i :style="{ width: s.skor + '%' }"></i></span><span class="small">skor {{ s.skor }}</span></div>
          <ul class="small"><li v-for="b in s.bukti" :key="b">{{ b }}</li></ul>
          <p class="small muted">Konfirmasi yang ditunggu: {{ s.konfirmasi.join('; ') }}</p>
        </div>
      </template>

      <template v-if="hasil.pertanyaan?.length">
        <h3>Jawaban pertanyaan kunci</h3>
        <div v-for="q in hasil.pertanyaan" :key="q.q" class="dg pos">
          <b>{{ q.q }}</b>
          <p class="small nar">{{ q.a }}</p>
          <ul v-if="q.bukti.length" class="small muted"><li v-for="b in q.bukti" :key="b">{{ b }}</li></ul>
        </div>
      </template>

      <template v-if="hasil.backdoor">
        <h3>Potensi backdoor / ganti pengendali: skor {{ hasil.backdoor.skor }}</h3>
        <div class="skh"><span class="skb wide"><i :style="{ width: hasil.backdoor.skor + '%' }"></i></span></div>
        <ul class="small"><li v-for="b in hasil.backdoor.bukti" :key="b">{{ b }}</li><li v-if="!hasil.backdoor.bukti.length" class="muted">Belum ada tanda yang biasa mendahului backdoor.</li></ul>
        <template v-if="hasil.jejakCangkang?.length">
          <h4>Rekam jejak penjual cangkang</h4>
          <ul class="small"><li v-for="j in hasil.jejakCangkang" :key="j.t + j.pemegang"><b>{{ j.teks }}</b></li></ul>
        </template>
        <template v-if="hasil.backdoor.rups?.length">
          <h4>Agenda RUPS / keterbukaan perubahan</h4>
          <ul class="small"><li v-for="r in hasil.backdoor.rups" :key="r">{{ r }}</li></ul>
        </template>
      </template>

      <template v-if="hasil.afiliasi?.kelompok?.length">
        <h3>Peta afiliasi · terhubung {{ p2(hasil.afiliasi.totalTerhubung) }}</h3>
        <div v-for="k in hasil.afiliasi.kelompok" :key="k.jenis + k.dasar" class="dg pos">
          <span class="tag t-calm">{{ k.jenis }}</span> <b>{{ p2(k.pct) }}</b> · {{ k.dasar }}
          <div class="small">{{ k.anggota.join(', ') }}</div>
        </div>
      </template>

      <template v-if="hasil.marketMaker?.length">
        <h3>Market maker: broker yang dipakai orang dalam</h3>
        <ul class="small"><li v-for="m in hasil.marketMaker" :key="m">{{ m }}</li></ul>
      </template>

      <template v-if="hasil.target?.length">
        <h3>Skenario target harga (distribusi)</h3>
        <ul class="small"><li v-for="x in hasil.target" :key="x.label"><b>{{ x.label }}: Rp{{ fmt(x.harga, 0) }}</b>
          <span :class="x.potensi >= 0 ? 'c-good' : 'c-strong'">({{ x.potensi > 0 ? '+' : '' }}{{ fmt(x.potensi, 1) }}%)</span> — {{ x.dasar }}</li></ul>
        <p class="small muted">Skenario dari data, bukan rekomendasi atau janji harga.</p>
      </template>

      <template v-if="hasil.sudut?.length">
        <h3>Sudut yang sering terlewat</h3>
        <ul class="small"><li v-for="x in hasil.sudut" :key="x">{{ x }}</li></ul>
      </template>

      <template v-if="hasil.bandarmologi?.fase?.length">
        <h3>Bandarmologi</h3>
        <table class="ledger small">
          <thead><tr><th>Periode</th><th class="num">Net bandar</th><th class="num">Harga</th><th>Pembeli utama</th><th>Penjual utama</th><th class="num">Modal pembeli</th><th>Arti</th></tr></thead>
          <tbody><tr v-for="f in hasil.bandarmologi.fase" :key="f.hari">
            <td>{{ f.periode }}</td><td class="num" :class="f.bandar > 0 ? 'c-good' : 'c-strong'">Rp{{ fmt(f.bandar / 1e9, 2) }} M</td>
            <td class="num">{{ f.harga == null ? '–' : (f.harga > 0 ? '+' : '') + fmt(f.harga, 1) + '%' }}</td>
            <td>{{ f.akum.join(', ') }}</td><td>{{ f.dist.join(', ') }}</td>
            <td class="num">{{ f.avgAkum ? 'Rp' + fmt(f.avgAkum, 0) : '–' }}</td><td>{{ f.arti }}</td></tr></tbody>
        </table>
        <ul class="small"><li v-for="x in hasil.bandarmologi.catatan" :key="x">{{ x }}</li></ul>
      </template>

      <template v-if="hasil.volume?.length">
        <h4>Jejak lonjakan volume (1 tahun)</h4>
        <ul class="small"><li v-for="v in hasil.volume" :key="v.d">{{ fmtDate(v.d) }}: {{ v.kali }}x rata-rata, harga {{ (v.ubah > 0 ? '+' : '') + v.ubah }}%<b v-if="v.sebelum"> — sebelum: {{ v.sebelum }}</b></li></ul>
      </template>
      <template v-if="hasil.preseden?.length">
        <h4>Preseden grup (2 tahun)</h4>
        <ul class="small"><li v-for="x in hasil.preseden" :key="x">{{ x }}</li></ul>
      </template>

      <template v-if="klaimValid.length">
        <h3>Klaim publik yang terbukti data</h3>
        <div v-for="c in klaimValid" :key="c.jenis + c.user" class="dg" :class="c.status === 'didukung data' ? 'pos' : ''">
          <span class="tag" :class="c.status === 'didukung data' ? 't-good' : c.status === 'tidak didukung' ? 't-strong' : 't-calm'">{{ c.status }}</span>
          “{{ c.klaim }}” <a :href="c.url" target="_blank" rel="noopener" class="small">@{{ c.user }} · {{ fmtDate(c.d) }}</a>
          <ul class="small"><li v-for="b in c.bukti" :key="b">{{ b }}</li></ul>
        </div>
      </template>

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

      <h3>Kepemilikan · terafiliasi {{ p2(hasil.kepemilikan.nonPublik) }} · free float efektif {{ p2(hasil.kepemilikan.ffEfektif) }} · free float Stockbit {{ p2(hasil.identitas.freeFloat) }}</h3>
      <ul class="small">
        <li v-for="p in hasil.kepemilikan.pemegang" :key="p.name"><b>{{ p.name }}</b> {{ p2(p.pct) }}<span v-if="p.pengendali" class="tag t-warn">pengendali</span><span v-if="p.pengurus" class="tag t-calm">pengurus: {{ p.pengurus }}</span><span v-if="p.keluarga" class="tag t-calm">keluarga {{ p.keluarga }}</span></li>
        <li v-for="k in hasil.kepemilikan.keluarga || []" :key="'k' + k.nama"><b>Keluarga {{ k.nama }}</b>: {{ k.anggota.length }} anggota, total {{ p2(k.pct) }}</li>
        <li v-if="hasil.kepemilikan.ubo.length">UBO: {{ hasil.kepemilikan.ubo.join(', ') }}</li>
      </ul>
      <p class="small muted">Direksi: {{ hasil.kepemilikan.direksi.join(', ') || '–' }} · Komisaris: {{ hasil.kepemilikan.komisaris.join(', ') || '–' }}</p>

      <h3>Jaringan pemegang saham di emiten lain</h3>
      <p v-if="!hasil.jaringan.some(r => r.emiten.length || r.keluar?.length)" class="small muted">Pemegang saham utama tidak tercatat memiliki emiten lain.</p>
      <ul class="small">
        <li v-for="r in hasil.jaringan.filter(r => r.emiten.length || r.keluar?.length)" :key="r.nama"><b>{{ r.nama }}</b> ({{ p2(r.pct) }}):
          <template v-for="(e, i) in r.emiten" :key="e.t"><span v-if="i">, </span><RouterLink :to="'/emiten/' + e.t">{{ e.t }}</RouterLink> {{ p2(e.pct) }}</template>
          <template v-if="r.keluar?.length"> · <span class="c-strong">dilepas:</span> <template v-for="(e, i) in r.keluar" :key="'k' + e.t"><span v-if="i">, </span>{{ e.t }}<span class="muted"> ({{ e.tgl || '–' }})</span></template></template></li>
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
        <b :class="x.chg > 0 ? 'c-good' : 'c-strong'">{{ x.chg > 0 ? '+' : '' }}{{ fmt(x.chg, 2) }} poin</b>, {{ x.n }} transaksi, terakhir {{ fmtDate(x.akhir) }}<template v-if="x.lembar">; {{ fmt(x.lembar / 1e6, 1) }} juta lembar<template v-if="x.harga"> @ ±Rp{{ fmt(x.harga, 0) }}</template></template><template v-if="x.sisa">;
          sisa {{ fmt(x.sisa / 1e6, 1) }} juta lembar ({{ p2(x.sisaPct) }})</template><b v-if="x.habisBulan">; habis ± {{ Math.round(x.habisBulan) }} bulan lagi bila laju sama</b></li></ul>

      <template v-if="hasil.tokoh?.length">
        <h3>Profil tokoh (UBO, pemegang perorangan, komut, dirut)</h3>
        <div v-for="o in hasil.tokoh" :key="o.nama" class="dg"><b>{{ o.nama }}</b>
          <ul class="small"><li v-for="b in o.berita" :key="b.url">{{ b.date ? fmtDate(b.date) : '–' }} · <a :href="b.url" target="_blank" rel="noopener">{{ b.judul }}</a> <span class="muted">— {{ b.sumber }}</span></li>
            <li v-if="!o.berita.length" class="muted">Tidak ada pemberitaan publik yang memuat nama ini.</li></ul></div>
      </template>

      <template v-if="hasil.kronologi?.length">
        <h3>Kronologi</h3>
        <ul class="small kr"><li v-for="k in hasil.kronologi" :key="k.date + k.teks"><b>{{ fmtDate(k.date) }}</b> <span class="tag" :class="k.jenis === 'aksi' ? 't-calm' : 't-warn'">{{ k.jenis }}</span> {{ k.teks }}</li></ul>
      </template>

      <h3>Aksi korporasi (1 tahun)</h3>
      <p v-if="!hasil.aksi.length" class="small muted">Tidak ada keterbukaan aksi korporasi yang terbaca.</p>
      <ul class="small"><li v-for="x in hasil.aksi" :key="x.url + x.judul">{{ fmtDate(x.date) }} · <a :href="x.url" target="_blank" rel="noopener">{{ x.judul }}</a><span v-if="x.inti" class="muted"> — {{ x.inti }}</span></li></ul>

      <template v-if="hasil.berita?.length">
        <h3>Berita terbaru (Stockbit)</h3>
        <ul class="small"><li v-for="b in hasil.berita" :key="b.url + b.judul">{{ b.date ? fmtDate(b.date) : '–' }} · <a :href="b.url" target="_blank" rel="noopener">{{ b.judul }}</a></li></ul>
      </template>

      <template v-if="hasil.beritaLuar?.length">
        <h3>Berita di luar Stockbit ({{ hasil.beritaLuar.length }})</h3>
        <ul class="small"><li v-for="b in hasil.beritaLuar" :key="b.url">{{ b.date ? fmtDate(b.date) : '–' }} · <a :href="b.url" target="_blank" rel="noopener">{{ b.judul }}</a>
          <span class="muted"> — {{ b.sumber }}</span></li></ul>
      </template>

      <h3>Informasi dari sumber publik</h3>
      <template v-if="verif.length || rumor.length">
        <p class="small"><b class="c-good">Terverifikasi</b> (cocok dengan data pemegang saham/pengurus):</p>
        <ul class="small"><li v-for="v in verif" :key="v.k">{{ v.teks }} <a v-if="v.url" :href="v.url" target="_blank" rel="noopener">sumber</a></li>
          <li v-if="!verif.length" class="muted">Belum ada informasi publik yang cocok dengan data kepemilikan.</li></ul>
        <template v-if="rumor.length">
          <p class="small"><b>Rumor / klaim belum terverifikasi</b> (cek di dokumen sumber):</p>
          <ul class="small muted"><li v-for="v in rumor" :key="v.k">{{ v.teks }} <a :href="v.url" target="_blank" rel="noopener">sumber</a></li></ul>
        </template>
      </template>
      <p v-else class="small muted">Belum ada informasi publik yang bisa diambil untuk saham ini.</p>

      <h3>Yang perlu diselidiki</h3>
      <ol class="small"><li v-for="s in hasil.selidiki" :key="s">{{ s }}</li></ol>
      <p v-if="hasil.catatan?.length" class="small muted">Catatan: {{ hasil.catatan.join(' · ') }}</p>
      <p class="small muted">Disusun otomatis dari data Stockbit; rumor dan klaim yang belum terverifikasi perlu dicek di dokumen sumber. Bukan rekomendasi beli/jual.</p>
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
.nar{margin:4px 0;line-height:1.55}
.sk{margin:6px 0;padding:4px 0 4px 10px;border-left:3px solid var(--now-ink)}
.skh{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.skb{flex:0 0 120px;height:6px;background:var(--rule);border-radius:3px}
.skb.wide{flex:0 0 240px}.skb i{display:block;height:100%;background:var(--now-ink);border-radius:3px}
</style>
