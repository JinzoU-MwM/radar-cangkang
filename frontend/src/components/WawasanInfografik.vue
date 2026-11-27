<script setup>
// Presentasi versi bergambar tab Wawasan, bergaya infografik: setiap slide berupa pita berwarna dengan nomor besar,
// judul, penjelasan lengkap, kotak "Ibaratnya", dan gambar analogi diam di kanan (lib/wawasanMotif.js, atau adegan
// dan alat yang sudah ada). Tanpa animasi dan tanpa tampil bertahap. Tombol Infografik menampilkan semua slide
// sebagai satu poster yang bisa digulir. Presentasi biasa (WawasanPresentasi) tetap ada.
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { svgMotif } from '../lib/wawasanMotif.js'
import WawasanGambar from './WawasanGambar.vue'
import WawasanAlat from './WawasanAlat.vue'

const props = defineProps({ deck: { type: Array, required: true }, judul: { type: String, default: 'Wawasan' }, busyPdf: Boolean })
const emit = defineEmits(['tutup', 'unduh'])

// Warna pita bergantian, dari token (bukan warna mentah).
const WARNA = ['var(--accent)', 'var(--viz-a)', 'var(--viz-c)', 'var(--now)', 'var(--strong)', 'var(--warn)']
const warna = i => WARNA[i % WARNA.length]

const total = computed(() => props.deck.length)
const ke = ref(0)
const slide = computed(() => props.deck[ke.value] || null)
const poster = ref(false)
const jawab = ref({}), centang = ref({})
const dijawab = computed(() => jawab.value[slide.value?.id])
const punyaVisual = s => !!(s?.motif || s?.gambar || s?.alat)

function maju() { if (ke.value < total.value - 1) ke.value++ }
function mundur() { if (ke.value > 0) ke.value-- }
function lompat(i) { ke.value = i; poster.value = false }

const akar = ref()
async function layarPenuh() {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await akar.value?.requestFullscreen?.() } catch {}
}
function tutup() {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  emit('tutup')
}
function tombol(e) {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) && e.key !== 'Escape') return
  const aksi = {
    ArrowRight: maju, ' ': maju, PageDown: maju, ArrowLeft: mundur, PageUp: mundur, Backspace: mundur,
    Home: () => lompat(0), End: () => lompat(total.value - 1),
    Escape: () => { if (poster.value) poster.value = false; else tutup() },
    i: () => { poster.value = !poster.value }, I: () => { poster.value = !poster.value },
    f: layarPenuh, F: layarPenuh,
  }[e.key]
  if (!aksi) return
  e.preventDefault(); e.stopPropagation()
  aksi()
}
onMounted(() => {
  window.addEventListener('keydown', tombol, true)
  document.body.style.overflow = 'hidden'
  nextTick(() => akar.value?.focus())
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', tombol, true)
  document.body.style.overflow = ''
})
const ringkas = s => (s.paragraf?.[0] || s.poin?.[0] || s.pilihan?.situasi || s.tabel?.baris?.map(b => b[0]).join(' · ') || '')
</script>

