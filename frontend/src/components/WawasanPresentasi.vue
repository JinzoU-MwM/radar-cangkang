<script setup>
// Mode presentasi tab Wawasan: slide 16:9 layar penuh, isi muncul bertahap (klik, spasi, panah kanan), gambar
// analogi dan grafik skema di sisi kanan, alat interaktif, latihan pilihan ganda yang membuka kelanjutan grafik
// setelah dijawab, daftar periksa, dan ikhtisar (O). Esc keluar. Pola dan pintasan sama dengan HarmonicPresentasi.
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { bagianDeck, butirWawasan } from '../lib/wawasanSlide.js'
import WawasanGambar from './WawasanGambar.vue'
import WawasanAlat from './WawasanAlat.vue'

const props = defineProps({ deck: { type: Array, required: true }, judul: { type: String, default: 'Wawasan' }, busyPdf: Boolean })
const emit = defineEmits(['tutup', 'unduh'])
const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

const BAGIAN = computed(() => bagianDeck(props.deck))
const total = computed(() => props.deck.length)
const ke = ref(0)
const slide = computed(() => props.deck[ke.value] || null)
const butir = computed(() => butirWawasan(slide.value))
const bertahap = ref(true)
const awalLangkah = i => Math.min(1, butirWawasan(props.deck[i]).length)
const langkah = ref(awalLangkah(0))
const arah = ref('maju')
const tampil = j => !bertahap.value || j < langkah.value
const indeks = (jenis, i) => butir.value.findIndex(x => x.jenis === jenis && x.i === i)

// Jawaban latihan per slide dan centang daftar periksa (hilang saat presentasi ditutup).
const jawab = ref({})
const centang = ref({})
const dijawab = computed(() => jawab.value[slide.value?.id])
const visualDua = computed(() => !!(slide.value?.gambar || slide.value?.alat))

function maju() {
  if (bertahap.value && langkah.value < butir.value.length) { langkah.value++; return }
  if (ke.value < total.value - 1) { arah.value = 'maju'; ke.value++; langkah.value = awalLangkah(ke.value) }
}
function mundur() {
  if (bertahap.value && langkah.value > awalLangkah(ke.value)) { langkah.value--; return }
  if (ke.value > 0) { arah.value = 'mundur'; ke.value--; langkah.value = butirWawasan(props.deck[ke.value]).length }
}
function lompat(i) { arah.value = i >= ke.value ? 'maju' : 'mundur'; ke.value = i; langkah.value = awalLangkah(i); ikhtisar.value = false }

