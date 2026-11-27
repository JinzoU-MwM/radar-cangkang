<script setup>
// Gambar analogi untuk topik Wawasan (kunci = id topik, teks di lib/wawasanAnalogi.js). Sebagian bisa dimainkan
// lewat tombol: n menghitung berapa kali tombol ditekan (BATAS = jumlah tahap untuk gambar bertahap).
import { computed, ref } from 'vue'
import { ANALOGI } from '../lib/wawasanAnalogi.js'

const props = defineProps({ nama: { type: String, required: true } })
const n = ref(0)
const tombol = computed(() => ANALOGI[props.nama]?.tombol)
const b = computed(() => n.value % 2 === 1)
const BATAS = { 'dunia-siklus': 4, 'dunia-gorengan': 5, 'monitor-transaksi': 5 }
function tekan() { n.value = BATAS[props.nama] ? (n.value + 1) % BATAS[props.nama] : n.value + 1 }
const FASE = [['Pemulihan', 'bank, properti'], ['Ekspansi', 'siklikal, konsumsi'], ['Puncak', 'komoditas'], ['Perlambatan', 'kebutuhan pokok, kesehatan']]
</script>

<template>
  <div class="wa">
    <svg viewBox="0 0 320 180" class="gr" role="img" :aria-label="ANALOGI[nama]?.teks">
      <!-- Harga rumah per meter -->
      <template v-if="nama === 'dunia-valuasi'">
        <g class="muncul"><path d="M30 80 L70 50 L110 80 Z" class="atap" /><rect x="40" y="80" width="60" height="50" class="dinding" />
          <text x="70" y="148" class="lb tengah">Rp500 juta</text><text x="70" y="162" class="tb tengah">30 m² = Rp16,7 juta/m²</text></g>
        <g class="muncul" style="--d:.3s"><path d="M170 80 L240 40 L310 80 Z" class="atap" /><rect x="180" y="80" width="120" height="50" class="dinding" />
          <text x="240" y="148" class="lb tengah">Rp900 juta</text><text x="240" y="162" class="tb tengah aman">90 m² = Rp10 juta/m²</text></g>
        <text x="160" y="22" class="lb tengah">Yang besar justru lebih murah per meter</text>
      </template>

      <!-- Video, foto, dompet -->
      <template v-else-if="nama === 'dunia-lk'">
        <g v-for="(p, i) in [['Laba rugi', 'video setahun'], ['Neraca', 'foto satu hari'], ['Arus kas', 'isi dompet']]" :key="i" :transform="`translate(${14 + i * 102},30)`">
          <g class="muncul" :style="{ '--d': i * 0.25 + 's' }">
            <rect x="0" y="0" width="90" height="80" rx="8" class="kertas" />
            <template v-if="i === 0"><rect x="20" y="22" width="44" height="34" rx="4" class="kotakisi" /><path d="M64 32 l14 -8 v32 l-14 -8 z" class="kotakisi" /></template>
            <template v-else-if="i === 1"><rect x="18" y="26" width="54" height="34" rx="5" class="kotakisi" /><circle cx="45" cy="43" r="10" class="lensa" /><rect x="26" y="20" width="14" height="7" rx="2" class="kotakisi" /></template>
            <template v-else><rect x="16" y="26" width="58" height="36" rx="6" class="dompet" /><rect x="50" y="36" width="24" height="14" rx="4" class="kotakisi" /><circle cx="58" cy="43" r="2.5" class="titik" /></template>
            <text x="45" y="100" class="lb tengah">{{ p[0] }}</text><text x="45" y="114" class="tb tengah">{{ p[1] }}</text>
          </g>
        </g>
      </template>

      <!-- Pizza: stock split vs rights issue -->
      <template v-else-if="nama === 'dunia-aksi'">
        <circle cx="90" cy="92" r="58" class="pizza" />
        <line v-for="i in 8" :key="'s' + i" x1="90" y1="92" :x2="90 + 58 * Math.cos(i * Math.PI / 4)" :y2="92 + 58 * Math.sin(i * Math.PI / 4)" class="potong" />
        <path :d="b ? 'M90 92 L148 92 A58 58 0 0 1 131 133 Z' : 'M90 92 L148 92 A58 58 0 0 1 90 150 Z'" class="milik" />
        <text x="230" y="60" class="lb tengah">{{ b ? 'Pizza baru dibagi lagi' : 'Dipotong jadi 8' }}</text>
        <text x="230" y="80" class="tb tengah">{{ b ? 'tidak ikut menebus:' : 'potongan lebih banyak,' }}</text>
        <text x="230" y="94" class="tb tengah">{{ b ? 'bagian kita mengecil' : 'bagian kita tetap seperempat' }}</text>
        <text x="230" y="124" class="lb tengah" :class="b ? 'bahaya' : 'aman'">{{ b ? '1/4 jadi 1/8' : '2/8 = 1/4' }}</text>
      </template>

      <!-- Tangga fraksi -->
      <template v-else-if="nama === 'dunia-mekanisme'">
        <g v-for="(t, j) in [{ x: 20, h: 28, ket: 'Saham Rp60', sub: '1 fraksi = 1,7%' }, { x: 180, h: 6, ket: 'Saham Rp4.000', sub: '1 fraksi = 0,25%' }]" :key="j" class="muncul" :style="{ '--d': j * 0.3 + 's' }">
          <path :d="`M${t.x} 150 ` + [0, 1, 2, 3].map(i => `h${30} v-${t.h}`).join(' ')" class="tangga" />
          <g :transform="`translate(${t.x + 16},${150 - t.h - 26})`" class="orang"><circle cx="0" cy="0" r="6" /><path d="M-8 22 Q0 5 8 22 Z" /></g>
          <text :x="t.x + 60" y="24" class="lb tengah">{{ t.ket }}</text><text :x="t.x + 60" y="38" class="tb tengah">{{ t.sub }}</text>
        </g>
      </template>

      <!-- Ember dan gelas -->
      <template v-else-if="nama === 'dunia-dividen'">
        <path d="M40 60 L56 150 H124 L140 60 Z" class="ember" />
        <path :d="b ? 'M49 100 L56 150 H124 L131 100 Z' : 'M44 75 L56 150 H124 L136 75 Z'" class="air" />
        <rect x="210" y="90" width="44" height="60" class="gelas" />
        <rect x="210" :y="b ? 106 : 148" width="44" :height="b ? 44 : 2" class="air" />
        <text x="90" y="170" class="tb tengah">harga saham</text><text x="232" y="170" class="tb tengah">dividen tunai</text>
        <text x="160" y="30" class="lb tengah">{{ b ? 'Gelas terisi, ember berkurang sama banyak' : 'Sebelum tanggal ex' }}</text>
      </template>

      <!-- Tol dan parkir -->
      <template v-else-if="nama === 'dunia-pajak'">
        <line x1="10" y1="120" x2="310" y2="120" class="jalan" />
        <g v-for="i in 4" :key="i" :transform="`translate(${i * 64},86)`"><rect x="0" y="0" width="8" height="34" class="gerbang" /><text x="4" y="-6" class="tb tengah">bayar</text></g>
        <g class="mobil"><rect x="0" y="100" width="34" height="14" rx="4" class="kotakisi" /><circle cx="8" cy="116" r="4" class="titik" /><circle cx="26" cy="116" r="4" class="titik" /></g>
        <circle v-for="i in 8" :key="'k' + i" :cx="40 + i * 26" cy="152" r="7" class="koin muncul" :style="{ '--d': i * 0.2 + 's' }" />
        <text x="160" y="30" class="lb tengah">Kecil sekali jalan, menumpuk kalau sering</text>
      </template>

      <!-- Roda musim sektor -->
      <template v-else-if="nama === 'dunia-siklus'">
        <circle cx="90" cy="92" r="62" class="roda" />
        <g v-for="(f, i) in FASE" :key="i">
          <text :x="90 + 40 * Math.cos((i * 90 - 90) * Math.PI / 180)" :y="96 + 40 * Math.sin((i * 90 - 90) * Math.PI / 180)" class="tb tengah" :class="{ aktif: i === n }">{{ f[0] }}</text>
        </g>
        <line x1="90" y1="92" :x2="90 + 22 * Math.cos((n * 90 - 90) * Math.PI / 180)" :y2="92 + 22 * Math.sin((n * 90 - 90) * Math.PI / 180)" class="jarum" />
        <text x="236" y="70" class="lb tengah">{{ FASE[n][0] }}</text>
        <text x="236" y="90" class="tb tengah">sektor yang biasanya ramai:</text>
        <text x="236" y="106" class="lb tengah aman">{{ FASE[n][1] }}</text>
      </template>

      <!-- Timbangan rugi vs untung -->
      <template v-else-if="nama === 'dunia-psikologi'">
        <line x1="160" y1="60" x2="160" y2="160" class="tiang" /><path d="M140 160 h40" class="tiang" />
        <g class="miring"><line x1="70" y1="60" x2="250" y2="60" class="tiang" />
          <path d="M45 60 h50 l-8 26 h-34 z" class="piring bahaya-isi" /><path d="M225 60 h50 l-8 26 h-34 z" class="piring" /></g>
        <text x="70" y="124" class="lb tengah bahaya">Rugi Rp1 juta</text><text x="250" y="96" class="lb tengah aman">Untung Rp1 juta</text>
        <text x="160" y="24" class="lb tengah">Angkanya sama, beratnya di hati tidak</text>
      </template>

      <!-- Balon gorengan -->
      <template v-else-if="nama === 'dunia-gorengan'">
        <template v-if="n < 4">
          <ellipse cx="110" :cy="110 - n * 12" :rx="22 + n * 14" :ry="28 + n * 16" class="balon" />
          <line x1="110" :y1="138 + n * 4" x2="110" y2="170" class="tali" />
        </template>
        <g v-else class="muncul"><path d="M90 80 l10 10 l-14 6 l14 6 l-10 10 l16 -6 l4 16 l4 -16 l16 6 l-10 -10 l14 -6 l-14 -6 l10 -10 l-16 6 l-4 -16 l-4 16 z" class="ledak" /></g>
        <text x="236" y="70" class="lb tengah" :class="{ bahaya: n >= 3 }">{{ ['Harga mulai naik', 'Ramai di grup', 'Naik berlipat', 'UMA dari bursa', 'Meletus'][n] }}</text>
        <text x="236" y="92" class="tb tengah">{{ n >= 4 ? 'yang memegang terakhir menanggung rugi' : 'makin besar, makin menarik dilihat' }}</text>
      </template>

      <!-- Kekuatan sumber berita -->
      <template v-else-if="nama === 'berita-sumber'">
        <g v-for="(r, i) in [['Keterbukaan IDX / KSEI', 'paling pasti', 'good'], ['Jawaban emiten ke bursa', 'kuat', 'calm'], ['Media arus utama', 'belum tentu', 'warn'], ['Grup dan rumor', 'anggap belum ada', 'strong']]" :key="i" class="muncul" :style="{ '--d': i * 0.2 + 's' }">
          <text x="14" :y="54 + i * 32" class="lb">{{ r[0] }}</text>
          <rect x="160" :y="42 + i * 32" :width="80 - i * 18" height="16" rx="4" :class="'isi-' + r[2]" />
          <text :x="166 + 80 - i * 18" :y="54 + i * 32" class="tb">{{ r[1] }}</text>
        </g>
        <text x="160" y="22" class="lb tengah">Surat RT, tukang sayur, atau "katanya"?</text>
      </template>

      <!-- Berita yang sudah basi -->
      <template v-else-if="nama === 'berita-harga'">
        <polyline points="20,140 60,136 90,122 120,98 150,72 175,52 200,62 230,86 260,100 300,112" class="garis" pathLength="1" />
        <line x1="175" y1="52" x2="175" y2="22" class="tiang" /><path d="M175 22 h46 v14 h-46 z" class="isi-strong" />
        <text x="198" y="32" class="tb tengah putih">berita</text>
        <text x="96" y="160" class="lb tengah">yang tahu duluan sudah beli</text>
        <text x="262" y="134" class="lb tengah bahaya">beli setelah berita</text>
      </template>

      <!-- Pengambilalihan satu kompleks -->
      <template v-else-if="nama === 'monitor-to'">
        <g v-for="i in 12" :key="i" :transform="`translate(${24 + ((i - 1) % 6) * 48},${i <= 6 ? 40 : 100})`">
          <path d="M0 18 L16 4 L32 18 Z" :class="b && i <= 9 ? 'isi-accent' : 'atap'" /><rect x="4" y="18" width="24" height="20" :class="b && i <= 9 ? 'isi-accent' : 'dinding'" />
          <text v-if="b && i > 9" x="16" y="52" class="tb tengah aman">ditawar</text>
        </g>
        <text x="160" y="24" class="lb tengah">{{ b ? 'Pengendali baru wajib menawar sisa rumah warga' : 'Satu kompleks, pemiliknya masing-masing' }}</text>
        <text v-if="b" x="160" y="172" class="tb tengah">warna gelap = sudah dibeli pengendali</text>
      </template>

      <!-- Urutan tahap backdoor -->
      <template v-else-if="nama === 'monitor-transaksi'">
        <line x1="40" y1="84" x2="280" y2="84" class="tiang" />
        <g v-for="(t, i) in ['Rencana', 'Laporan penilai', 'Panggilan RUPS', 'Hasil RUPS']" :key="i">
          <circle :cx="40 + i * 80" cy="84" r="13" :class="n === 4 && i === 3 ? 'isi-strong' : i <= n && i < 4 ? 'isi-good' : 'kosong'" />
          <text :x="40 + i * 80" y="88" class="tb tengah" :class="{ putih: i <= n }">{{ i + 1 }}</text>
          <text :x="40 + i * 80" y="116" class="tb tengah">{{ t }}</text>
        </g>
        <text x="160" y="40" class="lb tengah" :class="{ bahaya: n === 4 }">{{ ['Lamaran: rencana diumumkan', 'Tunangan: nilai aset dihitung', 'Undangan disebar: RUPS dijadwalkan', 'Akad: RUPS menyetujui', 'Terus diundur tanpa kabar: waspada batal'][n] }}</text>
        <text v-if="n === 4" x="280" y="140" class="tb tengah bahaya">diundur lagi</text>
      </template>

      <!-- Menilai aset seperti mobil bekas -->
      <template v-else-if="nama === 'monitor-aset'">
        <g transform="translate(20,70)"><path d="M0 40 v-16 l18 -18 h46 l18 18 h10 v16 z" class="kotakisi" /><circle cx="22" cy="42" r="9" class="titik" /><circle cx="72" cy="42" r="9" class="titik" /></g>
        <rect x="160" y="44" width="50" height="106" class="isi-strong muncul" /><text x="185" y="166" class="tb tengah">kata penilai</text><text x="185" y="38" class="lb tengah">300</text>
        <rect x="240" y="86" width="50" height="64" class="isi-good muncul" style="--d:.3s" /><text x="265" y="166" class="tb tengah">sejenis di pasar</text><text x="265" y="80" class="lb tengah">180</text>
        <text x="64" y="44" class="lb tengah">Cek sebelum percaya</text><text x="64" y="150" class="tb tengah">angka contoh rekaan</text>
      </template>

      <!-- Buku catatan hasil -->
      <template v-else-if="nama === 'monitor-gagal'">
        <rect x="40" y="16" width="240" height="150" rx="8" class="kertas" />
        <line v-for="i in 4" :key="i" x1="56" x2="264" :y1="30 + i * 30" :y2="30 + i * 30" class="garis-tipis" />
        <g v-for="(r, i) in [['Selesai', 5, 'good'], ['Batal', 3, 'strong'], ['Tertunda', 2, 'warn']]" :key="i" class="muncul" :style="{ '--d': i * 0.25 + 's' }">
          <text x="62" :y="54 + i * 30" class="lb">{{ r[0] }}</text>
          <rect x="160" :y="43 + i * 30" :width="r[1] * 18" height="13" rx="3" :class="'isi-' + r[2]" />
        </g>
        <text x="160" y="152" class="tb tengah">yang gagal ikut dicatat (contoh rekaan)</text>
      </template>

      <!-- Kue free float -->
      <template v-else-if="nama === 'kandidat-freefloat'">
        <circle cx="96" cy="96" r="62" class="isi-accent" />
        <path d="M96 96 L96 34 A62 62 0 0 1 125 41 Z" class="isi-warn" />
        <text x="96" y="114" class="lb tengah putih">pengendali</text>
        <text x="122" y="28" class="lb bahaya">publik</text>
        <text x="236" y="70" class="lb tengah">Kuenya hampir milik satu orang</text>
        <text x="236" y="90" class="tb tengah">potongan publik sedikit:</text>
        <text x="236" y="104" class="tb tengah">mudah digerakkan, bisa didepak</text>
      </template>

      <!-- Bioskop dan pintu kecil -->
      <template v-else-if="nama === 'kandidat-likuid'">
        <rect x="20" y="30" width="250" height="130" rx="6" class="dinding" />
        <rect x="266" y="84" width="10" height="30" class="isi-good" /><text x="296" y="80" class="tb tengah">pintu</text>
        <g v-for="i in 15" :key="i" class="pindah orang"
           :style="{ transform: b ? `translate(${246 - ((i - 1) % 5) * 16}px,${74 + Math.floor((i - 1) / 5) * 16}px)` : `translate(${46 + ((i - 1) % 5) * 44}px,${50 + Math.floor((i - 1) / 5) * 36}px)`, transitionDelay: i * 0.03 + 's' }">
          <circle cx="0" cy="0" r="6" /><path d="M-8 18 Q0 4 8 18 Z" /></g>
        <text x="145" y="20" class="lb tengah" :class="{ bahaya: b }">{{ b ? 'Semua mau keluar, pintunya cuma satu' : 'Masuk satu per satu, lancar' }}</text>
      </template>

      <!-- Kalender dan cuaca -->
      <template v-else-if="nama === 'ihsg-makro'">
        <g v-for="(t, i) in ['BI-Rate', 'Kurs', 'Arus asing', 'Komoditas']" :key="i" :transform="`translate(${46 + i * 76},120)`">
          <path d="M-28 0 A28 28 0 0 1 28 0" class="roda" /><line x1="0" y1="0" :x2="24 * Math.cos(Math.PI * (1.15 + i * 0.22))" :y2="24 * Math.sin(Math.PI * (1.15 + i * 0.22))" class="jarum" />
          <text x="0" y="20" class="tb tengah">{{ t }}</text>
        </g>
        <text x="160" y="34" class="lb tengah">Pola musiman = kalender</text>
        <text x="160" y="54" class="lb tengah aman">Empat jarum ini = cuaca hari ini</text>
      </template>

      <!-- Lempar koin -->
      <template v-else-if="nama === 'ihsg-statistik'">
        <template v-if="!b">
          <g v-for="(c, i) in ['G', 'G', 'A', 'G', 'G']" :key="i" class="muncul" :style="{ '--d': i * 0.15 + 's' }">
            <circle :cx="60 + i * 50" cy="80" r="18" class="koin" /><text :x="60 + i * 50" y="85" class="lb tengah">{{ c }}</text></g>
          <text x="160" y="140" class="lb tengah bahaya">4 dari 5 gambar = 80%. Curang?</text>
        </template>
        <template v-else>
          <rect x="90" y="46" width="50" height="104" class="isi-accent muncul" /><text x="115" y="166" class="tb tengah">gambar 52</text>
          <rect x="180" y="54" width="50" height="96" class="isi-calm muncul" /><text x="205" y="166" class="tb tengah">angka 48</text>
          <text x="160" y="28" class="lb tengah aman">Setelah 100 kali, kembali dekat separuh</text>
        </template>
      </template>

      <!-- Rata-rata kelas -->
      <template v-else-if="nama === 'ihsg-indeks'">
        <g v-for="(h, i) in [30, 25, 28, 22, 26, 24, 96, 27]" :key="i" class="muncul" :style="{ '--d': i * 0.08 + 's' }">
          <rect :x="30 + i * 34" :y="156 - h" width="24" :height="h" :class="i === 6 ? 'isi-good' : 'isi-calm'" />
          <text :x="42 + i * 34" :y="150 - h" class="lb tengah" :class="i === 6 ? 'aman' : 'bahaya'">{{ i === 6 ? '▲' : '▼' }}</text>
        </g>
        <line x1="24" x2="300" y1="121" y2="121" class="bantu" />
        <text x="24" y="116" class="tb">rata-rata</text>
        <text x="160" y="24" class="lb tengah">Satu murid melonjak, rata-rata ikut naik</text>
      </template>

      <!-- Slip gaji dan rekening -->
      <template v-else-if="nama === 'ihsg-lk'">
        <rect x="40" y="40" width="90" height="110" rx="6" class="kertas" /><text x="85" y="62" class="lb tengah">Slip gaji</text>
        <text x="85" y="100" class="lb tengah aman">Rp10 juta</text><text x="85" y="168" class="tb tengah">laba bersih</text>
        <rect x="190" y="70" width="90" height="56" rx="8" class="dompet" /><text x="235" y="92" class="lb tengah">Rekening</text>
        <text x="235" y="112" class="lb tengah bahaya">Rp1 juta</text><text x="235" y="168" class="tb tengah">arus kas operasi</text>
        <text x="160" y="24" class="lb tengah">Yang bisa dipakai hanya yang masuk rekening</text>
      </template>

      <!-- Satu kasir banyak pembeli -->
      <template v-else-if="nama === 'ihsg-broker'">
        <rect x="20" y="76" width="70" height="50" class="kotakisi" /><text x="55" y="105" class="lb tengah">kasir</text><text x="55" y="146" class="tb tengah">satu kode broker</text>
        <g v-for="i in 9" :key="i" :transform="`translate(${100 + i * 22},${90 + (i % 2) * 6})`">
          <g class="orang muncul" :class="'w' + (i % 3)" :style="{ '--d': i * 0.08 + 's' }"><circle cx="0" cy="0" r="6" /><path d="M-8 22 Q0 5 8 22 Z" /></g></g>
        <text x="200" y="44" class="lb tengah">Ribuan nasabah, belanjaan masing-masing</text>
      </template>

      <!-- Ramalan dan catatan -->
      <template v-else-if="nama === 'ihsg-astro'">
        <rect x="80" y="62" width="56" height="90" class="isi-accent muncul" /><text x="108" y="168" class="tb tengah">ramalan cocok 6/10</text>
        <rect x="190" y="77" width="56" height="75" class="isi-calm muncul" style="--d:.2s" /><text x="218" y="168" class="tb tengah">lempar koin 5/10</text>
        <text x="160" y="28" class="lb tengah">Selisihnya kecil: jangan jadi alasan utama</text>
        <text x="160" y="46" class="tb tengah">angka contoh rekaan</text>
      </template>

      <!-- Bola memantul di PRZ -->
      <template v-else-if="nama === 'harmonic-reaksi'">
        <rect x="20" y="130" width="280" height="14" class="isi-warn" /><text x="28" y="141" class="tb putih">PRZ</text>
        <path d="M30 30 Q80 40 110 128 Q135 70 160 128" class="garis" pathLength="1" />
        <path d="M160 128 Q220 20 290 30" class="putus aman-garis" /><path d="M160 128 Q220 150 290 166" class="putus bahaya-garis" />
        <circle cx="135" cy="99" r="5" class="isi-good" /><line x1="135" y1="105" x2="135" y2="152" class="garis-tipis" /><text x="135" y="162" class="tb tengah aman">ambil sebagian di pantulan ini</text>
        <text x="296" y="22" class="tb" text-anchor="end">naik tinggi?</text><text x="296" y="176" class="tb" text-anchor="end">atau tembus?</text>
      </template>

      <!-- Langkah kaki -->
      <template v-else-if="nama === 'harmonic-swing'">
        <ellipse v-for="(x, i) in (b ? [20, 34, 44, 128, 140, 200, 276, 288] : [20, 56, 92, 128, 164, 200, 236, 272])" :key="i + '' + b" :cx="x + 10" :cy="i % 2 ? 108 : 84" rx="9" ry="5" class="kaki muncul" :style="{ '--d': i * 0.1 + 's' }" />
        <text x="160" y="40" class="lb tengah" :class="b ? 'bahaya' : 'aman'">{{ b ? 'Pendek, pendek, lalu jauh sekali: pola timpang' : 'Langkah kira-kira sama: pola wajar' }}</text>
        <text x="160" y="150" class="tb tengah">nilai juga lama tiap kaki pola, bukan hanya rasionya</text>
      </template>

      <!-- Divergensi RSI -->
      <template v-else-if="nama === 'harmonic-indikator'">
        <polyline points="20,20 70,60 100,40 160,74 190,56 250,84" class="garis" />
        <text x="250" y="100" class="tb" text-anchor="end">harga: lembah makin rendah</text>
        <line x1="20" y1="110" x2="300" y2="110" class="garis-tipis" />
        <polyline points="20,124 70,164 100,144 160,154 190,140 250,146" class="garis isi-rsi" />
        <line x1="70" y1="164" x2="160" y2="154" class="putus aman-garis" /><line x1="70" y1="60" x2="160" y2="74" class="putus bahaya-garis" />
        <text x="250" y="176" class="tb aman" text-anchor="end">RSI: lembah makin tinggi</text>
        <text x="306" y="30" class="lb" text-anchor="end">Jarum turun</text><text x="306" y="44" class="tb" text-anchor="end">sebelum mobil berhenti</text>
      </template>

      <!-- Data mentah dan disesuaikan -->
      <template v-else-if="nama === 'harmonic-data'">
        <polyline points="20,50 60,44 100,56 140,48 160,52" class="garis" /><polyline points="160,116 200,110 240,120 290,108" class="garis" />
        <line x1="160" y1="52" x2="160" y2="116" class="putus bahaya-garis" /><text x="166" y="88" class="tb bahaya">split 1:2, bukan anjlok</text>
        <polyline points="20,146 60,143 100,149 140,145 160,147 200,144 240,149 290,143" class="putus aman-garis" />
        <text x="24" y="170" class="tb aman">data disesuaikan: satu skala</text>
        <text x="160" y="24" class="lb tengah">Penggaris sentimeter disambung inci</text>
      </template>

      <!-- Catatan tendangan penalti -->
      <template v-else-if="nama === 'harmonic-statistik'">
        <path d="M60 150 V40 H260 V150" class="tiang" />
        <circle v-for="(d, i) in [[80, 60, 1], [90, 72, 1], [240, 62, 1], [230, 130, 1], [85, 132, 1], [160, 96, 0], [40, 96, 0], [275, 90, 0], [244, 76, 1]]" :key="i"
                :cx="d[0]" :cy="d[1]" r="6" :class="d[2] ? 'isi-good' : 'isi-strong'" class="muncul" :style="{ '--d': i * 0.1 + 's' }" />
        <text x="160" y="172" class="tb tengah">hijau masuk, merah gagal: semuanya dicatat</text>
        <text x="160" y="22" class="lb tengah">Sudut mana yang paling sering berhasil?</text>
      </template>

      <!-- Telur dan keranjang -->
      <template v-else-if="nama === 'rek-risiko'">
        <g :class="{ jatuh1: b }"><path d="M30 110 h80 l-10 30 h-60 z" class="keranjang" />
          <ellipse v-for="i in 6" :key="i" :cx="40 + (i - 1) * 12" cy="104" rx="6" ry="8" :class="b ? 'telur-pecah' : 'telur'" /></g>
        <g v-for="k in 3" :key="'k' + k" :transform="`translate(${150 + (k - 1) * 56},0)`">
          <g :class="{ jatuh1: b && k === 1 }"><path d="M0 110 h44 l-6 30 h-32 z" class="keranjang" />
            <ellipse v-for="i in 2" :key="i" :cx="14 + (i - 1) * 14" cy="104" rx="6" ry="8" :class="b && k === 1 ? 'telur-pecah' : 'telur'" /></g>
        </g>
        <text x="70" y="40" class="lb tengah">Satu keranjang</text><text x="226" y="40" class="lb tengah">Tiga keranjang</text>
        <text v-if="b" x="70" y="174" class="lb tengah bahaya">semua pecah</text><text v-if="b" x="226" y="174" class="lb tengah aman">4 telur selamat</text>
      </template>

      <!-- Lift dengan batas lantai -->
      <template v-else-if="nama === 'rek-bursa'">
        <rect x="96" y="12" width="70" height="160" class="dinding" />
        <rect x="98" y="56" width="66" height="60" class="isi-good-lembut" />
        <line v-for="i in 9" :key="i" x1="96" x2="166" :y1="12 + i * 16" :y2="12 + i * 16" class="garis-tipis" />
        <rect x="118" y="78" width="26" height="16" class="isi-accent" />
        <text x="174" y="62" class="tb">batas naik sehari</text><text x="174" y="118" class="tb">batas turun sehari</text>
        <text x="174" y="164" class="tb bahaya">stop di sini tak tercapai sehari</text>
        <text x="131" y="168" class="lb tengah bahaya">×</text>
        <text x="16" y="40" class="lb">Lift saham</text><text x="16" y="56" class="tb">auto rejection</text>
      </template>

      <!-- Rapor per sumber sinyal -->
      <template v-else-if="nama === 'rek-evaluasi'">
        <rect x="30" y="14" width="260" height="156" rx="8" class="kertas" /><text x="160" y="34" class="lb tengah">Rapor sinyal (contoh rekaan)</text>
        <g v-for="(r, i) in [['Harmonic', 62], ['Recovery', 48], ['Seasonality', 55], ['Pola Broker', 38], ['Backdoor', 70]]" :key="i" class="muncul" :style="{ '--d': i * 0.15 + 's' }">
          <text x="44" :y="60 + i * 24" class="tb">{{ r[0] }}</text>
          <rect x="120" :y="50 + i * 24" :width="r[1] * 2" height="12" rx="3" :class="r[1] >= 50 ? 'isi-good' : 'isi-strong'" />
          <text :x="126 + r[1] * 2" :y="60 + i * 24" class="tb">{{ r[1] }}%</text>
        </g>
      </template>
    </svg>
    <div v-if="tombol" class="tombol"><button type="button" class="on" @click="tekan">{{ BATAS[nama] ? (n === BATAS[nama] - 1 ? tombol[1] : tombol[0]) : b ? tombol[1] : tombol[0] }}</button></div>
  </div>
