<script setup>
// Saham 50: saham berharga <= Rp50 di seluruh BEI dengan analisa potensi ke depan (/api/saham50): radar backdoor &
// calon cangkang, aksi korporasi 90-180 hari, kinerja laporan keuangan & kuartal murni, valuasi, dan teknikal harga.
// Skor 0-100 dan narasi disusun server; daftar diperbarui harian setelah bursa tutup. Dapat diunduh sebagai PDF.
import { computed, reactive, ref } from 'vue'
import { api } from '../api.js'
import { fmt, fmtDate } from '../lib/domain.js'
import { isHsc } from '../lib/hsc.js'

const data = ref(null), err = ref(''), loading = ref(true)
api.get('/api/saham50').then(r => { if (r.error) err.value = r.error; else data.value = r }, e => { err.value = e.message || String(e) }).finally(() => { loading.value = false })

const KAT = [['semua', 'Semua'], ['backdoor', 'Backdoor / calon cangkang'], ['aksi', 'Aksi korporasi 90 hari'], ['kinerja', 'Kinerja membaik'], ['murah', 'PBV < 1']]
const f = reactive({ kat: 'semua', cari: '', tanpaDatar: true })
// Kriteria tiap kategori (dipakai saringan dan penghitung).
const KRIT = {
  semua: () => true,
  backdoor: x => x.radar || x.kandidat,
  aksi: x => x.jenisAksi.some(j => j !== 'uma'),
  kinerja: x => ['naik', 'berbalik'].includes(x.kinerja?.kuartal?.status) || ['bagus', 'berbalik'].includes(x.kinerja?.kategori),
  murah: x => x.valuasi?.pbv > 0 && x.valuasi.pbv < 1,
}
const rows = computed(() => {
  const q = f.cari.trim().toUpperCase()
  return (data.value?.rows || []).filter(x => KRIT[f.kat](x) && (!f.tanpaDatar || !x.tek.datar) && (!q || x.t.includes(q) || (x.nama || '').toUpperCase().includes(q)))
})
const hitung = computed(() => Object.fromEntries(KAT.map(([k]) => [k, (data.value?.rows || []).filter(KRIT[k]).length])))
const top5 = computed(() => rows.value.slice(0, 5))
const n = ref(60), buka = ref('')
const pct = v => v == null ? '–' : (v > 0 ? '+' : '') + fmt(v, 1) + '%'
const JENIS = { akuisisi: 'Pengendali', rights: 'Modal', kbli: 'Usaha baru', direksi: 'Pengurus', uma: 'UMA' }

const busyPdf = ref(false), errPdf = ref('')
async function unduhPdf() {
  busyPdf.value = true; errPdf.value = ''
  try {
    const [{ jsPDF }, P] = await Promise.all([import('jspdf'), import('../lib/daftarPdf.js')])
    const label = KAT.find(k => k[0] === f.kat)[1]
    const spec = { seri: 'Riset Saham 50', judul: 'Saham 50: Harga Rp50 ke Bawah', label: label.toUpperCase(),
      sub: 'Saham berharga Rp50 ke bawah di seluruh BEI dengan analisa potensi: backdoor, aksi korporasi, kinerja, valuasi, dan teknikal.',
      updated: data.value.updated, box: [['Saham <= Rp50', String(data.value.n)], ['Backdoor/kandidat', String(hitung.value.backdoor)], ['Aksi korporasi', String(hitung.value.aksi)], ['Kinerja membaik', String(hitung.value.kinerja)]],
      bagian: [{ judul: `Saham 50 · ${label}`, ket: 'Skor 0-100: radar/calon cangkang, aksi korporasi, kinerja, valuasi, teknikal. Target = nilai wajar analisa radar atau resistance terdekat.',
        cols: [{ t: 'Saham', w: 15 }, { t: 'Skor', w: 11, align: 'right' }, { t: 'Harga', w: 14, align: 'right' }, { t: 'Target', w: 22, align: 'right' }, { t: 'Potensi / risiko', w: 120 }],
        rows: rows.value.slice(0, 150).map(x => [{ t: x.t, bold: true }, String(x.skor), P.n0(x.harga),
          x.target ? `${P.n0(x.target.harga)} (${pct(x.target.potensi)})` : '-', [...x.potensi, ...x.risiko.map(r => 'Risiko: ' + r)].join('. ')]) }],
      metode: 'Penyaringan otomatis dari harga Stockbit, keterbukaan informasi, laporan keuangan, dan Key Stats; bukan ajakan membeli. Saham di bawah Rp50 umumnya likuiditasnya tipis.' }
    ;(await P.daftarPdf(spec, jsPDF)).save(P.daftarPdfName('Saham-50'))
  } catch (e) { errPdf.value = 'PDF gagal dibuat: ' + (e.message || e) } finally { busyPdf.value = false }
}
</script>

