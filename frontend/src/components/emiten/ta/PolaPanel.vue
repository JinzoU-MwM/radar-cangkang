<script setup>
// Panel struktur harga di bawah chart: bias gabungan, pola chart aktif, candlestick, divergensi, Fibonacci, volume profile, zona volume.
import { computed } from 'vue'
import { structure, fibRead, PT_STATUS, PATTERNS, confLvl } from '../../../lib/patterns.js'
import { fmt, fmtDate, rp, pctTxt, x2 } from '../../../lib/domain.js'

const props = defineProps({
  bars: { type: Array, required: true },
  adv: { type: Object, required: true },
  lv: { type: Object, required: true },
  sel: { type: String, default: null },
})
const emit = defineEmits(['sel'])

const c = computed(() => props.bars[props.bars.length - 1].c)
const S = computed(() => structure(props.bars, props.adv, props.lv))
const histRows = computed(() => Object.entries(props.adv.hist).sort((a, b) => b[1].n - a[1].n))
const cdl = computed(() => props.adv.candles.slice(-8).reverse())
const d = i => fmtDate(props.bars[i].d)
const tone = b => b > 0 ? 't-good' : b < 0 ? 't-strong' : 't-calm'
const done = p => p.status === 'target' || p.status === 'failed' || p.status === 'expired'
const rr = p => (Math.abs(p.target - c.value) / (Math.abs(c.value - p.inv) || 1)).toFixed(1).replace('.', ',')
const pct1 = x => (x * 100).toFixed(1).replace('.', ',')
const vpRead = computed(() => {
  const vp = props.lv.vp
  return c.value > vp.vah ? 'Harga di atas area nilai: pembeli menguasai, VAH menjadi support pertama.'
    : c.value < vp.val ? 'Harga di bawah area nilai: penjual menguasai, VAL menjadi resistance pertama.'
    : 'Harga di dalam area nilai (seimbang); arah baru biasanya muncul setelah harga keluar dari VAH/VAL.'
})
</script>

