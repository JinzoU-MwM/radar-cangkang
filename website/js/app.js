import {
  STAGES, SIGNALS, MILESTONES, STAGE_PCT, UTYPES,
  progressOf, num, fmt, fmtDate, scoreOf, statusOf,
  STATUS_LABEL, MS_STAGE, stageFromMs, stageOf,
  LS_KEY, LS_UPD, LS_VIEW, LS_SEEN,
  $,
} from './lib/domain.js';
import {
  sessionLabel, esc, rp, big, pctTxt, sparkline,
  TL_PAST, TL_FUT, TL_TODAY, MS_SHORT, tlX, tlEvents, timelineHtml, tlHead, stepsHtml,
} from './lib/domain.js';
import { donut, hbar, timeline as vizTimeline, heatGrid, kpi } from './lib/viz.js';

(() => {


  // ---- State & storage (db bersama, fallback localStorage) ----
  let items = [], updates = [];
  let col = null, updCol = null, feedType = "";

  const lsGet = (k, dflt) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : dflt; } catch { return dflt; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  // Server menyimpan respons Stockbit di cache SQLite. Klik tombol "Perbarui" manual memaksa data segar
  // selama 2 menit (cukup untuk seluruh rangkaian permintaannya); pembaruan otomatis tetap memakai cache.
  let freshUntil = 0;
  document.addEventListener("click", e => { if (e.target.closest("[data-sb], #sbReports, #storyRefresh")) freshUntil = Date.now() + 120e3; }, true);
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (url, opt) => nativeFetch(typeof url === "string" && url.startsWith("/api/") && url !== "/api/status" && Date.now() < freshUntil
    ? url + (url.includes("?") ? "&" : "?") + "fresh=1" : url, opt);
  // Notifikasi singkat di pojok kanan bawah.
  function toast(msg, bad = false) {
    const el = Object.assign(document.createElement("div"), { className: "toast" + (bad ? " bad" : ""), textContent: msg });
    $("toasts").append(el);
    setTimeout(() => el.remove(), 5000);
  }
  // Status di sidebar; hasil sinkron juga dimunculkan sebagai notifikasi.
  const setSync = t => {
    $("sync").textContent = t;
    if (/^(Stockbit \d|Diperbarui|Harga diperbarui)/.test(t)) toast(t, /gagal/.test(t));
  };

  // Angka ringkasan beranimasi saat berubah.
  function countTo(el, to) {
    const from = Number(el.dataset.v ?? el.textContent) || 0;
    el.dataset.v = to;
    if (from === to || matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = to; return; }
    const t0 = performance.now(), dur = 500;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---- Navigasi ----
  const VIEWS = ["potensi", "story", "progress", "update"];
  function show(view) {
    if (!VIEWS.includes(view)) view = "potensi";   // tautan lama #analisa → Potensi
    for (const v of VIEWS) {
      $("view-" + v).hidden = v !== view;
      $("nav-" + v).toggleAttribute("aria-current", v === view);
      if (v === view) $("nav-" + v).setAttribute("aria-current", "page");
    }
    lsSet(LS_VIEW, view);
    if (view === "story") setTimeout(() => loadStories(), 0); // data story dimuat saat menu dibuka
    if (view === "potensi") renderAnQuick();
    setTimeout(() => autoRefresh(view), 0);   // perbarui otomatis dari Stockbit (maks. sekali per 15 menit per jenis data)
    if (location.hash !== "#" + view) history.replaceState(null, "", "#" + view);
    window.scrollTo(0, 0);
  }
  document.querySelectorAll(".nav button").forEach(b => b.onclick = () => show(b.dataset.view));


  function paintToday() {
    const now = new Date();
    const txt = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short", year: "numeric" }) + " · " + sessionLabel(now);
    document.querySelectorAll("[data-today]").forEach(e => e.textContent = txt);
  }
  paintToday(); setInterval(paintToday, 60e3);

  // ---- Render emiten ----
  // Status transaksi: "selesai" bila pengambilalihan tuntas (penawaran tender wajib sudah dibayar)
  // atau seluruh tonggak tercapai; selain itu "proses".
  const dealOf = (d, p) => ((d.ms || {}).to_selesai || p.pct === 100 || stageOf(d) === "selesai") ? "selesai" : "proses";
  const DEAL_LABEL = { proses: "Proses", selesai: "Selesai" };
  let progFilter = "", progStageF = "", progSpecialF = "";

  function scoredItems() { return items.map(d => { const s = scoreOf(d), p = progressOf(d); return { ...d, score: s, status: statusOf(s), prog: p, deal: dealOf(d, p) }; }); }

  function progCell(p) {
    const el = document.createElement("div"); el.className = "prog";
    el.innerHTML = `<div class="prog-row"><span class="num">${p.pct}%</span><div class="pbar${p.est ? " est" : ""}"><i style="width:${p.pct}%"></i></div></div><small></small>`;
    el.querySelector("small").textContent = p.est ? "Estimasi berbasis tahap; verifikasi tonggak transaksi"
      : p.next ? "Katalis berikutnya: " + p.next.label : "Transaksi tuntas (pascatransaksi)";
    return el;
  }

  function tableFor(list, emptyMsg, withProg = false) {
    const wrap = document.createDocumentFragment();
    if (!list.length) {
      const e = document.createElement("div"); e.className = "empty";
      e.innerHTML = `<strong></strong><span></span>`;
      e.querySelector("strong").textContent = emptyMsg[0]; e.querySelector("span").textContent = emptyMsg[1];
      wrap.append(e); return wrap;
    }
    // Urut dari klik judul kolom (progSort); tanpa itu, pakai urutan bawaan dari pemanggil.
    const stageIdx = d => STAGES.findIndex(s => s.id === stageOf(d));
    const SORT = { ticker: d => d.ticker, deal: d => d.deal, pct: d => d.prog.pct, score: d => d.score, stage: stageIdx,
      price: d => num(d.price), mcap: d => num(d.mcap), ctrl: d => num(d.ctrlPct), float: d => num(d.float) };
    if (progSort.key && SORT[progSort.key]) {
      const f = SORT[progSort.key];
      list = [...list].sort((a, b) => {
        const x = f(a), y = f(b);
        if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
        return (typeof x === "string" ? x.localeCompare(y) : x - y) * progSort.dir;
      });
    }
    const maxCap = Math.max(1, ...list.map(d => num(d.mcap) || 0));
    const th = (k, label, cls = "") => `<th class="${cls}${progSort.key === k ? (progSort.dir > 0 ? " on-asc" : " on-desc") : ""}" data-sort="${k}" title="Klik untuk mengurutkan">${label}</th>`;

    const t = document.createElement("table");
    t.className = "grid-tbl";
    // Kolom berpasangan digabung (status+tahap, skor+keyakinan, harga+kapitalisasi, pengendali+publik) agar tabel muat tanpa geser ke kanan.
    t.innerHTML = `<thead><tr>${th("ticker", "Emiten target")}${th("stage", "Status · tahap")}${tlHead()}${withProg ? th("pct", "Penyelesaian") : ""}${th("score", "Skor · keyakinan")}
      ${th("mcap", "Harga · kap. pasar", "r")}${th("ctrl", "Pengendali · publik", "r")}<th>Faktor utama</th></tr></thead><tbody></tbody>`;
    t.querySelectorAll("th[data-sort]").forEach(h => h.onclick = () => {
      const k = h.dataset.sort;
      progSort = { key: k, dir: progSort.key === k ? -progSort.dir : (k === "ticker" || k === "deal" ? 1 : -1) };
      render();
    });
    const tb = t.querySelector("tbody");
    for (const d of list) {
      const tr = document.createElement("tr");
      tr.tabIndex = 0;
      tr.onclick = () => openProfile(d.id);
      tr.onkeydown = e => { if (e.key === "Enter") openProfile(d.id); };
      const active = SIGNALS.filter(s => s.auto ? s.auto(d) : (d.flags || {})[s.id]);
      const price = num(d.price), ptw = d.tender?.price, cap = num(d.mcap), ctrl = num(d.ctrlPct), fl = num(d.float);
      const vsPtw = price && ptw ? price / ptw - 1 : null;
      const si = stageIdx(d);
      tr.innerHTML = `
        <td><div><span class="tk"></span></div><div class="nm em-name"></div></td>
        <td><span class="pill d-${d.deal}">${DEAL_LABEL[d.deal]}</span>
          ${stepsHtml(d)}
          <div class="nm stg" hidden></div></td>
        <td class="tl-td">${timelineHtml(d)}</td>
        ${withProg ? "<td class=\"prog-td\"></td>" : ""}
        <td><div class="score s-${d.status}"><span class="num">${d.score}</span><div class="bar"><i style="width:${d.score}%"></i></div></div><span class="pill s-${d.status}">${STATUS_LABEL[d.status]}</span></td>
        <td class="r num"><b>Rp${fmt(price)}</b>${vsPtw != null ? `<div class="nm"><span class="${vsPtw >= 0 ? "up" : "down"}">${vsPtw >= 0 ? "+" : ""}${(vsPtw * 100).toFixed(0)}%</span> vs PTW</div>` : ""}
          <div class="nm">Kap. ${fmt(cap, 1)} M</div>${cap ? `<div class="hbar cap"><i style="width:${(Math.log10(cap + 1) / Math.log10(maxCap + 1) * 100).toFixed(0)}%"></i></div>` : ""}</td>
        <td class="r num ctrl-cell">${ctrl != null ? `<b>${fmt(ctrl, 2)}%</b><div class="hbar own"><i style="width:${Math.min(100, ctrl)}%"></i></div>` : "–"}
          <div class="pub-line">Publik ${fl != null ? `<b>${fmt(fl, 1)}%</b>` : "–"}${fl != null && fl < 7.5 ? ' <span class="pill s-strong" title="Di bawah batas minimum BEI 7,5%; pengendali wajib refloat dalam 2 tahun">&lt; 7,5%</span>' : ""}</div>
          ${fl != null ? `<div class="hbar pub${fl < 7.5 ? " low" : ""}"><i style="width:${Math.min(100, fl)}%"></i></div>` : ""}</td>
        <td><div class="chips"></div></td>`;
      const cc = tr.querySelector(".ctrl-cell");
      if (ctrl != null && d.ctrlName) {
        cc.querySelector(".hbar.own").after(Object.assign(document.createElement("div"), { className: "nm holder", textContent: d.ctrlName + (d.ctrlGuess ? " (pemegang terbesar*)" : "") }));
        if (d.ctrlGuess) cc.title = "Stockbit tidak memberi label pengendali; ditampilkan pemegang terbesar selain publik";
      }
      tr.querySelector(".tk").textContent = d.ticker;
      if (d.example) tr.querySelector(".tk").after(Object.assign(document.createElement("span"), { className: "ex", textContent: "contoh" }));
      tr.querySelector(".em-name").textContent = tr.querySelector(".em-name").title = [d.name, d.acquirer && "→ " + d.acquirer].filter(Boolean).join(" ");
      if (withProg) tr.querySelector(".prog-td").append(progCell(d.prog));
      tr.querySelector(".stg").textContent = (STAGES[si] || STAGES[0]).name;
      const chips = tr.querySelector(".chips");
      for (const s of active) chips.append(Object.assign(document.createElement("span"), { className: "chip c-" + s.id, textContent: s.short }));
      tb.append(tr);
    }
    // Sorot seluruh kolom saat kursor berada di salah satu selnya.
    const hiCol = idx => t.querySelectorAll("tr").forEach(r => [...r.children].forEach((c, i) => c.classList.toggle("col-hi", i === idx)));
    t.addEventListener("mouseover", e => { const c = e.target.closest("td,th"); if (c) hiCol(c.cellIndex); });
    t.addEventListener("mouseleave", () => hiCol(-1));
    wrap.append(t); return wrap;
  }
  let progSort = { key: "", dir: -1 };

  function render() {
    const all = scoredItems();
    const prog = all.filter(d => stageOf(d) !== "radar");
    const pot = all.filter(d => stageOf(d) === "radar");

    countTo($("cTotal"), all.length);
    countTo($("cStrong"), all.filter(d => d.status === "strong").length);
    countTo($("cWarn"), all.filter(d => d.status === "warn").length);
    $("nProg").textContent = prog.length || "";
    $("nPot").textContent = pot.length || "";

    // Papan tahapan sudah dihapus dari tampilan; tahap tetap terlihat di kolom "Tahap transaksi".
    const pipe = $("pipeline");
    if (pipe) pipe.replaceChildren();
    for (const st of pipe ? STAGES.slice(1) : []) {
      const inSt = all.filter(d => stageOf(d) === st.id)
        .sort((a, b) => (a.deal === b.deal ? 0 : a.deal === "proses" ? -1 : 1) || b.score - a.score);
      const el = document.createElement("div");
      el.className = "stage" + (inSt.length ? " has" : "");
      el.innerHTML = `<h3></h3><p class="hint"></p><div class="tick"></div>`;
      el.querySelector("h3").append(st.name + " ", Object.assign(document.createElement("span"), { className: "num", textContent: `(${inSt.length})` }));
      el.querySelector(".hint").textContent = st.hint;
      for (const d of inSt) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "s-" + d.status; b.textContent = d.ticker;
        b.append(Object.assign(document.createElement("span"), { className: "pc", textContent: d.prog.pct + "%" }));
        b.title = `${d.name || d.ticker} · penyelesaian ${d.prog.pct}%${d.prog.est ? " (estimasi)" : ""} · skor ${d.score}`;
        b.onclick = () => openProfile(d.id);
        el.querySelector(".tick").append(b);
      }
      pipe.append(el);
    }

    // Progress: semua emiten backdoor, dibedakan Proses/Selesai. Proses di atas, lalu persentase tertinggi.
    const nProses = prog.filter(d => d.deal === "proses").length, nSelesai = prog.length - nProses;
    countTo($("cProg"), nProses);

    // Tiga kelompok filter yang bisa digabung: status, tahap, dan kondisi khusus. Angka = jumlah sesudah filter lain.
    const SPECIAL = {
      belowPtw: { label: "Di bawah harga PTW", test: d => num(d.price) && d.tender?.price && num(d.price) < d.tender.price },
      lowFloat: { label: "Porsi publik < 7,5%", test: d => num(d.float) != null && num(d.float) < 7.5 },
      uma:      { label: "UMA / anomali volume", test: d => !!((d.flags || {}).uma || (d.flags || {}).volume) },
      guess:    { label: "Pengendali belum terverifikasi", test: d => !!d.ctrlGuess || num(d.ctrlPct) == null },
      highScore:{ label: "Skor ≥ 65", test: d => d.score >= 65 },
    };
    const q = ($("progQ").value || "").trim().toLowerCase();
    const pass = (d, skip) =>
      (skip === "status" || !progFilter || d.deal === progFilter) &&
      (skip === "stage" || !progStageF || stageOf(d) === progStageF) &&
      (skip === "special" || !progSpecialF || SPECIAL[progSpecialF].test(d)) &&
      (!q || [d.ticker, d.name, d.ctrlName, d.acquirer].some(v => (v || "").toLowerCase().includes(q)));
    const chipRow = (el, options, current, set, group) => {
      el.replaceChildren();
      for (const [id, label] of options) {
        const n = prog.filter(d => pass(d, group) && (!id || (group === "status" ? d.deal === id : group === "stage" ? stageOf(d) === id : SPECIAL[id].test(d)))).length;
        const b = Object.assign(document.createElement("button"), { type: "button", textContent: `${label} (${n})` });
        b.setAttribute("aria-pressed", String(current === id));
        if (!n && current !== id) b.disabled = true;
        b.onclick = () => { set(current === id && id ? "" : id); render(); };
        el.append(b);
      }
    };
    chipRow($("progFilter"), [["", "Semua"], ["proses", "Proses"], ["selesai", "Selesai"]], progFilter, v => progFilter = v, "status");
    chipRow($("progStage"), [["", "Semua tahap"], ...STAGES.slice(1).map(s => [s.id, s.name])], progStageF, v => progStageF = v, "stage");
    chipRow($("progSpecial"), [["", "Semua"], ...Object.entries(SPECIAL).map(([k, v]) => [k, v.label])], progSpecialF, v => progSpecialF = v, "special");

    const progList = prog.filter(d => pass(d))
      .sort((a, b) => (a.deal === b.deal ? 0 : a.deal === "proses" ? -1 : 1) || b.prog.pct - a.prog.pct || (b.tender?.start || "").localeCompare(a.tender?.start || ""));
    $("progCount").textContent = progList.length === prog.length ? `${nProses} proses · ${nSelesai} selesai` : `${progList.length} dari ${prog.length} emiten`;
    $("progTable").replaceChildren(tableFor(progList, ["Belum ada emiten backdoor", "Klik Perbarui dari Stockbit untuk menarik semua penawaran tender wajib di BEI."], true));

    // Potensi: saham backdoor yang sama dengan Progress, dilihat dari sisi potensi harga.
    $("nPot").textContent = prog.length || "";
    renderPotensi(prog);
    $("nStory").textContent = prog.length || "";
    renderStory(prog);

    renderFeed(); // tombol kode di berita bergantung pada isi register
  }

  // ---- Story Emiten ----
  // Cerita = data otomatis (profil + riwayat pemegang saham dari Stockbit, judul/ringkasan laporan) yang bisa dikoreksi manual (d.story).
  const BIZ_RE = /kegiatan usaha|KBLI|bidang usaha|maksud dan tujuan|beralih|transformasi|bisnis baru|model bisnis|fokus bisnis|lini bisnis|ekspansi ke|masuk ke (sektor|bisnis|industri)|perubahan nama|menjadi (platform|pemain|penyedia|perusahaan|superholding|holding)/i;
  const INJ_RE = /inbreng|penyetoran.*selain uang|HMETD|PMTHMETD|rights issue|private placement|penempatan terbatas|akuisisi|akusisi|pengambilalihan (saham|grup|PT|\w+ dan)|CSPA|PPJB|penyertaan|suntikan/i;
  // Jenis aset yang diinjeksi, dari kata kunci (urutan penting: yang spesifik dulu).
  const ASSET_TYPES = [
    [/batu ?bara|\bcoal\b/i, "Tambang batu bara"], [/nikel|nickel/i, "Tambang nikel"], [/\bemas\b|\bgold\b/i, "Tambang emas"],
    [/tambang|pertambangan|mining|mineral|bauksit|tembaga/i, "Tambang"],
    [/rumah sakit|\bRS\b|medika|klinik|hospital|kesehatan/i, "Rumah sakit / kesehatan"],
    [/data ?cent(er|re)|pusat data/i, "Data center"], [/\bAI\b|[Kk]ecerdasan buatan|[Aa]rtificial [Ii]ntelligence/, "Infrastruktur AI"], // "AI" harus huruf besar
    [/telekomunikasi|\btelko|menara|tower|fiber optik|tellink/i, "Telekomunikasi"],
    [/udang|shrimp|akuakultur|aquaculture|perikanan|tambak/i, "Akuakultur"],
    [/sawit|perkebunan|\bCPO\b|agribisnis/i, "Perkebunan"],
    [/minyak|\bmigas\b|\bgas bumi|LNG|energi|EBT|PLT[SUBAG]|listrik|\bpower\b|solar/i, "Energi"],
    [/properti|real estat|real estate|hotel|kawasan industri|apartemen/i, "Properti"],
    [/pelayaran|kapal|shipping|logistik|transportasi/i, "Logistik / pelayaran"],
    [/teknologi|digital|software|platform|aplikasi/i, "Teknologi"],
    [/makanan|minuman|\bF&B\b|food/i, "Makanan & minuman"],
    [/fintech|\bbank\b|asuransi|multifinance|pembiayaan/i, "Keuangan"],
    [/konstruksi|infrastruktur|jalan tol/i, "Konstruksi / infrastruktur"],
    [/superholding|holding|perusahaan afiliasi/i, "Holding (perusahaan afiliasi)"],
  ];
  const assetTypeOf = text => (ASSET_TYPES.find(([re]) => re.test(text || "")) || [])[1] || "";
  // Nama perusahaan target pertama yang bukan emiten itu sendiri, mis. "PT Aztech Pandu Persada".
  const targetCoOf = (text, d) => {
    const own = (d.name || "").toUpperCase().replace(/^PT\.?\s*|\s*TBK\.?$/g, "").trim();
    // Kata nama: huruf kapital di depan lalu huruf kecil (Aztech), atau singkatan pendek (PAA, GMP). "Tbk" tidak dihitung.
    const W = "(?!Tbk\\b|TBK\\b)(?:[A-Z][a-z][\\w&.\\-]*|[A-Z]{2,5}\\b)";
    for (const m of String(text || "").matchAll(new RegExp(`\\b(PT|Grup|grup)\\s+(${W}(?:\\s+${W}){0,4})`, "g"))) {
      const nm = m[2].replace(/[.,]$/, "");
      if (own && own.includes(nm.toUpperCase().split(" ")[0])) continue;
      return (m[1].toLowerCase() === "grup" ? "Grup " : "PT ") + nm;
    }
    // Singkatan target tanpa "PT", mis. "75% saham BTL" (bukan kode emiten itu sendiri).
    const ab = String(text || "").match(/saham\s+([A-Z]{2,6})\b/);
    if (ab && ab[1] !== d.ticker && !/^(HMETD|PMTHMETD|PMHMETD|CSPA|PPJB|RUPS|RUPSLB|BEI|OJK|IDX)$/.test(ab[1])) return ab[1];
    return "";
  };

  // Laporan "rencana/strategi" lebih informatif daripada tanggapan rutin; dipakai untuk memilih laporan terbaik.
  // Laporan rutin/administratif (bukti iklan, perkembangan negosiasi, tanggapan bursa) berisi sedikit informasi baru.
  const LOW_INFO = /bukti iklan|perkembangan negosiasi|volatilitas|permintaan penjelasan|laporan bulanan|penggunaan dana/i;
  const isInformative = u => !LOW_INFO.test(u.title || "");
  const MONTHS = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
  const sentenceWith = (text, re) => (String(text || "").split(/(?<=[.!?])\s+/).find(s => re.test(s)) || "").trim();
  const nominalOf = text => {
    // Ambil nominal rupiah terbesar dari teks, mis. "Rp1,54 triliun", "Rp 87,67 miliar".
    let best = null;
    const num = s => parseFloat(s.replace(/\.(?=\d{3})/g, "").replace(",", "."));
    const UNIT = { triliun: 1e12, t: 1e12, miliar: 1e9, m: 1e9, juta: 1e6, billion: 1e9, million: 1e6, bn: 1e9, mn: 1e6 };
    for (const m of String(text || "").matchAll(/Rp\s?([\d.,]+)\s?(triliun|miliar|juta|T|M)\b/gi)) {
      const v = num(m[1]) * (UNIT[m[2].toLowerCase()] || 1);
      if (!best || v > best.v) best = { v, txt: m[0].replace(/\s+/g, " ") };
    }
    // Nilai dalam dolar AS (kurs kasar Rp16.000 hanya untuk membandingkan besarnya; teks asli yang ditampilkan).
    for (const m of String(text || "").matchAll(/(?:US\$|USD)\s?([\d.,]+)\s?(miliar|juta|billion|million|bn|mn)\b/gi)) {
      const v = num(m[1]) * (UNIT[m[2].toLowerCase()] || 1) * 16000;
      if (!best || v > best.v) best = { v, txt: m[0].replace(/\s+/g, " ") };
    }
    return best;
  };
  const futureDateOf = text => {
    const today = new Date().toISOString().slice(0, 10); let best = null;
    const consider = (iso, txt) => { if (iso >= today && (!best || iso < best.iso)) best = { iso, txt }; };
    for (const m of String(text || "").matchAll(/(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+(20\d\d)/gi))
      consider(`${m[3]}-${String(MONTHS.indexOf(m[2].toLowerCase()) + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`, m[0]);
    // Kuartal / semester, mis. "kuartal pertama 2027", "Q1 2027", "2H 2026": dipakai akhir periodenya.
    const QEND = { 1: "03-31", 2: "06-30", 3: "09-30", 4: "12-31" };
    const qn = s => ({ pertama: 1, i: 1, kedua: 2, ii: 2, ketiga: 3, iii: 3, keempat: 4, iv: 4 }[s.toLowerCase()] || +s);
    for (const m of String(text || "").matchAll(/(?:kuartal|triwulan)\s+(pertama|kedua|ketiga|keempat|IV|III|II|I|[1-4])\s+(?:tahun\s+)?(20\d\d)|\bQ([1-4])\s?(20\d\d)/gi)) {
      const q = qn(m[1] || m[3]), y = m[2] || m[4]; if (q >= 1 && q <= 4) consider(`${y}-${QEND[q]}`, m[0]);
    }
    for (const m of String(text || "").matchAll(/\b([12])H\s?(20\d\d)|semester\s+(pertama|kedua|I{1,2})\s+(?:tahun\s+)?(20\d\d)/gi)) {
      const h = m[1] ? +m[1] : (/kedua|II/i.test(m[3]) ? 2 : 1), y = m[2] || m[4]; consider(`${y}-${h === 1 ? "06-30" : "12-31"}`, m[0]);
    }
    return best;
  };

  function deriveStory(d) {
    const a = d.storyAuto || {}, man = d.story || {};
    const reps = updates.filter(u => u.ticker === d.ticker).sort((x, y) => (y.date || "").localeCompare(x.date || ""));
    const txt = u => `${u.title}. ${u.summary || ""} ${u.points || ""}`;
    // Bersihkan teks: label "(Ringkasan AI Stockbit)" dan nama emiten sendiri (mis. "SMKM (Sumber Mas Konstruksi)")
    // supaya tidak terbaca sebagai jenis aset atau nama target.
    const core = (d.name || "").replace(/^PT\.?\s*|\s*Tbk\.?$/gi, "").trim();
    const clean = s => String(s || "").replace(/\(Ringkasan AI Stockbit\)/gi, " ").replace(/\b[A-Z]{4}\s*\([^)]*\)/g, " ")
      .replace(core ? new RegExp(core.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi") : /$^/, " ");
    // Bisnis lama: industri di profil + kalimat "bergerak di bidang" dari latar belakang.
    const lamaAuto = a.industry ? `${a.industry}${a.subSector && a.subSector !== a.industry ? " · " + a.subSector : ""}` : "";
    const lamaNote = sentenceWith(a.background, /bergerak|kegiatan usaha|bidang usaha|usaha utama/i) || "";
    // Bisnis baru: kalimat dari laporan/berita/catatan yang menyebut perubahan kegiatan usaha atau injeksi aset.
    // Pilih laporan TERBARU yang cocok, melewati laporan rutin; bila hanya ada laporan rutin, pakai yang terbaru.
    // (reps sudah urut tanggal terbaru dulu)
    const best = re => { const m = reps.filter(u => re.test(txt(u))); return m.find(isInformative) || m[0]; };
    const bizRep = best(BIZ_RE);
    const injRep = best(INJ_RE);
    const baruAuto = (bizRep && sentenceWith(bizRep.summary, BIZ_RE)) || sentenceWith(d.notes, /bergeser|beralih|bisnis|usaha/i) || (bizRep ? bizRep.title : "");
    const injAuto = (injRep && (sentenceWith(injRep.summary, INJ_RE) || injRep.title)) || "";
    // Nominal hanya dari laporan injeksi terpilih, atau laporan/berita lain yang menyebut TARGET YANG SAMA.
    // Angka dari laporan lain (mis. harga beli saham oleh pengendali, nilai PTW) tidak dipakai.
    let nominal = injRep ? nominalOf(txt(injRep)) : null;
    const injTarget = injRep ? targetCoOf(clean(txt(injRep)), d) : "";
    if (!nominal && injTarget) {
      const key = injTarget.replace(/^(PT|Grup)\s+/, "");
      nominal = nominalOf(reps.filter(u => u !== injRep && txt(u).includes(key)).map(txt).join(" "));
    }
    // Target: pembayaran PTW bila masih proses, jadwal terdekat di laporan, atau katalis berikutnya.
    let targetAuto = "";
    if (d.deal === "proses" && d.tender?.paydate) targetAuto = `Pembayaran PTW ${fmtDate(d.tender.paydate)}`;
    else {
      // Jadwal terdekat yang disebut laporan terkait transformasi/injeksi (mis. "kuartal pertama 2027").
      // Utamakan jadwal di laporan injeksi aset terpilih; bila tidak ada, laporan transformasi/injeksi lain.
      const f = (injRep && futureDateOf(txt(injRep))) || futureDateOf(reps.filter(u => BIZ_RE.test(txt(u)) || INJ_RE.test(txt(u))).map(txt).join(" "));
      if (f) targetAuto = f.txt.charAt(0).toUpperCase() + f.txt.slice(1);
    }
    const old = (a.oldControllers || [])[0];
    // Ringkasan singkat injeksi: jenis aset (+ perusahaan target). Teks injeksi dulu, lalu bisnis baru sebagai cadangan.
    const injText = clean(man.inject || injAuto), injAll = clean(injRep ? txt(injRep) : injText);
    let injType = assetTypeOf(injText) || assetTypeOf(injAll) || assetTypeOf(clean(man.baru || baruAuto)) ||
      (/inbreng|penyetoran.*selain uang/i.test(injText || injAll) ? "Inbreng saham" :
       /HMETD|rights issue|PMTHMETD|private placement|penempatan terbatas/i.test(injAll) ? "Penambahan modal" :
       /pinjaman/i.test(injAll) ? "Pinjaman ke afiliasi" :
       /CSPA|PPJB|pengambilalihan|akuisisi|akusisi/i.test(injAll) ? "Akuisisi (aset belum disebut)" : "Aksi korporasi");
    let injCo = targetCoOf(injText, d) || targetCoOf(injAll, d);
    // Data terverifikasi (story-verified.json, hasil pengecekan Stockbit Reports) mengalahkan data otomatis;
    // koreksi manual tetap paling atas. Bila terverifikasi, nominal/target kosong berarti memang belum disebut.
    const v = VERIFIED[d.ticker];
    const vSrc = v && v.sourceDate ? { date: v.sourceDate, title: v.sourceTitle || "Stockbit Reports", url: `https://stockbit.com/symbol/${d.ticker}` } : null;
    if (v && !man.inject) { injType = v.injectType || ""; injCo = v.injectTarget || ""; }
    if (v && !man.nominal) nominal = v.nominal ? { txt: v.nominal } : null;
    if (v && !man.target && !(d.deal === "proses" && d.tender?.paydate)) targetAuto = v.target || "";
    return {
      injType, injCo, verified: !!v, vSrc, vNote: v?.note || "",
      lama: man.lama || lamaAuto, lamaNote: man.lama ? "" : lamaNote, lamaEdited: !!man.lama,
      baru: man.baru || (v ? v.baru : baruAuto), baruSrc: man.baru ? null : (v ? (v.baru ? vSrc : null) : (bizRep || null)), baruEdited: !!man.baru,
      oldName: man.oldName || (a.oldControllers || []).map(o => o.name).slice(0, 3).join(", "),
      oldPct: man.oldPct != null && man.oldPct !== "" ? +man.oldPct : (a.oldControllers || []).slice(0, 3).reduce((s, o) => s + (o.before || 0), 0) || null,
      oldInferred: !man.oldName && !!old?.inferred, oldEdited: !!man.oldName,
      takeoverDate: a.takeover?.date,
      // Terverifikasi: injeksi hanya bila memang disebut di laporan; detail = kalimat laporan terbaru bila ada.
      inject: man.inject || (v ? (v.injectType ? (injAuto || [v.injectType, v.injectTarget].filter(Boolean).join(" · ")) : "") : injAuto),
      injectEdited: !!man.inject, injectSrc: man.inject ? null : (v ? vSrc : (injRep || null)),
      nominal: man.nominal || (nominal ? nominal.txt : ""), nominalEdited: !!man.nominal,
      target: man.target || targetAuto || (d.prog?.next ? "Belum ada jadwal · berikutnya: " + d.prog.next.label : "Transaksi tuntas"), targetEdited: !!man.target,
      loaded: !!d.storyAuto,
    };
  }

  let storyFilter = "", storyLoading = false;
  // Data story terverifikasi dari Stockbit Reports (file website/story-verified.json, bisa diedit).
  let VERIFIED = {};
  fetch("story-verified.json", { cache: "no-store" }).then(r => r.ok ? r.json() : {}).then(j => { VERIFIED = j || {}; render(); }).catch(() => {});

  // Catatan analis (analisa.json) dan profil pengendali baru (pengendali-verified.json) — dipakai menu Analisa Emiten.
  let ANALISA = null, PENGENDALI = {}, PANDANGAN = {};
  // Pandangan analis per emiten (pandangan-analis.json): tesis, hitungan dilusi, nilai wajar, variabel kunci.
  fetch("pandangan-analis.json", { cache: "no-store" }).then(r => r.ok ? r.json() : {}).then(j => { PANDANGAN = j || {}; render(); }).catch(() => {});
  fetch("analisa.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(j => { ANALISA = j; }).catch(() => {});
  fetch("pengendali-verified.json", { cache: "no-store" }).then(r => r.ok ? r.json() : {}).then(j => { PENGENDALI = j || {}; }).catch(() => {});

  // ================= Analisa Emiten =================
  // Kerangka: enam dimensi (pengendali, substansi aset, posisi harga, struktur, katalis, fundamental),
  // masing-masing 0–10, lalu disintesis menjadi sikap, tesis naik/turun, skenario harga, dan daftar periksa.
  const KURS = { USD: 16500, SGD: 12700 };   // kurs asumsi untuk mengonversi nominal injeksi valas
  // "Rp14,57 T", "maks. USD125 juta", "±USD100 juta (PAA) + Rp172,25 M" → total rupiah (null bila tak ada angka).
  function nominalRp(s) {
    if (!s) return null;
    let total = 0, hit = false;
    const re = /(Rp|USD|US\$|SGD)\s?([\d.,]+)\s*(triliun|miliar|juta|million|T|M)?/gi;
    // Isi dalam kurung adalah padanan/keterangan (mis. "USD100 juta (±Rp1,6 T)"), bukan nilai tambahan.
    for (const m of String(s).replace(/\([^)]*\)/g, "").matchAll(re)) {
      const v = parseFloat(m[2].replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
      if (isNaN(v)) continue;
      const u = (m[3] || "").toLowerCase();
      const mult = u === "t" || u === "triliun" ? 1e12 : u === "m" || u === "miliar" ? 1e9 : u === "juta" || u === "million" ? 1e6 : 1;
      const cur = m[1].toUpperCase().replace("US$", "USD");
      total += v * mult * (KURS[cur] || 1); hit = true;
    }
    return hit ? total : null;
  }
  const clamp10 = v => Math.max(0, Math.min(10, Math.round(v * 10) / 10));
  const x2 = v => v == null ? "–" : v.toLocaleString("id-ID", { maximumFractionDigits: 2 }) + "×";
  const pct0 = v => v == null ? "–" : (v >= 0 ? "+" : "") + Math.round(v * 100) + "%";
  const RED_RE = /(dilusi|dilutif|leverage|tanpa RUPS|deportasi|gagal kuorum|ekuitas (induk )?negatif|tidak jelas|bertentangan|ditahan OJK|OJK (sedang )?(memeriksa|menahan)|suspensi|diskon|utang pemegang saham|tanpa penjelasan|tersangka|red flag)/i;
  const GOOD_RE = /(strategic buyer|pembeli strategis|akuisisi strategis|tercatat di LSE|bayar tunai|tunai di harga sekitar pasar|aset riil|kredibel|Sinar Mas|Grup Astra|FrieslandCampina)/i;
  const NEG_GOOD = /(tidak|kurang|belum|bukan) (\w+ )?kredibel/i;
  const HI_SIGNAL = /(transaksi material|perubahan kegiatan usaha|inbreng|HMETD|penilai|akuisisi|pengambilalihan|tender|RUPS|private placement|penempatan terbatas)/i;
  const NOISE = /(volatilitas|permintaan penjelasan bursa)/i;
  // Pecah kalimat tanpa memotong singkatan nama badan hukum (Pte., Ltd., Tbk., B.V., Co.).
  const sentences = s => String(s || "").split(/(?<!\b(?:Pte|Ltd|Co|Tbk|Inc|B\.V|No|dkk|mis|Jl)\.)(?<=\.)\s+(?=[A-Z0-9(])/).filter(Boolean);

  async function analyzeTicker(raw) {
    const out = $("anOut");
    const q = String(raw || "").trim().toUpperCase();
    const t = (q.match(/^[A-Z]{4}\b/) || [])[0] || items.find(x => (x.name || "").toUpperCase().includes(q))?.ticker;
    if (!t) { out.innerHTML = `<div class="empty"><strong>Kode tidak dikenali</strong><span>Masukkan kode saham 4 huruf, mis. NAYZ.</span></div>`; return; }
    out.innerHTML = `<div class="pf-load">Menganalisa ${esc(t)}: memuat profil, harga, dan keterbukaan informasi dari Stockbit…</div>`;
    try {
      const a = await loadAnalysis(t);
      renderAnalysis(a);
      out.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      out.innerHTML = `<div class="empty"><strong>Analisa ${esc(t)} gagal dimuat</strong><span>${esc(e.message || "server lokal tidak merespons")}. Pastikan website dibuka lewat jalankan-radar.sh dan token Stockbit masih berlaku.</span></div>`;
    }
  }
  // Ambil semua data satu emiten lalu bangun analisanya (dipakai analisa tunggal dan peringkat).
  async function loadAnalysis(t, { fetchReports = true } = {}) {
    const d = items.find(x => x.ticker === t);
    const r = await fetch("/api/profile?ticker=" + t);
    const p = await r.json();
    if (!r.ok) throw new Error(p.error || r.status);
    // Laporan: untuk emiten radar pakai data yang sudah tersinkron; selain itu ambil dari Stockbit Reports.
    let reps = updates.filter(u => u.ticker === t && /^sb-report-/.test(u.id));
    if (!reps.length && fetchReports) {
      try { const rr = await fetch("/api/reports?ticker=" + t); if (rr.ok) reps = (await rr.json()).items || []; } catch {}
    }
    reps = [...reps].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    // Data pelengkap (gagal tidak membatalkan analisa): pergerakan pemegang ≥5% dan volume harian.
    const [bm, ins, qt] = await Promise.all([
      d ? getBenchmark().catch(() => null) : null,
      fetch("/api/insider?ticker=" + t + "&days=365").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/quote?ticker=" + t).then(r => r.ok ? r.json() : null).catch(() => null),
    ]);
    return buildAnalysis(t, d, p, reps, bm, ins, qt);
  }



  function buildAnalysis(t, d, p, reps, bm, ins, qt) {
    const m = p.metrics || {}, st = p.stats || {};
    // Harga: penutupan terbaru dari grafik Stockbit (lebih mutakhir dari harga tersimpan saat sinkron terakhir).
    const lastBar = p.chart?.length ? p.chart[p.chart.length - 1] : null;
    const price = lastBar?.v ?? num(d?.price);
    const priceDate = lastBar?.d || "";
    const mcap = st.marketCap ?? (num(d?.mcap) != null ? num(d.mcap) * 1e9 : null);
    const flt = st.freeFloat ?? num(d?.float);
    const ctrlH = (p.shareholders || []).filter(h => h.pengendali);
    const ctrlPct = ctrlH.length ? ctrlH.reduce((s, h) => s + (parseFloat(h.pct) || 0), 0) : num(d?.ctrlPct);
    const ctrlName = ctrlH.map(h => h.name).join(", ") || d?.ctrlName || "";
    const sv = VERIFIED[t], pv = PENGENDALI[t];
    const deal = bm?.deals?.find(r => r.ticker === t);
    const tender = d?.tender?.price ? d.tender : null;
    const ms = d?.ms || {};
    const isRadar = !!d && stageOf(d) !== "radar";
    const pvText = pv ? [pv.siapa, pv.grup, pv.rencana, pv.catatan].join(" ") : "";
    const injRp = nominalRp(sv?.nominal);
    const injRatio = injRp && mcap ? injRp / mcap : null;
    // Injeksi dianggap tereksekusi bila ditandai di story-verified.json (executed) atau tonggaknya tercapai.
    const executed = !!(sv?.executed || ms.inbreng || ms.bisnis);
    const foreignSpv = /\b(PTE|LTD|LIMITED|B\.V\.|INC|HOLDINGS? LIMITED)\b/i.test(ctrlName) && !/^PT\b/i.test(ctrlName.trim());
    const notTaker = !!pv?.bukanPengambilAlih;
    const now = new Date().toISOString().slice(0, 10);
    const d30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const rep30 = reps.filter(r => String(r.date) >= d30);
    const hi30 = rep30.filter(r => HI_SIGNAL.test(r.title) && !NOISE.test(r.title));
    const noise30 = rep30.filter(r => NOISE.test(r.title));
    const ptwActive = tender && tender.start <= now && now <= (tender.paydate || tender.end || tender.start);
    const vsPtw = tender && price ? price / tender.price : null;
    const toPeak = deal && price ? deal.peak / price - 1 : (m.high52 && price ? m.high52 / price - 1 : null);
    const loss = m.netIncomeTtm != null && m.netIncomeTtm < 0;
    const negEq = m.equity != null && m.equity < 0;
    const redLines = pv ? sentences(pv.catatan + " " + pv.grup).filter(s => RED_RE.test(s)) : [];
    // Kalimat positif hanya dihitung bila tidak sekaligus memuat red flag atau penyangkalan.
    const goodLines = pv ? sentences(pvText).filter(s => GOOD_RE.test(s) && !RED_RE.test(s) && !NEG_GOOD.test(s)) : [];
    const dims = [], bull = [], bear = [], checks = [], exits = [];

    // Pergerakan pemegang ≥5% (365 hari): pengendali menambah/menjual, dan penjual besar lain (mis. pengendali lama).
    const holders = ins?.holders || [];
    const ctrlKeys = ctrlName.split(/,\s*(?=[A-Z])/).map(normName).filter(k => k.length > 3);
    const isCtrlH = h => { const n = normName(h.name); return ctrlKeys.some(k => n.includes(k) || k.includes(n)); };
    const ctrlMoves = holders.filter(isCtrlH);
    const ctrlNet = ctrlMoves.reduce((s, h) => s + (h.change || 0), 0);
    const ctrlAddedLater = ctrlMoves.some(h => h.from > 0 && h.change > 0.5);
    const bigSellers = holders.filter(h => !isCtrlH(h) && h.change <= -2);
    // Likuiditas: nilai transaksi harian rata-rata dan hari untuk keluar dari posisi Rp100 juta (maks. 20% volume harian).
    const avgVal = qt?.avgVolume && (qt.price || price) ? qt.avgVolume * (qt.price || price) : null;
    const exitDays = avgVal ? 1e8 / (0.2 * avgVal) : null;

    // 1. Pengendali: siapa, kredibilitas, keselarasan kepentingan.
    {
      let s = 5; const why = [];
      if (ctrlNet < -1) {
        s -= 3; why.push(`Pengendali mengurangi porsi ${fmt(ctrlNet, 2)} poin dalam 365 hari.`);
        bear.push(`Pengendali menjual: porsi turun ${fmt(-ctrlNet, 2)} poin — sinyal terkuat bahwa orang dalam tidak sepakat dengan harga pasar.`);
        exits.push("Pengendali melanjutkan penjualan saham di pasar.");
      } else if (ctrlAddedLater) {
        s += 1; why.push("Pengendali menambah porsi setelah masuk.");
        bull.push("Pengendali menambah porsi lewat pasar setelah akuisisi — keselarasan kepentingan dengan publik.");
      }
      if (!isRadar) { s = 5; why.push("Bukan saham backdoor di radar; dinilai dari struktur kepemilikan."); }
      if (notTaker) { s -= 1; why.push("Nama di kolom pengendali adalah pengendali lama/penjual — transaksi belum/tidak terjadi."); }
      if (goodLines.length) { s += 3; why.push("Ada indikasi pembeli kredibel/strategis."); bull.push("Pengendali kredibel: " + goodLines[0]); }
      if (foreignSpv) { s -= 2; why.push("Pengendali SPV luar negeri (median 0,78× harga PTW di 9 transaksi)."); bear.push("Pengendali SPV luar negeri; UBO dan rekam jejak di Indonesia lebih sulit diverifikasi."); }
      else if (ctrlName && isRadar) { s += 1; why.push("Pengendali badan usaha dalam negeri/perorangan."); }
      if (redLines.length) { s -= Math.min(4, redLines.length * 1.5); redLines.slice(0, 3).forEach(l => bear.push(l)); }
      if (pv && /tidak diungkap/i.test(pv.grup)) { s -= 1; why.push("Latar belakang grup/UBO tidak diungkap."); }
      dims.push({ k: "Pengendali", s: clamp10(s), why });
    }
    // 2. Substansi aset: besar-kecil injeksi terhadap kapitalisasi dan status eksekusinya.
    {
      let s; const why = [];
      if (sv?.injectType) {
        if (injRatio != null) {
          s = injRatio >= 1 ? 8 : injRatio >= 0.3 ? 6 : 3;
          why.push(`Injeksi ${sv.nominal} ≈ ${x2(injRatio)} kapitalisasi pasar.`);
          if (injRatio >= 1) bull.push(`Injeksi ${sv.injectTarget || sv.injectType} (${sv.nominal}) setara ${x2(injRatio)} kapitalisasi — bila dieksekusi di valuasi wajar, skala usaha berubah total.`);
          if (injRatio < 0.3) bear.push(`Injeksi kecil (${sv.nominal}, ${x2(injRatio)} kapitalisasi): kelompok injeksi kecil median 0,68× harga PTW.`);
        } else { s = 4; why.push("Injeksi diumumkan tetapi nilainya belum disebut."); bear.push("Nilai injeksi belum disebut: pasar memperdagangkan harapan, bukan aset."); }
        if (executed) { s += 2; why.push("Tonggak injeksi/konsolidasi sudah tercapai."); }
        else { why.push("Belum dieksekusi: injeksi besar yang baru diumumkan median 0,78× vs 2,24× setelah eksekusi."); checks.push("Laporan penilai independen (KJPP) atas aset injeksi dan kelipatan valuasinya terhadap emiten sejenis."); }
      } else if (isRadar) {
        s = m.netIncomeTtm > 0 ? 6 : 2;
        why.push(m.netIncomeTtm > 0 ? "Tanpa injeksi, tetapi usaha berjalan dan laba — lebih mirip akuisisi strategis." : "Belum ada injeksi aset yang diumumkan: nilai bertumpu pada rencana pengendali.");
        if (!(m.netIncomeTtm > 0)) bear.push("Belum ada aset yang diumumkan untuk diinjeksikan.");
      } else {
        s = m.netIncomeTtm > 0 ? 6 : 3;
        why.push("Tidak ada transaksi backdoor tercatat; dinilai dari usaha yang berjalan.");
      }
      dims.push({ k: "Substansi aset", s: clamp10(s), why });
    }
    // 3. Posisi harga: terhadap harga PTW (biaya pengendali), siklus, dan kenaikan pra-PTW.
    {
      let s = 5; const why = [];
      if (vsPtw != null) {
        s = vsPtw <= 1 ? 7 : vsPtw <= 1.3 ? 6 : vsPtw <= 2 ? 4 : 2;
        why.push(`Harga ${x2(vsPtw)} harga PTW (${rp(tender.price)}).`);
        if (vsPtw < 1) { why.push("Di bawah biaya masuk pengendali: pasar meragukan eksekusi, tetapi risiko turun lebih terbatas."); bull.push(`Harga ${pct0(vsPtw - 1)} di bawah harga PTW — pengendali membayar lebih mahal dari pasar hari ini.`); }
        if (vsPtw > 2) bear.push(`Harga sudah ${x2(vsPtw)} harga PTW: optimisme besar sudah dibayar di muka.`);
      }
      if (deal) {
        why.push(`Kenaikan pra-rumor ke puncak ${x2(deal.runupX)}; harga kini ${x2(deal.postX)} harga saat PTW.`);
        if (deal.runupX >= 13) { s -= 2; bear.push(`Kenaikan pra-PTW ${x2(deal.runupX)}: kelompok ≥13× median hanya 0,85× harga PTW sesudahnya.`); }
        if (price && deal.peak) why.push(`Jarak ke puncak siklus ${pct0(deal.peak / price - 1)}.`);
      } else if (m.high52 && m.low52 && price) {
        const pos = (price - m.low52) / (m.high52 - m.low52 || 1);
        why.push(`Posisi dalam rentang 52 minggu: ${Math.round(pos * 100)}% (terendah ${rp(m.low52)}, tertinggi ${rp(m.high52)}).`);
        s = pos < 0.3 ? 6 : pos > 0.8 ? 3 : 5;
      }
      if (m.pbv != null) { why.push(`PBV ${x2(m.pbv)}.`); if (m.pbv > 5) { s -= 1; bear.push(`Valuasi ${x2(m.pbv)} nilai buku — jauh di atas aset yang ada sekarang.`); } }
      dims.push({ k: "Posisi harga", s: clamp10(s), why });
    }
    // 4. Struktur: porsi publik, konsentrasi, dilusi.
    {
      let s = 6; const why = [];
      if (flt != null) {
        why.push(`Porsi publik ${fmt(flt, 2)}%; pengendali ${ctrlPct != null ? fmt(ctrlPct, 2) + "%" : "–"}.`);
        if (flt < 7.5) { s = 2; bear.push(`Porsi publik ${fmt(flt, 2)}% di bawah 7,5%: wajib refloat — pasokan saham, biasanya dengan diskon.`); checks.push("Jadwal dan harga refloat (penjualan kembali saham ke publik)."); }
        else if (flt < 15) { s = 4; why.push("Porsi publik tipis: harga mudah digerakkan, sulit keluar saat ramai jual."); }
        else if (flt > 50) { s = 6; why.push("Porsi publik besar: pengendali minoritas, kendali kurang kuat."); }
        else s = 7;
      }
      if (/dilusi|HMETD|penempatan terbatas|private placement|konversi utang/i.test(pvText + " " + (sv?.injectType || ""))) {
        s -= 1.5; why.push("Ada rencana/riwayat penerbitan saham baru (HMETD/penempatan terbatas/konversi).");
        checks.push("Harga pelaksanaan saham baru dibanding harga pasar, dan apakah pengendali menyetor uang segar di harga yang sama dengan publik.");
      }
      if (bigSellers.length) {
        s -= 1;
        const h = bigSellers[0];
        why.push(`${bigSellers.length} pemegang besar non-pengendali melepas saham.`);
        bear.push(`${h.name} melepas ${fmt(h.from, 2)}% → ${fmt(h.to, 2)}% (${h.sells}× jual, terakhir ${fmtDate(h.lastDate)}): pasokan dari pemegang lama menekan harga.`);
      }
      if (avgVal != null) {
        why.push(`Nilai transaksi harian rata-rata ${big(avgVal)}; keluar dari posisi Rp100 juta ±${exitDays < 1 ? "<1" : fmt(exitDays, 0)} hari (20% volume).`);
        if (avgVal < 5e8) { s -= 1.5; bear.push(`Likuiditas tipis: transaksi harian rata-rata ${big(avgVal)} — posisi sulit dikeluarkan saat sentimen berbalik.`); }
      }
      dims.push({ k: "Struktur & likuiditas", s: clamp10(s), why });
    }
    // 5. Katalis: jadwal yang bisa mengubah nilai dalam waktu dekat.
    {
      let s = 3; const why = [];
      const tgt = sv?.target || "";
      if (ptwActive) { s += 3; why.push(`PTW sedang berjalan (pembayaran ${fmtDate(tender.paydate || tender.end)}).`); exits.push("Setelah PTW tuntas penopang harga hilang — waspadai pelemahan bila tidak ada katalis lanjutan."); }
      if (tgt) { s += 2; why.push("Target/jadwal berikutnya: " + tgt + "."); }
      const rups = (pv?.rencana || "").match(/RUPSLB?[^.;]*?\d{1,2} \w+ 20\d\d/);
      if (rups) { s += 1; why.push(rups[0] + "."); checks.push("Hasil " + rups[0].replace(/\s+/g, " ") + "."); }
      if (hi30.length) { s += Math.min(2, hi30.length * 0.5); why.push(`${hi30.length} laporan bersinyal tinggi dalam 30 hari.`); }
      if (noise30.length >= 2) why.push(`${noise30.length} penjelasan volatilitas/permintaan bursa dalam 30 hari — harga sudah bergerak, belum tentu nilai.`);
      dims.push({ k: "Katalis", s: clamp10(s), why });
    }
    // 6. Fundamental saat ini.
    {
      let s = 5; const why = [];
      if (negEq) { s = 1; bear.push("Ekuitas negatif: tanpa injeksi aset, perseroan tidak punya penyangga."); }
      else if (loss) { s = 3; why.push(`Rugi bersih TTM ${big(-m.netIncomeTtm).replace("Rp", "−Rp")}.`); }
      else if (m.netIncomeTtm > 0) { s = 7; why.push(`Laba bersih TTM ${big(m.netIncomeTtm)}.`); if (m.per) why.push(`PER ${x2(m.per)}.`); }
      if (m.revGrowth) why.push(`Pertumbuhan pendapatan YoY ${m.revGrowth}.`);
      if (m.cash != null && mcap) why.push(`Kas ${big(m.cash)} (${Math.round(m.cash / mcap * 100)}% kapitalisasi).`);
      dims.push({ k: "Fundamental", s: clamp10(s), why });
    }

    // Sintesis: bobot mencerminkan apa yang terbukti menggerakkan harga backdoor (aset & pengendali).
    const W = { "Pengendali": 0.25, "Substansi aset": 0.25, "Posisi harga": 0.2, "Struktur & likuiditas": 0.1, "Katalis": 0.1, "Fundamental": 0.1 };
    const score = Math.round(dims.reduce((s, x) => s + x.s * W[x.k], 0) * 10);
    const stance = score >= 65 ? { id: "good", t: "Asimetri positif — layak dipelajari lebih dalam" }
      : score >= 45 ? { id: "warn", t: "Netral — tunggu konfirmasi katalis" }
      : { id: "bad", t: "Spekulatif tinggi — risiko lebih besar dari imbal hasil" };

    // Skenario harga dari level emiten sendiri.
    const levels = [];
    if (price) {
      const bearLv = tender && tender.price < price ? tender.price : deal?.base ?? m.low52 ?? null;
      const bearLbl = tender && tender.price < price ? "Kembali ke harga PTW (biaya masuk pengendali)" : deal ? "Kembali ke harga pra-rumor (rencana tidak dieksekusi)" : "Kembali ke terendah 52 minggu";
      if (bearLv) levels.push(["Skenario turun", bearLbl, bearLv]);
      if (deal?.base && bearLv !== deal.base) levels.push(["Skenario terburuk", "Harga pra-rumor: kembali ke cangkang", deal.base]);
      const bullLv = deal?.peak ?? m.high52 ?? null;
      if (bullLv && bullLv > price) levels.push(["Skenario naik", deal ? "Kembali ke puncak siklus backdoor" : "Kembali ke tertinggi 52 minggu", bullLv]);
      // PTW di atas harga kini tetap ditampilkan sebagai acuan biaya masuk pengendali.
      if (tender && tender.price >= price) levels.push(["Harga PTW", "Biaya masuk pengendali — kini di atas harga pasar", tender.price]);
      if (m.bvps) levels.push(["Nilai buku", "PBV 1× (aset saat ini)", m.bvps]);
    }
    const down = levels.find(l => l[0] === "Skenario turun"), up = levels.find(l => l[0] === "Skenario naik");
    const rr = down && up && price > down[2] ? (up[2] - price) / (price - down[2]) : null;
    if (rr != null) (rr >= 2 ? bull : bear).push(`Rasio imbal-risiko ${rr.toFixed(1).replace(".", ",")} : 1 (naik ke ${rp(up[2])} vs turun ke ${rp(down[2])}).`);

    // Tesis satu paragraf.
    const parts = [];
    if (isRadar) parts.push(`${t} adalah ${notTaker ? "emiten dengan perubahan pengendali yang belum tuntas" : "saham backdoor"}${sv?.baru ? ` yang bertransformasi ke ${/^[A-Z][a-z]/.test(sv.baru) ? sv.baru[0].toLowerCase() + sv.baru.slice(1) : sv.baru}` : ""}.`);
    else parts.push(`${t} (${[p.sector, p.industry].filter(Boolean).join(" · ") || "sektor tidak tersedia"}) tidak tercatat sebagai transaksi backdoor di radar.`);
    if (pv?.siapa) parts.push(sentences(pv.siapa)[0]);
    if (sv?.injectType) parts.push(injRatio != null ? `Inti nilainya ada pada ${sv.injectTarget || sv.injectType} senilai ${sv.nominal} (≈${x2(injRatio)} kapitalisasi), ${executed ? "yang sudah dieksekusi" : "yang belum dieksekusi"}.` : `Injeksi ${sv.injectTarget || sv.injectType} diumumkan tanpa nilai.`);
    if (vsPtw != null) parts.push(`Harga kini ${x2(vsPtw)} harga PTW.`);
    if (isRadar) {
      parts.push(score >= 65 ? "Kombinasi pengendali, aset, dan harga memberi asimetri yang layak diteliti — dengan disiplin pada daftar periksa." : score >= 45 ? "Ceritanya ada, tetapi bukti belum cukup: biarkan katalis yang membuktikan, bukan harga." : "Terlalu banyak yang harus berjalan benar; risiko kehilangan modal lebih besar dari potensinya.");
    } else {
      // Saham di luar radar: nilai kemungkinan menjadi cangkang/target pengambilalihan.
      const shell = (mcap && mcap < 5e11 ? 1 : 0) + (ctrlPct >= 60 ? 1 : 0) + (loss || negEq ? 1 : 0) + (price && price <= 100 ? 1 : 0);
      parts.push(`Indikator profil cangkang: ${shell}/4 (kapitalisasi < Rp500 M, pengendali ≥60%, merugi/ekuitas negatif, harga ≤ Rp100).`);
      parts.push(shell >= 3 ? "Profil cangkang kuat: kandidat target backdoor, tetapi tanpa pengumuman perubahan pengendali ini spekulasi murni — tunggu PPJB atau keterbukaan resmi." : shell === 2 ? "Sebagian ciri cangkang terpenuhi; pantau keterbukaan perubahan pengendali, anomali volume, dan UMA." : "Bukan profil cangkang: nilai saham ini ditentukan kinerja usahanya, bukan cerita pengambilalihan — gunakan analisa fundamental biasa.");
    }

    // Daftar periksa & sinyal keluar standar.
    if (tender) exits.push(`Harga ditutup di bawah ${rp(tender.price)} (harga PTW) secara konsisten: pasar menolak rencana pengendali.`);
    exits.push("RUPSLB/transaksi ditunda berulang, atau nilai penilai jauh di bawah nilai yang diumumkan.");
    exits.push("Pengendali atau afiliasinya menjual saham di pasar, atau porsi pengendali menyusut tanpa penjelasan.");
    checks.push("Laporan keuangan pertama yang mengonsolidasikan usaha baru: laba bersih aset baru dibanding kapitalisasi pasar.");
    if (pv?.catatan) { const pantau = pv.catatan.match(/Pantau ([^.]+)\./i); if (pantau) checks.unshift("Pantau " + pantau[1] + "."); }

    const notes = ANALISA ? Object.entries(ANALISA).filter(([k]) => k !== "_info").flatMap(([, a]) => (a.pantau || []).filter(x => x.t === t).map(x => x.txt)) : [];
    return { holders, isCtrlH, avgVal, exitDays, pa: PANDANGAN[t] || null,
      shares: st.shares ?? (mcap && price ? mcap / price : null), equity: m.equity ?? null,
      t, d, p, price, priceDate, mcap, flt, ctrlPct, ctrlName, sv, pv, deal, tender, dims, score, stance, bull, bear, checks: [...new Set(checks)], exits: [...new Set(exits)], levels, rr, thesis: parts.join(" "), reps: reps.slice(0, 8), hi30, notes, injRp };
  }

  function renderAnalysis(a) {
    const bar = s => `<div class="an-bar"><i style="width:${s * 10}%" class="${s >= 6.5 ? "g" : s >= 4.5 ? "w" : "b"}"></i></div>`;
    const li = arr => arr.length ? `<ul>${arr.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="nm">Tidak ada yang menonjol.</p>`;
    $("anOut").innerHTML = `
      <article class="an-card">
        <header class="an-head">
          <div><div class="eyebrow">${esc([a.p.sector, a.p.industry].filter(Boolean).join(" · "))}</div>
            <h2>${esc(a.t)} <span class="nm">${esc(a.d?.name || "")}</span></h2>
            <div class="nm">Harga ${rp(a.price)}${a.priceDate ? ` (penutupan ${esc(fmtDate(a.priceDate))})` : ""} · kapitalisasi ${big(a.mcap)} · porsi publik ${a.flt != null ? fmt(a.flt, 2) + "%" : "–"} · pengendali ${esc(a.ctrlName || "–")}${a.ctrlPct != null ? " (" + fmt(a.ctrlPct, 2) + "%)" : ""}</div></div>
          <div class="an-side">
            <button class="btn an-x" type="button" data-an="close" title="Tutup analisa dan kembali ke tabel">Tutup</button>
            <div class="an-score s-${a.stance.id}"><b>${a.score}</b><span>/100</span><em>${esc(a.stance.t)}</em></div>
          </div>
        </header>
        ${paBlock(a)}
        <section class="an-thesis"><h3>${a.pa ? "Ringkasan otomatis" : "Tesis"}</h3><p>${esc(a.thesis)}</p></section>
        <div class="an-grid">
          <section><h3>Penilaian enam dimensi</h3>
            ${a.dims.map(x => `<div class="an-dim"><div class="an-dh"><b>${esc(x.k)}</b><span class="num">${fmt(x.s, 1)}</span></div>${bar(x.s)}${x.why.length ? `<div class="nm">${esc(x.why.join(" "))}</div>` : ""}</div>`).join("")}
          </section>
          <section><h3>Skenario harga</h3>
            ${a.levels.length ? `<table class="an-lv"><tbody>${a.levels.map(l => `<tr><td><b>${esc(l[0])}</b><div class="nm">${esc(l[1])}</div></td><td class="r num">${rp(l[2])}</td><td class="r num">${pctTxt(l[2], a.price)}</td></tr>`).join("")}</tbody></table>` : '<p class="nm">Data harga belum cukup.</p>'}
            ${a.rr != null ? `<p class="nm">Rasio imbal-risiko <b>${a.rr.toFixed(1).replace(".", ",")} : 1</b>. Investor berpengalaman umumnya baru tertarik di atas 3 : 1 untuk saham berlikuiditas tipis.</p>` : ""}
            ${a.sv?.injectType ? `<h3>Injeksi aset</h3><p class="nm"><b>${esc(a.sv.injectType)}</b>${a.sv.injectTarget ? " · " + esc(a.sv.injectTarget) : ""}${a.sv.nominal ? " · " + esc(a.sv.nominal) : ""}${a.injRp && /USD|SGD/.test(a.sv.nominal) ? ` (≈${big(a.injRp)}, kurs asumsi Rp${KURS.USD.toLocaleString("id-ID")}/USD)` : ""}</p>` : ""}
          </section>
        </div>
        <div class="an-grid">
          <section class="an-bull"><h3>Kasus naik</h3>${li(a.bull)}</section>
          <section class="an-bear"><h3>Kasus turun & red flag</h3>${li(a.bear)}</section>
        </div>
        ${a.pv ? `<section class="an-ctrl"><h3>Pengendali & rencananya</h3>
          ${a.pv.bukanPengambilAlih ? '<p class="an-warn">Nama di kolom pengendali adalah pengendali lama/penjual atau bukan pengambil alih.</p>' : ""}
          <p><b>Siapa:</b> ${esc(a.pv.siapa)}</p><p><b>Grup:</b> ${esc(a.pv.grup)}</p><p><b>Rencana:</b> ${esc(a.pv.rencana)}</p>
          <p class="an-warn"><b>Catatan investor:</b> ${esc(a.pv.catatan)}</p></section>` : ""}
        ${calcBlock(a)}
        ${holdersBlock(a)}
        ${a.notes.length ? `<section><h3>Catatan analis</h3>${li(a.notes)}</section>` : ""}
        <div class="an-grid">
          <section><h3>Yang harus terjadi agar tesis benar</h3>${li(a.checks)}</section>
          <section><h3>Sinyal untuk keluar</h3>${li(a.exits)}</section>
        </div>
        <section><h3>Keterbukaan informasi terbaru</h3>
          ${a.reps.length ? `<ul class="an-reps">${a.reps.map(r => `<li><span class="num">${esc(fmtDate(r.date))}</span> ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>` : esc(r.title)}${HI_SIGNAL.test(r.title) && !NOISE.test(r.title) ? ' <span class="ctrl">sinyal tinggi</span>' : ""}</li>`).join("")}</ul>` : '<p class="nm">Belum ada laporan.</p>'}
        </section>
        <div class="an-foot">
          ${a.d ? `<button class="btn" type="button" data-an="profile">Profil lengkap</button>` : ""}
          ${a.d && (a.d.ctrlName || a.d.acquirer) ? `<button class="btn" type="button" data-an="ctrl">Pengendali & afiliasi</button>` : ""}
          <a class="btn" href="https://stockbit.com/symbol/${esc(a.t)}" target="_blank" rel="noopener">Stockbit</a>
          <button class="btn" type="button" data-an="close">Tutup analisa</button>
        </div>
        <p class="disc">Analisa otomatis berbasis aturan dari data Stockbit, data transaksi radar, riset pengendali, dan pola 32 transaksi backdoor. Kerangka berpikir, bukan rekomendasi beli/jual.</p>
      </article>`;
    $("anOut").querySelector("[data-an=profile]")?.addEventListener("click", () => openProfile(a.d.id));
    $("anOut").querySelector("[data-an=ctrl]")?.addEventListener("click", () => openController(a.d.id));
    // Tombol tutup (atas & bawah): kosongkan analisa lalu gulir ke tabel emiten yang dicari.
    $("anOut").querySelectorAll("[data-an=close]").forEach(b => b.addEventListener("click", () => {
      $("anOut").innerHTML = "";
      $("potTable").scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    wireCalc(a);
    try { const h = JSON.parse(localStorage.getItem("radar-cangkang.anRecent") || "[]").filter(x => x !== a.t); localStorage.setItem("radar-cangkang.anRecent", JSON.stringify([a.t, ...h].slice(0, 8))); } catch {}
    renderAnQuick();
  }

  // Pandangan analis (ditulis per emiten dari data Stockbit, riset pengendali, dan hitungan dilusi).
  function paBlock(a) {
    const v = a.pa;
    if (!v) return "";
    const cls = /asimetri/i.test(v.sikap) ? "good" : /netral/i.test(v.sikap) ? "warn" : "bad";
    const nw = v.nilaiWajar, dl = v.dilusi;
    const list = arr => (arr || []).length ? `<ul>${arr.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : '<p class="nm">–</p>';
    return `<section class="an-pa">
      <div class="an-pa-head"><span class="pill an-p-${cls}">${esc(v.sikap)}</span><b>${esc(v.ringkas)}</b></div>
      <p>${esc(v.tesis)}</p>
      <div class="an-grid">
        <div><h3>Nilai wajar kasar</h3>
          ${nw && nw.bawah != null ? `<p class="an-big">${rp(nw.bawah)} – ${rp(nw.atas)}</p>
            <p class="nm">vs harga kini ${rp(a.price)}: ${pctTxt(nw.bawah, a.price)} s.d. ${pctTxt(nw.atas, a.price)}</p><p class="nm">${esc(nw.metode || "")}</p>`
            : '<p class="nm">Data belum cukup untuk nilai wajar yang jujur.</p>'}</div>
        <div><h3>Hitungan dilusi</h3>
          ${dl && dl.berlaku ? `<table class="an-lv"><tbody>
              ${dl.sahamSekarang ? `<tr><td>Saham sekarang</td><td class="r num">${fmt(dl.sahamSekarang / 1e6, 0)} jt</td></tr>` : ""}
              ${dl.sahamBaru ? `<tr><td>Saham baru</td><td class="r num">+${fmt(dl.sahamBaru / 1e6, 0)} jt</td></tr>` : ""}
              ${dl.porsiPublikSetelah != null ? `<tr><td>Porsi publik (tidak menebus)</td><td class="r num">${fmt(dl.porsiPublikSekarang ?? 0, 2)}% → <b>${fmt(dl.porsiPublikSetelah, 2)}%</b></td></tr>` : ""}
              ${dl.nilaiPerSaham ? `<tr><td>Nilai per saham pasca-transaksi</td><td class="r num">${rp(dl.nilaiPerSaham)} ${pctTxt(dl.nilaiPerSaham, a.price)}</td></tr>` : ""}
            </tbody></table><p class="nm">${esc(dl.asumsi || "")} ${esc(dl.catatan || "")}</p>`
            : `<p class="nm">${esc(dl?.catatan || "Tidak ada rencana penerbitan saham baru yang material.")}</p>`}</div>
      </div>
      <div class="an-grid">
        <div><h3>Variabel kunci</h3>${list(v.variabelKunci)}</div>
        <div><h3>Tesis salah bila</h3>${list(v.tesisSalahBila)}</div>
      </div>
      ${v.pengendaliBergerak ? `<p class="nm"><b>Pergerakan pengendali:</b> ${esc(v.pengendaliBergerak)}</p>` : ""}
      ${v.likuiditas ? `<p class="nm"><b>Likuiditas:</b> ${esc(v.likuiditas)}</p>` : ""}
      <p class="disc">Pandangan analis per ${esc(fmtDate(v.asOf || ""))}${v.hargaAcuan ? ` · harga acuan ${rp(v.hargaAcuan)}` : ""}. Kerangka berpikir, bukan rekomendasi beli/jual.</p>
    </section>`;
  }

  // Kalkulator dilusi: semua isian bisa diubah; nilai awal dari pandangan analis atau data injeksi.
  function calcBlock(a) {
    if (!a.shares || !a.price) return "";
    const k = a.pa?.kalkulator || {};
    // Transaksi yang sudah tereksekusi: saham sekarang sudah memuat saham baru, jadi kalkulator tidak dipakai
    // (hitungan resminya ada di bagian Hitungan dilusi pada pandangan analis).
    if (k.sudahTereksekusi || (!a.pa && a.sv?.executed)) return `<section class="an-calc"><h3>Kalkulator dilusi & nilai per saham</h3><p class="nm">Penerbitan saham baru sudah tereksekusi — jumlah saham dan porsi publik saat ini sudah mencerminkan dilusinya. Lihat <b>Hitungan dilusi</b> di pandangan analis untuk posisi sebelum dan sesudah.</p></section>`;
    const V = k.nilaiDibayarSaham ?? a.injRp ?? 0;
    if (!V && !k.kasSegar && !a.sv?.injectType) return "";
    const P = k.hargaPelaksanaan || a.tender?.price || a.price;
    const inp = (id, label, val, step, hint) => `<label class="an-in"><span>${label}</span><input type="number" id="${id}" value="${val}" step="${step}" min="0"><em>${hint}</em></label>`;
    return `<section class="an-calc"><h3>Kalkulator dilusi & nilai per saham</h3>
      <div class="an-calc-in">
        ${inp("kcV", "Nilai dibayar dengan saham baru (Rp miliar)", Math.round(V / 1e8) / 10, "0.1", "inbreng / konversi utang")}
        ${inp("kcC", "Kas segar masuk (Rp miliar)", Math.round((k.kasSegar || 0) / 1e8) / 10, "0.1", "setoran tunai HMETD")}
        ${inp("kcP", "Harga pelaksanaan (Rp)", P, "1", "harga saham baru")}
        ${inp("kcT", "Publik menebus (%)", 0, "5", "0 = publik tidak ikut")}
        ${inp("kcH", "Nilai aset diakui (%)", 100, "5", "uji skeptis atas penilaian")}
      </div>
      <div class="an-calc-out" id="kcOut"></div>
      <p class="nm">${esc(k.dasar || "Nilai awal dari data injeksi terverifikasi; harga pelaksanaan diasumsikan sama dengan harga PTW/harga kini.")} Model sederhana: hak tebus proporsional, nilai per saham = (ekuitas + aset diakui + kas) ÷ total saham.</p>
    </section>`;
  }
  function wireCalc(a) {
    const out = $("kcOut");
    if (!out) return;
    const S0 = a.shares, E0 = a.equity || 0, f = (a.flt ?? 0) / 100;
    const calc = () => {
      const V = (+$("kcV").value || 0) * 1e9, C = (+$("kcC").value || 0) * 1e9, P = +$("kcP").value || 0;
      const tk = Math.min(100, +$("kcT").value || 0) / 100, h = (+$("kcH").value || 0) / 100;
      if (!P) { out.innerHTML = '<p class="nm">Isi harga pelaksanaan.</p>'; return; }
      const N = (V + C) / P, S1 = S0 + N;
      const pubAfter = (S0 * f + tk * f * N) / S1;
      const vps = (E0 + V * h + C) / S1;
      const cell = (l, v, sub = "") => `<div><span class="eyebrow">${l}</span><b>${v}</b>${sub ? `<span class="nm">${sub}</span>` : ""}</div>`;
      out.innerHTML = `<div class="pf-kpi">
        ${cell("Saham baru", fmt(N / 1e6, 0) + " jt", `${x2(N / S0)} saham sekarang`)}
        ${cell("Total saham", fmt(S1 / 1e6, 0) + " jt")}
        ${cell("Porsi publik", fmt(pubAfter * 100, 2) + "%", `dari ${fmt(f * 100, 2)}%`)}
        ${cell("Nilai buku / saham", rp(vps), `${pctTxt(vps, a.price)} vs harga ${rp(a.price)}`)}
      </div>`;
    };
    ["kcV", "kcC", "kcP", "kcT", "kcH"].forEach(id => $(id).addEventListener("input", calc));
    calc();
  }

  // Pergerakan pemegang saham ≥5% dalam 365 hari.
  function holdersBlock(a) {
    const hs = (a.holders || []).filter(h => Math.abs(h.change) >= 0.1 || a.isCtrlH(h)).slice(0, 8);
    const liq = a.avgVal != null ? `<p class="nm">Nilai transaksi harian rata-rata <b>${big(a.avgVal)}</b> · keluar dari posisi Rp100 juta ±${a.exitDays < 1 ? "&lt;1" : fmt(a.exitDays, 0)} hari bila mengambil 20% volume harian.</p>` : "";
    if (!hs.length) return liq ? `<section><h3>Likuiditas</h3>${liq}</section>` : "";
    return `<section><h3>Pergerakan pemegang saham ≥5% (365 hari)</h3>
      <table class="an-lv"><tbody>${hs.map(h => `<tr>
        <td><b>${esc(h.name)}</b>${a.isCtrlH(h) ? ' <span class="ctrl">Pengendali</span>' : ""}<div class="nm">${h.buys}× beli · ${h.sells}× jual · ${esc(fmtDate(h.firstDate))} – ${esc(fmtDate(h.lastDate))}</div></td>
        <td class="r num">${fmt(h.from, 2)}% → ${fmt(h.to, 2)}%</td>
        <td class="r num"><span class="${h.change >= 0 ? "up" : "down"}">${h.change >= 0 ? "+" : ""}${fmt(h.change, 2)}</span></td></tr>`).join("")}</tbody></table>
      ${liq}</section>`;
  }
  // Daftar pilihan & riwayat analisa terakhir.
  function renderAnQuick() {
    const dl = $("anList");
    if (dl && !dl.childElementCount) dl.innerHTML = items.map(d => `<option value="${esc(d.ticker)}">${esc(d.name || "")}</option>`).join("");
    let recent = [];
    try { recent = JSON.parse(localStorage.getItem("radar-cangkang.anRecent") || "[]"); } catch {}
    $("anQuick").innerHTML = recent.length ? `<span class="nm">Terakhir:</span> ${recent.map(t => `<button type="button" class="chip" data-t="${esc(t)}">${esc(t)}</button>`).join("")}` : "";
    $("anQuick").querySelectorAll("[data-t]").forEach(b => b.onclick = () => analyzeTicker(b.dataset.t));
  }
  // Kolom cari Potensi: mengetik menyaring tabel; tombol Analisa / Enter menampilkan analisa lengkap.
  $("anBtn").onclick = () => analyzeTicker($("q").value);
  $("q").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); analyzeTicker($("q").value); } });
  $("taBtn").onclick = () => technicalTicker($("q").value);
  $("spBtn").onclick = () => technicalTicker($("q").value, "spekulasi");

  // ================= Analisa Teknikal =================
  // Indikator dihitung di browser dari candle harian 1 tahun (api/ohlc). Volume Stockbit dalam lot (1 lot = 100 saham).
  const TA = {
    sma(a, n) { const o = Array(a.length).fill(null); let s = 0; a.forEach((v, i) => { s += v; if (i >= n) s -= a[i - n]; if (i >= n - 1) o[i] = s / n; }); return o; },
    ema(a, n) { const o = Array(a.length).fill(null), k = 2 / (n + 1); let e = null;
      a.forEach((v, i) => { if (v == null) return; if (e == null) { if (i >= n - 1) { e = a.slice(i - n + 1, i + 1).reduce((s, x) => s + x, 0) / n; o[i] = e; } return; } e = v * k + e * (1 - k); o[i] = e; }); return o; },
    bollinger(c, n = 20, m = 2) {
      const mid = TA.sma(c, n), up = [], lo = [];
      c.forEach((_, i) => { if (mid[i] == null) { up.push(null); lo.push(null); return; }
        const w = c.slice(i - n + 1, i + 1), sd = Math.sqrt(w.reduce((s, x) => s + (x - mid[i]) ** 2, 0) / n);
        up.push(mid[i] + m * sd); lo.push(mid[i] - m * sd); });
      return { mid, up, lo };
    },
    // RSI Wilder.
    rsi(c, n = 14) {
      const o = Array(c.length).fill(null); let g = 0, l = 0;
      for (let i = 1; i < c.length; i++) {
        const ch = c[i] - c[i - 1], up = Math.max(ch, 0), dn = Math.max(-ch, 0);
        if (i <= n) { g += up; l += dn; if (i === n) { g /= n; l /= n; o[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } continue; }
        g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; o[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l);
      }
      return o;
    },
    macd(c, f = 12, s = 26, sig = 9) {
      const ef = TA.ema(c, f), es = TA.ema(c, s), m = c.map((_, i) => ef[i] != null && es[i] != null ? ef[i] - es[i] : null);
      const first = m.findIndex(v => v != null), sg = Array(c.length).fill(null);
      if (first >= 0) TA.ema(m.slice(first), sig).forEach((v, j) => { sg[first + j] = v; });
      return { m, sg, h: m.map((v, i) => v != null && sg[i] != null ? v - sg[i] : null) };
    },
    // Parabolic SAR (langkah 0,02, maksimum 0,2). up = tren naik (SAR di bawah harga).
    psar(h, l, step = 0.02, max = 0.2) {
      const n = h.length, sar = Array(n).fill(null), up = Array(n).fill(null);
      if (n < 3) return { sar, up };
      let isUp = h[1] >= h[0], af = step, ep = isUp ? Math.max(h[0], h[1]) : Math.min(l[0], l[1]), s = isUp ? Math.min(l[0], l[1]) : Math.max(h[0], h[1]);
      for (let i = 2; i < n; i++) {
        s = s + af * (ep - s);
        if (isUp) {
          s = Math.min(s, l[i - 1], l[i - 2]);
          if (l[i] < s) { isUp = false; s = ep; ep = l[i]; af = step; }
          else if (h[i] > ep) { ep = h[i]; af = Math.min(max, af + step); }
        } else {
          s = Math.max(s, h[i - 1], h[i - 2]);
          if (h[i] > s) { isUp = true; s = ep; ep = h[i]; af = step; }
          else if (l[i] < ep) { ep = l[i]; af = Math.min(max, af + step); }
        }
        sar[i] = s; up[i] = isUp;
      }
      return { sar, up };
    },
  };

  let taState = null;   // { t, bars, ind, range }
  async function technicalTicker(raw, mode = "teknikal") {
    const out = $("anOut");
    const q = String(raw || "").trim().toUpperCase();
    const t = (q.match(/^[A-Z]{4}\b/) || [])[0] || items.find(x => (x.name || "").toUpperCase().includes(q))?.ticker;
    if (!t) { out.innerHTML = `<div class="empty"><strong>Kode tidak dikenali</strong><span>Masukkan kode saham 4 huruf, mis. NAYZ.</span></div>`; return; }
    out.innerHTML = `<div class="pf-load">Menghitung analisa teknikal ${esc(t)} dari candle harian Stockbit…</div>`;
    try {
      const r = await fetch("/api/ohlc?ticker=" + t + "&tf=1y"); const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.status);
      const bars = (j.bars || []).filter(b => b.c > 0);
      if (bars.length < 35) throw new Error("data harga kurang dari 35 hari bursa");
      const c = bars.map(b => b.c), h = bars.map(b => b.h), l = bars.map(b => b.l), v = bars.map(b => b.v);
      // ATR 14 (Wilder) untuk jarak stop yang wajar terhadap volatilitas harian.
      const tr = bars.map((b, i) => i ? Math.max(b.h - b.l, Math.abs(b.h - bars[i - 1].c), Math.abs(b.l - bars[i - 1].c)) : b.h - b.l);
      const atr = Array(tr.length).fill(null);
      let a = tr.slice(1, 15).reduce((s, x) => s + x, 0) / 14; atr[14] = a;
      for (let i = 15; i < tr.length; i++) { a = (a * 13 + tr[i]) / 14; atr[i] = a; }
      const ind = { bb: TA.bollinger(c), ma20: TA.sma(c, 20), ma50: TA.sma(c, 50), rsi: TA.rsi(c), macd: TA.macd(c), sar: TA.psar(h, l), vma: TA.sma(v, 20), atr };
      taState = { t, bars, ind, range: taState?.t === t ? taState.range : 120 };
      if (mode === "spekulasi") renderSpeculation(); else renderTechnical();
      out.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      out.innerHTML = `<div class="empty"><strong>Teknikal ${esc(t)} gagal dimuat</strong><span>${esc(e.message || "server lokal tidak merespons")}.</span></div>`;
    }
  }

  // Pembacaan tiap indikator → suara +1 (beli), −1 (jual), 0 (netral), lalu diringkas jadi sinyal.
  // Harga indikator: satu desimal untuk saham di bawah Rp200 agar perbedaan kecil tidak hilang karena pembulatan.
  const rpx = v => v == null ? "–" : v < 200 ? "Rp" + v.toLocaleString("id-ID", { maximumFractionDigits: 1 }) : rp(v);
  function taSignals(st) {
    const { bars, ind } = st, i = bars.length - 1, b = bars[i], c = b.c;
    const votes = [];
    const vote = (k, s, txt) => votes.push({ k, s, txt });
    // 1. Tren rata-rata bergerak.
    const m20 = ind.ma20[i], m50 = ind.ma50[i];
    if (m20 && m50) {
      if (c > m20 && m20 > m50) vote("Tren (MA20/MA50)", 1, `Harga ${rpx(c)} di atas MA20 ${rpx(m20)} dan MA50 ${rpx(m50)} — tren naik tersusun.`);
      else if (c < m20 && m20 < m50) vote("Tren (MA20/MA50)", -1, `Harga di bawah MA20 ${rpx(m20)} dan MA50 ${rpx(m50)} — tren turun tersusun.`);
      else vote("Tren (MA20/MA50)", 0, `Harga di antara MA20 ${rpx(m20)} dan MA50 ${rpx(m50)} — tren belum tegas.`);
    }
    // 2. Parabolic SAR (+ deteksi pembalikan baru).
    const sar = ind.sar.sar[i], sUp = ind.sar.up[i];
    if (sar != null) {
      let flip = 0; for (let k = i; k > i - 5 && k > 2; k--) if (ind.sar.up[k] !== ind.sar.up[k - 1]) { flip = i - k + 1; break; }
      vote("Parabolic SAR", sUp ? 1 : -1, `SAR ${rpx(sar)} ${sUp ? "di bawah" : "di atas"} harga — ${sUp ? "tren naik" : "tren turun"}${flip ? `, baru berbalik ${flip} hari lalu` : ""}.`);
    }
    // 3. RSI.
    const r = ind.rsi[i], r5 = ind.rsi[i - 5];
    if (r != null) {
      if (r < 30) vote("RSI 14", 1, `RSI ${r.toFixed(0)} — jenuh jual, peluang pantulan teknikal.`);
      else if (r > 70) vote("RSI 14", -1, `RSI ${r.toFixed(0)} — jenuh beli, rawan koreksi.`);
      else if (r >= 50 && r5 != null && r > r5) vote("RSI 14", 1, `RSI ${r.toFixed(0)} naik di atas 50 — momentum menguat.`);
      else if (r < 50 && r5 != null && r < r5) vote("RSI 14", -1, `RSI ${r.toFixed(0)} turun di bawah 50 — momentum melemah.`);
      else vote("RSI 14", 0, `RSI ${r.toFixed(0)} — momentum netral.`);
    }
    // 4. MACD (+ persilangan baru).
    const mm = ind.macd.m[i], ms = ind.macd.sg[i], mh = ind.macd.h[i], mh1 = ind.macd.h[i - 1];
    if (mm != null && ms != null) {
      let cross = 0; for (let k = i; k > i - 5; k--) { const a = ind.macd.h[k], p = ind.macd.h[k - 1]; if (a != null && p != null && Math.sign(a) !== Math.sign(p)) { cross = i - k + 1; break; } }
      const rising = mh1 != null && mh > mh1;
      vote("MACD 12/26/9", mm > ms ? 1 : -1, `MACD ${mm > ms ? "di atas" : "di bawah"} garis sinyal, histogram ${rising ? "membesar" : "mengecil"}${cross ? `; persilangan ${mm > ms ? "naik" : "turun"} ${cross} hari lalu` : ""}.`);
    }
    // 5. Bollinger Bands (+ squeeze).
    const up = ind.bb.up[i], lo = ind.bb.lo[i], mid = ind.bb.mid[i];
    if (up != null) {
      const bw = (up - lo) / mid, bws = ind.bb.up.map((u, k) => u != null ? (u - ind.bb.lo[k]) / ind.bb.mid[k] : null).slice(-120).filter(x => x != null);
      const squeeze = bws.length > 40 && bw <= Math.min(...bws) * 1.1;
      const pos = (c - lo) / (up - lo || 1);
      if (c < lo) vote("Bollinger 20,2", 1, `Harga di bawah pita bawah ${rpx(lo)} — jenuh jual secara statistik.`);
      else if (c > up) vote("Bollinger 20,2", -1, `Harga di atas pita atas ${rpx(up)} — terlalu jauh dari rata-rata.`);
      else vote("Bollinger 20,2", 0, `Harga di ${Math.round(pos * 100)}% lebar pita (${rpx(lo)}–${rpx(up)}).`);
      if (squeeze) votes[votes.length - 1].txt += " Pita sedang menyempit tajam (squeeze) — volatilitas biasanya akan meledak.";
    }
    // 6. Volume: konfirmasi atau distribusi.
    const va = ind.vma[i];
    if (va) {
      const ratio = b.v / va, dir = c >= (bars[i - 1]?.c ?? c);
      if (ratio >= 1.5) vote("Volume", dir ? 1 : -1, `Volume ${x2(ratio)} rata-rata 20 hari pada hari ${dir ? "naik — akumulasi" : "turun — distribusi"}.`);
      else vote("Volume", 0, `Volume ${x2(ratio)} rata-rata 20 hari — tanpa konfirmasi.`);
    }
    const score = votes.reduce((s, x) => s + x.s, 0);
    const sig = score >= 3 ? ["Beli kuat", "good"] : score >= 2 ? ["Beli", "good"] : score <= -3 ? ["Jual kuat", "bad"] : score <= -2 ? ["Jual", "bad"] : ["Netral", "warn"];
    // Level kunci: support/resistance dari pita, SAR, dan ekstrem 20 hari.
    const last20 = bars.slice(-20), lo20 = Math.min(...last20.map(x => x.l)), hi20 = Math.max(...last20.map(x => x.h));
    const supports = [lo, sUp ? sar : null, lo20].filter(x => x != null && x < c), resists = [up, !sUp ? sar : null, hi20].filter(x => x != null && x > c);
    const sup = supports.length ? Math.max(...supports) : lo20, res = resists.length ? Math.min(...resists) : hi20;
    const stop = sUp && sar < c ? sar : lo20;
    const valDay = (va || 0) * 100 * c;   // nilai transaksi harian rata-rata (lot × 100 × harga)
    return { votes, score, sig, sup, res, stop, hi20, lo20, valDay, rr: c > stop && res > c ? (res - c) / (c - stop) : null };
  }

  function renderTechnical() {
    const st = taState; if (!st) return;
    const s = taSignals(st), b = st.bars[st.bars.length - 1], prev = st.bars[st.bars.length - 2];
    const pa = PANDANGAN[st.t], d = items.find(x => x.ticker === st.t);
    const gauge = ((s.score + 6) / 12) * 100;
    const conflict = pa && ((s.score >= 2 && /hindari|spekulatif/i.test(pa.sikap)) || (s.score <= -2 && /asimetri/i.test(pa.sikap)));
    $("anOut").innerHTML = `
      <article class="an-card ta-card">
        <header class="an-head">
          <div><div class="eyebrow">Analisa teknikal · candle harian · data hingga ${esc(fmtDate(b.d))}</div>
            <h2>${esc(st.t)} <span class="nm">${esc(d?.name || "")}</span></h2>
            <div class="nm">Penutupan ${rp(b.c)} ${pctTxt(b.c, prev?.c)} · O ${rp(b.o)} H ${rp(b.h)} L ${rp(b.l)} · volume ${fmt(b.v, 0)} lot</div></div>
          <div class="an-side">
            <button class="btn an-x" type="button" data-ta="close" title="Tutup dan kembali ke tabel">Tutup</button>
            <div class="an-score s-${s.sig[1]}"><b>${s.score > 0 ? "+" : ""}${s.score}</b><span>/±6</span><em>Sinyal teknikal: ${s.sig[0]}</em></div>
          </div>
        </header>
        ${s.hi20 === s.lo20 || st.bars.slice(-10).every(x => !x.v) ? `<p class="an-warn"><b>Perhatian:</b> harga tidak bergerak${st.bars.slice(-10).every(x => !x.v) ? " dan tanpa volume" : ""} dalam beberapa pekan terakhir (kemungkinan suspensi atau harga lantai). Indikator teknikal di bawah tidak bermakna untuk saham ini.</p>` : ""}
        <div class="ta-gauge" aria-label="Skala sinyal"><i style="left:${gauge}%"></i><span>Jual kuat</span><span>Jual</span><span>Netral</span><span>Beli</span><span>Beli kuat</span></div>
        <div class="ta-range" role="group" aria-label="Rentang chart">${[[60, "3 bln"], [120, "6 bln"], [st.bars.length, "1 thn"]].map(([n, l]) => `<button type="button" class="${st.range === n ? "on" : ""}" aria-pressed="${st.range === n}" data-n="${n}">${l}</button>`).join("")}
          <span class="nm ta-leg"><i class="lg-bb"></i>Bollinger 20,2 <i class="lg-ma"></i>MA50 <i class="lg-sar"></i>Parabolic SAR</span></div>
        <div class="ta-chart" id="taChart">${taChartSvg(st)}<div class="ta-tip" id="taTip" hidden></div></div>
        <div class="an-grid">
          <section><h3>Pembacaan indikator</h3>
            <table class="an-lv"><tbody>${s.votes.map(v => `<tr><td><b>${esc(v.k)}</b><div class="nm">${esc(v.txt)}</div></td><td class="r"><span class="pill an-p-${v.s > 0 ? "good" : v.s < 0 ? "bad" : "warn"}">${v.s > 0 ? "Beli" : v.s < 0 ? "Jual" : "Netral"}</span></td></tr>`).join("")}</tbody></table>
          </section>
          <section><h3>Rekomendasi teknikal</h3>
            <p class="ta-rec s-${s.sig[1]}"><b>${s.sig[0]}</b> — ${esc(taVerdict(s))}</p>
            <table class="an-lv"><tbody>
              <tr><td>Resistance terdekat<div class="nm">pita atas / SAR / tertinggi 20 hari</div></td><td class="r num">${rp(s.res)}</td><td class="r num">${pctTxt(s.res, b.c)}</td></tr>
              <tr><td>Support terdekat<div class="nm">pita bawah / SAR / terendah 20 hari</div></td><td class="r num">${rp(s.sup)}</td><td class="r num">${pctTxt(s.sup, b.c)}</td></tr>
              <tr><td>Level invalidasi<div class="nm">${s.stop === s.lo20 ? "terendah 20 hari" : "Parabolic SAR"} — sinyal batal bila ditutup di bawahnya</div></td><td class="r num">${rp(s.stop)}</td><td class="r num">${pctTxt(s.stop, b.c)}</td></tr>
            </tbody></table>
            ${s.rr != null ? `<p class="nm">Rasio imbal-risiko ke resistance ${s.rr.toFixed(1).replace(".", ",")} : 1${s.rr < 1.5 ? " — kurang menarik secara teknikal." : "."}</p>` : ""}
            ${s.valDay < 5e8 ? `<p class="an-warn">Likuiditas tipis (transaksi harian rata-rata ${big(s.valDay)}): indikator teknikal mudah terdistorsi oleh satu-dua transaksi besar.</p>` : `<p class="nm">Transaksi harian rata-rata ${big(s.valDay)}.</p>`}
            ${pa ? `<p class="${conflict ? "an-warn" : "nm"}"><b>Dibanding pandangan analis (${esc(pa.sikap)}):</b> ${conflict ? "sinyal teknikal bertentangan dengan pandangan fundamental — perlakukan sebagai momentum jangka pendek, bukan perubahan tesis." : "sinyal teknikal sejalan atau tidak bertentangan dengan pandangan fundamental."}</p>` : ""}
          </section>
        </div>
        <p class="disc">Sinyal dihitung otomatis dari 6 indikator (tren MA, Parabolic SAR, RSI, MACD, Bollinger, volume) atas candle harian Stockbit. Bersifat umum, bukan saran investasi personal; bukan dari penasihat berlisensi.</p>
      </article>`;
    $("anOut").querySelector("[data-ta=close]").onclick = () => { $("anOut").innerHTML = ""; $("potTable").scrollIntoView({ behavior: "smooth", block: "start" }); };
    $("anOut").querySelectorAll(".ta-range [data-n]").forEach(btn => btn.onclick = () => { st.range = +btn.dataset.n; renderTechnical(); });
    wireTaHover(st);
  }
  function taVerdict(s) {
    const pos = s.votes.filter(v => v.s > 0).map(v => v.k), neg = s.votes.filter(v => v.s < 0).map(v => v.k);
    if (s.score >= 3) return `mayoritas indikator searah naik (${pos.join(", ")}). Momentum kuat; disiplin pada level invalidasi.`;
    if (s.score >= 2) return `kecenderungan naik (${pos.join(", ")}), tetapi belum semua indikator mengonfirmasi${neg.length ? ` (${neg.join(", ")} masih negatif)` : ""}.`;
    if (s.score <= -3) return `mayoritas indikator searah turun (${neg.join(", ")}). Hindari menangkap pisau jatuh sebelum ada pembalikan SAR/MACD.`;
    if (s.score <= -2) return `kecenderungan turun (${neg.join(", ")})${pos.length ? `; ${pos.join(", ")} masih positif` : ""}. Tunggu konfirmasi pembalikan.`;
    return `indikator saling bertentangan${pos.length ? ` (positif: ${pos.join(", ")}` : ""}${neg.length ? `${pos.length ? "; " : " ("}negatif: ${neg.join(", ")}` : ""}${pos.length || neg.length ? ")" : ""}. Tunggu arah yang lebih jelas.`;
  }

  // ================= Spekulasi: trading plan + money management =================
  // Fraksi harga BEI: <200 → 1; <500 → 2; <2.000 → 5; <5.000 → 10; ≥5.000 → 25.
  const tick = p => p < 200 ? 1 : p < 500 ? 2 : p < 2000 ? 5 : p < 5000 ? 10 : 25;
  const floorTick = p => { const t = tick(p); return Math.floor(p / t) * t; };
  const ceilTick = p => { const t = tick(p); return Math.ceil(p / t) * t; };
  const MM_KEY = "radar-cangkang.mm";
  const MM_DEF = { modal: 100000000, risk: 1, maxPos: 20, fb: 0.15, fs: 0.25 };

  // Rencana dari sinyal teknikal: ikuti tren (sinyal Beli), tunggu breakout (Netral), atau rencana keluar (Jual).
  function buildPlan(st) {
    const s = taSignals(st), i = st.bars.length - 1, c = st.bars[i].c, I = st.ind;
    const atr = I.atr[i] || c * 0.03, sar = I.sar.sar[i], sUp = I.sar.up[i];
    const frozen = s.hi20 === s.lo20 || st.bars.slice(-10).every(x => !x.v);
    let type, entryLo, entryHi, entry, stop, note;
    if (s.score >= 2) {
      type = "Ikuti tren — beli saat koreksi ke zona";
      entryHi = floorTick(c); entryLo = floorTick(Math.max(s.sup, c - 0.5 * atr));
      entry = floorTick((entryLo + entryHi) / 2);
      stop = floorTick(Math.min(sUp && sar < entry ? sar : s.lo20, entry - atr));
      note = "Sinyal teknikal positif: masuk bertahap di zona entry, jangan mengejar harga di atas batas zona.";
    } else if (s.score > -2) {
      type = "Tunggu breakout — beli hanya bila resistance ditembus";
      entry = ceilTick(s.res + tick(s.res)); entryLo = entry; entryHi = ceilTick(entry + 0.5 * atr);
      stop = floorTick(Math.max(s.sup, entry - 2 * atr));
      note = `Indikator belum searah: rencana aktif hanya bila harga ditutup di atas ${rp(s.res)} dengan volume di atas rata-rata.`;
    } else {
      type = "Tidak ada setup beli — rencana keluar";
      entry = null; entryLo = entryHi = null; stop = floorTick(s.sup);
      note = `Sinyal teknikal negatif. Bagi pemegang: manfaatkan pantulan ke ${rp(s.res)} untuk mengurangi posisi; keluar penuh bila ditutup di bawah ${rp(s.sup)}.`;
    }
    if (entry != null && stop >= entry) stop = floorTick(entry - Math.max(tick(entry), atr));
    const R = entry != null ? entry - stop : null;
    const tp1 = R ? floorTick(entry + 1.5 * R) : null, tp2 = R ? floorTick(entry + 3 * R) : null;
    const resBlock = R && s.res > entry && s.res < tp1 ? s.res : null;   // resistance yang menghadang sebelum TP1
    return { s, c, atr, sar, sUp, frozen, type, entryLo, entryHi, entry, stop, R, tp1, tp2, resBlock, note };
  }

  function renderSpeculation() {
    const st = taState; if (!st) return;
    const pl = buildPlan(st), s = pl.s, pa = PANDANGAN[st.t], d = items.find(x => x.ticker === st.t);
    let mm = MM_DEF;
    try { mm = { ...MM_DEF, ...JSON.parse(localStorage.getItem(MM_KEY) || "{}") }; } catch {}
    const inp = (id, label, val, step, hint) => `<label class="an-in"><span>${label}</span><input type="number" id="${id}" value="${val}" step="${step}" min="0"><em>${hint}</em></label>`;
    const stopPct = pl.entry ? (pl.entry - pl.stop) / pl.entry : null;
    $("anOut").innerHTML = `
      <article class="an-card ta-card">
        <header class="an-head">
          <div><div class="eyebrow">Spekulasi · trading plan & money management · data hingga ${esc(fmtDate(st.bars[st.bars.length - 1].d))}</div>
            <h2>${esc(st.t)} <span class="nm">${esc(d?.name || "")}</span></h2>
            <div class="nm">Harga ${rp(pl.c)} · ATR 14 hari ${rp(pl.atr)} (${(pl.atr / pl.c * 100).toFixed(1).replace(".", ",")}%) · sinyal teknikal <b>${s.sig[0]}</b> (${s.score > 0 ? "+" : ""}${s.score}/±6)</div></div>
          <div class="an-side">
            <button class="btn an-x" type="button" data-sp="close" title="Tutup dan kembali ke tabel">Tutup</button>
            <button class="btn" type="button" data-sp="ta">Lihat chart teknikal</button>
          </div>
        </header>
        ${pl.frozen ? `<p class="an-warn"><b>Tidak dapat diperdagangkan:</b> harga tidak bergerak/tanpa volume (kemungkinan suspensi atau harga lantai). Rencana di bawah hanya ilustrasi.</p>` : ""}
        <section class="sp-setup s-${pl.entry ? (s.score >= 2 ? "good" : "warn") : "bad"}"><h3>Setup</h3><p><b>${esc(pl.type)}</b></p><p class="nm">${esc(pl.note)}</p></section>
        <div class="an-grid">
          <section><h3>Trading plan</h3>
            <table class="an-lv"><tbody>
              ${pl.entry ? `<tr><td><b>Zona entry</b><div class="nm">${s.score >= 2 ? "beli bertahap, limit order" : "aktif bila ditutup di atas resistance"}</div></td><td class="r num">${rp(pl.entryLo)}${pl.entryHi !== pl.entryLo ? ` – ${rp(pl.entryHi)}` : ""}</td><td class="r num">${pctTxt(pl.entry, pl.c)}</td></tr>
              <tr><td><b>Harga entry acuan</b></td><td class="r num">${rp(pl.entry)}</td><td></td></tr>` : ""}
              <tr><td><b>Stop loss</b><div class="nm">${pl.entry ? `${pl.sUp && pl.stop <= pl.sar ? "di bawah Parabolic SAR" : "di bawah support/terendah 20 hari"}, ≥1× ATR dari entry` : "batas keluar penuh bagi pemegang"}</div></td><td class="r num down">${rp(pl.stop)}</td><td class="r num">${pctTxt(pl.stop, pl.entry || pl.c)}</td></tr>
              ${pl.entry ? `<tr><td><b>Target 1</b><div class="nm">1,5R — jual 50%, naikkan stop ke titik impas</div></td><td class="r num up">${rp(pl.tp1)}</td><td class="r num">${pctTxt(pl.tp1, pl.entry)}</td></tr>
              <tr><td><b>Target 2</b><div class="nm">3R — sisa posisi, trailing stop Parabolic SAR</div></td><td class="r num up">${rp(pl.tp2)}</td><td class="r num">${pctTxt(pl.tp2, pl.entry)}</td></tr>` : `<tr><td><b>Area jual saat pantulan</b><div class="nm">resistance terdekat</div></td><td class="r num">${rp(s.res)}</td><td class="r num">${pctTxt(s.res, pl.c)}</td></tr>`}
            </tbody></table>
            ${pl.resBlock ? `<p class="an-warn">Resistance ${rp(pl.resBlock)} berada sebelum Target 1 — pertimbangkan ambil sebagian di sana.</p>` : ""}
            ${stopPct != null && stopPct > 0.1 ? `<p class="an-warn">Jarak stop ${(stopPct * 100).toFixed(1).replace(".", ",")}% dari entry — lebar; ukuran posisi otomatis mengecil.</p>` : ""}
          </section>
          <section><h3>Money management</h3>
            <div class="an-calc-in">
              ${inp("mmModal", "Modal trading (Rp)", mm.modal, "1000000", "total dana untuk trading")}
              ${inp("mmRisk", "Risiko per transaksi (%)", mm.risk, "0.25", "umumnya 0,5–2% modal")}
              ${inp("mmMax", "Maks. porsi per saham (%)", mm.maxPos, "5", "batas konsentrasi")}
              ${inp("mmFb", "Biaya beli (%)", mm.fb, "0.01", "fee broker")}
              ${inp("mmFs", "Biaya jual (%)", mm.fs, "0.01", "fee + pajak 0,1%")}
            </div>
            <div id="mmOut"></div>
          </section>
        </div>
        <div class="an-grid">
          <section><h3>Eksekusi bertahap</h3><ol class="sp-steps">
            ${pl.entry ? `<li>Pasang <b>limit order</b> di zona ${rp(pl.entryLo)}${pl.entryHi !== pl.entryLo ? `–${rp(pl.entryHi)}` : ""}; batal bila harga lari di atas ${rp(ceilTick((pl.entryHi || pl.entry) + 0.5 * pl.atr))} (jangan mengejar).</li>
            <li>Segera pasang <b>stop loss</b> (auto order) di ${rp(pl.stop)} — penutupan harian di bawahnya berarti keluar tanpa tawar-menawar.</li>
            <li>Di <b>Target 1</b> ${rp(pl.tp1)} jual 50% dan pindahkan stop ke titik impas.</li>
            <li>Sisa 50% diikat <b>trailing stop</b> Parabolic SAR menuju Target 2 ${rp(pl.tp2)}.</li>
            <li><b>Batas waktu</b>: bila dalam 10 hari bursa harga tidak bergerak ke Target 1, keluar — modal punya biaya peluang.</li>` :
            `<li>Tidak membuka posisi baru selama sinyal teknikal ${esc(s.sig[0])}.</li>
            <li>Bagi pemegang: kurangi posisi saat pantulan ke ${rp(s.res)}.</li>
            <li>Keluar penuh bila harga ditutup di bawah ${rp(pl.stop)}.</li>
            <li>Tinjau ulang setup bila Parabolic SAR berbalik ke bawah harga dan MACD memotong ke atas garis sinyal.</li>`}
          </ol></section>
          <section><h3>Kelayakan transaksi</h3><ul class="sp-check" id="spCheck"></ul><p class="sp-verdict" id="spVerdict"></p></section>
        </div>
        <p class="disc">Rencana dihitung otomatis dari indikator teknikal dan parameter yang Anda isi; bersifat umum, bukan saran investasi personal dan bukan dari penasihat berlisensi. Saham tipis rawan gap melewati stop loss — kerugian nyata bisa lebih besar dari perhitungan.</p>
      </article>`;
    $("anOut").querySelector("[data-sp=close]").onclick = () => { $("anOut").innerHTML = ""; $("potTable").scrollIntoView({ behavior: "smooth", block: "start" }); };
    $("anOut").querySelector("[data-sp=ta]").onclick = () => renderTechnical();
    const calc = () => {
      const g = id => Math.max(0, +$(id).value || 0);
      const m = { modal: g("mmModal"), risk: g("mmRisk"), maxPos: g("mmMax"), fb: g("mmFb"), fs: g("mmFs") };
      try { localStorage.setItem(MM_KEY, JSON.stringify(m)); } catch {}
      const fb = m.fb / 100, fs = m.fs / 100, half = pa && /hindari/i.test(pa.sikap);
      const checks = [
        [s.score > -2, `Sinyal teknikal bukan Jual (${s.sig[0]})`],
        [!pl.frozen, "Harga bergerak dan ada volume (tidak suspensi)"],
        [s.valDay >= 5e8, `Likuiditas ≥ Rp500 juta/hari (rata-rata ${big(s.valDay)})`],
        // Dua syarat ini hanya relevan bila ada setup beli.
        ...(pl.entry ? [[(pl.entry - pl.stop) / pl.entry <= 0.1, "Jarak stop loss ≤ 10% dari entry"], [!pl.resBlock, "Tidak ada resistance sebelum Target 1"]] : []),
        [!half, pa ? `Pandangan analis bukan Hindari (${pa.sikap})` : "Belum ada pandangan analis"],
      ];
      if (!pl.entry) {
        $("mmOut").innerHTML = `<p class="nm">Tidak ada posisi beli yang dihitung karena tidak ada setup beli. Pakai parameter ini saat setup muncul.</p>`;
      } else {
        const lossPS = (pl.entry - pl.stop) + pl.entry * fb + pl.stop * fs;
        let lots = Math.floor(m.modal * m.risk / 100 / (lossPS * 100));
        const capLots = Math.floor(m.modal * m.maxPos / 100 / (pl.entry * 100 * (1 + fb)));
        const liqLots = Math.floor(0.1 * s.valDay / (pl.entry * 100));   // posisi ≤ 10% nilai transaksi harian
        const why = [];
        if (lots > capLots) { lots = capLots; why.push(`dibatasi maks. porsi ${m.maxPos}% modal`); }
        if (half) { lots = Math.floor(lots / 2); why.push("dipotong 50% karena pandangan analis Hindari"); }
        if (lots > liqLots) { lots = Math.max(0, liqLots); why.push("dibatasi 10% nilai transaksi harian agar bisa keluar"); }
        const sh = lots * 100, pos = sh * pl.entry * (1 + fb);
        const pnl = tp => sh * (tp * (1 - fs) - pl.entry * (1 + fb));
        const bep = ceilTick(pl.entry * (1 + fb) / (1 - fs));
        const cell = (l, v, sub = "") => `<div><span class="eyebrow">${l}</span><b>${v}</b>${sub ? `<span class="nm">${sub}</span>` : ""}</div>`;
        $("mmOut").innerHTML = `<div class="pf-kpi">
            ${cell("Jumlah", fmt(lots, 0) + " lot", fmt(sh, 0) + " saham")}
            ${cell("Nilai posisi", rp(pos),`${(pos / (m.modal || 1) * 100).toFixed(1).replace(".", ",")}% modal`)}
            ${cell("Rugi maks. (kena stop)", `<span class="down">−${rp(sh * lossPS)}</span>`, `${(sh * lossPS / (m.modal || 1) * 100).toFixed(2).replace(".", ",")}% modal`)}
            ${cell("Laba di Target 1 (50%)", `<span class="up">+${rp(pnl(pl.tp1) / 2)}</span>`)}
            ${cell("Laba di Target 2 (50%)", `<span class="up">+${rp(pnl(pl.tp2) / 2)}</span>`)}
            ${cell("Titik impas", rp(bep), "setelah biaya beli+jual")}
          </div>${why.length ? `<p class="nm">Ukuran ${why.join("; ")}.</p>` : ""}${lots === 0 ? `<p class="an-warn">Modal/risiko terlalu kecil untuk 1 lot pada jarak stop ini, atau likuiditas tidak cukup.</p>` : ""}`;
      }
      $("spCheck").innerHTML = checks.map(([ok, t]) => `<li class="${ok ? "ok" : "no"}">${ok ? "✓" : "✗"} ${esc(t)}</li>`).join("");
      const fails = checks.filter(x => !x[0]).length;
      const v = !pl.entry || pl.frozen ? ["Tidak layak dibuka sekarang", "bad"] : fails === 0 ? ["Layak dieksekusi sesuai rencana", "good"] : fails <= 2 ? ["Layak dengan ukuran diperkecil & disiplin stop", "warn"] : ["Tidak layak — terlalu banyak syarat gagal", "bad"];
      $("spVerdict").className = "sp-verdict s-" + v[1]; $("spVerdict").textContent = v[0];
    };
    ["mmModal", "mmRisk", "mmMax", "mmFb", "mmFs"].forEach(id => $(id).addEventListener("input", calc));
    calc();
  }

  // Chart SVG: harga (candle + Bollinger + MA50 + SAR), volume, RSI, MACD dalam satu sumbu waktu.
  function taChartSvg(st) {
    const n = Math.min(st.range, st.bars.length), off = st.bars.length - n, B = st.bars.slice(off), I = st.ind;
    const W = 1000, L = 8, R = 64, PW = W - L - R;
    const P = { top: 10, h: 280 }, V = { top: 300, h: 60 }, Rs = { top: 375, h: 70 }, M = { top: 460, h: 80 }, H = 548;
    const xs = PW / n, x = k => L + xs * (k + 0.5);
    const pick = arr => arr.slice(off);
    const bbU = pick(I.bb.up), bbL = pick(I.bb.lo), bbM = pick(I.bb.mid), ma50 = pick(I.ma50), sar = pick(I.sar.sar), sUp = pick(I.sar.up);
    const lo = Math.min(...B.map(b => b.l), ...bbL.filter(v => v != null)), hi = Math.max(...B.map(b => b.h), ...bbU.filter(v => v != null));
    const py = v => P.top + (hi - v) / (hi - lo || 1) * P.h;
    const line = (arr, y) => { let dd = "", pen = false; arr.forEach((v, k) => { if (v == null) { pen = false; return; } dd += `${pen ? "L" : "M"}${x(k).toFixed(1)},${y(v).toFixed(1)}`; pen = true; }); return dd; };
    // Pita Bollinger sebagai area.
    const idx = bbU.map((v, k) => v != null ? k : -1).filter(k => k >= 0);
    const band = idx.length ? `M${idx.map(k => `${x(k).toFixed(1)},${py(bbU[k]).toFixed(1)}`).join("L")}L${idx.slice().reverse().map(k => `${x(k).toFixed(1)},${py(bbL[k]).toFixed(1)}`).join("L")}Z` : "";
    const cw = Math.max(1, xs * 0.62);
    const candles = B.map((b, k) => { const upC = b.c >= b.o, cls = upC ? "ta-up" : "ta-dn", y1 = py(Math.max(b.o, b.c)), y2 = py(Math.min(b.o, b.c));
      return `<line class="${cls}" x1="${x(k)}" x2="${x(k)}" y1="${py(b.h)}" y2="${py(b.l)}"/><rect class="${cls}" x="${x(k) - cw / 2}" y="${y1}" width="${cw}" height="${Math.max(1, y2 - y1)}"/>`; }).join("");
    const sarDots = sar.map((v, k) => v == null ? "" : `<circle class="${sUp[k] ? "ta-sar-up" : "ta-sar-dn"}" cx="${x(k)}" cy="${py(v)}" r="${Math.min(2.4, xs * 0.3)}"/>`).join("");
    // Sumbu harga (4 garis bantu).
    const ticks = [0, 1, 2, 3, 4].map(j => lo + (hi - lo) * j / 4);
    const grid = ticks.map(v => `<line class="ta-grid" x1="${L}" x2="${W - R}" y1="${py(v)}" y2="${py(v)}"/><text class="ta-ax" x="${W - R + 6}" y="${py(v) + 4}">${Math.round(v).toLocaleString("id-ID")}</text>`).join("");
    // Volume.
    const vmax = Math.max(...B.map(b => b.v)) || 1;
    const vols = B.map((b, k) => `<rect class="${b.c >= b.o ? "ta-vup" : "ta-vdn"}" x="${x(k) - cw / 2}" y="${V.top + V.h - b.v / vmax * V.h}" width="${cw}" height="${b.v / vmax * V.h}"/>`).join("");
    const vma = pick(I.vma), vy = v => V.top + V.h - v / vmax * V.h;
    // RSI.
    const rsi = pick(I.rsi), ry = v => Rs.top + (100 - v) / 100 * Rs.h;
    // MACD.
    const mm = pick(I.macd.m), ms = pick(I.macd.sg), mh = pick(I.macd.h);
    const mAbs = Math.max(...[...mm, ...ms, ...mh].filter(v => v != null).map(Math.abs)) || 1, my = v => M.top + M.h / 2 - v / mAbs * (M.h / 2);
    const hist = mh.map((v, k) => v == null ? "" : `<rect class="${v >= 0 ? "ta-vup" : "ta-vdn"}" x="${x(k) - cw / 2}" y="${Math.min(my(v), my(0))}" width="${cw}" height="${Math.abs(my(v) - my(0))}"/>`).join("");
    // Label bulan.
    let lastM = "", months = "";
    B.forEach((b, k) => { const mo = b.d.slice(0, 7); if (mo !== lastM) { lastM = mo; if (k > 2) months += `<line class="ta-grid" x1="${x(k)}" x2="${x(k)}" y1="${P.top}" y2="${M.top + M.h}"/><text class="ta-ax" x="${x(k) + 3}" y="${H - 2}">${new Date(b.d + "T00:00:00").toLocaleDateString("id-ID", { month: "short", year: "2-digit" })}</text>`; } });
    const lbl = (y, t) => `<text class="ta-lbl" x="${L + 4}" y="${y + 11}">${t}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="ta-svg" role="img" aria-label="Chart teknikal ${esc(st.t)}">
      ${months}${grid}
      <path class="ta-band" d="${band}"/><path class="ta-bbl" d="${line(bbU, py)}"/><path class="ta-bbl" d="${line(bbL, py)}"/><path class="ta-bbm" d="${line(bbM, py)}"/>
      <path class="ta-ma" d="${line(ma50, py)}"/>${candles}${sarDots}
      ${lbl(V.top - 2, "Volume (lot) · MA20")}${vols}<path class="ta-vma" d="${line(vma, vy)}"/>
      ${lbl(Rs.top - 2, "RSI 14")}<rect class="ta-zone" x="${L}" y="${ry(70)}" width="${PW}" height="${ry(30) - ry(70)}"/>
      <line class="ta-ref" x1="${L}" x2="${W - R}" y1="${ry(70)}" y2="${ry(70)}"/><line class="ta-ref" x1="${L}" x2="${W - R}" y1="${ry(30)}" y2="${ry(30)}"/>
      <text class="ta-ax" x="${W - R + 6}" y="${ry(70) + 4}">70</text><text class="ta-ax" x="${W - R + 6}" y="${ry(30) + 4}">30</text>
      <path class="ta-rsi" d="${line(rsi, ry)}"/>
      ${lbl(M.top - 2, "MACD 12/26/9")}<line class="ta-ref" x1="${L}" x2="${W - R}" y1="${my(0)}" y2="${my(0)}"/>${hist}
      <path class="ta-macd" d="${line(mm, my)}"/><path class="ta-sig" d="${line(ms, my)}"/>
      <line class="ta-cross" id="taCross" x1="0" x2="0" y1="${P.top}" y2="${M.top + M.h}" visibility="hidden"/>
      <rect class="ta-hit" x="${L}" y="0" width="${PW}" height="${H}" data-off="${off}" data-n="${n}"/>
    </svg>`;
  }
  // Garis bantu + tooltip saat kursor di atas chart.
  function wireTaHover(st) {
    const box = $("taChart"), svg = box?.querySelector("svg"), hit = svg?.querySelector(".ta-hit"), tip = $("taTip"), cross = $("taCross");
    if (!hit) return;
    const off = +hit.dataset.off, n = +hit.dataset.n, W = 1000, L = 8, PW = W - L - 64;
    const move = e => {
      const rc = svg.getBoundingClientRect(), sx = (e.clientX - rc.left) / rc.width * W;
      const k = Math.max(0, Math.min(n - 1, Math.floor((sx - L) / (PW / n)))), i = off + k, b = st.bars[i], I = st.ind;
      const cx = L + PW / n * (k + 0.5);
      cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("visibility", "visible");
      const f1 = v => v == null ? "–" : v.toLocaleString("id-ID", { maximumFractionDigits: 1 });
      tip.innerHTML = `<b>${esc(fmtDate(b.d))}</b><span>O ${rp(b.o)} · H ${rp(b.h)} · L ${rp(b.l)} · C ${rp(b.c)}</span>
        <span>Vol ${fmt(b.v, 0)} lot</span><span>BB ${rp(I.bb.lo[i])} – ${rp(I.bb.up[i])} · SAR ${rp(I.sar.sar[i])}</span>
        <span>RSI ${f1(I.rsi[i])} · MACD ${f1(I.macd.m[i])} / ${f1(I.macd.sg[i])}</span>`;
      tip.hidden = false;
      const px = (cx / W) * rc.width;
      tip.style.left = (px > rc.width / 2 ? px - tip.offsetWidth - 12 : px + 12) + "px";
    };
    hit.addEventListener("mousemove", move);
    hit.addEventListener("mouseleave", () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); });
  }

  function renderStory(prog) {
    const box = $("storyList");
    if (!box) return;
    // Filter status (memakai pola tombol yang sama dengan Progress).
    const sf = $("storyFilter"); sf.replaceChildren();
    for (const [id, label] of [["", "Semua"], ["proses", "Proses"], ["selesai", "Selesai"]]) {
      const n = prog.filter(d => !id || d.deal === id).length;
      const b = Object.assign(document.createElement("button"), { type: "button", textContent: `${label} (${n})` });
      b.setAttribute("aria-pressed", String(storyFilter === id));
      b.onclick = () => { storyFilter = id; render(); };
      sf.append(b);
    }
    const q = ($("storyQ").value || "").trim().toLowerCase();
    const list = prog.map(d => ({ d, s: deriveStory(d) }))
      .filter(({ d, s }) => (!storyFilter || d.deal === storyFilter) &&
        (!q || [d.ticker, d.name, s.lama, s.baru, s.oldName, d.ctrlName, s.inject, s.injType, s.injCo].some(v => (v || "").toLowerCase().includes(q))))
      .sort((x, y) => (x.d.deal === y.d.deal ? 0 : x.d.deal === "proses" ? -1 : 1) || y.d.prog.pct - x.d.prog.pct);
    const tag = (edited, src) => edited ? '<span class="edited">diubah</span>' : src ? `<a class="auto" href="${esc(src.url)}" target="_blank" rel="noopener" title="${esc(src.title)}">sumber ${esc(fmtDate(src.date))}</a>` : "";
    box.innerHTML = list.length ? list.map(({ d, s }) => `
      <article class="story" data-id="${esc(d.id)}">
        <header>
          <div><span class="tk">${esc(d.ticker)}</span> <span class="pill d-${d.deal}">${DEAL_LABEL[d.deal]}</span>
            <div class="nm">${esc(d.name || "")}</div></div>
          <div class="acts"><button class="btn" type="button" data-act="profile">Profil</button></div>
        </header>
        <div class="biz">
          <div class="old"><span class="eyebrow">Bisnis lama ${s.lamaEdited ? '<span class="edited">diubah</span>' : ""}</span><b>${esc(s.lama || (s.loaded ? "–" : "Memuat…"))}</b>${s.lamaNote ? `<p>${esc(s.lamaNote.slice(0, 180))}</p>` : ""}</div>
          <div class="arrow" aria-hidden="true">→</div>
          <div class="new"><span class="eyebrow">Bisnis baru ${tag(s.baruEdited, s.baruSrc)}</span><b>${esc(s.baru || "Belum terungkap di laporan")}</b></div>
        </div>
        <div class="ctl">
          <div class="old-c"><span class="eyebrow">Pengendali lama</span>
            <span class="who">${esc(s.oldName || (s.loaded ? "Tidak tercatat" : "Memuat…"))}${s.oldInferred ? ' <span class="auto" title="Penjual tidak tercatat; ini pemegang ≥20% terakhir sebelum pengambilalihan">perkiraan</span>' : ""}${s.oldEdited ? ' <span class="edited">diubah</span>' : ""}</span>
            ${s.oldPct ? `<span class="num">${fmt(Math.min(100, s.oldPct), 2)}%</span><div class="hbar"><i style="width:${Math.min(100, s.oldPct)}%"></i></div>` : ""}</div>
          <div><span class="eyebrow">Pengendali baru${s.takeoverDate ? " · sejak " + esc(fmtDate(s.takeoverDate)) : ""}</span>
            ${(d.ctrlName || d.acquirer) ? `<button type="button" class="who linkish" data-act="ctrl" title="Lihat data pengendali & afiliasinya">${esc(d.ctrlName || d.acquirer)}</button>` : '<span class="who">–</span>'}
            ${num(d.ctrlPct) != null ? `<span class="num">${fmt(num(d.ctrlPct), 2)}%</span><div class="hbar own"><i style="width:${Math.min(100, num(d.ctrlPct))}%"></i></div>` : ""}</div>
        </div>
        <div class="facts">
          <div><span class="eyebrow">Progress</span><b class="big">${d.prog.pct}%</b><div class="pbar${d.prog.est ? " est" : ""}"><i style="width:${d.prog.pct}%"></i></div><span class="nm">${esc((STAGES.find(x => x.id === stageOf(d)) || STAGES[0]).name)}</span></div>
          <div title="${esc(s.inject || "")}"><span class="eyebrow">Injeksi aset ${tag(s.injectEdited, s.injectSrc)}</span>
            ${s.inject ? `<b class="inj">${esc(s.injType)}</b>${s.injCo ? `<span class="nm">${esc(s.injCo)}</span>` : ""}` : "<b>Belum diumumkan</b>"}
            ${s.nominal ? `<span class="big">${esc(s.nominal)}</span>` : s.inject ? '<span class="nm">Nilai belum disebut</span>' : ""}
            ${s.inject ? `<details class="more"><summary>detail</summary><span class="nm">${esc(s.inject)}</span></details>` : ""}</div>
          <div><span class="eyebrow">Target penyelesaian ${s.targetEdited ? '<span class="edited">diubah</span>' : ""}</span><b class="clamp" title="Klik untuk buka/tutup">${esc(s.target)}</b></div>
        </div>
        ${s.verified ? `<p class="vnote"><span class="vok">Dicek dengan Stockbit Reports${s.vSrc ? " · " + esc(fmtDate(s.vSrc.date)) : ""}</span>${s.vNote ? " " + esc(s.vNote) : ""}</p>` : ""}
      </article>`).join("")
      : `<div class="empty"><strong>Tidak ada emiten</strong><span>Ubah saringan atau kata kunci.</span></div>`;
    box.querySelectorAll(".story").forEach(card => {
      const id = card.dataset.id;
      card.querySelector("[data-act=profile]").onclick = () => openProfile(id);
      const c = card.querySelector("[data-act=ctrl]");
      if (c) c.onclick = () => openController(id);
    });
  }

  // Popup pengendali baru: identitas, UBO, pengurus emiten, dan seluruh kepemilikannya di emiten lain (afiliasi).
  const normName = s => String(s || "").toUpperCase().replace(/\bPT\.?\s*|\bTBK\.?|[.,]/g, " ").replace(/\s+/g, " ").trim();
  async function openController(id) {
    const d = items.find(x => x.id === id);
    if (!d) return;
    // Bila pengendali lebih dari satu ("A, B"), pakai nama pertama untuk pencarian.
    const name = String(d.ctrlName || d.acquirer || "").replace(/\s*\(.*\)$/, "").split(/,\s*(?=[A-Z])/)[0];
    const body = $("pfBody");
    body.innerHTML = `<div class="pf-load">Memuat data pengendali ${esc(name)} dari Stockbit…</div>`;
    $("dlgP").showModal();
    let c;
    try {
      const r = await fetch("/api/controller?" + new URLSearchParams({ ticker: d.ticker, name }));
      c = await r.json();
      if (!r.ok) throw new Error(c.error || r.status);
    } catch (e) {
      body.innerHTML = `<div class="pf-load">Data pengendali tidak bisa dimuat: ${esc(e.message || "server lokal tidak merespons")}.</div>
        <div class="ed-foot"><span></span><div><button class="btn" type="button" data-pf="close">Tutup</button></div></div>`;
      wireProfile(d); return;
    }
    const inRadar = t => items.find(x => x.ticker === t && stageOf(x) !== "radar");
    const s = deriveStory(scoredItems().find(x => x.id === id) || d);
    const holds = (c.holdings || []).filter(h => h.symbol !== d.ticker);
    const active = holds.filter(h => h.pct > 0), exited = holds.filter(h => !(h.pct > 0));
    // Emiten radar lain dengan nama pengendali yang sama (grup yang sama).
    const key = normName(c.name || name);
    const group = items.filter(x => x.id !== d.id && key && normName(x.ctrlName).includes(key));
    const row = h => {
      const r = inRadar(h.symbol);
      return `<tr><td><b>${esc(h.symbol)}</b>${r ? ' <span class="ctrl">Di radar</span>' : ""}${r?.name ? `<div class="nm">${esc(r.name)}</div>` : ""}</td>
        <td class="r num">${h.pct > 0 ? fmt(h.pct, 2) + "%" : "Keluar"}</td>
        <td>${esc(h.lastAction === "BUY" ? "Beli" : h.lastAction === "SELL" ? "Jual" : h.lastAction || "–")} · ${esc(fmtDate(h.lastDate))}</td>
        <td class="nm">${esc(fmtDate(h.since))}</td>
        <td><a href="https://stockbit.com/symbol/${esc(h.symbol)}" target="_blank" rel="noopener" aria-label="Buka ${esc(h.symbol)} di Stockbit" title="Buka di Stockbit"></a></td></tr>`;
    };
    const tbl = list => `<div class="table-scroll"><table><thead><tr><th>Emiten</th><th class="r">Porsi terakhir</th><th>Transaksi terakhir</th><th>Pertama tercatat</th><th></th></tr></thead><tbody>${list.map(row).join("")}</tbody></table></div>`;
    body.innerHTML = `
      <div class="pf-head">
        <div><div class="eyebrow">Pengendali baru ${esc(d.ticker)}</div>
          <h2>${esc(c.name || name)}</h2><div class="nm">${esc(d.name || "")}</div></div>
        <div class="actions"><button class="btn" type="button" data-pf="profile">Profil ${esc(d.ticker)}</button><button class="btn" type="button" data-pf="analisa">Analisa</button><button class="btn" type="button" data-pf="close">Tutup</button></div>
      </div>
      <div class="pf-kpi">
        <div><span class="eyebrow">Porsi di ${esc(d.ticker)}</span><b>${esc(c.pct || (num(d.ctrlPct) != null ? fmt(num(d.ctrlPct), 2) + "%" : "–"))}</b></div>
        <div><span class="eyebrow">Jumlah saham</span><b>${esc(c.shares || "–")}</b></div>
        <div><span class="eyebrow">Masuk sejak</span><b>${esc(s.takeoverDate ? fmtDate(s.takeoverDate) : "–")}</b></div>
        <div><span class="eyebrow">Pengendali lama</span><b>${esc(s.oldName || "–")}</b></div>
        <div><span class="eyebrow">Afiliasi aktif</span><b>${active.length}</b></div>
        <div><span class="eyebrow">Harga PTW</span><b>${d.tender?.price ? rp(d.tender.price) : "–"}</b></div>
      </div>
      ${(pv => pv ? `<section class="inv"><h3>Siapa pengendali ini & apa rencananya</h3>
        ${pv.bukanPengambilAlih ? `<p class="catat"><b>Perhatian:</b> nama di kolom pengendali ${esc(d.ticker)} adalah pengendali lama/penjual atau bukan pengambil alih. Data kepemilikan & afiliasi di bawah adalah milik nama tersebut; lihat "Siapa" untuk pihak yang sebenarnya.</p>` : ""}
        <p><b>Siapa:</b> ${esc(pv.siapa)}</p>
        <p><b>Latar belakang grup:</b> ${esc(pv.grup)}</p>
        <p><b>Rencana:</b> ${esc(pv.rencana)}</p>
        <p class="catat"><b>Catatan investor:</b> ${esc(pv.catatan)}</p>
        ${pv.sumberJudul ? `<div class="nm">Sumber: ${esc(pv.sumberJudul)}${pv.sumberTanggal ? " · " + esc(fmtDate(pv.sumberTanggal)) : ""}</div>` : ""}
      </section>` : `<section class="inv"><h3>Siapa pengendali ini & apa rencananya</h3><p class="nm">Profil pengendali untuk ${esc(d.ticker)} belum tersedia.</p></section>`)(PENGENDALI[d.ticker])}
      <div class="pf-grid">
        <section><h3>Pemilik manfaat (UBO)</h3>
          <div class="nm">${esc(c.beneficiary.join(", ") || "Tidak tercatat di Stockbit")}</div>
          <h3>Pengurus ${esc(d.ticker)}</h3>
          <div class="nm"><b>Direksi:</b> ${esc(c.directors.join(", ") || "–")}</div>
          <div class="nm"><b>Komisaris:</b> ${esc(c.commissioners.join(", ") || "–")}</div>
        </section>
        <section><h3>Grup yang sama di radar</h3>
          ${group.length ? group.map(x => `<div class="nm"><b>${esc(x.ticker)}</b> · ${esc(x.name || "")} · ${num(x.ctrlPct) != null ? fmt(num(x.ctrlPct), 2) + "%" : "–"}</div>`).join("") : '<div class="nm">Tidak ada emiten radar lain dengan pengendali ini.</div>'}
          ${s.injCo ? `<h3>Aset yang diinjeksikan</h3><div class="nm">${esc(s.injType)} · ${esc(s.injCo)}${s.nominal ? " · " + esc(s.nominal) : ""}</div>` : ""}
        </section>
      </div>
      <section><h3>Kepemilikan di emiten lain (afiliasi)</h3>
        ${active.length ? tbl(active) : '<div class="nm">Tidak ada kepemilikan ≥5% di emiten lain yang tercatat atas nama ini.</div>'}
        ${exited.length ? `<details class="more"><summary>Pernah memiliki (${exited.length})</summary>${tbl(exited)}</details>` : ""}
        <p class="disc">Sumber: riwayat pemegang saham ≥5% (KSEI/IDX) di Stockbit atas nama badan hukum ini${c.holderId ? "" : " — nama tidak ditemukan di riwayat, afiliasi tidak bisa dilacak"}. Kepemilikan lewat entitas lain milik UBO yang sama tidak ikut tercatat.</p>
      </section>`;
    wireProfile(d);
    body.querySelectorAll("[data-pf=profile]").forEach(b => b.onclick = () => openProfile(d.id));
  }

  // Muat data otomatis story satu per satu (profil + riwayat pemegang saham). Disimpan 7 hari.
  async function loadStories(force = false) {
    if (storyLoading || !sbStatusReady()) return;
    // Muat ulang bila belum ada, sudah >7 hari, atau patokannya (nama pengendali/tanggal PTW) berubah.
    const keyOf = d => `${(d.ctrlGuess ? "" : d.ctrlName) || d.acquirer || ""}|${d.tender?.start || ""}`;
    const todo = items.filter(d => stageOf(d) !== "radar" && (force || !d.storyAuto || d.storyAuto.key !== keyOf(d) || Date.now() - (d.storyAuto.at || 0) > 7 * 864e5));
    if (!todo.length) return;
    storyLoading = true;
    let n = 0;
    for (const d of todo) {
      $("storyLoad").textContent = `Memuat story ${++n}/${todo.length}…`;
      try {
        const qs = new URLSearchParams({ ticker: d.ticker, controller: (d.ctrlGuess ? "" : d.ctrlName) || (d.acquirer || "").replace(/\s*\(.*\)$/, ""), near: d.tender?.start || "" });
        const r = await fetch("/api/story?" + qs);
        if (r.status === 401) { toast("Token Stockbit ditolak; story tidak bisa dimuat", true); break; }
        if (r.ok) {
          const s = await r.json();
          const i = items.findIndex(x => x.id === d.id);
          if (i >= 0) items[i] = { ...items[i], storyAuto: { ...s, at: Date.now(), key: keyOf(d) } };
          if (n % 4 === 0) { lsSet(LS_KEY, items); render(); }
        }
      } catch {}
      await new Promise(res => setTimeout(res, 300));
    }
    lsSet(LS_KEY, items); render();
    $("storyLoad").textContent = "";
    storyLoading = false;
  }

  $("storyQ").addEventListener("input", render);

  // Infografis komposisi tahap (lokal, tanpa token): donut dari /api/viz/summary.
  let vizLoaded = 0;
  async function loadVizStory() {
    if (Date.now() - vizLoaded < 15 * 60e3) return;
    vizLoaded = Date.now();
    try {
      const f = await fetch("/api/features").then(r => r.ok ? r.json() : {}).catch(() => ({}));
      if (f && f.viz === false) return;
      const s = await fetch("/api/viz/summary").then(r => r.ok ? r.json() : null);
      if (!s || !s.stages?.length) return;
      const palette = ["var(--warn)", "var(--accent)", "var(--ok)", "#8a6fd1", "#5aa9a2"];
      $("vizStoryDonut").innerHTML = donut(s.stages.map((d, i) => ({ ...d, color: palette[i % palette.length] })),
        { title: "Komposisi tahap emiten di radar" });
      $("vizStory").hidden = false;
    } catch {}
  }
  loadVizStory();
  // Perbarui semua: tarik ulang Stockbit Reports (sumber bisnis baru, injeksi, nominal, target), lalu profil & pengendali lama.
  $("storyRefresh").onclick = async () => {
    const b = $("storyRefresh"); b.disabled = true; b.textContent = "Menarik Stockbit Reports…";
    try { await syncReports(); } catch {}
    b.textContent = "Memuat data pengendali…";
    try { await loadStories(true); } catch {}
    b.disabled = false; b.textContent = "Perbarui semua dari Stockbit Reports";
  };
  $("nav-story").addEventListener("click", () => loadStories());

  // ---- Potensi harga saham backdoor ----
  // Target skenario = harga dasar pra-transaksi emiten itu × kelipatan kenaikan kasus backdoor lain (kuartil 1, median, kuartil 3).
  let benchLoading = false, benchTried = 0;
  function renderPotensi(prog) {
    const box = $("potTable"), sum = $("potSummary");
    // Coba hitung paling sering sekali per menit; tanpa batas ini, hasil kosong memicu render tanpa henti (halaman hang).
    if (!benchmark && !benchLoading && sbStatusReady() && Date.now() - benchTried > 60e3) {
      benchLoading = true; benchTried = Date.now();
      getBenchmark().catch(() => null).finally(() => { benchLoading = false; if (benchmark) render(); });
    }
    const bm = benchmark;
    const byT = new Map((bm?.deals || []).map(r => [r.ticker, r]));
    // Potensi tiap saham diukur dari levelnya sendiri: naik = kembali ke puncak siklus, turun = ke harga PTW
    // (harga yang dibayar pengendali baru). Kelipatan kasus lain hanya konteks di ringkasan.
    const rows = prog.map(d => {
      const r = byT.get(d.ticker);
      const price = num(d.price) ?? r?.last ?? null;
      const peak = r?.peak ?? null, ptw = d.tender?.price ?? null, base = r?.base ?? null;
      const up = peak && price ? peak / price - 1 : null;
      const down = ptw && price ? ptw / price - 1 : null;
      const next = d.prog?.next?.label || (d.prog?.pct === 100 ? "Transaksi tuntas" : "–");
      return { d, price, peak, ptw, base, up, down, next,
        ratio: up != null && down != null && down < 0 ? up / -down : null,
        runupPeak: base && peak ? peak / base : null };
    });

    // Ringkasan kelompok.
    const withUp = rows.filter(r => r.up != null);
    const belowPtw = rows.filter(r => r.down != null && r.down > 0).length;
    const fmtX = v => String(v).replace(".", ",") + "×";
    sum.innerHTML = bm?.n ? `
      <div><span class="eyebrow">Kasus pembanding</span><b>${bm.n} transaksi</b></div>
      <div><span class="eyebrow">Kenaikan median pra-rumor → puncak</span><b>${fmtX(bm.runupMedian)}</b></div>
      <div><span class="eyebrow">Harga kini vs saat PTW</span><b>${fmtX(bm.postMedian)} (median)</b></div>
      <div><span class="eyebrow">Turun ≥50% dari puncak</span><b>${withUp.filter(r => r.up >= 1).length} dari ${withUp.length}</b></div>
      <div><span class="eyebrow">Di bawah harga PTW</span><b>${belowPtw} saham</b></div>`
      : `<div><b>${benchLoading ? "Data siklus harga: menghitung dari Stockbit…" : "Data siklus harga butuh jalankan-radar.sh + token"}</b></div>`;

    const q = $("q").value.trim().toLowerCase(), fs = $("fStatus").value;
    const list = rows.filter(r => (!fs || r.d.deal === fs) && (!q || [r.d.ticker, r.d.name].some(v => (v || "").toLowerCase().includes(q))));
    // Urutan: dari pilihan dropdown, atau dari klik judul kolom (potSort). Nilai kosong selalu di bawah.
    const SORTS = {
      ticker: r => r.d.ticker, price: r => r.price, ptwgap: r => r.ptw && r.price ? r.price / r.ptw : null,
      peak: r => r.runupPeak, upside: r => r.up, risk: r => r.down, ratio: r => r.ratio,
      ptw: r => r.down == null ? null : -Math.abs(r.down),
    };
    const key = potSort.key || $("fSort").value || "upside", dir = potSort.key ? potSort.dir : (key === "ticker" ? 1 : -1);
    const val = SORTS[key] || SORTS.upside;
    list.sort((a, b) => {
      const x = val(a), y = val(b);
      if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * dir;
    });

    if (!list.length) { box.innerHTML = `<div class="empty"><strong>Belum ada saham backdoor</strong><span>Klik Perbarui dari Stockbit di menu Progress emiten.</span></div>`; return; }
    const t = document.createElement("table");
    const th = (k, label, cls = "") => `<th class="${cls}${potSort.key === k ? (potSort.dir > 0 ? " on-asc" : " on-desc") : ""}" data-sort="${k}" title="Klik untuk mengurutkan">${label}</th>`;
    t.className = "pot-tbl";
    t.innerHTML = `<thead><tr>${th("ticker", "Emiten")}<th>Tahap</th>${tlHead()}${th("price", "Harga", "r")}${th("ptwgap", "PTW", "r")}
      <th title="Harga pra-rumor sampai puncak siklus (skala log)">Rentang</th>${th("peak", "Puncak", "r")}${th("upside", '<span title="Potensi naik ke puncak siklus">Naik</span>', "r")}${th("risk", '<span title="Risiko turun ke harga PTW">Turun</span>', "r")}<th>Katalis berikutnya</th></tr></thead><tbody></tbody>`;
    t.querySelectorAll("th[data-sort]").forEach(h => h.onclick = () => {
      const k = h.dataset.sort;
      potSort = { key: k, dir: potSort.key === k ? -potSort.dir : (k === "ticker" ? 1 : -1) };
      render();
    });
    const tb = t.querySelector("tbody");
    for (const r of list) {
      const tr = document.createElement("tr"); tr.tabIndex = 0;
      tr.onclick = () => openProfile(r.d.id);
      tr.onkeydown = e => { if (e.key === "Enter") openProfile(r.d.id); };
      const pc = v => v == null ? "–" : `<span class="${v >= 0 ? "up" : "down"}">${v >= 0 ? "+" : ""}${(v * 100).toFixed(0)}%</span>`;
      tr.innerHTML = `
        <td><div class="tk">${esc(r.d.ticker)}</div><div class="nm em-name" title="${esc(r.d.name || "")}">${esc(r.d.name || "")}</div></td>
        <td><span class="pill d-${r.d.deal}">${DEAL_LABEL[r.d.deal]}</span>${stepsHtml(r.d)}</td>
        <td class="tl-td">${timelineHtml(r.d)}</td>
        <td class="r num">${rp(r.price)}</td>
        <td class="r num">${rp(r.ptw)}${r.ptw && r.price ? `<div class="nm">${pc(r.price / r.ptw - 1)} dari PTW</div>` : ""}</td>
        <td>${rangeBar(r)}</td>
        <td class="r num">${rp(r.peak)}${r.runupPeak ? `<div class="nm">${r.runupPeak.toFixed(1).replace(".", ",")}× harga pra-rumor ${rp(r.base)}</div>` : ""}</td>
        <td class="r num">${pc(r.up)}</td>
        <td class="r num">${r.down == null ? "–" : r.down > 0 ? `<span class="up">di bawah PTW</span><div class="nm">${pc(r.down)} ke PTW</div>` : pc(r.down)}</td>
        <td><span class="nm">${esc(r.next)}</span></td>`;
      tb.append(tr);
    }
    box.replaceChildren(t);
    renderAgenda();
  }
  let potSort = { key: "", dir: -1 };

  // Dua panel kerja di bawah tabel Potensi: berita backdoor 3 hari terakhir dan tanggal jatuh tempo 14 hari ke depan.
  function renderAgenda() {
    const day = n => { const t = new Date(Date.now() + n * 864e5); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; }, today = day(0);
    const bset = backdoorTickers();
    const fresh = updates.filter(u => u.date && u.date >= day(-3) && isBackdoorNews(u, bset))
      .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    const due = items.flatMap(d => tlEvents(d).filter(e => e.date >= today && e.date <= day(14)).map(e => ({ ...e, t: d.ticker, id: d.id })))
      .sort((a, b) => a.date.localeCompare(b.date));
    const row = (date, t, txt, hot) => `<li><span class="ag-d${hot ? " hot" : ""}">${esc(fmtDate(date))}</span><b>${esc(t || "")}</b><span>${esc(txt)}</span></li>`;
    $("potAgenda").innerHTML = `
      <section><h2>Masuk 3 hari terakhir</h2>${fresh.length ? `<ol>${fresh.map(u => row(u.date, u.ticker, u.title, u.date === today)).join("")}</ol>`
        : '<p class="nm">Belum ada keterbukaan baru tentang emiten radar. Buka Update Emiten lalu klik Perbarui berita.</p>'}</section>
      <section><h2>Jatuh tempo 14 hari</h2>${due.length ? `<ol>${due.map(e => row(e.date, e.t, e.label, e.date <= day(3))).join("")}</ol>`
        : '<p class="nm">Tidak ada tanggal tender atau tonggak yang jatuh dalam 14 hari ke depan.</p>'}</section>`;
  }

  // Grafik mini: garis dari harga pra-rumor ke puncak, penanda harga PTW (garis) dan harga kini (titik).
  // Skala logaritmik agar kenaikan berkali-lipat tetap terbaca.
  function rangeBar(r) {
    if (!r.base || !r.peak || !r.price) return '<span class="nm">–</span>';
    const lo = Math.min(r.base, r.price, r.ptw || Infinity), hi = Math.max(r.peak, r.price);
    const pos = v => (Math.log(v / lo) / Math.log(hi / lo || 2) * 100).toFixed(1);
    const tip = `Pra-rumor ${rp(r.base)} · PTW ${rp(r.ptw)} · kini ${rp(r.price)} · puncak ${rp(r.peak)}`;
    return `<div class="rng" title="${tip}">
      <div class="tr" style="left:${pos(r.base)}%;right:${(100 - pos(r.peak)).toFixed(1)}%"></div>
      ${r.ptw ? `<div class="ptw" style="left:${pos(r.ptw)}%"></div>` : ""}
      <div class="now" style="left:${pos(r.price)}%"></div></div>`;
  }

  // sbStatus dideklarasikan lebih bawah dan baru terisi setelah /api/status menjawab.
  const sbStatusReady = () => { try { return !!sbStatus.tokenLoaded; } catch { return false; } };

  // ---- Render berita ----
  // Halaman Utama hanya untuk saham backdoor: emiten di menu Progress (sudah ada transaksi pengambilalihan).
  // Berita tanpa kode saham tetap tampil bila judulnya memang membahas backdoor/ganti pengendali.
  const BACKDOOR_TOPIC = /backdoor|ganti pengendali|pengendali baru|reverse takeover|pintu belakang/i;
  const backdoorTickers = () => new Set(items.filter(d => stageOf(d) !== "radar").map(d => d.ticker));
  // Rangkuman pasar harian hanya menyebut kode saham sambil lalu; bukan berita tentang emiten itu.
  const MARKET_WRAP = /\bIHSG\b|top gainers|top losers|\bLQ45\b|rekomendasi saham|saham pilihan|cek saham/i;
  // Kode saham di berita media harus muncul dalam konteks saham ("(ASPI)", "saham ASPI", "emiten ASPI", "ASPI Tbk")
  // atau nama perusahaannya disebut. Tanpa ini, singkatan lain (mis. ASPI = Asosiasi Sistem Pembayaran Indonesia) ikut terbawa.
  const nameCore = t => { const d = items.find(x => x.ticker === t); return d ? (d.name || "").replace(/^PT\.?\s*|\s*Tbk\.?$/gi, "").trim() : ""; };
  const tickerInContext = (t, text) => {
    // "(ASPI)" saja tidak cukup (bisa "Asosiasi ... (ASPI)"); harus "Tbk (ASPI)", "saham ASPI", dsb., atau nama perusahaan.
    if (new RegExp(`Tbk\\.?\\s*\\(${t}\\)|\\b(saham|emiten|kode|ticker|perseroan)\\s+${t}\\b|\\b${t}\\s+Tbk\\b|\\$${t}\\b`, "i").test(text)) return true;
    const core = nameCore(t);
    return core.length >= 4 && text.toLowerCase().includes(core.toLowerCase());
  };
  const isBackdoorNews = (u, set) => {
    const text = `${u.title} ${u.summary || ""}`;
    if (!u.ticker) return BACKDOOR_TOPIC.test(text);
    if (!set.has(u.ticker)) return false;
    if (/^sb-report-/.test(u.id)) return true;                 // Stockbit Reports selalu milik emiten itu
    if (!tickerInContext(u.ticker, text)) return false;        // berita media: kode harus benar-benar merujuk ke emiten
    return !MARKET_WRAP.test(u.title) || BACKDOOR_TOPIC.test(text);
  };

  // Batas "baru": waktu kunjungan sebelumnya; diperbarui saat halaman ditutup.
  const seenBefore = lsGet(LS_SEEN, "");
  addEventListener("pagehide", () => lsSet(LS_SEEN, new Date().toISOString()));

  $("storyList").addEventListener("click", e => { const v = e.target.closest(".vnote, .facts .clamp"); if (v) v.classList.toggle("open"); });

  function renderFeed() {
    const bset = backdoorTickers();
    const feed = updates.filter(u => isBackdoorNews(u, bset));
    $("nUpd").textContent = feed.length || "";
    const ff = $("feedFilter"); ff.replaceChildren();
    for (const t of [{ id: "", name: "Semua" }, ...UTYPES]) {
      if (t.id && !feed.some(u => u.type === t.id)) continue;
      const b = document.createElement("button");
      b.type = "button"; b.textContent = t.name;
      b.setAttribute("aria-pressed", String(feedType === t.id));
      b.onclick = () => { feedType = t.id; renderFeed(); };
      ff.append(b);
    }
    // Sumber: id "sb-report-" = Stockbit Reports, "news-" = berita media, lainnya = catatan manual.
    const srcOf = u => /^sb-report-/.test(u.id) ? "stockbit" : "media";
    const fSrc = $("fSource").value;
    // Pencarian: kode saham, nama emiten, judul, ringkasan, atau nama sumber.
    const fq = $("feedQ").value.trim().toLowerCase();
    const hay = u => [u.ticker, items.find(x => x.ticker === u.ticker)?.name, u.title, u.summary, u.source].join(" ").toLowerCase();
    const list = feed.filter(u => (!feedType || u.type === feedType) && (!fSrc || srcOf(u) === fSrc) && (!fq || fq.split(/\s+/).every(w => hay(u).includes(w))))
      .sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.updatedAt || "").localeCompare(a.updatedAt || ""))
      .slice(0, 200);
    $("newsCount").textContent = `${list.length} pengumuman`;
    $("feedEmpty").hidden = feed.length > 0;
    renderAgenda();   // panel Potensi ikut berita terbaru
    const ol = $("feedList"); ol.replaceChildren();
    if (!list.length && feed.length) ol.innerHTML = `<li class="n-none"><span class="nm">Tidak ada berita yang cocok${fq ? ` dengan “${esc(fq)}”` : ""}. Ubah kata kunci atau saringan.</span></li>`;
    for (const u of list) {
      const li = document.createElement("li");
      // "baru" = masuk setelah kunjungan sebelumnya; kunjungan pertama tidak menandai apa pun.
      const stamp = u.updatedAt || u.date || "";
      if (seenBefore) li.className = stamp > seenBefore ? "fresh" : "seen";
      li.innerHTML = `<div class="n-date"></div>
        <div class="n-body"><div class="n-meta"><span class="f-type"></span></div>
        <p class="n-title"></p><p class="n-sum"></p>
        <div class="n-foot"><span class="n-src"></span></div></div>`;
      li.querySelector(".n-date").textContent = fmtDate(u.date);
      const ty = li.querySelector(".f-type");
      ty.textContent = (UTYPES.find(t => t.id === u.type) || { name: "Lainnya" }).name;
      ty.classList.add("t-" + u.type);
      if (u.ticker) {
        const inList = items.some(x => x.id === u.ticker);
        const b = Object.assign(document.createElement("button"), { type: "button", className: "f-tk", textContent: u.ticker });
        b.title = inList ? "Buka profil emiten" : "Emiten belum ada di radar";
        b.onclick = () => { if (inList) openProfile(u.ticker); };   // tanpa input manual: hanya membuka profil
        li.querySelector(".n-meta").append(b);
      }
      li.querySelector(".n-title").textContent = u.title || "";
      const sum = li.querySelector(".n-sum");
      if (u.summary) sum.textContent = u.summary; else sum.remove();
      const src = li.querySelector(".n-src");
      if (u.url && /^https?:\/\//.test(u.url)) {
        src.append(Object.assign(document.createElement("a"), { href: u.url, target: "_blank", rel: "noopener", textContent: u.source || "Sumber" }));
      } else src.textContent = u.source || "";
      li.append(newsTakeEl(u));
      ol.append(li);
    }
  }

  // ---- Analisa singkat per berita: tingkat sinyal, poin penting, nominal vs kapitalisasi, sikap analis ----
  // Aturan berurutan; dua poin pertama yang cocok ditampilkan. Level: 3 = sinyal tinggi, 2 = sedang, 1 = rutin, 0 = derau.
  const NEWS_RULES = [
    [/pengendali baru|perubahan pengendali|pengambilalihan|akuisisi saham .*pengendali|ppjb|cspa|perjanjian (jual beli|pengalihan) saham/i, 3, "Perubahan kendali: siapa pembelinya, berapa harga per saham, dan apakah wajib PTW — harga beli pengendali menjadi patokan nilai."],
    [/penawaran tender|tender offer|\bPTW\b|\bMTO\b/i, 3, "Tender wajib: harga tender adalah biaya masuk pengendali, bukan lantai harga setelah periode tender selesai."],
    [/inbreng|setoran modal dalam bentuk selain uang/i, 3, "Inbreng: nilai aset ditukar saham baru — uji laporan penilai (KJPP) dan rasio terhadap kapitalisasi; penilaian tinggi = dilusi diam-diam."],
    [/transaksi material|perubahan kegiatan usaha|KBLI/i, 3, "Transaksi material/perubahan usaha: inti story backdoor — baca nilai transaksi, pihak lawan, dan apakah butuh RUPS independen."],
    [/tanpa (hak memesan|HMETD)|PMTHMETD|penempatan terbatas|private placement/i, 3, "Saham baru tanpa hak publik: cek harga pelaksanaan vs pasar dan siapa pembelinya — di bawah pasar ke afiliasi = transfer nilai dari publik."],
    [/HMETD|rights issue|PMHMETD/i, 3, "Rights issue: publik yang tidak menebus terdilusi; harga pelaksanaan jauh di bawah pasar menekan harga teoretis ex-rights."],
    [/konversi utang|obligasi wajib konversi|\bOWK\b/i, 2, "Konversi menjadi saham: bandingkan harga konversi dengan harga pasar dan jumlah saham baru terhadap saham beredar."],
    [/transaksi afiliasi|benturan kepentingan/i, 2, "Transaksi afiliasi: uji kewajaran harga — nilai bisa berpindah ke pengendali tanpa persetujuan publik."],
    [/suspensi|penghentian sementara|disuspen/i, 2, "Suspensi: posisi tidak bisa dijual sampai dibuka — risiko likuiditas penuh; cek alasan dan jadwal pembukaan."],
    [/terkonsentrasi/i, 2, "Kepemilikan terkonsentrasi: free float sangat tipis, harga mudah digerakkan; pencabutan status berarti saham publik bertambah."],
    [/(pemegang saham|pengendali|direksi|komisaris).{0,60}(jual|lepas|kurangi|divestasi)|(jual|lepas|kurangi).{0,40}(porsi|kepemilikan)/i, 2, "Pemegang besar melepas saham: perhatikan apakah berulang — penjualan orang dalam adalah sinyal paling jujur."],
    [/(pemegang saham|pengendali|direksi|komisaris).{0,60}(beli|tambah|perbesar|akumulasi)|(perbesar|tambah) porsi/i, 2, "Pemegang besar menambah porsi: sinyal keyakinan bila harga belinya dekat harga pasar dan dilakukan berulang."],
    [/akuisisi|mengambil alih/i, 2, "Akuisisi: ukur nilai aset yang masuk terhadap kapitalisasi dan sumber dananya (kas, utang pengendali, atau saham baru)."],
    [/RUPSLB|RUPS Luar Biasa|pemanggilan RUPS|rencana (rapat|RUPS)/i, 2, "RUPS: agenda (KBLI, pengurus, modal dasar, rights) menunjukkan langkah berikutnya; penundaan berulang = dokumen belum siap."],
    [/public expose/i, 2, "Public expose: cari target terukur (nilai, jadwal) — janji tanpa angka tidak menambah nilai."],
    [/pencatatan saham|penambahan saham|tambahan saham/i, 2, "Penambahan saham beredar: lihat proporsinya terhadap total saham — kecil = tidak material."],
    [/perubahan (anggota )?(direksi|dewan komisaris|pengurus)/i, 2, "Perombakan pengurus: orang pengendali baru masuk — konfirmasi arah usaha baru."],
    [/perubahan nama|logo|anggaran dasar/i, 1, "Perubahan nama/anggaran dasar: kosmetik; bermakna hanya bila diikuti aset baru."],
    [/laporan keuangan|kinerja|laba|rugi|pendapatan/i, 1, "Kinerja: bandingkan laba/pendapatan dengan kapitalisasi pasar — pada saham backdoor harga jarang bertumpu pada laba lama."],
    [/pinjaman|fasilitas kredit|obligasi|sukuk|ijarah|MTN/i, 1, "Pendanaan utang: rutin, kecuali utang dari pengendali yang nantinya dikonversi menjadi saham."],
    [/volatilitas|permintaan penjelasan bursa|\bUMA\b|unusual market/i, 0, "Penjelasan volatilitas/permintaan bursa: harga sudah bergerak lebih dulu — bukan informasi nilai, sering pertanda spekulasi."],
  ];
  const NEWS_LEVEL = [["Derau", "bad"], ["Rutin", "calm"], ["Sinyal sedang", "warn"], ["Sinyal tinggi", "good"]];
  // Nominal terbesar dalam teks (Rp/USD) → rupiah.
  function maxAmountRp(s) {
    let best = null;
    for (const m of String(s || "").matchAll(/(Rp|USD|US\$|SGD)\s?[\d.,]+\s*(triliun|miliar|juta|million|T|M)?/gi)) {
      const v = nominalRp(m[0]);
      if (v != null && (best == null || v > best)) best = v;
    }
    return best;
  }
  function newsTakeEl(u) {
    const text = `${u.title || ""} ${u.summary || ""}`;
    const hits = NEWS_RULES.filter(r => r[0].test(text));
    const level = hits.length ? Math.max(...hits.map(r => r[1])) : 1;
    const pts = hits.slice(0, 2).map(r => r[2]);
    // Nominal transaksi dibanding kapitalisasi pasar emiten (data radar, Rp miliar).
    const d = u.ticker ? items.find(x => x.ticker === u.ticker) : null;
    const amt = maxAmountRp(text), mcap = num(d?.mcap) != null ? num(d.mcap) * 1e9 : null;
    if (amt && mcap && amt >= 1e9) {
      const r = amt / mcap;
      const rTxt = r >= 0.1 ? x2(r) : r < 0.001 ? "<0,1%" : (r * 100).toFixed(1).replace(".", ",") + "%";
      pts.unshift(`Nominal ${big(amt)} ≈ ${rTxt} kapitalisasi ${u.ticker} (${big(mcap)}) — ${r >= 1 ? "mengubah skala perusahaan" : r >= 0.2 ? "material" : "kecil terhadap nilai pasar"}.`);
    }
    if (!pts.length) pts.push("Tidak ada aksi korporasi yang mengubah nilai; perlakukan sebagai informasi rutin.");
    const pa = u.ticker ? PANDANGAN[u.ticker] : null;
    const cls = pa ? (/asimetri/i.test(pa.sikap) ? "good" : /netral/i.test(pa.sikap) ? "warn" : "bad") : "";
    const el = document.createElement("aside");
    el.className = "n-ana";
    el.innerHTML = `<div class="n-ana-h"><span class="eyebrow">Analisa singkat</span><span class="pill an-p-${NEWS_LEVEL[level][1]}">${NEWS_LEVEL[level][0]}</span></div>
      <ul>${pts.slice(0, 3).map(p => `<li>${esc(p)}</li>`).join("")}</ul>
      ${pa ? `<div class="n-ana-ctx"><span class="pill an-p-${cls}">${esc(u.ticker)} · ${esc(pa.sikap)}</span><span class="nm">${esc(String(pa.ringkas || "").slice(0, 140))}${String(pa.ringkas || "").length > 140 ? "…" : ""}</span></div>` : ""}
      ${d ? `<button class="btn" type="button">Analisa ${esc(u.ticker)}</button>` : ""}`;
    el.querySelector("button")?.addEventListener("click", () => { show("potensi"); analyzeTicker(u.ticker); });
    return el;
  }

  // Daftar bobot di bagian Metodologi (halaman Potensi).
  function buildWeights() {
    $("weights").innerHTML = SIGNALS.map(s => `<li><span class="w">+${s.w}</span> ${s.label}${s.auto ? " (otomatis)" : ""}</li>`).join("") +
      `<li>Tingkat keyakinan: <b>Pemantauan</b> &lt;35 · <b>Daftar pantau</b> 35–64 · <b>Keyakinan tinggi</b> ≥65</li>`;
  }

  // ---- Profil emiten (klik baris di tabel / papan tahapan) ----

  let benchmark = null, benchmarkAt = 0;

  // Benchmark dari transaksi backdoor nyata di daftar (kode:tanggal mulai PTW), disimpan 6 jam.
  async function getBenchmark() {
    if (benchmark && Date.now() - benchmarkAt < 6 * 3600e3) return benchmark;
    const deals = items.filter(d => d.tender && d.tender.start).map(d => `${d.ticker}:${d.tender.start}`);
    if (!deals.length) return null;
    const r = await fetch("/api/benchmark?deals=" + deals.join(","));
    if (!r.ok) return null;
    benchmark = await r.json(); benchmarkAt = Date.now();
    return benchmark;
  }



  async function openProfile(id) {
    const d = items.find(x => x.id === id);
    if (!d) return;
    const body = $("pfBody");
    body.innerHTML = `<div class="pf-load">Memuat profil ${esc(d.ticker)} dari Stockbit…</div>`;
    $("dlgP").showModal();
    let p;
    try {
      const r = await fetch("/api/profile?ticker=" + d.ticker); p = await r.json();
      if (!r.ok) throw new Error(p.error || r.status);
    } catch (e) {
      body.innerHTML = `<div class="pf-load">Profil tidak bisa dimuat: ${esc(e.message || "server lokal tidak merespons")}.<br>Profil butuh website dibuka lewat jalankan-radar.sh dan token Stockbit yang masih berlaku.</div>
        <div class="ed-foot"><span></span><div><button class="btn" type="button" data-pf="close">Tutup</button></div></div>`;
      wireProfile(d); return;
    }

    // Simpan kapitalisasi & free float ke data radar (dipakai skor).
    const i = items.findIndex(x => x.id === id);
    if (i >= 0 && (p.stats.marketCap || p.stats.freeFloat)) {
      const ctrl = p.shareholders.filter(h => h.pengendali);
      items[i] = { ...items[i], mcap: p.stats.marketCap ? Math.round(p.stats.marketCap / 1e8) / 10 : items[i].mcap, float: p.stats.freeFloat ?? items[i].float,
        ctrlPct: ctrl.length ? Math.round(ctrl.reduce((s, h) => s + parseFloat(h.pct), 0) * 100) / 100 : items[i].ctrlPct,
        ctrlName: ctrl.length ? ctrl.map(h => h.name).join(", ") : items[i].ctrlName };
      lsSet(LS_KEY, items); render();
    }
    const price = num(d.price) ?? (p.chart.length ? p.chart[p.chart.length - 1].v : null);
    const m = p.metrics, s = p.stats, scored = scoredItems().find(x => x.id === id);
    const isCandidate = stageOf(d) === "radar";

    // Level harga acuan + skenario backdoor (dari kasus nyata). Bukan rekomendasi.
    const rows = [];
    if (m.bvps != null) rows.push(["Nilai buku per saham (PBV 1×)", m.bvps, "Batas fundamental; PBV saat ini " + (m.pbv ?? "–") + "×"]);
    if (d.tender && d.tender.price) rows.push(["Harga penawaran tender wajib", d.tender.price, `PTW ${esc(d.tender.start)} s.d. ${esc(d.tender.end)}`]);
    if (m.low52 != null) rows.push(["Terendah 52 minggu", m.low52, ""]);
    if (m.high52 != null) rows.push(["Tertinggi 52 minggu", m.high52, ""]);
    const bm = await getBenchmark().catch(() => null);
    // Dasar skenario: harga terendah pra-transaksi emiten ini; untuk kandidat tanpa transaksi, harga sekarang.
    const own = bm?.deals?.find(r => r.ticker === d.ticker);
    if (own) {
      // Saham backdoor: pakai siklus harganya sendiri.
      rows.push(["Harga pra-rumor", own.base, "Terendah 240 hari sebelum PTW"]);
      rows.push(["Puncak siklus backdoor", own.peak, `${(own.peak / own.base).toFixed(1).replace(".", ",")}× harga pra-rumor`]);
    } else if (isCandidate && bm && bm.n && price) {
      // Kandidat: ilustrasi bila mengikuti pola kasus backdoor lain (kelipatan sangat bervariasi).
      rows.push([`Pola backdoor kuartil 1 (${String(bm.runupQ1).replace(".", ",")}×)`, price * bm.runupQ1, `Dari ${bm.n} kasus · dasar harga sekarang`]);
      rows.push([`Pola backdoor median (${String(bm.runupMedian).replace(".", ",")}×)`, price * bm.runupMedian, `Dari ${bm.n} kasus · dasar harga sekarang`]);
    }
    rows.sort((a, b) => a[1] - b[1]);

    const holders = p.shareholders.map(h => `<tr><td>${esc(h.name)}${h.pengendali ? '<span class="ctrl">Pengendali</span>' : ""}</td><td class="r num">${esc(h.pct)}</td><td class="r num">${esc(h.value)}</td></tr>`).join("");
    body.innerHTML = `
      <div class="pf-head">
        <div><div class="eyebrow">${esc([p.sector, p.industry].filter(Boolean).join(" · "))}</div>
          <h2>${esc(d.ticker)}</h2><div class="nm">${esc(d.name || "")}</div></div>
        <div class="actions">
          ${scored ? `<span class="pill s-${scored.status}">Skor ${scored.score}</span>` : ""}
          <span class="pill ${isCandidate ? "s-calm" : "d-" + (scored ? scored.deal : "proses")}">${esc((STAGES.find(x => x.id === stageOf(d)) || STAGES[0]).name)}</span>
          ${d.ctrlName || d.acquirer ? `<button class="btn" type="button" data-pf="ctrl">Pengendali & afiliasi</button>` : ""}
          <button class="btn" type="button" data-pf="analisa">Analisa</button>
          <button class="btn" type="button" data-pf="close">Tutup</button>
        </div>
      </div>
      <div class="pf-kpi">
        <div><span class="eyebrow">Harga</span><b>${rp(price)}</b></div>
        <div><span class="eyebrow">Kap. pasar</span><b>${big(s.marketCap)}</b></div>
        <div><span class="eyebrow">Free float</span><b>${s.freeFloat != null ? s.freeFloat.toLocaleString("id-ID") + "%" : "–"}</b></div>
        <div><span class="eyebrow">PBV</span><b>${m.pbv != null ? m.pbv.toLocaleString("id-ID") + "×" : "–"}</b></div>
        <div><span class="eyebrow">Return 1 th</span><b>${esc(m.ret1y || "–")}</b></div>
        <div><span class="eyebrow">YTD</span><b>${esc(m.ytd || "–")}</b></div>
      </div>
      <div class="pf-grid">
        <section><h3>Pengendali & pemegang saham</h3>
          <div class="table-scroll"><table><thead><tr><th>Pemegang</th><th class="r">Porsi</th><th class="r">Saham</th></tr></thead><tbody>${holders || '<tr><td colspan="3" class="nm">Tidak ada data</td></tr>'}</tbody></table></div>
          ${p.beneficiary.length ? `<div class="nm">Pemilik manfaat (UBO): ${esc(p.beneficiary.join(", "))}</div>` : ""}
        </section>
        <section><h3>Potensi target harga</h3>
          <div class="table-scroll"><table><thead><tr><th>Level acuan</th><th class="r">Harga</th><th class="r">vs harga kini</th></tr></thead><tbody>
            ${rows.map(r => `<tr><td>${r[0]}${r[2] ? `<div class="nm">${r[2]}</div>` : ""}</td><td class="r num">${rp(r[1])}</td><td class="r num">${pctTxt(r[1], price)}</td></tr>`).join("") || '<tr><td colspan="3" class="nm">Data belum cukup</td></tr>'}
          </tbody></table></div>
          ${bm && bm.n ? `<p class="disc">Dari ${bm.n} transaksi backdoor di radar, harga naik median ${String(bm.runupMedian).replace(".", ",")}× dari titik terendah pra-rumor ke puncak, lalu median harga kini ${String(bm.postMedian).replace(".", ",")}× harga saat PTW. Kenaikan umumnya terjadi sebelum/saat pengumuman dan sering tidak bertahan.${isCandidate ? " Untuk kandidat, pola ini hanya berlaku bila emiten benar-benar menjadi target backdoor." : ""}</p>` : ""}
          <p class="disc">Level acuan, bukan rekomendasi beli/jual.</p>
        </section>
        <section><h3>Harga 1 tahun</h3>${sparkline(p.chart)}</section>
        <section><h3>Pengurus</h3>
          <div class="nm"><b>Direksi:</b> ${esc(p.directors.join(", ") || "–")}</div>
          <div class="nm"><b>Komisaris:</b> ${esc(p.commissioners.join(", ") || "–")}</div>
          <h3>Fundamental</h3>
          <div class="nm">Ekuitas ${big(m.equity)} · Kas ${big(m.cash)} · Aset ${big(m.assets)}</div>
          <div class="nm">EPS (disetahunkan) ${m.epsAnn ?? "–"} · Pertumbuhan pendapatan (YoY) ${esc(m.revGrowth || "–")} · Margin laba bersih ${esc(m.netMargin || "–")}</div>
        </section>
      </div>
      <section><h3>Profil perusahaan</h3><p class="bg">${esc(p.background || "–")}</p>
        <div class="nm">${esc(p.office || "")}${p.website ? ` · <a href="${esc(p.website)}" target="_blank" rel="noopener">${esc(p.website)}</a>` : ""} · <a href="https://stockbit.com/symbol/${esc(d.ticker)}" target="_blank" rel="noopener">Stockbit</a></div>
      </section>
      ${d.notes ? `<section><h3>Catatan radar</h3><p class="bg">${esc(d.notes)}</p></section>` : ""}`;
    wireProfile(d);
  }
  function wireProfile(d) {
    $("pfBody").querySelectorAll("[data-pf=close]").forEach(b => b.onclick = () => $("dlgP").close());
    // Dari profil: buka popup pengendali (sama dengan di Story Emiten) atau analisa lengkap di menu Potensi.
    $("pfBody").querySelectorAll("[data-pf=ctrl]").forEach(b => b.onclick = () => openController(d.id));
    $("pfBody").querySelectorAll("[data-pf=analisa]").forEach(b => b.onclick = () => { $("dlgP").close(); show("potensi"); analyzeTicker(d.ticker); });
  }

  // ---- Tema terang/gelap ----
  function applyTheme(t) {
    if (t === "dark") document.documentElement.dataset.theme = "dark"; else delete document.documentElement.dataset.theme;
    $("themeBtn").textContent = t === "dark" ? "Tema terang" : "Tema gelap";   // tombol menyebut tujuan
    try { localStorage.setItem("radar-cangkang.theme", t); } catch {} // teks polos, dibaca skrip di <head>
  }
  $("themeBtn").onclick = () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  applyTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");

  // ---- Pintasan keyboard: "/" cari, 1–3 pindah menu (tidak aktif saat mengetik di form) ----
  document.addEventListener("keydown", e => {
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.querySelector("dialog[open]")) return;
    if (e.key === "/") { e.preventDefault(); show("potensi"); $("q").focus(); }
    const v = { 1: "potensi", 2: "story", 3: "progress", 4: "update" }[e.key];
    if (v) show(v);
  });
  $("fSort").addEventListener("input", () => { potSort = { key: "", dir: -1 }; });
  $("progQ").addEventListener("input", render);

  // ---- Wiring ----
  buildWeights();
  ["q", "fStatus", "fSort"].forEach(id => $(id).addEventListener("input", render));

  // ---- Sinkron harga dari Stockbit lewat proxy lokal (serve.ps1) ----
  // Token tidak pernah ada di halaman ini; browser hanya memanggil /api/quote di localhost.
  const sbButtons = [...document.querySelectorAll("[data-sb]")];
  let sbBusy = false;

  // Tarik semua penawaran tender wajib BEI dari Stockbit: emiten baru masuk Progress,
  // tonggak transaksi diisi dari jadwal PTW (hanya dinyalakan, tidak pernah dimatikan).
  async function syncTenders(fails) {
    if (!sbStatus.tenders || !sbStatus.tokenLoaded) return 0;
    sbButtons.forEach(b => { b.disabled = true; b.textContent = "Mengambil daftar penawaran tender…"; });
    let added = 0;
    try {
      const r = await fetch("/api/tenders"); const j = await r.json();
      if (!r.ok) { fails.push("Daftar tender: " + (j.error || r.status)); return 0; }
      const today = new Date().toISOString().slice(0, 10);
      // Pengambilalihan yang bukan backdoor (diatur di config "exclude") dikeluarkan dari daftar.
      const excl = new Set(j.exclude || []);
      items = items.filter(x => !excl.has(x.ticker));
      for (const t of j.items || []) {
        const hasTender = !!t.paydate;
        const settled = hasTender && t.paydate <= today;
        const tender = hasTender ? { price: t.price, percent: t.percent, start: t.start, end: t.end, paydate: t.paydate, active: t.active } : null;
        const note = hasTender
          ? `PTW Rp${t.price}/saham untuk ${String(t.percent).replace(".", ",")}% saham, periode ${t.start} s.d. ${t.end}, pembayaran ${t.paydate} (Stockbit).`
          : "Masuk daftar backdoor (config). Penawaran tender wajib dan laporan pengambilalihan belum ditemukan di Stockbit; tahap belum terverifikasi, cek keterbukaan informasi BEI.";
        // Tanpa data tender: perubahan pengendali diketahui, tahap tender belum terverifikasi.
        const msNew = hasTender ? { spa: true, akuisisi: true, to_umum: true, ...(settled ? { to_selesai: true } : {}) } : { spa: true };
        const i = items.findIndex(x => x.id === t.ticker);
        if (i < 0) {
          items.push({ id: t.ticker, ticker: t.ticker, name: t.name || "", stage: "tender", flags: { akuisisi: true },
            ms: msNew, ...(tender ? { tender } : {}), confirmed: !!t.confirmed, notes: note, updatedAt: new Date().toISOString() });
          added++;
        } else {
          const d = { ...items[i] };
          if (tender) d.tender = tender;
          if (t.confirmed) d.confirmed = true;
          d.flags = { ...(d.flags || {}), akuisisi: true };
          d.ms = { ...(d.ms || {}), ...msNew };
          if (stageOf(d) === "radar" || stageOf(d) === "spa") d.stage = "tender";
          if (!(d.notes || "").includes(note)) d.notes = [d.notes, note].filter(Boolean).join("\n");
          items[i] = d;
        }
      }
    } catch { fails.push("Daftar tender: server lokal tidak merespons"); }
    return added;
  }

  async function syncStockbit() {
    if (sbBusy) return;
    sbBusy = true;
    const fails = [];
    const addedTenders = await syncTenders(fails);
    let done = 0;
    for (const d of [...items]) {
      done++;
      sbButtons.forEach(b => { b.disabled = true; b.textContent = `Memperbarui ${done}/${items.length}…`; });
      try {
        const r = await fetch("/api/quote?ticker=" + encodeURIComponent(d.ticker));
        const q = await r.json();
        if (!r.ok) {
          fails.push(`${d.ticker}: ${q.error || r.status}`);
          if (r.status === 401) break; // token bermasalah, hentikan semua
          continue;
        }
        const i = items.findIndex(x => x.id === d.id);
        if (i < 0) continue;
        const next = { ...items[i] };
        if (q.price != null) next.price = q.price;
        if (q.mcap != null) next.mcap = Math.round(q.mcap * 10) / 10;
        if (q.float != null) next.float = q.float;
        if (!next.name && q.name) next.name = q.name;
        // Sinyal dari data pasar hanya dinyalakan, tidak dimatikan; keputusan mematikan tetap di analis.
        next.flags = { ...(next.flags || {}) };
        if (q.uma) next.flags.uma = true;
        if (q.volume && q.avgVolume && q.volume >= 3 * q.avgVolume) next.flags.volume = true;
        // Kapitalisasi, porsi publik, dan porsi pengendali (butuh token).
        if (sbStatusReady()) {
          try {
            const o = await fetch("/api/ownership?ticker=" + encodeURIComponent(d.ticker)).then(x => x.ok ? x.json() : null);
            if (o) {
              if (o.marketCap) next.mcap = Math.round(o.marketCap / 1e8) / 10; // rupiah → Rp miliar
              if (o.freeFloat != null) next.float = o.freeFloat;
              next.ctrlPct = o.controllerPct; next.ctrlName = o.controllerName || ""; next.ctrlGuess = !!o.controllerGuess;
            }
          } catch {}
        }
        next.updatedAt = new Date().toISOString();
        items[i] = next;
      } catch { fails.push(`${d.ticker}: server lokal tidak merespons`); }
      await new Promise(res => setTimeout(res, 400)); // jeda agar tidak membanjiri Stockbit
    }
    lsSet(LS_KEY, items); render();
    const t = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    setSync(`Stockbit ${t}: ${addedTenders} emiten backdoor baru, harga diperbarui` + (fails.length ? ` · ${fails.length} gagal (${fails[0]})` : ""));
    sbButtons.forEach(b => { b.disabled = false; b.textContent = "Perbarui dari Stockbit"; });
    sbBusy = false;
  }

  // Deteksi tonggak sesudah pengambilalihan dari judul Stockbit Reports.
  // Hanya laporan yang terbit SETELAH penawaran tender wajib dibayar, agar aksi pengendali lama tidak terhitung.
  // Tonggak hanya dinyalakan, tidak pernah dimatikan; tandai sebagai deteksi otomatis.
  const MS_RULES = [
    ["rupslb",  /risalah.*(luar biasa|RUPSLB)|hasil.*RUPSLB/i],
    ["rights",  /HMETD|hak memesan efek|private placement|penambahan modal tanpa/i],
    ["inbreng", /inbreng|penyetoran.*selain uang|akuisisi|akusisi|pengambilalihan saham/i],
  ];
  // Untuk emiten tanpa data tender di Stockbit: tahap tender dibaca dari judul laporan.
  const TENDER_RULES = [
    ["to_umum",    /penawaran tender|tender offer/i],
    ["to_selesai", /hasil.*penawaran tender|laporan.*hasil.*tender|penyelesaian.*penawaran tender/i],
  ];
  const TAKEOVER_RE = /pengalihan saham|pengambilalihan|pengendali|perjanjian jual beli saham/i;

  function inferMilestones(ticker, reports) {
    const i = items.findIndex(x => x.id === ticker);
    if (i < 0) return;
    const d = items[i], ms = { ...(d.ms || {}) }, auto = { ...(d.msAuto || {}) };
    // Patokan: tanggal PTW dibayar; bila tidak ada data tender, laporan pengambilalihan paling awal.
    let base = ms.to_selesai && d.tender && d.tender.paydate;
    if (!d.tender) {
      const first = reports.filter(r => r.date && TAKEOVER_RE.test(r.title)).map(r => r.date).sort()[0];
      if (!first) return;
      if (!ms.akuisisi) { ms.akuisisi = true; auto.akuisisi = first; } // ada laporan pengambilalihan
      for (const r of reports) {
        if (!r.date || r.date < first) continue;
        for (const [m, re] of TENDER_RULES) if (!ms[m] && re.test(r.title)) { ms[m] = true; auto[m] = r.date; }
      }
      base = first;
    }
    if (!base) { items[i] = { ...d, ms, msAuto: auto }; return; }
    for (const r of reports) {
      if (!r.date || r.date <= base) continue;
      // Tanpa data tender, laporan lanjutan pengambilalihan itu sendiri jangan dihitung sebagai injeksi aset.
      if (!d.tender && TAKEOVER_RE.test(r.title)) continue;
      for (const [m, re] of MS_RULES) if (!ms[m] && re.test(r.title)) { ms[m] = true; auto[m] = r.date; }
    }
    items[i] = { ...d, ms, msAuto: auto };
  }

  // ---- Berita dari Stockbit Reports (keterbukaan informasi BEI) ----
  // Diambil per emiten yang ada di Progress & Potensi; item digabung berdasarkan id agar tidak dobel.
  const sbr = $("sbReports");
  let repBusy = false;
  async function syncReports() {
    if (repBusy) return;   // cegah dua penarikan berjalan bersamaan (tombol + pembaruan otomatis)
    repBusy = true;
    try { await syncReportsRun(); } finally { repBusy = false; }
  }
  async function syncReportsRun() {
    // Stockbit Reports hanya untuk saham backdoor (emiten di Progress), bukan kandidat di Potensi.
    const tickers = [...backdoorTickers()].filter(t => /^[A-Z]{4}$/.test(t));
    sbr.disabled = true;
    const fails = []; let added = 0, n = 0;
    for (const t of (sbStatus.reports && sbStatus.tokenLoaded) ? tickers : []) {
      sbr.textContent = `Mengambil ${++n}/${tickers.length}…`;
      try {
        const r = await fetch("/api/reports?ticker=" + t);
        const j = await r.json();
        if (!r.ok) { fails.push(`${t}: ${j.error || r.status}`); if (r.status === 401) break; continue; }
        for (const it of j.items || []) {
          const i = updates.findIndex(u => u.id === it.id);
          const row = { ...it, updatedAt: new Date().toISOString() };
          if (i >= 0) updates[i] = { ...updates[i], ...row }; else { updates.push(row); added++; }
        }
        inferMilestones(t, j.items || []);
      } catch { fails.push(`${t}: server lokal tidak merespons`); }
      await new Promise(res => setTimeout(res, 400)); // jeda agar tidak membanjiri Stockbit
    }
    // Berita media dari 10 portal; hanya yang relevan backdoor atau menyebut emiten di radar.
    let addedNews = 0;
    if (newsEnabled) {
      sbr.textContent = "Mengambil berita media…";
      try {
        const r = await fetch("/api/news?tickers=" + tickers.join(","));
        const j = await r.json();
        for (const it of j.items || []) {
          const i = updates.findIndex(u => u.id === it.id);
          // Tanggal artikel HTML = tanggal pertama kali terlihat; jangan ditimpa saat pembaruan berikutnya.
          if (i >= 0) updates[i] = { ...updates[i], ...it, date: updates[i].date };
          else { updates.push({ ...it, updatedAt: new Date().toISOString() }); addedNews++; }
        }
        for (const e of j.errors || []) fails.push(`${e.source}: ${e.error}`);
      } catch { fails.push("Berita media: server lokal tidak merespons"); }
    }
    lsSet(LS_UPD, updates); lsSet(LS_KEY, items); render(); // render() ikut memperbarui feed
    const tm = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    setSync(`Diperbarui ${tm}: ${added} laporan Stockbit, ${addedNews} berita media baru` + (fails.length ? ` · ${fails.length} sumber gagal (${fails.join("; ")})` : ""));
    sbr.disabled = false; sbr.textContent = "Perbarui berita";
  }
  let newsEnabled = false, sbStatus = {};

  // ---- Pembaruan otomatis saat menu dibuka (tombol Perbarui tetap ada) ----
  // Update & Story → Stockbit Reports + berita; Progress & Potensi → tender, harga, kepemilikan.
  // Paling sering sekali per 15 menit per jenis data (waktu tercatat di browser), agar Stockbit tidak dibanjiri.
  const AUTO_KEY = "radar-cangkang.autoSync", AUTO_GAP = 15 * 60e3;
  function autoRefresh(view) {
    if (!sbStatus.configured || (sbStatus.needsToken && !sbStatus.tokenLoaded)) return;
    const kind = view === "update" || view === "story" ? "reports" : view === "progress" || view === "potensi" ? "stockbit" : null;
    if (!kind) return;
    const last = lsGet(AUTO_KEY, {});
    if (Date.now() - (last[kind] || 0) < AUTO_GAP) return;
    if (kind === "reports" && (repBusy || !(sbStatus.reports || sbStatus.news))) return;
    if (kind === "stockbit" && sbBusy) return;
    // Catat waktu percobaan lebih dulu: bila gagal (mis. token kedaluwarsa), tidak diulang terus-menerus.
    lsSet(AUTO_KEY, { ...last, [kind]: Date.now() });
    if (kind === "reports") syncReports().then(() => { if (view === "story") loadStories(); }).catch(() => {});
    else syncStockbit().catch(() => {});
  }

  $("fSource").addEventListener("input", renderFeed);
  $("feedQ").addEventListener("input", renderFeed);

  // Tombol hanya muncul bila website dibuka lewat serve.ps1 dan config sudah diisi.
  fetch("/api/status").then(r => r.ok ? r.json() : null).then(s => {
    if (!s) return;
    newsEnabled = !!s.news; sbStatus = s;
    render(); // mulai hitung skenario potensi bila token tersedia
    if (!$("view-story").hidden) loadStories();
    if (s.reports || s.news) { sbr.hidden = false; sbr.onclick = syncReports; }
    if (s.reports && !s.tokenLoaded) sbr.title = "Token belum ada: Stockbit Reports dilewati, berita media tetap diambil";
    sbButtons.forEach(b => { b.hidden = false; b.onclick = syncStockbit; });
    if (!s.configured) sbButtons.forEach(b => { b.disabled = true; b.title = "Isi stockbit.config.json dulu"; });
    else if (s.needsToken && !s.tokenLoaded) sbButtons.forEach(b => { b.disabled = true; b.title = "Simpan token di file .stockbit-token"; });
    setSync(!s.configured ? "Stockbit: config belum diisi" : (s.needsToken && !s.tokenLoaded) ? "Stockbit: token belum ada" : "Stockbit siap");
    autoRefresh(VIEWS.find(v => !$("view-" + v).hidden));   // menu yang terbuka saat halaman dimuat
    tokenExp = s.tokenExp || null; renderTokenInfo();
  }).catch(() => {});

  // ---- Masa berlaku token Stockbit (24 jam) ----
  // Ditampilkan di sidebar; peringatan muncul 2 jam sebelum habis. Status dicek ulang tiap 5 menit,
  // sehingga token baru yang disimpan di .stockbit-token langsung terdeteksi tanpa menjalankan ulang server.
  let tokenExp = null, tokenWarned = false;
  function renderTokenInfo() {
    const el = $("tokInfo");
    if (!tokenExp) { el.hidden = true; return; }
    const left = tokenExp * 1000 - Date.now();
    const until = new Date(tokenExp * 1000).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const h = Math.floor(left / 3600e3), m = Math.max(0, Math.floor(left % 3600e3 / 60e3));
    el.hidden = false;
    el.className = "tok " + (left <= 0 ? "bad" : left < 2 * 3600e3 ? "warn" : "ok");
    el.textContent = left <= 0 ? "Token kedaluwarsa — simpan token baru di .stockbit-token"
      : left < 2 * 3600e3 ? `Token habis dalam ${h ? h + " jam " : ""}${m} menit (${until})`
      : `Token berlaku s.d. ${until}`;
    if (left > 0 && left < 3600e3 && !tokenWarned) { tokenWarned = true; toast(`Token Stockbit habis dalam ${m} menit — siapkan token baru`, true); }
    if (left > 2 * 3600e3) tokenWarned = false;
  }
  setInterval(renderTokenInfo, 60e3);
  setInterval(() => fetch("/api/status").then(r => r.ok ? r.json() : null).then(s => { if (s) { sbStatus = s; tokenExp = s.tokenExp || null; renderTokenInfo(); } }).catch(() => {}), 5 * 60e3);

  // Versi percobaan: tanpa server. Kunjungan pertama diisi data awal terverifikasi,
  // setelah itu data tersimpan di browser masing-masing pengunjung (localStorage).
  const SEED_ITEMS = [
    { id: "NAYZ", ticker: "NAYZ", name: "PT Hassana Boga Sejahtera Tbk", price: 73, mcap: null, float: null, stage: "tender",
      acquirer: "Saiko Consultancy (Singapura)", flags: { akuisisi: true, kbli: true, rights: true },
      ms: { spa: true, akuisisi: true, to_umum: true }, updatedAt: "2026-10-14T03:30:00Z",
      notes: "Harga Rp73 per 2 Okt 2026. Akuisisi 29,41% pada 19 Agt 2026; penawaran tender wajib Rp75, 5 Okt–3 Nov 2026. Rencana inbreng perusahaan teknologi dan PMHMETD. Sumber: KabarBursa, 2 Okt 2026." },
    { id: "BIKE", ticker: "BIKE", name: "PT Sepeda Bersama Indonesia Tbk", price: null, mcap: null, float: null, stage: "spa",
      acquirer: "PT Penajam Makmur Jaya", flags: { akuisisi: true }, ms: { spa: true, akuisisi: true }, updatedAt: "2026-10-14T03:30:00Z",
      notes: "Akuisisi 71,22% (921,5 juta saham) pada 15 Apr 2026 melalui pasar negosiasi. Penawaran tender wajib direncanakan; status terbaru perlu diverifikasi. Sumber: Bareksa, 17 Apr 2026." },
  ];
  // Berita kini hanya dari Stockbit Reports. Berita media lama dari versi awal dibuang sekali.
  const OLD_MEDIA_IDS = ["2026-10-02-NAYZ-mto", "2026-10-02-umum-bisnis14", "2026-08-19-NAYZ-spa",
    "2026-05-08-MAPI-mto", "2026-04-15-BIKE-spa", "2026-04-14-umum-tren"];
  const hasKey = k => { try { return localStorage.getItem(k) !== null; } catch { return false; } };
  items = hasKey(LS_KEY) ? lsGet(LS_KEY, []) : SEED_ITEMS;
  // Hanya berita otomatis (Stockbit Reports dan media); catatan manual tidak dipakai lagi.
  updates = lsGet(LS_UPD, []).filter(u => !OLD_MEDIA_IDS.includes(u.id) && /^(sb-report-|news-)/.test(u.id));
  render();
  show(location.hash.slice(1) || lsGet(LS_VIEW, "potensi"));
  setSync("Mode percobaan · data tersimpan di browser ini");

  // Upgrade ke penyimpanan bersama bila tersedia.
  (async () => {
    try {
      const db = window.claude?.use ? await window.claude.use("db") : null;
      if (!db) return;
      setSync("Memuat data tim…");
      const onErr = () => setSync("Sinkronisasi terputus. Muat ulang halaman.");
      col = db.collection("watchlist");
      col.onSnapshot(snap => {
        items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSync("Tersinkron untuk tim · " + new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
        render();
      }, onErr);
      updCol = db.collection("updates");
      updCol.onSnapshot(snap => {
        updates = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderFeed();
      }, onErr);
    } catch { col = updCol = null; }
  })();
})();
