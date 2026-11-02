<script setup>
// LK Bagus: laporan keuangan terbaru SELURUH emiten BEI dari akun StockbitReports (/api/lk), satu laporan terakhir per
// kode. Kategori dari ringkasan AI Stockbit: laba naik >= 20% (Bagus), berbalik laba, naik tipis, turun, rugi.
// Catatan kualitas (pendapatan, margin kotor, basis rendah) dihitung server dari angka laporan. Dapat diunduh sebagai PDF.
import { computed, reactive, ref } from 'vue'
import { api } from '../api.js'
import { fmt, fmtDate } from '../lib/domain.js'
import { HSC_OPSI, isHsc, lolosHsc, hscInfo } from '../lib/hsc.js'
import HargaSaham from './HargaSaham.vue'

const data = ref(null), err = ref(''), loading = ref(true)
api.get('/api/lk').then(r => { if (r.error) err.value = r.error; else data.value = r }, e => { err.value = e.message || String(e) }).finally(() => { loading.value = false })

const KAT = [['bagus', 'Laba naik ≥ 20%'], ['berbalik', 'Berbalik laba'], ['naik', 'Naik < 20%'], ['turun', 'Laba turun'], ['rugi', 'Rugi'], ['semua', 'Semua']]
const kat = ref('bagus')
const f = reactive({ cari: '', hsc: '', radar: false, sehat: false, urut: 'laba' })
const URUT = [['laba', 'Kenaikan laba'], ['nilai', 'Nilai laba'], ['pendapatan', 'Kenaikan pendapatan'], ['tgl', 'Terbaru']]
// Rupiah-setara untuk mengurutkan nilai laba (USD dikali kurs kasar agar urutan masuk akal).
const rpSetara = n => n ? n.v * (n.mata === 'USD' ? 16500 : 1) : 0
const rows = computed(() => {
  const q = f.cari.trim().toUpperCase()
  const r = (data.value?.rows || []).filter(x => (kat.value === 'semua' || x.kategori === kat.value)
    && lolosHsc(x.t, f.hsc) && (!f.radar || x.radar)
    && (!f.sehat || ((x.pendapatan?.pct ?? -1) > 0 && !x.catatan.some(c => /basis tahun lalu kecil|pendapatan turun/i.test(c))))
    && (!q || x.t.includes(q) || (x.nama || '').toUpperCase().includes(q)))
  const k = { laba: x => x.laba?.pct ?? -1e9, nilai: x => rpSetara(x.laba?.ke), pendapatan: x => x.pendapatan?.pct ?? -1e9, tgl: x => x.tgl }[f.urut]
  return [...r].sort((a, b) => (k(b) > k(a) ? 1 : k(b) < k(a) ? -1 : 0))
})
const n = ref(100)
const uang = x => {
  if (!x) return '–'
  const a = Math.abs(x.v), [d, s] = a >= 1e12 ? [1e12, 'T'] : a >= 1e9 ? [1e9, 'M'] : a >= 1e6 ? [1e6, 'jt'] : [1e3, 'rb']
  return `${x.mata === 'USD' ? 'US$' : 'Rp'}${fmt(x.v / d, 2)} ${s}`
}
const pct = v => v == null ? '–' : (v > 0 ? '+' : '') + fmt(v, 1) + '%'
const labaPct = x => x.kategori === 'berbalik' ? 'berbalik' : x.laba?.pct == null ? '–' : (x.laba.arah === 'turun' ? '−' : '+') + fmt(x.laba.pct, 1) + '%'
const nada = x => ['bagus', 'berbalik', 'naik'].includes(x.kategori) ? 'c-good' : x.kategori === 'lain' ? 'muted' : 'c-strong'
const buka = ref('')

