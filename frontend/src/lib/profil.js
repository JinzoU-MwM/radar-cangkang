// Logika murni untuk pendalaman profil pengendali (profil-pengendali.json) dan rekam jejak harga.

// Tingkat keyakinan sebuah klaim: dokumen resmi, satu media, atau dugaan dari pola.
export function yakinOf(k) {
  const s = String(k || '')
  if (/terverifikasi/i.test(s)) return { id: 'ok', label: 'terverifikasi', cls: 't-good' }
  if (/indikasi/i.test(s)) return { id: 'ind', label: 'indikasi', cls: 't-calm' }
  return { id: 'media', label: 'disebut media', cls: 't-warn' }
}

// Pecah teks menjadi potongan biasa dan kode saham 4 huruf yang dikenal (bisa dijadikan tautan).
export function tickerParts(text, known) {
  const s = String(text ?? '')
  const out = []
  let last = 0
  for (const m of s.matchAll(/\b[A-Z]{4}\b/g)) {
    if (!known?.has(m[0])) continue
    if (m.index > last) out.push({ text: s.slice(last, m.index) })
    out.push({ ticker: m[0] })
    last = m.index + 4
  }
  if (last < s.length) out.push({ text: s.slice(last) })
  return out
}

// Status riset perkara: field tidak ada = belum diriset; array kosong = sudah dicari dan bersih.
export function perkaraState(arr) {
  if (!Array.isArray(arr)) return 'belum'
  return arr.length ? 'ada' : 'bersih'
}

// Risiko yang layak ditampilkan: buang kalimat pembuka "Tidak ditemukan …", sisanya tetap.
export function risikoText(r) {
  const parts = String(r || '').split(/(?<=\.)\s+/).filter(x => x && !/^tidak (ditemukan|ada)\b/i.test(x.trim()))
  return parts.join(' ').replace(/^Catatan:\s*/i, '').trim()
}

// Rantai kepemilikan dikelompokkan per lapis (1 = pemegang langsung … UBO).
export function chainLayers(struktur) {
  const by = new Map()
  for (const c of struktur || []) {
    const lv = c.lapis ?? 0
    if (!by.has(lv)) by.set(lv, [])
    by.get(lv).push(c)
  }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([lapis, items]) => ({ lapis, items }))
}

// Gabungkan pengurus hasil riset dengan daftar pengurus terkini Stockbit (KSEI). sb: { directors, commissioners },
// nama berlabel jabatan khusus, mis. "BUDI (Direktur Utama)" atau "SITI (independen)".
// - cocok di kedua sumber → jabatan utama dari Stockbit dipakai bila riset tidak menyebutnya;
// - hanya di Stockbit → ditambahkan (fromStockbit) agar Direktur/Komisaris Utama tidak terlewat;
// - hanya di riset padahal Stockbit punya daftar → ditandai notListed (kemungkinan sudah diganti).
const boardKey = s => String(s || '').toUpperCase().replace(/\(.*?\)/g, ' ')
  .replace(/\b(DR|IR|DRS|PROF|HJ|SE|MM|AK|MAK|SKOM)\b\.?|[.,]/g, ' ').replace(/\s+/g, ' ').trim()
const sameBoard = (a, b) => {
  const x = boardKey(a), y = boardKey(b)
  if (!x || !y) return false
  if (x === y || x.includes(y) || y.includes(x)) return true
  const tx = x.split(' '), ty = y.split(' ')
  return tx.filter(w => ty.includes(w)).length >= Math.min(2, tx.length, ty.length)
}
const titleCase = s => String(s || '').toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, a, c) => a + c.toUpperCase())
function sbRows(list, grp) {
  return (list || []).map(s => {
    const m = String(s).match(/^(.*?)\s*\(([^)]*)\)\s*$/)
    const name = (m ? m[1] : String(s)).trim(), label = m ? m[2] : ''
    const independen = /independen/i.test(label)
    const base = label.replace(/,?\s*independen/i, '').trim()
    const jabatan = base || (grp === 'direksi' ? 'Direktur' : independen ? 'Komisaris Independen' : 'Komisaris')
    return { name, jabatan, independen, utama: /utama/i.test(label) }
  })
}
export function mergeBoard(pengurus, sb) {
  const out = { direksi: [...(pengurus?.direksi || [])], komisaris: [...(pengurus?.komisaris || [])] }
  if (!sb) return out
  for (const [grp, list] of [['direksi', sb.directors], ['komisaris', sb.commissioners]]) {
    const rows = sbRows(list, grp)
    if (!rows.length) continue
    const ours = out[grp].map(x => ({ ...x }))
    for (const x of ours) {
      const hit = rows.find(r => !r.used && sameBoard(r.name, x.nama))
      if (!hit) { x.notListed = true; continue }
      hit.used = true
      if (hit.utama && !/utama|presiden/i.test(x.jabatan || '')) x.jabatan = hit.jabatan
    }
    const added = rows.filter(r => !r.used).map(r => ({
      nama: titleCase(r.name), jabatan: r.jabatan, independen: r.independen, fromStockbit: true,
      latar: 'Tercantum di profil emiten (data KSEI via Stockbit); profil orang ini belum diriset.',
    }))
    // Jabatan utama di atas; yang tidak lagi tercantum di bawah.
    const rank = x => (/utama|presiden/i.test(x.jabatan || '') ? 0 : 1) + (x.notListed ? 2 : 0)
    out[grp] = [...added, ...ours].sort((a, b) => rank(a) - rank(b))
  }
  return out
}

// Jumlah pengurus dan berapa yang orang pengendali baru (yang tidak lagi tercantum tidak dihitung).
export function boardStats(pengurus) {
  const all = [...(pengurus?.direksi || []), ...(pengurus?.komisaris || [])].filter(x => !x.notListed)
  return { n: all.length, baru: all.filter(x => x.orangPengendaliBaru).length }
}

// Statistik harga satu kepemilikan pengendali dari candle (mingguan/harian) yang urut naik.
// holding: { symbol, pct, since, lastDate } dari /api/controller. Keluar = porsi 0 pada transaksi terakhir.
export function trackStats(bars, holding) {
  const B = (bars || []).filter(b => b && b.c > 0)
  if (!B.length || !holding?.since) return null
  const at = iso => { const k = B.findIndex(b => b.d >= iso); return k < 0 ? B.length - 1 : k }
  const since = String(holding.since).slice(0, 10)
  const i0 = at(since)
  const exited = !(holding.pct > 0)
  const iOut = exited ? at(String(holding.lastDate || B[B.length - 1].d).slice(0, 10)) : null
  const iEnd = iOut ?? B.length - 1
  let pk = i0
  for (let k = i0; k <= iEnd; k++) if (B[k].h > B[pk].h) pk = k
  const p0 = B[i0].c, exit = iOut != null ? B[iOut].c : null, now = B[B.length - 1].c
  return {
    p0, d0: B[i0].d, peak: B[pk].h, dPeak: B[pk].d, exit, now,
    peakChg: B[pk].h / p0 - 1, result: (exit ?? now) / p0 - 1,
    // Data harga mulai setelah tanggal masuk: harga masuk = candle pertama yang tersedia.
    short: i0 === 0 && B[0].d > since,
  }
}

// Ringkasan rekam jejak: jumlah emiten, berapa yang positif, median hasil.
export function trackSummary(rows) {
  const ok = (rows || []).filter(r => r && r.stats)
  const res = ok.map(r => r.stats.result).sort((a, b) => a - b)
  return { n: ok.length, wins: res.filter(v => v > 0).length, median: res.length ? res[Math.floor(res.length / 2)] : null }
}