<template>
  <div class="pp">
    <section class="struct" :class="'s-' + S.sig[1]">
      <h2>Struktur harga: {{ S.sig[0] }}</h2>
      <ul v-if="S.why.length">
        <li v-for="[w, t] in S.why.slice(0, 6)" :key="t">
          <svg viewBox="0 0 10 10" aria-hidden="true" :class="w > 0 ? 'up' : 'dn'"><path :d="w > 0 ? 'M5 1.5 9 8.5H1z' : 'M5 8.5 1 1.5h8z'"/></svg>{{ t }}
        </li>
      </ul>
      <p v-else class="small muted">Tidak ada pola, candlestick, atau divergensi aktif yang bermakna.</p>
    </section>

    <section class="rule-top">
      <h2>Pola chart aktif <span class="small muted">{{ adv.active.length }} terdeteksi dari candle harian 1 tahun</span></h2>
      <p v-if="!adv.active.length" class="small muted">Tidak ada pola chart yang sedang terbentuk atau aktif. Pola dicari di tiga skala swing (minor, menengah, mayor).</p>
      <div class="pts">
        <article v-for="p in [...adv.active, ...adv.recent]" :key="p.id" class="pt" :class="{ sel: sel === p.id, done: done(p) }">
          <header>
            <b class="cond">{{ p.name }}</b>
            <span class="tag" :class="tone(p.bias)">{{ p.bias > 0 ? 'Bullish' : 'Bearish' }} · {{ p.type }}</span>
            <span class="tag" :class="'t-' + PT_STATUS[p.status][1]">{{ p.statusTxt }}</span>
          </header>
          <p class="small muted">{{ p.desc }}</p>
          <table class="ledger">
            <tbody>
              <tr><td>Periode</td><td class="r" colspan="2">{{ d(p.start) }} – {{ d(p.e) }}</td></tr>
              <tr><td>Level {{ p.bias > 0 ? 'breakout' : 'breakdown' }}</td><td class="r num">{{ rp(p.trigNow) }}</td><td class="r muted">{{ done(p) ? '' : pctTxt(p.trigNow, c) }}</td></tr>
              <tr><td>Target</td><td class="r num c-good">{{ rp(p.target) }}<div v-if="p.target2" class="small muted">T2 {{ rp(p.target2) }}</div></td><td class="r muted">{{ done(p) ? '' : pctTxt(p.target, c) }}</td></tr>
              <tr><td>Invalidasi<div class="small muted">batal bila ditutup {{ p.bias > 0 ? 'di bawah' : 'di atas' }}</div></td><td class="r num c-strong">{{ rp(p.inv) }}</td><td class="r muted">{{ done(p) ? '' : pctTxt(p.inv, c) }}</td></tr>
              <tr v-if="done(p)"><td>Hasil</td><td class="r" colspan="2">{{ p.statusTxt }}{{ p.end != null ? ' · ' + d(p.end) : '' }}</td></tr>
              <tr v-else><td>Imbal-risiko dari harga kini</td><td class="r num" colspan="2">{{ rr(p) }} : 1</td></tr>
              <tr><td>Konfirmasi volume</td><td colspan="2" class="small muted r">{{ p.volTxt }}</td></tr>
            </tbody>
          </table>
          <div class="conf" :title="'Keyakinan dari kerapian bentuk, konteks tren, volume, riwayat pola di saham ini, dan likuiditas'">
            <span class="bar" aria-hidden="true"><i :style="{ width: p.conf + '%' }" :class="p.bias > 0 ? 'up' : 'dn'"></i></span>
            <span class="small">Keyakinan{{ done(p) ? ' saat terbentuk' : '' }} <b>{{ p.conf }}%</b> · {{ confLvl(p.conf) }}</span>
          </div>
          <ul class="why small">
            <li v-for="t in [...(p.info || []), ...p.notes]" :key="t">{{ t }}</li>
          </ul>
          <button class="btn" type="button" :aria-pressed="sel === p.id" @click="emit('sel', sel === p.id ? null : p.id)">{{ sel === p.id ? 'Tampilkan semua pola' : 'Sorot di chart' }}</button>
        </article>
      </div>
      <template v-if="histRows.length">
        <table class="ledger hist">
          <thead><tr><th class="lbl">Pola (1 tahun terakhir)</th><th class="lbl r">Selesai</th><th class="lbl r">Capai target</th><th class="lbl r">Rasio</th></tr></thead>
          <tbody>
            <tr v-for="[k, h] in histRows" :key="k"><td>{{ PATTERNS[k].n }}</td><td class="r">{{ h.n }}</td><td class="r">{{ h.hit }}</td><td class="r">{{ Math.round(h.hit / h.n * 100) }}%</td></tr>
          </tbody>
        </table>
        <p class="small muted">Sampel kecil (1 tahun); dipakai sebagai penyesuai keyakinan, bukan probabilitas pasti.</p>
      </template>
    </section>

    <div class="grid">
      <section class="rule-top">
        <h2>Pola candlestick terbaru</h2>
        <table v-if="cdl.length" class="ledger">
          <tbody>
            <tr v-for="k in cdl" :key="k.i">
              <td><b>{{ k.n }}</b> <span class="tag" :class="tone(k.bias)">{{ k.bias > 0 ? 'Bullish' : k.bias < 0 ? 'Bearish' : 'Netral' }}</span>
                <div class="small muted">{{ d(k.i) }} · {{ k.trend }}{{ k.loc ? ' · ' + k.loc : '' }} · volume {{ k.vx != null ? x2(k.vx) : '–' }} · {{ k.confirm }}</div></td>
              <td class="r num">{{ k.conf }}%</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="small muted">Belum ada pola candlestick dalam 120 hari terakhir.</p>
        <p class="small muted">Persentase = keyakinan: kekuatan pola, lokasi terhadap pita Bollinger, volume, konteks tren, dan konfirmasi hari berikutnya.</p>
      </section>
      <section class="rule-top">
        <h2>Divergensi RSI & MACD</h2>
        <table v-if="adv.divs.length" class="ledger">
          <tbody>
            <tr v-for="v in adv.divs" :key="v.ind + v.name" :class="{ dim: !v.active }">
              <td><b>{{ v.name }} · {{ v.ind }}</b> <span v-if="v.active" class="tag t-warn">Aktif</span>
                <div class="small muted">{{ d(v.a.i) }} ke {{ d(v.b.i) }}: harga {{ rp(v.a.p) }} ke {{ rp(v.b.p) }}, {{ v.ind }} {{ fmt(v.v1, v.ind === 'RSI' ? 0 : 2) }} ke {{ fmt(v.v2, v.ind === 'RSI' ? 0 : 2) }}. {{ v.d }}{{ v.both ? ' RSI & MACD sepakat.' : '' }} {{ v.ok ? 'Dikonfirmasi harga ' + d(v.ok) + '.' : 'Belum dikonfirmasi harga.' }}</div></td>
              <td class="r num">{{ v.conf }}%</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="small muted">Belum ada divergensi dalam 120 hari terakhir.</p>
      </section>
    </div>

    <div class="grid">
      <section class="rule-top">
        <h2>Fibonacci <span class="small muted">swing {{ lv.upSwing ? 'naik' : 'turun' }} {{ fmtDate(lv.upSwing ? lv.loD : lv.hiD) }} ke {{ fmtDate(lv.upSwing ? lv.hiD : lv.loD) }}</span></h2>
        <table class="ledger">
          <tbody>
            <tr v-for="f in lv.fib" :key="f.lbl" :class="{ hl: f === lv.below || f === lv.above }">
              <td>{{ f.lbl }}<span v-if="f.r === 0.618 || f.r === 0.5" class="small muted"> golden pocket</span>
                <span v-if="f === lv.below" class="tag t-good">support terdekat</span><span v-else-if="f === lv.above" class="tag t-strong">resistance terdekat</span></td>
              <td class="r num">{{ rp(f.p) }}</td><td class="r muted">{{ pctTxt(f.p, c) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="small muted">{{ fibRead(lv, c, adv.zones) }}</p>
      </section>
      <section class="rule-top">
        <h2>Volume profile <span class="small muted">rentang chart</span></h2>
        <table class="ledger">
          <tbody>
            <tr><td><b>POC</b><div class="small muted">harga dengan volume terbesar, cenderung menarik harga</div></td><td class="r num">{{ rp(lv.vp.pocP) }}</td><td class="r muted">{{ pctTxt(lv.vp.pocP, c) }}</td></tr>
            <tr><td><b>Value area atas (VAH)</b><div class="small muted">batas atas 70% volume</div></td><td class="r num">{{ rp(lv.vp.vah) }}</td><td class="r muted">{{ pctTxt(lv.vp.vah, c) }}</td></tr>
            <tr><td><b>Value area bawah (VAL)</b><div class="small muted">batas bawah 70% volume</div></td><td class="r num">{{ rp(lv.vp.val) }}</td><td class="r muted">{{ pctTxt(lv.vp.val, c) }}</td></tr>
            <tr v-for="nd in lv.vp.nodes.slice(0, 4)" :key="nd.k">
              <td>{{ nd.kind === 'HVN' ? 'High Volume Node (HVN)' : 'Low Volume Node (LVN)' }}<div class="small muted">{{ nd.kind === 'HVN' ? 'area support/resistance kuat' : 'harga cenderung melintas cepat' }}</div></td>
              <td class="r num">{{ rp(nd.p) }}</td><td class="r muted">{{ pctTxt(nd.p, c) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="small muted">{{ vpRead }}</p>
      </section>
    </div>

    <section class="rule-top">
      <h2>Zona reaksi volume</h2>
      <div v-if="adv.zones.length" class="scroll">
        <table class="ledger">
          <thead><tr><th class="lbl">Zona</th><th class="lbl">Asal</th><th class="lbl r">Volume</th><th class="lbl r">Reaksi</th><th class="lbl r">Kekuatan</th><th class="lbl r">Jarak</th></tr></thead>
          <tbody>
            <tr v-for="z in adv.zones" :key="z.i">
              <td><b>{{ rp(z.lo) }}–{{ rp(z.hi) }}</b> <span class="tag" :class="z.role === 'support' ? 't-good' : z.role === 'resistance' ? 't-strong' : 't-warn'">{{ z.role === 'support' ? 'Support' : z.role === 'resistance' ? 'Resistance' : 'Harga di dalam zona' }}</span></td>
              <td class="small muted">{{ d(z.i) }} · {{ z.n > 1 ? z.n + ' lonjakan, ' : '' }}dominan {{ z.side }}</td>
              <td class="r">{{ x2(z.vx) }}</td><td class="r">{{ z.holds }}× rebound · {{ z.breaks }}× tembus</td><td class="r">{{ z.str }}%</td>
              <td class="r">{{ z.dist ? (z.role === 'support' ? '−' : '+') + pct1(z.dist) + '%' : '0%' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="small muted">Belum ada lonjakan volume ≥ 2× rata-rata yang masih relevan.</p>
      <p class="small muted">Zona dari candle bervolume ≥ 2× rata-rata 20 hari (area transaksi pelaku besar). Rebound = harga menyentuh zona lalu berbalik ≥ 0,5 ATR dalam 5 hari; tembus = ditutup menembus zona.</p>
    </section>
  </div>
</template>

<style scoped>
.pp{display:flex;flex-direction:column;gap:18px}
h2{margin-bottom:8px}
h2 .small{font-family:var(--f-body);font-weight:400;letter-spacing:0;margin-left:6px}
.struct{padding:10px 14px;border-left:4px solid var(--warn);background:var(--warn-bg)}
.struct.s-good{border-color:var(--good);background:var(--good-bg)}
.struct.s-strong{border-color:var(--strong);background:var(--strong-bg)}
.struct ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:3px}
.struct li{display:flex;gap:8px;align-items:baseline}
.struct svg{flex:none;width:9px;height:9px}
svg.up{fill:var(--good)} svg.dn{fill:var(--strong)}
.pts{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:12px 24px}
.pt{display:flex;flex-direction:column;gap:6px;padding:10px 0 12px;border-top:1px solid var(--rule)}
.pt.sel{border-top:3px solid var(--ink)}
.pt.done{opacity:.75}
.pt header{display:flex;flex-wrap:wrap;gap:6px;align-items:baseline}
.pt header b{font-size:18px;margin-right:4px}
.pt p{margin:0}
.pt .btn{align-self:flex-start}
.conf{display:flex;align-items:center;gap:10px}
.bar{display:inline-block;width:110px;height:6px;background:var(--rule-2);border-radius:1px;overflow:hidden}
.bar i{display:block;height:100%}
.bar i.up{background:var(--good)} .bar i.dn{background:var(--strong)}
.why{margin:0;padding-left:18px;color:var(--ink-2)}
.hist{margin-top:12px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.r{text-align:right}
.num{font:700 15px var(--f-display);white-space:nowrap}
.ledger td.muted{white-space:nowrap}
.c-good{color:var(--good)} .c-strong{color:var(--strong)}
tr.dim td{opacity:.65}
tr.hl td{font-weight:600}
.tag{margin-left:4px}
.scroll{overflow-x:auto}
@media (max-width:760px){.grid{grid-template-columns:1fr}.pts{grid-template-columns:1fr}}
</style>
