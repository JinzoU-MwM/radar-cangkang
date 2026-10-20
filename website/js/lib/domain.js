/* Radar Cangkang — modul domain: konstanta bisnis & util murni (tanpa DOM/state).
   Semua yang di sini bisa diimpor & diuji terpisah dari UI. */

// Tahapan backdoor listing yang lazim di BEI, berurutan.
export const STAGES = [
  { id: "radar",   name: "Penyaringan",          hint: "Sebelum pengumuman: kabar pasar, anomali volume" },
  { id: "spa",     short: "PPJB",    name: "Penandatanganan PPJB", hint: "Keterbukaan informasi PPJB bersyarat atas saham pengendali" },
  { id: "tender",  short: "PTW",     name: "Penyelesaian & PTW",   hint: "Perubahan pengendalian efektif; penawaran tender wajib ke publik" },
  { id: "rupslb",  short: "RUPSLB",  name: "RUPSLB",               hint: "Persetujuan perubahan KBLI, nama, pengurus, anggaran dasar" },
  { id: "injeksi", short: "Injeksi", name: "Injeksi aset",         hint: "PMHMETD/PMTHMETD, inbreng aset ke perseroan" },
  { id: "selesai", short: "Pasca",   name: "Pascatransaksi",       hint: "Usaha baru terkonsolidasi dalam laporan keuangan" },
];

// Bobot faktor penyaringan; total 100. `auto` dihitung dari data pasar.
export const SIGNALS = [
  { id: "akuisisi", short: "Perubahan pengendalian", label: "Perubahan pengendalian / PPJB bersyarat diumumkan", w: 25 },
  { id: "kbli",     short: "Perubahan usaha",        label: "Perubahan kegiatan usaha (KBLI) atau nama perseroan", w: 15 },
  { id: "rights",   short: "Rencana dilusi",         label: "Rencana PMHMETD / PMTHMETD berskala besar", w: 15 },
  { id: "cangkang", short: "Profil cangkang",        label: "Profil cangkang: pendapatan minim, merugi, atau defisiensi modal", w: 10 },
  { id: "direksi",  short: "Rombak pengurus",        label: "Perombakan direksi/komisaris di luar siklus RUPST", w: 5 },
  { id: "uma",      short: "UMA/suspensi",           label: "UMA atau penghentian sementara perdagangan oleh BEI", w: 5 },
  { id: "volume",   short: "Anomali volume",         label: "Anomali volume tanpa katalis publik", w: 5 },
  { id: "smallcap", short: "Kapitalisasi mikro",     label: "Kapitalisasi mikro: kapitalisasi pasar < Rp500 miliar", w: 10, auto: d => num(d.mcap) !== null && num(d.mcap) < 500 },
  { id: "lowprice", short: "Harga rendah",           label: "Saham berharga rendah: harga ≤ Rp100", w: 10, auto: d => num(d.price) !== null && num(d.price) <= 100 },
];

// Tonggak transaksi pengambilalihan, berurutan; bobot total 100 = transaksi tuntas.
export const MILESTONES = [
  { id: "spa",       label: "Penandatanganan PPJB bersyarat", w: 10 },
  { id: "akuisisi",  label: "Penyelesaian transaksi: perubahan pengendalian efektif", w: 15 },
  { id: "to_umum",   label: "Pernyataan penawaran tender wajib diumumkan", w: 10 },
  { id: "to_selesai",label: "Penawaran tender wajib selesai dan dibayar", w: 15 },
  { id: "rupslb",    label: "RUPSLB menyetujui perubahan usaha, nama, dan pengurus", w: 15 },
  { id: "rights",    label: "PMHMETD/PMTHMETD disetujui", w: 15 },
  { id: "inbreng",   label: "Injeksi aset efektif (inbreng/akuisisi entitas anak)", w: 10 },
  { id: "bisnis",    label: "Usaha baru terkonsolidasi dalam laporan keuangan", w: 10 },
];
// Perkiraan bila milestone belum diisi: posisi awal tiap tahap.
export const STAGE_PCT = { radar: 0, spa: 10, tender: 35, rupslb: 50, injeksi: 65, selesai: 100 };

export function progressOf(d) {
  const ms = d.ms || {};
  const done = MILESTONES.filter(m => ms[m.id]);
  const next = MILESTONES.find(m => !ms[m.id]);
  if (!done.length) return { pct: STAGE_PCT[stageOf(d)] ?? 0, est: true, next: null };
  return { pct: done.reduce((s, m) => s + m.w, 0), est: false, next };
}

