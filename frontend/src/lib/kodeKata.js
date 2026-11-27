// Kode saham BEI yang juga kata atau singkatan umum (salinan KODE_KATA dan KODE_SINGKATAN di website/server.py; tes
// server memastikan keduanya sama). Dipakai supaya kata "PADA" di judul huruf kapital tidak dianggap kode PADA.
// Aturannya sama dengan kode_disebut/polos_sah di server.

export const KODE_KATA = new Set(`
ADHI AGAR AGRO AKSI AMAN ANDI AREA ASLI ASRI ATAP AUTO BAIK BAJA BALI BANK BELI BIKE BLUE BOGA BUDI BUKA BUMI BUMN
CARE CASH CHIP CITY COAL COIN CUAN DATA DAYA DEWI EMAS FAST FILM FOOD GEMA GOLD GOLF GUNA IDEA IKAN INDO JAWA JAYA
KAYU KOIN KOKA KOTA LABA LAJU LAND LIFE MAIN MEGA META MINA MSCI NAIK NATO PACK PADA PIPA POLA PORT PURI RAJA RATU
REAL RELI ROTI SAFE SATU SIAP STAR TIRA TRUK UANG UNIT VISI WIFI`.trim().split(/\s+/))

export const KODE_SINGKATAN = new Set(['BUMN', 'MSCI', 'NATO', 'WIFI'])

// Teks yang hurufnya hampir semua kapital (judul IQPlus): kata biasa di dalamnya tidak bisa dibedakan dari kode.
// Kode 4 huruf (daftar saham) tidak ikut dihitung.
export function serbaKapital(s) {
  const huruf = String(s || '').replace(/\b[A-Z]{4}\b/g, ' ').match(/\p{L}/gu) || []
  return huruf.length >= 12 && huruf.filter(c => c === c.toUpperCase() && c !== c.toLowerCase()).length / huruf.length > 0.8
}

// Apakah kemunculan kode `t` di posisi `i` dalam `s` memang kode saham: "(PADA)" dan "$PADA" selalu. Kode polos hanya
// di teks yang tidak serba kapital, tidak diapit kata kapital biasa ("KEMBALI PADA DESEMBER"), dan untuk singkatan
// umum (MSCI, NATO) hanya di dalam daftar kode ("ERAA, WIFI, PWON").
export function kodeSah(s, t, i, kapital = serbaKapital(s)) {
  if (s[i - 1] === '$' || (s[i - 1] === '(' && s[i + t.length] === ')')) return true
  if (kapital) return false
  const sebelum = (s.slice(0, i).match(/[A-Za-z]+/g) || []).at(-1) || ''
  const sesudah = (s.slice(i + t.length).match(/[A-Za-z]+/g) || [])[0] || ''
  const kata = w => w.length >= 2 && w.length !== 4 && w === w.toUpperCase()
  if (kata(sebelum) && kata(sesudah)) return false
  if (KODE_SINGKATAN.has(t)) {
    const kode = w => w.length === 4 && w === w.toUpperCase()
    return kode(sebelum) || kode(sesudah)
  }
  return true
}