<template>
  <section class="s50">
    <p class="small muted intro">Saham berharga <b>Rp50 ke bawah</b> di seluruh BEI beserta analisa potensinya: radar backdoor dan calon cangkang,
      aksi korporasi, kinerja laporan keuangan, valuasi, dan teknikal. Diperbarui otomatis setiap hari setelah bursa tutup.</p>
    <div class="unduh"><span v-if="errPdf" class="small c-strong">{{ errPdf }}</span>
      <button type="button" class="btn" :disabled="busyPdf || !data" @click="unduhPdf">{{ busyPdf ? 'Menyiapkan PDF…' : '⬇ Unduh riset Saham 50 (PDF)' }}</button></div>
    <p v-if="loading" class="muted">Memuat Saham 50…</p>
    <p v-else-if="err" class="muted">{{ err }}</p>
    <template v-else-if="data">
      <section v-if="top5.length" class="top5">
        <div class="mh"><h2>5 Teratas Saham 50</h2><span class="small muted">skor potensi tertinggi pada saringan aktif · bukan ajakan membeli</span></div>
        <div class="kartu">
          <article v-for="(x, i) in top5" :key="x.t" class="k5">
            <div class="kh"><span class="no">{{ i + 1 }}</span>
              <RouterLink :to="{ path: '/emiten/' + x.t, query: { tab: 'analisa' } }"><b>{{ x.t }}</b></RouterLink>
              <span class="tag t-good">skor {{ x.skor }}</span>
              <span v-if="x.radar" class="tag t-warn">backdoor</span><span v-else-if="x.kandidat" class="tag t-calm">calon cangkang</span></div>
            <div v-if="x.nama" class="small muted">{{ x.nama }}</div>
            <div class="angka">
              <div><span class="small muted">Harga</span><b>Rp{{ fmt(x.harga, 0) }}</b></div>
              <div><span class="small muted">Target</span><b>{{ x.target ? 'Rp' + fmt(x.target.harga, 0) : '–' }}</b></div>
              <div><span class="small muted">Potensi</span><b :class="(x.target?.potensi ?? 0) > 0 ? 'c-good' : 'muted'">{{ pct(x.target?.potensi) }}</b></div>
            </div>
            <ul class="small al"><li v-for="p in x.potensi.slice(0, 4)" :key="p">▲ {{ p }}</li></ul>
            <ul v-if="x.risiko.length" class="small rs"><li v-for="r in x.risiko.slice(0, 3)" :key="r">● {{ r }}</li></ul>
          </article>
        </div>
      </section>

      <div class="kat" role="tablist" aria-label="Kategori Saham 50">
        <button v-for="[k, l] in KAT" :key="k" type="button" role="tab" class="pill" :aria-selected="String(f.kat === k)" :aria-pressed="String(f.kat === k)" @click="f.kat = k; n = 60; buka = ''">
          {{ l }} <span class="muted">{{ hitung[k] }}</span></button>
      </div>
      <div class="flt">
        <input v-model="f.cari" type="search" class="cari" placeholder="Cari kode atau nama…" aria-label="Cari saham" />
        <button type="button" class="pill sm" :aria-pressed="String(f.tanpaDatar)" title="Sembunyikan saham yang harganya hampir tidak bergerak 20 hari" @click="f.tanpaDatar = !f.tanpaDatar">Sembunyikan yang tidak likuid</button>
      </div>
      <div class="mh"><h2>Daftar Saham 50</h2><span class="small muted">{{ rows.length }} dari {{ data.n }} saham ≤ Rp{{ data.batas }} · diperbarui {{ data.updated }}</span></div>
      <div class="scroll">
        <table class="ledger">
          <thead><tr><th>Saham</th><th class="num">Skor</th><th class="num">Harga</th><th class="num">1M</th><th class="num">YTD</th><th class="num">Dari terendah</th>
            <th class="num">PBV</th><th>Aksi korporasi</th><th>Kinerja</th><th class="num">Target</th></tr></thead>
          <tbody>
            <template v-for="x in rows.slice(0, n)" :key="x.t">
              <tr class="row" :class="{ open: buka === x.t }" tabindex="0" @click="buka = buka === x.t ? '' : x.t" @keydown.enter="buka = buka === x.t ? '' : x.t">
                <td><span class="car">{{ buka === x.t ? '▾' : '▸' }}</span>
                  <RouterLink :to="{ path: '/emiten/' + x.t, query: { tab: 'analisa' } }" @click.stop><b>{{ x.t }}</b></RouterLink>
                  <span v-if="x.radar" class="tag t-warn">backdoor</span><span v-else-if="x.kandidat" class="tag t-calm">kandidat</span>
                  <span v-if="isHsc(x.t)" class="tag t-warn">HSC</span>
                  <div v-if="x.nama" class="small muted nm">{{ x.nama }}</div></td>
                <td class="num"><b>{{ x.skor }}</b></td>
                <td class="num">Rp{{ fmt(x.harga, 0) }}</td>
                <td class="num" :class="(x.tek.ret['1M'] ?? 0) >= 0 ? 'c-good' : 'c-strong'">{{ pct(x.tek.ret['1M']) }}</td>
                <td class="num" :class="(x.tek.ret.YTD ?? 0) >= 0 ? 'c-good' : 'c-strong'">{{ pct(x.tek.ret.YTD) }}</td>
                <td class="num small">{{ pct(x.tek.dariRendah) }}</td>
                <td class="num small">{{ x.valuasi?.pbv != null ? fmt(x.valuasi.pbv, 2) + '×' : '–' }}</td>
                <td class="small"><span v-for="j in x.jenisAksi" :key="j" class="tag" :class="j === 'uma' ? 't-strong' : 't-calm'">{{ JENIS[j] || j }}</span><span v-if="!x.jenisAksi.length" class="muted">–</span></td>
                <td class="small">{{ x.kinerja?.kuartal ? 'Q' + x.kinerja.kuartal.q + ' ' + ({ naik: 'naik', berbalik: 'berbalik laba', turun: 'turun', rugi: 'rugi' }[x.kinerja.kuartal.status] || '–') : (x.kinerja?.judul || '–') }}</td>
                <td class="num small">{{ x.target ? 'Rp' + fmt(x.target.harga, 0) + ' (' + pct(x.target.potensi) + ')' : '–' }}</td>
              </tr>
              <tr v-if="buka === x.t" class="det"><td colspan="10">
                <div class="dua">
                  <div><b class="small">Potensi ke depan</b><ul class="small"><li v-for="p in x.potensi" :key="p">{{ p }}</li><li v-if="!x.potensi.length" class="muted">Belum ada katalis yang terbaca.</li></ul></div>
                  <div><b class="small">Risiko</b><ul class="small"><li v-for="r in x.risiko" :key="r">{{ r }}</li><li v-if="!x.risiko.length" class="muted">Tidak ada catatan risiko khusus.</li></ul></div>
                </div>
                <p v-if="x.target" class="small muted">Target {{ x.target.dasar }}: Rp{{ fmt(x.target.harga, 0) }} ({{ pct(x.target.potensi) }}).
                  Teknikal: RSI {{ x.tek.rsi ?? '–' }}, {{ x.tek.diAtasEma20 ? 'di atas' : 'di bawah' }} EMA20, {{ pct(x.tek.dariTinggi) }} dari tertinggi 52 minggu.</p>
                <template v-if="x.aksi.length"><b class="small">Keterbukaan aksi korporasi terbaru</b>
                  <ul class="small"><li v-for="a in x.aksi" :key="a.url + a.judul">{{ fmtDate(a.tgl) }} · <a :href="a.url" target="_blank" rel="noopener" @click.stop>{{ a.judul }}</a><span v-if="a.inti" class="muted"> — {{ a.inti }}</span></li></ul></template>
              </td></tr>
            </template>
          </tbody>
        </table>
      </div>
      <p v-if="rows.length > n" class="small"><button type="button" class="pill sm" @click="n += 60">Tampilkan 60 lagi ({{ rows.length - n }} tersisa)</button></p>
      <p class="small muted"><b>Skor potensi</b> (0–100): radar backdoor 25 atau calon cangkang 20, aksi pengendali 90 hari 15, penambahan modal/usaha baru 10,
        laba kuartal murni naik/berbalik 15, PBV &lt; 0,5× 10 (&lt; 1× 5), teknikal mulai naik 10 (dekat dasar 5). <b>Target</b> = batas atas nilai wajar
        analisa radar bila ada, selain itu resistance terdekat (tertinggi 60 hari). Saham di bawah Rp50 umumnya berlikuiditas tipis dan diperdagangkan
        di Papan Pemantauan Khusus; bukan ajakan membeli.</p>
    </template>
  </section>
</template>

<style scoped>
.intro{margin:0 0 6px}.unduh{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin:0 0 8px}
.kat,.flt{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0}
.cari{padding:5px 8px;border:1px solid var(--rule);border-radius:6px;background:var(--sheet);color:inherit;min-width:180px}
.mh{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.mh h2{margin:8px 0 6px}
.top5{margin:6px 0 12px}.kartu{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.k5{border:1px solid var(--rule);border-left:4px solid var(--good);background:var(--sheet);padding:10px 12px}
.kh{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.no{font:700 18px var(--f-display);color:var(--ink-2)}
.angka{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0}.angka div{display:flex;flex-direction:column}
.al,.rs{list-style:none;margin:4px 0 0;padding:0}.rs li{color:var(--ink-2)}
.scroll{overflow-x:auto}.row{cursor:pointer}.car{color:var(--ink-2);font-size:11px}.nm{max-width:200px}
.det td{background:var(--sheet)}.dua{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}.det ul{margin:4px 0;padding-left:18px}
</style>
