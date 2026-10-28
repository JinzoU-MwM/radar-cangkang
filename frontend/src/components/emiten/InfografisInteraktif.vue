<script setup>
// Infografis interaktif (layar penuh) dari data yang sama dengan presentasi unduhan (collectDeck): angka berjalan,
// analogi rumah yang bisa diklik, diagram transaksi, kartu istilah, garis waktu, simulasi skenario (kalkulator,
// tidak mengubah data), peta harga, katalis vs risiko. Bagian muncul bertahap saat digulir; Esc untuk menutup.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { store, storyOf, getBenchmark } from '../../store.js'
import { api } from '../../api.js'
import { collectDeck } from '../../lib/deckData.js'
import AnimNum from '../AnimNum.vue'

const props = defineProps({ ticker: { type: String, required: true } })
const emit = defineEmits(['close'])
const d = shallowRef(null), err = ref(''), step = ref('Mengumpulkan data')
const root = ref(null)

const rp = v => v == null || isNaN(v) ? '–' : 'Rp' + Math.round(v).toLocaleString('id-ID')
const big = v => v == null || isNaN(v) ? '–' : v >= 1e12 ? `Rp${(v / 1e12).toLocaleString('id-ID', { maximumFractionDigits: 2 })} T` : v >= 1e9 ? `Rp${(v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M` : rp(v)
const pct = v => v == null || isNaN(v) ? '–' : `${v > 0 ? '+' : ''}${Math.round(v * 100).toLocaleString('id-ID')}%`
const p1 = v => v == null ? '–' : (+v).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '%'
const ent = s => String(s || '').replace(/\s*\(.*?\)/g, '').trim()
const short = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s }

const A = computed(() => d.value?.A || {})
const st = computed(() => d.value?.story || {})
const pa = computed(() => d.value?.pa || {})
const rc = computed(() => d.value?.rec || null)
const rs = computed(() => d.value?.riset || {})
const price = computed(() => A.value.price)
const nilai = computed(() => d.value?.tx || d.value?.ri?.inj || null)
// Nama dari kurasi bisa berupa kalimat panjang: ambil bagian sebelum kata kerja/koma agar muat di kotak.
const nama = s => short(ent(s).split(/\s+(menuntaskan|membeli|mengambil|melalui|yang)\b|[,;]/)[0], 60)
const who = computed(() => nama(d.value?.pv?.siapa || A.value.ctrlName || 'belum diketahui'))
const injT = computed(() => nama(d.value?.ri?.injTarget || A.value.sv?.injectTarget || d.value?.aset?.aset?.nama || ''))
const tone = computed(() => rc.value?.tone === 'good' ? 'good' : rc.value?.tone === 'bad' ? 'bad' : 'warn')

// Skenario bear/base/bull (sama dengan infografis unduhan).
const skenario = computed(() => {
  const r = rc.value || {}, nw = pa.value.nilaiWajar || {}, p = price.value
  const tg = (r.targets || []).map(t => t.p).filter(x => x > 0)
  const bear = r.stop || (nw.bawah && nw.bawah < p ? nw.bawah : null) || A.value.p?.metrics?.low52 || null
  const base = tg[0] || (nw.bawah && nw.atas ? (nw.bawah + nw.atas) / 2 : null)
  const bull = tg[1] || nw.atas || null
  return [['bear', 'Bear', bear], ['base', 'Base', base], ['bull', 'Bull', bull]].map(([k, n, v]) => ({ k, n, v, r: v && p ? v / p - 1 : null }))
})
const base = computed(() => skenario.value[1])

