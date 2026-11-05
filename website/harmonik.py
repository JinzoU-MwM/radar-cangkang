"""Harmonic Pattern (XABCD) dari bar harian: pivot zigzag lalu pencocokan rasio Fibonacci tiap pola.

Rasio mengikuti ilustrasi artikel Astronacci "Belajar Harmonic Pattern: Pengertian, Cara Kerja, dan Jenis-Jenisnya"
(31 Juli 2026). Gambarnya diberi keterangan AI Generate; teks artikel sendiri hanya menyebut B Gartley 0,618 XA,
B Bat 0,382-0,5 XA, dan D Crab sampai 1,618 XA. PRZ, konfirmasi, stop, dan target mengikuti artikel Astronacci
"Cara Menggunakan Harmonic Pattern untuk Menentukan Area Entry" (7 Agustus 2026); target alternatif (titik C lalu A)
dari artikel Maxco "Cara Mudah Belajar Harmonic Pattern". Fungsi murni: masukan bars [{d,o,h,l,c,v}] (v dalam lot),
keluaran baris screening.

Arah: bullish bila kaki XA naik (X lembah, A puncak), sehingga D berupa lembah: area potensi berbalik naik.
"""
from __future__ import annotations


# b = AB/XA, c = BC/AB, d = AD/XA (D diukur dari A ke arah X), bc = CD/BC.
# Cypher: cx = XC/XA (C melewati A), dxc = CD/XC (D = retracement kaki XC).
POLA = {
    "gartley": {"nama": "Gartley", "b": (0.618, 0.618), "c": (0.382, 0.886), "d": (0.786, 0.786), "bc": (1.13, 1.618),
                "ket": "Pola tertua dan paling dikenal; biasanya muncul setelah tren yang jelas, koreksi sebelum tren berlanjut."},
    "bat": {"nama": "Bat", "b": (0.382, 0.50), "c": (0.382, 0.886), "d": (0.886, 0.886), "bc": (1.618, 2.618),
            "ket": "Mirip Gartley dengan retracement B lebih dangkal; D biasanya tidak melewati X. Muncul pada koreksi moderat."},
    "butterfly": {"nama": "Butterfly", "b": (0.786, 0.786), "c": (0.382, 0.886), "d": (1.27, 1.27), "bc": (1.618, 2.24),
                  "ket": "D melewati X (ekstensi); muncul di area ekstrem, potensi pembalikan cukup signifikan."},
    "crab": {"nama": "Crab", "b": (0.382, 0.618), "c": (0.382, 0.886), "d": (1.618, 1.618), "bc": (2.618, 3.618),
             "ket": "Proyeksi D paling ekstrem (1,618 XA); muncul saat harga overextended, potensi pembalikan tajam."},
    "cypher": {"nama": "Cypher", "b": (0.382, 0.618), "cx": (1.272, 1.414), "dxc": (0.786, 0.786),
               "ket": "C melewati A (1,27-1,41 XA); D di 0,786 kaki XC. Muncul di pasar volatil dengan swing kompleks."},
}
TOL = 0.05            # toleransi relatif batas rasio (±5%)
PRZ_LEBAR = 0.03      # lebar PRZ = ±3% panjang kaki acuan di sekitar level D
SKALA = (0.06, 0.10, 0.15)   # ambang zigzag (pembalikan minimal) dari swing kecil ke besar
MENUJU_MAKS = 12.0    # % jarak harga ke PRZ yang masih ditampilkan sebagai "menuju PRZ"
BERBALIK_BAR = 20     # D terkonfirmasi paling lama sekian bar lalu
MIN_NILAI = 1e9       # rata-rata nilai transaksi 20 hari (Rp); saham tidak likuid membentuk XABCD yang kurang representatif


def nilai_rata(bars: list[dict], n: int = 20) -> float:
    """Rata-rata nilai transaksi harian (Rp) n bar terakhir; volume Stockbit dalam lot (100 lembar)."""
    xs = bars[-n:]
    return sum(b["c"] * b["v"] * 100 for b in xs) / len(xs) if xs else 0.0