const akar = ref(), ikhtisar = ref(false)
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
    ArrowRight: maju, ' ': maju, PageDown: maju, Enter: maju, ArrowDown: maju,
    ArrowLeft: mundur, PageUp: mundur, Backspace: mundur, ArrowUp: mundur,
    Home: () => lompat(0), End: () => lompat(total.value - 1),
    Escape: () => { if (ikhtisar.value) ikhtisar.value = false; else tutup() },
    o: () => { ikhtisar.value = !ikhtisar.value }, O: () => { ikhtisar.value = !ikhtisar.value },
    f: layarPenuh, F: layarPenuh,
    b: () => { bertahap.value = !bertahap.value }, B: () => { bertahap.value = !bertahap.value },
  }[e.key]
  if (!aksi) return
  e.preventDefault(); e.stopPropagation()
  aksi()
}
// Klik di area slide = lanjut, kecuali pada tombol, input, gambar yang bisa dimainkan, atau alat.
function klikSlide(e) {
  if (e.target.closest('button, a, input, label, .visual, .latih')) return
  maju()
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

const noBagian = b => ROMAWI[BAGIAN.value.indexOf(b)] || ''
const daftar = computed(() => props.deck.map((s, i) => ({ i, judul: s.judul, bagian: s.bagian })))
</script>

<template>
  <div ref="akar" class="pres" tabindex="-1" role="dialog" aria-modal="true" :aria-label="'Presentasi ' + judul">
    <header class="atas">
      <span class="bag">{{ judul }} · {{ noBagian(slide?.bagian) }}. {{ slide?.bagian }}</span>
      <div class="kanan">
        <label class="tg"><input v-model="bertahap" type="checkbox" /> Tampil bertahap</label>
        <button type="button" class="ik" :aria-pressed="String(ikhtisar)" title="Ikhtisar semua slide (O)" @click="ikhtisar = !ikhtisar">Ikhtisar</button>
        <button type="button" class="ik" :disabled="busyPdf" @click="emit('unduh')">{{ busyPdf ? 'Menyiapkan…' : 'Unduh PDF' }}</button>
        <button type="button" class="ik" title="Layar penuh (F)" @click="layarPenuh">Layar penuh</button>
        <button type="button" class="ik tutup" title="Keluar (Esc)" aria-label="Keluar dari presentasi" @click="tutup">×</button>
      </div>
    </header>

    <div class="panggung" @click="klikSlide">
      <article :key="ke" class="kanvas" :class="'masuk-' + arah">
        <template v-if="slide">
          <div class="kepala">
            <h1>{{ slide.judul }}</h1>
            <p v-if="slide.sub" class="sub">{{ slide.sub }}</p>
          </div>
          <div class="badan" :class="{ dua: visualDua }">
            <div class="teks">
              <p v-for="(t, i) in slide.paragraf || []" :key="'p' + i" class="prosa" :class="{ sembunyi: !tampil(indeks('p', i)) }">{{ t }}</p>
              <ul v-if="slide.poin && !slide.periksa" class="poin">
                <li v-for="(t, i) in slide.poin" :key="'l' + i" :class="{ sembunyi: !tampil(indeks('li', i)) }">{{ t }}</li>
              </ul>
              <ul v-if="slide.periksa" class="cek">
                <li v-for="(t, i) in slide.poin" :key="'c' + i"><label><input v-model="centang[i]" type="checkbox" /> {{ t }}</label></li>
                <li class="hasil" :class="{ siap: slide.poin.every((_, i) => centang[i]) }">{{ slide.poin.every((_, i) => centang[i]) ? 'Semua tercentang. Silakan jalankan rencana.' : 'Masih ada yang belum. Tahan dulu.' }}</li>
              </ul>
              <table v-if="slide.tabel" class="tb">
                <thead><tr><th v-for="k in slide.tabel.kolom" :key="k">{{ k }}</th></tr></thead>
                <tbody><tr v-for="(b, i) in slide.tabel.baris" :key="i" :class="{ sembunyi: !tampil(indeks('tr', i)) }"><td v-for="(c, j) in b" :key="j">{{ c }}</td></tr></tbody>
              </table>
              <div v-if="slide.pilihan" class="latih">
                <p class="situasi">{{ slide.pilihan.situasi }}</p>
                <div class="opsi">
                  <button v-for="(o, i) in slide.pilihan.opsi" :key="i" type="button" :disabled="dijawab !== undefined"
                    :class="{ benar: dijawab !== undefined && o.benar, salah: dijawab === i && !o.benar }" @click="jawab = { ...jawab, [slide.id]: i }">{{ o.teks }}</button>
                </div>
                <template v-if="dijawab !== undefined">
                  <p class="alasan" :class="slide.pilihan.opsi[dijawab].benar ? 'ok' : 'no'" aria-live="polite">{{ slide.pilihan.opsi[dijawab].alasan }}</p>
                  <p v-if="!slide.pilihan.opsi[dijawab].benar" class="alasan ok">{{ slide.pilihan.opsi.find(o => o.benar).alasan }}</p>
                  <button type="button" class="ulang" @click="jawab = { ...jawab, [slide.id]: undefined }">Coba lagi</button>
                </template>
              </div>
              <p v-if="slide.analogi" class="analogi"><b>Ibaratnya</b> {{ slide.analogi }}</p>
            </div>
            <aside v-if="visualDua" class="visual">
              <WawasanGambar v-if="slide.gambar" :nama="slide.gambar" :sebagian="!!slide.pilihan && dijawab === undefined" />
              <WawasanAlat v-if="slide.alat" :nama="slide.alat" />
            </aside>
          </div>
          <footer class="kaki"><span v-if="slide.rujukan">Rujukan: {{ slide.rujukan }}</span></footer>
        </template>
      </article>
    </div>

    <footer class="bawah">
      <button type="button" class="nv" :disabled="ke === 0 && langkah <= awalLangkah(0)" aria-label="Sebelumnya" @click="mundur">‹</button>
      <div class="prog">
        <div class="bar"><i :style="{ width: (ke + 1) / total * 100 + '%' }"></i></div>
        <span>Slide {{ ke + 1 }} / {{ total }}<template v-if="bertahap && butir.length"> · butir {{ langkah }} / {{ butir.length }}</template></span>
      </div>
      <span class="pintas">→ / spasi lanjut · ← kembali · O ikhtisar · B bertahap · F layar penuh · Esc keluar</span>
      <button type="button" class="nv" :disabled="ke === total - 1" aria-label="Berikutnya" @click="maju">›</button>
    </footer>

    <Transition name="pudar">
      <div v-if="ikhtisar" class="ikhtisar" role="dialog" aria-label="Ikhtisar slide">
        <template v-for="b in BAGIAN" :key="b">
          <h2>{{ noBagian(b) }}. {{ b }}</h2>
          <div class="grid">
            <button v-for="x in daftar.filter(y => y.bagian === b)" :key="x.i" type="button" class="kartu" :class="{ on: x.i === ke }" @click="lompat(x.i)">
              <span class="no">{{ x.i + 1 }}</span>{{ x.judul }}
            </button>
          </div>
        </template>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.pres{position:fixed;inset:0;z-index:200;background:var(--paper);display:grid;grid-template-rows:auto 1fr auto;grid-template-columns:minmax(0,1fr);outline:none}
.atas,.bawah{display:flex;align-items:center;gap:12px;padding:8px 18px;color:var(--ink-2);font-size:13px}
.atas{justify-content:space-between;border-bottom:1px solid var(--rule)}
.bag{min-width:0;font-weight:700;color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kanan{display:flex;gap:6px;align-items:center;flex:none}
.tg{display:flex;gap:4px;align-items:center;cursor:pointer}
.ik{border:1px solid var(--rule);background:var(--sheet);color:var(--ink);border-radius:6px;padding:4px 10px;cursor:pointer;font:600 12px var(--f-body)}
.ik[aria-pressed="true"]{background:var(--accent-soft);color:var(--accent-ink)}
.ik:disabled{opacity:.5;cursor:default}
.tutup{font-size:18px;line-height:1;padding:2px 10px}
.panggung{display:grid;place-items:center;padding:14px;overflow:hidden;min-height:0}
.kanvas{container-type:inline-size;width:min(100%, calc((100vh - 140px) * 16 / 9));aspect-ratio:16 / 9;background:var(--sheet);border:1px solid var(--rule);
  border-radius:14px;box-shadow:var(--shadow);padding:3.2cqi 4cqi 2.4cqi;display:grid;grid-template-rows:auto 1fr auto;overflow:auto;cursor:pointer}
.kepala h1{font-family:var(--f-display);font-size:3.4cqi;line-height:1.15;margin:0;color:var(--ink)}
.sub{margin:.5cqi 0 0;color:var(--ink-2);font-size:1.7cqi}
.badan{display:grid;gap:3cqi;margin-top:2cqi;min-height:0;align-content:start;overflow:auto}
.badan.dua{grid-template-columns:minmax(0, 1.15fr) minmax(0, 1fr)}
.prosa{font-size:1.65cqi;line-height:1.6;margin:0 0 1.2cqi;color:var(--ink)}
.poin{margin:0;padding-left:2.4cqi;display:grid;gap:.9cqi;font-size:1.6cqi;line-height:1.5;color:var(--ink)}
.cek{list-style:none;margin:0;padding:0;display:grid;gap:1cqi;font-size:1.7cqi;cursor:default}
.cek label{display:flex;gap:1cqi;cursor:pointer;align-items:flex-start}
.cek .hasil{margin-top:1cqi;padding:.8cqi 1.4cqi;border-radius:8px;background:var(--warn-bg);color:var(--warn);font-weight:700}
.cek .hasil.siap{background:var(--good-bg);color:var(--good)}
.tb{border-collapse:collapse;width:100%;font-size:1.4cqi;margin-top:1cqi}
.tb th,.tb td{border-bottom:1px solid var(--rule-2);padding:.7cqi 1cqi;text-align:left;vertical-align:top}
.tb th{background:var(--sheet-2);color:var(--ink-2)}
.tb td:first-child{font-weight:700}
.analogi{margin:1.4cqi 0 0;font-size:1.55cqi;line-height:1.55;background:var(--warn-bg);border-left:4px solid var(--warn);padding:1cqi 1.4cqi;border-radius:0 8px 8px 0;color:var(--ink)}
.analogi b{color:var(--warn);margin-right:.4cqi}
.latih{display:grid;gap:1.2cqi;cursor:default}
.situasi{margin:0;font-size:1.65cqi;line-height:1.55;background:var(--sheet-2);padding:1.2cqi 1.4cqi;border-radius:8px}
.opsi{display:grid;gap:.8cqi}
.opsi button{text-align:left;border:1px solid var(--rule);background:var(--sheet);color:var(--ink);border-radius:8px;padding:1cqi 1.4cqi;font:600 1.5cqi var(--f-body);cursor:pointer}
.opsi button:hover:not(:disabled){border-color:var(--accent);background:var(--accent-soft)}
.opsi button:disabled{cursor:default}
.opsi button.benar{border-color:var(--good);background:var(--good-bg);color:var(--good)}
.opsi button.salah{border-color:var(--strong);background:var(--strong-bg);color:var(--strong)}
.alasan{margin:0;font-size:1.5cqi;line-height:1.55;padding-left:1.2cqi;border-left:3px solid}
.alasan.ok{border-color:var(--good)}.alasan.no{border-color:var(--strong)}
.ulang{justify-self:start;border:1px solid var(--rule);background:var(--sheet);color:var(--ink-2);border-radius:6px;padding:.4cqi 1.2cqi;font:600 1.3cqi var(--f-body);cursor:pointer}
.prosa,.poin li,.tb tbody tr{transition:opacity .35s ease, transform .35s ease}
.sembunyi{opacity:0;transform:translateY(.6cqi)}
.visual{display:grid;gap:1cqi;align-content:start;cursor:default}
.kaki{display:flex;justify-content:space-between;align-items:center;gap:2cqi;margin-top:1.5cqi;font-size:1.2cqi;color:var(--ink-2);border-top:1px solid var(--rule-2);padding-top:1cqi;min-height:1.2cqi}
.bawah{border-top:1px solid var(--rule)}
.nv{width:40px;height:40px;border-radius:50%;border:1px solid var(--rule);background:var(--sheet);color:var(--ink);font-size:22px;cursor:pointer;flex:none}
.nv:disabled{opacity:.35;cursor:default}
.prog{display:grid;gap:3px;min-width:200px}
.bar{height:4px;background:var(--rule-2);border-radius:2px;overflow:hidden}
.bar i{display:block;height:100%;background:var(--accent);transition:width .3s}
.pintas{margin-left:auto;font-size:12px}
.ikhtisar{position:absolute;inset:52px 0 60px;background:var(--paper);overflow:auto;padding:16px 22px;z-index:2}
.ikhtisar h2{font-family:var(--f-display);font-size:16px;margin:14px 0 6px;color:var(--ink)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}
.kartu{display:flex;gap:8px;align-items:flex-start;text-align:left;border:1px solid var(--rule);background:var(--sheet);color:var(--ink);border-radius:8px;padding:10px;min-height:62px;cursor:pointer;font:13px var(--f-body)}
.kartu.on{border-color:var(--accent);background:var(--accent-soft)}
.kartu .no{font:700 12px var(--f-data);color:var(--ink-2)}
.masuk-maju{animation:masukKanan .3s ease-out}
.masuk-mundur{animation:masukKiri .3s ease-out}
@keyframes masukKanan{from{opacity:0;transform:translateX(30px)}}
@keyframes masukKiri{from{opacity:0;transform:translateX(-30px)}}
.pudar-enter-active,.pudar-leave-active{transition:opacity .2s}
.pudar-enter-from,.pudar-leave-to{opacity:0}
@media (prefers-reduced-motion: reduce){
  .masuk-maju,.masuk-mundur{animation:none}
  .prosa,.poin li,.tb tbody tr{transition:none}
}
@media (max-width: 900px){
  .kanvas{aspect-ratio:auto;width:100%;height:100%}
  .badan.dua{grid-template-columns:1fr}
  .kepala h1{font-size:6cqi}.sub{font-size:3.4cqi}.prosa,.poin,.cek,.situasi,.analogi{font-size:3.4cqi}.tb{font-size:3cqi}.kaki{font-size:3cqi}
  .opsi button,.alasan{font-size:3.2cqi}.ulang{font-size:3cqi}
  .pintas,.tg{display:none}
  .atas{flex-wrap:wrap}
}
</style>