// 1) Analogi rumah: langkah yang dipilih.
const langkah = computed(() => [
  { k: 'lama', judul: 'Rumah lama', istilah: 'Emiten sebelum diambil alih', ikon: 'rumah',
    isi: [`Usaha lama: ${st.value.lama || 'belum diketahui'}`, `Pemilik lama: ${ent(st.value.oldName) || 'belum diketahui'}${st.value.oldPct ? ` (${st.value.oldPct})` : ''}`] },
  { k: 'beli', judul: 'Pembeli rumah', istilah: 'Pengendali baru', ikon: 'orang',
    isi: [`${who.value} menguasai ${p1(A.value.ctrlPct)}`, A.value.tender?.price ? `Harga beli/PTW ${rp(A.value.tender.price)} per saham; kini ${rp(price.value)} (${pct(price.value / A.value.tender.price - 1)})` : `Harga kini ${rp(price.value)}`] },
  { k: 'perabot', judul: 'Perabot baru', istilah: 'Aset yang diinjeksi', ikon: 'kotak',
    isi: [injT.value || 'Aset belum diungkap', nilai.value ? `Nilai sekitar ${big(nilai.value)}${A.value.mcap ? ` (${(nilai.value / A.value.mcap).toLocaleString('id-ID', { maximumFractionDigits: 1 })}x kapitalisasi)` : ''}` : 'Nilai belum diungkap', d.value?.mechLabel ? `Lewat ${d.value.mechLabel}` : null].filter(Boolean) },
  { k: 'baru', judul: 'Rumah baru', istilah: 'Bisnis setelah transformasi', ikon: 'rumah',
    isi: [`Bisnis baru: ${st.value.baru || A.value.sv?.baru || 'belum diungkap'}`, `Renovasi ${d.value?.prog ? d.value.prog.pct + '%' : 'belum dipantau'}${d.value?.pos?.next ? `; berikutnya ${d.value.pos.next}` : ''}`] },
])
const pilihLangkah = ref(0)

// 2) Kartu istilah (klik untuk balik).
const istilah = [
  ['PTW', 'Penawaran tender wajib', 'Harga yang wajib ditawarkan pengendali baru ke publik setelah mengambil alih; sering jadi acuan harga dasar.'],
  ['KJPP', 'Juru taksir independen', 'Kantor Jasa Penilai Publik menilai aset yang masuk; laporan ini menentukan wajar atau tidaknya nilai transaksi.'],
  ['Dilusi', 'Kue dipotong lebih banyak', 'Bila saham baru diterbitkan dan Anda tidak ikut menebus, porsi kepemilikan Anda mengecil.'],
  ['Free float', 'Saham di tangan publik', 'Porsi saham yang bebas diperdagangkan; BEI mensyaratkan minimal 7,5%.'],
  ['Inbreng', 'Bayar pakai aset', 'Pengendali menyetor aset (bukan uang) untuk ditukar saham baru emiten.'],
  ['Rights issue', 'Patungan renovasi', 'Penerbitan saham baru untuk pemegang saham lama agar emiten mendapat dana.'],
]
const balik = ref(new Set())
const flip = k => { const s = new Set(balik.value); s.has(k) ? s.delete(k) : s.add(k); balik.value = s }

// 3) Garis waktu.
const ms = computed(() => (d.value?.prog?.applicable || d.value?.milestones || []).slice(0, 10).map(m => ({ ...m, ok: !!d.value?.prog?.ms?.[m.id], tgl: d.value?.prog?.auto?.[m.id] })))
const pilihMs = ref(-1)

// 4) Simulasi skenario: modal (kalkulator lokal, tidak disimpan).
const modal = ref(10)   // juta rupiah
const hasil = computed(() => skenario.value.map(x => ({ ...x, nilai: x.r == null ? null : modal.value * 1e6 * (1 + x.r) })))

// 5) Peta harga.
const level = computed(() => {
  const r = rc.value || {}, nw = pa.value.nilaiWajar || {}
  return [
    r.stop && ['Batas risiko', r.stop, 'bad'], r.entry?.[0] && ['Area beli', r.entry[0], 'acc'], A.value.tender?.price && ['Harga PTW', A.value.tender.price, 'mut'],
    nw.bawah && ['Nilai wajar bawah', nw.bawah, 'warn'], nw.atas && ['Nilai wajar atas', nw.atas, 'good'],
    ...(r.targets || []).slice(0, 2).map((t, i) => [`Target ${i + 1}`, t.p, 'good']),
  ].filter(Boolean).sort((a, b) => a[1] - b[1])
})
const skala = computed(() => { const v = [price.value, ...level.value.map(x => x[1])].filter(Boolean); return { lo: Math.min(...v) * 0.85, hi: Math.max(...v) * 1.1 } })
const pos = v => `${((v - skala.value.lo) / (skala.value.hi - skala.value.lo) * 100).toFixed(1)}%`

