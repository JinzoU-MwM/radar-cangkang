// Gambar analogi diam untuk presentasi bergambar tab Wawasan, sebagai string SVG murni supaya bisa dipakai di
// layar (warna token CSS) dan di PDF (warna hex, dirasterisasi lewat canvas). Setiap motif menerima label pendek
// a, b, c, d yang menjelaskan perumpamaannya. Tanpa animasi. Data murni, tanpa DOM.

// Warna token tema terang (tokens.css) untuk PDF; versi layar memakai var(--…).
export const WARNA_HEX = {
  ink: '#16241d', ink2: '#4f6157', sheet: '#ffffff', sheet2: '#f6f8f5', rule: '#c9d4cb',
  accent: '#0f3b2e', accentSoft: '#e1ebe4', good: '#17734f', goodBg: '#def0e6', strong: '#b42318', strongBg: '#fbe9e7',
  warn: '#8f5b00', warnBg: '#fbf0d9', calm: '#4f6157', vizA: '#5470b0', now: '#e8590c',
}
export const WARNA_CSS = {
  ink: 'var(--ink)', ink2: 'var(--ink-2)', sheet: 'var(--sheet)', sheet2: 'var(--sheet-2)', rule: 'var(--rule)',
  accent: 'var(--accent)', accentSoft: 'var(--accent-soft)', good: 'var(--good)', goodBg: 'var(--good-bg)', strong: 'var(--strong)',
  strongBg: 'var(--strong-bg)', warn: 'var(--warn)', warnBg: 'var(--warn-bg)', calm: 'var(--calm)', vizA: 'var(--viz-a)', now: 'var(--now)',
}

const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const teks = (W, x, y, t, { size = 12, bold = true, warna = 'ink', anchor = 'middle' } = {}) => t
  ? `<text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${bold ? 700 : 500}" fill="${W[warna]}" text-anchor="${anchor}">${esc(t)}</text>` : ''

