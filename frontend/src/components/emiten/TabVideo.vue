<script setup>
// Video rangkuman analisis: adegan animasi + narasi suara Bahasa Indonesia (Web Speech API browser) + teks di layar.
// Naskah disusun otomatis dari data analisis yang sama dengan tab Analisa/presentasi. Versi Ringkas (±4 menit)
// atau Lengkap (±15–18 menit, isi dan urutan sama dengan presentasi). Tanpa suara Indonesia di perangkat, video tetap berjalan dengan teks dan waktu perkiraan.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { store, storyOf, getBenchmark } from '../../store.js'
import { api } from '../../api.js'
import { collectDeck } from '../../lib/deckData.js'
import { buildVideo, speakable, lineSecs, toSrt, toScript } from '../../lib/videoScript.js'

const props = defineProps({ ticker: { type: String, required: true } })
const loading = ref(true), error = ref(''), step = ref('')
const data = shallowRef(null)
const mode = ref('ringkas')
const scenes = computed(() => data.value ? buildVideo(data.value, mode.value) : [])
const si = ref(0), li = ref(0), playing = ref(false), rate = ref(1)
const stage = ref(null)

// ---- suara ----
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
const voices = ref([]), voiceName = ref('')
function loadVoices() {
  if (!synth) return
  const all = synth.getVoices().filter(v => /^id(-|_|$)/i.test(v.lang))
  // Utamakan suara laki-laki (Edge: Ardi Online; Windows: Andika), lalu suara alami lainnya.
  const rank = v => (MALE.test(v.name) ? 0 : 2) + (/(online|natural)/i.test(v.name) ? 0 : 1)
  voices.value = all.sort((a, b) => rank(a) - rank(b))
  if (!voices.value.some(v => v.name === voiceName.value)) voiceName.value = voices.value[0]?.name || ''
}
const MALE = /\b(ardi|andika|male|pria|laki)\b/i
const voice = computed(() => voices.value.find(v => v.name === voiceName.value) || null)
// Bila hanya tersedia suara wanita (mis. "Google Bahasa Indonesia"), nada diturunkan agar terdengar lebih berat.
const pitch = computed(() => voice.value && !MALE.test(voice.value.name) ? 0.7 : 1)

async function load() {
  loading.value = true; error.value = ''; stop()
  try {
    data.value = await collectDeck(props.ticker, { store, api, storyOf, getBenchmark, onStep: s => { step.value = s } })
    si.value = 0; li.value = 0
  } catch (e) { error.value = e?.message || String(e) } finally { loading.value = false }
}
onMounted(() => { loadVoices(); if (synth) synth.onvoiceschanged = loadVoices; load() })
watch(() => props.ticker, load)
watch(mode, () => { stop(); si.value = 0; li.value = 0 })
onBeforeUnmount(() => { stop(); if (synth) synth.onvoiceschanged = null })

// ---- pemutar ----
let timer = null, token = 0
const scene = computed(() => scenes.value[si.value] || null)
const line = computed(() => scene.value?.lines[li.value] || '')
function stop() { playing.value = false; token++; clearTimeout(timer); synth?.cancel() }
function next() {
  const sc = scenes.value[si.value]
  if (!sc) return stop()
  if (li.value < sc.lines.length - 1) li.value++
  else if (si.value < scenes.value.length - 1) { si.value++; li.value = 0 }
  else { stop(); return }
  speak()
}
function speak() {
  const my = ++token
  clearTimeout(timer); synth?.cancel()
  const text = line.value
  if (!playing.value || !text) return
  if (synth && voice.value) {
    const u = new SpeechSynthesisUtterance(speakable(text))
    u.lang = voice.value.lang; u.voice = voice.value; u.rate = rate.value; u.pitch = pitch.value
    u.onend = () => { if (my === token && playing.value) timer = setTimeout(next, 250) }
    u.onerror = () => { if (my === token && playing.value) timer = setTimeout(next, lineSecs(text, rate.value) * 1000) }
    synth.speak(u)
  } else timer = setTimeout(() => { if (my === token) next() }, lineSecs(text, rate.value) * 1000)
}
function play() { if (!scenes.value.length) return; if (si.value >= scenes.value.length) { si.value = 0; li.value = 0 } playing.value = true; speak() }
function toggle() { playing.value ? stop() : play() }
function goScene(i) { const was = playing.value; stop(); si.value = i; li.value = 0; if (was) play() }
function prevLine() { const was = playing.value; stop(); if (li.value > 0) li.value--; else if (si.value > 0) { si.value--; li.value = scenes.value[si.value].lines.length - 1 } if (was) play() }
function nextLine() { const was = playing.value; stop(); next(); if (was) play() }
watch(rate, () => { if (playing.value) speak() })
watch(voiceName, () => { if (playing.value) speak() })

