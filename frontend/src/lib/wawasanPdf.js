// Unduhan satu topik tab Wawasan sebagai PDF bergaya makalah, memakai mesin materiPdf (sampul, daftar isi, bab per
// bagian). Isi dari deck presentasi topik itu; alat interaktif diganti uraian teksnya supaya tetap terbaca di kertas.
import { materiPdf } from './materiPdf.js'
import { LANGKAH_OB, bagianDeck, deckTopik } from './wawasanSlide.js'
import { deckBergambar } from './wawasanGambarSlide.js'
import { WARNA_HEX, svgMotif } from './wawasanMotif.js'

const TEKS_ALAT = {
  orderbook: { poin: LANGKAH_OB.map((l, i) => `Langkah ${i + 1}: ${l.ket}`) },
  kalkulator: { poin: [
    'Rugi maksimal = modal x persen risiko. Contoh rekaan: modal Rp100 juta, risiko 1% = Rp1 juta.',
    'Rugi per lembar = harga beli - stop. Beli Rp200, stop Rp188, rugi Rp12 per lembar.',
    'Jumlah lembar = rugi maksimal / rugi per lembar = 1.000.000 / 12 = 83.333 lembar, dibulatkan ke bawah menjadi 833 lot.',
    'Stop makin jauh, lot makin sedikit, tetapi rugi rupiahnya tetap sama. Belum termasuk komisi dan pajak.',
  ] },
}

// Slide siap cetak: alat interaktif diganti uraian, daftar periksa diberi kotak centang.
export function slideCetak(deck) {
  return deck.map(s => {
    if (s.alat) return { ...s, poin: [...(s.poin || []), ...TEKS_ALAT[s.alat].poin] }
    if (s.periksa) return { ...s, poin: s.poin.map(t => `[  ] ${t}`) }
    return s
  })
}

export function wawasanPdf(k, menu, jsPDF, slide = slideCetak(deckTopik(k, menu))) {
  return materiPdf({
    slide, bagian: bagianDeck(slide),
    meta: {
      seri: `Wawasan · ${menu}`, besar: 'ILMU', judul: k.judul, label: `Materi tab Wawasan · ${menu}`,
      sub: k.kenapa, sumber: ['Menu', menu],
      catatan: 'Bahan belajar dari tab Wawasan Radar Backdoor. Contoh dan skenario memakai angka rekaan. Bukan saran membeli atau menjual efek.',
    },
  }, jsPDF)
}

export const wawasanPdfName = (k, bergambar = false) => `Wawasan-${k.id}${bergambar ? '-bergambar' : ''}_${new Date().toISOString().slice(0, 10)}.pdf`

// Versi bergambar: motif analogi tiap slide dirasterisasi jadi PNG (rasterisasi(svg) -> Promise<dataURL>, disediakan
// pemanggil: canvas di browser) lalu dicetak bersama perumpamaannya.
export async function wawasanPdfBergambar(k, menu, jsPDF, rasterisasi) {
  const slide = await Promise.all(slideCetak(deckBergambar(k, menu)).map(async s =>
    s.motif ? { ...s, gambarPng: await rasterisasi(svgMotif(s.motif, WARNA_HEX)) } : s))
  return wawasanPdf(k, menu, jsPDF, slide)
}

// Rasterisasi SVG ke PNG lewat canvas (hanya di browser).
export function svgKePng(svg, lebar = 640, tinggi = 360) {
  return new Promise((ok, gagal) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = lebar; c.height = tinggi
      c.getContext('2d').drawImage(img, 0, 0, lebar, tinggi)
      ok(c.toDataURL('image/png'))
    }
    img.onerror = gagal
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })
}
