"""Rekomendasi harian: menggabungkan hasil screening yang sudah ada di website (Harmonic Pattern, Recovery, Seasonality,
Pola Broker, laporan keuangan, Saham 50, KakdrWay) dan sinyal backdoor (Monitor, Kandidat, POV-Dalam, pengendali
terverifikasi) menjadi satu daftar saham terbaik beserta alasannya. Logika murni tanpa akses jaringan; server.py
mengumpulkan datanya dari berkas lokal lalu memanggil nilai().

Skor = jumlah poin dari setiap sumber yang mendukung (maks. per sumber pada BOBOT) dikurangi poin risiko. Saham hanya
masuk daftar bila harganya di bawah batas harga, didukung minimal dua sumber, dan punya rencana dengan target 1 naik
10-20% serta target 2 naik 25-100% dari entry (R:R minimal 1, stop paling jauh 15%), skornya minimal SKOR_MIN, dan
tidak sedang ada pola harmonik bearish di PRZ atau yang sudah berbalik turun. Bukan saran investasi personal."""

# Naikkan bila aturan berubah: rekomendasi hari ini yang tersimpan dengan versi lama dihitung ulang.
VERSI = 4
BOBOT = {"harmonik": 25, "recovery": 20, "backdoor": 20, "seasonality": 15, "broker": 15, "lk": 15, "saham50": 10, "kakdr": 10}
NAMA_SUMBER = {"harmonik": "Harmonic Pattern", "recovery": "Recovery", "backdoor": "Backdoor", "seasonality": "Seasonality",
               "broker": "Pola Broker", "lk": "Laporan keuangan", "saham50": "Saham 50", "kakdr": "KakdrWay"}
TAHAP = {"spa": "perjanjian jual beli (SPA)", "tender": "tender offer", "rupslb": "RUPSLB", "injeksi": "injeksi aset"}
SINYAL = {"akuisisi": "akuisisi", "kbli": "perubahan KBLI", "rights": "rights issue", "direksi": "pergantian pengurus", "uma": "UMA"}
# Syarat rencana: naik target 1 dan target 2 dari entry (persen), R:R minimal ke target 1, stop terjauh di bawah entry,
# dan entry paling jauh di bawah harga terakhir (rencana "tunggu turun ke area entry").
TARGET1, TARGET2 = (10, 20), (25, 100)
RR_MIN, STOP_MAKS, ENTRY_BAWAH = 1.0, 15, 5
SKOR_MIN = 20      # skor gabungan minimal supaya sinyal lemah tidak ikut direkomendasikan
BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]


def _rp(v) -> str:
    return "–" if v is None else f"{round(v):,}".replace(",", ".")


def _rentang(lo, hi) -> str:
    return _rp(lo) if lo is not None and hi is not None and round(lo) == round(hi) else f"{_rp(lo)}–{_rp(hi)}"


def _pct(v) -> str:
    return "–" if v is None else (f"{v:+.1f}".replace(".", ",") + "%")


def _r(v) -> str:
    return f"{v:.2f}".replace(".", ",")


