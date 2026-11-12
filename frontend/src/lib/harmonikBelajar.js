// Ukuran posisi (lot) dan kuis harmonic: dipakai tab Saham (Long/Short) dan tab Materi halaman Harmonic Pattern.

// Ukuran posisi saham BEI (1 lot = 100 lembar): risiko rupiah = modal x risiko%; lot = risiko / (selisih entry-stop x 100).
export function ukuranPosisi({ modal, risikoPct, entry, stop, target } = {}) {
  modal = Number(modal); risikoPct = Number(risikoPct); entry = Number(entry); stop = Number(stop); target = Number(target)
  if (!(modal > 0 && risikoPct > 0 && entry > 0 && stop > 0) || entry === stop) return null
  const risikoRp = modal * risikoPct / 100, perLot = Math.abs(entry - stop) * 100
  const lot = Math.max(0, Math.floor(risikoRp / perLot)), nilai = lot * entry * 100
  return { risikoRp, lot, nilai, pctModal: Math.round(nilai / modal * 1000) / 10, rugiMaks: lot * perLot,
    rr: target > 0 ? Math.round(Math.abs(target - entry) / Math.abs(entry - stop) * 10) / 10 : null, cukup: nilai <= modal }
}

export const KUIS = [
  { q: 'Titik B berhenti di retracement 0,618 kaki XA dan D diproyeksikan di 0,786 XA. Pola apa yang sedang terbentuk?',
    pilihan: ['Gartley', 'Bat', 'Crab', 'Butterfly'], benar: 0, ket: 'B 0,618 XA dan D 0,786 XA adalah ciri Gartley.' },
  { q: 'Harga baru saja menyentuh PRZ. Apa yang sebaiknya dilakukan pemula?',
    pilihan: ['Langsung beli sebanyak mungkin', 'Tunggu konfirmasi seperti pin bar atau engulfing', 'Abaikan karena PRZ tidak penting', 'Pasang target di titik X'], benar: 1,
    ket: 'PRZ adalah area probabilitas, bukan jaminan. Tunggu konfirmasi pembalikan sebelum entry.' },
  { q: 'Pola mana yang titik D-nya melewati titik X?', pilihan: ['Gartley', 'Bat', 'Butterfly', 'Tidak ada'], benar: 2,
    ket: 'Butterfly (D sekitar 1,27 XA) dan Crab (1,618 XA) memiliki D di luar X; Gartley dan Bat tidak.' },
  { q: 'Di mana stop loss pola Gartley bullish menurut Astronacci?', pilihan: ['Sedikit di bawah titik X', 'Di titik C', 'Di atas titik A', 'Tidak perlu stop'], benar: 0,
    ket: 'Stop ditempatkan sedikit di bawah X; bila harga menembusnya, pola batal.' },
  { q: 'Modal Rp10 juta, risiko 2% per transaksi, entry 500, stop 470. Berapa lot maksimal?', pilihan: ['2 lot', '6 lot', '66 lot', '200 lot'], benar: 2,
    ket: 'Risiko Rp200.000. Rugi per lot bila stop tersentuh = (500 - 470) x 100 lembar = Rp3.000. 200.000 / 3.000 = 66 lot (dibulatkan ke bawah).' },
  { q: 'Kondisi pasar mana yang paling tidak cocok untuk Harmonic Pattern?', pilihan: ['Tren panjang yang mulai lelah', 'Pasar choppy tanpa swing tegas', 'Saham likuid di time frame Daily', 'Pola searah tren besar'], benar: 1,
    ket: 'Di pasar choppy, rasio sulit divalidasi dan sinyal palsu lebih sering.' },
]

export function nilaiKuis(jawab = {}) {
  const benar = KUIS.filter((k, i) => jawab[i] === k.benar).length
  return { benar, total: KUIS.length, dijawab: Object.keys(jawab).length }
}
