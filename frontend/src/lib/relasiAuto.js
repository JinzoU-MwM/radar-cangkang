// Diagram alur saham otomatis dari data yang sudah ada (profil-pengendali, aset-verified,
// pengendali-verified, story, item). Dipakai untuk emiten yang belum punya kurasi manual
// di relasi-verified.json, supaya panel Alur saham konsisten di semua emiten.
// Bentuk keluaran sama dengan relasi-verified: { nodes:[{id,x,y,t,s,k}], edges:[[dari,ke,jenis,label]], info:{} }.

const pctOf = s => (String(s || '').match(/(\d+(?:[.,]\d+)?)\s*%/) || [])[1]?.replace('.', ',') || ''
// Nama pendek untuk kotak: buang keterangan dalam kurung dan setelah ";" / " — ".
const short = (s, n = 40) => {
  const t = String(s || '').split(/\s[—–-]\s|;/)[0].replace(/\s*\([^)]*\)/g, '').trim()
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t
}
const clip = (s, n = 70) => { s = String(s || '').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s }
const srcText = s => Array.isArray(s) ? s.slice(0, 3).join(' · ') : String(s || '')

// Posisi x tengah untuk n kotak dalam satu baris, berpusat di 680 (sama dengan diagram kurasi).
const rowXs = (n, gap = 320) => Array.from({ length: n }, (_, i) => 680 + (i - (n - 1) / 2) * gap)
const ROW_Y = [164, 374, 616, 844]

