<script setup>
// Unduh seluruh hasil analisa emiten sebagai presentasi PowerPoint. Tema mengikuti bisnis emiten dan
// berganti tiap unduhan (varian terakhir disimpan di peramban). pptxgenjs dimuat hanya saat dibutuhkan.
import { computed, ref } from 'vue'
import { store, storyOf, getBenchmark, toast } from '../../store.js'
import { api } from '../../api.js'
import { collectDeck } from '../../lib/deckData.js'
import { buildDeck, deckFileName } from '../../lib/deck.js'
import { SECTORS, THEMES, sectorOf, pickTheme } from '../../lib/deckThemes.js'

const props = defineProps({ ticker: { type: String, required: true } })
const LAST_KEY = 'radar-cangkang.deckTheme.last'
const readLast = () => { try { return localStorage.getItem(LAST_KEY) || '' } catch { return '' } }
const saveLast = id => { try { localStorage.setItem(LAST_KEY, id) } catch { /* penyimpanan diblokir: abaikan */ } }

// Perkiraan sektor sebelum data lengkap dimuat (dipakai untuk pratinjau tema); sektor final dihitung ulang saat unduh.
const guess = computed(() => {
  const t = props.ticker, it = store.items.find(x => x.ticker === t)
  const a = store.aset?.[t]?.aset
  return sectorOf({ baru: (it ? storyOf(t)?.baru : '') || store.verified?.[t]?.baru, aset: [a?.sektor, a?.nama].filter(Boolean).join(' '), nama: it?.name })
})
const sectorThemes = computed(() => THEMES[guess.value.id] || THEMES.umum)
const otherThemes = computed(() => SECTORS.filter(s => s.id !== guess.value.id).flatMap(s => (THEMES[s.id] || []).map(t => ({ ...t, sector: s.label }))))
const choice = ref('')          // '' = acak sesuai sektor
const showAll = ref(false)
const busy = ref(false)
const step = ref('')
const done = ref(null)          // { file, theme, slides }

const SLIDES = [
  ['Ringkasan', 'skor & sikap analis'], ['Enam dimensi', 'grafik skor'], ['Kepemilikan', 'donat & arus pemegang'],
  ['Pengendali', 'profil & rekam jejak'], ['Aset injeksi', 'nilai, KJPP, tahapan'], ['Pihak lawan', 'rantai kepemilikan'],
  ['Progres', 'tonggak transaksi'], ['Valuasi & dilusi', 'sebelum → sesudah'], ['Harga 1 tahun', 'grafik & siklus'],
  ['Skenario', 'tangga harga'], ['Teknikal', 'meter sinyal'], ['Pola & level', 'support/resistance'],
  ['Rencana transaksi', 'masuk/keluar'], ['Kelebihan vs kekurangan', 'red flag & katalis'], ['Pandangan mendalam', 'temuan kunci'],
  ['Kesimpulan', 'syarat & sinyal keluar'],
]

async function download() {
  if (busy.value) return
  busy.value = true; done.value = null
  try {
    step.value = 'Memuat pustaka presentasi'
    const [{ default: PptxGenJS }, d] = await Promise.all([
      import('pptxgenjs'),
      collectDeck(props.ticker, { store, api, storyOf, getBenchmark, onStep: s => { step.value = s } }),
    ])
    const th = pickTheme(d.sector.id, { lastId: readLast(), choose: choice.value })
    step.value = 'Menyusun slide'
    const pres = buildDeck(PptxGenJS, d, th)
    const file = deckFileName(props.ticker, d.date, th)
    await pres.writeFile({ fileName: file })
    saveLast(th.id)
    done.value = { file, theme: th, slides: pres.slides.length, sector: d.sector.label }
  } catch (e) {
    toast('Presentasi gagal dibuat: ' + (e?.message || e), true)
  } finally {
    busy.value = false; step.value = ''
  }
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
        <h3 class="lbl">Tema</h3>
        <div class="themes" role="radiogroup" aria-label="Pilih tema presentasi">
          <button type="button" class="th auto" role="radio" :aria-checked="choice === ''" :class="{ on: choice === '' }" @click="choice = ''">
            <span class="sw shuffle" aria-hidden="true">⤨</span>
            <span><b>Acak</b><small>berganti tiap unduhan</small></span>
          </button>
          <button v-for="t in sectorThemes" :key="t.id" type="button" class="th" role="radio" :aria-checked="choice === t.id"
            :class="{ on: choice === t.id }" @click="choice = t.id">
            <span class="sw" :style="{ background: '#' + t.dark }" aria-hidden="true">
              <i :style="{ background: '#' + t.accent }" /><i :style="{ background: '#' + t.accent2 }" /><i :style="{ background: '#' + t.bg }" />
            </span>
            <span><b>{{ t.name }}</b><small>{{ t.head }}</small></span>
          </button>
        </div>
        <button type="button" class="link" @click="showAll = !showAll">{{ showAll ? 'Sembunyikan tema sektor lain' : 'Tema sektor lain' }}</button>
        <div v-if="showAll" class="themes small">
          <button v-for="t in otherThemes" :key="t.id" type="button" class="th" role="radio" :aria-checked="choice === t.id"
            :class="{ on: choice === t.id }" :title="t.sector" @click="choice = t.id">
            <span class="sw" :style="{ background: '#' + t.dark }" aria-hidden="true">
              <i :style="{ background: '#' + t.accent }" /><i :style="{ background: '#' + t.accent2 }" />
            </span>
            <span><b>{{ t.name }}</b><small>{{ t.sector }}</small></span>
          </button>
        </div>

        <button type="button" class="btn go" :disabled="busy" @click="download">
          {{ busy ? (step || 'Menyiapkan…') + '…' : 'Unduh presentasi (.pptx)' }}
        </button>
        <p v-if="done" class="ok" role="status">
          Tersimpan: <b>{{ done.file }}</b> · {{ done.slides }} slide · tema {{ done.theme.name }} ({{ done.sector }}).
          Unduhan berikutnya otomatis memakai varian lain.
        </p>
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
.themes{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin-bottom:8px}
.themes.small{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.th{display:flex;align-items:center;gap:10px;text-align:left;padding:8px;border:1px solid var(--rule);background:transparent;cursor:pointer;color:inherit;font:inherit}
.th:hover{border-color:var(--rule-2)}
.th.on{outline:2px solid var(--now-ink);outline-offset:-1px}
.th b{display:block;font-size:13px}
.th small{display:block;font-size:11px;opacity:.7}
.sw{flex:none;width:44px;height:30px;border-radius:4px;display:flex;align-items:flex-end;gap:2px;padding:4px;box-sizing:border-box}
.sw i{flex:1;height:8px;border-radius:2px}
.sw.shuffle{background:var(--rule-2);align-items:center;justify-content:center;font-size:18px}
.link{background:none;border:0;padding:0;margin:2px 0 12px;color:var(--now-ink);cursor:pointer;font:inherit;text-decoration:underline}
.go{width:100%;padding:10px;font-weight:600}
.ok{margin:10px 0 0;font-size:13px}
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
