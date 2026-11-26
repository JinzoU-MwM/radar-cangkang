<script setup>
// Ilustrasi untuk presentasi Wawasan: gambar analogi (keset, grosir, pohon, antrean, daftar belanja) dan grafik
// skema (akumulasi, shakeout, distribusi, letak stop). Beberapa bisa dimainkan: pasar sepi/ramai, goyang pohon,
// pembeli sungguhan datang. Grafik adalah skema rekaan, bukan harga emiten. sebagian = grafik dipotong sampai titik
// keputusan (dipakai slide latihan sebelum dijawab).
import { computed, ref } from 'vue'
import WawasanAnalogi from './WawasanAnalogi.vue'

const props = defineProps({ nama: { type: String, required: true }, sebagian: { type: Boolean, default: false } })

// Grafik: titik [x 0..100, y 0..100 (makin besar makin tinggi)], volume opsional per titik, garis bantu, dan label.
const GRAFIK = {
  akumulasi: {
    titik: [[0, 90], [8, 80], [14, 84], [22, 65], [28, 70], [34, 50], [40, 40], [46, 48], [52, 38], [58, 46], [64, 37], [70, 45], [74, 27], [78, 44], [84, 52], [90, 62], [100, 78]],
    vol: [3, 4, 3, 5, 3, 5, 6, 2, 3, 2, 3, 2, 8, 5, 5, 6, 7],
    garis: [{ y: 36, x1: 38, teks: 'support' }, { y: 49, x1: 38, teks: 'atas kotak' }],
    label: [{ x: 14, y: 96, t: 'turun' }, { x: 56, y: 60, t: 'sepi, datar' }, { x: 74, y: 18, t: 'spring' }, { x: 92, y: 86, t: 'naik' }],
    ket: 'Broker ritel banyak menjual di dalam kotak, broker besar menampung.',
  },
  shakeout: {
    titik: [[0, 55], [10, 52], [18, 57], [26, 51], [34, 56], [42, 52], [50, 55], [56, 50], [61, 20], [66, 40], [72, 58], [80, 62], [90, 66], [100, 70]],
    vol: [2, 2, 2, 2, 2, 2, 2, 3, 9, 6, 5, 3, 3, 3],
    potong: 9,
    garis: [{ y: 48, x1: 0, teks: 'support Rp200' }],
    label: [{ x: 28, y: 66, t: 'dua minggu tenang' }, { x: 61, y: 11, t: 'jebol ke Rp188' }, { x: 86, y: 78, t: 'ditutup Rp205' }],
    ket: 'Contoh rekaan. Volume melonjak saat jebol, lalu harga kembali ke atas support.',
  },
  distribusi: {
    titik: [[0, 15], [10, 28], [20, 45], [30, 62], [38, 75], [44, 69], [50, 86], [54, 71], [60, 78], [66, 70], [70, 88], [74, 69], [80, 66], [86, 50], [92, 40], [100, 25]],
    vol: [2, 3, 4, 5, 6, 7, 9, 8, 7, 7, 9, 8, 5, 5, 4, 4],
    potong: 12,
    garis: [{ y: 79, x1: 36, teks: 'atap' }, { y: 67, x1: 36, teks: 'lantai' }],
    label: [{ x: 16, y: 46, t: 'naik, mulai ramai' }, { x: 58, y: 96, t: 'upthrust' }, { x: 60, y: 56, t: 'volume besar, harga tidak maju' }, { x: 94, y: 22, t: 'turun' }],
    ket: 'Barang besar berpindah ke pembeli ritel selama harga tertahan di atas.',
  },
  stop: {
    titik: [[0, 70], [15, 58], [25, 62], [35, 52], [45, 60], [55, 51], [62, 41], [68, 56], [80, 64], [100, 72]],
    garis: [{ y: 50, x1: 0, teks: 'support yang dilihat semua orang' }],
    label: [{ x: 80, y: 84, t: 'harga lanjut naik' }],
    stop: true,
    ket: 'Stop yang menumpuk tepat di bawah support tersapu. Stop yang diberi jarak masih aman.',
  },
}