// Waktu: perkiraan dari jumlah kata (durasi suara sebenarnya bergantung mesin suara perangkat).
const durs = computed(() => scenes.value.map(s => s.lines.map(l => lineSecs(l, rate.value))))
const total = computed(() => durs.value.flat().reduce((a, b) => a + b, 0))
const elapsed = computed(() => durs.value.slice(0, si.value).flat().reduce((a, b) => a + b, 0) + (durs.value[si.value] || []).slice(0, li.value).reduce((a, b) => a + b, 0))
const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
function seek(e) {
  const r = e.currentTarget.getBoundingClientRect(), target = (e.clientX - r.left) / r.width * total.value
  let t = 0
  for (let i = 0; i < durs.value.length; i++) for (let j = 0; j < durs.value[i].length; j++) {
    if (t + durs.value[i][j] > target) { const was = playing.value; stop(); si.value = i; li.value = j; if (was) play(); return }
    t += durs.value[i][j]
  }
}
function fullscreen() { const el = stage.value; if (!document.fullscreenElement) el?.requestFullscreen?.(); else document.exitFullscreen?.() }
function save(name, text, type = 'text/plain') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
const fileBase = computed(() => `${props.ticker}_Video-${mode.value === 'lengkap' ? 'Lengkap' : 'Ringkas'}_${new Date().toISOString().slice(0, 10)}`)

// ---- visual ----
const pctW = (v, max) => `${Math.max(2, Math.min(100, (+v || 0) / (max || 1) * 100))}%`
const ladder = computed(() => {
  const v = scene.value?.visual
  if (v?.type !== 'ladder') return null
  const vals = [v.price, ...v.levels.map(l => l.v)].filter(x => x > 0), lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1
  const y = x => 92 - (x - lo) / span * 84
  return { price: v.price, py: y(v.price), levels: v.levels.map(l => ({ ...l, y: y(l.v) })).sort((a, b) => a.y - b.y) }
})
const rpS = v => v == null ? '–' : 'Rp' + Math.round(v).toLocaleString('id-ID')
</script>