<template>
  <div ref="akar" class="ig" tabindex="-1" role="dialog" aria-modal="true" :aria-label="'Presentasi bergambar ' + judul">
    <header class="atas">
      <span class="jdl">{{ judul }}</span>
      <div class="kanan">
        <button type="button" class="ik" :aria-pressed="String(poster)" title="Semua slide sebagai satu poster (I)" @click="poster = !poster">Infografik</button>
        <button type="button" class="ik" :disabled="busyPdf" @click="emit('unduh')">{{ busyPdf ? 'Menyiapkan…' : 'Unduh PDF bergambar' }}</button>
        <button type="button" class="ik" title="Layar penuh (F)" @click="layarPenuh">Layar penuh</button>
        <button type="button" class="ik tutup" title="Keluar (Esc)" aria-label="Keluar dari presentasi" @click="tutup">×</button>
      </div>
    </header>

    <div class="panggung">
      <article v-if="slide" :key="ke" class="pita" :style="{ '--w': warna(ke) }">
        <div class="no"><span>{{ ke + 1 }}</span><small>{{ slide.bagian }}</small></div>
        <div class="isi">
          <h1>{{ slide.judul }}</h1>
          <p v-if="slide.sub" class="sub">{{ slide.sub }}</p>
          <p v-for="(t, i) in slide.paragraf || []" :key="'p' + i" class="prosa">{{ t }}</p>
          <ul v-if="slide.poin && !slide.periksa" class="poin"><li v-for="(t, i) in slide.poin" :key="i">{{ t }}</li></ul>
          <ul v-if="slide.periksa" class="cek">
            <li v-for="(t, i) in slide.poin" :key="i"><label><input v-model="centang[i]" type="checkbox" /> {{ t }}</label></li>
          </ul>
          <table v-if="slide.tabel" class="tb">
            <thead><tr><th v-for="k in slide.tabel.kolom" :key="k">{{ k }}</th></tr></thead>
            <tbody><tr v-for="(b, i) in slide.tabel.baris" :key="i"><td v-for="(c, j) in b" :key="j">{{ c }}</td></tr></tbody>
          </table>
          <div v-if="slide.pilihan" class="latih">
            <p class="situasi">{{ slide.pilihan.situasi }}</p>
            <button v-for="(o, i) in slide.pilihan.opsi" :key="i" type="button" class="opsi" :disabled="dijawab !== undefined"
              :class="{ benar: dijawab !== undefined && o.benar, salah: dijawab === i && !o.benar }" @click="jawab = { ...jawab, [slide.id]: i }">{{ o.teks }}</button>
            <template v-if="dijawab !== undefined">
              <p class="alasan" :class="slide.pilihan.opsi[dijawab].benar ? 'ok' : 'no'">{{ slide.pilihan.opsi[dijawab].alasan }}</p>
              <p v-if="!slide.pilihan.opsi[dijawab].benar" class="alasan ok">{{ slide.pilihan.opsi.find(o => o.benar).alasan }}</p>
              <button type="button" class="ulang" @click="jawab = { ...jawab, [slide.id]: undefined }">Coba lagi</button>
            </template>
          </div>
          <p v-if="slide.rujukan" class="ruj">Rujukan: {{ slide.rujukan }}</p>
        </div>
        <aside v-if="punyaVisual(slide)" class="gbr">
          <!-- eslint-disable-next-line vue/no-v-html -- SVG dibangun sendiri dari data statis, label di-escape -->
          <div v-if="slide.motif" class="motif" v-html="svgMotif(slide.motif)"></div>
          <WawasanGambar v-else-if="slide.gambar" :nama="slide.gambar" :sebagian="!!slide.pilihan && dijawab === undefined" />
          <WawasanAlat v-if="slide.alat" :nama="slide.alat" />
          <p v-if="slide.analogi" class="ibarat"><b>Ibaratnya</b>{{ slide.analogi }}</p>
        </aside>
      </article>
    </div>

    <footer class="bawah">
      <button type="button" class="nv" :disabled="ke === 0" aria-label="Sebelumnya" @click="mundur">‹</button>
      <div class="titik" role="tablist" aria-label="Pilih slide">
        <button v-for="(s, i) in deck" :key="s.id" type="button" role="tab" :aria-selected="String(i === ke)" :aria-label="`Slide ${i + 1}: ${s.judul}`"
          :class="{ on: i === ke }" :style="{ '--w': warna(i) }" @click="lompat(i)">{{ i + 1 }}</button>
      </div>
      <span class="pintas">← → pindah slide · I infografik · F layar penuh · Esc keluar</span>
      <button type="button" class="nv" :disabled="ke === total - 1" aria-label="Berikutnya" @click="maju">›</button>
    </footer>

    <div v-if="poster" class="poster" role="dialog" aria-label="Infografik semua slide">
      <div class="lembar">
        <h2>{{ judul }}</h2>
        <button v-for="(s, i) in deck" :key="s.id" type="button" class="baris" :style="{ '--w': warna(i) }" @click="lompat(i)">
          <span class="bno">{{ i + 1 }}</span>
          <span class="btk"><b>{{ s.judul }}</b><small>{{ ringkas(s) }}</small><em v-if="s.analogi">Ibaratnya: {{ s.analogi }}</em></span>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <span v-if="s.motif" class="bgbr" v-html="svgMotif(s.motif)"></span>
          <span v-else-if="s.gambar || s.alat" class="bgbr lbl">{{ s.alat ? 'alat interaktif' : 'gambar analogi' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ig{position:fixed;inset:0;z-index:200;background:var(--paper);display:grid;grid-template-rows:auto 1fr auto;grid-template-columns:minmax(0,1fr);outline:none}
.atas,.bawah{display:flex;align-items:center;gap:12px;padding:8px 18px;color:var(--ink-2);font-size:13px}
.atas{justify-content:space-between;border-bottom:1px solid var(--rule)}
.jdl{min-width:0;font-weight:700;color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kanan{display:flex;gap:6px;align-items:center;flex:none}
.ik{border:1px solid var(--rule);background:var(--sheet);color:var(--ink);border-radius:6px;padding:4px 10px;cursor:pointer;font:600 12px var(--f-body)}
.ik[aria-pressed="true"]{background:var(--accent-soft);color:var(--accent)}
.ik:disabled{opacity:.5;cursor:default}
.tutup{font-size:18px;line-height:1;padding:2px 10px}
.panggung{display:grid;place-items:center;padding:16px;overflow:auto;min-height:0}
/* Pita slide: nomor besar di kiri berwarna, isi di tengah, gambar di kanan. */
.pita{container-type:inline-size;width:min(100%, 1180px);min-height:min(100%, 640px);display:grid;grid-template-columns:auto minmax(0,1.2fr) minmax(0,1fr);
  background:var(--sheet);border-radius:18px;box-shadow:var(--shadow);overflow:hidden;border:1px solid var(--rule)}
.no{background:var(--w);color:var(--sheet);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:20px 22px;min-width:96px}
.no span{font:800 64px/1 var(--f-display)}
.no small{font:700 11px var(--f-body);text-transform:uppercase;letter-spacing:.06em;text-align:center;max-width:90px;opacity:.9}
.isi{padding:26px 28px;display:flex;flex-direction:column;gap:10px;min-width:0;overflow:auto}
.isi h1{margin:0;font:800 clamp(22px,2.6cqi,34px)/1.15 var(--f-display);color:var(--w);text-transform:uppercase;letter-spacing:.01em}
.sub{margin:0;color:var(--ink-2);font-size:15px}
.prosa{margin:0;font-size:16px;line-height:1.6;color:var(--ink)}
.poin{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.poin li{position:relative;padding-left:30px;font-size:15.5px;line-height:1.55;color:var(--ink)}
.poin li::before{content:"✓";position:absolute;left:0;top:1px;width:20px;height:20px;border-radius:50%;background:var(--w);color:var(--sheet);font:800 12px/20px var(--f-body);text-align:center}
.cek{list-style:none;margin:0;padding:0;display:grid;gap:8px;font-size:15px}
.cek label{display:flex;gap:8px;align-items:flex-start;cursor:pointer}
.tb{border-collapse:collapse;width:100%;font-size:14px}
.tb th,.tb td{border-bottom:1px solid var(--rule-2);padding:6px 8px;text-align:left;vertical-align:top}
.tb th{background:var(--sheet-2);color:var(--ink-2)}
.tb td:first-child{font-weight:700}
.latih{display:grid;gap:8px}
.situasi{margin:0;font-size:15px;line-height:1.55;background:var(--sheet-2);padding:10px 12px;border-radius:8px}
.opsi{text-align:left;border:1px solid var(--rule);background:var(--sheet);color:var(--ink);border-radius:8px;padding:9px 12px;font:600 14px var(--f-body);cursor:pointer}
.opsi:hover:not(:disabled){border-color:var(--w)}
.opsi:disabled{cursor:default}
.opsi.benar{border-color:var(--good);background:var(--good-bg);color:var(--good)}
.opsi.salah{border-color:var(--strong);background:var(--strong-bg);color:var(--strong)}
.alasan{margin:0;font-size:14px;line-height:1.55;padding-left:10px;border-left:3px solid}
.alasan.ok{border-color:var(--good)}.alasan.no{border-color:var(--strong)}
.ulang{justify-self:start;border:1px solid var(--rule);background:var(--sheet);color:var(--ink-2);border-radius:6px;padding:4px 10px;font:600 12px var(--f-body);cursor:pointer}
.ruj{margin:auto 0 0;font-size:12px;color:var(--ink-2);border-top:1px solid var(--rule-2);padding-top:8px}
.gbr{background:var(--sheet-2);padding:22px;display:flex;flex-direction:column;gap:14px;justify-content:center;border-left:1px solid var(--rule-2)}
.motif :deep(svg){width:100%;height:auto;display:block}
.ibarat{margin:0;font-size:14.5px;line-height:1.55;background:var(--sheet);border-radius:10px;padding:12px 14px;border-left:5px solid var(--w);color:var(--ink)}
.ibarat b{display:block;color:var(--w);font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}
.bawah{border-top:1px solid var(--rule)}
.nv{width:40px;height:40px;border-radius:50%;border:1px solid var(--rule);background:var(--sheet);color:var(--ink);font-size:22px;cursor:pointer;flex:none}
.nv:disabled{opacity:.35;cursor:default}
.titik{display:flex;flex-wrap:wrap;gap:4px;flex:1;justify-content:center}
.titik button{width:28px;height:28px;border-radius:50%;border:2px solid var(--w);background:var(--sheet);color:var(--ink);font:700 11px var(--f-data);cursor:pointer}
.titik button.on{background:var(--w);color:var(--sheet)}
.pintas{font-size:12px}
/* Poster infografik: semua slide sebagai baris berwarna. */
.poster{position:absolute;inset:52px 0 60px;background:var(--paper);overflow:auto;padding:18px;z-index:2}
.lembar{max-width:820px;margin:0 auto;display:grid;gap:10px}
.lembar h2{margin:0 0 6px;font:800 26px/1.2 var(--f-display);color:var(--accent);text-transform:uppercase;text-align:center}
.baris{display:grid;grid-template-columns:64px minmax(0,1fr) 150px;align-items:stretch;text-align:left;border:0;padding:0;background:var(--sheet);border-radius:14px;overflow:hidden;box-shadow:var(--shadow);cursor:pointer;font:inherit;color:var(--ink)}
.bno{background:var(--w);color:var(--sheet);display:grid;place-items:center;font:800 30px var(--f-display)}
.btk{padding:10px 14px;display:flex;flex-direction:column;gap:3px}
.btk b{font:800 15px var(--f-display);color:var(--w);text-transform:uppercase}
.btk small{font-size:12.5px;color:var(--ink);line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.btk em{font-size:12px;color:var(--ink-2);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.bgbr{background:var(--sheet-2);display:grid;place-items:center;padding:6px}
.bgbr :deep(svg){width:100%;height:auto}
.bgbr.lbl{font-size:11px;color:var(--ink-2)}
@media (max-width: 900px){
  .pita{grid-template-columns:1fr;min-height:0}
  .no{flex-direction:row;justify-content:flex-start;padding:12px 16px}
  .no span{font-size:40px}
  .no small{max-width:none;text-align:left}
  .isi{padding:16px}
  .gbr{border-left:0;border-top:1px solid var(--rule-2);padding:14px}
  .pintas,.titik{display:none}
  .atas{flex-wrap:wrap}
  .baris{grid-template-columns:48px minmax(0,1fr) 120px}
}
@media (max-width: 600px){
  .baris{grid-template-columns:44px minmax(0,1fr)}
  .bgbr{display:none}
}
</style>