const W = 320, H = 190, P = 14, VOL = 26
const gx = x => P + x / 100 * (W - 2 * P)
const gy = y => P + (100 - y) / 100 * (H - 2 * P - VOL)
const g = computed(() => GRAFIK[props.nama] || null)
const titik = computed(() => {
  const t = g.value?.titik || []
  return props.sebagian && g.value?.potong ? t.slice(0, g.value.potong) : t
})
const jalur = computed(() => titik.value.map(([x, y]) => `${gx(x)},${gy(y)}`).join(' '))
const lebarVol = 7
const volY = H - P
const volH = v => v / 10 * (VOL - 4)

// Analogi yang bisa dimainkan.
const ramai = ref(false)
const goyang = ref(false)
const asli = ref(false)
const POHON = [[150, 52, 0], [178, 64, 1], [130, 72, 1], [196, 44, 0], [160, 86, 1], [118, 50, 0], [186, 88, 0], [140, 40, 1]]
</script>

<template>
  <figure class="wg">
    <!-- Grafik skema -->
    <svg v-if="g" :key="nama + sebagian" :viewBox="`0 0 ${W} ${H}`" class="gr" role="img" :aria-label="g.ket">
      <g v-for="(l, i) in g.garis" :key="'g' + i">
        <line :x1="gx(l.x1)" :x2="gx(100)" :y1="gy(l.y)" :y2="gy(l.y)" class="bantu" />
        <text :x="gx(100) - 2" :y="gy(l.y) - 3" class="tb kanan">{{ l.teks }}</text>
      </g>
      <template v-if="g.vol">
        <rect v-for="(v, i) in g.vol.slice(0, titik.length)" :key="'v' + i" :x="gx(g.titik[i][0]) - lebarVol / 2" :y="volY - volH(v)" :width="lebarVol" :height="volH(v)" class="vol" :class="{ besar: v >= 8 }" />
        <text :x="P" :y="volY - VOL + 2" class="tb">volume</text>
      </template>
      <template v-if="g.stop">
        <g v-for="i in 7" :key="'s' + i" class="silang"><text :x="gx(30 + i * 7)" :y="gy(46) + 4" class="x">×</text></g>
        <text :x="gx(30)" :y="gy(42) + 6" class="tb">stop kebanyakan orang</text>
        <line :x1="gx(40)" :x2="gx(76)" :y1="gy(33)" :y2="gy(33)" class="stopku" />
        <text :x="gx(78)" :y="gy(33) + 3" class="tb aman">stop dengan jarak</text>
      </template>
      <polyline :points="jalur" class="harga" pathLength="1" />
      <circle v-if="sebagian && g.potong" :cx="gx(titik.at(-1)[0])" :cy="gy(titik.at(-1)[1])" r="5" class="kini" />
      <text v-if="sebagian && g.potong" :x="gx(titik.at(-1)[0]) + 8" :y="gy(titik.at(-1)[1]) + 4" class="tb tanya">sekarang?</text>
      <template v-if="!sebagian">
        <text v-for="(l, i) in g.label" :key="'l' + i" :x="gx(l.x)" :y="gy(l.y)" class="lb tengah" :style="{ '--d': 0.6 + i * 0.25 + 's' }">{{ l.t }}</text>
      </template>
    </svg>

    <!-- Kunci di bawah keset -->
    <svg v-else-if="nama === 'keset'" viewBox="0 0 320 190" class="gr" role="img" aria-label="Tiga pintu, kuncinya sama-sama di bawah keset">
      <g v-for="i in 3" :key="i" :transform="`translate(${(i - 1) * 104 + 12},0)`">
        <rect x="20" y="22" width="56" height="112" rx="3" class="pintu" />
        <circle cx="66" cy="80" r="3" class="gagang" />
        <rect x="8" y="138" width="80" height="14" rx="4" class="keset" />
        <g class="kunci" :style="{ '--d': i * 0.3 + 's' }"><circle cx="58" cy="141" r="5" /><line x1="63" y1="141" x2="80" y2="141" /><line x1="76" y1="141" x2="76" y2="146" /></g>
      </g>
      <text x="160" y="176" class="lb tengah">Kebiasaannya sama, jadi gampang ditebak</text>
    </svg>

    <!-- Pedagang grosir: pasar sepi atau ramai -->
    <div v-else-if="nama === 'grosir'" class="main">
      <svg viewBox="0 0 320 170" class="gr" role="img" :aria-label="ramai ? 'Pasar ramai, mangga terjual' : 'Pasar sepi, harga harus dibanting'">
        <rect x="14" y="70" width="100" height="56" rx="4" class="truk" />
        <rect x="114" y="88" width="34" height="38" rx="4" class="truk kabin" />
        <circle cx="40" cy="130" r="9" class="roda" /><circle cx="128" cy="130" r="9" class="roda" />
        <circle v-for="(m, i) in [[30, 64], [46, 60], [62, 63], [78, 59], [94, 64], [38, 52], [56, 50], [74, 52], [88, 53], [64, 42]]" :key="'m' + i" :cx="m[0]" :cy="m[1]" r="8" class="mangga" />
        <g v-for="(o, i) in (ramai ? [190, 214, 238, 262, 286, 202, 226, 250, 274] : [238])" :key="'o' + i + ramai" :transform="`translate(${o},${i > 4 ? 66 : 92})`">
          <g class="orang muncul" :style="{ '--d': i * 0.06 + 's' }"><circle cx="0" cy="0" r="7" /><path d="M-10 26 Q0 6 10 26 Z" /></g></g>
        <text x="238" y="40" class="lb tengah" :class="ramai ? 'aman' : 'bahaya'">{{ ramai ? 'Laku di harga bagus' : 'Harus banting harga' }}</text>
      </svg>
      <div class="tombol" role="group" aria-label="Keadaan pasar">
        <button type="button" :class="{ on: !ramai }" :aria-pressed="String(!ramai)" @click="ramai = false">Pasar sepi</button>
        <button type="button" :class="{ on: ramai }" :aria-pressed="String(ramai)" @click="ramai = true">Pasar ramai</button>
      </div>
    </div>

    <!-- Pohon mangga digoyang -->
    <div v-else-if="nama === 'pohon'" class="main">
      <svg viewBox="0 0 320 204" class="gr" role="img" :aria-label="goyang ? 'Mangga yang lemah jatuh dan dipungut' : 'Pohon mangga sebelum digoyang'">
        <rect x="150" y="96" width="16" height="66" class="batang" />
        <g :class="{ goyang }">
          <ellipse cx="158" cy="66" rx="70" ry="46" class="daun" />
        </g>
        <circle v-for="(m, i) in POHON" :key="'p' + i" :cx="m[0]" :cy="m[1]" r="7" class="mangga" :class="{ jatuh: goyang && m[2], lemah: m[2] }" :style="{ '--d': i * 0.08 + 's', '--x': (i % 2 ? 18 : -14) + 'px', '--y': (152 - m[1]) + 'px' }" />
        <line x1="20" y1="162" x2="300" y2="162" class="tanah" />
        <g transform="translate(250,124)" class="orang"><circle cx="0" cy="0" r="7" /><path d="M-10 26 Q0 6 10 26 Z" /></g>
        <path d="M224 148 h30 l-4 14 h-22 z" class="keranjang" />
        <text x="22" y="182" class="lb">{{ goyang ? 'Yang jatuh = barang yang dijual panik' : 'Mangga pucat = tangkainya lemah' }}</text>
        <text v-if="goyang" x="22" y="196" class="lb aman">dipungut murah oleh yang menggoyang</text>
      </svg>
      <div class="tombol"><button type="button" class="on" @click="goyang = !goyang">{{ goyang ? 'Ulangi' : 'Goyang pohonnya' }}</button></div>
    </div>

    <!-- Antrean warung -->
    <div v-else-if="nama === 'antrean'" class="main">
      <svg viewBox="0 0 320 170" class="gr" role="img" :aria-label="asli ? 'Orang suruhan pergi, tinggal pembeli sungguhan' : 'Antrean panjang di depan warung'">
        <path d="M12 40 L80 22 L148 40 Z" class="atap" />
        <rect x="22" y="40" width="116" height="86" class="warung" />
        <rect x="34" y="84" width="92" height="12" class="meja" />
        <text x="80" y="66" class="tb tengah">WARUNG</text>
        <g v-for="i in 5" :key="'q' + i" :transform="`translate(${130 + i * 30},100)`">
          <g class="orang" :class="{ suruhan: i % 2 === 1, pergi: asli && i % 2 === 1 }" :style="{ '--d': i * 0.15 + 's' }"><circle cx="0" cy="0" r="7" /><path d="M-10 26 Q0 6 10 26 Z" /></g></g>
        <template v-if="asli">
          <g v-for="i in 2" :key="'a' + i" :transform="`translate(${282 + (i - 1) * 20},100)`">
            <g class="orang muncul baru" :style="{ '--d': 0.5 + i * 0.1 + 's' }"><circle cx="0" cy="0" r="7" /><path d="M-10 26 Q0 6 10 26 Z" /></g></g>
        </template>
        <line x1="10" y1="128" x2="310" y2="128" class="tanah" />
        <text x="160" y="152" class="tb">garis putus-putus = orang suruhan</text>
        <text x="160" y="80" class="lb" :class="{ bahaya: asli }">{{ asli ? 'Yang suruhan pergi, yang asli tertinggal' : 'Kelihatannya laris' }}</text>
      </svg>
      <div class="tombol"><button type="button" class="on" @click="asli = !asli">{{ asli ? 'Ulangi' : 'Pembeli sungguhan datang' }}</button></div>
    </div>

    <!-- Daftar belanja -->
    <svg v-else-if="nama === 'belanja'" viewBox="0 0 320 180" class="gr" role="img" aria-label="Daftar belanja yang dicentang">
      <rect x="40" y="14" width="130" height="156" rx="6" class="kertas" />
      <g v-for="(t, i) in ['Harga beli', 'Stop', 'Target', 'Jumlah lot', 'Alasan']" :key="t" :transform="`translate(54,${44 + i * 26})`">
        <g class="muncul" :style="{ '--d': i * 0.2 + 's' }">
          <rect x="0" y="-10" width="12" height="12" rx="2" class="kotak" /><path d="M2 -4 l3 3 l6 -7" class="centang" />
          <text x="20" y="0" class="lb">{{ t }}</text>
        </g>
      </g>
      <text x="105" y="32" class="tb tengah">sebelum jam 9</text>
      <path d="M206 92 h16 l14 50 h58 l12 -36 h-78" class="troli" />
      <circle cx="244" cy="154" r="6" class="roda" /><circle cx="286" cy="154" r="6" class="roda" />
      <text x="252" y="80" class="tb tengah">promo di lorong</text>
      <text x="252" y="92" class="tb tengah">tidak menggoda</text>
    </svg>

    <!-- Gambar analogi topik lain (kunci = id topik) -->
    <WawasanAnalogi v-else :nama="nama" />

    <figcaption v-if="g" class="ket">{{ sebagian && g.potong ? 'Grafik berhenti di titik keputusan. Pilih jawaban untuk melihat kelanjutannya.' : g.ket }}</figcaption>
  </figure>