<template>
  <section class="rule-top vid">
    <div class="bar">
      <h2 class="lbl">Video rangkuman {{ ticker }}</h2>
      <div role="group" aria-label="Versi video" class="grp">
        <button type="button" class="pill sm" :aria-pressed="String(mode === 'ringkas')" @click="mode = 'ringkas'">Ringkas</button>
        <button type="button" class="pill sm" :aria-pressed="String(mode === 'lengkap')" @click="mode = 'lengkap'">Lengkap</button>
      </div>
    </div>

    <p v-if="loading" class="muted">Menyiapkan video: {{ step || 'memuat data analisis' }}…</p>
    <p v-else-if="error" class="muted">Video belum bisa disiapkan: {{ error }}</p>
    <template v-else-if="scene">
      <!-- Layar video 16:9 -->
      <div ref="stage" class="stage" @click="toggle">
        <div :key="scene.id + mode" class="scene">
          <div class="chap">{{ si + 1 }}. {{ scene.bab }}</div>
          <h3 class="ttl">{{ scene.judul }}</h3>

          <div v-if="scene.visual.type === 'title'" class="v-title">
            <b class="tk">{{ scene.visual.t }}</b>
            <span class="nm">{{ scene.visual.name }}</span>
            <span class="meta">{{ [scene.visual.sector, scene.visual.sikap, scene.visual.score != null ? `Skor ${scene.visual.score}/100` : ''].filter(Boolean).join(' · ') }}</span>
          </div>

          <div v-else-if="scene.visual.type === 'kpis'" class="v-kpis">
            <div v-for="(k, i) in scene.visual.items" :key="i" class="kpi" :style="{ animationDelay: i * 0.35 + 's' }"><b>{{ k[0] }}</b><span>{{ k[1] }}</span></div>
          </div>

          <div v-else-if="scene.visual.type === 'bars'" class="v-bars">
            <div v-for="(b, i) in scene.visual.items" :key="i" class="br" :style="{ animationDelay: i * 0.25 + 's' }">
              <span class="bl">{{ b.label }}</span>
              <span class="track">
                <i v-if="b.from != null" class="from" :style="{ width: pctW(b.from, scene.visual.max || 100) }" />
                <i class="to" :style="{ width: pctW(b.to, scene.visual.max || 100), animationDelay: i * 0.25 + 0.2 + 's' }" />
              </span>
              <span class="bv">{{ b.from != null ? `${b.from.toLocaleString('id-ID', { maximumFractionDigits: 2 })}${scene.visual.unit} → ` : '' }}{{ (+b.to).toLocaleString('id-ID', { maximumFractionDigits: 2 }) }}{{ scene.visual.unit }}</span>
            </div>
          </div>

          <div v-else-if="scene.visual.type === 'compare'" class="v-cmp">
            <div class="cmp">
              <div class="col"><b>{{ scene.visual.from.v.toLocaleString('id-ID', { maximumFractionDigits: 1 }) }}%</b><span>{{ scene.visual.from.l }}</span><i :style="{ height: pctW(scene.visual.from.v, 100) }" /></div>
              <div class="col"><b>{{ scene.visual.to.v.toLocaleString('id-ID', { maximumFractionDigits: 1 }) }}%</b><span>{{ scene.visual.to.l }}</span><i :style="{ height: pctW(scene.visual.to.v, 100), animationDelay: '.4s' }" /></div>
              <div v-if="scene.visual.extra" class="col"><b>{{ scene.visual.extra.v.toLocaleString('id-ID', { maximumFractionDigits: 1 }) }}%</b><span>{{ scene.visual.extra.l }}</span><i :style="{ height: pctW(scene.visual.extra.v, 100), animationDelay: '.8s' }" /></div>
            </div>
            <div class="mini"><div v-for="(k, i) in scene.visual.kpis" :key="i" class="kpi sm" :style="{ animationDelay: 0.6 + i * 0.3 + 's' }"><b>{{ k[0] }}</b><span>{{ k[1] }}</span></div></div>
          </div>

          <div v-else-if="scene.visual.type === 'ladder' && ladder" class="v-ladder">
            <div class="axis">
              <div v-for="(l, i) in ladder.levels" :key="i" class="lv" :style="{ top: l.y + '%', animationDelay: i * 0.2 + 's' }"><span class="ln" /><b>{{ rpS(l.v) }}</b> <span>{{ l.l }}</span></div>
              <div class="now" :style="{ top: ladder.py + '%' }"><span class="dot" /> <b>Harga kini {{ rpS(ladder.price) }}</b></div>
            </div>
          </div>

          <ul v-else-if="scene.visual.type === 'list'" class="v-list">
            <li v-for="(x, i) in scene.visual.items" :key="i" :style="{ animationDelay: i * 0.5 + 's' }">{{ x }}</li>
          </ul>

          <div v-else-if="scene.visual.type === 'rec'" class="v-rec">
            <b class="act">{{ scene.visual.rec.label }}</b>
            <div class="v-kpis">
              <div class="kpi"><b>{{ scene.visual.rec.entry ? (scene.visual.rec.entry[1] ? `${rpS(scene.visual.rec.entry[0])}–${rpS(scene.visual.rec.entry[1])}` : `> ${rpS(scene.visual.rec.entry[0])}`) : 'Tidak ada' }}</b><span>Area beli</span></div>
              <div class="kpi" style="animation-delay:.35s"><b>{{ rpS(scene.visual.rec.stop) }}</b><span>Batas risiko</span></div>
              <div class="kpi" style="animation-delay:.7s"><b>{{ scene.visual.rec.targets[0] ? rpS(scene.visual.rec.targets[0].p) : '–' }}</b><span>Target</span></div>
            </div>
            <span class="por">{{ scene.visual.rec.porsi }}</span>
          </div>
        </div>
        <div class="caption" aria-live="polite">{{ line }}</div>
        <button v-if="!playing" type="button" class="bigplay" aria-label="Putar" @click.stop="play">▶</button>
      </div>

      <!-- Kontrol -->
      <div class="ctl">
        <button type="button" class="btn" @click="prevLine" aria-label="Kalimat sebelumnya">⏮</button>
        <button type="button" class="btn play" @click="toggle">{{ playing ? '⏸ Jeda' : '▶ Putar' }}</button>
        <button type="button" class="btn" @click="nextLine" aria-label="Kalimat berikutnya">⏭</button>
        <div class="prog" role="slider" :aria-valuenow="Math.round(elapsed)" :aria-valuemax="Math.round(total)" aria-label="Posisi video" @click="seek">
          <i :style="{ width: (elapsed / total * 100) + '%' }" />
        </div>
        <span class="time small">{{ mmss(elapsed) }} / {{ mmss(total) }}</span>
        <label class="small">Kecepatan
          <select v-model.number="rate" class="field sm"><option :value="0.85">0,85×</option><option :value="1">1×</option><option :value="1.15">1,15×</option><option :value="1.3">1,3×</option></select>
        </label>
        <label v-if="voices.length > 1" class="small">Suara
          <select v-model="voiceName" class="field sm"><option v-for="v in voices" :key="v.name" :value="v.name">{{ v.name }}</option></select>
        </label>
        <button type="button" class="btn" @click="fullscreen">Layar penuh</button>
      </div>
      <p v-if="!voices.length" class="small muted">Perangkat ini belum memiliki suara Bahasa Indonesia, sehingga video berjalan tanpa suara (teks tetap tampil). Gunakan Chrome atau Edge terbaru, atau pasang paket suara Indonesia di pengaturan sistem.</p>

      <!-- Bab -->
      <ol class="chaps">
        <li v-for="(s, i) in scenes" :key="s.id"><button type="button" :class="{ on: i === si }" @click="goScene(i)"><span class="n">{{ i + 1 }}</span>{{ s.bab }}<small>{{ mmss(durs[i].reduce((a, b) => a + b, 0)) }}</small></button></li>
      </ol>
      <div class="dl small">
        <button type="button" class="linkbtn" @click="save(fileBase + '.txt', toScript(scenes, data))">Unduh naskah (.txt)</button>
        <button type="button" class="linkbtn" @click="save(fileBase + '.srt', toSrt(scenes, rate), 'application/x-subrip')">Unduh subtitle (.srt)</button>
        <span class="muted">Video dibuat otomatis dari data analisis terbaru; bukan anjuran membeli atau menjual efek.</span>
      </div>
    </template>
  </section>