// 6) Katalis vs risiko. Poin bermakna sama (dua kata pertama sama, mis. "PMHMETD/PMTHMETD berjalan ...") hanya tampil sekali.
const unik = list => { const seen = new Set(); return list.filter(Boolean).filter(t => { const k = String(t).toLowerCase().replace(/^(tesis batal bila):\s*/, '').split(/\s+/).slice(0, 2).join(' '); return !seen.has(k) && seen.add(k) }) }
const tabKR = ref('katalis')
const katalis = computed(() => {
  const next = ms.value.filter(m => !m.ok).slice(0, 2).map(m => m.label)
  return unik([d.value?.pos?.next, ...next, ...(pa.value.variabelKunci || []), ...(A.value.bull || [])]).slice(0, 5)
})
const risiko = computed(() => unik([...(pa.value.tesisSalahBila || []).map(x => 'Tesis batal bila: ' + x), ...(A.value.bear || []), ...(rs.value.risiko || [])]).slice(0, 5))

// Aset dalam angka.
const SATUAN_RX = /[±~]?\d[\d.,]*\s*(juta ton|ton|ha|hektare|MW|tahun|%|kolam|unit|km|triliun|miliar|T|M)(?![A-Za-z])/gi
const angkaUtama = (l, v) => { const all = [...String(v).matchAll(SATUAN_RX)].map(m => m[0]); return (/umur/i.test(l) ? all.find(x => /tahun/i.test(x)) : all.find(x => !/^\d{4}\s*tahun$/i.test(x))) || short(v, 16) }
const asetAngka = computed(() => {
  const tb = rs.value.tambang
  return (tb ? [['Cadangan', tb.cadangan], ['Umur tambang', tb.umur], ['Produksi', tb.produksi], ['Luas / izin', tb.luas || tb.izin]] : [])
    .concat((rs.value.operasional || []).map(o => [o.l, o.t])).filter(x => x[1] && /\d/.test(x[1])).slice(0, 4)
})
const bukaAset = ref(-1)

// Muncul bertahap saat digulir.
let io = null
async function load() {
  try {
    d.value = await collectDeck(props.ticker, { store, api, storyOf, getBenchmark, onStep: s => { step.value = s } })
    await nextTick()
    io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('in')), { root: root.value, threshold: 0.12 })
    root.value?.querySelectorAll('.rev').forEach(el => io.observe(el))
  } catch (e) { err.value = e?.message || String(e) }
}
const onKey = e => { if (e.key === 'Escape') emit('close') }
onMounted(() => { document.body.style.overflow = 'hidden'; addEventListener('keydown', onKey); load() })
onBeforeUnmount(() => { document.body.style.overflow = ''; removeEventListener('keydown', onKey); io?.disconnect() })
</script>