</template>

<style scoped>
.wg{margin:0;display:grid;gap:6px}
.gr{width:100%;height:auto;display:block;background:var(--sheet-2);border-radius:10px}
.main{display:grid;gap:6px}
.ket{font-size:12px;color:var(--ink-2);line-height:1.45}
.tombol{display:flex;gap:6px;flex-wrap:wrap}
.tombol button{border:1px solid var(--rule);background:var(--sheet);color:var(--ink-2);border-radius:999px;padding:4px 12px;font:600 12px var(--f-body);cursor:pointer}
.tombol button.on{background:var(--accent);border-color:var(--accent);color:var(--sheet)}
/* teks di dalam gambar */
.tb{font:600 9px var(--f-data);fill:var(--ink-2)}
.lb{font:700 11px var(--f-body);fill:var(--ink)}
.kanan{text-anchor:end}.tengah{text-anchor:middle}
.aman{fill:var(--good)}.bahaya{fill:var(--strong)}.tanya{fill:var(--strong)}
/* grafik */
.bantu{stroke:var(--ink-2);stroke-dasharray:4 3;stroke-width:1}
.harga{fill:none;stroke:var(--accent);stroke-width:2.4;stroke-linejoin:round;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;animation:gambar 1.4s ease-out forwards}
.vol{fill:var(--rule)}.vol.besar{fill:var(--warn)}
.kini{fill:var(--strong);animation:denyut 1.2s ease-in-out infinite}
.lb[style]{opacity:0;animation:muncul .4s ease-out var(--d) forwards}
.x{font:700 12px var(--f-data);fill:var(--strong)}
.stopku{stroke:var(--good);stroke-width:2}
/* gambar analogi */
.pintu{fill:var(--sheet);stroke:var(--ink-2);stroke-width:1.5}
.gagang{fill:var(--ink-2)}
.keset{fill:var(--accent-soft);stroke:var(--accent);stroke-width:1}
.kunci{fill:none;stroke:var(--warn);stroke-width:2.2;opacity:0;animation:muncul .4s ease-out var(--d) forwards}
.truk{fill:var(--sheet);stroke:var(--ink-2);stroke-width:1.5}.kabin{fill:var(--accent-soft)}
.roda{fill:var(--ink)}
.mangga{fill:var(--warn);stroke:var(--sheet);stroke-width:1}
.mangga.lemah{fill:var(--warn-bg);stroke:var(--warn)}
.orang{fill:var(--ink-2)}
.orang.suruhan{fill:none;stroke:var(--ink-2);stroke-dasharray:3 2;stroke-width:1.4}
.orang.baru{fill:var(--accent)}
.orang.pergi{animation:pergi .7s ease-in var(--d) forwards}
.muncul{opacity:0;animation:muncul .35s ease-out var(--d, 0s) forwards}
.batang{fill:var(--ink-2)}
.daun{fill:var(--good-bg);stroke:var(--good);stroke-width:1.2}
.goyang{animation:goyang .5s ease-in-out 2;transform-origin:158px 110px;transform-box:view-box}
.mangga.jatuh{animation:jatuh .6s ease-in calc(.5s + var(--d)) forwards}
.tanah{stroke:var(--rule);stroke-width:2}
.keranjang{fill:var(--accent-soft);stroke:var(--accent)}
.atap{fill:var(--strong-bg);stroke:var(--strong)}
.warung{fill:var(--sheet);stroke:var(--ink-2);stroke-width:1.5}
.meja{fill:var(--rule-2)}
.kertas{fill:var(--sheet);stroke:var(--rule);stroke-width:1.5}
.kotak{fill:none;stroke:var(--ink-2)}
.centang{fill:none;stroke:var(--good);stroke-width:2;stroke-linecap:round}
.troli{fill:none;stroke:var(--ink-2);stroke-width:2;stroke-linejoin:round}
@keyframes gambar{to{stroke-dashoffset:0}}
@keyframes muncul{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
@keyframes denyut{50%{opacity:.35}}
@keyframes goyang{25%{transform:rotate(-4deg)}75%{transform:rotate(4deg)}}
@keyframes jatuh{to{transform:translate(var(--x), var(--y))}}
@keyframes pergi{to{opacity:0;transform:translateX(-40px)}}
@media (prefers-reduced-motion: reduce){
  .harga{animation:none;stroke-dashoffset:0}
  .lb[style],.kunci,.muncul{animation:none;opacity:1}
  .goyang,.kini{animation:none}
  .mangga.jatuh{animation:none;transform:translate(var(--x), var(--y))}
  .orang.pergi{animation:none;opacity:0}
}
</style>