export const UTYPES = [
  { id: "pengendali", name: "Pengendalian & akuisisi" },
  { id: "tender",     name: "Penawaran tender wajib" },
  { id: "rupslb",     name: "RUPSLB" },
  { id: "rights",     name: "Penambahan modal/injeksi aset" },
  { id: "uma",        name: "UMA/suspensi" },
  { id: "regulasi",   name: "Regulasi & pasar" },
  { id: "lainnya",    name: "Lainnya" },
];

export const LS_KEY = "radar-cangkang.v1", LS_UPD = "radar-cangkang.updates.v1", LS_VIEW = "radar-cangkang.view", LS_SEEN = "radar-cangkang.seen";
export const $ = id => document.getElementById(id);
export const num = v => (v === "" || v === null || v === undefined || isNaN(+v)) ? null : +v;
export const fmt = (v, d = 0) => v === null ? "–" : v.toLocaleString("id-ID", { maximumFractionDigits: d, minimumFractionDigits: d });
export const fmtDate = s => { const d = new Date(s + "T00:00:00"); return isNaN(d) ? (s || "") : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }); };

export const scoreOf = d => SIGNALS.reduce((s, sig) => s + ((sig.auto ? sig.auto(d) : (d.flags || {})[sig.id]) ? sig.w : 0), 0);
export const statusOf = s => s >= 65 ? "strong" : s >= 35 ? "warn" : "calm";
export const STATUS_LABEL = { strong: "Keyakinan tinggi", warn: "Daftar pantau", calm: "Pemantauan" };
// Tahap = tahap dari tonggak terjauh yang sudah tercapai. Tanpa tonggak, pakai tahap yang dipilih manual.
export const MS_STAGE = [["bisnis", "selesai"], ["inbreng", "injeksi"], ["rights", "injeksi"], ["rupslb", "rupslb"],
  ["to_selesai", "tender"], ["to_umum", "tender"], ["akuisisi", "tender"], ["spa", "spa"]];
export const stageFromMs = ms => (MS_STAGE.find(([m]) => (ms || {})[m]) || [])[1];
export const stageOf = d => stageFromMs(d.ms) || d.stage || "radar";