def rsi(closes: list[float], n: int = 14) -> list[float | None]:
    """RSI Wilder per bar (None sebelum cukup data)."""
    out: list[float | None] = [None] * len(closes)
    if len(closes) <= n:
        return out
    g = sum(max(closes[i] - closes[i - 1], 0) for i in range(1, n + 1)) / n
    lo = sum(max(closes[i - 1] - closes[i], 0) for i in range(1, n + 1)) / n
    for i in range(n, len(closes)):
        if i > n:
            d = closes[i] - closes[i - 1]
            g = (g * (n - 1) + max(d, 0)) / n
            lo = (lo * (n - 1) + max(-d, 0)) / n
        out[i] = 100.0 if lo == 0 else 100 - 100 / (1 + g / lo)
    return out


def candle_balik(bars: list[dict], i: int, bull: bool) -> str:
    """Candle pembalikan di bar i: pin bar, engulfing, atau inside/outside bar searah pembalikan ('' bila tidak ada)."""
    if i < 1 or i >= len(bars):
        return ""
    b, a = bars[i], bars[i - 1]
    rng, badan = b["h"] - b["l"], abs(b["c"] - b["o"])
    if rng <= 0:
        return ""
    ekor_bawah, ekor_atas = min(b["o"], b["c"]) - b["l"], b["h"] - max(b["o"], b["c"])
    if bull:
        if ekor_bawah >= 2 * max(badan, rng * 0.05) and ekor_bawah >= 0.6 * rng:
            return "pin bar"
        if a["c"] < a["o"] and b["c"] > b["o"] and b["c"] >= a["o"] and b["o"] <= a["c"]:
            return "bullish engulfing"
        if b["h"] > a["h"] and b["l"] < a["l"] and b["c"] > b["o"]:
            return "outside bar"
    else:
        if ekor_atas >= 2 * max(badan, rng * 0.05) and ekor_atas >= 0.6 * rng:
            return "pin bar"
        if a["c"] > a["o"] and b["c"] < b["o"] and b["c"] <= a["o"] and b["o"] >= a["c"]:
            return "bearish engulfing"
        if b["h"] > a["h"] and b["l"] < a["l"] and b["c"] < b["o"]:
            return "outside bar"
    return ""


def konfirmasi(bars: list[dict], rs: list, B: dict, D: dict, bull: bool) -> list[str]:
    """Konfirmasi di area PRZ (Astronacci): candle pembalikan sejak D, divergence RSI D terhadap B, dan
    tembusnya struktur minor (penutupan melewati puncak/lembah 3 bar sebelum D)."""
    out = []
    for i in range(D["i"], len(bars)):
        c = candle_balik(bars, i, bull)
        if c:
            out.append(f"{c} {bars[i]['d'][:10]}")
            break
    rb, rd = rs[B["i"]], rs[D["i"]]
    if rb is not None and rd is not None:
        if bull and D["p"] < B["p"] and rd > rb:
            out.append(f"divergence RSI (RSI D {rd:.0f} > B {rb:.0f})")
        if not bull and D["p"] > B["p"] and rd < rb:
            out.append(f"divergence RSI (RSI D {rd:.0f} < B {rb:.0f})")
    awal = bars[max(0, D["i"] - 3):D["i"]]
    if awal and D["i"] < len(bars) - 1:
        batas = max(x["h"] for x in awal) if bull else min(x["l"] for x in awal)
        if (bars[-1]["c"] > batas) if bull else (bars[-1]["c"] < batas):
            out.append("struktur minor tembus")
    return out


