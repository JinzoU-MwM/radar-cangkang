"""Membaca arah pengendali (lanjutan analisa mendalam POV): bandarmologi, jejak volume, preseden grup, dan
skenario ke mana saham dibawa. Aturan otomatis murni (tanpa HTTP) agar bisa diuji; data dikumpulkan server.
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta
from statistics import median

KONGLO_NAMA = re.compile(r"\b(salim|sinar ?mas|widjaja|djarum|hartono|barito|prajogo|pangestu|bakrie|mnc|tanoesoedibjo|lippo|riady|"
                         r"adaro|thohir|garibaldi|saratoga|soeryadjaya|merdeka|emtek|sariaatmadja|triputra|rachmat|harita|medco|"
                         r"panigoro|indika|sudwikatmono|isam|jhonlin|hapsoro|agung sedayu|ciputra|gudang garam|risjad|napan|tahir|"
                         r"mayapada|ct corp|tanjung|wings|katuari|kalla|bosowa|rajawali|sampoerna|astra|wilmar|kuok)\b", re.I)


def broker_parse(resp: dict) -> dict | None:
    """Ringkasan broker satu periode (marketdetectors): pembeli/penjual teratas dengan nilai, lot, harga rata-rata, jenis."""
    data = (resp or {}).get("data") or {}
    bs = data.get("broker_summary") or {}

    def angka(x, *k):
        for kk in k:
            try:
                return abs(float(x[kk]))
            except (KeyError, TypeError, ValueError):
                continue
        return 0.0
    beli = [{"b": x.get("netbs_broker_code"), "val": angka(x, "bval", "value"), "lot": angka(x, "blot", "lot"),
             "avg": angka(x, "netbs_buy_avg_price", "avg_price") or None, "jenis": str(x.get("type") or "")}
            for x in bs.get("brokers_buy") or [] if x.get("netbs_broker_code")]
    jual = [{"b": x.get("netbs_broker_code"), "val": angka(x, "sval", "value"), "lot": angka(x, "slot", "lot"),
             "avg": angka(x, "netbs_sell_avg_price", "avg_price") or None, "jenis": str(x.get("type") or "")}
            for x in bs.get("brokers_sell") or [] if x.get("netbs_broker_code")]
    if not beli and not jual:
        return None
    beli.sort(key=lambda z: -z["val"])
    jual.sort(key=lambda z: -z["val"])
    b3, j3 = beli[:3], jual[:3]
    wa = lambda zs: round(sum(z["val"] for z in zs) / sum(z["val"] / z["avg"] for z in zs)) if zs and all(z["avg"] for z in zs) else None
    tot_b, tot_j = sum(z["val"] for z in beli), sum(z["val"] for z in jual)
    asing = sum(z["val"] for z in beli if "asing" in z["jenis"].lower() or "foreign" in z["jenis"].lower()) \
        - sum(z["val"] for z in jual if "asing" in z["jenis"].lower() or "foreign" in z["jenis"].lower())
    return {"bandar": round(sum(z["val"] for z in b3) - sum(z["val"] for z in j3)), "akum": [z["b"] for z in b3], "dist": [z["b"] for z in j3],
            "avgAkum": wa(b3), "avgDist": wa(j3), "konsentrasi": round(sum(z["val"] for z in b3) / tot_b * 100, 1) if tot_b else None,
            "asing": round(asing), "nilaiBeli": round(tot_b), "nilaiJual": round(tot_j)}


def _ubah(bars: list[dict], hari: int) -> float | None:
    """Perubahan harga (%) n hari bursa terakhir."""
    if len(bars) <= hari:
        return None
    a, b = bars[-hari - 1]["c"], bars[-1]["c"]
    return round((b / a - 1) * 100, 1) if a else None


def bandarmologi(brokers: dict, bars: list[dict], harga: float | None) -> dict:
    """brokers = {5: ringkasan, 30: ..., 90: ...}. Fase bandar per periode, posisi modal bandar, broker yang konsisten."""
    fase, catatan = [], []
    for hari, label in ((5, "1 minggu"), (30, "1 bulan"), (90, "3 bulan")):
        r = brokers.get(hari) or brokers.get(str(hari))
        if not r:
            continue
        ub = _ubah(bars, {5: 5, 30: 21, 90: 63}[hari])
        if r["bandar"] > 0 and (ub is None or ub <= 2):
            arti = "akumulasi diam-diam: bandar mengumpulkan saat harga datar/turun"
        elif r["bandar"] > 0:
            arti = "akumulasi sambil mengangkat harga (markup)"
        elif r["bandar"] < 0 and (ub or 0) > 2:
            arti = "distribusi saat harga naik: barang dilepas ke pembeli ritel"
        elif r["bandar"] < 0:
            arti = "distribusi/keluar saat harga melemah"
        else:
            arti = "seimbang"
        posisi = None
        if harga and r.get("avgAkum"):
            posisi = round((harga / r["avgAkum"] - 1) * 100, 1)
        fase.append({"periode": label, "hari": hari, "bandar": r["bandar"], "harga": ub, "arti": arti, "akum": r["akum"], "dist": r["dist"],
                     "avgAkum": r.get("avgAkum"), "posisi": posisi, "konsentrasi": r.get("konsentrasi"), "asing": r.get("asing")})
    # Broker yang konsisten di sisi beli/jual lintas periode.
    cnt_b, cnt_j = {}, {}
    for f in fase:
        for b in f["akum"]:
            cnt_b[b] = cnt_b.get(b, 0) + 1
        for b in f["dist"]:
            cnt_j[b] = cnt_j.get(b, 0) + 1
    konsisten_b = [b for b, n in cnt_b.items() if n >= 2]
    konsisten_j = [b for b, n in cnt_j.items() if n >= 2]
    if konsisten_b:
        catatan.append(f"Broker {', '.join(konsisten_b)} konsisten di sisi beli pada {max(cnt_b[b] for b in konsisten_b)} periode: indikasi pihak yang sama terus mengumpulkan.")
    if konsisten_j:
        catatan.append(f"Broker {', '.join(konsisten_j)} konsisten di sisi jual: pihak yang sama terus melepas.")
    for f in fase:
        if f["posisi"] is not None and f["hari"] >= 30:
            catatan.append(f"Harga sekarang {'+' if f['posisi'] >= 0 else ''}{f['posisi']}% dari modal rata-rata pembeli utama {f['periode']} "
                           f"(Rp{rp(f['avgAkum'])})" + (": bandar masih rugi, cenderung menahan atau mengangkat harga." if f["posisi"] < -5
                           else ": bandar sudah untung, waspada distribusi." if f["posisi"] > 15 else "."))
            break
    if fase and fase[0].get("konsentrasi") and fase[0]["konsentrasi"] >= 60:
        catatan.append(f"Tiga pembeli teratas menguasai {fase[0]['konsentrasi']}% nilai beli {fase[0]['periode']}: transaksi terkonsentrasi (ciri saham yang dikendalikan).")
    return {"fase": fase, "catatan": catatan}


def jejak_volume(bars: list[dict], kejadian: list[dict]) -> list[dict]:
    """Hari bervolume >= 3x median 60 hari (1 tahun), dicocokkan dengan kejadian (keterbukaan/kepemilikan) <= 7 hari sesudahnya:
    volume naik SEBELUM pengumuman = kemungkinan ada pihak yang tahu lebih dulu."""
    out = []
    for i in range(60, len(bars)):
        ref = median([b["v"] for b in bars[i - 60:i] if b["v"]] or [0])
        if not ref or bars[i]["v"] < 3 * ref:
            continue
        d = bars[i]["d"]
        ch = round((bars[i]["c"] / bars[i - 1]["c"] - 1) * 100, 1) if bars[i - 1]["c"] else None
        dt = datetime.strptime(d, "%Y-%m-%d")
        sesudah = [k for k in kejadian if k.get("date") and d < k["date"] <= (dt + timedelta(days=7)).strftime("%Y-%m-%d")]
        out.append({"d": d, "kali": round(bars[i]["v"] / ref, 1), "ubah": ch, "sebelum": sesudah[0]["teks"][:140] if sesudah else ""})
    out.sort(key=lambda x: -x["kali"])
    return sorted(out[:10], key=lambda x: x["d"], reverse=True)


def preseden(grup_aksi: list[dict]) -> list[str]:
    """Pola aksi korporasi di emiten lain milik pemegang yang sama (2 tahun)."""
    JN = {"akuisisi": "perubahan pengendali/akuisisi", "rights": "penambahan modal/HMETD/inbreng", "kbli": "ganti kegiatan usaha/nama",
          "direksi": "ganti pengurus"}
    per: dict = {}
    for a in grup_aksi:
        for j in a.get("jenis") or []:
            if j in JN:
                per.setdefault(a["t"], {}).setdefault(j, a["date"])
    return [f"{t}: " + "; ".join(f"{JN[j]} ({d[:7]})" for j, d in sorted(js.items(), key=lambda kv: kv[1], reverse=True)) for t, js in per.items()]


def arah(c: dict) -> dict:
    """Skenario ke mana saham dibawa pengendali (skor 0-100 dari bukti) dan narasi bertahap.
    c: ringkasan dari povdalam.analyze + bandarmologi + preseden."""
    sk = []
    ff, fe, af = c.get("ff"), c.get("ffEfektif"), c.get("afiliasi") or 0
    bm = c.get("bandar") or {}
    f30 = next((f for f in bm.get("fase") or [] if f["hari"] == 30), None)
    f90 = next((f for f in bm.get("fase") or [] if f["hari"] == 90), None)
    akum = any(f["bandar"] > 0 for f in (f30, f90) if f)
    dist = any(f["bandar"] < 0 for f in (f30, f90) if f)
    pres = c.get("preseden") or []
    pres_txt = " ".join(pres).lower()
    rules = [
        ("Injeksi aset / backdoor ke perusahaan ini", [
            (30, bool(c.get("ambil")), "Ada pihak yang baru masuk/menguatkan kendali (melewati 20%/50%)."),
            (25, bool(c.get("rights")), "Ada rencana penambahan modal/HMETD/inbreng dalam 180 hari."),
            (15, bool(c.get("kbli")), "Ada perubahan kegiatan usaha/nama."),
            (15, "inbreng" in pres_txt or "penambahan modal" in pres_txt, "Pemegang yang sama pernah menambah modal/injeksi di emiten lain."),
            (10, (c.get("mcap") or 9e18) < 1e12, "Kapitalisasi di bawah Rp1 T: cangkang murah untuk dimasuki aset."),
            (10, akum, "Bandar mengumpulkan barang (1-3 bulan)."),
        ], ["Keterbukaan rencana transaksi material/inbreng", "Jadwal RUPSLB dan HMETD", "Penunjukan penilai independen atas aset target"]),
        ("Go private / tender offer sukarela", [
            (40, af >= 90, f"Pihak terafiliasi sudah {af:.1f}% saham."),
            (20, bool(c.get("insiderBeli")), "Pemegang utama terus menambah saham."),
            (15, (c.get("pbv") or 9) < 1, "Harga di bawah nilai buku: murah bagi pengendali untuk membeli sisa saham publik."),
            (10, akum, "Bandar mengumpulkan barang."),
        ], ["Pengumuman penawaran tender sukarela / rencana delisting", "Pembelian kembali saham (buyback) besar"]),
        ("Distribusi untuk memenuhi free float / menjual ke publik", [
            (40, ff is not None and ff < 7.5, f"Free float {ff}% di bawah 7,5%." if ff is not None else ""),
            (25, fe is not None and fe < 15, f"Free float efektif {fe}%."),
            (20, bool(c.get("insiderJual")), "Pemegang utama melepas saham bertahap."),
            (15, dist, "Bandar mendistribusikan barang."),
        ], ["Private placement / penjualan saham pendiri", "Masuknya pemegang baru < 5%", "Kenaikan free float di data KSEI"]),
        ("Pengendali/pemegang lama keluar (exit)", [
            (35, bool(c.get("insiderJual")), "Penjualan bertahap oleh pemegang utama."),
            (20, bool(c.get("habisBulan")), "Dengan laju jual sekarang kepemilikan akan habis dalam beberapa bulan."),
            (20, dist, "Bandar distribusi."),
            (15, bool(c.get("lepas")), "Ada pihak yang turun melewati 20%/50%."),
        ], ["Keterbukaan PPJB penjualan saham pengendali", "Calon pembeli (investor strategis) diumumkan"]),
        ("Konsolidasi / sinergi dalam grup", [
            (30, bool(c.get("bersama")), "Emiten lain dimiliki bersama oleh pemegang yang sama."),
            (20, (c.get("grupN") or 0) >= 2, "Pemegang utama punya beberapa emiten lain."),
            (20, bool(c.get("konglo")), "Ada nama grup/konglomerat besar di struktur kepemilikan."),
            (15, "akuisisi" in pres_txt or "pengendali" in pres_txt, "Grup pernah melakukan akuisisi/pengalihan pengendali di emiten lain."),
        ], ["Transaksi afiliasi antar emiten grup", "Merger/penggabungan usaha", "Pengurus yang sama di emiten grup"]),
        ("Pertumbuhan organik (bisnis membaik)", [
            (35, bool(c.get("tumbuh")), "Laba kuartal murni naik dari tahun lalu dan kuartal sebelumnya."),
            (20, bool(c.get("insiderBeli")), "Orang dalam menambah saham."),
            (15, (c.get("pbv") or 9) < 1, "Valuasi di bawah nilai buku."),
            (15, akum, "Bandar mengumpulkan barang."),
        ], ["Laporan kuartal berikutnya tetap tumbuh", "Pembagian dividen", "Kontrak/ekspansi baru"]),
    ]
    for nama, poin, konf in rules:
        bukti = [t for v, ok, t in poin if ok and t]
        skor = min(100, sum(v for v, ok, _ in poin if ok))
        if skor:
            sk.append({"nama": nama, "skor": skor, "bukti": bukti, "konfirmasi": konf})
    sk.sort(key=lambda x: -x["skor"])
    narasi = []
    if c.get("pengendaliTeks"):
        narasi.append(c["pengendaliTeks"])
    if c.get("jaringanTeks"):
        narasi.append(c["jaringanTeks"])
    if pres:
        narasi.append("Preseden grup (2 tahun): " + " | ".join(pres[:4]) + ". Pola yang pernah dijalankan pemegang yang sama cenderung diulang.")
    if c.get("aktivitasTeks"):
        narasi.append(c["aktivitasTeks"])
    if bm.get("fase"):
        narasi.append("Bandarmologi: " + "; ".join(f"{f['periode']} {f['arti']} (net Rp{f['bandar'] / 1e9:.2f} M, harga {f['harga'] if f['harga'] is not None else '-'}%)"
                                                  for f in bm["fase"]) + ". " + " ".join(bm.get("catatan") or []))
    if c.get("volumeTeks"):
        narasi.append(c["volumeTeks"])
    if sk:
        a = sk[0]
        narasi.append(f"Membaca arahnya: pola data paling sejalan dengan skenario \"{a['nama']}\" (skor {a['skor']}), karena "
                      + "; ".join(x.rstrip(".") for x in a["bukti"]) + "."
                      + (f" Skenario berikutnya: \"{sk[1]['nama']}\" (skor {sk[1]['skor']})." if len(sk) > 1 else "")
                      + f" Yang akan mengonfirmasi: {', '.join(a['konfirmasi'][:3]).lower()}.")
    if c.get("publikTeks"):
        narasi.append(c["publikTeks"])
    return {"skenario": sk[:5], "narasi": narasi}


def rp(v: float) -> str:
    """Angka rupiah gaya Indonesia (titik ribuan) tanpa mengubah tanda baca kalimat."""
    return f"{v:,.0f}".replace(",", ".")


def sudut_lain(c: dict) -> list[str]:
    """Hal yang jarang dihitung ritel: posisi untung/rugi orang dalam, biaya go private, harga perusahaan vs nilai bukunya,
    saham dijaminkan, pemain baru, pergantian pengurus, lonjakan volume sebelum pengumuman."""
    out, harga = [], c.get("harga")
    for a in (c.get("insider") or [])[:4]:
        if harga and a.get("harga"):
            p = round((harga / a["harga"] - 1) * 100, 1)
            sisi = "membeli" if a["chg"] > 0 else "menjual"
            out.append(f"{a['nama']} {sisi} di harga rata-rata ±Rp{rp(a['harga'])}; harga sekarang {'+' if p >= 0 else ''}{p}% dari itu"
                       + (" (pembeli besar masih rugi di kertas: biasanya tidak membiarkan harga jatuh lebih jauh)." if sisi == "membeli" and p < -5
                          else " (penjual melepas di bawah harga sekarang: ada yang mau keluar walau lebih murah)." if sisi == "menjual" and p > 5 else "."))
    mcap, ek, fe = c.get("mcap"), c.get("ekuitas"), c.get("ffEfektif")
    if mcap and ek and ek > 0:
        out.append(f"Pasar menilai seluruh perusahaan Rp{rp(mcap / 1e9)} M, ekuitasnya Rp{rp(ek / 1e9)} M ({mcap / ek:.2f}x)"
                   + (": membeli seluruh perusahaan lebih murah dari nilai bukunya." if mcap < ek else "."))
    if mcap and fe is not None:
        out.append(f"Untuk menguasai seluruh saham publik (free float efektif {fe:.2f}%) cukup ±Rp{rp(mcap * fe / 100 / 1e9)} M pada harga sekarang"
                   ": ukuran 'biaya go private' atau biaya mengendalikan pasar sahamnya.")
    jamin = [r for r in c.get("insiderRaw") or [] if re.search(r"jaminan|gadai|repo|pledge|agunan", r.get("purpose") or "", re.I)]
    if jamin:
        r = jamin[0]
        out.append(f"Ada saham yang dijaminkan/repo ({r['name']}, {r['date']}): risiko jual paksa bila harga jatuh (margin call).")
    baru = c.get("pemainBaru") or []
    if baru:
        out.append("Pemain baru dalam 3 tahun: " + "; ".join(baru[:4]) + ". Pihak baru biasanya masuk dengan rencana.")
    if c.get("pengurusBaru"):
        out.append(f"Perubahan pengurus {c['pengurusBaru']}: pergantian direksi/komisaris sering mendahului aksi korporasi besar.")
    vol = [v for v in c.get("volume") or [] if v["sebelum"]]
    if vol:
        v = vol[0]
        out.append(f"Lonjakan volume {v['kali']}x pada {v['d']} ({'+' if (v['ubah'] or 0) >= 0 else ''}{v['ubah']}%) terjadi sebelum: {v['sebelum']}. "
                   "Volume yang naik sebelum pengumuman bisa menandakan ada pihak yang tahu lebih dulu.")
    return out


def target_harga(c: dict) -> list[dict]:
    """Skenario target harga (bukan rekomendasi): nilai buku (titik distribusi pengendali), harga orang dalam, harga aksi
    korporasi di keterbukaan, modal bandar + margin distribusi, tertinggi 52 minggu. Potensi = selisih dari harga sekarang."""
    h, out = c.get("harga"), []
    if not h:
        return out

    def tambah(label, harga, dasar):
        if harga and harga > 0 and not any(abs(x["harga"] - harga) / harga < 0.02 for x in out):
            out.append({"label": label, "harga": round(harga), "potensi": round((harga / h - 1) * 100, 1), "dasar": dasar})
    if c.get("bvps"):
        tambah("Nilai buku (PBV 1x)", c["bvps"], "Titik wajar distribusi pengendali/pemenuhan free float: pengendali jarang melepas jauh di bawah nilai buku.")
    ins = [a for a in c.get("insider") or [] if a.get("harga")]
    if ins:
        a = max(ins, key=lambda a: a["harga"])
        tambah("Harga transaksi orang dalam", a["harga"], f"Harga rata-rata tertinggi transaksi {a['nama']} (180 hari).")
    for x in c.get("aksi") or []:
        m = re.search(r"(?:harga (?:pelaksanaan|penawaran|tender)|seharga|@)\s*rp\s?([\d.]+)", f"{x.get('judul', '')} {x.get('inti', '')}", re.I)
        if m:
            tambah("Harga di keterbukaan aksi korporasi", float(m.group(1).replace(".", "")), f"{x.get('date')}: {x.get('judul', '')[:90]}")
            break
    f90 = next((f for f in (c.get("bandar") or {}).get("fase") or [] if f["hari"] == 90 and f.get("avgAkum")), None)
    if f90 and f90["bandar"] > 0:
        tambah("Modal bandar + margin distribusi 30%", f90["avgAkum"] * 1.3, f"Modal rata-rata pembeli utama 3 bulan Rp{rp(f90['avgAkum'])} ditambah ruang untung untuk dibagikan.")
    if c.get("high52"):
        tambah("Tertinggi 52 minggu", c["high52"], "Batas atas yang pernah dicapai setahun terakhir.")
    return sorted(out, key=lambda x: x["harga"])
