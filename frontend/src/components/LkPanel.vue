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
// Fokus periode: bawaan Q3 tahun berjalan (Stockbit menulis laporan kuartal III sebagai 9M = kumulatif Jan-Sep).
const thn = String(new Date().getFullYear()).slice(2)
const PERIODE = [['q3', `Q3 20${thn} (9M${thn})`], ['semua', 'Semua periode']]
const per = ref('q3')
const lolosPer = x => per.value === 'semua' || new RegExp(`^(9M|3Q|Q3)${thn}$`).test(x.periode || '')
const basis = computed(() => (data.value?.rows || []).filter(lolosPer))
const hitung = computed(() => basis.value.reduce((h, x) => ({ ...h, [x.kategori]: (h[x.kategori] || 0) + 1 }), {}))
const f = reactive({ cari: '', hsc: '', radar: false, sehat: false, urut: 'laba', q3: '' })
// Kuartal III murni (server: 9M - 1H): saringan agar kenaikan 9M yang hanya ditopang Q1-Q2 terlihat.
const Q3OPSI = [['', 'Semua'], ['naik', 'Q3 ikut naik'], ['melemah', 'Q3 melemah'], ['tanpa', 'Data 1H belum ada']]
const lolosQ3 = x => !f.q3 || (f.q3 === 'naik' ? ['naik', 'berbalik'].includes(x.kuartal?.status)
  : f.q3 === 'melemah' ? x.kuartal?.melemah : !x.kuartal)
