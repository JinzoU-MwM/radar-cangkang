<script setup>
// Materi pemula Harmonic Pattern (POV): dasar swing & Fibonacci (kalkulator), candle konfirmasi, manajemen risiko
// (kalkulator lot), latihan kuis, serta glosarium & FAQ. Ditampilkan per bagian oleh PovHarmonik.
import { computed, reactive, ref } from 'vue'
import { fibLevels, ukuranPosisi, KUIS, nilaiKuis } from '../lib/harmonikBelajar.js'

defineProps({ bagian: { type: String, required: true } })
const rp = v => v == null || isNaN(v) ? '–' : Math.round(v).toLocaleString('id-ID')
const r3 = v => Number(v).toLocaleString('id-ID', { maximumFractionDigits: 3 })

// Kalkulator Fibonacci.
const fib = reactive({ x: 1000, a: 1500 })
const lv = computed(() => fibLevels(fib.x, fib.a))
const naik = computed(() => Number(fib.a) > Number(fib.x))

// Kalkulator ukuran posisi.
const pos = reactive({ modal: 10000000, risikoPct: 2, entry: 500, stop: 470, target: 590 })
const up = computed(() => ukuranPosisi(pos))

// Kuis.
const jawab = ref({})
const nilai = computed(() => nilaiKuis(jawab.value))
const pilihJawab = (i, j) => { if (jawab.value[i] == null) jawab.value = { ...jawab.value, [i]: j } }

const CANDLE = [
  { k: 'Pin bar', bull: { o: 62, c: 66, h: 60, l: 20 }, teks: 'Ekor panjang (minimal 2x badan) menunjuk ke arah PRZ: harga sempat menembus lalu ditolak. Untuk bullish, ekor di bawah.' },
  { k: 'Engulfing', dua: [{ o: 55, c: 40, h: 58, l: 36 }, { o: 38, c: 62, h: 64, l: 35 }], teks: 'Candle kedua menelan badan candle sebelumnya dengan arah berlawanan: tekanan berbalik.' },
  { k: 'Inside / outside bar', dua: [{ o: 40, c: 60, h: 66, l: 32 }, { o: 50, c: 56, h: 60, l: 44 }], teks: 'Inside bar: rentang candle kedua di dalam candle pertama (jeda). Outside bar: rentangnya melampaui candle sebelumnya.' },
]
const GLOSARIUM = [
  ['Swing high / swing low', 'Puncak atau lembah yang jelas, tempat harga berbalik arah. Titik X, A, B, C, D dipilih dari swing.'],
  ['Kaki (leg)', 'Pergerakan dari satu titik ke titik berikutnya: XA, AB, BC, CD.'],
  ['Retracement', 'Seberapa jauh harga mundur dari satu kaki, dalam rasio Fibonacci (0,382; 0,5; 0,618; 0,786; 0,886).'],
  ['Extension', 'Proyeksi melewati titik awal kaki (1,13; 1,27; 1,414; 1,618 dan seterusnya).'],
  ['PRZ (Potential Reversal Zone)', 'Zona tempat beberapa level Fibonacci bertemu; area kemungkinan harga berbalik, bukan jaminan.'],
  ['Bullish / bearish', 'Bullish: D berupa lembah, potensi naik. Bearish: D berupa puncak, potensi turun.'],
  ['Konfirmasi', 'Bukti tambahan bahwa harga benar berbalik di PRZ: candle pembalikan, divergence, atau tembus struktur minor.'],
  ['Divergence RSI', 'Harga membuat lembah lebih rendah tetapi RSI lebih tinggi (atau sebaliknya): momentum melemah.'],
  ['Stop loss', 'Batas rugi; bila tersentuh, skenario dianggap salah dan posisi ditutup.'],
  ['Take profit / target', 'Harga tujuan untuk merealisasikan untung, misalnya 0,382 dan 0,618 kaki AD.'],
  ['R:R (risk-reward)', 'Perbandingan potensi untung dengan risiko rugi. R:R 2 berarti target dua kali jarak stop.'],
  ['Lot', 'Satuan transaksi saham BEI; 1 lot = 100 lembar.'],
]
const FAQ = [
  ['Apakah pola harmonik selalu benar?', 'Tidak. PRZ hanya area probabilitas; sinyal palsu tetap terjadi. Karena itu selalu ada stop loss dan konfirmasi.'],
  ['Time frame apa yang cocok untuk pemula?', 'H4 atau Daily: pergerakannya lebih stabil dan PRZ lebih signifikan dibanding time frame kecil yang rentan noise.'],
  ['Kenapa pola di screening berbeda dengan yang saya gambar sendiri?', 'Pemilihan swing berbeda menghasilkan rasio berbeda. Screening memakai swing minimal 6%, 10%, dan 15% dengan toleransi rasio ±5%.'],
  ['Bolehkah entry sebelum D terbentuk?', 'Tidak disarankan. Entry sebelum D sama dengan menebak arah harga, bukan mengikuti struktur pola.'],
  ['Berapa risiko yang wajar per transaksi?', 'Banyak trader membatasi 1-2% modal per transaksi; ukuran lot dihitung dari jarak entry ke stop, bukan dari keyakinan.'],
  ['Bagaimana cara berlatih tanpa risiko?', 'Amati pola di chart historis atau screening, catat PRZ, stop, dan target, lalu lihat hasilnya tanpa uang sungguhan dulu.'],
]
const SALAH = [
  'Entry begitu harga menyentuh D tanpa menunggu konfirmasi.',
  'Memaksakan pola padahal rasio tidak memenuhi kriteria.',
  'Tidak memasang stop, atau menggeser stop menjauh saat harga melawan.',
  'Ukuran posisi terlalu besar sehingga satu kerugian menguras modal.',
  'Mengabaikan tren time frame besar dan likuiditas saham.',
]
const CEK = [
  'Rasio B, C, dan D sesuai kriteria pola (toleransi kecil).',
  'Harga sudah masuk PRZ dan titik D terbentuk.',
  'Ada konfirmasi: candle pembalikan, divergence, atau tembus struktur minor.',
  'Stop, target, dan R:R sudah ditulis sebelum entry (R:R minimal sekitar 1,5-2).',
  'Ukuran lot sesuai batas risiko per transaksi.',
  'Saham cukup likuid dan pola searah tren besar (nilai tambah).',
]
// Candle SVG: skala y 0-100 (atas = tinggi).
const cy = v => 100 - v
</script>