def zigzag(bars: list[dict], th: float) -> list[dict]:
    """Pivot bergantian H/L: berganti bila harga berbalik >= th dari ekstrem terakhir. Pivot terakhir = ekstrem
    berjalan (tentatif=True), belum terkonfirmasi pembalikan."""
    n = len(bars)
    if n < 3:
        return []
    out: list[dict] = []
    mode, hi, lo, ext = 0, 0, 0, 0
    for i in range(1, n):
        h, lw = bars[i]["h"], bars[i]["l"]
        if mode == 0:
            if h > bars[hi]["h"]:
                hi = i
            if lw < bars[lo]["l"]:
                lo = i
            if bars[lo]["l"] > 0 and bars[hi]["h"] >= bars[lo]["l"] * (1 + th):
                if lo < hi:
                    out.append({"i": lo, "p": bars[lo]["l"], "k": "L"})
                    mode, ext = 1, hi
                else:
                    out.append({"i": hi, "p": bars[hi]["h"], "k": "H"})
                    mode, ext = -1, lo
        elif mode == 1:
            if h >= bars[ext]["h"]:
                ext = i
            elif lw <= bars[ext]["h"] * (1 - th):
                out.append({"i": ext, "p": bars[ext]["h"], "k": "H"})
                mode, ext = -1, i
        else:
            if lw <= bars[ext]["l"]:
                ext = i
            elif h >= bars[ext]["l"] * (1 + th):
                out.append({"i": ext, "p": bars[ext]["l"], "k": "L"})
                mode, ext = 1, i
    if mode:
        out.append({"i": ext, "p": bars[ext]["h" if mode == 1 else "l"], "k": "H" if mode == 1 else "L", "tentatif": True})
    return out


def _dalam(v: float, rg: tuple[float, float], tol: float = TOL) -> bool:
    return rg[0] * (1 - tol) <= v <= rg[1] * (1 + tol)


def cocok(X: float, A: float, B: float, C: float, tol: float = TOL) -> list[dict]:
    """Pola yang rasio B dan C-nya terpenuhi, beserta PRZ (rentang harga D) hasil pertemuan rasio XA dan proyeksi BC."""
    xa, ab, bc = abs(A - X), abs(A - B), abs(C - B)
    if not (xa and ab and bc) or (A - X) * (B - A) >= 0 or (C - B) * (B - A) >= 0:
        return []
    b, c = ab / xa, bc / ab
    out = []
    for k, p in POLA.items():
        if not _dalam(b, p["b"], tol):
            continue
        if k == "cypher":
            cx = abs(C - X) / xa
            if (C - A) * (A - X) <= 0 or not _dalam(cx, p["cx"], tol):
                continue
            xc = abs(C - X)
            pusat = C - (C - X) * p["dxc"][0]
            prz = sorted((pusat - PRZ_LEBAR * xc, pusat + PRZ_LEBAR * xc))
            rasio = {"b": round(b, 3), "cx": round(cx, 3)}
        else:
            if not _dalam(c, p["c"], tol):
                continue
            pusat = A + (X - A) * p["d"][0]
            prz = sorted((pusat - PRZ_LEBAR * xa, pusat + PRZ_LEBAR * xa))
            proyeksi = sorted((C + (B - C) * p["bc"][0] * (1 - tol), C + (B - C) * p["bc"][1] * (1 + tol)))
            if proyeksi[1] < prz[0] or proyeksi[0] > prz[1]:
                continue   # rasio XA dan proyeksi BC tidak bertemu: bukan PRZ
            rasio = {"b": round(b, 3), "c": round(c, 3)}
        out.append({"pola": k, "pusat": pusat, "prz": prz, "rasio": rasio})
    return out


def _bulat(v: float) -> float:
    return round(v, 2) if v < 10 else round(v)