const URUT = [['laba', 'Kenaikan laba'], ['q3', 'Laba Q3 YoY'], ['nilai', 'Nilai laba'], ['pendapatan', 'Kenaikan pendapatan'], ['tgl', 'Terbaru']]
// Rupiah-setara untuk mengurutkan nilai laba (USD dikali kurs kasar agar urutan masuk akal).
const rpSetara = n => n ? n.v * (n.mata === 'USD' ? 16500 : 1) : 0
const rows = computed(() => {
  const q = f.cari.trim().toUpperCase()
  const r = basis.value.filter(x => (kat.value === 'semua' || x.kategori === kat.value)
    && lolosHsc(x.t, f.hsc) && (!f.radar || x.radar) && lolosQ3(x)
    && (!f.sehat || ((x.pendapatan?.pct ?? -1) > 0 && !x.catatan.some(c => /basis tahun lalu kecil|pendapatan turun/i.test(c))))
    && (!q || x.t.includes(q) || (x.nama || '').toUpperCase().includes(q)))
  const k = { laba: x => x.laba?.pct ?? -1e9, q3: x => x.kuartal?.yoy ?? (x.kuartal?.status === 'berbalik' ? 1e9 : -1e9), nilai: x => rpSetara(x.laba?.ke), pendapatan: x => x.pendapatan?.pct ?? -1e9, tgl: x => x.tgl }[f.urut]
  return [...r].sort((a, b) => (k(b) > k(a) ? 1 : k(b) < k(a) ? -1 : 0))
})
const n = ref(100)
const uang = x => {
  if (!x) return '–'
  const a = Math.abs(x.v), [d, s] = a >= 1e12 ? [1e12, 'T'] : a >= 1e9 ? [1e9, 'M'] : a >= 1e6 ? [1e6, 'jt'] : [1e3, 'rb']
  return `${x.mata === 'USD' ? 'US$' : 'Rp'}${fmt(x.v / d, 2)} ${s}`
}
const pct = v => v == null ? '–' : (v > 0 ? '+' : '') + fmt(v, 1) + '%'
const uangQ = (v, m) => v == null ? '–' : uang({ v, mata: m })
const Q3TXT = { naik: 'c-good', berbalik: 'c-good', turun: 'c-strong', rugi: 'c-strong' }
const q3Pct = k => !k ? '–' : k.status === 'berbalik' ? 'berbalik laba' : k.status === 'rugi' ? 'rugi' : pct(k.yoy)
const hitQ3 = computed(() => ({ melemah: basis.value.filter(x => x.kuartal?.melemah).length, ada: basis.value.filter(x => x.kuartal).length }))
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
    const spec = { seri: 'Riset LK', judul: per.value === 'q3' ? `LK Bagus: Laporan Keuangan Q3 20${thn}` : 'LK Bagus: Laporan Keuangan Terbaru', label: `${label.toUpperCase()} · ${PERIODE.find(p => p[0] === per.value)[1].toUpperCase()}`,
      sub: 'Laporan keuangan terbaru seluruh emiten BEI dari ringkasan Stockbit Reports, satu laporan terakhir per emiten.',
      updated: data.value.updated, box: [['Laba naik >= 20%', String(hitung.value.bagus || 0)], ['Berbalik laba', String(hitung.value.berbalik || 0)], ['Laba turun', String(hitung.value.turun || 0)], ['Rugi', String(hitung.value.rugi || 0)]],
      bagian: [{ judul: label, ket: 'Laba bersih 9M (kumulatif) dan laba Q3 murni (9M dikurangi 1H) YoY, pendapatan, serta pendorong menurut ringkasan laporan. Q3 melemah = 9M naik tetapi Q3 sendiri turun/rugi.',
        cols: [{ t: 'Saham', w: 15 }, { t: 'Laba 9M', w: 26, align: 'right' }, { t: '9M YoY', w: 17, align: 'right' }, { t: 'Q3 YoY', w: 22, align: 'right' }, { t: 'Pendapatan', w: 16, align: 'right' }, { t: 'Pendorong / catatan', w: 86 }],
        rows: rows.value.slice(0, 200).map(x => [{ t: x.t, bold: true }, uang(x.laba?.ke), { t: labaPct(x), color: P.warna(x.kategori === 'turun' || x.kategori === 'rugi' ? -1 : 1) },
          { t: q3Pct(x.kuartal) + (x.kuartal?.melemah ? ' (melemah)' : ''), color: x.kuartal ? P.warna(['naik', 'berbalik'].includes(x.kuartal.status) ? 1 : -1) : undefined },
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
      <div class="flt" role="group" aria-label="Periode laporan">
        <span class="small muted">Periode:</span>
        <button v-for="[v, l] in PERIODE" :key="v" type="button" class="pill sm" :aria-pressed="String(per === v)" @click="per = v; n = 100">{{ l }}</button>
      </div>
      <div class="kat" role="tablist" aria-label="Kategori LK">
        <button v-for="[k, l] in KAT" :key="k" type="button" role="tab" class="pill" :aria-selected="String(kat === k)" :aria-pressed="String(kat === k)" @click="kat = k; buka = ''; n = 100">
          {{ l }} <span class="muted">{{ k === 'semua' ? basis.length : (hitung[k] || 0) }}</span></button>
      </div>
      <div class="flt" role="group" aria-label="Saringan">
        <input v-model="f.cari" type="search" class="cari" placeholder="Cari kode atau nama…" aria-label="Cari saham" />
        <button type="button" class="pill sm" :aria-pressed="String(f.sehat)" title="Pendapatan ikut naik dan bukan dari basis tahun lalu yang kecil" @click="f.sehat = !f.sehat">Kualitas: pendapatan ikut naik</button>
        <button type="button" class="pill sm" :aria-pressed="String(f.radar)" @click="f.radar = !f.radar">Hanya saham di radar</button>
        <span class="small muted sep" :title="hscInfo()">HSC:</span>
        <button v-for="[v, l] in HSC_OPSI" :key="v" type="button" class="pill sm" :aria-pressed="String(f.hsc === v)" @click="f.hsc = v">{{ l }}</button>
      </div>
      <div class="flt" role="group" aria-label="Kuartal III murni">
        <span class="small muted" title="Laba Q3 murni = laba 9M dikurangi laba 1H (tahun ini dan tahun lalu)">Q3 murni:</span>
        <button v-for="[v, l] in Q3OPSI" :key="v" type="button" class="pill sm" :aria-pressed="String(f.q3 === v)" @click="f.q3 = v">{{ l }}</button>
        <span class="small muted">{{ hitQ3.ada }} emiten terhitung · {{ hitQ3.melemah }} naik di 9M tetapi Q3 melemah</span>
      </div>
      <div class="flt" role="group" aria-label="Urutan">
        <span class="small muted">Urutkan:</span>
        <button v-for="[v, l] in URUT" :key="v" type="button" class="pill sm" :aria-pressed="String(f.urut === v)" @click="f.urut = v">{{ l }}</button>
      </div>
      <div class="mh"><h2>{{ KAT.find(k => k[0] === kat)[1] }}</h2>
        <span class="small muted">{{ rows.length }} emiten · {{ PERIODE.find(p => p[0] === per)[1] }} · laporan terakhir {{ data.updated ? fmtDate(data.updated) : '–' }}</span></div>
      <div class="scroll">
        <table class="ledger">
          <thead><tr><th>Saham</th><th>Periode</th><th class="num">Harga</th><th class="num">Laba bersih 9M</th><th class="num">Laba 9M YoY</th><th class="num">Laba Q3 murni</th><th class="num">Q3 YoY</th><th class="num">Q3 QoQ</th>
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
                <td class="num small">{{ uangQ(x.kuartal?.q3, x.kuartal?.mata) }}</td>
                <td class="num"><b :class="Q3TXT[x.kuartal?.status] || 'muted'">{{ q3Pct(x.kuartal) }}</b>
                  <div v-if="x.kuartal?.melemah" class="tag t-warn" title="Laba 9M naik, tetapi laba kuartal III sendiri turun atau rugi">Q3 melemah</div></td>
                <td class="num small" :class="(x.kuartal?.qoq ?? 0) >= 0 ? '' : 'c-strong'">{{ pct(x.kuartal?.qoq) }}</td>
                <td class="num" :class="(x.pendapatan?.pct ?? 0) >= 0 ? 'c-good' : 'c-strong'">{{ pct(x.pendapatan?.pct) }}</td>
                <td class="num small">{{ x.marginKotor ? fmt(x.marginKotor.dari, 2) + '% → ' + fmt(x.marginKotor.ke, 2) + '%' : '–' }}</td>
                <td class="small dr">{{ x.pendorong || '–' }}</td>
                <td class="small"><a :href="x.url" target="_blank" rel="noopener" @click.stop>{{ fmtDate(x.tgl) }}</a></td>
              </tr>
              <tr v-if="buka === x.id" class="det"><td colspan="12">
                <p class="small"><b>{{ x.judul }}</b> · {{ x.jenisLk }}</p>
                <p class="small">{{ x.ringkas }}</p>
                <ul class="small"><li v-for="p in x.poin" :key="p">{{ p }}</li></ul>
                <p v-if="x.kuartal" class="small"><b>Kuartal III murni</b> (9M − 1H): laba Q3 {{ uangQ(x.kuartal.q3, x.kuartal.mata) }}
                  vs Q3 tahun lalu {{ uangQ(x.kuartal.q3Lalu, x.kuartal.mata) }} ({{ q3Pct(x.kuartal) }})<template v-if="x.kuartal.q2 != null">;
                  Q2 {{ uangQ(x.kuartal.q2, x.kuartal.mata) }} → QoQ {{ pct(x.kuartal.qoq) }}</template><template v-if="x.kuartal.pendYoy != null">;
                  pendapatan Q3 YoY {{ pct(x.kuartal.pendYoy) }}</template>.</p>
                <p v-else class="small muted">Laporan 1H tahun yang sama belum tersedia, sehingga laba Q3 murni belum bisa dihitung.</p>
                <p v-if="x.catatan.length" class="small muted">Catatan: {{ x.catatan.join(' · ') }}.</p>
              </td></tr>
            </template>
          </tbody>
        </table>
      </div>
      <p v-if="rows.length > n" class="small"><button type="button" class="pill sm" @click="n += 100">Tampilkan 100 lagi ({{ rows.length - n }} tersisa)</button></p>
      <p class="small muted"><b>Laba naik ≥ 20%</b> = laba bersih YoY naik minimal 20%; <b>Berbalik laba</b> = periode lalu rugi, kini laba.
        <b>Laba Q3 murni</b> = laba 9M dikurangi laba 1H (tahun ini dan tahun lalu dari laporan yang sama), sehingga terlihat bila kenaikan 9M
        hanya ditopang Q1–Q2; <b>Q3 melemah</b> = laba 9M naik tetapi laba Q3 sendiri turun atau rugi. QoQ = Q3 dibanding Q2 (1H − 3M).
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