export function buildRelasi(t, { profil = {}, aset = {}, pengendali = {}, item = null, story = null, pandangan = null } = {}) {
  const pf = profil[t] || {}, as = aset[t] || {}, pv = pengendali[t] || {}
  const people = (pf.pengendali || []).slice(0, 4)
  if (!people.length && !pv.siapa && !item?.ctrlName) return null

  const nodes = [], edges = [], info = {}
  const add = (id, row, t0, s, k, inf) => { nodes.push({ id, row, t: t0, s, k }); if (inf) info[id] = inf }

  // Baris 0: orang (UBO / pemegang kendali / wakil pengendali).
  people.forEach((p, i) => {
    add('p' + i, 0, short(p.nama, 34), clip([p.peran, pctOf(p.porsi) && pctOf(p.porsi) + '%'].filter(Boolean).join(' · '), 44), '', {
      kind: 'Orang · ' + (p.peran || 'pihak pengendali'),
      who: p.latar || '',
      role: [p.entitas && `Lewat ${p.entitas}.`, p.porsi && `Porsi: ${p.porsi}.`].filter(Boolean).join(' '),
      flag: p.risiko || '',
      trackTitle: 'Rekam jejak',
      track: [
        ...(p.pengalaman ? [['—', p.pengalaman]] : []),
        ...(p.jaringan || []).map(j => [j.keyakinan === 'terverifikasi' ? 'terverifikasi' : 'disebut media', `${j.dengan}: ${j.hubungan}`]),
      ],
      note: p.karakteristik || '',
      open: (pf.tidakDitemukan || []).filter(x => x.toLowerCase().includes(String(p.nama).split(/\s+/)[0].toLowerCase())),
      src: srcText(p.sumber),
    })
  })

  // Baris 1: kendaraan pengambilalihan (entitas para orang, atau nama pengendali di item).
  const ents = [...new Set(people.map(p => short(p.entitas, 44)).filter(Boolean))].slice(0, 2)
  if (!ents.length) ents.push(short(item?.ctrlName || item?.acquirer || pv.siapa, 44))
  ents.forEach((e, i) => add('e' + i, 1, e, i === 0 ? clip(pv.grup || 'pengendali baru', 44) : 'pengendali baru', 'key', {
    kind: 'Pengendali baru',
    who: pv.siapa || '',
    role: pv.rencana || '',
    flag: pv.bukanPengambilAlih ? 'Bukan pengambilalihan: transaksi ini tidak mengubah pengendali secara efektif.' : '',
    trackTitle: 'Catatan', track: pv.catatan ? [['—', pv.catatan]] : [],
    open: [], src: [pv.sumberJudul, pv.sumberTanggal].filter(Boolean).join(', '),
  }))
  people.forEach((p, i) => {
    const e = ents.indexOf(short(p.entitas, 44))
    edges.push(['p' + i, 'e' + Math.max(0, e), 'own', /wakil/i.test(p.peran || '') ? 'wakil' : (pctOf(p.porsi) ? 'UBO ' + pctOf(p.porsi) + '%' : 'UBO')])
  })

  // Baris 2: pengendali lama, emiten, pihak lawan transaksi.
  const ctrlPct = item?.ctrlPct != null ? String(item.ctrlPct).replace('.', ',') + '%' : (pctOf(people[0]?.porsi) ? pctOf(people[0].porsi) + '%' : '')
  add('em', 2, t, clip([item?.name, story?.baru && '→ ' + story.baru].filter(Boolean).join(' '), 46), 'main', {
    kind: 'Emiten BEI', who: pf.ringkas || '',
    role: story?.baru ? `Bisnis lama: ${story.lama || 'belum ada'}. Bisnis baru: ${story.baru}.` : '',
    trackTitle: 'Pengurus',
    track: [...(pf.pengurus?.direksi || []).map(d => [d.jabatan || 'Direksi', d.nama + (d.orangPengendaliBaru ? ' (orang pengendali baru)' : '')]),
      ...(pf.pengurus?.komisaris || []).map(d => [d.jabatan || 'Komisaris', d.nama + (d.orangPengendaliBaru ? ' (orang pengendali baru)' : '')])],
    open: pf.tidakDitemukan || [], src: '',
  })
  edges.push(['e0', 'em', 'own', ctrlPct || 'pengendali'])
  if (story?.oldName) {
    add('old', 2, short(story.oldName, 34), story.oldInferred ? 'pengendali lama (perkiraan)' : 'pengendali lama', '', {
      kind: 'Pengendali lama', who: story.oldName, role: story.oldPct ? `Porsi sebelum pengambilalihan ±${String(story.oldPct).replace('.', ',')}%.` : '',
      trackTitle: 'Catatan', track: [], open: story.oldInferred ? ['Nama pengendali lama disimpulkan dari riwayat pemegang saham'] : [], src: 'Stockbit',
    })
    edges.push(['old', 'em', 'own', story.oldPct ? `dulu ${String(story.oldPct).replace('.', ',')}%` : 'dulu'])
  }
  const af = pf.afiliasi || {}
  const affiliated = /afiliasi/i.test(af.hubungan || '') && !/tidak\s+(ter)?afiliasi/i.test(af.hubungan || '')
  if (af.pihakLawan) {
    add('lawan', 2, short(String(af.pihakLawan).split(/,\s/)[0], 36), clip(af.karakteristik || 'pihak lawan transaksi', 46), affiliated ? 'void' : '', {
      kind: 'Pihak lawan transaksi', who: af.pihakLawan,
      role: af.hubungan || '', flag: affiliated ? 'Transaksi dengan pihak terafiliasi pengendali.' : '',
      trackTitle: 'Pemilik', track: [af.pemilikAset && ['Pemilik aset', af.pemilikAset], af.pengendaliPihakLawan && ['Pengendali', af.pengendaliPihakLawan]].filter(Boolean),
      open: [], src: srcText(af.sumber),
    })
    if (affiliated) edges.push(['e0', 'lawan', 'role', 'afiliasi'])
  }

  // Baris 3: aset yang diinjeksi dan masyarakat.
  if (as.aset?.nama) {
    const k = as.kjpp || {}
    add('aset', 3, short(as.aset.nama, 36), clip([as.aset.sektor, k.status === 'terbit' ? 'KJPP terbit' : 'KJPP belum terbit'].filter(Boolean).join(' · '), 44), '', {
      kind: 'Aset yang diinjeksi', who: as.aset.jenis || '', role: as.aset.deskripsi || '',
      flag: k.status === 'terbit' ? '' : 'Laporan penilai independen (KJPP) belum terbit.',
      trackTitle: 'Transaksi', track: [as.transaksi?.nilai && ['Nilai', as.transaksi.nilai], as.transaksi?.caraBayar && ['Cara bayar', as.transaksi.caraBayar], k.nilai && ['KJPP', k.nilai]].filter(Boolean),
      open: [], src: k.sumber || '',
    })
    edges.push(['aset', 'em', 'plan', clip(as.transaksi?.nilai || 'injeksi', 30)])
    if (af.pihakLawan) edges.push(['lawan', 'aset', 'own', 'pemilik'])
  }
  const pub = pandangan?.dilusi?.porsiPublikSekarang
  add('pub', 3, 'Masyarakat', pub != null ? `porsi publik ${String(pub).replace('.', ',')}%` : 'pemegang saham publik', '', {
    kind: 'Pemegang saham publik', who: '', role: pandangan?.dilusi?.berlaku && pandangan.dilusi.porsiPublikSetelah != null
      ? `Porsi publik ${String(pub).replace('.', ',')}% turun ke ±${String(pandangan.dilusi.porsiPublikSetelah).replace('.', ',')}% bila inbreng terjadi sesuai asumsi analis.` : '',
    trackTitle: 'Catatan', track: [], open: [], src: 'pandangan-analis.json',
  })
  edges.push(['pub', 'em', 'own', pub != null ? String(pub).replace('.', ',') + '%' : 'publik'])

  // Tata letak: tiap baris dipusatkan; emiten selalu di tengah baris 2.
  for (let r = 0; r < 4; r++) {
    const row = nodes.filter(n => n.row === r)
    if (r === 2) {
      const order = ['old', 'em', 'lawan'].map(id => row.find(n => n.id === id)).filter(Boolean)
      const xs = order.length === 3 ? [200, 680, 1160] : order[0]?.id === 'em' ? [680, 1160] : [200, 680]
      order.forEach((n, i) => { n.x = order.length === 1 ? 680 : xs[i]; n.y = ROW_Y[r] })
    } else if (r === 3) {
      // Masyarakat tepat di bawah emiten; aset di bawah pihak lawan (kanan) supaya garis tidak bersilang.
      row.forEach(n => { n.x = n.id === 'pub' ? 680 : 1160; n.y = ROW_Y[r] })
    } else rowXs(row.length).forEach((x, i) => { row[i].x = x; row[i].y = ROW_Y[r] })
  }
  nodes.forEach(n => delete n.row)
  return { auto: true, nodes, edges, info }
}
