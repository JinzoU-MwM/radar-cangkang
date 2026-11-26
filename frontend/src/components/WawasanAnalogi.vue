<script setup>
// Gambar analogi untuk topik Wawasan (kunci = id topik, teks di lib/wawasanAnalogi.js). Sebagian bisa dimainkan
// lewat tombol: n menghitung berapa kali tombol ditekan. Daftar topik yang gambarnya sudah ada: ADA di lib/wawasanAnalogi.js.
import { computed, ref } from 'vue'
import { ANALOGI } from '../lib/wawasanAnalogi.js'

const props = defineProps({ nama: { type: String, required: true } })
const n = ref(0)
const tombol = computed(() => ANALOGI[props.nama]?.tombol)
const b = computed(() => n.value % 2 === 1)
const BATAS = { 'dunia-siklus': 4, 'dunia-gorengan': 5 }
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
    </svg>
    <div v-if="tombol" class="tombol"><button type="button" class="on" @click="tekan">{{ nama === 'dunia-gorengan' && n === 4 ? 'Ulangi' : b && !BATAS[nama] ? tombol[1] : tombol[0] }}</button></div>
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
@keyframes muncul{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@keyframes jalan{from{transform:translateX(0)}to{transform:translateX(290px)}}
@keyframes timbang{from{transform:rotate(0)}to{transform:rotate(-8deg)}}
@media (prefers-reduced-motion: reduce){.muncul{animation:none;opacity:1}.mobil{animation:none}.miring{animation:none;transform:rotate(-8deg)}}
</style>