</template>

<style scoped>
.bar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap}
.lbl{margin:0}.grp{display:flex;gap:6px}
.stage{position:relative;aspect-ratio:16/9;background:#f4f9fb;border:1px solid var(--rule);overflow:hidden;cursor:pointer;color:#1f2937}
.stage:fullscreen{border:0}
.scene{position:absolute;inset:0;padding:4% 5% 14%;display:flex;flex-direction:column;animation:fade .6s ease}
.chap{font-size:clamp(10px,1.2vw,14px);letter-spacing:.2em;text-transform:uppercase;color:#0f766e;font-weight:700}
.ttl{font-family:Cambria,Georgia,serif;font-size:clamp(18px,3vw,38px);margin:.3em 0 .6em;color:#1f2937;animation:rise .7s ease}
.caption{position:absolute;left:0;right:0;bottom:0;padding:1.2% 5%;background:#0f766e;color:#fff;font-size:clamp(12px,1.6vw,20px);line-height:1.4;min-height:12%}
.bigplay{position:absolute;inset:0;margin:auto;width:84px;height:84px;border-radius:50%;border:0;background:rgba(15,118,110,.9);color:#fff;font-size:34px;cursor:pointer}
.v-title{display:flex;flex-direction:column;gap:.4em;margin-top:3%}
.v-title .tk{font-family:Cambria,Georgia,serif;font-size:clamp(48px,9vw,120px);line-height:1;color:#0f766e;animation:rise .8s ease}
.v-title .nm{font-size:clamp(16px,2.4vw,30px);animation:rise 1s ease}
.v-title .meta{font-size:clamp(12px,1.5vw,18px);opacity:.75;animation:rise 1.2s ease}
.v-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(22%,1fr));gap:2.5%}
.kpi{background:#fff;border:1px solid #d3e9e6;border-top:4px solid #0d9488;padding:4% 5%;display:flex;flex-direction:column;gap:.4em;animation:rise .7s ease both}
.kpi b{font-family:Cambria,Georgia,serif;font-size:clamp(18px,3.2vw,42px);color:#1f2937}
.kpi span{font-size:clamp(10px,1.3vw,16px);opacity:.75}
.kpi.sm b{font-size:clamp(14px,2vw,26px)}
.v-bars{display:grid;gap:3%}
.br{display:grid;grid-template-columns:28% 1fr 20%;gap:2%;align-items:center;font-size:clamp(10px,1.3vw,16px);animation:rise .6s ease both}
.bl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.track{position:relative;height:clamp(10px,1.6vw,20px);background:#e6eef3;border-radius:999px;overflow:hidden}
.track i{position:absolute;left:0;top:0;bottom:0;border-radius:999px}
.track .from{background:#bcccdc}
.track .to{background:#0d9488;opacity:.85;animation:grow 1.2s ease both}
.bv{text-align:right;font-weight:700}
.v-cmp{display:grid;grid-template-columns:1.2fr 1fr;gap:4%;flex:1;min-height:0}
.cmp{display:flex;gap:6%;align-items:flex-end;height:100%}
.col{flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%;font-size:clamp(10px,1.2vw,15px);text-align:center}
.col b{font-family:Cambria,Georgia,serif;font-size:clamp(16px,2.4vw,32px)}
.col i{display:block;background:#0d9488;margin-top:.4em;border-radius:4px 4px 0 0;animation:growUp 1.2s ease both}
.col:first-child i{background:#486581}
.mini{display:grid;gap:4%;align-content:center}
.v-ladder{flex:1;position:relative}
.axis{position:absolute;inset:2% 0;border-left:3px solid #bcccdc;margin-left:6%}
.lv{position:absolute;left:0;right:0;display:flex;align-items:center;gap:1%;font-size:clamp(10px,1.3vw,16px);transform:translateY(-50%);animation:rise .6s ease both}
.lv .ln{width:5%;border-top:2px dashed #94a3b8}
.lv span{opacity:.75}
.now{position:absolute;left:-1%;display:flex;align-items:center;gap:1%;transform:translateY(-50%);font-size:clamp(11px,1.5vw,18px);color:#0f766e}
.now .dot{width:clamp(10px,1.4vw,18px);height:clamp(10px,1.4vw,18px);border-radius:50%;background:#0f766e;animation:pulse 1.4s infinite}
.v-list{list-style:none;margin:0;padding:0;display:grid;gap:2.5%}
.v-list li{background:#fff;border-left:4px solid #0d9488;padding:1.4% 2%;font-size:clamp(11px,1.5vw,18px);animation:rise .6s ease both}
.v-rec{display:flex;flex-direction:column;gap:3%}
.v-rec .act{font-family:Cambria,Georgia,serif;font-size:clamp(20px,3.4vw,44px);color:#0f766e;animation:rise .7s ease}
.v-rec .por{font-size:clamp(11px,1.4vw,17px);opacity:.8}
.ctl{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px}
.ctl .play{min-width:96px;font-weight:600}
.prog{flex:1;min-width:140px;height:8px;background:var(--rule-2);border-radius:4px;cursor:pointer;position:relative;overflow:hidden}
.prog i{position:absolute;left:0;top:0;bottom:0;background:var(--now-ink)}
.time{white-space:nowrap}
.field.sm{padding:2px 4px;margin-left:4px}
.chaps{list-style:none;margin:12px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px}
.chaps button{width:100%;display:grid;grid-template-columns:22px 1fr auto;gap:6px;align-items:center;text-align:left;background:var(--sheet);border:1px solid var(--rule);padding:6px 8px;cursor:pointer;font:inherit;color:inherit}
.chaps button.on{outline:2px solid var(--now-ink);outline-offset:-1px}
.chaps .n{font-weight:700;opacity:.6}
.chaps small{opacity:.6}
.dl{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;align-items:center}
.linkbtn{background:none;border:0;padding:0;color:var(--now-ink);text-decoration:underline;cursor:pointer;font:inherit}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes grow{from{width:0}}
@keyframes growUp{from{height:0}}
@keyframes pulse{50%{transform:scale(1.3);opacity:.6}}
@media (max-width:760px){ .v-cmp{grid-template-columns:1fr}.br{grid-template-columns:34% 1fr 26%} }
</style>
