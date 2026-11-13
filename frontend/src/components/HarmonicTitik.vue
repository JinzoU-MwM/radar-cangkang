<script setup>
// Tab "Titik XABCD" halaman Harmonic Pattern: materi menentukan titik X, A, B, C, D (lib/materiTitikXabcd.js) dengan
// daftar isi, diagram, dan pemeriksa titik: isi harga X, A, B, C lalu lihat rasio B dan C, pola yang cocok, PRZ,
// dan batas batal dengan aturan yang sama dengan mesin pendeteksi. Klik "Coba di chart" membuka tab Saham (XABCD).
import { computed, reactive } from 'vue'
import { BAB, RUJUKAN, periksaTitik } from '../lib/materiTitikXabcd.js'

const emit = defineEmits(['coba'])
const ISI = [...BAB.map((b, i) => ({ id: b.id, no: i + 1, judul: b.judul })), { id: 'periksa', no: BAB.length + 1, judul: 'Coba sendiri: pemeriksa titik' }]
const lompat = id => document.getElementById('tx-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

// Pemeriksa titik, diisi contoh Gartley dari materi.
const titik = reactive({ x: 100, a: 200, b: 138, c: 176 })
const hasil = computed(() => periksaTitik(titik))
const CONTOH = [
  { nama: 'Gartley bullish', v: { x: 100, a: 200, b: 138, c: 176 } },
  { nama: 'Bat bullish', v: { x: 100, a: 200, b: 150, c: 180 } },
  { nama: 'Gartley bearish', v: { x: 200, a: 100, b: 162, c: 124 } },
  { nama: '5-0 bullish', v: { x: 100, a: 200, b: 90, c: 300 } },
]
const pakai = v => Object.assign(titik, v)
const fh = v => v == null ? '–' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: v < 200 ? 2 : 0 })
const fr = v => v == null ? '–' : Number(v).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 3 })
</script>

