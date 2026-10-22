// Naskah video rangkuman analisis: adegan berurutan berisi teks narasi (gaya karya ilmiah, mudah dipahami)
// dan data visual untuk animasi di layar. Disusun otomatis dari hasil collectDeck(), sehingga isinya sama
// dengan tab Analisa dan presentasi unduhan. mode: 'ringkas' (±4 menit) atau 'lengkap' (±10 menit).
import { fmtDate } from './domain.js'
import { phaseName } from './cycle.js'
import { riPriceNeeded, asetLaba, labaSebelumSesudah, riLayak } from './rightsIssue.js'

const id = (v, d = 0) => v == null || isNaN(v) ? '–' : (+v).toLocaleString('id-ID', { maximumFractionDigits: d })
const rp = v => v == null || isNaN(v) ? '–' : 'Rp' + id(Math.round(v))
const big = v => v == null || isNaN(v) ? '–' : Math.abs(v) >= 1e12 ? `Rp${id(v / 1e12, 2)} T` : Math.abs(v) >= 1e9 ? `Rp${id(v / 1e9, 1)} M` : `Rp${id(v / 1e6, 0)} jt`
const pct = (v, d = 1) => v == null || isNaN(v) ? '–' : `${id(v, d)}%`
const ABBR = /\b(Pte|Ltd|Tbk|PT|Rp|No|dll|dsb|Inc|Co|Corp|Bhd|Sdn|Jl|Tn|Ny|Dr|Ir|St)\.$/i
export function sentences(s) {
  const parts = String(s || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
  const out = []
  for (const p of parts) if (out.length && ABBR.test(out[out.length - 1])) out[out.length - 1] += ' ' + p; else out.push(p)
  return out.filter(Boolean)
}
const first = (s, n = 1) => sentences(s).slice(0, n).join(' ')
// Judul huruf kapital semua (gaya keterbukaan BEI) dijadikan huruf kalimat agar wajar dibacakan.
const calmCase = t => { const x = String(t || ''); return x === x.toUpperCase() && /[A-Z]{4,}/.test(x) ? x.charAt(0) + x.slice(1).toLowerCase() : x }
const lower1 = s => { const t = String(s || ''); return t && !/^[A-Z]{2,}/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t }
const cap = s => { const t = String(s || '').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : t }

// Teks yang dibacakan mesin suara: angka & singkatan diubah agar enak didengar ("Rp2,48 T" → "2,48 triliun rupiah").
export function speakable(text) {
  return String(text || '')
    // Rentang lebih dulu ("Rp11–Rp49", "1–2%") agar tanda pisah terbaca "hingga".
    .replace(/(\d)\s*[–-]\s*(Rp\s?)?(\d)/g, '$1 hingga $2$3')
    .replace(/Rp\s?([\d.,]+)\s*T\b/g, '$1 triliun rupiah').replace(/Rp\s?([\d.,]+)\s*M\b/g, '$1 miliar rupiah')
    .replace(/Rp\s?([\d.,]+)\s*jt\b/g, '$1 juta rupiah').replace(/Rp\s?([\d.,]+)/g, '$1 rupiah')
    .replace(/USD\s?([\d.,]+)\s*juta/gi, '$1 juta dolar AS').replace(/(\d)\s*%/g, '$1 persen').replace(/(\d)\s*×/g, '$1 kali')
    .replace(/→/g, ' menjadi ').replace(/≥/g, 'minimal ').replace(/±/g, 'sekitar ')
    .replace(/\bPMHMETD\b/g, 'rights issue').replace(/\bPMTHMETD\b/g, 'private placement').replace(/\bTbk\.?/g, 'T B K')
    .replace(/\bKJPP\b/g, 'K J P P').replace(/\bPTW\b/g, 'P T W').replace(/\bUBO\b/g, 'U B O').replace(/\bSPV\b/g, 'S P V')
    .replace(/\s*[·|]\s*/g, ', ').replace(/\s+/g, ' ').trim()
}

// Satu adegan: { id, bab, judul, visual, lines: [teks] }. visual.type: title | kpis | bars | compare | ladder | list | rec.
export function buildVideo(d, mode = 'ringkas') {
  const A = d.A || {}, pa = d.pa || {}, full = mode === 'lengkap'
  const S = []
  const add = (id, bab, judul, visual, lines) => { const l = lines.filter(Boolean).map(cap); if (l.length) S.push({ id, bab, judul, visual, lines: l }) }

  // 1. Pembuka
  add('buka', 'Pembuka', `${d.t} · ${d.name || ''}`.trim(), { type: 'title', t: d.t, name: d.name, sikap: pa.sikap || A.stance?.t, score: A.score, sector: d.sector?.label }, [
    `Video ini merangkum hasil kajian atas ${d.name || d.t} dengan kode saham ${d.t}, sebuah emiten yang berada dalam radar backdoor listing.`,
    pa.sikap ? `Sikap analis terhadap saham ini adalah ${pa.sikap.toLowerCase()}, dengan skor analisis ${A.score ?? '–'} dari 100.` : `Skor analisis saham ini adalah ${A.score ?? '–'} dari 100.`,
    pa.ringkas ? first(pa.ringkas, 1) : null,
  ])

  // 2. Tesis (lengkap)
  if (full && pa.tesis) add('tesis', 'Tesis analis', 'Dasar penilaian analis', { type: 'list', items: sentences(pa.tesis).slice(0, 5) },
    sentences(pa.tesis).slice(0, 6))

  // 3. Pengendali
  const pv = d.pv || {}, o = d.profil?.pengendali?.[0]
  add('pengendali', 'Pengendali', 'Siapa pengendalinya', {
    type: 'kpis', items: [
      [pct(A.ctrlPct, 2), `Porsi ${A.ctrlName || 'pengendali'}`],
      A.tender?.price ? [rp(A.tender.price), 'Harga penawaran tender wajib (PTW)'] : null,
      A.flt != null ? [pct(A.flt, 1), 'Porsi publik'] : null,
    ].filter(Boolean),
  }, [
    pv.siapa ? first(pv.siapa, full ? 2 : 1) : `Pengendali saat ini adalah ${A.ctrlName || 'belum diketahui'} dengan porsi ${pct(A.ctrlPct, 2)}.`,
    A.tender?.price && A.price ? `Harga penawaran tender wajib tercatat ${rp(A.tender.price)}, sedangkan harga saat ini ${rp(A.price)}, atau ${A.price >= A.tender.price ? 'di atas' : 'di bawah'} harga tender sebesar ${id(Math.abs(A.price / A.tender.price - 1) * 100, 0)} persen.` : null,
    full && o ? `${o.nama} berperan sebagai ${String(o.peran || 'pengendali').toLowerCase()}. ${first(o.latar, 1)}` : null,
  ])

  // 3b. Profil pengendali (lengkap)
  if (full && o) {
    const rj = (o.rekamJejak || []).slice(0, 3)
    add('profil', 'Profil pengendali', o.nama, {
      type: 'list', items: [o.peran && `Peran: ${o.peran}`, o.entitas && `Melalui: ${o.entitas}`, ...rj.map(x => `${x.kode || x.entitas}: ${x.peran || ''}${x.periode ? ' (' + x.periode + ')' : ''}`)].filter(Boolean),
    }, [
      `${o.nama} merupakan ${lower1(o.peran || 'pengendali')}${o.entitas ? ' melalui ' + o.entitas : ''}.`,
      first(o.latar, 2),
      rj.length ? `Rekam jejaknya mencakup ${rj.map(x => x.entitas + (x.kode ? ` (${x.kode})` : '')).join(', ')}.` : null,
      rj[0]?.hasil ? first(rj[0].hasil, 1) : null,
      o.karakteristik ? first(o.karakteristik, 1) : o.risiko ? first(o.risiko, 1) : null,
    ])
  }

  // 3c. Pihak lawan transaksi (lengkap)
  const af = d.profil?.afiliasi
  if (full && af?.pihakLawan) add('pihaklawan', 'Pihak lawan', 'Pihak di balik aset target', {
    type: 'list', items: (af.strukturKepemilikan || []).slice(0, 5).map(x => `${x.nama || x.entitas || ''}${x.porsi ? ' · ' + x.porsi : ''}`).filter(x => x.trim()),
  }, [
    `Pihak lawan dalam transaksi ini adalah ${af.pihakLawan}.`,
    af.hubungan ? first(af.hubungan, 2) : null,
    (af.temuan || []).length ? first(af.temuan[0]?.temuan || af.temuan[0], 1) : null,
  ])

  // 4. Kepemilikan & pergerakan (lengkap)
  const hold = (A.holders || []).filter(h => Math.abs(h.change || 0) >= 0.5).slice(0, 5)
  if (full && hold.length) add('kepemilikan', 'Kepemilikan', 'Pergerakan pemegang saham', {
    type: 'bars', unit: '%', items: hold.map(h => ({ label: h.name, from: h.from, to: h.to })),
  }, [
    `Dalam satu tahun terakhir tercatat ${hold.length} pergerakan pemegang saham di atas lima persen.`,
    pa.pengendaliBergerak ? first(pa.pengendaliBergerak, 2) : `${hold[0].name} berubah dari ${pct(hold[0].from, 2)} menjadi ${pct(hold[0].to, 2)}.`,
  ])

  // 5. Aset injeksi
  const det = d.ri?.detail, inj = d.ri?.inj || d.aset?.transaksi?.nilaiRp || null
  const asetNama = det?.nama || d.aset?.aset?.nama || A.sv?.injectTarget
  const kw = (d.ri?.doc || d.riDoc)?.kewajaran
  const lbA = asetLaba(d.ri?.doc || d.riDoc)
  if (asetNama || inj) add('aset', 'Aset injeksi', 'Aset yang akan diinjeksikan', {
    type: 'kpis', items: [
      det?.spread ? [`${big(det.lo)} – ${big(det.hi)}`, 'Nilai aset (indikatif, berbeda antarsumber)'] : inj ? [big(inj), 'Nilai transaksi aset'] : null,
      inj && A.mcap ? [`${id(inj / A.mcap, 1)}×`, 'Dibanding kapitalisasi pasar'] : null,
      [det?.kjpp?.status === 'terbit' ? 'Terbit' : det?.kjpp?.status === 'ditunjuk' ? 'Ditunjuk' : 'Belum ada', 'Penilaian KJPP'],
    ].filter(Boolean),
  }, [
    asetNama ? `Aset yang direncanakan masuk adalah ${asetNama}${det?.jenis ? ', berupa ' + det.jenis.toLowerCase() : ''}.` : null,
    det?.spread ? `Nilainya masih indikatif, berkisar ${big(det.lo)} hingga ${big(det.hi)} menurut sumber yang berbeda, dan perhitungan memakai ${big(inj)}.` : inj ? `Nilai transaksinya sekitar ${big(inj)}.` : null,
    inj && A.mcap ? `Nilai tersebut setara ${id(inj / A.mcap, 1)} kali kapitalisasi pasar ${d.t} saat ini.` : null,
    det?.kjpp?.status === 'terbit' ? `Penilai independen telah menerbitkan nilai${det.kjpp.nilai ? ' sebesar ' + big(det.kjpp.nilai) : ''}.` : 'Nilai aset tersebut belum diuji oleh penilai independen, sehingga masih berupa klaim.',
    full && det?.cara ? `Cara pembayarannya adalah ${det.cara.charAt(0).toLowerCase() + det.cara.slice(1)}.` : null,
    // Kewajaran nilai aset menurut dokumen asli (ri-dokumen.json).
    kw ? `Berdasarkan dokumen keterbukaan, nilai aset ini dinilai ${kw.putusan}. ${kw.ringkas || ''}` : null,
    ...(kw?.alasan || []).slice(0, full ? 3 : 1),
    lbA ? (lbA.rugi ? `Menurut laporan keuangannya, aset ini masih merugi ${big(-lbA.laba)}${lbA.periode ? ' pada periode ' + lbA.periode : ''}, sehingga harganya tidak ditopang laba.`
      : lbA.labaThn != null ? `Laba bersih aset setahun sekitar ${big(lbA.labaThn)}${lbA.per != null ? `, sehingga harga transaksi setara ${id(lbA.per, 1)} kali laba porsi yang diambil` : ''}.` : null)
      : (d.ri?.doc || d.riDoc) ? 'Laba aset belum diungkap dalam dokumen, sehingga nilai transaksi belum dapat diuji terhadap laba.' : null,
  ])

  // 6. Penambahan modal (rights issue)
  if (d.ri && d.riR) {
    const c = d.ri, r = d.riR, f = d.riF, nd = riPriceNeeded(c, d.riP)
    const lbR = c.doc ? asetLaba(c.doc, { S1: r.S1, P: d.riP }) : null, ls = labaSebelumSesudah(c, r, lbR), ly = riLayak(c, r, lbR, ls)
    add('ri', 'Penambahan modal', c.label, {
      type: 'compare', from: { v: c.float || 0, l: 'Porsi publik sekarang' }, to: { v: r.pubAfter * 100, l: 'Bila publik tidak menebus' },
      extra: r.pubAfterInj != null ? { v: r.pubAfterInj * 100, l: 'Setelah injeksi tahap lanjutan' } : null,
      kpis: [[big(r.total), 'Nilai penerbitan'], [big(r.tunai), 'Dana tunai'], f ? [f.label, 'Pengumpulan dana'] : null].filter(Boolean),
    }, [
      `Perusahaan merencanakan ${c.label} dengan nilai penerbitan sekitar ${big(r.total)}, yaitu ${id(r.N / 1e9, 2)} miliar saham pada harga ${rp(d.riP)}.`,
      c.laterInj ? `Dana tahap pertama ini berupa uang tunai dan tidak digunakan untuk membeli aset; aset senilai ${big(c.laterInj)} akan dibayar dengan saham baru pada tahap berikutnya.` : null,
      `Bila pemegang saham publik tidak ikut menebus, porsi publik turun dari ${pct(c.float, 1)} menjadi ${pct(r.pubAfter * 100, 1)}${r.pubAfterInj != null ? `, dan dapat turun hingga ${pct(r.pubAfterInj * 100, 1)} setelah injeksi aset` : ''}.`,
      ly ? `Kesimpulan investasinya: ${ly.label.toLowerCase()}.${ls ? (ls.akresi ? ' Laba per saham emiten naik setelah aset masuk.' : ' Laba per saham emiten justru turun setelah penerbitan.') : ''}` : null,
      nd ? `Agar dana tunai ${big(nd.cash)} tercapai, harga saham sebaiknya berada di atas ${rp(Math.ceil(nd.ref))}, yaitu harga pelaksanaan ${rp(d.riP)} ditambah diskon dua puluh persen${nd.gap != null ? (nd.gap > 0 ? `; harga saat ini masih perlu naik ${id(nd.gap * 100, 0)} persen` : '; harga saat ini sudah memenuhi syarat tersebut') : ''}.` : null,
      f ? `Berdasarkan keterbukaan informasi terakhir${f.last ? ' pada ' + fmtDate(f.last.date) : ''}, peluang terkumpulnya dana dinilai ${f.label.toLowerCase()}.` : null,
      f ? first(f.reasons.filter(x => x.s < 0).map(x => x.t).join(' '), full ? 3 : 2) : null,
    ])
  }

  // 6b. Progres & kronologi (lengkap)
  const KEY = /(transaksi material|kegiatan usaha|inbreng|HMETD|penilai|akuisisi|pengambilalihan|tender|RUPS|private placement|penambahan modal|hasil)/i
  const NOISE = /bukti iklan|panggilan RUPS|pemberitahuan RUPS|penggunaan dana hasil|public expose/i
  const evs = (d.reports || []).filter(r => r.date && KEY.test(r.title || '') && !NOISE.test(r.title || '')).slice(0, 4)
  if (full && (d.prog || evs.length)) add('progres', 'Kemajuan transaksi', 'Kemajuan transaksi dan kronologi', {
    type: 'list', items: evs.map(r => `${fmtDate(String(r.date).slice(0, 10))}: ${String(r.title).length > 90 ? String(r.title).slice(0, 88) + '…' : r.title}`),
  }, [
    d.prog ? `Kemajuan transaksi telah mencapai ${d.prog.pct} persen dari seluruh tahapan.` : null,
    d.pos?.now ? `Tahap yang sudah tercapai adalah ${lower1(d.pos.now)}.` : null,
    d.pos?.next ? `Tahap berikutnya adalah ${lower1(String(d.pos.next).split(' · ')[0])}.` : null,
    evs[0] ? `Keterbukaan informasi penting terakhir terbit pada ${fmtDate(String(evs[0].date).slice(0, 10))}.` : null,
  ])

  // 7. Skor enam dimensi (lengkap)
  if (full && (A.dims || []).length) {
    const sorted = [...A.dims].sort((a, b) => b.s - a.s)
    add('skor', 'Skor analisis', 'Penilaian enam dimensi', { type: 'bars', unit: '', max: 10, items: A.dims.map(x => ({ label: x.k, to: x.s })) }, [
      `Penilaian dilakukan pada enam dimensi dengan skala nol hingga sepuluh.`,
      `Dimensi terkuat adalah ${sorted[0].k} dengan skor ${id(sorted[0].s, 1)}, sedangkan yang terlemah adalah ${sorted[sorted.length - 1].k} dengan skor ${id(sorted[sorted.length - 1].s, 1)}.`,
      first((sorted[sorted.length - 1].why || []).join(' '), 1),
    ])
  }

  // 8. Valuasi
  const nw = pa.nilaiWajar, lv = (A.levels || []).filter(l => l[2] > 0)
  if (nw || lv.length) add('valuasi', 'Valuasi', 'Harga dibandingkan patokan nilai', {
    type: 'ladder', price: A.price, levels: [...lv.map(l => ({ v: l[2], l: l[0] })), ...(nw ? [{ v: nw.bawah, l: 'Nilai wajar bawah' }, { v: nw.atas, l: 'Nilai wajar atas' }] : [])],
  }, [
    nw && A.price ? `Nilai wajar kasar saham ini diperkirakan berada pada rentang ${rp(nw.bawah)} hingga ${rp(nw.atas)}, sementara harga saat ini ${rp(A.price)}.` : null,
    nw && A.price ? (A.price > nw.atas ? 'Dengan demikian, harga pasar sudah berada di atas batas atas nilai wajar.' : A.price < nw.bawah ? 'Dengan demikian, harga pasar berada di bawah batas bawah nilai wajar.' : 'Dengan demikian, harga pasar masih berada di dalam rentang nilai wajar.') : null,
    full && nw?.metode ? first(nw.metode, 1) : null,
    A.rr != null ? `Dari harga saat ini, rasio imbal hasil terhadap risiko tercatat ${id(A.rr, 1)} banding satu.` : null,
  ])

  // 8b. Skenario harga (lengkap)
  const sk = (A.levels || []).filter(l => l[2] > 0)
  if (full && sk.length && A.price) add('skenario', 'Skenario harga', 'Skenario harga ke depan', {
    type: 'bars', unit: '%', items: sk.map(l => ({ label: l[0], to: Math.abs(l[2] / A.price - 1) * 100 })), max: Math.max(...sk.map(l => Math.abs(l[2] / A.price - 1) * 100)),
  }, sk.slice(0, 4).map(l => `${l[0]} berada di ${rp(l[2])}, atau ${l[2] >= A.price ? 'naik' : 'turun'} ${id(Math.abs(l[2] / A.price - 1) * 100, 0)} persen dari harga saat ini, yaitu ${lower1(l[1])}.`))

  // 9. Fundamental (lengkap)
  const m = A.p?.metrics || {}
  if (full && (m.pbv != null || m.equity != null)) add('fundamental', 'Fundamental', 'Indikator keuangan', {
    type: 'kpis', items: [m.pbv != null && [`${id(m.pbv, 2)}×`, 'PBV'], m.equity != null && [big(m.equity), 'Ekuitas'], m.cash != null && [big(m.cash), 'Kas'], m.netMargin && [String(m.netMargin).replace('.', ','), 'Margin laba bersih']].filter(Boolean),
  }, [
    m.pbv != null ? `Harga saham setara ${id(m.pbv, 2)} kali nilai bukunya, dengan ekuitas sekitar ${big(m.equity)} dan kas ${big(m.cash)}.` : null,
    m.revGrowth ? `Pendapatan tumbuh ${String(m.revGrowth).replace('.', ',').replace('%', ' persen')} dibandingkan tahun sebelumnya, dengan margin laba bersih ${String(m.netMargin || '–').replace('.', ',').replace('%', ' persen')}.` : null,
  ])

  // 10. Harga & teknikal
  const tech = d.tech, cyc = d.cyc
  if (tech) add('teknikal', 'Harga & teknikal', 'Posisi harga dan sinyal teknikal', {
    type: 'kpis', items: [[rp(A.price), 'Harga terakhir'], tech.plan?.s?.sup ? [rp(tech.plan.s.sup), 'Support'] : null, tech.plan?.s?.res ? [rp(tech.plan.s.res), 'Resistance'] : null, tech.sig?.sig ? [tech.sig.sig[0], 'Sinyal teknikal'] : null].filter(Boolean),
  }, [
    cyc ? `Saham ini telah melewati ${cyc.day} hari sejak penawaran tender wajib dimulai, dan berada pada fase ${lower1(phaseName(cyc.ph) || 'yang belum terdefinisi')}.` : null,
    tech.sig?.sig ? `Secara teknikal, sinyal tergolong ${tech.sig.sig[0].toLowerCase()} dengan skor ${tech.sig.score > 0 ? 'plus ' : tech.sig.score < 0 ? 'minus ' : ''}${Math.abs(tech.sig.score)}.` : null,
    tech.plan?.s?.sup && tech.plan?.s?.res ? `Area support terdekat berada di sekitar ${rp(tech.plan.s.sup)}, sedangkan resistance di sekitar ${rp(tech.plan.s.res)}.` : null,
    full && tech.verdict ? cap(first(tech.verdict, 1)) : null,
  ])

  // 11. Faktor pendukung vs risiko (lengkap)
  if (full && d.pc && (d.pc.pros.length || d.pc.cons.length)) add('faktor', 'Pendukung & risiko', 'Faktor pendukung dan faktor risiko', {
    type: 'list', items: [...d.pc.pros.slice(0, 3).map(x => 'Pendukung: ' + x.t), ...d.pc.cons.slice(0, 3).map(x => 'Risiko: ' + x.t)],
  }, [
    `Kajian ini mengidentifikasi ${d.pc.pros.length} faktor pendukung dan ${d.pc.cons.length} faktor risiko.`,
    d.pc.pros[0] ? `Faktor pendukung utama adalah ${d.pc.pros[0].t.toLowerCase()}.` : null,
    d.pc.cons[0] ? `Adapun risiko utamanya adalah ${d.pc.cons[0].t.toLowerCase()}${d.pc.cons[1] ? ', serta ' + d.pc.cons[1].t.toLowerCase() : ''}.` : null,
  ])

  // 11b. Pembahasan temuan utama (lengkap)
  const deep = (d.deep || []).slice(0, 4)
  if (full && deep.length) add('pembahasan', 'Pembahasan', 'Pembahasan temuan utama', { type: 'list', items: deep.map(x => x[0]) },
    deep.map(x => `${x[0]}: ${first(x[1], 1)}`))

  // 11c. Perkembangan berita terkini
  const ns = d.newsSum, nr = d.newsRecent || []
  if (ns && nr.length) add('berita', 'Berita terkini', 'Perkembangan berita terkini', {
    type: 'list', items: nr.slice(0, full ? 4 : 3).map(({ u }) => `${fmtDate(String(u.date || '').slice(0, 10))}: ${String(u.title).length > 80 ? String(u.title).slice(0, 78) + '…' : u.title}`),
  }, [
    `Keterbukaan material terakhir terbit pada ${fmtDate(String(nr[0].u.date || '').slice(0, 10))}, berjudul ${calmCase(nr[0].u.title).replace(/\.$/, '')}.`,
    full && ns.paras[1] ? ns.paras[1] : null,
    ns.paras.find(p => /^Inti/.test(p)) || null,
    ns.verdict,
    ...(d.pa?.pembaruan || []).slice(0, full ? 2 : 1),
  ])

  // 12. Rekomendasi
  const rc = d.rec
  if (rc) add('rekomendasi', 'Rekomendasi', 'Rekomendasi', { type: 'rec', rec: rc }, [
    `Berdasarkan seluruh uraian tersebut, rekomendasi untuk saham ini adalah ${rc.label.toLowerCase()}.`,
    rc.entry ? (rc.entry[1] ? `Area pembelian berada pada ${rp(rc.entry[0])} hingga ${rp(rc.entry[1])}.` : `Pembelian baru layak dipertimbangkan apabila harga penutupan melampaui ${rp(rc.entry[0])} disertai kenaikan volume.`) : null,
    rc.stop ? `Batas risiko ditetapkan pada ${rp(rc.stop)}${rc.targets[0] ? `, dengan target pertama ${rp(rc.targets[0].p)}` : ''}.` : null,
    `Porsi yang disarankan adalah ${rc.porsi.charAt(0).toLowerCase() + rc.porsi.slice(1)}.`,
    rc.holder,
  ])

  // 13. Penutup: yang perlu dipantau
  const watch = [...(rc?.triggers || A.checks || [])].slice(0, full ? 3 : 2).map(x => String(x).replace(/^pantau( apakah)?\s+/i, (m, a) => a ? 'apakah ' : '')), exits = (rc?.exits || A.exits || []).slice(0, full ? 2 : 1)
  add('penutup', 'Penutup', 'Hal yang perlu dipantau', { type: 'list', items: [...watch.map(x => 'Pantau: ' + x), ...exits.map(x => 'Sinyal keluar: ' + x)] }, [
    watch.length ? `Ke depan, hal yang perlu dipantau adalah ${watch.map(x => lower1(x).replace(/\.$/, '')).join('; ')}.` : null,
    exits.length ? `Posisi sebaiknya ditinjau ulang apabila ${lower1(exits[0]).replace(/\.$/, '').replace(/:\s*/, ', yang menandakan ')}.` : null,
    'Rangkuman ini disusun secara otomatis dari data publik dan bukan merupakan anjuran membeli atau menjual efek. Terima kasih.',
  ])
  return S
}

// Perkiraan durasi (detik) satu kalimat pada kecepatan baca normal (±2,4 kata per detik untuk suara Indonesia).
export const lineSecs = (text, rate = 1) => Math.max(2.5, speakable(text).split(/\s+/).length / (2.4 * rate) + 0.4)

// Subtitle .srt dari perkiraan durasi.
export function toSrt(scenes, rate = 1) {
  const ts = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = (s % 60).toFixed(3).replace('.', ',').padStart(6, '0'); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${x}` }
  let t = 0, n = 0
  const out = []
  for (const sc of scenes) for (const l of sc.lines) { const d = lineSecs(l, rate); out.push(`${++n}\n${ts(t)} --> ${ts(t + d)}\n${l}\n`); t += d }
  return out.join('\n')
}
export const toScript = (scenes, d) => [`Naskah video rangkuman ${d.t}${d.name ? ' — ' + d.name : ''}`, '',
  ...scenes.flatMap((s, i) => [`${i + 1}. ${s.bab}: ${s.judul}`, ...s.lines, ''])].join('\n')