// Tanggal dan sesi perdagangan BEI (jam WIB komputer ini; hari libur bursa tidak dihitung).
export function sessionLabel(now = new Date()) {
  const day = now.getDay(), m = now.getHours() * 60 + now.getMinutes(), fri = day === 5;
  if (day === 0 || day === 6) return "bursa libur";
  if (m < 540) return "sebelum pembukaan";
  if (m < (fri ? 690 : 720)) return "sesi I";
  if (m < (fri ? 840 : 810)) return "istirahat";
  if (m < 950) return "sesi II";
  return "bursa tutup";
}

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const rp = v => v == null ? "–" : "Rp" + Math.round(v).toLocaleString("id-ID");
export const big = v => v == null ? "–" : v >= 1e12 ? `Rp${(v / 1e12).toLocaleString("id-ID", { maximumFractionDigits: 2 })} T` : `Rp${(v / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
// Selisih persen; satu desimal bila di bawah 10% agar perbedaan kecil tidak hilang karena pembulatan.
export const pctTxt = (to, from) => {
  if (to == null || !from) return "–";
  const p = (to / from - 1) * 100;
  const s = Math.abs(p) < 10 ? p.toFixed(1).replace(".", ",") : p.toFixed(0);
  return `<span class="${p >= 0 ? "up" : "down"}">${p >= 0 ? "+" : ""}${s}%</span>`;
};

// Kolom Jadwal: sumbu waktu 120 hari ke belakang s.d. 60 hari ke depan, skala sama di setiap baris,
// sehingga garis "hari ini" tampil sebagai satu garis vertikal yang memotong seluruh tabel.
export const TL_PAST = 120, TL_FUT = 60, TL_TODAY = (TL_PAST / (TL_PAST + TL_FUT) * 100).toFixed(2);
export const MS_SHORT = { spa: "PPJB", akuisisi: "Kendali", to_umum: "PTW", to_selesai: "PTW selesai", rupslb: "RUPSLB", rights: "HMETD", inbreng: "Inbreng", bisnis: "Usaha baru" };
export const tlX = iso => {
  const days = (new Date(iso + "T00:00:00") - new Date(new Date().toDateString())) / 864e5;
  return days < -TL_PAST || days > TL_FUT ? null : ((days + TL_PAST) / (TL_PAST + TL_FUT) * 100).toFixed(2);
};
export function tlEvents(d) {
  const ev = Object.entries(d.msAuto || {}).filter(([, v]) => /^\d{4}-\d\d-\d\d/.test(v || ""))
    .map(([k, v]) => ({ label: MS_SHORT[k] || k, date: v.slice(0, 10) }));
  if (d.tender?.end) ev.push({ label: "Akhir PTW", date: d.tender.end.slice(0, 10) });
  if (d.tender?.paydate) ev.push({ label: "PTW dibayar", date: d.tender.paydate.slice(0, 10) });
  return ev.sort((a, b) => a.date.localeCompare(b.date));
}
export function timelineHtml(d) {
  const ev = tlEvents(d), today = new Date().toISOString().slice(0, 10);
  const t = d.tender, a = t?.start && tlX(t.start.slice(0, 10)), b = t?.end && tlX(t.end.slice(0, 10));
  const marks = ev.map(e => { const x = tlX(e.date); return x == null ? "" :
    `<span class="tl-ev${e.date > today ? " fut" : ""}" style="left:${x}%" title="${esc(e.label)} · ${esc(fmtDate(e.date))}"></span>`; }).join("");
  const bar = a != null && b != null ? `<span class="tl-bar" style="left:${a}%;width:${(b - a).toFixed(2)}%" title="Penawaran tender wajib ${esc(fmtDate(t.start))} s.d. ${esc(fmtDate(t.end))}"></span>` : "";
  const last = [...ev].reverse().find(e => e.date <= today), next = ev.find(e => e.date > today);
  const cap = [last && `${esc(last.label)} <b>${esc(fmtDate(last.date))}</b>`, next && `<span class="tl-next">${esc(next.label)} <b>${esc(fmtDate(next.date))}</b></span>`].filter(Boolean).join(" · ");
  // Tanpa tanggal sama sekali: jalur waktu tidak digambar, cukup keterangan.
  if (!ev.length && !bar) return `<div class="tl-cap tl-empty"><span class="nm" title="Belum ada tanggal tonggak di laporan">belum bertanggal</span></div>`;
  return `<div class="tl"><i class="tl-today" style="left:${TL_TODAY}%" title="Hari ini"></i>${bar}${marks}</div><div class="tl-cap">${cap}</div>`;
}
export const tlHead = () => `<th class="tl-th"><span>Jadwal</span><span class="tl-ax"><span style="left:0">−4 bln</span><span class="tl-now" style="left:${TL_TODAY}%">Hari ini</span><span style="right:0">+2 bln</span></span></th>`;

// Jadwal tahap: sel berlabel, terisi = lewat, oranye = tahap berjalan, putus-putus = belum.
export function stepsHtml(d) {
  const si = STAGES.findIndex(s => s.id === stageOf(d));
  return `<div class="steps" title="${esc((STAGES[si] || STAGES[0]).name)}">${STAGES.slice(1).map((s, i) =>
    `<i class="${i + 1 < si ? "done" : i + 1 === si ? "now" : ""}" title="${esc(s.name)}">${esc(s.short)}</i>`).join("")}</div>`;
}
export function sparkline(points) {
  if (!points || points.length < 2) return "";
  const W = 600, H = 120, P = 6, vals = points.map(p => p.v), lo = Math.min(...vals), hi = Math.max(...vals);
  const x = i => P + i * (W - 2 * P) / (points.length - 1), y = v => H - P - (hi === lo ? 0.5 : (v - lo) / (hi - lo)) * (H - 2 * P);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const last = points[points.length - 1];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Harga 1 tahun">
    <path d="${line}L${x(points.length - 1)},${H - P}L${P},${H - P}Z" fill="var(--accent)" fill-opacity=".12"></path>
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"></path>
    <circle cx="${x(points.length - 1)}" cy="${y(last.v)}" r="5" fill="var(--accent)" stroke="var(--sheet)" stroke-width="2" vector-effect="non-scaling-stroke"></circle></svg>
    <div class="nm">${esc(points[0].d)} – ${esc(last.d)} · terendah ${rp(lo)} · tertinggi ${rp(hi)}</div>`;
}