<template>
  <section class="tx">
    <nav class="isi" aria-label="Daftar isi materi titik XABCD">
      <p class="small mute">Menentukan titik X-A-B-C-D</p>
      <ol>
        <li v-for="x in ISI" :key="x.id"><button type="button" @click="lompat(x.id)">{{ x.judul }}</button></li>
      </ol>
      <button type="button" class="btn coba" @click="emit('coba', 'xabcd')">Coba di chart: XABCD</button>
    </nav>

    <div class="badan">
      <header class="kepala">
        <h2>Menentukan Titik X-A-B-C-D</h2>
        <p class="mute">Panduan memilih lima titik pola harmonik di grafik saham: dari mana X dimulai, bagaimana A, B, dan C dipilih, dan bagaimana D dihitung sebagai zona, bukan satu harga.</p>
      </header>

      <article v-for="(b, i) in BAB" :id="'tx-' + b.id" :key="b.id" class="bab">
        <h3><span class="nomor">{{ i + 1 }}</span>{{ b.judul }}</h3>
        <template v-for="(k, j) in b.blok" :key="j">
          <p v-if="k.p" class="prosa">{{ k.p }}</p>
          <h4 v-else-if="k.h">{{ k.h }}</h4>
          <p v-else-if="k.rumus" class="rumus">{{ k.rumus }}</p>
          <ul v-else-if="k.poin" class="poin"><li v-for="(t, n) in k.poin" :key="n">{{ t }}</li></ul>
          <ol v-else-if="k.langkah" class="langkah"><li v-for="(t, n) in k.langkah" :key="n"><b>{{ t[0] }}</b> {{ t[1] }}</li></ol>
          <div v-else-if="k.tabel" class="wrap">
            <table class="tb">
              <thead><tr><th v-for="c in k.tabel.kolom" :key="c">{{ c }}</th></tr></thead>
              <tbody><tr v-for="(r, n) in k.tabel.baris" :key="n"><td v-for="(c, m) in r" :key="m">{{ c }}</td></tr></tbody>
            </table>
          </div>
          <div v-else-if="k.kotak" class="kotak" :class="k.kotak.jenis"><b>{{ k.kotak.judul }}</b><p>{{ k.kotak.teks }}</p></div>
          <figure v-else-if="k.gambar" class="gambar">
            <svg v-if="k.gambar === 'arah'" viewBox="0 0 640 230" role="img" aria-label="Bentuk pola bullish dan bearish">
              <text x="160" y="18" text-anchor="middle" class="t-bull b">Bullish (M)</text>
              <polyline points="30,200 110,50 165,135 235,80 290,190" class="l-bull" />
              <g class="b"><text x="20" y="218">X</text><text x="104" y="42">A</text><text x="160" y="156">B</text><text x="230" y="70">C</text><text x="285" y="212">D</text></g>
              <text x="300" y="196" class="t-mute kecil">beli</text>
              <text x="480" y="18" text-anchor="middle" class="t-bear b">Bearish (W)</text>
              <polyline points="350,40 430,190 485,105 555,160 610,50" class="l-bear" />
              <g class="b"><text x="340" y="34">X</text><text x="424" y="212">A</text><text x="480" y="95">B</text><text x="550" y="182">C</text><text x="605" y="40">D</text></g>
              <text x="575" y="66" class="t-mute kecil">jual</text>
            </svg>
            <svg v-else-if="k.gambar === 'zigzag'" viewBox="0 0 640 200" role="img" aria-label="Zigzag menyaring gerak kecil">
              <polyline points="20,170 40,150 52,158 70,130 85,138 105,95 118,104 130,70 145,82 160,60 178,92 190,85 210,118 225,108 245,140 262,128 280,150 300,120 312,128 330,96 348,104 365,78 380,88 398,62 415,96 430,88 448,118 462,110 480,150 495,140 515,172 530,160 548,130 565,138 590,100 615,110" class="l-harga" />
              <polyline points="20,170 160,60 280,150 398,62 515,172 590,100" class="l-ink" />
              <g class="dot"><circle cx="20" cy="170" r="3.5" /><circle cx="160" cy="60" r="3.5" /><circle cx="280" cy="150" r="3.5" /><circle cx="398" cy="62" r="3.5" /><circle cx="515" cy="172" r="3.5" /></g>
              <circle cx="590" cy="100" r="3.5" class="dot-kosong" />
              <g class="kecil"><text x="85" y="192" class="t-mute">garis abu-abu = harga harian</text><text x="300" y="192">garis tebal = zigzag (swing yang dihitung)</text>
                <text x="560" y="88" class="t-mute">masih berjalan</text><text x="150" y="38" class="t-bear">pantulan kecil diabaikan</text></g>
              <path d="M178 92 l0 -18" class="l-tipis-bear" />
            </svg>
            <svg v-else-if="k.gambar === 'xBenar'" viewBox="0 0 640 232" role="img" aria-label="Memilih X yang salah dan yang benar">
              <text x="155" y="16" text-anchor="middle" class="t-bear b">Salah</text>
              <polyline points="30,120 70,175 105,140 140,205 250,40" class="l-ink" />
              <circle cx="70" cy="175" r="5" class="cincin-bear" />
              <text x="40" y="196" class="t-bear b">X?</text><text x="245" y="32" class="b">A</text>
              <line x1="40" y1="175" x2="280" y2="175" class="l-putus-bear" />
              <text x="150" y="224" class="t-bear kecil">harga turun lagi di bawah "X"</text>
              <text x="480" y="16" text-anchor="middle" class="t-bull b">Benar</text>
              <polyline points="355,120 395,175 430,140 465,205 575,40" class="l-ink" />
              <circle cx="465" cy="205" r="5" class="cincin-bull" />
              <text x="448" y="226" class="t-bull b">X</text><text x="570" y="32" class="b">A</text>
              <text x="355" y="60" class="t-bull kecil">dari X ke A tidak ada</text><text x="355" y="74" class="t-bull kecil">harga di bawah X</text>
            </svg>
            <svg v-else-if="k.gambar === 'prz'" viewBox="0 0 640 280" role="img" aria-label="PRZ sebagai pertemuan beberapa ukuran">
              <polyline points="30,250 150,30 230,145 330,80 440,205" class="l-ink" />
              <polyline points="440,205 470,226" class="l-ink putus" />
              <g class="b"><text x="20" y="268">X</text><text x="144" y="22">A</text><text x="222" y="166">B</text><text x="325" y="70">C</text><text x="462" y="250">D</text></g>
              <rect x="380" y="208" width="250" height="20" class="zona" />
              <line x1="380" y1="212" x2="630" y2="212" class="l-acc" /><line x1="380" y1="219" x2="630" y2="219" class="l-bull tipis" /><line x1="380" y1="224" x2="630" y2="224" class="l-bear tipis" />
              <text x="500" y="200" class="t-warn b">PRZ</text>
              <g class="kecil">
                <line x1="450" y1="36" x2="470" y2="36" class="l-acc" /><text x="476" y="40" class="t-acc">level D dari XA (0,786)</text>
                <line x1="450" y1="54" x2="470" y2="54" class="l-bull tipis" /><text x="476" y="58" class="t-bull">proyeksi BC (1,618)</text>
                <line x1="450" y1="72" x2="470" y2="72" class="l-bear tipis" /><text x="476" y="76" class="t-bear">AB = CD</text>
              </g>
            </svg>
            <svg v-else-if="k.gambar === 'contoh'" viewBox="0 0 640 300" role="img" aria-label="Contoh Gartley bullish dengan harga">
              <g class="l-grid"><line x1="60" y1="256" x2="620" y2="256" /><line x1="60" y1="16" x2="620" y2="16" /><line x1="60" y1="164.8" x2="620" y2="164.8" /><line x1="60" y1="73.6" x2="620" y2="73.6" /></g>
              <g class="t-mute kecil" text-anchor="end"><text x="54" y="260">100</text><text x="54" y="20">200</text><text x="54" y="169">138</text><text x="54" y="78">176</text><text x="54" y="209">121</text></g>
              <rect x="430" y="190.2" width="190" height="14.4" class="zona" />
              <polygon points="80,256 220,16 310,164.8" class="isi-bull" /><polygon points="310,164.8 410,73.6 520,204.6" class="isi-bull" />
              <polyline points="80,256 220,16 310,164.8 410,73.6" class="l-ink" />
              <polyline points="410,73.6 520,204.6" class="l-ink putus" />
              <g class="l-putus-acc"><line x1="80" y1="256" x2="310" y2="164.8" /><line x1="220" y1="16" x2="410" y2="73.6" /><line x1="310" y1="164.8" x2="520" y2="204.6" /><line x1="80" y1="256" x2="520" y2="204.6" /></g>
              <g class="t-acc kecil"><text x="228" y="192">0,618 XA</text><text x="300" y="38">0,618 AB</text><text x="322" y="198">1,13–1,618 BC</text><text x="250" y="250">0,786 XA</text></g>
              <g class="b"><text x="70" y="276">X</text><text x="214" y="12">A</text><text x="304" y="184">B</text><text x="404" y="66">C</text><text x="514" y="226">D</text></g>
              <text x="625" y="186" class="t-warn b kecil" text-anchor="end">PRZ 118–124</text>
              <line x1="430" y1="256" x2="620" y2="256" class="l-bear tipis" />
              <text x="620" y="250" class="t-bear kecil" text-anchor="end">batas batal = X (100)</text>
            </svg>
            <figcaption class="small mute">{{ k.ket }}</figcaption>
          </figure>
        </template>
      </article>

      <article id="tx-periksa" class="bab periksa">
        <h3><span class="nomor">{{ BAB.length + 1 }}</span>Coba sendiri: pemeriksa titik</h3>
        <p class="prosa">Isi harga X, A, B, dan C dari grafik. Rasio dan pola dihitung dengan aturan yang sama dengan mesin pendeteksi di tab Saham dan Screening (toleransi ±5%, proyeksi BC ±10%).</p>
        <div class="contoh">
          <span class="small mute">Contoh:</span>
          <button v-for="c in CONTOH" :key="c.nama" type="button" class="chip" @click="pakai(c.v)">{{ c.nama }}</button>
        </div>
        <div class="input">
          <label v-for="n in ['x', 'a', 'b', 'c']" :key="n"><b>{{ n.toUpperCase() }}</b><input v-model.number="titik[n]" type="number" min="0" step="any" inputmode="decimal" /></label>
        </div>
        <p v-if="hasil.galat" class="galat" role="alert">{{ hasil.galat }}</p>
        <template v-else>
          <div class="ringkas">
            <div><span class="small mute">Arah</span><b :class="hasil.arah === 'bullish' ? 'up' : 'dn'">{{ hasil.arah }}</b></div>
            <div><span class="small mute">Rasio B (AB/XA)</span><b>{{ fr(hasil.rasio.b) }}</b><span v-if="hasil.lewatX" class="small mute">B melewati X</span></div>
            <div><span class="small mute">Rasio C (BC/AB)</span><b>{{ fr(hasil.rasio.c) }}</b><span v-if="hasil.lewatA" class="small mute">C melewati A ({{ fr(hasil.rasio.cx) }} XA)</span></div>
          </div>
          <div v-if="hasil.cocok.length" class="wrap">
            <table class="tb">
              <thead><tr><th>Pola yang cocok</th><th>PRZ (zona D)</th><th>Batas batal</th><th>Selisih dari rasio baku</th></tr></thead>
              <tbody><tr v-for="p in hasil.cocok" :key="p.k">
                <td><b>{{ p.nama }}</b> {{ hasil.arah }}</td>
                <td class="kode">{{ fh(p.prz[0]) }} – {{ fh(p.prz[1]) }}</td>
                <td class="kode">{{ fh(p.batal) }}</td>
                <td class="kode">{{ p.skor === 0 ? 'tepat' : (p.skor * 100).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '%' }}</td>
              </tr></tbody>
            </table>
          </div>
          <p v-else class="galat">Rasio B dan C tidak cocok dengan pola XABCD mana pun. Coba calon X atau A lain (bab Titik X), atau periksa lagi apakah swing yang dipilih sudah sebanding.</p>
          <p v-if="hasil.cocok.length > 1" class="small mute">Lebih dari satu pola bisa cocok dengan X-A-B-C yang sama. Pola mana yang benar-benar terbentuk ditentukan oleh di zona mana harga nanti berbalik (titik D).</p>
          <p class="small mute">PRZ di sini belum memperhitungkan AB=CD dan belum berarti D terbentuk: tunggu harga masuk zona lalu berbalik.</p>
        </template>
      </article>

      <p class="small mute sumber">{{ RUJUKAN }} Isi buku diringkas dengan kata-kata sendiri. Bahan belajar, bukan saran investasi.</p>
    </div>
  </section>
