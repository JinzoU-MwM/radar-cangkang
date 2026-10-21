// Tema presentasi unduhan: dipilih sesuai bisnis emiten, dan bervariasi tiap unduhan
// (varian berbeda dari unduhan sebelumnya). Warna hex tanpa '#', font hanya yang aman di Office.

// Kelompok sektor: kata kunci dicocokkan ke teks bisnis baru/aset/sektor Stockbit. Urutan = prioritas.
export const SECTORS = [
  // Pelayaran/logistik didahulukan: perusahaan angkutan batu bara tetap bisnis pelayaran, bukan tambang.
  { id: 'logistik', label: 'Logistik & pelayaran', motif: 'waves', re: /pelayaran|kapal|shipping|logistik|logistic|pelabuhan|\bport\b|angkutan|transport|kurir|tanker|galangan|tongkang|barge/i },
  { id: 'batubara', label: 'Tambang batu bara', motif: 'strata', re: /batu ?bara|coal|thermal/i },
  { id: 'logam', label: 'Logam, mineral & manufaktur', motif: 'hex', re: /pengecoran|casting|permesinan|mekanikal|manufaktur|komponen|nikel|nickel|smelter|baterai|battery|kobalt|cobalt|bauksit|emas|gold|tembaga|copper|mineral|tambang|mining|logam/i },
  { id: 'energi', label: 'Energi & migas', motif: 'rings', re: /energi|energy|minyak|migas|oil|gas|panas bumi|geothermal|listrik|pembangkit|ebt|surya|solar|hidro/i },
  { id: 'kesehatan', label: 'Kesehatan & farmasi', motif: 'plus', re: /rumah sakit|kesehatan|klinik|farmasi|obat|medis|health|hospital|jantung|pharma/i },
  { id: 'teknologi', label: 'Teknologi & telekomunikasi', motif: 'network', re: /teknologi|technology|digital|data center|pusat data|telekomunikasi|fiber|internet|software|aplikasi|platform|\bai\b|kripto|crypto|media|hiburan|entertain/i },
  { id: 'keuangan', label: 'Keuangan & investasi', motif: 'bars', re: /bank|keuangan|finance|financial|asuransi|investasi|investment|holding|modal ventura|sekuritas|leasing|pembiayaan/i },
  { id: 'properti', label: 'Properti & konstruksi', motif: 'blocks', re: /properti|property|real estate|hotel|konstruksi|construction|kawasan|perumahan|semen|beton|baja|kontraktor|infrastruktur/i },
  { id: 'konsumer', label: 'Konsumer & pangan', motif: 'dots', re: /makanan|minuman|food|beverage|pangan|ritel|retail|restoran|kuliner|susu|dairy|udang|shrimp|perikanan|agri|sawit|cpo|kemasan|fmcg|otomotif|dealer|tekstil|garmen|furnitur|mebel/i },
  { id: 'umum', label: 'Umum', motif: 'grid', re: /.^/ },
]