def nilai(src: dict, batas_harga: float = 2000, jumlah: int = 10) -> dict:
    """src berisi (semua opsional):
    harga {t: {h}}, nama {t: nama}, bulan (1-12),
    harmonik [baris .harmonik.json], recovery [saham recovery_api], seasonality [saham season_api],
    broker {"bulan": m, "akumulasi": [{s, bandar}], "distribusi": [{s, bandar}]}, lk [baris lk_api],
    saham50 [baris], kakdr [baris], items [Monitor], kandidat [item kandidat], backdoor_pd {t: skor 0-100},
    pengendali {t: {...}} (pengendali-verified.json), sikap {t: sikap pandangan analis}, hsc [kode saham HSC].
    Hasil: rows = Non HSC terbaik, hsc = HSC terbaik (masing-masing paling banyak `jumlah`, peringkat sendiri)."""
    harga = {t: (v or {}).get("h") for t, v in (src.get("harga") or {}).items()}
    nama = dict(src.get("nama") or {})
    acc: dict[str, dict] = {}

    def tambah(t, sumber, poin, alasan):
        a = acc.setdefault(t, {"komponen": {}, "alasan": [], "risiko": [], "plan": None})
        if poin > a["komponen"].get(sumber, 0):
            a["komponen"][sumber] = round(min(poin, BOBOT[sumber]), 1)
            a["alasan"] = [x for x in a["alasan"] if x[0] != sumber] + [(sumber, alasan)]

    def risiko(t, poin, teks):
        a = acc.setdefault(t, {"komponen": {}, "alasan": [], "risiko": [], "plan": None})
        a["risiko"].append((poin, teks))

    calon: dict[str, list] = {}      # calon rencana per saham: (prioritas, entry, stop, [(target, keterangan)], sumber)
    level: dict[str, list] = {}      # semua level target per saham dari semua sumber

    def rencana(t, prioritas, entry, stop, target, sumber):
        tg = [(x, k) for x, k in target if x]
        level.setdefault(t, []).extend(tg)
        if stop and tg:
            calon.setdefault(t, []).append((prioritas, entry, stop, tg, sumber))

    # Harmonic Pattern: satu pola bullish terbaik per saham dipakai untuk alasan sekaligus rencana; bearish di PRZ = risiko.
    STATUS = {"berbalik": (25, "sudah berbalik dari D"), "prz": (20, "harga sedang di PRZ"), "menuju": (8, "harga menuju PRZ")}
    terbaik: dict[str, tuple] = {}
    bearish: set[str] = set()
    for r in src.get("harmonik") or []:
        t, st = r.get("t"), r.get("status")
        if not t or st not in STATUS:
            continue
        pola = r.get("polaNama") or r.get("nama") or r.get("pola") or "pola harmonik"
        if r.get("arah") != "bullish":
            if st in ("prz", "berbalik"):
                bearish.add(t)   # pola bearish aktif: bertentangan dengan rencana beli, saham tidak direkomendasikan
            continue
        if st == "menuju" and (r.get("jarak") or 99) > 5:
            continue
        tg = r.get("target") or [None, None]
        h = r.get("harga") or harga.get(t)
        lewat = bool(tg[0] and h and h >= tg[0])
        poin = 5 if lewat else STATUS[st][0]
        if t not in terbaik or poin > terbaik[t][0]:
            terbaik[t] = (poin, lewat, pola, r)
    for t, (poin, lewat, pola, r) in terbaik.items():
        st, prz, tg = r["status"], r.get("prz") or [None, None], r.get("target") or [None, None]
        if lewat:
            # Harga sudah melewati target pertama: kesempatan dari pola ini sudah berjalan, poin kecil dan tanpa rencana.
            tambah(t, "harmonik", poin, f"Pola {pola} bullish sudah berbalik dari PRZ {_rentang(*prz)} dan harga sudah melewati target pertama {_rp(tg[0])}; kesempatan dari pola ini sudah berjalan.")
            continue
        tambah(t, "harmonik", poin, f"Pola {pola} bullish, {STATUS[st][1]}. PRZ {_rentang(*prz)}, target {_rp(tg[0])} dan {_rp(tg[1])}, batal di bawah {_rp(r.get('stop'))}.")
        masuk = r.get("harga") if st != "menuju" else prz[1]
        ca = [(x, f"target lanjutan pola {pola}") for x in (r.get("targetCA") or [])]
        rencana(t, 3, masuk, r.get("stop"), [(tg[0], f"0,382 kaki AD pola {pola}"), (tg[1], f"0,618 kaki AD pola {pola}")] + ca, f"Harmonic {pola}")

    # Recovery: saham yang turun dalam dan mulai pulih.
    for r in src.get("recovery") or []:
        t, sk, st = r.get("t"), r.get("skor") or 0, r.get("status") or ""
        if not t or st not in ("Siap rebound", "Mulai pulih"):
            continue
        tek, al = r.get("tek") or {}, [str(x) for x in r.get("alasan") or []]
        turun = next((x for x in al if x.lower().startswith("turun")), f"Turun {abs(round(tek.get('turun') or 0))}% dari puncak 52 minggu")
        teknik = next((x for x in al if x.lower().startswith("teknikal")), "")
        tambah(t, "recovery", sk * 0.2, f"Recovery {st.lower()} (skor {round(sk)}). {turun}." + (f" {teknik}." if teknik else ""))
        p = r.get("plan") or {}
        e = p.get("entry") or [None, None]
        rencana(t, 2, e[1] if isinstance(e, list) else e, p.get("sl"), [(p.get("tp1"), "target 1 Recovery"), (p.get("tp2"), "target 2 Recovery")], "Recovery")

    # Seasonality bulan berjalan.
    bln = src.get("bulan")
    for r in src.get("seasonality") or []:
        t, prob = r.get("t"), r.get("prob") or 0
        if not t or prob < 60:
            continue
        nb = BULAN[bln - 1] if bln else "bulan ini"
        tambah(t, "seasonality", (r.get("skor") or 0) * 0.15, f"Seasonality {nb}: naik {r.get('up')} kali dari {r.get('n')} tahun ({round(prob)}%), median {_pct(r.get('median'))}.")
        p = r.get("plan") or {}
        e = p.get("entry") or [None, None]
        rencana(t, 1, e[1] if isinstance(e, list) else e, p.get("sl"), [(p.get("tp1"), "target 1 Seasonality"), (p.get("tp2"), "target 2 Seasonality")], "Seasonality")

    # Pola Broker bulan terakhir: peringkat akumulasi bandar; distribusi = risiko.
    bro = src.get("broker") or {}
    nb = BULAN[bro["bulan"] - 1] if bro.get("bulan") else "bulan terakhir"
    akum = bro.get("akumulasi") or []
    for i, r in enumerate(akum):
        if (r.get("bandar") or 0) > 0:
            tambah(r["s"], "broker", 15 - 10 * i / max(1, len(akum) - 1), f"Bandar akumulasi di {nb} (peringkat {i + 1} dari {len(akum)} saham).")
    for r in bro.get("distribusi") or []:
        risiko(r["s"], 8, f"Bandar distribusi di {nb}.")

    # Laporan keuangan terbaru.
    LK = {"berbalik": (15, "berbalik untung"), "bagus": (12, "laba naik kuat"), "naik": (8, "laba naik")}   # bagus = naik >= 20%
    for r in src.get("lk") or []:
        t, k = r.get("t"), r.get("kategori")
        if not t:
            continue
        laba = r.get("laba") or {}
        if k in LK:
            # Laba naik di bawah 20%: poin sebanding kenaikannya (naik 1% hampir tidak berarti).
            poin = LK[k][0] if k != "naik" else 2 + 6 * min(max(laba.get("pct") or 0, 0), 20) / 20
            tambah(t, "lk", poin, f"Laporan {r.get('periode') or 'terbaru'}: {LK[k][1]}{' ' + _pct(laba.get('pct')) if laba.get('pct') is not None else ''}.")
        elif k == "rugi":
            risiko(t, 6, f"Laporan {r.get('periode') or 'terbaru'} masih rugi.")
        elif k == "turun":
            risiko(t, 4, f"Laba laporan {r.get('periode') or 'terbaru'} turun.")

    # Saham 50 (harga Rp50 ke bawah).
    for r in src.get("saham50") or []:
        t, sk = r.get("t"), r.get("skor") or 0
        if t and (r.get("target") or {}).get("harga"):
            level.setdefault(t, []).append((r["target"]["harga"], f"Saham 50: {r['target'].get('dasar') or 'resistance'}"))
        if t and sk >= 50:
            tambah(t, "saham50", sk * 0.1, f"Saham 50 skor {round(sk)}: {(r.get('potensi') or ['potensi kenaikan dari harga dasar'])[0]}")

    # KakdrWay (valuasi dan kualitas).
    for r in src.get("kakdr") or []:
        t, sk = r.get("t"), r.get("skor") or 0
        if t:
            tambah(t, "kakdr", sk, f"KakdrWay skor {_r(sk)} dari 10: PBV {_r(r['pbv']) if r.get('pbv') is not None else '–'}, ROE {_pct(r.get('roe'))}.")

    # Backdoor: tahap di Monitor, sinyal Kandidat, skor POV-Dalam, pengendali terverifikasi.
    bd: dict[str, list] = {}
    for it in src.get("items") or []:
        t, stg = it.get("ticker"), it.get("stage") or "radar"
        if not t or stg == "selesai":
            continue
        if stg in TAHAP:
            bd.setdefault(t, []).append((20, f"Di Monitor backdoor sudah tahap {TAHAP[stg]}."))
        else:
            fl = [SINYAL[k] for k, v in (it.get("flags") or {}).items() if v and k in SINYAL]
            bd.setdefault(t, []).append((10 + 2 * len(fl), "Masuk radar backdoor" + (f" dengan sinyal {', '.join(fl)}." if fl else ".")))
    for it in src.get("kandidat") or []:
        t = it.get("ticker")
        sig = [SINYAL[k] for k, v in (it.get("signals") or {}).items() if (v or {}).get("st") == "on" and k in SINYAL]
        if t and sig:
            bd.setdefault(t, []).append((4 * len(sig) + (6 if it.get("pengendaliBaru") else 0), f"Kandidat backdoor: {', '.join(sig)}" + (", ada pengendali baru." if it.get("pengendaliBaru") else ".")))
    for t, sk in (src.get("backdoor_pd") or {}).items():
        if sk and sk >= 50:
            bd.setdefault(t, []).append((sk * 0.2, f"Skor backdoor POV-Dalam {round(sk)} dari 100."))
    for t, v in (src.get("pengendali") or {}).items():
        if isinstance(v, dict) and t != "_info" and not v.get("bukanPengambilAlih") and v.get("siapa"):
            bd.setdefault(t, []).append((8, f"Pengendali baru terverifikasi: {v['siapa']}."))
    for t, xs in bd.items():
        xs.sort(key=lambda x: -x[0])
        tambah(t, "backdoor", sum(p for p, _ in xs[:2]), " ".join(s for _, s in xs[:2]))

    for t, s in (src.get("sikap") or {}).items():
        if s and "hindari" in str(s).lower():
            risiko(t, 15, "Pandangan analis: hindari.")

    def pilih_rencana(t, h):
        """Rencana dengan prioritas sumber tertinggi yang memenuhi syarat: stop paling jauh STOP_MAKS% di bawah entry,
        entry paling jauh ENTRY_BAWAH% di bawah harga terakhir, target 1 naik TARGET1% dan target 2 naik TARGET2% dari
        entry, R:R ke target 1 minimal RR_MIN. Target diambil dari sumber rencana itu dulu, lalu dari level sumber lain."""
        for p, e, sl, tg, sumber in sorted(calon.get(t) or [], key=lambda c: -c[0]):
            e = e or h
            if not (sl and e and sl < e and e <= h * 1.02 and e >= h * (1 - ENTRY_BAWAH / 100) and (1 - sl / e) * 100 <= STOP_MAKS):
                continue
            naik = lambda x: (x / e - 1) * 100
            def cari(lo, hi, min_harga):
                for daftar in (tg, level.get(t) or []):
                    ok = sorted((x for x in daftar if lo <= naik(x[0]) <= hi and x[0] > min_harga), key=lambda x: x[0])
                    if ok:
                        return ok[0]
                return None
            t1 = cari(*TARGET1, e)
            t2 = cari(*TARGET2, t1[0]) if t1 else None
            if not t1 or not t2:
                continue
            rr = (t1[0] - e) / (e - sl)
            if rr < RR_MIN:
                continue
            return {"entry": e, "stop": sl, "tp1": t1[0], "tp1Ket": t1[1], "tp2": t2[0], "tp2Ket": t2[1], "sumber": sumber,
                    "rr": round(rr, 2), "naik1": round(naik(t1[0]), 1), "naik2": round(naik(t2[0]), 1), "turunStop": round((sl / e - 1) * 100, 1)}
        return None

    rows = []
    for t, a in acc.items():
        h = harga.get(t)
        if not h or h >= batas_harga or len(a["komponen"]) < 2 or t in bearish:
            continue
        kurang = sum(p for p, _ in a["risiko"])
        skor = round(sum(a["komponen"].values()) - kurang, 1)
        if skor < SKOR_MIN:
            continue
        plan = pilih_rencana(t, h)
        if plan is None:
            continue      # tidak ada rencana dengan target 1 naik 10-20% dan target 2 naik 25-100%
        if plan["entry"] < h * 0.99:
            a["risiko"].append((0, f"Entry {_rp(plan['entry'])} di bawah harga terakhir {_rp(h)}: tunggu harga turun ke area entry, jangan dikejar."))
        urut = sorted(a["alasan"], key=lambda x: -a["komponen"].get(x[0], 0))
        rows.append({"t": t, "nama": nama.get(t, ""), "harga": h, "skor": skor,
                     "komponen": {NAMA_SUMBER[k]: v for k, v in sorted(a["komponen"].items(), key=lambda x: -x[1])},
                     "jumlahSumber": len(a["komponen"]), "alasan": [s for _, s in urut], "risiko": [s for _, s in a["risiko"]], "plan": plan})
    rows.sort(key=lambda r: (-r["skor"], -r["jumlahSumber"], r["t"]))
    # Saham HSC (konsentrasi kepemilikan tinggi, dikeluarkan dari IHSG) diperingkat terpisah dari saham Non HSC.
    hsc = set(src.get("hsc") or [])
    for r in rows:
        r["hsc"] = r["t"] in hsc
    non, dgn = [r for r in rows if not r["hsc"]][:jumlah], [r for r in rows if r["hsc"]][:jumlah]
    for grup in (non, dgn):
        for i, r in enumerate(grup):
            r["peringkat"] = i + 1
    return {"versi": VERSI, "syarat": {"target1": TARGET1, "target2": TARGET2, "rrMin": RR_MIN, "stopMaks": STOP_MAKS, "skorMin": SKOR_MIN}, "batasHarga": batas_harga, "dinilai": len(acc), "lolos": sum(not r["hsc"] for r in rows), "lolosHsc": sum(r["hsc"] for r in rows),
            "rows": non, "hsc": dgn, "bobot": {NAMA_SUMBER[k]: v for k, v in BOBOT.items()}}