// Setiap motif: (W, {a, b, c, d, berat}) -> isi SVG (viewBox 320 x 180).
const MOTIF = {
  timbangan: (W, { a, b, berat }) => {
    const r = berat === 'a' ? -8 : berat === 'b' ? 8 : 0
    return `<line x1="160" y1="60" x2="160" y2="160" stroke="${W.ink2}" stroke-width="4"/><path d="M128 162 h64" stroke="${W.ink2}" stroke-width="4"/>
      <g transform="rotate(${r} 160 60)"><line x1="64" y1="60" x2="256" y2="60" stroke="${W.ink2}" stroke-width="4"/>
      <path d="M34 60 h60 l-10 28 h-40 z" fill="${berat === 'a' ? W.strongBg : W.goodBg}" stroke="${berat === 'a' ? W.strong : W.good}" stroke-width="2"/>
      <path d="M226 60 h60 l-10 28 h-40 z" fill="${berat === 'b' ? W.strongBg : W.goodBg}" stroke="${berat === 'b' ? W.strong : W.good}" stroke-width="2"/></g>
      <circle cx="160" cy="58" r="6" fill="${W.ink2}"/>
      ${teks(W, 64, 128 + (berat === 'a' ? 14 : berat === 'b' ? -14 : 0), a, { size: 11 })}${teks(W, 256, 128 + (berat === 'b' ? 14 : berat === 'a' ? -14 : 0), b, { size: 11 })}`
  },
  tangga: (W, { a, b }) => {
    const tangga = (x, h, warna) => `<path d="M${x} 150 ${[0, 1, 2, 3].map(() => `h26 v-${h}`).join(' ')} h26" fill="none" stroke="${W[warna]}" stroke-width="4" stroke-linejoin="round"/>`
    return b
      ? `${tangga(20, 26, 'strong')}${teks(W, 84, 168, a, { size: 11 })}${tangga(184, 7, 'good')}${teks(W, 248, 168, b, { size: 11 })}`
      : `${tangga(80, 24, 'accent')}${teks(W, 104, 166, a, { size: 11 })}${teks(W, 240, 40, '', {})}`
  },
  kaca: (W, { a }) => `<rect x="70" y="16" width="110" height="136" rx="8" fill="${W.sheet}" stroke="${W.rule}" stroke-width="2"/>
      ${[0, 1, 2, 3, 4, 5].map(i => `<line x1="86" x2="${164 - (i % 2) * 24}" y1="${46 + i * 18}" y2="${46 + i * 18}" stroke="${W.rule}" stroke-width="4" stroke-linecap="round"/>`).join('')}
      <circle cx="186" cy="92" r="40" fill="${W.accentSoft}" fill-opacity=".7" stroke="${W.accent}" stroke-width="6"/><line x1="214" y1="120" x2="258" y2="164" stroke="${W.accent}" stroke-width="10" stroke-linecap="round"/>
      ${teks(W, 125, 174, a, { size: 11 })}`,
  rambu: (W, { a }) => `<path d="M160 18 L256 160 H64 Z" fill="${W.warnBg}" stroke="${W.warn}" stroke-width="6" stroke-linejoin="round"/>
      <rect x="153" y="62" width="14" height="52" rx="4" fill="${W.warn}"/><circle cx="160" cy="132" r="8" fill="${W.warn}"/>${teks(W, 160, 176, a)}`,
  lampu: (W, { a, b, c }) => `<rect x="96" y="12" width="56" height="156" rx="16" fill="${W.ink}"/>
      <circle cx="124" cy="44" r="18" fill="${W.strong}"/><circle cx="124" cy="90" r="18" fill="${W.warn}"/><circle cx="124" cy="136" r="18" fill="${W.good}"/>
      ${teks(W, 166, 48, a, { anchor: 'start' })}${teks(W, 166, 94, b, { anchor: 'start' })}${teks(W, 166, 140, c, { anchor: 'start' })}`,
  jamPasir: (W, { a }) => `<path d="M110 20 h100 M110 160 h100" stroke="${W.ink2}" stroke-width="6" stroke-linecap="round"/>
      <path d="M118 22 C118 70 152 76 152 90 C152 104 118 110 118 158 H202 C202 110 168 104 168 90 C168 76 202 70 202 22 Z" fill="${W.sheet}" stroke="${W.ink2}" stroke-width="3"/>
      <path d="M128 40 C132 64 156 76 160 88 C164 76 188 64 192 40 Z" fill="${W.warnBg}" stroke="${W.warn}"/><path d="M130 156 C140 128 180 128 190 156 Z" fill="${W.warn}"/>${teks(W, 160, 178, a)}`,
  kalender: (W, { a, b, c }) => `<rect x="30" y="22" width="260" height="128" rx="10" fill="${W.sheet}" stroke="${W.rule}" stroke-width="2"/><rect x="30" y="22" width="260" height="26" rx="10" fill="${W.accent}"/>
      ${[a, b, c].map((t, i) => t ? `<rect x="${50 + i * 84}" y="66" width="56" height="48" rx="6" fill="${[W.goodBg, W.warnBg, W.strongBg][i]}" stroke="${[W.good, W.warn, W.strong][i]}" stroke-width="2"/>${teks(W, 78 + i * 84, 96, String(i + 1), { size: 18, warna: ['good', 'warn', 'strong'][i] })}${teks(W, 78 + i * 84, 136, t, { size: 10 })}` : '').join('')}
      ${[a, b].map((t, i) => t && [a, b, c][i + 1] ? `<path d="M${110 + i * 84} 90 h16 l-5 -5 m5 5 l-5 5" stroke="${W.ink2}" stroke-width="2" fill="none"/>` : '').join('')}`,
  catatan: (W, { a, b, c }) => `<rect x="44" y="14" width="232" height="156" rx="8" fill="${W.sheet}" stroke="${W.rule}" stroke-width="2"/><rect x="130" y="8" width="60" height="16" rx="4" fill="${W.ink2}"/>
      ${[a, b, c].map((t, i) => t ? `<rect x="60" y="${44 + i * 40}" width="18" height="18" rx="3" fill="none" stroke="${W.good}" stroke-width="2.5"/><path d="M63 ${53 + i * 40} l5 5 l9 -11" fill="none" stroke="${W.good}" stroke-width="3" stroke-linecap="round"/>${teks(W, 88, 58 + i * 40, t, { anchor: 'start', size: 11 })}` : '').join('')}`,
  peta: (W, { a, b }) => `<path d="M40 140 C90 60 140 160 190 90 S260 40 280 50" fill="none" stroke="${W.accent}" stroke-width="4" stroke-dasharray="8 7" stroke-linecap="round"/>
      <circle cx="40" cy="140" r="9" fill="${W.good}"/><line x1="280" y1="50" x2="280" y2="14" stroke="${W.ink2}" stroke-width="3"/><path d="M280 14 h26 l-6 8 l6 8 h-26 z" fill="${W.strong}"/>
      ${teks(W, 44, 166, a, { size: 11, anchor: 'start' })}${teks(W, 276, 74, b, { size: 11, anchor: 'end' })}`,
  jebakan: (W, { a }) => `<rect x="60" y="120" width="200" height="22" rx="4" fill="${W.warnBg}" stroke="${W.warn}" stroke-width="3"/>
      <path d="M90 120 V70 H230 V120" fill="none" stroke="${W.ink2}" stroke-width="5"/><path d="M200 120 l26 -24 l14 24 z" fill="${W.warn}"/><circle cx="214" cy="110" r="3" fill="${W.warnBg}"/><circle cx="226" cy="114" r="2.5" fill="${W.warnBg}"/>
      ${teks(W, 160, 40, a)}${teks(W, 160, 166, 'kelihatannya umpan, ternyata jebakan', { size: 10, bold: false, warna: 'ink2' })}`,
  kompas: (W, { a }) => `<circle cx="160" cy="86" r="64" fill="${W.sheet}" stroke="${W.ink2}" stroke-width="5"/><circle cx="160" cy="86" r="52" fill="none" stroke="${W.rule}" stroke-width="2"/>
      <path d="M160 40 L172 86 L160 132 L148 86 Z" fill="${W.strong}"/><path d="M160 86 L172 86 L160 132 L148 86 Z" fill="${W.ink2}"/><circle cx="160" cy="86" r="5" fill="${W.sheet}"/>
      ${teks(W, 160, 30, 'U', { size: 11, warna: 'ink2' })}${teks(W, 160, 172, a)}`,
  ember: (W, { a }) => `<path d="M100 40 L118 150 H202 L220 40 Z" fill="${W.sheet}" stroke="${W.ink2}" stroke-width="4"/><path d="M106 70 L118 150 H202 L214 70 Z" fill="${W.vizA}" fill-opacity=".45"/>
      <path d="M100 40 Q160 0 220 40" fill="none" stroke="${W.ink2}" stroke-width="3"/>
      ${[0, 1, 2].map(i => `<path d="M${140 + i * 20} 154 q-4 8 0 12 q4 -4 0 -12" fill="${W.vizA}"/>`).join('')}${teks(W, 160, 178, a)}`,
  termometer: (W, { a }) => `<rect x="96" y="16" width="28" height="122" rx="14" fill="${W.sheet}" stroke="${W.ink2}" stroke-width="4"/><circle cx="110" cy="146" r="22" fill="${W.strong}"/>
      <rect x="104" y="60" width="12" height="86" fill="${W.strong}"/>${[0, 1, 2, 3].map(i => `<line x1="126" x2="138" y1="${36 + i * 24}" y2="${36 + i * 24}" stroke="${W.ink2}" stroke-width="2"/>`).join('')}
      ${teks(W, 152, 80, a, { anchor: 'start' })}`,
  struk: (W, { a, b, c }) => `<path d="M76 12 H244 V164 ${Array.from({ length: 7 }, () => 'l-12 8 l-12 -8').join(' ')} Z" fill="${W.sheet}" stroke="${W.rule}" stroke-width="2"/>
      ${teks(W, 160, 36, 'STRUK', { size: 11, warna: 'ink2' })}
      ${[a, b, c].map((t, i) => t ? `${teks(W, 90, 68 + i * 30, t, { anchor: 'start', size: 11 })}<line x1="90" x2="230" y1="${76 + i * 30}" y2="${76 + i * 30}" stroke="${W.rule}" stroke-dasharray="3 3"/>` : '').join('')}`,
  gunung: (W, { a, b }) => `<path d="M20 160 L110 40 L150 90 L190 60 L300 160 Z" fill="${W.accentSoft}" stroke="${W.accent}" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="110" cy="40" r="7" fill="${W.strong}"/>${teks(W, 110, 26, a, { size: 11 })}
      <path d="M200 84 l40 40" stroke="${W.strong}" stroke-width="3"/><path d="M240 124 l-12 0 m12 0 l0 -12" stroke="${W.strong}" stroke-width="3"/>${teks(W, 250, 142, b, { size: 11 })}`,
  toples: (W, { a, b }) => `<rect x="50" y="40" width="100" height="120" rx="16" fill="${W.sheet}" fill-opacity=".9" stroke="${W.ink2}" stroke-width="4"/><rect x="58" y="24" width="84" height="18" rx="4" fill="${W.ink2}"/>
      ${[0, 1, 2, 3, 4, 5, 6].map(i => `<ellipse cx="${72 + (i % 4) * 18}" cy="${148 - Math.floor(i / 4) * 12}" rx="10" ry="5" fill="${W.warn}" stroke="${W.warnBg}"/>`).join('')}
      ${teks(W, 166, 90, a, { anchor: 'start', size: 11 })}${teks(W, 166, 110, b, { anchor: 'start', size: 11 })}`,
  palu: (W, { a }) => `<rect x="70" y="140" width="120" height="18" rx="4" fill="${W.warn}"/><g transform="rotate(-30 150 90)"><rect x="110" y="60" width="80" height="34" rx="6" fill="${W.ink2}"/>
      <rect x="146" y="94" width="10" height="70" rx="4" fill="${W.warn}"/></g>${teks(W, 250, 100, a, { size: 11 })}`,
  roda: (W, { a, b, c, d }) => [a, b, c, d].map((t, i) => {
    const s = (i * 90 - 90) * Math.PI / 180, e = (i * 90) * Math.PI / 180, R = 70
    const w = [W.vizA, W.good, W.strong, W.warn][i]
    return `<path d="M160 90 L${160 + R * Math.cos(s)} ${90 + R * Math.sin(s)} A${R} ${R} 0 0 1 ${160 + R * Math.cos(e)} ${90 + R * Math.sin(e)} Z" fill="${w}" fill-opacity=".85" stroke="${W.sheet}" stroke-width="3"/>
      ${teks(W, 160 + 92 * Math.cos(s + Math.PI / 4), 94 + 92 * Math.sin(s + Math.PI / 4), t, { size: 11, anchor: Math.cos(s + Math.PI / 4) > 0 ? 'start' : 'end' })}`
  }).join('') + `<circle cx="160" cy="90" r="16" fill="${W.sheet}"/>`,
}

export const DAFTAR_MOTIF = Object.keys(MOTIF)

// String SVG lengkap untuk satu motif. warna: WARNA_CSS (layar) atau WARNA_HEX (PDF).
export function svgMotif(m, warna = WARNA_CSS) {
  const f = MOTIF[m?.m]
  if (!f) return ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="640" height="360"><rect width="320" height="180" rx="12" fill="${warna.sheet2}"/>${f(warna, m)}</svg>`
}