// Unduh riset (PDF, format sama dengan tab Pola Broker/Recovery/Low).
const busyPdf = ref(false), errPdf = ref('')
async function unduhPdf() {
  busyPdf.value = true; errPdf.value = ''
  try {
    const [{ jsPDF }, P] = await Promise.all([import('jspdf'), import('../lib/daftarPdf.js')])
    const label = KAT.find(k => k[0] === kat.value)[1]
    const spec = { seri: 'Riset LK', judul: 'LK Bagus: Laporan Keuangan Terbaru', label: `${label.toUpperCase()} · ${data.value.periode || ''}`,
      sub: 'Laporan keuangan terbaru seluruh emiten BEI dari ringkasan Stockbit Reports, satu laporan terakhir per emiten.',
      updated: data.value.updated, box: [['Laba naik >= 20%', String(data.value.hitung.bagus || 0)], ['Berbalik laba', String(data.value.hitung.berbalik || 0)], ['Laba turun', String(data.value.hitung.turun || 0)], ['Rugi', String(data.value.hitung.rugi || 0)]],
      bagian: [{ judul: label, ket: 'Laba bersih YoY, pendapatan, margin kotor, dan pendorong menurut ringkasan laporan. Catatan kualitas dihitung dari angka laporan.',
        cols: [{ t: 'Saham', w: 15 }, { t: 'Periode', w: 13 }, { t: 'Laba bersih', w: 30, align: 'right' }, { t: 'Laba YoY', w: 18, align: 'right' }, { t: 'Pendapatan', w: 18, align: 'right' }, { t: 'Pendorong / catatan', w: 88 }],
        rows: rows.value.slice(0, 200).map(x => [{ t: x.t, bold: true }, x.periode || '-', uang(x.laba?.ke), { t: labaPct(x), color: P.warna(x.kategori === 'turun' || x.kategori === 'rugi' ? -1 : 1) },
          { t: pct(x.pendapatan?.pct), color: P.warna(x.pendapatan?.pct) }, [x.pendorong, ...x.catatan].filter(Boolean).join('. ')]) }],
      metode: 'Data dari ringkasan AI Stockbit atas laporan keuangan; verifikasi dengan dokumen sumber. Kenaikan persentase besar dari basis rendah tidak selalu berulang.' }
    ;(await P.daftarPdf(spec, jsPDF)).save(P.daftarPdfName('LK-Bagus'))
  } catch (e) { errPdf.value = 'PDF gagal dibuat: ' + (e.message || e) } finally { busyPdf.value = false }
}
</script>

