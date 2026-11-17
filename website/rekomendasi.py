"""Rekomendasi harian: menggabungkan hasil screening yang sudah ada di website (Harmonic Pattern, Recovery, Seasonality,
Pola Broker, laporan keuangan, Saham 50, KakdrWay) dan sinyal backdoor (Monitor, Kandidat, POV-Dalam, pengendali
terverifikasi) menjadi satu daftar saham terbaik beserta alasannya. Logika murni tanpa akses jaringan; server.py
mengumpulkan datanya dari berkas lokal lalu memanggil nilai().

Skor = jumlah poin dari setiap sumber yang mendukung (maks. per sumber pada BOBOT) dikurangi poin risiko. Saham hanya
masuk daftar bila harganya di bawah batas harga dan didukung minimal dua sumber. Bukan saran investasi personal."""

BOBOT = {"harmonik": 25, "recovery": 20, "backdoor": 20, "seasonality": 15, "broker": 15, "lk": 15, "saham50": 10, "kakdr": 10}
NAMA_SUMBER = {"harmonik": "Harmonic Pattern", "recovery": "Recovery", "backdoor": "Backdoor", "seasonality": "Seasonality",
               "broker": "Pola Broker", "lk": "Laporan keuangan", "saham50": "Saham 50", "kakdr": "KakdrWay"}
TAHAP = {"spa": "perjanjian jual beli (SPA)", "tender": "tender offer", "rupslb": "RUPSLB", "injeksi": "injeksi aset"}
SINYAL = {"akuisisi": "akuisisi", "kbli": "perubahan KBLI", "rights": "rights issue", "direksi": "pergantian pengurus", "uma": "UMA"}
BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]


def _rp(v) -> str:
    return "–" if v is None else f"{round(v):,}".replace(",", ".")


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
    pengendali {t: {...}} (pengendali-verified.json), sikap {t: sikap pandangan analis}."""
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

    def rencana(t, plan, prioritas):
        a = acc.setdefault(t, {"komponen": {}, "alasan": [], "risiko": [], "plan": None})
        if plan and (a["plan"] is None or prioritas > a["plan"]["_p"]):
            a["plan"] = {**plan, "_p": prioritas}

    # Harmonic Pattern: pola bullish yang sudah di PRZ atau berbalik (terbaik per saham); bearish di PRZ = risiko.
    STATUS = {"berbalik": (25, "sudah berbalik dari D"), "prz": (20, "harga sedang di PRZ"), "menuju": (8, "harga menuju PRZ")}
    for r in src.get("harmonik") or []:
        t, st = r.get("t"), r.get("status")
        if not t or st not in STATUS:
            continue
        pola = r.get("polaNama") or r.get("nama") or r.get("pola") or "pola harmonik"
        if r.get("arah") == "bullish":
            if st == "menuju" and (r.get("jarak") or 99) > 5:
                continue
            poin, teks = STATUS[st]
            prz, tg = r.get("prz") or [None, None], r.get("target") or [None, None]
            tambah(t, "harmonik", poin, f"Pola {pola} bullish, {teks}. PRZ {_rp(prz[0])}–{_rp(prz[1])}, target {_rp(tg[0])} dan {_rp(tg[1])}, batal di bawah {_rp(r.get('stop'))}.")
            if r.get("stop") and tg[0]:
                masuk = r.get("harga") if st != "menuju" else (prz[1] if prz[1] else None)
                rencana(t, {"entry": masuk, "stop": r["stop"], "tp1": tg[0], "tp2": tg[1], "sumber": f"Harmonic {pola}"}, 3)
        elif st in ("prz", "berbalik"):
            risiko(t, 10, f"Ada pola {pola} bearish yang {STATUS[st][1]}, arah jangka pendek bisa turun.")

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
        if p.get("sl") and p.get("tp1"):
            e = p.get("entry") or [None, None]
            rencana(t, {"entry": e[1] if isinstance(e, list) else e, "stop": p["sl"], "tp1": p["tp1"], "tp2": p.get("tp2"), "sumber": "Recovery"}, 2)

    # Seasonality bulan berjalan.
    bln = src.get("bulan")
    for r in src.get("seasonality") or []:
        t, prob = r.get("t"), r.get("prob") or 0
        if not t or prob < 60:
            continue
        nb = BULAN[bln - 1] if bln else "bulan ini"
        tambah(t, "seasonality", (r.get("skor") or 0) * 0.15, f"Seasonality {nb}: naik {r.get('up')} kali dari {r.get('n')} tahun ({round(prob)}%), median {_pct(r.get('median'))}.")
        p = r.get("plan") or {}
        if p.get("sl") and p.get("tp1"):
            e = p.get("entry") or [None, None]
            rencana(t, {"entry": e[1] if isinstance(e, list) else e, "stop": p["sl"], "tp1": p["tp1"], "tp2": p.get("tp2"), "sumber": "Seasonality"}, 1)

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
    LK = {"berbalik": (15, "berbalik untung"), "bagus": (12, "laba naik kuat"), "naik": (8, "laba naik")}
    for r in src.get("lk") or []:
        t, k = r.get("t"), r.get("kategori")
        if not t:
            continue
        laba = r.get("laba") or {}
        if k in LK:
            tambah(t, "lk", LK[k][0], f"Laporan {r.get('periode') or 'terbaru'}: {LK[k][1]}{' ' + _pct(laba.get('pct')) if laba.get('pct') is not None else ''}.")
        elif k == "rugi":
            risiko(t, 6, f"Laporan {r.get('periode') or 'terbaru'} masih rugi.")
        elif k == "turun":
            risiko(t, 4, f"Laba laporan {r.get('periode') or 'terbaru'} turun.")

    # Saham 50 (harga Rp50 ke bawah).
    for r in src.get("saham50") or []:
        t, sk = r.get("t"), r.get("skor") or 0
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

    rows = []
    for t, a in acc.items():
        h = harga.get(t)
        if not h or h >= batas_harga or len(a["komponen"]) < 2:
            continue
        kurang = sum(p for p, _ in a["risiko"])
        skor = round(sum(a["komponen"].values()) - kurang, 1)
        if skor <= 0:
            continue
        plan = dict(a["plan"]) if a["plan"] else None
        if plan:
            plan.pop("_p", None)
            e, sl, tp = plan.get("entry") or h, plan.get("stop"), plan.get("tp1")
            plan["entry"] = e
            plan["rr"] = round((tp - e) / (e - sl), 2) if sl and tp and e > sl and tp > e else None
            if plan["rr"] is not None and plan["rr"] < 1.5:
                a["risiko"].append((0, f"Dari harga sekarang, untung ke target pertama baru {_r(plan['rr'])} kali risikonya; lebih baik menunggu harga mendekati area entry."))
        urut = sorted(a["alasan"], key=lambda x: -a["komponen"].get(x[0], 0))
        rows.append({"t": t, "nama": nama.get(t, ""), "harga": h, "skor": skor,
                     "komponen": {NAMA_SUMBER[k]: v for k, v in sorted(a["komponen"].items(), key=lambda x: -x[1])},
                     "jumlahSumber": len(a["komponen"]), "alasan": [s for _, s in urut], "risiko": [s for _, s in a["risiko"]], "plan": plan})
    rows.sort(key=lambda r: (-r["skor"], -r["jumlahSumber"], r["t"]))
    for i, r in enumerate(rows[:jumlah]):
        r["peringkat"] = i + 1
    return {"batasHarga": batas_harga, "dinilai": len(acc), "lolos": len(rows), "rows": rows[:jumlah], "bobot": {NAMA_SUMBER[k]: v for k, v in BOBOT.items()}}
