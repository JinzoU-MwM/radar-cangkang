"""Analisa mendalam satu emiten untuk halaman POV (aturan otomatis, tanpa AI).

Server mengumpulkan data mentah (profil, pemegang saham, jaringan kepemilikan tiap pemegang di emiten lain,
keterbukaan informasi, berita, kinerja, posting publik Stockbit); analyze() menyusunnya menjadi temuan, dugaan
tujuan beserta buktinya, dan daftar hal yang perlu diselidiki. Fungsi di sini murni (tanpa HTTP) agar bisa diuji.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta

PUBLIK_RX = re.compile(r"MASYARAKAT|PUBLIK|PUBLIC|SCRIPLESS|SCRIP\b", re.I)
# Kata kunci posting yang membahas struktur kepemilikan/aksi korporasi (dipakai mengurutkan relevansi).
TOPIK_RX = re.compile(r"pengendali|akuisisi|diakuisisi|pemilik|grup|group|konsorsium|backdoor|inbreng|rights|hmetd|tender|"
                      r"free ?float|ipo|merger|anak usaha|proyek|keluarga|sepupu|saudara|pendiri|ubo|beneficial|tukar guling|"
                      r"divestasi|caplok|private placement|injeksi|jv\b|joint venture", re.I)
NAMA_STOP = {"yang", "yg", "dan", "dg", "dengan", "lewat", "bersama", "di", "ke", "dari", "sebagai", "adalah", "juga", "sudah",
             "itu", "ini", "kemudian", "lalu", "dulu", "saat", "pernah", "dan", "atau", "akan", "masih", "sekarang", "nya",
             "the", "and", "via", "punya", "memiliki", "mendirikan", "sedangkan", "untuk", "pada", "tbk", "pt",
             "komis", "komisaris", "komut", "direktur", "dirut", "owner", "haji", "bos", "boss", "pemilik", "pengendali"}
BADAN_RX = re.compile(r"\b(PT|TBK|LTD|PTE|LIMITED|INC|CORP|CO|FUND|BANK|KOPERASI|YAYASAN|DANA PENSIUN|ASURANSI)\b", re.I)


def keluarga(pemegang: list[dict]) -> list[dict]:
    """Pemegang perorangan dengan nama belakang sama (>= 2 orang) dianggap satu keluarga: Risjad, Dananto, dst."""
    grup: dict = {}
    for p in pemegang:
        kata = re.sub(r"[^A-Za-z ]", " ", p["name"]).split()
        if BADAN_RX.search(p["name"]) or not 2 <= len(kata) <= 4:
            continue
        for w in {k.upper() for k in kata[1:]}:
            if len(w) >= 4:
                grup.setdefault(w, []).append(p)
    out, dipakai = [], set()
    for nama, ps in sorted(grup.items(), key=lambda kv: -len(kv[1])):
        ps = [p for p in ps if p["name"] not in dipakai]
        if len(ps) >= 2:
            dipakai |= {p["name"] for p in ps}
            out.append({"nama": nama.title(), "anggota": [p["name"] for p in ps], "pct": round(sum(p["pct"] for p in ps), 2)})
    return out
JENIS_AKSI = {"akuisisi": "Pengendali / akuisisi", "rights": "Modal (HMETD / private placement / inbreng)",
              "kbli": "Kegiatan usaha / nama", "direksi": "Pengurus", "uma": "UMA / suspensi"}


def _pct(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return float(re.sub(r"[^\d.]", "", str(v)) or 0)


def _kunci(s: str) -> str:
    s = re.sub(r"\b(PT|TBK|LTD|PTE|LIMITED|INC|BAPAK|IBU|PAK|BU)\b", " ", (s or "").upper())
    return " ".join(sorted(re.sub(r"[^A-Z0-9]+", " ", s).split()))


def _cocok_nama(a: str, b: str) -> bool:
    """Nama orang/badan sama walau urutan kata atau gelar berbeda (semua kata nama pendek ada di nama panjang)."""
    ka, kb = set(_kunci(a).split()), set(_kunci(b).split())
    if not ka or not kb:
        return False
    kecil, besar = (ka, kb) if len(ka) <= len(kb) else (kb, ka)
    return len(kecil) >= 2 and kecil <= besar if len(kecil) > 1 else kecil <= besar and len(next(iter(kecil))) >= 5


def nama_disebut(teks: str) -> list[str]:
    """Nama orang yang disebut di posting: "pak henry pribadi", "bu dina risjad" -> Henry Pribadi, Dina Risjad."""
    out = []
    for m in re.finditer(r"\b(?:pak|bu|bapak|ibu|om|mr\.?|mrs\.?)\s+([a-z][a-z'.-]+(?:\s+[a-z][a-z'.-]+){0,2})", teks, re.I):
        kata = []
        for w in m.group(1).split():
            if w.lower().strip(".") in NAMA_STOP or len(w) < 2:
                break
            kata.append(w.strip(".").capitalize())
        if kata and len(" ".join(kata)) >= 4:
            out.append(" ".join(kata))
    return out


def _jaringan(t: str, pemegang: list[dict], jar: dict) -> tuple[list[dict], list[dict]]:
    """Kepemilikan tiap pemegang (non-publik) di emiten lain + emiten yang dimiliki bersama oleh >= 2 pemegang."""
    rows, per_emiten = [], {}
    for p in pemegang:
        hold = [h for h in (jar.get(p["name"]) or []) if h.get("symbol") and h["symbol"] != t and _pct(h.get("pct")) > 0]
        hold.sort(key=lambda h: -_pct(h.get("pct")))
        rows.append({"nama": p["name"], "pct": p["pct"], "emiten": [{"t": h["symbol"], "pct": _pct(h.get("pct")), "sejak": h.get("since")}
                                                                    for h in hold[:15]]})
        for h in hold:
            per_emiten.setdefault(h["symbol"], []).append(p["name"])
    bersama = sorted(({"t": s, "pemegang": ns} for s, ns in per_emiten.items() if len(ns) >= 2), key=lambda x: -len(x["pemegang"]))
    return rows, bersama


def _riwayat(insider: list[dict], kini: datetime) -> list[dict]:
    """Peristiwa kepemilikan penting 3 tahun terakhir: pihak melewati 20%/50% (naik/turun) atau berubah >= 5 poin."""
    batas = (kini - timedelta(days=3 * 365)).strftime("%Y-%m-%d")
    out = []
    for r in sorted(insider, key=lambda r: r["date"]):
        if r["date"] < batas:
            continue
        prev, cur = r.get("prev") or 0, r.get("cur") or 0
        lewat = next((b for b in (50, 20) if (prev < b <= cur) or (cur < b <= prev)), None)
        if lewat or abs(cur - prev) >= 5:
            arah = "naik" if cur > prev else "turun"
            teks = f"{r['name']} {arah} {prev:.2f}% -> {cur:.2f}%" + (f" (melewati {lewat}%)" if lewat else "")
            if r.get("purpose"):
                teks += f"; tujuan: {r['purpose'][:120]}"
            out.append({"date": r["date"], "nama": r["name"], "prev": prev, "cur": cur, "lewat": lewat, "teks": teks})
    return out[-15:]


def _insider180(insider: list[dict], kini: datetime) -> list[dict]:
    batas = (kini - timedelta(days=180)).strftime("%Y-%m-%d")
    agg: dict = {}
    for r in insider:
        if r["date"] < batas:
            continue
        a = agg.setdefault(r["name"], {"nama": r["name"], "chg": 0.0, "n": 0, "role": r.get("role") or "", "nilai": 0.0, "akhir": r["date"]})
        a["chg"] += r.get("chg") or 0
        a["n"] += 1
        a["nilai"] += (r.get("value") or 0) * (1 if (r.get("chg") or 0) > 0 else -1)
        a["akhir"] = max(a["akhir"], r["date"])
    return sorted((a for a in agg.values() if abs(a["chg"]) >= 0.01), key=lambda a: -abs(a["chg"]))[:10]


def _komunitas(posts: list[dict], pemegang: list[dict], pengurus: list[str], jaringan_nama: list[str], t: str) -> dict:
    def skor(p):
        return len(p["txt"]) / 300 + (p.get("likes") or 0) / 15 + 2 * len(TOPIK_RX.findall(p["txt"]))
    pilih = sorted((p for p in posts if len(p["txt"]) >= 120), key=lambda p: -skor(p))[:8]
    nama: dict = {}
    terkait: dict = {}
    dikenal = [p["name"] for p in pemegang] + pengurus + jaringan_nama
    for p in posts:
        for n in nama_disebut(p["txt"]):
            e = nama.setdefault(n, {"nama": n, "n": 0, "terverifikasi": any(_cocok_nama(n, k) for k in dikenal)})
            e["n"] += 1
        for s in set(re.findall(r"\$([A-Z]{4})\b", p["txt"])) - {t}:
            terkait[s] = terkait.get(s, 0) + 1
    return {"posts": [{**p, "txt": p["txt"][:700]} for p in pilih],
            "nama": sorted(nama.values(), key=lambda e: (-e["terverifikasi"], -e["n"]))[:12],
            "terkait": [{"t": s, "n": n} for s, n in sorted(terkait.items(), key=lambda z: -z[1])[:10]],
            "jumlah": len(posts)}


def analyze(d: dict, kini: datetime | None = None) -> dict:
    kini = kini or datetime.now()
    t, prof = d["t"], d.get("profil") or {}
    stats, met = prof.get("stats") or {}, prof.get("metrics") or {}
    # Pemegang: >= 5% dari profil (dengan tanda pengendali) digabung >= 1% KSEI; publik/masyarakat dipisah.
    pmg: dict = {}
    for s in prof.get("shareholders") or []:
        pmg[_kunci(s["name"])] = {"name": s["name"], "pct": _pct(s.get("pct")), "pengendali": bool(s.get("pengendali"))}
    for s in prof.get("holders1") or []:
        k = _kunci(s["name"])
        if k not in pmg:
            pmg[k] = {"name": s["name"], "pct": _pct(s.get("pct")), "pengendali": False}
    semua = sorted(pmg.values(), key=lambda p: -p["pct"])
    non_publik = [p for p in semua if not PUBLIK_RX.search(p["name"])]
    pengurus = [re.sub(r"\s*\(.*\)$", "", x) for x in (prof.get("directors") or []) + (prof.get("commissioners") or [])]
    for p in non_publik:
        p["pengurus"] = next((x for x in pengurus if _cocok_nama(x, p["name"])), "")
    kel = keluarga(non_publik)
    anggota_kel = {n: k["nama"] for k in kel for n in k["anggota"]}
    for p in non_publik:
        p["keluarga"] = anggota_kel.get(p["name"], "")
    # Terafiliasi (bukan free float menurut BEI): >= 5%, pengendali, pengurus, dan anggota keluarga pemegang tersebut.
    total_np = round(sum(p["pct"] for p in non_publik if p["pct"] >= 5 or p["pengendali"] or p["pengurus"] or p["keluarga"]), 2)
    ff_efektif = round(max(0.0, 100 - total_np), 2)
    jar_rows, bersama = _jaringan(t, non_publik[:6], d.get("jaringan") or {})
    riwayat = _riwayat(d.get("insider") or [], kini)
    ins = _insider180(d.get("insider") or [], kini)
    batas180 = (kini - timedelta(days=180)).strftime("%Y-%m-%d")
    aksi = [{"date": u.get("date"), "judul": u.get("title"), "jenis": u.get("jenis") or [], "inti": u.get("inti") or "", "url": u.get("url")}
            for u in d.get("laporan") or [] if u.get("jenis")][:20]
    jenis180 = {j for a in aksi if (a["date"] or "") >= batas180 for j in a["jenis"]}
    kom = _komunitas(d.get("posts") or [], non_publik, pengurus, [e["t"] for r in jar_rows for e in r["emiten"]], t)
    lk = d.get("lk") or {}
    kw = lk.get("kuartal") or {}
    ff = stats.get("freeFloat")

    dugaan = []

    def tambah(judul, bukti, arah=0):
        if bukti:
            dugaan.append({"judul": judul, "bukti": bukti, "arah": arah,
                           "keyakinan": "tinggi" if len(bukti) >= 3 else "sedang" if len(bukti) == 2 else "rendah"})
    b = []
    if ff is not None and ff < 7.5:
        b.append(f"Free float {ff:.2f}% di bawah ketentuan minimal 7,5% (Peraturan BEI I-A).")
    if ff_efektif < 15:
        b.append(f"Pihak terafiliasi (>= 5%, pengendali, pengurus, keluarga) menguasai {total_np:.2f}%; free float efektif hanya {ff_efektif:.2f}%.")
        b += [f"Keluarga {k['nama']}: {len(k['anggota'])} anggota memegang {k['pct']:.2f}% ({', '.join(k['anggota'][:6])})." for k in kel if k["pct"] >= 3]
    if b:
        b.append("Pemenuhan free float biasanya ditempuh lewat penjualan/distribusi saham pemegang utama atau penambahan saham baru ke publik.")
        tambah("Pemenuhan free float: pemegang utama berpotensi melepas saham ke publik", b, 0)
    ambil = [r for r in riwayat if r["lewat"] and r["cur"] > r["prev"]]
    lepas = [r for r in riwayat if r["lewat"] and r["cur"] < r["prev"]]
    if ambil:
        tambah("Perubahan atau penguatan pengendalian (akuisisi / backdoor)",
               [f"{r['date']}: {r['teks']}" for r in ambil[-3:]] + [f"{r['date']}: {r['teks']}" for r in lepas[-2:]], 1)
    beli = [a for a in ins if a["chg"] > 0]
    jual = [a for a in ins if a["chg"] < 0]
    if beli:
        tambah("Orang dalam / pemegang utama menambah kepemilikan (keyakinan terhadap prospek)",
               [f"{a['nama']}{' (' + a['role'] + ')' if a['role'] else ''} +{a['chg']:.2f} poin dalam {a['n']} transaksi (terakhir {a['akhir']})" for a in beli[:4]], 1)
    if jual:
        tambah("Pemegang utama mengurangi kepemilikan (perlu dicek alasannya)",
               [f"{a['nama']} {a['chg']:.2f} poin dalam {a['n']} transaksi (terakhir {a['akhir']})" for a in jual[:4]], 0)
    if jenis180 & {"rights", "kbli"}:
        tambah("Aksi korporasi lanjutan: penambahan modal, injeksi aset, atau usaha baru",
               [f"{a['date']}: {a['judul']}" + (f" ({a['inti'][:140]})" if a["inti"] else "") for a in aksi if set(a["jenis"]) & {"rights", "kbli"}][:4], 1)
    if "akuisisi" in jenis180:
        tambah("Keterbukaan terkait pengendali / akuisisi dalam 180 hari",
               [f"{a['date']}: {a['judul']}" for a in aksi if "akuisisi" in a["jenis"]][:4], 1)
    grup = [r for r in jar_rows if len(r["emiten"]) >= 2]
    if grup or bersama:
        bk = [f"{r['nama']} juga memegang {', '.join(e['t'] + ' ' + format(e['pct'], '.2f') + '%' for e in r['emiten'][:6])}" for r in grup[:3]]
        bk += [f"{x['t']} dimiliki bersama oleh {', '.join(x['pemegang'])}" for x in bersama[:3]]
        tambah("Bagian dari jaringan/grup usaha: peluang sinergi atau pengalihan aset antar emiten grup", bk, 0)
    terv = [e for e in kom["nama"] if e["terverifikasi"]]
    if terv:
        tambah("Tokoh yang dibahas komunitas terkonfirmasi di data kepemilikan/pengurus",
               [f"{e['nama']} (disebut {e['n']}x di posting publik)" for e in terv[:5]], 0)
    pbv = met.get("pbv")
    if kw.get("tumbuh") and pbv and 0 < pbv < 1:
        tambah("Valuasi di bawah nilai buku dengan laba kuartal yang tumbuh",
               [f"PBV {pbv:.2f}x", f"Laba Q{kw.get('q')} murni naik dari tahun lalu dan dari kuartal sebelumnya"], 1)

    selidiki = []
    if non_publik:
        p0 = non_publik[0]
        selidiki.append(f"Siapa pemilik manfaat akhir (UBO) di balik {p0['name']} ({p0['pct']:.2f}%)? "
                        + (f"Profil mencatat UBO: {', '.join(prof.get('beneficiary') or [])}." if prof.get("beneficiary") else "UBO belum tercatat di profil."))
    for r in grup[:2]:
        selidiki.append(f"Apa peran {', '.join(e['t'] for e in r['emiten'][:4])} bagi {t}: pemasok, pelanggan, atau calon aset yang diinjeksikan?")
    if ff is not None and ff < 7.5:
        selidiki.append("Kapan dan dengan cara apa kewajiban free float dipenuhi (penjualan saham pendiri, private placement, atau HMETD)?")
    if jenis180 & {"rights", "kbli"}:
        selidiki.append("Rincian penggunaan dana, harga pelaksanaan, dan pihak siaga (standby buyer) aksi korporasi terakhir.")
    for e in [e for e in kom["nama"] if not e["terverifikasi"]][:3]:
        selidiki.append(f"Klaim komunitas tentang {e['nama']} belum terkonfirmasi di data kepemilikan; cek akta, laporan tahunan, atau keterbukaan.")
    if kom["terkait"]:
        selidiki.append(f"Hubungan dengan saham yang sering disebut bersamaan: {', '.join(x['t'] for x in kom['terkait'][:5])}.")
    selidiki.append("Cocokkan dengan dokumen sumber (keterbukaan BEI, laporan tahunan) sebelum mengambil keputusan.")

    harga = (prof.get("chart") or [{}])[-1].get("v") if prof.get("chart") else None
    # Skenario nilai: harga terhadap nilai buku per saham (PBV 1x) dan rentang 52 minggu.
    skenario = []
    bvps, hi, lo = met.get("bvps"), met.get("high52"), met.get("low52")
    if harga and bvps and bvps > 0:
        skenario.append({"label": "Harga di nilai buku (PBV 1x)", "harga": round(bvps), "selisih": round((bvps / harga - 1) * 100, 1)})
    if harga and hi:
        skenario.append({"label": "Tertinggi 52 minggu", "harga": hi, "selisih": round((hi / harga - 1) * 100, 1)})
    if harga and lo:
        skenario.append({"label": "Terendah 52 minggu", "harga": lo, "selisih": round((lo / harga - 1) * 100, 1)})
    bk = d.get("broker")
    if bk and bk.get("bandar", 0) > 0:
        tambah("Akumulasi broker 30 hari terakhir", [f"Net 3 pembeli + 3 penjual teratas Rp{bk['bandar'] / 1e9:.2f} M; pembeli utama {', '.join(bk['akum'])}"], 1)
    pa = d.get("pandangan") or {}
    # Kronologi gabungan: perubahan kepemilikan dan aksi korporasi (terbaru dulu).
    kron = [{"date": r["date"], "jenis": "kepemilikan", "teks": r["teks"]} for r in riwayat]
    kron += [{"date": a["date"], "jenis": "aksi", "teks": a["judul"] + (f" — {a['inti'][:160]}" if a["inti"] else "")} for a in aksi]
    kron = sorted((k for k in kron if k["date"]), key=lambda k: k["date"], reverse=True)[:25]
    ringkas = [f"{t} · {d.get('nama') or ''}".strip(" ·"),
               " / ".join(x for x in (prof.get("sector"), prof.get("industry")) if x)]
    if non_publik:
        ringkas.append(f"Pemegang utama {non_publik[0]['name']} {non_publik[0]['pct']:.2f}%; terafiliasi {total_np:.2f}% (free float efektif {ff_efektif:.2f}%)"
                       + (f"; free float {ff:.2f}%" if ff is not None else ""))
    if dugaan:
        ringkas.append("Dugaan terkuat: " + max(dugaan, key=lambda g: len(g["bukti"]))["judul"].split(":")[0])
    return {
        "t": t, "nama": d.get("nama") or "", "dibuat": kini.strftime("%Y-%m-%d %H:%M"), "ringkas": [x for x in ringkas if x],
        "identitas": {"sektor": prof.get("sector"), "subsektor": prof.get("subSector"), "industri": prof.get("industry"),
                      "latar": (prof.get("background") or "")[:900], "website": prof.get("website"), "harga": harga,
                      "mcap": stats.get("marketCap"), "saham": stats.get("shares"), "freeFloat": ff},
        "kepemilikan": {"pemegang": non_publik[:12], "publik": [p for p in semua if PUBLIK_RX.search(p["name"])][:3], "nonPublik": total_np, "ffEfektif": ff_efektif, "keluarga": kel,
                        "ubo": prof.get("beneficiary") or [], "direksi": prof.get("directors") or [], "komisaris": prof.get("commissioners") or []},
        "jaringan": jar_rows, "bersama": bersama[:10], "riwayat": riwayat, "insider": ins, "aksi": aksi,
        "berita": [{"date": u.get("date"), "judul": u.get("title"), "url": u.get("url")} for u in (d.get("berita") or [])[:10]],
        "kinerja": {"periode": lk.get("periode"), "judul": lk.get("judul"), "kuartal": kw or None, "pbv": pbv, "per": met.get("per"),
                    "laba": met.get("netIncomeTtm"), "pendapatan": met.get("revenueTtm"), "ekuitas": met.get("equity"), "bvps": met.get("bvps")},
        "komunitas": kom, "dugaan": dugaan, "selidiki": selidiki, "skenario": skenario, "kronologi": kron, "broker": bk,
        "radarSikap": {"sikap": pa.get("sikap"), "ringkas": (pa.get("ringkas") or "")[:400], "nilaiWajar": pa.get("nilaiWajar")} if pa.get("sikap") else None,
        "sumber": {"pemegang": len(semua), "jaringan": sum(len(r["emiten"]) for r in jar_rows), "keterbukaan": len(d.get("laporan") or []),
                   "berita": len(d.get("berita") or []), "posting": kom["jumlah"], "insider": len(d.get("insider") or [])},
        "catatan": d.get("catatan") or [],
    }