<template>
  <!-- Dasar: swing, tren, Fibonacci -->
  <div v-if="bagian === 'dasar'" class="hb">
    <div class="g2">
      <div class="kartu">
        <span class="ik">1. Swing dan tren</span>
        <svg viewBox="0 0 320 130" class="mini" role="img" aria-label="Contoh swing high dan swing low">
          <polyline points="10,110 70,40 110,80 170,20 210,60 270,30 310,70" class="ln" />
          <g v-for="p in [[70,40,'SH'],[170,20,'SH'],[270,30,'SH']]" :key="p[0]"><circle :cx="p[0]" :cy="p[1]" r="4" class="up" /><text :x="p[0]" :y="p[1] - 8">{{ p[2] }}</text></g>
          <g v-for="p in [[10,110,'SL'],[110,80,'SL'],[210,60,'SL']]" :key="p[0]"><circle :cx="p[0]" :cy="p[1]" r="4" class="dn" /><text :x="p[0]" :y="p[1] + 16">{{ p[2] }}</text></g>
        </svg>
        <p class="small"><b>Swing high (SH)</b> adalah puncak tempat harga berbalik turun; <b>swing low (SL)</b> lembah tempat harga berbalik naik.
          Rangkaian SH dan SL yang makin tinggi menandakan tren naik. Harmonic Pattern dibangun dari lima swing berurutan: X, A, B, C, D.</p>
        <p class="small"><b>Dorongan (impuls)</b> adalah gerak kuat searah tren; <b>koreksi</b> adalah gerak mundur sementara. Pada pola harmonik, XA adalah dorongan, AB dan BC koreksi, CD kaki penentu.</p>
      </div>
      <div class="kartu">
        <span class="ik">2. Fibonacci: kalkulator</span>
        <p class="small">Rasio Fibonacci (0,618, 0,786, 1,618, dan lainnya) dipakai untuk mengukur seberapa jauh harga mundur (<b>retracement</b>) atau melampaui titik awal (<b>extension</b>). Isi harga X dan A:</p>
        <div class="inp2">
          <label>Harga X <input v-model.number="fib.x" type="number" min="1" /></label>
          <label>Harga A <input v-model.number="fib.a" type="number" min="1" /></label>
        </div>
        <table class="ledger small">
          <thead><tr><th>Rasio</th><th>Jenis</th><th class="num">Harga</th><th>Dipakai untuk</th></tr></thead>
          <tbody><tr v-for="l in lv" :key="l.r"><td>{{ r3(l.r) }}</td><td>{{ l.jenis }}</td><td class="num"><b>{{ rp(l.harga) }}</b></td>
            <td class="muted">{{ { 0.382: 'B Bat/Crab', 0.5: 'B Bat', 0.618: 'B Gartley', 0.786: 'B Butterfly, D Gartley', 0.886: 'D Bat', 1.13: 'batas BC', 1.27: 'D Butterfly', 1.414: 'C Cypher', 1.618: 'D Crab' }[l.r] }}</td></tr></tbody>
        </table>
        <p class="small muted">Kaki XA {{ naik ? 'naik' : 'turun' }} sebesar {{ rp(Math.abs(fib.a - fib.x)) }}. Retracement dihitung dari A kembali ke arah X; extension melewati X.</p>
      </div>
    </div>
  </div>

  <!-- Candle konfirmasi -->
  <div v-else-if="bagian === 'candle'" class="hb">
    <p class="small">Harga menyentuh PRZ belum cukup. Tunggu tanda bahwa harga benar-benar berbalik. Contoh untuk pola <b>bullish</b> (D di lembah):</p>
    <div class="g3">
      <div v-for="c in CANDLE" :key="c.k" class="kartu">
        <span class="ik">{{ c.k }}</span>
        <svg viewBox="0 0 120 100" class="mini c" role="img" :aria-label="'Ilustrasi ' + c.k">
          <template v-for="(b, i) in (c.dua || [c.bull])" :key="i">
            <line :x1="(c.dua ? 40 + i * 40 : 60)" :x2="(c.dua ? 40 + i * 40 : 60)" :y1="cy(b.h)" :y2="cy(b.l)" :class="b.c >= b.o ? 'up' : 'dn'" class="sumbu" />
            <rect :x="(c.dua ? 40 + i * 40 : 60) - 9" width="18" :y="cy(Math.max(b.o, b.c))" :height="Math.max(2, Math.abs(b.o - b.c))" :class="b.c >= b.o ? 'up' : 'dn'" />
          </template>
        </svg>
        <p class="small">{{ c.teks }}</p>
      </div>
    </div>
    <div class="g2">
      <div class="kartu"><span class="ik">Divergence RSI</span><p class="small">Bila harga di D membuat lembah lebih rendah dari B tetapi RSI di D lebih tinggi, tekanan jual melemah. Screening mencari divergence ini otomatis.</p></div>
      <div class="kartu"><span class="ik">Tembus struktur minor</span><p class="small">Penutupan harga melewati puncak beberapa candle terakhir sebelum D (untuk bullish) menandakan tekanan mulai berbalik.</p></div>
    </div>
  </div>

  <!-- Manajemen risiko -->
  <div v-else-if="bagian === 'risiko'" class="hb">
    <div class="g2">
      <div class="kartu">
        <span class="ik">Kalkulator ukuran posisi</span>
        <div class="inp2">
          <label>Modal (Rp) <input v-model.number="pos.modal" type="number" min="0" step="100000" /></label>
          <label>Risiko per transaksi (%) <input v-model.number="pos.risikoPct" type="number" min="0.1" step="0.5" /></label>
          <label>Entry <input v-model.number="pos.entry" type="number" min="1" /></label>
          <label>Stop loss <input v-model.number="pos.stop" type="number" min="1" /></label>
          <label>Target <input v-model.number="pos.target" type="number" min="1" /></label>
        </div>
        <ul v-if="up" class="small kv">
          <li><span>Batas rugi</span><b>Rp{{ rp(up.risikoRp) }}</b></li>
          <li><span>Jumlah lot maksimal</span><b>{{ rp(up.lot) }} lot</b></li>
          <li><span>Nilai pembelian</span><b>Rp{{ rp(up.nilai) }} ({{ up.pctModal.toLocaleString('id-ID') }}% modal)</b></li>
          <li><span>Rugi bila stop tersentuh</span><b class="c-strong">Rp{{ rp(up.rugiMaks) }}</b></li>
          <li><span>R:R</span><b>{{ up.rr == null ? '–' : up.rr.toLocaleString('id-ID') }}</b></li>
        </ul>
        <p v-if="up && !up.cukup" class="small c-strong">Nilai pembelian melebihi modal: perlebar jarak stop atau kurangi risiko.</p>
        <p class="small muted">Rumus: lot = (modal × risiko%) ÷ ((entry − stop) × 100 lembar). Ukuran posisi ditentukan jarak stop, bukan keyakinan.</p>
      </div>
      <div>
        <div class="kartu"><span class="ik">Checklist sebelum entry</span><ol class="small"><li v-for="c in CEK" :key="c">{{ c }}</li></ol></div>
        <div class="kartu"><span class="ik">Kesalahan umum pemula</span><ul class="small"><li v-for="c in SALAH" :key="c">{{ c }}</li></ul></div>
      </div>
    </div>
  </div>

  <!-- Latihan -->
  <div v-else-if="bagian === 'latihan'" class="hb">
    <p class="small">Jawab {{ KUIS.length }} soal berikut. Penjelasan muncul setelah memilih jawaban.
      <b>Skor: {{ nilai.benar }}/{{ nilai.total }}</b><template v-if="nilai.dijawab"> ({{ nilai.dijawab }} dijawab)</template>
      <button v-if="nilai.dijawab" type="button" class="pill sm" @click="jawab = {}">Ulangi</button></p>
    <div v-for="(k, i) in KUIS" :key="k.q" class="kartu soal">
      <span class="ik">Soal {{ i + 1 }}</span>
      <p class="small"><b>{{ k.q }}</b></p>
      <div class="opsi">
        <button v-for="(p, j) in k.pilihan" :key="p" type="button" class="pill sm"
          :class="jawab[i] == null ? '' : j === k.benar ? 'benar' : j === jawab[i] ? 'salah' : ''" :disabled="jawab[i] != null" @click="pilihJawab(i, j)">{{ p }}</button>
      </div>
      <p v-if="jawab[i] != null" class="small" :class="jawab[i] === k.benar ? 'c-good' : 'c-strong'">{{ jawab[i] === k.benar ? 'Benar.' : 'Kurang tepat.' }} {{ k.ket }}</p>
    </div>
  </div>

  <!-- Glosarium & FAQ -->
  <div v-else-if="bagian === 'glosarium'" class="hb g2">
    <div class="kartu"><span class="ik">Glosarium</span>
      <dl class="small gl"><template v-for="g in GLOSARIUM" :key="g[0]"><dt>{{ g[0] }}</dt><dd>{{ g[1] }}</dd></template></dl></div>
    <div class="kartu"><span class="ik">Tanya jawab pemula</span>
      <details v-for="f in FAQ" :key="f[0]" class="small faq"><summary><b>{{ f[0] }}</b></summary><p>{{ f[1] }}</p></details></div>
  </div>