// Tiga varian per sektor. dark = latar sampul & pita kesimpulan; accent = angka besar & label;
// accent2 = sorotan di latar gelap; bg = latar slide isi; card = kartu; ink/muted = teks.
const T = (id, name, c) => ({ id, name, good: '2BA36B', warn: 'E39B2D', bad: 'D2434F', card: 'FFFFFF', ...c })
export const THEMES = {
  batubara: [
    T('batubara-arang', 'Arang & Amber', { dark: '1C1C1E', dark2: '2E2E33', accent: 'C8781A', accent2: 'F4B860', bg: 'F4F3F1', ink: '1C1C1E', muted: '6B6B70', line: 'DEDBD6', head: 'Cambria', body: 'Calibri' }),
    T('batubara-bara', 'Bara Merah', { dark: '231815', dark2: '3A2722', accent: 'B3471D', accent2: 'F08A4B', bg: 'F5F2F0', ink: '231815', muted: '6E625D', line: 'E3D9D4', head: 'Bookman Old Style', body: 'Arial' }),
    T('batubara-baja', 'Baja & Kuning Tambang', { dark: '20262E', dark2: '323B46', accent: 'A9780B', accent2: 'F2C230', bg: 'F2F4F6', ink: '20262E', muted: '5E6874', line: 'D7DDE3', head: 'Century Schoolbook', body: 'Calibri' }),
  ],
  logam: [
    T('logam-nikel', 'Hijau Nikel', { dark: '0F2A24', dark2: '1A3D35', accent: '17806B', accent2: '5FD3B5', bg: 'F1F6F4', ink: '0F2A24', muted: '55706A', line: 'D3E2DD', head: 'Cambria', body: 'Calibri' }),
    T('logam-kobalt', 'Biru Kobalt', { dark: '0E1B3D', dark2: '1B2C5A', accent: '2850B4', accent2: '8FB0FF', bg: 'F2F4FA', ink: '0E1B3D', muted: '5A6584', line: 'D6DCEC', head: 'Bookman Old Style', body: 'Calibri' }),
    T('logam-tembaga', 'Tembaga', { dark: '2B1A12', dark2: '43291C', accent: 'A85A2A', accent2: 'E8A070', bg: 'F6F2EF', ink: '2B1A12', muted: '75625A', line: 'E5D8CF', head: 'Century Schoolbook', body: 'Arial' }),
  ],
  energi: [
    T('energi-surya', 'Surya', { dark: '14213D', dark2: '22335A', accent: 'D9821C', accent2: 'FFC857', bg: 'F3F5F9', ink: '14213D', muted: '5C6680', line: 'D9DFEA', head: 'Cambria', body: 'Calibri' }),
    T('energi-panasbumi', 'Panas Bumi', { dark: '1B2A22', dark2: '2B4033', accent: 'C2562B', accent2: 'F2A65A', bg: 'F3F5F2', ink: '1B2A22', muted: '5E6D63', line: 'D9E0D9', head: 'Bookman Old Style', body: 'Calibri' }),
    T('energi-hidro', 'Hidro', { dark: '0B2638', dark2: '133A54', accent: '1A7FA8', accent2: '6CCFF6', bg: 'F1F6F9', ink: '0B2638', muted: '557083', line: 'D2E2EC', head: 'Century Schoolbook', body: 'Arial' }),
  ],
  kesehatan: [
    T('kesehatan-toska', 'Toska Medis', { dark: '0E3B43', dark2: '165560', accent: '0E8A8F', accent2: '6FE3DA', bg: 'F2F8F8', ink: '0E3B43', muted: '55767A', line: 'D2E6E6', head: 'Cambria', body: 'Calibri' }),
    T('kesehatan-biru', 'Biru Klinis', { dark: '102A4C', dark2: '1A3E6B', accent: '2F6FB5', accent2: '9CC8F5', bg: 'F3F7FB', ink: '102A4C', muted: '5A6D86', line: 'D7E2EF', head: 'Century Schoolbook', body: 'Calibri' }),
    T('kesehatan-jantung', 'Merah Jantung', { dark: '2E1A24', dark2: '472836', accent: 'B83A55', accent2: 'F28CA0', bg: 'F8F4F6', ink: '2E1A24', muted: '74606A', line: 'EADBE0', head: 'Bookman Old Style', body: 'Arial' }),
  ],
  teknologi: [
    T('teknologi-sian', 'Biru Sian', { dark: '0B1F33', dark2: '1B2A3A', accent: '0E7C86', accent2: '3DD6D0', bg: 'F3F6F9', ink: '0B1F33', muted: '5B6B7B', line: 'D8E0E8', head: 'Cambria', body: 'Calibri' }),
    T('teknologi-ungu', 'Ungu Digital', { dark: '1A1433', dark2: '2A2150', accent: '5B3FC4', accent2: 'A897FF', bg: 'F4F3FA', ink: '1A1433', muted: '625C80', line: 'DCD8EE', head: 'Century Schoolbook', body: 'Calibri' }),
    T('teknologi-neon', 'Hijau Data', { dark: '0D1F1A', dark2: '173029', accent: '128A5C', accent2: '45E39B', bg: 'F2F6F4', ink: '0D1F1A', muted: '566E66', line: 'D4E3DC', head: 'Bookman Old Style', body: 'Arial' }),
  ],
  keuangan: [
    T('keuangan-emas', 'Biru Tua & Emas', { dark: '0F1E3A', dark2: '1C2E54', accent: 'A07A1F', accent2: 'E5C46B', bg: 'F4F5F8', ink: '0F1E3A', muted: '5C6680', line: 'DADEE8', head: 'Cambria', body: 'Calibri' }),
    T('keuangan-zamrud', 'Zamrud', { dark: '0E2B23', dark2: '184036', accent: '1F7A5C', accent2: '7FD6B2', bg: 'F2F6F4', ink: '0E2B23', muted: '56706A', line: 'D4E2DC', head: 'Century Schoolbook', body: 'Calibri' }),
    T('keuangan-anggur', 'Anggur', { dark: '2A1426', dark2: '42203C', accent: '8E2F6E', accent2: 'E39AC9', bg: 'F7F3F6', ink: '2A1426', muted: '74606F', line: 'E8DAE4', head: 'Bookman Old Style', body: 'Arial' }),
  ],
  logistik: [
    T('logistik-samudra', 'Samudra', { dark: '082A44', dark2: '113E61', accent: '1066A5', accent2: '62B8F2', bg: 'F1F5F9', ink: '082A44', muted: '546C80', line: 'D3E0EB', head: 'Cambria', body: 'Calibri' }),
    T('logistik-pelabuhan', 'Pelabuhan Jingga', { dark: '1C2733', dark2: '2C3A4A', accent: 'D0641E', accent2: 'F7A15E', bg: 'F3F5F7', ink: '1C2733', muted: '5D6976', line: 'D9DFE5', head: 'Bookman Old Style', body: 'Calibri' }),
    T('logistik-toska', 'Laut Toska', { dark: '0A2E33', dark2: '13444B', accent: '138C8C', accent2: '67DADA', bg: 'F1F7F7', ink: '0A2E33', muted: '54726F', line: 'D2E5E4', head: 'Century Schoolbook', body: 'Arial' }),
  ],
  properti: [
    T('properti-terakota', 'Terakota', { dark: '2B1B17', dark2: '432B25', accent: 'B5533C', accent2: 'EE9A80', bg: 'F6F3F1', ink: '2B1B17', muted: '75635D', line: 'E5D9D3', head: 'Cambria', body: 'Calibri' }),
    T('properti-beton', 'Beton & Hijau', { dark: '23282B', dark2: '363D41', accent: '4E7D4B', accent2: 'A6D49F', bg: 'F3F4F3', ink: '23282B', muted: '626A6E', line: 'DCDFDD', head: 'Century Schoolbook', body: 'Calibri' }),
    T('properti-batu', 'Batu Biru', { dark: '1A2433', dark2: '29364A', accent: '42638F', accent2: 'A3BBDD', bg: 'F3F5F8', ink: '1A2433', muted: '5E6A7B', line: 'D9DFE8', head: 'Bookman Old Style', body: 'Arial' }),
  ],
  konsumer: [
    T('konsumer-paprika', 'Paprika', { dark: '2A1512', dark2: '45231E', accent: 'C0392B', accent2: 'F59B88', bg: 'F8F4F3', ink: '2A1512', muted: '77605B', line: 'EBDAD6', head: 'Cambria', body: 'Calibri' }),
    T('konsumer-daun', 'Daun Segar', { dark: '15291A', dark2: '224029', accent: '3A8A3F', accent2: '9EDB8C', bg: 'F3F7F2', ink: '15291A', muted: '5C705F', line: 'D8E5D6', head: 'Century Schoolbook', body: 'Calibri' }),
    T('konsumer-madu', 'Madu', { dark: '2B210F', dark2: '45361A', accent: 'B9801A', accent2: 'F5C86A', bg: 'F7F5F1', ink: '2B210F', muted: '766B58', line: 'E8E1D3', head: 'Bookman Old Style', body: 'Arial' }),
  ],
  umum: [
    T('umum-arang', 'Arang Minimal', { dark: '212529', dark2: '343A40', accent: '3D5A80', accent2: '98C1D9', bg: 'F3F4F6', ink: '212529', muted: '5F666D', line: 'DDE0E4', head: 'Cambria', body: 'Calibri' }),
    T('umum-ceri', 'Ceri & Biru Tua', { dark: '1E2761', dark2: '2C3778', accent: '990011', accent2: 'F28C8C', bg: 'F5F6FA', ink: '1E2761', muted: '5D6385', line: 'DCDFEC', head: 'Century Schoolbook', body: 'Calibri' }),
    T('umum-hutan', 'Hutan', { dark: '1F2E22', dark2: '2E4433', accent: '2C5F2D', accent2: '97BC62', bg: 'F3F6F2', ink: '1F2E22', muted: '5E6E60', line: 'D9E2D7', head: 'Bookman Old Style', body: 'Arial' }),
  ],
}

// Sektor dari teks bisnis: bisnis baru (story), aset injeksi, lalu sektor/industri Stockbit, lalu nama.
export function sectorOf({ baru = '', aset = '', sektor = '', industri = '', nama = '' } = {}) {
  for (const src of [baru, aset, sektor + ' ' + industri, nama]) {
    const s = String(src || '')
    if (!s.trim()) continue
    const hit = SECTORS.find(x => x.id !== 'umum' && x.re.test(s))
    if (hit) return hit
  }
  return SECTORS.find(x => x.id === 'umum')
}

// Varian: pilihan pengguna bila ada; selain itu acak di sektor itu, tidak sama dengan unduhan sebelumnya.
export function pickTheme(sectorId, { lastId = '', choose = '', rand = Math.random } = {}) {
  const list = THEMES[sectorId] || THEMES.umum
  const all = Object.values(THEMES).flat()
  if (choose) return all.find(t => t.id === choose) || list[0]
  const pool = list.filter(t => t.id !== lastId)
  return pool[Math.floor(rand() * pool.length) % pool.length] || list[0]
}