</template>

<style scoped>
.tx{display:grid;grid-template-columns:220px minmax(0,1fr);gap:14px;align-items:start}
.isi{background:var(--sheet);border:1px solid var(--rule);border-radius:8px;padding:10px;position:sticky;top:10px;max-height:calc(100vh - 40px);overflow:auto}
.isi p{margin:0 0 6px}
.isi ol{margin:0 0 10px;padding-left:20px;display:grid;gap:1px;font-size:12.5px}
.isi ol button{display:block;background:none;border:0;padding:3px 4px;text-align:left;color:var(--ink-2);cursor:pointer;font:inherit;border-radius:4px;width:100%}
.isi ol button:hover{background:var(--zebra);color:var(--ink)}
.coba{width:100%;background:var(--accent);color:var(--sheet);border-color:var(--accent);font-weight:700}
.badan{display:grid;gap:12px;min-width:0}
.kepala h2{font-family:var(--f-display);font-size:26px;margin:0 0 4px;color:var(--ink)}
.kepala p{margin:0;font-size:15px}
.bab{background:var(--sheet);border:1px solid var(--rule);border-radius:10px;padding:20px 26px;box-shadow:var(--shadow);scroll-margin-top:10px}
.bab h3{font-family:var(--f-display);font-size:21px;margin:0 0 10px;color:var(--ink);display:flex;gap:8px;align-items:baseline}
.bab h3 .nomor{color:var(--accent);font-family:var(--f-data)}
.bab h4{font-size:15px;margin:14px 0 6px;color:var(--ink)}
.prosa{margin:0 0 10px;font-size:15px;line-height:1.65;color:var(--ink)}
.rumus{margin:0 0 10px;padding:7px 12px;background:var(--sheet-2);border-radius:6px;font:14px var(--f-data);color:var(--ink)}
.poin{margin:0 0 10px;padding-left:20px;display:grid;gap:6px;font-size:15px;line-height:1.55;color:var(--ink)}
.langkah{margin:0 0 10px;padding-left:22px;display:grid;gap:7px;font-size:15px;line-height:1.55;color:var(--ink)}
.wrap{overflow-x:auto;margin:4px 0 12px}
.tb{border-collapse:collapse;font-size:14px;width:100%}
.tb th,.tb td{border-bottom:1px solid var(--rule-2);padding:7px 10px;text-align:left;vertical-align:top}
.tb th{color:var(--ink-2);font-weight:600;background:var(--sheet-2)}
.kode{font-family:var(--f-data);white-space:nowrap}
.kotak{border-left:3px solid var(--accent);background:var(--sheet-2);border-radius:0 6px 6px 0;padding:9px 13px;margin:6px 0 12px;font-size:14.5px;line-height:1.55;color:var(--ink)}
.kotak p{margin:3px 0 0}
.kotak.awas{border-left-color:var(--strong)}
.kotak.ok{border-left-color:var(--good)}
.gambar{margin:6px 0 12px;text-align:center}
.gambar svg{width:100%;max-width:620px;height:auto;font:13px var(--f-body);fill:var(--ink)}
.gambar figcaption{margin-top:4px}
/* diagram: semua warna dari token */
svg .b{font-weight:700;font-size:15px}
svg .kecil{font-size:11.5px;font-weight:400}
svg .t-bull{fill:var(--good)} svg .t-bear{fill:var(--strong)} svg .t-mute{fill:var(--ink-2)} svg .t-acc{fill:var(--accent-ink)} svg .t-warn{fill:var(--warn)}
svg polyline,svg line,svg path{fill:none}
svg .l-ink{stroke:var(--ink);stroke-width:2.4}
svg .l-bull{stroke:var(--good);stroke-width:2.5}
svg .l-bear{stroke:var(--strong);stroke-width:2.5}
svg .tipis{stroke-width:1.6}
svg .putus{stroke-dasharray:5 4}
svg .l-harga{stroke:var(--ink-2);stroke-width:1.2;opacity:.6}
svg .l-acc{stroke:var(--accent);stroke-width:1.8}
svg .l-putus-acc line{stroke:var(--accent);stroke-dasharray:4 3}
svg .l-putus-bear{stroke:var(--strong);stroke-dasharray:4 3}
svg .l-tipis-bear{stroke:var(--strong)}
svg .l-grid line{stroke:var(--rule-2)}
svg .dot circle{fill:var(--ink)}
svg .dot-kosong{fill:none;stroke:var(--ink)}
svg .cincin-bear{fill:none;stroke:var(--strong);stroke-width:2}
svg .cincin-bull{fill:none;stroke:var(--good);stroke-width:2}
svg .zona{fill:var(--warn-bg);stroke:none}
svg .isi-bull{fill:var(--good-bg);stroke:none}
/* pemeriksa titik */
.contoh{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px}
.chip{border:1px solid var(--rule);background:var(--sheet);color:var(--ink-2);border-radius:14px;padding:4px 10px;cursor:pointer;font:600 12px var(--f-body)}
.chip:hover{background:var(--accent-soft);color:var(--accent-ink);border-color:transparent}
.input{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}
.input label{display:grid;gap:3px;font-size:13px;color:var(--ink-2)}
.input input{font:15px var(--f-data);padding:6px 9px;border:1px solid var(--rule);border-radius:6px;background:var(--sheet);color:var(--ink);width:100%;box-sizing:border-box}
.ringkas{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:10px}
.ringkas>div{display:grid;gap:2px;background:var(--sheet-2);border-radius:6px;padding:8px 11px}
.ringkas b{font:700 18px var(--f-data);color:var(--ink);text-transform:capitalize}
.galat{color:var(--strong);font-size:14px;margin:0 0 8px}
.up{color:var(--good)!important}.dn{color:var(--strong)!important}.mute{color:var(--ink-2)}.small{font-size:12px}
.sumber{margin:0}
@media (max-width: 900px){
  .tx{grid-template-columns:1fr}
  .isi{position:static;max-height:none}
  .bab{padding:16px}
  .input{grid-template-columns:repeat(2,minmax(0,1fr))}
  .ringkas{grid-template-columns:1fr}
}
</style>