<template>
  <div ref="root" class="ig" role="dialog" aria-modal="true" :aria-label="'Infografis interaktif ' + ticker">
    <button type="button" class="tutup" @click="emit('close')">Tutup ✕</button>
    <p v-if="err" class="pad">{{ err }}</p>
    <p v-else-if="!d" class="pad muat">{{ step }}…</p>
    <template v-else>
      <!-- Pembuka -->
      <header class="hero">
        <div class="hk">INFOGRAFIS INTERAKTIF · BACKDOOR LISTING · {{ d.date }}</div>
        <h1>{{ d.t }}</h1>
        <div class="nm">{{ d.name }}</div>
        <div class="badge" :class="tone">{{ rc?.label || pa.sikap || 'Belum ada rekomendasi' }}</div>
        <div class="kpi4">
          <div><b><AnimNum :text="rp(price)" /></b><span>Harga</span></div>
          <div><b><AnimNum :text="base.v ? rp(base.v) : '–'" /></b><span>Target</span></div>
          <div><b :class="base.r >= 0 ? 'g' : 'r'"><AnimNum :text="base.r != null ? pct(base.r) : '–'" /></b><span>Potensi</span></div>
          <div><b><AnimNum :text="A.score != null ? A.score + '/100' : '–'" /></b><span>Skor</span></div>
        </div>
        <div class="scroll">gulir untuk menjelajah ↓</div>
      </header>

      <!-- Analogi rumah -->
      <section class="sec rev">
        <h2><span>1</span> Memahami {{ d.t }} lewat analogi rumah</h2>
        <p class="lead">Perusahaan tercatat = <b>sebuah rumah</b>; saham = kepemilikan rumah itu. Klik tiap langkah.</p>
        <div class="alur">
          <template v-for="(l, i) in langkah" :key="l.k">
            <button type="button" class="lk" :class="{ on: pilihLangkah === i }" :aria-pressed="String(pilihLangkah === i)" @click="pilihLangkah = i">
              <svg viewBox="0 0 60 60" aria-hidden="true" class="ic">
                <template v-if="l.ikon === 'rumah'"><path d="M8 30 L30 10 L52 30 Z" /><rect x="14" y="29" width="32" height="22" rx="1" /><rect x="26" y="37" width="8" height="14" class="pintu" /></template>
                <template v-else-if="l.ikon === 'orang'"><circle cx="30" cy="18" r="9" /><rect x="17" y="29" width="26" height="24" rx="8" /></template>
                <template v-else><rect x="10" y="17" width="40" height="30" rx="2" /><rect x="27" y="17" width="6" height="30" class="pita" /></template>
              </svg>
              <b>{{ l.judul }}</b><small>{{ l.istilah }}</small>
            </button>
            <span v-if="i < 3" class="panah" aria-hidden="true">➜</span>
          </template>
        </div>
        <div class="det" aria-live="polite">
          <b>{{ langkah[pilihLangkah].judul }} = {{ langkah[pilihLangkah].istilah.toLowerCase() }}</b>
          <ul><li v-for="x in langkah[pilihLangkah].isi" :key="x">{{ x }}</li></ul>
        </div>
        <p class="pub">Penghuni lain = <b>publik ({{ p1(A.flt) }})</b>. Renovasi dengan patungan tanpa ikut menebus → bagian mengecil (dilusi).</p>
      </section>

      <!-- Diagram transaksi -->
      <section class="sec rev">
        <h2><span>2</span> Transaksi dalam satu gambar</h2>
        <div class="dg">
          <div class="nd mut" title="Pemilik sebelum diambil alih"><small>PENGENDALI LAMA</small><b>{{ ent(st.oldName) || 'belum diketahui' }}</b></div>
          <div class="nd acc" :title="`Menguasai ${p1(A.ctrlPct)}`"><small>PENGENDALI BARU</small><b>{{ who }}</b><em>{{ p1(A.ctrlPct) }}</em></div>
          <div class="nd em"><small>EMITEN</small><b class="tk">{{ d.t }}</b><em>{{ short(st.lama, 40) }} → {{ short(st.baru || A.sv?.baru, 40) }}</em></div>
          <div class="nd as" :title="nilai ? 'Nilai ' + big(nilai) : ''"><small>ASET INJEKSI</small><b>{{ injT || 'belum diungkap' }}</b><em>{{ nilai ? big(nilai) : '' }}</em></div>
        </div>
      </section>

      <!-- Angka kunci + istilah -->
      <section class="sec rev">
        <h2><span>3</span> Angka kunci</h2>
        <div class="tiles">
          <div><b><AnimNum :text="big(A.p?.stats?.marketCap || A.mcap)" /></b><span>kapitalisasi pasar</span></div>
          <div><b><AnimNum :text="p1(A.ctrlPct)" /></b><span>porsi pengendali</span><i :style="{ width: (A.ctrlPct || 0) + '%' }" /></div>
          <div><b><AnimNum :text="p1(A.flt)" /></b><span>porsi publik</span><i class="mut" :style="{ width: (A.flt || 0) + '%' }" /></div>
          <div><b><AnimNum :text="nilai ? big(nilai) : '–'" /></b><span>nilai transaksi aset</span></div>
          <div><b><AnimNum :text="d.prog ? d.prog.pct + '%' : '–'" /></b><span>progres transaksi</span><i class="good" :style="{ width: (d.prog?.pct || 0) + '%' }" /></div>
          <div><b><AnimNum :text="A.p?.metrics?.pbv != null ? A.p.metrics.pbv.toLocaleString('id-ID', { maximumFractionDigits: 2 }) + 'x' : '–'" /></b><span>PBV</span></div>
        </div>
        <h3>Kamus singkat <small>(klik kartu)</small></h3>
        <div class="kamus">
          <button v-for="[k, a, b] in istilah" :key="k" type="button" class="kk" :class="{ flip: balik.has(k) }" @click="flip(k)">
            <span class="f"><b>{{ k }}</b><small>{{ a }}</small></span><span class="bk">{{ b }}</span>
          </button>
        </div>
      </section>

      <!-- Aset -->
      <section v-if="asetAngka.length" class="sec rev">
        <h2><span>4</span> Aset dalam angka</h2>
        <div class="aset">
          <button v-for="([l, v], i) in asetAngka" :key="l" type="button" class="ak" :aria-expanded="String(bukaAset === i)" @click="bukaAset = bukaAset === i ? -1 : i">
            <b>{{ angkaUtama(l, v) }}</b><span>{{ l }}</span><small v-if="bukaAset === i">{{ v }}</small><em v-else>detail ▸</em>
          </button>
        </div>
      </section>

      <!-- Garis waktu -->
      <section v-if="ms.length" class="sec rev">
        <h2><span>5</span> Garis waktu transaksi</h2>
        <div class="tl">
          <div class="bar"><i :style="{ width: (d.prog?.pct || 0) + '%' }" /></div>
          <button v-for="(m, i) in ms" :key="m.id" type="button" class="mt" :class="{ ok: m.ok, on: pilihMs === i }" :style="{ left: (i / Math.max(1, ms.length - 1) * 100) + '%' }" @click="pilihMs = pilihMs === i ? -1 : i">
            {{ m.ok ? '✓' : i + 1 }}</button>
        </div>
        <p class="det2" aria-live="polite">{{ pilihMs >= 0 ? `${ms[pilihMs].label} — ${ms[pilihMs].ok ? 'sudah' + (ms[pilihMs].tgl ? ' (' + String(ms[pilihMs].tgl).slice(0, 10) + ')' : '') : 'belum'}` : (d.pos?.next ? 'Tahap berikutnya: ' + d.pos.next + '. Klik titik untuk detail.' : 'Klik titik untuk detail.') }}</p>
      </section>

      <!-- Simulasi skenario -->
      <section class="sec rev">
        <h2><span>6</span> Simulasi skenario</h2>
        <label class="sl">Bila modal <b>Rp{{ modal.toLocaleString('id-ID') }} juta</b> dibelikan di harga {{ rp(price) }}:
          <input v-model.number="modal" type="range" min="1" max="500" step="1" aria-label="Modal simulasi (juta rupiah)" /></label>
        <div class="sk">
          <div v-for="x in hasil" :key="x.k" class="kc" :class="x.k">
            <small>{{ x.n.toUpperCase() }}</small><b>{{ x.v ? rp(x.v) : '–' }}</b><em>{{ x.r != null ? pct(x.r) : '' }}</em>
            <strong>{{ x.nilai != null ? big(x.nilai) : '–' }}</strong><span>nilai modal Anda</span>
          </div>
        </div>
        <p class="note">Kalkulator ilustrasi, tidak menyimpan apa pun dan bukan janji hasil.</p>
      </section>

      <!-- Peta harga -->
      <section v-if="level.length && price" class="sec rev">
        <h2><span>7</span> Peta harga</h2>
        <div class="peta">
          <div class="garis" />
          <div v-for="[l, v, c] in level" :key="l" class="lv" :class="c" :style="{ left: pos(v) }" :title="`${l}: ${rp(v)} (${pct(v / price - 1)})`"><i /><span>{{ l }}<br><b>{{ rp(v) }}</b></span></div>
          <div class="now" :style="{ left: pos(price) }"><i /><span>Harga kini<br><b>{{ rp(price) }}</b></span></div>
        </div>
      </section>

      <!-- Katalis vs risiko -->
      <section class="sec rev">
        <h2><span>8</span> Katalis vs risiko</h2>
        <div class="tabs2" role="tablist">
          <button type="button" role="tab" :aria-selected="tabKR === 'katalis'" class="g" @click="tabKR = 'katalis'">Katalis ({{ katalis.length }})</button>
          <button type="button" role="tab" :aria-selected="tabKR === 'risiko'" class="r" @click="tabKR = 'risiko'">Risiko ({{ risiko.length }})</button>
        </div>
        <ol class="kr" :class="tabKR"><li v-for="x in (tabKR === 'katalis' ? katalis : risiko)" :key="x">{{ x }}</li></ol>
      </section>

      <!-- Rekomendasi -->
      <section class="sec rev last">
        <h2><span>9</span> Rekomendasi</h2>
        <div class="rk">
          <div class="act" :class="tone"><small>TINDAKAN</small><b>{{ rc?.label || '–' }}</b></div>
          <div><small>AREA BELI</small><b>{{ rc?.entry ? (rc.entry[1] ? `${rp(rc.entry[0])}–${rp(rc.entry[1])}` : `> ${rp(rc.entry[0])}`) : 'Tunggu' }}</b></div>
          <div><small>TARGET</small><b>{{ base.v ? rp(base.v) : '–' }}</b></div>
          <div><small>BATAS RISIKO</small><b>{{ rc?.stop ? rp(rc.stop) : '–' }}</b></div>
        </div>
        <p class="note">Disusun otomatis dari Stockbit, keterbukaan informasi, dan riset aset lintas sumber. Bukan ajakan membeli atau menjual efek.</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.ig{position:fixed;inset:0;z-index:100;overflow-y:auto;background:var(--paper,#f4f6f3);color:var(--ink);scroll-behavior:smooth}
.tutup{position:fixed;top:12px;right:16px;z-index:2;padding:6px 12px;border:1px solid var(--rule);background:var(--sheet);border-radius:3px;cursor:pointer;font:600 13px var(--f-body)}
.pad{padding:40px}.muat{animation:pul 1.2s infinite}
@keyframes pul{50%{opacity:.4}}
.hero{min-height:88vh;display:flex;flex-direction:column;justify-content:center;padding:40px 8vw;background:var(--accent);color:#fff;position:relative;overflow:hidden}
.hero::before,.hero::after{content:'';position:absolute;border-radius:50%;background:#fff;opacity:.08}
.hero::before{width:60vw;height:60vw;right:-15vw;top:-20vw}.hero::after{width:30vw;height:30vw;right:10vw;bottom:-12vw}
.hk{font:700 12px var(--f-display);letter-spacing:.2em;opacity:.8}
.hero h1{font:800 clamp(64px,12vw,140px)/1 var(--f-display);margin:8px 0 4px}
.nm{font-size:18px;opacity:.9}
.badge{align-self:flex-start;margin:18px 0;padding:8px 16px;border-radius:4px;font:700 18px var(--f-display);background:#fff;color:var(--ink)}
.badge.good{background:#e8f6ec;color:#17803d}.badge.warn{background:#fff3dc;color:#9a6200}.badge.bad{background:#fde8e3;color:#b4441b}
.kpi4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;max-width:760px}
.kpi4 b{display:block;font:800 clamp(22px,3.4vw,38px) var(--f-display)}.kpi4>div>span{font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.8}
.kpi4 .g{color:#b9f5c9}.kpi4 .r{color:#ffd1c2}
.scroll{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);font-size:13px;opacity:.75;animation:bob 1.6s infinite}
@keyframes bob{50%{transform:translate(-50%,6px)}}
.sec{max-width:1040px;margin:0 auto;padding:56px 24px 24px}
.sec.last{padding-bottom:80px}
.rev{opacity:0;transform:translateY(24px);transition:opacity .6s ease,transform .6s ease}
.rev.in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.rev{opacity:1;transform:none;transition:none}.scroll{animation:none}}
h2{font:800 28px var(--f-display);margin:0 0 10px;display:flex;align-items:center;gap:12px}
h2 span{display:inline-grid;place-items:center;width:40px;height:40px;border-radius:50%;background:var(--accent);color:#fff;font-size:18px}
h3{margin:22px 0 8px;font:700 16px var(--f-display)}h3 small{font-weight:400;color:var(--muted)}
.lead{color:var(--ink-2);margin:0 0 16px}
.alur{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.lk{flex:1 1 160px;display:flex;flex-direction:column;align-items:center;gap:4px;padding:16px 10px;border:2px solid var(--rule);border-radius:12px;background:var(--sheet);cursor:pointer;color:inherit;font:inherit;transition:transform .2s,border-color .2s}
.lk:hover{transform:translateY(-3px)}.lk.on{border-color:var(--accent);box-shadow:0 6px 18px rgba(0,0,0,.08)}
.ic{width:72px;height:72px;fill:var(--accent)}.ic .pintu{fill:#fff}.ic .pita{fill:var(--warn)}
.lk b{font:700 17px var(--f-display);color:var(--accent)}.lk small{color:var(--muted);font-size:12px}
.panah{font-size:28px;color:var(--good);animation:geser 1.4s infinite}
@keyframes geser{50%{transform:translateX(4px)}}
.det{margin-top:14px;padding:14px 18px;border-left:4px solid var(--accent);background:var(--sheet);border-radius:4px}
.det ul{margin:6px 0 0;padding-left:18px}
.pub{margin-top:12px;padding:10px 14px;background:var(--accent-soft);border-radius:4px;font-size:14px}
.dg{display:grid;grid-template-columns:1fr 1.2fr 1fr;grid-template-rows:auto auto;gap:14px 40px;align-items:center;position:relative}
.nd{padding:12px 14px;border-radius:8px;border:1.5px solid var(--rule);background:var(--sheet);display:flex;flex-direction:column;gap:2px;position:relative;transition:transform .2s}
.nd:hover{transform:scale(1.03)}
.nd small{font:700 11px var(--f-display);letter-spacing:.12em;color:var(--muted)}.nd b{font-size:15px}.nd em{font-style:normal;font-size:12px;color:var(--accent);font-weight:700}
.nd.mut{grid-column:1;grid-row:1}.nd.acc{grid-column:1;grid-row:2;background:var(--accent);color:#fff;border-color:var(--accent)}.nd.acc small,.nd.acc em{color:#fff}
.nd.em{grid-column:2;grid-row:1/3;background:var(--ink);color:#fff;text-align:center;padding:22px}.nd.em small,.nd.em em{color:#cfe}.nd.em .tk{font:800 36px var(--f-display)}
.nd.as{grid-column:3;grid-row:1/3;border-color:var(--accent);border-width:2px}
.nd.mut::after{content:'';position:absolute;left:50%;bottom:-14px;border:7px solid transparent;border-top-color:var(--muted)}
.nd.acc::after,.nd.as::before{content:'➜';position:absolute;font-size:26px;color:var(--accent)}
.nd.acc::after{right:-34px;top:50%;transform:translateY(-50%)}.nd.as::before{left:-34px;top:50%;transform:translateY(-50%) scaleX(-1)}
.tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.tiles>div{padding:16px;border-radius:10px;background:var(--sheet);border:1px solid var(--rule);position:relative;overflow:hidden}
.tiles b{display:block;font:800 26px var(--f-display);color:var(--accent)}.tiles>div>span{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.tiles i{position:absolute;left:0;bottom:0;height:5px;background:var(--accent);transition:width 1.2s ease}.tiles i.mut{background:var(--muted)}.tiles i.good{background:var(--good)}
.kamus{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.kk{position:relative;min-height:96px;border:0;padding:0;background:none;cursor:pointer;perspective:600px;font:inherit;color:inherit}
.kk>span{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:12px;border-radius:10px;backface-visibility:hidden;transition:transform .5s}
.kk .f{background:var(--accent-soft);border:1px solid var(--rule)}.kk .f b{font:800 20px var(--f-display);color:var(--accent)}.kk .f small{color:var(--ink-2)}
.kk .bk{background:var(--ink);color:#fff;font-size:13px;transform:rotateY(180deg)}
.kk.flip .f{transform:rotateY(180deg)}.kk.flip .bk{transform:rotateY(360deg)}
.aset{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.ak{display:flex;flex-direction:column;gap:4px;padding:18px 12px;border-radius:12px;border:1px solid var(--rule);background:var(--sheet);cursor:pointer;text-align:center;font:inherit;color:inherit;transition:transform .2s}
.ak:hover{transform:translateY(-3px)}.ak b{font:800 24px var(--f-display);color:var(--accent)}.ak span{font:700 12px var(--f-display);text-transform:uppercase;letter-spacing:.08em}
.ak small{font-size:12px;color:var(--ink-2);text-align:left}.ak em{font-style:normal;font-size:12px;color:var(--muted)}
.tl{position:relative;height:70px;margin:20px 22px 0}
.tl .bar{position:absolute;left:0;right:0;top:28px;height:8px;border-radius:4px;background:var(--rule)}.tl .bar i{display:block;height:100%;border-radius:4px;background:var(--good);transition:width 1.4s}
.mt{position:absolute;top:14px;transform:translateX(-50%);width:36px;height:36px;border-radius:50%;border:2px solid var(--muted);background:var(--sheet);font:700 14px var(--f-display);color:var(--muted);cursor:pointer}
.mt.ok{background:var(--good);border-color:var(--good);color:#fff}.mt.on{box-shadow:0 0 0 4px var(--accent-soft);transform:translateX(-50%) scale(1.15)}
.det2{margin:6px 0 0;padding:10px 14px;background:var(--sheet);border-radius:4px;font-size:14px}
.sl{display:block;margin-bottom:14px}.sl input{width:100%;margin-top:8px;accent-color:var(--accent)}
.sk{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:end}
.kc{display:flex;flex-direction:column;align-items:center;gap:2px;padding:16px;border-radius:12px;border:2px solid;background:var(--sheet)}
.kc.bear{border-color:var(--strong,#c2410c);min-height:180px}.kc.base{border-color:var(--accent);min-height:210px}.kc.bull{border-color:var(--good);min-height:240px}
.kc small{font:700 13px var(--f-display);letter-spacing:.15em}.kc b{font:800 26px var(--f-display)}.kc em{font-style:normal;font-weight:700}
.kc.bear em{color:var(--strong,#c2410c)}.kc.base em{color:var(--accent)}.kc.bull em{color:var(--good)}
.kc strong{margin-top:10px;font:800 20px var(--f-display)}.kc span{font-size:12px;color:var(--muted)}
.note{font-size:12px;color:var(--muted);margin-top:10px}
.peta{position:relative;height:140px;margin:30px 50px 10px}
.peta .garis{position:absolute;left:0;right:0;top:60px;height:6px;border-radius:3px;background:linear-gradient(90deg,var(--strong,#c2410c),var(--warn),var(--good))}
.lv,.now{position:absolute;top:0;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;font-size:11px;text-align:center}
.lv i,.now i{width:14px;height:14px;border-radius:50%;margin-top:56px;border:3px solid #fff;box-shadow:0 0 0 1px var(--rule)}
.lv span{order:-1;margin-bottom:-60px;transform:translateY(-6px)}
.lv:nth-child(even) span{order:1;margin:6px 0 0;transform:none}
.lv.bad i{background:var(--strong,#c2410c)}.lv.acc i{background:var(--accent)}.lv.mut i{background:var(--muted)}.lv.warn i{background:var(--warn)}.lv.good i{background:var(--good)}
/* Harga kini: label di atas garis (level lain bergantian atas/bawah) agar tidak bertumpuk. */
.now{z-index:1}.now i{width:22px;height:22px;margin-top:0;background:var(--ink)}
.now span{order:-1;height:44px;display:flex;flex-direction:column;justify-content:flex-end;margin-bottom:5px;font-weight:700;background:var(--paper,#f4f6f3);padding:0 4px}
.tabs2{display:flex;gap:8px;margin-bottom:10px}
.tabs2 button{padding:8px 16px;border-radius:20px;border:2px solid var(--rule);background:var(--sheet);font:700 14px var(--f-display);cursor:pointer;color:inherit}
.tabs2 .g[aria-selected=true]{border-color:var(--good);background:var(--good);color:#fff}.tabs2 .r[aria-selected=true]{border-color:var(--strong,#c2410c);background:var(--strong,#c2410c);color:#fff}
.kr{margin:0;padding:0;list-style:none;counter-reset:k}
.kr li{counter-increment:k;display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--rule-2)}
.kr li::before{content:counter(k);flex:none;display:grid;place-items:center;width:30px;height:30px;border-radius:50%;color:#fff;font-weight:700}
.kr.katalis li::before{background:var(--good)}.kr.risiko li::before{background:var(--strong,#c2410c)}
.rk{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:12px}
.rk>div{padding:16px;border-radius:12px;background:var(--sheet);border:1px solid var(--rule)}
.rk small{font:700 11px var(--f-display);letter-spacing:.14em;color:var(--muted)}.rk b{display:block;font:800 20px var(--f-display);margin-top:4px}
.rk .act{color:#fff;border:0}.rk .act small{color:#fff;opacity:.85}.rk .act.good{background:var(--good)}.rk .act.warn{background:#c7900e}.rk .act.bad{background:var(--strong,#c2410c)}
@media (max-width:760px){
  .kpi4,.tiles,.kamus,.aset,.rk{grid-template-columns:repeat(2,minmax(0,1fr))}
  .dg{grid-template-columns:1fr;gap:12px}.nd.mut,.nd.acc,.nd.em,.nd.as{grid-column:1;grid-row:auto}
  .nd::after,.nd::before{display:none}.panah{display:none}.sk{grid-template-columns:1fr}.peta{margin:30px 24px 10px}
}
</style>
