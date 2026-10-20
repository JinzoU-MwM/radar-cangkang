<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { api } from '../../api.js'
import { store, itemOf } from '../../store.js'
import { big, fmt, fmtDate, num, pctTxt, rp, x2 } from '../../lib/domain.js'
import { MECH_LABEL, dilusi, flowOf, injSteps, kjppStatus, mechOf, peerMultiples, reservesOf, simDefaults, simKjpp, toM, txValue } from '../../lib/emitenExtra.js'
import { KURS } from '../../lib/analysis.js'
import Modal from './Modal.vue'

// Aset yang diinjeksi: aset-verified.json (27 emiten) + relasi-verified.json → <T>.injeksi bila ada (NAYZ, lebih rinci).
const props = defineProps({ ticker: { type: String, required: true } })
const emit = defineEmits(['close'])

const a = computed(() => store.aset[props.ticker] || null)
const r = computed(() => store.relasi[props.ticker]?.injeksi || null)
const sv = computed(() => store.verified[props.ticker] || null)
const item = computed(() => itemOf(props.ticker))
const pa = computed(() => store.pandangan[props.ticker] || null)
const af = computed(() => store.profil[props.ticker]?.afiliasi || null)

const ast = computed(() => a.value?.aset || {})
const fin = computed(() => ast.value.keuangan || {})
const k = computed(() => a.value?.kjpp || {})
const ks = computed(() => kjppStatus(a.value?.kjpp))
const mcapRp = computed(() => num(item.value?.mcap) != null ? num(item.value.mcap) * 1e9 : null)
const val = computed(() => txValue(a.value, sv.value))
const title = computed(() => r.value?.judul || ast.value.nama || sv.value?.injectTarget || 'Data aset belum ada')
const sub = computed(() => r.value?.sub || [ast.value.jenis, ast.value.sektor, ast.value.lokasi].filter(Boolean).join(' · '))

const FIN = [['pendapatan', 'Pendapatan'], ['ebitda', 'EBITDA'], ['labaBersih', 'Laba bersih'], ['totalAset', 'Total aset'], ['ekuitas', 'Ekuitas'], ['utang', 'Utang']]
const hasFin = computed(() => FIN.some(([f]) => fin.value[f] != null))
const TB = [['cadangan', 'Cadangan'], ['sumberDaya', 'Sumber daya'], ['kalori', 'Kalori'], ['produksi', 'Produksi'], ['iup', 'Izin']]

// Bagan mekanisme transaksi.
const kc = computed(() => pa.value?.kalkulator || {})
const executed = computed(() => !!(kc.value.sudahTereksekusi || sv.value?.executed))
const mech = computed(() => mechOf(a.value, sv.value))
const pubText = computed(() => {
  const dl = pa.value?.dilusi || {}, f = num(item.value?.float)
  if (executed.value) return f != null ? `porsi publik kini ${fmt(f, 1)}%` : ''
  return dl.berlaku && dl.porsiPublikSetelah != null ? `porsi publik ${fmt(dl.porsiPublikSekarang ?? f ?? 0, 1)}% → ${fmt(dl.porsiPublikSetelah, 1)}%` : ''
})
const flow = computed(() => (a.value || sv.value?.injectType) ? flowOf({
  t: props.ticker, mech: mech.value, aset: a.value, sv: sv.value, ctrlName: item.value?.ctrlName || item.value?.acquirer,
  owner: String(af.value?.pemilikAset || '').slice(0, 34), hargaPelaksanaan: kc.value.hargaPelaksanaan, pubText: pubText.value,
}) : null)
const steps = computed(() => injSteps(mech.value, { sv: sv.value, ms: item.value?.ms || {} }))
const flowLabel = computed(() => flow.value ? [...flow.value.boxes.map(b => `${b.t1} (${b.t2})`), ...flow.value.arrows.map(x => x.lines.join(' '))].join('; ') : '')