<template>
  <section class="lk">
    <p class="small muted intro">Laporan keuangan terbaru <b>seluruh emiten BEI</b> dari akun Stockbit Reports, satu laporan terakhir per emiten.
      Diperbarui otomatis tiap 30 menit (06.00–22.00 WIB).</p>
    <div class="unduh"><span v-if="errPdf" class="small c-strong">{{ errPdf }}</span>
      <button type="button" class="btn" :disabled="busyPdf || !data" @click="unduhPdf">{{ busyPdf ? 'Menyiapkan PDF…' : '⬇ Unduh riset LK (PDF)' }}</button></div>
    <p v-if="loading" class="muted">Memuat laporan keuangan…</p>
    <p v-else-if="err" class="muted">{{ err }}</p>
    <template v-else-if="data">
      <p v-if="!data.n" class="muted">Data laporan keuangan sedang dikumpulkan server dari Stockbit Reports; muat ulang beberapa menit lagi.</p>
      <div class="kat" role="tablist" aria-label="Kategori LK">
        <button v-for="[k, l] in KAT" :key="k" type="button" role="tab" class="pill" :aria-selected="String(kat === k)" :aria-pressed="String(kat === k)" @click="kat = k; buka = ''; n = 100">
          {{ l }} <span class="muted">{{ k === 'semua' ? data.n : (data.hitung[k] || 0) }}</span></button>
      </div>
      <div class="flt" role="group" aria-label="Saringan">
        <input v-model="f.cari" type="search" class="cari" placeholder="Cari kode atau nama…" aria-label="Cari saham" />
        <button type="button" class="pill sm" :aria-pressed="String(f.sehat)" title="Pendapatan ikut naik dan bukan dari basis tahun lalu yang kecil" @click="f.sehat = !f.sehat">Kualitas: pendapatan ikut naik</button>
        <button type="button" class="pill sm" :aria-pressed="String(f.radar)" @click="f.radar = !f.radar">Hanya saham di radar</button>
        <span class="small muted sep" :title="hscInfo()">HSC:</span>
        <button v-for="[v, l] in HSC_OPSI" :key="v" type="button" class="pill sm" :aria-pressed="String(f.hsc === v)" @click="f.hsc = v">{{ l }}</button>
      </div>
      <div class="flt" role="group" aria-label="Urutan">
        <span class="small muted">Urutkan:</span>
        <button v-for="[v, l] in URUT" :key="v" type="button" class="pill sm" :aria-pressed="String(f.urut === v)" @click="f.urut = v">{{ l }}</button>
      </div>
      <div class="mh"><h2>{{ KAT.find(k => k[0] === kat)[1] }}</h2>
        <span class="small muted">{{ rows.length }} emiten · periode dominan {{ data.periode || '–' }} · laporan terakhir {{ data.updated ? fmtDate(data.updated) : '–' }}</span></div>
      <div class="scroll">
        <table class="ledger">
          <thead><tr><th>Saham</th><th>Periode</th><th class="num">Harga</th><th class="num">Laba bersih</th><th class="num">Laba YoY</th>
            <th class="num">Pendapatan YoY</th><th class="num">Margin kotor</th><th>Pendorong</th><th>Tanggal</th></tr></thead>
          <tbody>
            <template v-for="x in rows.slice(0, n)" :key="x.id">
              <tr class="row" :class="{ open: buka === x.id }" tabindex="0" @click="buka = buka === x.id ? '' : x.id" @keydown.enter="buka = buka === x.id ? '' : x.id">
                <td><span class="car">{{ buka === x.id ? '▾' : '▸' }}</span>
                  <RouterLink :to="{ path: '/emiten/' + x.t, query: { tab: 'berita' } }" @click.stop><b>{{ x.t }}</b></RouterLink>
                  <span v-if="isHsc(x.t)" class="tag t-warn" title="Saham HSC">HSC</span>
                  <span v-if="x.radar" class="tag t-calm" title="Ada di radar backdoor">radar</span>
                  <div v-if="x.nama" class="small muted nm">{{ x.nama }}</div></td>
                <td class="small">{{ x.periode || '–' }}</td>
                <td class="num"><HargaSaham :kode="x.t" /></td>
                <td class="num small">{{ uang(x.laba?.dari) }} → <b>{{ uang(x.laba?.ke) }}</b></td>
                <td class="num"><b :class="nada(x)">{{ labaPct(x) }}</b></td>
                <td class="num" :class="(x.pendapatan?.pct ?? 0) >= 0 ? 'c-good' : 'c-strong'">{{ pct(x.pendapatan?.pct) }}</td>
                <td class="num small">{{ x.marginKotor ? fmt(x.marginKotor.dari, 2) + '% → ' + fmt(x.marginKotor.ke, 2) + '%' : '–' }}</td>
                <td class="small dr">{{ x.pendorong || '–' }}</td>
                <td class="small"><a :href="x.url" target="_blank" rel="noopener" @click.stop>{{ fmtDate(x.tgl) }}</a></td>
              </tr>
              <tr v-if="buka === x.id" class="det"><td colspan="9">
                <p class="small"><b>{{ x.judul }}</b> · {{ x.jenisLk }}</p>
                <p class="small">{{ x.ringkas }}</p>
                <ul class="small"><li v-for="p in x.poin" :key="p">{{ p }}</li></ul>
                <p v-if="x.catatan.length" class="small muted">Catatan: {{ x.catatan.join(' · ') }}.</p>
              </td></tr>
            </template>
          </tbody>
        </table>
      </div>
      <p v-if="rows.length > n" class="small"><button type="button" class="pill sm" @click="n += 100">Tampilkan 100 lagi ({{ rows.length - n }} tersisa)</button></p>
      <p class="small muted"><b>Laba naik ≥ 20%</b> = laba bersih YoY naik minimal 20%; <b>Berbalik laba</b> = periode lalu rugi, kini laba.
        Saringan <b>Kualitas</b> menyisakan emiten yang pendapatannya ikut naik dan kenaikannya bukan dari basis tahun lalu yang kecil.
        Angka dari ringkasan AI Stockbit; verifikasi dengan dokumen sumber (klik tanggal).</p>
    </template>
  </section>
</template>

<style scoped>
.intro{margin:0 0 6px}.unduh{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin:0 0 8px}
.kat,.flt{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0}.sep{margin-left:8px}
.cari{padding:5px 8px;border:1px solid var(--rule);border-radius:6px;background:var(--sheet);color:inherit;min-width:180px}
.mh{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.mh h2{margin:8px 0 6px}
.scroll{overflow-x:auto}.row{cursor:pointer}.car{color:var(--ink-2);font-size:11px}.nm{max-width:220px}
.dr{min-width:260px;max-width:340px}.det td{background:var(--sheet)}.det p{margin:4px 0}.det ul{margin:4px 0;padding-left:18px}
</style>