</template>

<style scoped>
.hb{display:flex;flex-direction:column;gap:10px}
.g2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.g3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.kartu{border:1px solid var(--rule);border-top:3px solid var(--accent);background:var(--paper);padding:10px 12px;margin-bottom:10px}
.kartu p{margin:6px 0}.kartu ol,.kartu ul{margin:6px 0;padding-left:18px}.kartu li{margin:3px 0}
.ik{display:block;font:700 11px var(--f-data);letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:4px}
.mini{width:100%;max-height:150px;background:var(--sheet);border:1px solid var(--rule)}.mini.c{max-height:120px}
.mini .ln{fill:none;stroke:var(--accent);stroke-width:2.5}
.mini text{font:700 11px var(--f-data);fill:var(--ink);text-anchor:middle}
.mini circle.up{fill:var(--good)}.mini circle.dn{fill:var(--strong)}
.mini rect.up,.mini .sumbu.up{fill:var(--good);stroke:var(--good)}.mini rect.dn,.mini .sumbu.dn{fill:var(--strong);stroke:var(--strong)}.mini .sumbu{stroke-width:2}
.inp2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 10px;margin:6px 0}
.inp2 label{display:flex;flex-direction:column;font-size:12px;color:var(--ink-2)}
.inp2 input{padding:5px 8px;border:1px solid var(--rule);background:var(--sheet);font:14px var(--f-data);color:var(--ink)}
.kv{list-style:none;padding:0}.kv li{display:flex;justify-content:space-between;border-bottom:1px dotted var(--rule);padding:4px 0}
.soal .opsi{display:flex;flex-wrap:wrap;gap:6px}
.pill.benar{background:var(--good-bg);border-color:var(--good);color:var(--good)}.pill.salah{background:var(--strong-bg);border-color:var(--strong);color:var(--strong)}
.gl dt{font-weight:700;margin-top:6px}.gl dd{margin:2px 0 0}
.faq{border-bottom:1px dotted var(--rule);padding:5px 0}.faq summary{cursor:pointer}
@media (max-width:760px){.g2,.g3,.inp2{grid-template-columns:1fr}}
</style>
