<script setup>
// Unduh seluruh hasil analisa emiten sebagai presentasi PowerPoint atau PDF. Tema mengikuti bisnis emiten dan
// berganti tiap unduhan (pemilih tema & tombol di DeckDownload).
import { computed } from 'vue'
import { store, storyOf, getBenchmark } from '../../store.js'
import { api } from '../../api.js'
import { collectDeck } from '../../lib/deckData.js'
import { buildDeck, deckFileName } from '../../lib/deck.js'
import { sectorOf, pickTheme } from '../../lib/deckThemes.js'
import DeckDownload from './DeckDownload.vue'

const props = defineProps({ ticker: { type: String, required: true } })

// Perkiraan sektor sebelum data lengkap dimuat (dipakai untuk pratinjau tema); sektor final dihitung ulang saat unduh.
const guess = computed(() => {
  const t = props.ticker, it = store.items.find(x => x.ticker === t)
  const a = store.aset?.[t]?.aset
  return sectorOf({ baru: (it ? storyOf(t)?.baru : '') || store.verified?.[t]?.baru, aset: [a?.sektor, a?.nama].filter(Boolean).join(' '), nama: it?.name })
})

const SLIDES = [
  ['Ringkasan', 'skor & sikap analis'], ['Enam dimensi', 'grafik skor'], ['Kepemilikan', 'donat & arus pemegang'],
  ['Pengendali', 'profil & rekam jejak'], ['Aset injeksi', 'nilai, KJPP, tahapan'], ['Pihak lawan', 'rantai kepemilikan'],
  ['Progres', 'tonggak transaksi'], ['Valuasi & dilusi', 'sebelum → sesudah'], ['Harga 1 tahun', 'grafik & siklus'],
  ['Skenario', 'tangga harga'], ['Teknikal', 'meter sinyal'], ['Pola & level', 'support/resistance'],
  ['Rencana transaksi', 'masuk/keluar'], ['Kelebihan vs kekurangan', 'red flag & katalis'], ['Pandangan mendalam', 'temuan kunci'],
  ['Kesimpulan', 'syarat & sinyal keluar'],
]

async function build({ PptxGenJS, choose, lastId, onStep }) {
  const d = await collectDeck(props.ticker, { store, api, storyOf, getBenchmark, onStep })
  const theme = pickTheme(d.sector.id, { lastId, choose })
  onStep('Menyusun slide')
  return { pres: buildDeck(PptxGenJS, d, theme), file: deckFileName(props.ticker, d.date, theme), theme, sector: d.sector.label }
}
</script>

<template>
  <section class="rule-top">
    <div class="bar">
      <h2 class="lbl">Unduh presentasi {{ ticker }}</h2>
      <span class="muted">Sektor terdeteksi: <b>{{ guess.label }}</b></span>
    </div>

    <div class="grid">
      <div class="pane">
        <DeckDownload :sector-id="guess.id" :build="build" />
      </div>

      <div class="pane">
        <h3 class="lbl">Isi presentasi</h3>
        <ol class="slides">
          <li v-for="([a, b], i) in SLIDES" :key="a"><span class="n">{{ i + 1 }}</span><b>{{ a }}</b><small>{{ b }}</small></li>
        </ol>
        <p class="muted note">Slide tanpa data dilewati otomatis. Data diambil saat tombol ditekan, sama dengan yang tampil di tab lain.</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bar{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:12px;flex-wrap:wrap}
.lbl{margin:0 0 8px}
.grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}
.pane{background:var(--sheet);border:1px solid var(--rule);padding:14px}
.slides{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 12px}
.slides li{display:grid;grid-template-columns:22px 1fr;column-gap:8px;align-items:baseline}
.slides .n{grid-row:span 2;font-weight:700;opacity:.55;text-align:right}
.slides b{font-size:13px}
.slides small{font-size:11px;opacity:.7}
.note{margin:12px 0 0;font-size:12px}
@media (max-width:760px){
  .grid{grid-template-columns:1fr}
  .slides{grid-template-columns:1fr}
}
</style>
