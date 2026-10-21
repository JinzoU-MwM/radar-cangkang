<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { store, saveItem, toast, loadKandidat, autoKandidat, hideKandidat, unhideKandidat } from '../store.js'
import { SIGNALS, stageOf, scoreOf, fmtDate, num } from '../lib/domain.js'

// Label kolom pendek untuk header sempit; label lengkap di title.
const HEAD = { akuisisi: 'Ganti pengendali', kbli: 'Ubah usaha', smallcap: 'Mcap <500 M', lowprice: 'Harga maks. 100', uma: 'UMA / suspensi', volume: 'Volume aneh' }
const AUTO_SRC = { smallcap: 'mcap', lowprice: 'price' }
const today = () => new Date().toISOString().slice(0, 10)
const shortDate = d => new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })

// Kandidat otomatis: perpindahan blok pemegang saham besar, rights issue, UMA, dan berita seluruh BEI
// (dihitung server), digabung dengan yang dilacak manual.
const auto = store.kandidat
onMounted(loadKandidat)
const autoRows = computed(autoKandidat)
const rows = computed(() => [...store.items.filter(i => stageOf(i) === 'radar'), ...autoRows.value]
  .sort((a, b) => scoreOf(b) - scoreOf(a) || a.ticker.localeCompare(b.ticker)))
// Baris otomatis disimpan ke database begitu dilacak, dicatat, atau dipindah.
const plain = item => { const { auto: _a, ...rest } = item; return { ...rest, updatedAt: new Date().toISOString() } }

// Status sel: catatan temuan bila ada; sinyal otomatis dari data pasar; flag lama tanpa catatan = aktif tanpa tanggal.
function cellOf(item, s) {
  const v = item.signals?.[s.id]
  if (v?.st) return v
  if (s.auto) return num(item[AUTO_SRC[s.id]]) == null ? { st: 'unk' } : { st: s.auto(item) ? 'on' : 'none', auto: true }
  if (item.flags?.[s.id]) return { st: 'on' }
  return { st: 'unk' }
}
const weekAgo = () => new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)
function cellView(item, s) {
  const c = cellOf(item, s)
  const text = c.st === 'unk' ? 'cek' : c.st === 'none' ? '–' : c.d ? shortDate(c.d) : c.auto ? 'otomatis' : 'aktif'
  const state = { on: 'aktif', void: 'batal', none: 'tidak ada', unk: 'belum dicek' }[c.st]
  return { cls: [c.st, c.st === 'on' && c.d && c.d >= weekAgo() ? 'fresh' : ''], text, aria: `${s.label}: ${state}${c.d ? ' ' + fmtDate(c.d) : ''}` }
}

const sel = ref(null) // { t, id }
const selItem = computed(() => sel.value && rows.value.find(i => i.ticker === sel.value.t))
const selSig = computed(() => sel.value && SIGNALS.find(s => s.id === sel.value.id))
const selCell = computed(() => selItem.value && cellOf(selItem.value, selSig.value))
const form = reactive({ d: today(), text: '', src: '' })
const saving = ref(false)

function pick(item, s) {
  sel.value = { t: item.ticker, id: s.id }
  Object.assign(form, { d: today(), text: '', src: '' })
}

const emptyText = computed(() => {
  const c = selCell.value
  if (c.st === 'none' && !c.auto) return 'Ditandai tidak ada di keterbukaan informasi.'
  if (selSig.value.auto) return c.st === 'unk' ? 'Terisi sendiri dari harga dan kapitalisasi Stockbit setelah diperbarui.' : 'Dihitung dari harga dan kapitalisasi Stockbit.'
  if (c.st === 'on') return 'Ditandai aktif tanpa catatan bukti.'
  return `Belum dicek. Buka laporan keuangan dan keterbukaan informasi ${sel.value.t}, lalu isi tanggal temuan.`
})