</template>

<style scoped>
.wa{display:grid;gap:6px}
.gr{width:100%;height:auto;display:block;background:var(--sheet-2);border-radius:10px}
.tombol{display:flex;gap:6px}
.tombol button{border:1px solid var(--accent);background:var(--accent);color:var(--sheet);border-radius:999px;padding:4px 12px;font:600 12px var(--f-body);cursor:pointer}
.tb{font:600 9.5px var(--f-data);fill:var(--ink-2)}
.lb{font:700 11.5px var(--f-body);fill:var(--ink)}
.tengah{text-anchor:middle}
.aman{fill:var(--good)}.bahaya{fill:var(--strong)}
.aktif{fill:var(--accent);font-weight:800}
.muncul{opacity:0;animation:muncul .4s ease-out var(--d, 0s) forwards}
.atap{fill:var(--strong-bg);stroke:var(--strong)}
.dinding,.kertas,.gelas{fill:var(--sheet);stroke:var(--ink-2);stroke-width:1.5}
.kotakisi{fill:var(--accent-soft);stroke:var(--accent)}
.lensa{fill:var(--sheet);stroke:var(--accent);stroke-width:2}
.dompet{fill:var(--warn-bg);stroke:var(--warn)}
.titik{fill:var(--ink)}
.pizza{fill:var(--warn-bg);stroke:var(--warn);stroke-width:2}
.potong{stroke:var(--warn);stroke-width:1.5}
.milik{fill:var(--accent);opacity:.55;transition:d .4s}
.tangga{fill:none;stroke:var(--ink-2);stroke-width:2.5}
.orang{fill:var(--accent)}
.ember{fill:none;stroke:var(--ink-2);stroke-width:2}
.air{fill:var(--calm);opacity:.6;transition:all .6s ease}
.jalan{stroke:var(--rule);stroke-width:6}
.gerbang{fill:var(--strong)}
.mobil{animation:jalan 3s linear infinite}
.koin{fill:var(--warn);stroke:var(--sheet)}
.roda{fill:var(--sheet);stroke:var(--rule);stroke-width:2}
.jarum{stroke:var(--accent);stroke-width:3;stroke-linecap:round;transition:all .4s}
.tiang{stroke:var(--ink-2);stroke-width:2.5;fill:none}
.piring{fill:var(--good-bg);stroke:var(--good)}.bahaya-isi{fill:var(--strong-bg);stroke:var(--strong)}
.miring{transform-origin:160px 60px;transform-box:view-box;animation:timbang 1s ease-out forwards}
.balon{fill:var(--strong);opacity:.7;transition:all .4s ease}
.tali{stroke:var(--ink-2)}
.ledak{fill:var(--warn);stroke:var(--strong);stroke-width:1.5}
.putih{fill:var(--sheet)}
.isi-good{fill:var(--good)}.isi-calm{fill:var(--calm)}.isi-warn{fill:var(--warn)}.isi-strong{fill:var(--strong)}.isi-accent{fill:var(--accent)}
.isi-good-lembut{fill:var(--good-bg)}
.kosong{fill:var(--sheet);stroke:var(--rule);stroke-width:2}
.garis{fill:none;stroke:var(--accent);stroke-width:2.4;stroke-linejoin:round;stroke-linecap:round}
.garis[pathLength]{stroke-dasharray:1;stroke-dashoffset:1;animation:gambar 1.4s ease-out forwards}
.isi-rsi{stroke:var(--calm)}
.garis-tipis{stroke:var(--rule-2);stroke-width:1}
.bantu{stroke:var(--ink-2);stroke-dasharray:4 3}
.putus{fill:none;stroke-width:1.8;stroke-dasharray:5 4}
.aman-garis{stroke:var(--good)}.bahaya-garis{stroke:var(--strong)}
.pindah{transition:transform .8s ease}
.w0{fill:var(--accent)}.w1{fill:var(--calm)}.w2{fill:var(--warn)}
.kaki{fill:var(--ink-2)}
.keranjang{fill:var(--warn-bg);stroke:var(--warn)}
.telur{fill:var(--sheet);stroke:var(--ink-2)}.telur-pecah{fill:var(--strong-bg);stroke:var(--strong);stroke-dasharray:3 2}
.jatuh1{animation:jatuhk .6s ease-in forwards}
@keyframes jatuhk{to{transform:translateY(24px) rotate(12deg)}}
@keyframes gambar{to{stroke-dashoffset:0}}
@keyframes muncul{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@keyframes jalan{from{transform:translateX(0)}to{transform:translateX(290px)}}
@keyframes timbang{from{transform:rotate(0)}to{transform:rotate(-8deg)}}
@media (prefers-reduced-motion: reduce){.muncul{animation:none;opacity:1}.garis[pathLength]{animation:none;stroke-dashoffset:0}.pindah{transition:none}.jatuh1{animation:none}.mobil{animation:none}.miring{animation:none;transform:rotate(-8deg)}}
</style>