// Simulasi nilai KJPP: isian Rp miliar; kelipatan pembanding dari Stockbit.
const si = reactive({ tx: null, porsi: 100, laba: null, pend: null, eq: null, res: null, usdTon: null, per: null, ps: null, pbv: null })
const sd = computed(() => simDefaults(a.value, sv.value))
Object.assign(si, Object.fromEntries(Object.entries(sd.value).filter(([key]) => key in si)))
const res = computed(() => reservesOf(ast.value.tambang))
const mining = computed(() => res.value || /tambang|batu bara|nikel/i.test(ast.value.sektor || ''))
const sim = computed(() => simKjpp(si))
const peers = computed(() => (a.value?.pembanding || []).filter(t => /^[A-Z]{4}$/.test(t)).slice(0, 5))
const peerNote = ref('')
const prof = ref(null)
const SIM_IN = computed(() => [
  ['tx', 'Nilai transaksi diumumkan (Rp miliar)', 'nilai yang dibayar/diinbrengkan'],
  ['porsi', 'Porsi diambil (%)', 'bagian aset yang masuk'],
  ['laba', 'Laba bersih aset 100% (Rp miliar/tahun)', perHint.value],
  ['pend', 'Pendapatan aset 100% (Rp miliar/tahun)', perHint.value],
  ['eq', 'Ekuitas aset 100% (Rp miliar)', 'nilai buku'],
  ...(mining.value ? [['res', 'Cadangan aset 100% (juta ton)', res.value ? res.value.kind : 'isi bila diketahui'],
    ['usdTon', 'Nilai per ton cadangan (USD/ton)', 'asumsi Anda; kosongkan bila tidak yakin']] : []),
  ['per', 'PER pembanding (×)', peerNote.value],
  ['ps', 'P/S pembanding (×)', peerNote.value],
  ['pbv', 'PBV pembanding (×)', peerNote.value],
])
const perHint = computed(() => fin.value.periode ? `${fin.value.periode}${sd.value.af !== 1 ? ` · disetahunkan ×${fmt(sd.value.af, 2)}` : ''}` : 'isi bila diketahui')

// Dampak ke saham emiten: saham baru, porsi publik, nilai buku per saham.
const dl = reactive({ V: toM(kc.value.nilaiDibayarSaham ?? val.value) ?? 0, C: toM(kc.value.kasSegar) ?? 0,
  P: kc.value.hargaPelaksanaan || item.value?.tender?.price || num(item.value?.price) || 0, T: 0 })
const base = computed(() => {
  // Stockbit dulu, lalu data radar, lalu angka di pandangan analis.
  const st = prof.value?.stats || {}, pd = pa.value?.dilusi || {}, price = num(item.value?.price) ?? pa.value?.hargaAcuan ?? null
  const S0 = st.shares ?? pd.sahamSekarang ?? (mcapRp.value && price ? mcapRp.value / price : null)
  return { S0, E0: prof.value?.metrics?.equity ?? 0, f: (st.freeFloat ?? num(item.value?.float) ?? pd.porsiPublikSekarang ?? 0) / 100, price }
})
const out = computed(() => {
  const b = base.value, V = (+dl.V || 0) * 1e9, C = (+dl.C || 0) * 1e9
  const d = dilusi({ S0: b.S0, E0: b.E0, f: b.f, V, C, P: +dl.P, tk: (+dl.T || 0) / 100, h: 1 })
  if (!d) return null
  // Nilai buku per saham bila aset bernilai sebesar nilai tengah simulasi (bukan nilai transaksi).
  const vpsSim = sim.value.mid != null ? ((b.E0 || 0) + sim.value.mid + C) / d.S1 : null
  return { ...d, vpsSim }
})
const DL_IN = [['V', 'Nilai dibayar dengan saham baru (Rp miliar)', 'inbreng / konversi utang'], ['C', 'Kas segar masuk (Rp miliar)', 'setoran tunai HMETD'],
  ['P', 'Harga pelaksanaan (Rp)', 'harga saham baru'], ['T', 'Publik menebus (%)', '0 = publik tidak ikut']]
const useMid = () => { if (sim.value.mid != null) dl.V = toM(sim.value.mid) }