async function record(st) {
  const item = selItem.value, id = sel.value.id
  const prev = item.signals?.[id] || {}
  const ev = [...(prev.ev || [])]
  if (form.text.trim()) ev.push({ d: form.d, text: form.text.trim(), src: form.src.trim() })
  const sig = { st, d: form.d || prev.d || today(), ev }
  // flags ikut disetel supaya scoreOf tetap benar.
  const next = { ...plain(item), signals: { ...item.signals, [id]: sig }, flags: { ...item.flags, [id]: st === 'on' }, updatedAt: new Date().toISOString() }
  saving.value = true
  try {
    await saveItem(next)
    form.text = ''; form.src = ''
  } catch (e) { toast('Gagal menyimpan temuan: ' + e.message, true) } finally { saving.value = false }
}

const newCode = ref('')
const codeErr = ref('')
async function track() {
  const t = newCode.value.trim().toUpperCase()
  codeErr.value = !/^[A-Z]{4}$/.test(t) ? 'Kode saham harus 4 huruf.' : store.items.some(i => i.ticker === t) ? `${t} sudah dilacak.` : ''
  if (codeErr.value) return
  try {
    await saveItem({ id: t, ticker: t, name: '', stage: 'radar', flags: {}, ms: {}, signals: {}, updatedAt: new Date().toISOString() })
    newCode.value = ''
    toast(`${t} masuk daftar kandidat.`)
  } catch (e) { toast('Gagal menambah kode: ' + e.message, true) }
}

async function keep(item) {
  try {
    await saveItem(plain(item))
    toast(`${item.ticker} disimpan ke daftar kandidat.`)
  } catch (e) { toast('Gagal menyimpan: ' + e.message, true) }
}

async function hide(item) {
  try {
    await hideKandidat(item)
    if (sel.value?.t === item.ticker) sel.value = null
    toast(`${item.ticker} disembunyikan dari kandidat.`)
  } catch (e) { toast('Gagal menyembunyikan: ' + e.message, true) }
}
async function unhide(h) {
  try {
    await unhideKandidat(h)
    toast(`${h.ticker} dikembalikan ke kandidat.`)
  } catch (e) { toast('Gagal memulihkan: ' + e.message, true) }
}

async function promote(item) {
  try {
    await saveItem({ ...plain(item), stage: 'spa', ms: { ...item.ms, spa: true }, updatedAt: new Date().toISOString() })
    if (sel.value?.t === item.ticker) sel.value = null
    toast(`${item.ticker} dipindah ke Monitor.`)
  } catch (e) { toast('Gagal memindah: ' + e.message, true) }
}
</script>

