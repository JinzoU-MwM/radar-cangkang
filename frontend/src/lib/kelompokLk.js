// Kelompok untuk kartu "terbaik per kelompok" di tab Kinerja: Konglo, CPO, Backdoor, Tambang, Telekomunikasi,
// Migas, Properti, Konsumen. Klasifikasi dari profil Stockbit (x.kelas: sektor/sub/ind IDX-IC) dengan cadangan
// nama & ringkasan laporan bila profil belum diambil. Perbankan dan asuransi selalu dikecualikan.

// Grup konglomerasi besar BEI dan emiten anggotanya (kepemilikan pengendali yang dikenal publik).
export const KONGLO = {
  Salim: ['INDF', 'ICBP', 'SIMP', 'LSIP', 'IMAS', 'DNET', 'META'],
  'Sinar Mas': ['DSSA', 'INKP', 'TKIM', 'SMAR', 'BSDE', 'DUTI', 'SMMA', 'GEMS'],
  Astra: ['ASII', 'UNTR', 'AALI', 'AUTO', 'ASGR'],
  'Barito (Prajogo)': ['BRPT', 'TPIA', 'BREN', 'CUAN', 'PTRO', 'CDIA'],
  Djarum: ['TOWR', 'BELI'],
  Bakrie: ['BUMI', 'BRMS', 'ENRG', 'UNSP', 'DEWA', 'BNBR', 'VKTR'],
  MNC: ['BHIT', 'MNCN', 'BMTR', 'IPTV', 'KPIG', 'MSIN', 'BCAP', 'IATA'],
  Lippo: ['LPKR', 'LPPF', 'SILO', 'MLPL', 'MPPA', 'LPCK', 'LPLI', 'MLPT'],
  Adaro: ['ADRO', 'AADI', 'ADMR'],
  'Merdeka/Saratoga': ['MDKA', 'MBMA', 'EMAS', 'SRTG'],
  Emtek: ['EMTK', 'SCMA', 'BUKA', 'SAME'],
  Triputra: ['TAPG', 'DRMA', 'ASSA'],
  Harita: ['NCKL', 'CITA'],
  Medco: ['MEDC', 'AMMN'],
  Indika: ['INDY'],
  'Haji Isam': ['JARR', 'PGUN'],
  'Happy Hapsoro': ['RAJA', 'RATU'],
  'Agung Sedayu': ['PANI', 'CBDK'],
  Ciputra: ['CTRA'],
  'Gudang Garam': ['GGRM'],
}
// Telekomunikasi & penunjangnya: operator, menara, internet/data center, serta komponen & peralatan kelistrikan
// (kabel) yang memasok jaringan. Ditambah emiten berklasifikasi "Telecommunication" di profil Stockbit.
export const TELKO = new Set([
  'TLKM', 'ISAT', 'EXCL', 'TOWR', 'TBIG', 'MTEL', 'LINK', 'BALI', 'CENT', 'GHON', 'JAST', 'DATA',
  'COIN', 'DOOH', 'DSSA', 'INET', 'IRSX', 'KETR', 'MORA', 'PADA', 'WIFI',
  'CCSI', 'IKBI', 'JECC', 'KBLI', 'KBLM', 'SCCO', 'VOKS',
])
const GRUP = Object.fromEntries(Object.entries(KONGLO).flatMap(([g, ks]) => ks.map(k => [k, g])))
export const grupKonglo = t => GRUP[t] || ''

const isiTeks = x => [x.nama, x.judul, x.ringkas, x.pendorong, ...(x.poin || [])].filter(Boolean).join(' ')
// Industri/subsektor profil bila ada; bila belum, teks laporan atau nama sektor (cadangan dari data Seasonality).
const cek = (x, rxKelas, rxTeks) => {
  const k = x.kelas?.ind || x.kelas?.sub
  return k ? rxKelas.test(k) : !!(rxTeks?.test(isiTeks(x)) || rxKelas.test(x.kelas?.sektor || ''))
}

export const bankAsuransi = x => /bank|insurance|asuransi/i.test([x.kelas?.sub, x.kelas?.ind].join(' '))
  || /\b(bank|asuransi|reasuransi|insurance|assurance)\b/i.test(x.nama || '')

export const KELOMPOK = [
  ['konglo', 'Konglo', x => !!grupKonglo(x.t)],
  ['cpo', 'CPO', x => cek(x, /plantation|crops|perkebunan/i, /\b(sawit|CPO|TBS|perkebunan|plantation)\b/i)],
  ['backdoor', 'Backdoor', x => !!x.radar],
  ['tambang', 'Tambang', x => cek(x, /coal|mining|metal|mineral/i, /\b(batu ?bara|tambang|pertambangan|penambangan|nikel|bijih|coal|mining)\b/i)],
  ['telko', 'Telekomunikasi & kabel', x => TELKO.has(x.t) || cek(x, /telecom/i, /\b(telekomunikasi|seluler|menara telekomunikasi|fiber optik)\b/i)],
  ['migas', 'Migas', x => cek(x, /oil|gas/i, /\b(minyak dan gas|migas|minyak bumi|gas bumi)\b/i)],
  ['properti', 'Properti', x => cek(x, /propert|real estate/i, /\b(properti|real estat|perumahan|kawasan industri)\b/i)],
  ['konsumen', 'Konsumen', x => cek(x, /food|beverage|tobacco|household|personal care|retail|konsumen primer/i, null)],
]

// Terbaik per kelompok: lolos `syarat`, bukan bank/asuransi, PE TTM terendah. Satu emiten hanya dipakai sekali
// (kelompok di depan didahulukan) agar setiap kartu berisi saham berbeda.
export function terbaikPerKelompok(rows, syarat) {
  const dipakai = new Set()
  return KELOMPOK.map(([k, label, cocok]) => {
    const x = rows.filter(r => !dipakai.has(r.t) && !bankAsuransi(r) && cocok(r) && syarat(r))
      .sort((a, b) => a.kuartal.pe - b.kuartal.pe)[0] || null
    if (x) dipakai.add(x.t)
    return { k, label, x }
  })
}