onMounted(async () => {
  peerNote.value = peers.value.length ? 'memuat pembanding…' : 'isi manual'
  const [own, ...ps] = await Promise.all([props.ticker, ...peers.value].map(t => api.get('/api/profile', { ticker: t }).catch(() => null)))
  prof.value = own
  if (!peers.value.length) return
  const m = peerMultiples(ps)
  for (const key of ['per', 'ps', 'pbv']) if (m[key] != null && si[key] == null) si[key] = Math.round(m[key] * 100) / 100
  peerNote.value = m.n ? `median ${m.n} pembanding Stockbit` : 'data pembanding kosong'
})
const fid = key => `sim-${props.ticker}-${key}`
const sources = computed(() => [...(a.value?.sumber || []).map(t => ({ t })), ...(r.value?.sumber || [])])
</script>

<template>
  <Modal labelledby="injTitle" close-label="Tutup data aset" @close="emit('close')">
    <template #title>
      <div class="lbl">Aset yang diinjeksi ke {{ ticker }}</div>
      <h2 id="injTitle" class="t">{{ title }}</h2>
      <div v-if="sub" class="small muted">{{ sub }}</div>
      <div v-if="a" class="tags"><span class="tag" :class="'t-' + ks.tone">{{ ks.label }}</span><span v-if="ast.porsi" class="tag t-calm">porsi {{ ast.porsi.split(/[(;]/)[0].trim() }}</span></div>
    </template>

    <p v-if="!a && !r" class="muted">Data aset untuk {{ ticker }} belum ada.</p>

    <template v-if="a">
      <section class="sec">
        <h3 class="lbl">Aset dan transaksi</h3>
        <p v-if="ast.deskripsi" class="desc">{{ ast.deskripsi }}</p>
        <dl class="kv">
          <div><dt>Nilai transaksi</dt><dd><b>{{ val ? big(val) : 'belum ada' }}</b><template v-if="val && mcapRp"> · {{ x2(val / mcapRp) }} kapitalisasi {{ ticker }}</template>
            <div v-if="a.transaksi?.nilai" class="small muted">{{ a.transaksi.nilai }}</div></dd></div>
          <div><dt>Cara bayar</dt><dd>{{ a.transaksi?.caraBayar || 'belum ada' }}</dd></div>
          <div><dt>Porsi</dt><dd>{{ ast.porsi || 'belum ada' }}</dd></div>
          <template v-for="[f, l] in TB" :key="f"><div v-if="ast.tambang?.[f]"><dt>{{ l }}</dt><dd>{{ ast.tambang[f] }}</dd></div></template>
          <div v-if="a.pembanding?.length"><dt>Pembanding</dt><dd>{{ a.pembanding.join(', ') }}</dd></div>
        </dl>
        <template v-if="hasFin">
          <h4 class="lbl sub">Keuangan aset target<template v-if="fin.periode"> · {{ fin.periode }}</template></h4>
          <table class="ledger">
            <tbody><tr v-for="[f, l] in FIN" :key="f"><td>{{ l }}</td><td class="r num" :class="{ muted: fin[f] == null }">{{ fin[f] != null ? big(fin[f]) : 'belum ada' }}</td></tr></tbody>
          </table>
        </template>
        <p v-else class="small muted">Laporan keuangan aset target belum ada di sumber publik.</p>
      </section>

      <section class="sec">
        <h3 class="lbl">Status penilaian KJPP</h3>
        <dl class="kv">
          <div><dt>Status</dt><dd><span class="tag" :class="'t-' + ks.tone">{{ ks.label }}</span></dd></div>
          <div><dt>KJPP</dt><dd>{{ k.nama || 'belum ada' }}</dd></div>
          <div><dt>Tanggal laporan</dt><dd>{{ k.tanggalLaporan ? fmtDate(k.tanggalLaporan) : 'belum ada' }}<template v-if="k.cutOff"> · posisi {{ fmtDate(k.cutOff) }}</template></dd></div>
          <div><dt>Nilai</dt><dd>{{ k.nilai || (k.nilaiRp ? big(k.nilaiRp) : 'belum ada') }}</dd></div>
          <div><dt>Metode</dt><dd>{{ k.metode || 'belum ada' }}</dd></div>
          <div><dt>Kesimpulan</dt><dd>{{ k.kesimpulan || 'belum ada' }}</dd></div>
          <div v-if="k.dasar"><dt>Catatan</dt><dd class="warn">{{ k.dasar }}</dd></div>
          <div v-if="k.sumber"><dt>Sumber</dt><dd class="small">{{ k.sumber }}</dd></div>
        </dl>
      </section>
    </template>

    <section v-if="flow" class="sec">
      <h3 class="lbl">Bagan mekanisme transaksi</h3>
      <p class="small"><b>{{ MECH_LABEL[mech] }}</b></p>
      <div class="flow">
        <svg viewBox="0 0 900 250" role="img" :aria-label="'Bagan mekanisme ' + MECH_LABEL[mech] + ' ' + ticker + ': ' + flowLabel">
          <defs><marker :id="'fh-' + ticker" class="mk" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" /></marker></defs>
          <g v-for="(x, i) in flow.arrows" :key="'a' + i" class="arr" :class="x.cls">
            <line :x1="x.x1" :y1="x.y1" :x2="x.x2" :y2="x.y2" :marker-end="`url(#fh-${ticker})`" />
            <text :x="(x.x1 + x.x2) / 2" :y="/back/.test(x.cls) ? (x.y1 + x.y2) / 2 + 14 : (x.y1 + x.y2) / 2 - 7 - (x.lines.length - 1) * 12" text-anchor="middle">
              <tspan v-for="(ln, j) in x.lines" :key="j" :x="(x.x1 + x.x2) / 2" :dy="j ? 12 : 0">{{ ln }}</tspan>
            </text>
          </g>
          <g v-for="(b, i) in flow.boxes" :key="'b' + i" class="box" :class="b.cls">
            <rect :x="b.x" :y="b.y" :width="b.w" height="54" rx="3" />
            <text :x="b.x + b.w / 2" :y="b.y + 23" text-anchor="middle" class="t1">{{ b.t1 }}</text>
            <text :x="b.x + b.w / 2" :y="b.y + 41" text-anchor="middle" class="t2">{{ b.t2 }}</text>
          </g>
        </svg>
      </div>
      <ol class="steps">
        <li v-for="s in steps" :key="s.t" :class="{ done: s.done }"><span class="sr-only">{{ s.done ? 'sudah' : 'belum' }}:</span>{{ s.t }}</li>
      </ol>
    </section>

    <section v-if="a" class="sec">
      <h3 class="lbl">Simulasi nilai KJPP <span class="tag t-warn">simulasi</span></h3>
      <p class="small muted">
        <template v-if="ks.id === 'terbit'">Penilaian KJPP resmi tersedia<template v-if="k.nilaiRp"> ({{ big(k.nilaiRp) }})</template>. Simulasi di bawah sebagai pembanding.</template>
        <template v-else-if="ks.id === 'ditunjuk'">KJPP<template v-if="k.nama"> {{ k.nama }}</template> sudah ditunjuk dan laporannya belum terbit. Simulasi ini memperkirakan hasilnya.</template>
        <template v-else>Belum ada laporan penilaian KJPP. Simulasi memperkirakan nilai wajar dengan pendekatan penilai.</template>
        Angka di sini tidak resmi dan tidak menambah progress.
      </p>
      <div class="inputs">
        <label v-for="[key, label, hint] in SIM_IN" :key="key" class="in" :for="fid(key)">
          <span class="small">{{ label }}</span>
          <input :id="fid(key)" v-model.number="si[key]" class="field" type="number" step="any">
          <em class="small muted">{{ hint }}</em>
        </label>
      </div>
      <p v-if="sim.implied" class="small">Nilai transaksi tersirat <b>Rp{{ fmt(Math.round(sim.implied)) }}/ton</b> (sekitar USD{{ fmt(sim.implied / KURS.USD, 2) }}/ton) atas {{ fmt(si.res * sim.por, 1) }} juta ton porsi yang masuk.</p>
      <p v-if="sim.mid == null" class="note">
        <template v-if="si.laba > 0 || si.pend > 0 || si.eq > 0">Belum bisa disimulasikan: kelipatan pembanding (PER, P/S, atau PBV) belum ada. Isi salah satunya di atas.</template>
        <template v-else>Belum bisa disimulasikan: data keuangan aset target (laba, pendapatan, atau ekuitas) belum diungkap<template v-if="mining">, dan nilai per ton cadangan belum diisi</template>. Isi angkanya di atas sebagai skenario.</template>
      </p>
      <template v-else>
        <table class="ledger">
          <tbody>
            <tr v-for="x in sim.rows" :key="x.k"><td><b>{{ x.k }}</b><div class="small muted">{{ x.how }} · porsi {{ fmt(sim.por * 100) }}%</div></td><td class="r num">{{ big(x.v) }}</td></tr>
            <tr class="tot"><td><b>Kisaran nilai wajar simulasi</b><div class="small muted">nilai tengah ±25%</div></td><td class="r num">{{ big(sim.lo) }} – {{ big(sim.hi) }}</td></tr>
            <tr v-if="sim.tx"><td><b>Nilai transaksi diumumkan</b></td><td class="r num">{{ big(sim.tx) }}</td></tr>
          </tbody>
        </table>
        <p class="verdict" :class="'v-' + sim.verdict.tone">{{ sim.verdict.t }}</p>
        <p class="small muted">Keyakinan simulasi <b>{{ sim.conf }}</b> ({{ sim.rows.length }} pendekatan punya data). Kelipatan pembanding belum memasukkan premi kendali atau merek strategis yang biasa dipakai penilai.</p>
      </template>

      <h4 class="lbl sub">Dampak ke saham {{ ticker }}</h4>
      <p v-if="executed" class="small muted">Penerbitan saham baru sudah tereksekusi, jadi jumlah saham dan porsi publik saat ini sudah memuat dilusinya.</p>
      <template v-else>
        <div class="inputs">
          <label v-for="[key, label, hint] in DL_IN" :key="key" class="in" :for="fid('d' + key)">
            <span class="small">{{ label }}</span>
            <input :id="fid('d' + key)" v-model.number="dl[key]" class="field" type="number" step="any" min="0">
            <em class="small muted">{{ hint }}</em>
          </label>
        </div>
        <button v-if="sim.mid != null" type="button" class="btn" @click="useMid">Pakai nilai tengah simulasi ({{ big(sim.mid) }})</button>
        <p v-if="!base.S0" class="small muted">Jumlah saham {{ ticker }} belum ada, jadi dilusi belum bisa dihitung.</p>
        <p v-else-if="!out" class="small muted">Isi harga pelaksanaan.</p>
        <dl v-else class="out" aria-live="polite">
          <div><dt>Saham baru</dt><dd><b>{{ fmt(out.N / 1e6) }} jt</b><span>{{ x2(out.N / out.S0) }} saham sekarang</span></dd></div>
          <div><dt>Porsi publik</dt><dd><b>{{ fmt(out.pubAfter * 100, 2) }}%</b><span>dari {{ fmt(out.f * 100, 2) }}%</span></dd></div>
          <div><dt>Nilai buku per saham</dt><dd><b>{{ rp(out.vps) }}</b><span>aset diakui sebesar nilai dibayar<template v-if="base.price"> · {{ pctTxt(out.vps, base.price) }} vs harga {{ rp(base.price) }}</template></span></dd></div>
          <div v-if="out.vpsSim != null"><dt>Nilai buku per saham (simulasi)</dt><dd><b>{{ rp(out.vpsSim) }}</b><span>aset diakui sebesar nilai tengah simulasi<template v-if="base.price"> · {{ pctTxt(out.vpsSim, base.price) }}</template></span></dd></div>
        </dl>
        <p class="small muted">Model sederhana: hak tebus proporsional, nilai per saham = (ekuitas + aset diakui + kas) ÷ total saham.<template v-if="!prof"> Ekuitas {{ ticker }} dari Stockbit belum termuat, dihitung nol.</template></p>
      </template>
    </section>

    <template v-if="r">
      <section v-if="r.nilai?.length" class="sec">
        <h3 class="lbl">Nilai dan skema bayar</h3>
        <dl class="facts">
          <div v-for="n in r.nilai" :key="n.l"><dt class="lbl">{{ n.l }}</dt><dd class="v">{{ n.v }}</dd><dd class="s">{{ n.s }}</dd></div>
        </dl>
        <p v-if="r.nilaiCatatan">{{ r.nilaiCatatan }}</p>
      </section>

      <section v-if="r.valuasi?.baris?.length" class="sec">
        <h3 class="lbl">{{ r.valuasi.judul || 'Pembanding valuasi' }}</h3>
        <div v-for="b in r.valuasi.baris" :key="b.l" class="vrow">
          <div class="vh"><span>{{ b.l }}</span><b>{{ b.teks }}</b></div>
          <div class="bar" aria-hidden="true"><i :class="{ main: b.utama }" :style="{ width: (b.v / Math.max(...r.valuasi.baris.map(y => y.v)) * 100) + '%' }"></i></div>
        </div>
        <p v-if="r.valuasi.catatan" class="small muted">{{ r.valuasi.catatan }}</p>
      </section>

      <section v-if="r.kinerja" class="sec">
        <h3 class="lbl">{{ r.kinerja.judul || 'Kinerja keuangan' }}</h3>
        <p v-if="r.kinerja.peringatan || r.kinerja.peringatanTegas" class="alert"><b>{{ r.kinerja.peringatanTegas }}</b>{{ r.kinerja.peringatan }}</p>
        <div class="scroll">
          <table class="ledger">
            <thead><tr><th class="lbl">Data</th><th class="lbl">Isi</th><th class="lbl">Keandalan</th></tr></thead>
            <tbody>
              <tr v-for="x in r.kinerja.baris" :key="x.data">
                <td>{{ x.data }}</td>
                <td :class="{ muted: !x.isi }">{{ x.isi || 'belum ada' }}</td>
                <td :class="{ rendah: 'warn', 'sangat-rendah': 'strong' }[x.level] || 'muted'">{{ x.andal }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="r.operasional?.length" class="sec">
        <h3 class="lbl">Operasional</h3>
        <dl class="kv"><div v-for="o in r.operasional" :key="o.l"><dt>{{ o.l }}</dt><dd>{{ o.t }}</dd></div></dl>
      </section>

      <section v-if="r.dampak?.length" class="sec">
        <h3 class="lbl">Dampak ke {{ ticker }}</h3>
        <dl class="facts">
          <div v-for="n in r.dampak" :key="n.l"><dt class="lbl">{{ n.l }}</dt><dd class="v">{{ n.v }}</dd><dd class="s">{{ n.s }}</dd></div>
        </dl>
        <p v-if="r.dampakCatatan">{{ r.dampakCatatan }}</p>
      </section>

      <section v-if="r.dokumen?.length" class="sec">
        <h3 class="lbl">Dokumen yang ditunggu</h3>
        <ul><li v-for="x in r.dokumen" :key="x">{{ x }}</li></ul>
      </section>
    </template>

    <details v-if="a?.tidakDitemukan?.length" class="more">
      <summary>Data yang belum diungkap ({{ a.tidakDitemukan.length }})</summary>
      <ul class="small"><li v-for="x in a.tidakDitemukan" :key="x">{{ x }}</li></ul>
    </details>

    <section v-if="sources.length" class="sec">
      <h3 class="lbl">Sumber</h3>
      <ul class="small">
        <li v-for="s in sources" :key="s.t">
          <a v-if="s.url" :href="s.url" target="_blank" rel="noopener">{{ s.t }}</a><template v-else>{{ s.t }}</template>
          <template v-if="s.ket"> · {{ s.ket }}</template>
        </li>
      </ul>
      <p v-if="r?.asOf" class="small muted">Data relasi per {{ fmtDate(r.asOf) }}.</p>
    </section>
  </Modal>
</template>

<style scoped>
.t{font-size:30px;line-height:1.05;margin:2px 0}
.lbl{margin:0 0 6px}
.lbl.sub{margin:14px 0 6px}
.tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.sec{border-top:2px solid var(--ink);padding-top:10px}
.sec p{margin:8px 0 0;font-size:13px}
.desc{max-width:80ch}
.kv{margin:8px 0 0;font-size:13.5px}
.kv>div{display:grid;grid-template-columns:140px 1fr;gap:12px;padding:6px 0;border-bottom:1px solid var(--rule-2)}
.kv dt{font:600 12.5px var(--f-display);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2)}
.kv dd{margin:0;max-width:80ch}
.ledger{font-size:13px;margin-top:4px}
.r{text-align:right}
.num{font:700 15px var(--f-display);white-space:nowrap}
.tot td{border-top:1px solid var(--ink)}
.warn{color:var(--warn)}
.strong{color:var(--strong)}

/* Bagan alur: kotak pihak di atas lembar, panah tinta, label kecil. */
.flow{overflow-x:auto;margin-top:8px;border:1px solid var(--rule);background:var(--sheet-2)}
.flow svg{display:block;width:100%;min-width:640px;height:auto}
.box rect{fill:var(--sheet);stroke:var(--rule);stroke-width:1.2}
.box.em rect{stroke:var(--ink);stroke-width:2}
.box.as rect{fill:var(--good-bg);stroke:var(--good)}
.box.pub rect{fill:var(--calm-bg);stroke:var(--calm)}
.t1{font:700 15px var(--f-display);fill:var(--ink)}
.t2{font:500 12px var(--f-body);fill:var(--ink-2)}
.arr line{stroke:var(--ink-2);stroke-width:1.6}
.arr.dash line{stroke-dasharray:5 4}
.arr text{font:500 12px var(--f-body);fill:var(--ink)}
.mk path{fill:var(--ink-2)}
.steps{list-style:none;counter-reset:st;display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:2px;margin:10px 0 0;padding:0}
.steps li{counter-increment:st;font:600 12px/1.25 var(--f-display);text-transform:uppercase;letter-spacing:.04em;padding:6px 8px;border:1px dashed var(--rule);border-radius:2px;color:var(--ink-2)}
.steps li::before{content:counter(st) ". "}
.steps li.done{background:var(--accent);border:1px solid var(--accent);color:var(--accent-ink)}

.inputs{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:3px 14px;margin:10px 0}
/* Subgrid: label, isian, dan petunjuk sejajar antar kolom walau label terlipat. */
.in{display:grid;grid-template-rows:subgrid;grid-row:span 3;align-items:end;margin-bottom:8px}
.in em{align-self:start}
.in input{width:100%;font:700 16px var(--f-display)}
.in em{font-style:normal}
.note{padding:8px 12px;background:var(--warn-bg);color:var(--warn)}
.verdict{padding:8px 12px;font-weight:600}
.v-good{background:var(--good-bg);color:var(--good)}
.v-warn{background:var(--warn-bg);color:var(--warn)}
.v-strong{background:var(--strong-bg);color:var(--strong)}
.out{display:grid;grid-template-columns:repeat(2,1fr);margin:10px 0 0;border-top:1px solid var(--rule)}
.out div{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:7px 16px 7px 0;border-bottom:1px solid var(--rule-2)}
.out dt{color:var(--ink-2);font-size:13px}
.out dd{margin:0;text-align:right;display:flex;flex-direction:column}
.out dd b{font:700 17px var(--f-display);white-space:nowrap}
.out dd span{font-size:12px;color:var(--ink-2)}

/* Baris fakta bergaris dari relasi-verified: label, angka besar, keterangan. */
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin:0;border-top:1px solid var(--rule-2)}
.facts>div{padding:8px 12px 8px 0;border-bottom:1px solid var(--rule-2)}
.facts dt,.facts dd{margin:0}
.v{font:700 24px/1.1 var(--f-display)}
.s{font-size:12px;color:var(--ink-2)}
.vrow{margin:6px 0;font-size:13px}
.vh{display:flex;justify-content:space-between;gap:12px}
.bar{height:6px;background:var(--rule-2);border-radius:3px;margin-top:3px;overflow:hidden}
.bar i{display:block;height:100%;background:var(--rail-mute)}
.bar i.main{background:var(--accent)}
.alert{background:var(--strong-bg);padding:10px 14px;margin:0 0 8px!important}
.alert b{color:var(--strong)}
.scroll{overflow-x:auto}
.more summary{cursor:pointer;font-weight:600;min-height:28px}
ul{margin:0;padding-left:18px;font-size:13px}
li{margin:3px 0}
@media (max-width:760px){.kv>div{grid-template-columns:1fr;gap:2px}.out{grid-template-columns:1fr}}
</style>