<template>
  <div class="kand">
    <header class="head">
      <h1>Kandidat</h1>
      <form v-if="!store.status?.readOnly" class="add" aria-label="Lacak emiten baru" @submit.prevent="track">
        <div class="fld">
          <label for="addk" class="small muted">Lacak kode baru</label>
          <input id="addk" v-model="newCode" class="field code" type="text" placeholder="ABCD" maxlength="4" autocomplete="off"
            :aria-invalid="!!codeErr" aria-describedby="addk-err">
        </div>
        <button type="submit" class="btn primary">Lacak</button>
        <span id="addk-err" class="err small" role="alert">{{ codeErr }}</span>
      </form>
    </header>

    <section aria-labelledby="ledH" class="rule-top sec">
      <div class="legend-row">
        <h2 id="ledH">Buku sinyal</h2>
        <p v-if="auto.asOf" class="small muted asof">Pindaian otomatis {{ fmtDate(auto.asOf.slice(0, 10)) }} {{ auto.asOf.slice(11, 16) }} · {{ autoRows.length }} kandidat otomatis</p>
        <div class="legend small muted">
          <span><i class="sw fresh"></i> 7 hari terakhir</span>
          <span><s>tanggal</s> batal</span>
          <span><i class="sw unk"></i> belum dicek</span>
          <span>– tidak ada</span>
        </div>
      </div>
      <div class="sheet box">
        <table class="ledger">
          <thead><tr>
            <th class="lbl kode">Kode</th>
            <th class="lbl skor">Skor</th>
            <th v-for="s in SIGNALS" :key="s.id" class="lbl sg" :title="s.label">{{ HEAD[s.id] || s.short }}<br><span class="w">{{ s.w }}</span></th>
            <th class="lbl"><span class="sr-only">Aksi</span></th>
          </tr></thead>
          <tbody>
            <tr v-for="item in rows" :key="item.ticker">
              <td class="kode"><span class="ticker big">{{ item.ticker }}</span><span v-if="item.auto" class="tag small" title="Ditemukan otomatis dari data seluruh BEI">otomatis</span><div v-if="item.name" class="small muted nm">{{ item.name }}</div></td>
              <td>
                <div class="score">{{ scoreOf(item) }}<span> /100</span></div>
                <div class="sbar" aria-hidden="true"><i :style="{ width: scoreOf(item) + '%' }"></i></div>
              </td>
              <td v-for="s in SIGNALS" :key="s.id" class="cellt">
                <button v-for="v in [cellView(item, s)]" :key="s.id" type="button" class="cell" :class="[...v.cls, { picked: sel?.t === item.ticker && sel?.id === s.id }]"
                  :aria-label="v.aria" :aria-pressed="String(sel?.t === item.ticker && sel?.id === s.id)" @click="pick(item, s)">{{ v.text }}</button>
              </td>
              <td class="rowacts"><template v-if="!store.status?.readOnly">
                <button v-if="item.auto" type="button" class="btn small" @click="keep(item)">Simpan</button>
                <button v-if="item.auto" type="button" class="btn small quiet" :aria-label="'Sembunyikan ' + item.ticker" @click="hide(item)">Sembunyikan</button>
                <button type="button" class="btn small" @click="promote(item)">Pindah ke Monitor</button>
              </template></td>
            </tr>
            <tr v-if="!rows.length">
              <td :colspan="SIGNALS.length + 3" class="muted empty">{{ auto.loading ? 'Memindai perpindahan pemegang saham, rights issue, UMA, dan berita seluruh BEI…' : auto.error ? 'Kandidat otomatis gagal dimuat: ' + auto.error : 'Belum ada kandidat. Ketik kode di kanan atas untuk melacak manual.' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <details v-if="auto.hidden.length" class="hid small">
        <summary class="muted">{{ auto.hidden.length }} kandidat disembunyikan</summary>
        <ul>
          <li v-for="h in auto.hidden" :key="h.ticker">
            <span class="ticker">{{ h.ticker }}</span> <span class="muted">{{ h.name }}</span>
            <button v-if="!store.status?.readOnly" type="button" class="btn small" @click="unhide(h)">Pulihkan</button>
          </li>
        </ul>
      </details>
    </section>

    <section v-if="selItem && selSig" aria-labelledby="evH" class="rule-top sec ev-grid">
      <div>
        <h2 id="evH">{{ sel.t }} · {{ selSig.label }}</h2>
        <div class="small muted sub">{{ selItem.name || 'Nama belum ada' }} · bobot {{ selSig.w }}</div>
        <div v-for="(e, i) in selCell.ev || []" :key="i" class="ev">
          <span class="ed">{{ e.d ? fmtDate(e.d) : 'tanpa tanggal' }}</span>
          <div>{{ e.text }}<div v-if="e.src" class="small muted">{{ e.src }}</div></div>
        </div>
        <p v-if="!selCell.ev?.length" class="muted none-ev">{{ emptyText }}</p>
      </div>
      <form v-if="!selSig.auto && !store.status?.readOnly" class="rec" @submit.prevent>
        <h3 class="lbl">Catat temuan</h3>
        <label class="small muted" for="ev-d">Tanggal</label>
        <input id="ev-d" v-model="form.d" type="date" class="field">
        <label class="small muted" for="ev-t">Temuan</label>
        <textarea id="ev-t" v-model="form.text" class="field ta" rows="3" placeholder="Apa yang diumumkan, oleh siapa"></textarea>
        <label class="small muted" for="ev-s">Sumber</label>
        <input id="ev-s" v-model="form.src" type="text" class="field" placeholder="Keterbukaan informasi, media">
        <div class="acts">
          <button type="button" class="btn primary" :disabled="saving" @click="record('on')">Tandai aktif</button>
          <button type="button" class="btn" :disabled="saving" @click="record('void')">Tandai batal</button>
          <button type="button" class="btn" :disabled="saving" @click="record('none')">Tidak ada</button>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.kand{display:flex;flex-direction:column;gap:22px}
.head{display:flex;flex-wrap:wrap;gap:12px 24px;align-items:flex-end;justify-content:space-between}
.add{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap}
.fld{display:flex;flex-direction:column;gap:3px}
.code{width:110px;font:700 17px var(--f-display);letter-spacing:.06em;text-transform:uppercase}
.err{color:var(--strong);flex-basis:100%;text-align:right}
.err:empty{display:none}
.sec{display:flex;flex-direction:column;gap:10px}
.legend-row{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:baseline}
.legend{display:flex;gap:14px;flex-wrap:wrap}
.sw{display:inline-block;width:12px;height:12px;border:1px solid var(--rule);vertical-align:-2px}
.sw.fresh{background:var(--now-bg)}
.sw.unk{background:repeating-linear-gradient(135deg,var(--sheet) 0 3px,var(--rule) 3px 4px)}
.box{overflow-x:auto}
.kode{padding-left:14px;width:84px}
.big{font-size:20px}
.nm{max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kode .tag{margin-left:6px;vertical-align:3px;background:var(--accent-soft);color:var(--accent);font-size:10.5px;padding:0 5px}
.rowacts{white-space:nowrap}
.rowacts .btn+.btn{margin-left:6px}
.asof{margin:0;flex-basis:100%}
.quiet{color:var(--ink-2);border-color:transparent;background:transparent}
.quiet:hover{color:var(--ink);border-color:var(--rule)}
.hid summary{cursor:pointer;padding:4px 0}
.hid ul{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}
.hid li{display:flex;gap:10px;align-items:center}
.skor{width:96px}
.sg{width:76px;font-size:11.5px;line-height:1.15;white-space:normal}
.w{font:700 13px var(--f-display);color:var(--ink)}
.score{font:700 20px/1 var(--f-display)}
.score span{font-size:13px;color:var(--ink-2);font-weight:600}
.sbar{height:3px;background:var(--rule-2);margin-top:4px}
.sbar i{display:block;height:3px;background:var(--ink)}
.ledger td.cellt{padding:0}
.cell{display:block;width:100%;height:48px;border:0;border-left:1px solid var(--rule-2);background:none;font:600 13px var(--f-body);color:var(--ink);cursor:pointer;padding:0 6px;text-align:left}
.cell:hover{background:var(--accent-soft)}
.cell.fresh{background:var(--now-bg);color:var(--now-ink)}
.cell.void{color:var(--ink-2);text-decoration:line-through}
.cell.none{color:var(--ink-2);font-weight:500;opacity:.75}
.cell.unk{color:var(--ink-2);font-weight:500;background:repeating-linear-gradient(135deg,transparent 0 6px,var(--rule-2) 6px 7px)}
.cell.picked{box-shadow:inset 0 0 0 2px var(--accent)}
.btn.small{min-height:30px;font-size:12.5px;white-space:nowrap}
.empty{padding:14px}
.ev-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px}
.sub{margin:4px 0 6px}
.ev{display:grid;grid-template-columns:96px 1fr;gap:2px 14px;padding:10px 0;border-top:1px solid var(--rule-2)}
.ed{font:700 16px var(--f-display)}
.none-ev{margin:6px 0 0;border-top:1px solid var(--rule-2);padding-top:10px}
.rec{background:var(--sheet-2);border:1px solid var(--rule-2);border-radius:3px;padding:14px 16px;align-self:start;display:flex;flex-direction:column;gap:4px}
.rec h3{margin:0 0 4px}
.ta{padding:8px 12px;resize:vertical}
.acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
</style>
