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

// Jumlah pengurus dan berapa yang orang pengendali baru.
export function boardStats(pengurus) {
  const all = [...(pengurus?.direksi || []), ...(pengurus?.komisaris || [])]
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