def cari(bars: list[dict], skala: tuple[float, ...] = SKALA, min_nilai: float = MIN_NILAI) -> list[dict]:
    """Pola harmonik aktif di ujung data: status "prz" (D sedang di PRZ), "berbalik" (D terkonfirmasi di PRZ dalam
    BERBALIK_BAR bar terakhir, harga mulai berbalik), atau "menuju" (X-A-B-C terbentuk, harga bergerak ke PRZ)."""
    if len(bars) < 30 or nilai_rata(bars) < min_nilai:
        return []
    n, akhir = len(bars), bars[-1]["c"]
    rs = rsi([b["c"] for b in bars])
    hasil: dict[tuple, dict] = {}
    for th in skala:
        pv = zigzag(bars, th)
        jendela = []
        if len(pv) >= 5:
            jendela.append(pv[-5:])         # D = ekstrem berjalan
        if len(pv) >= 6:
            jendela.append(pv[-6:-1])       # D terkonfirmasi, kaki setelahnya = reaksi
        for w in jendela:
            X, A, B, C, D = w
            terkonfirmasi = not D.get("tentatif")
            if terkonfirmasi and D["i"] < n - BERBALIK_BAR:
                continue
            for m in cocok(X["p"], A["p"], B["p"], C["p"]):
                bull = A["p"] > X["p"]
                lo, hi = m["prz"]
                di_prz = lo <= D["p"] <= hi
                lewat = D["p"] < lo if bull else D["p"] > hi
                if lewat:
                    continue          # D sudah menembus PRZ: pola batal
                if terkonfirmasi:
                    if not di_prz:
                        continue
                    status = "berbalik"
                elif di_prz:
                    status = "prz"
                else:
                    status = "menuju"
                tepi = hi if bull else lo
                jarak = (akhir / tepi - 1) * 100 if status == "menuju" else 0.0
                if status == "menuju" and (jarak * (1 if bull else -1) < 0 or abs(jarak) > MENUJU_MAKS):
                    continue
                d_ref = D["p"] if status != "menuju" else m["pusat"]
                acuan = C["p"] if m["pola"] == "cypher" else A["p"]
                # Stop: sedikit di balik X (Astronacci); pola yang D-nya melewati X memakai sisi luar PRZ (Maxco).
                if m["pola"] in ("butterfly", "crab"):
                    stop = lo if bull else hi
                else:
                    stop = X["p"]
                row = {"pola": m["pola"], "nama": POLA[m["pola"]]["nama"], "arah": "bullish" if bull else "bearish",
                       "status": status, "harga": akhir, "prz": [_bulat(lo), _bulat(hi)],
                       "jarak": round(abs(jarak), 1), "reaksi": round((akhir / D["p"] - 1) * 100, 1) if status == "berbalik" else None,
                       "rasio": m["rasio"], "skala": th,
                       "titik": [{"n": nm, "d": bars[x["i"]]["d"][:10], "p": _bulat(x["p"])}
                                 for nm, x in zip("XABC", (X, A, B, C))]
                       + ([{"n": "D", "d": bars[D["i"]]["d"][:10], "p": _bulat(D["p"])}] if status != "menuju" else []),
                       # Target Astronacci: retracement 0,382 lalu 0,618 kaki AD (Cypher: kaki CD).
                       "target": [_bulat(d_ref + (acuan - d_ref) * r) for r in (0.382, 0.618)],
                       # Target alternatif Maxco: titik C (konservatif) lalu titik A.
                       "targetCA": [_bulat(C["p"]), _bulat(A["p"])] if m["pola"] != "cypher" else None,
                       "stop": _bulat(stop),
                       "konfirmasi": konfirmasi(bars, rs, B, D, bull) if status != "menuju" else []}
                if m["pola"] in ("gartley", "bat") and (D["p"] < X["p"] if bull else D["p"] > X["p"]):
                    continue          # D melewati X: bukan Gartley/Bat
                kunci = (m["pola"], row["arah"], X["i"], A["i"])
                if kunci not in hasil:
                    hasil[kunci] = row
    urut = {"prz": 0, "berbalik": 1, "menuju": 2}
    return sorted(hasil.values(), key=lambda r: (urut[r["status"]], r["jarak"]))[:3]


def ringkas_pola() -> list[dict]:
    """Tabel rasio untuk tampilan (angka sesuai ilustrasi artikel sumber)."""
    out = []
    for k, p in POLA.items():
        out.append({"k": k, "nama": p["nama"], "ket": p["ket"], **{x: list(p[x]) for x in ("b", "c", "d", "bc", "cx", "dxc") if x in p}})
    return out
