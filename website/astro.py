"""Astronacci: siklus bulan (Financial Astrology) + Fibonacci harga & waktu untuk IHSG.

- Fase bulan (bulan baru, kuartal pertama, purnama, kuartal akhir) dihitung dengan algoritme Meeus
  (Astronomical Algorithms bab 49, suku koreksi utama; galat beberapa menit), dikonversi ke WIB.
- Fibonacci harga: retracement & ekstensi dari ayunan besar 1 tahun dan ayunan terakhir.
- Fibonacci waktu: hitungan 8, 13, 21, 34, 55, 89, 144 hari bursa dari titik balik utama.
- Jendela waktu: tanggal Fibonacci yang berdekatan (±2 hari bursa) dengan fase bulan utama.
- Uji historis 1 tahun: seberapa sering titik balik IHSG terjadi di sekitar bulan baru/purnama dibanding hari acak,
  dan rata-rata return 5 hari setelahnya. Hasilnya ditampilkan apa adanya (bisa tidak signifikan).
"""
from __future__ import annotations

import math
from datetime import date, datetime, timedelta, timezone

FASE = {0.0: "Bulan baru", 0.25: "Kuartal pertama", 0.5: "Purnama", 0.75: "Kuartal akhir"}
FIB_T = (8, 13, 21, 34, 55, 89, 144)
FIB_RET = (0.236, 0.382, 0.5, 0.618, 0.786)
FIB_EXT = (1.272, 1.618)
WIB = timezone(timedelta(hours=7))


def _jde_phase(k: float) -> float:
    """JDE fase bulan untuk k (bilangan bulat + 0/.25/.5/.75), Meeus bab 49."""
    T = k / 1236.85
    jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.00000015 * T ** 3
    E = 1 - 0.002516 * T - 0.0000074 * T * T
    r = math.radians
    M = r((2.5534 + 29.10535670 * k - 0.0000014 * T * T) % 360)
    Mp = r((201.5643 + 385.81693528 * k + 0.0107582 * T * T) % 360)
    F = r((160.7108 + 390.67050284 * k - 0.0016118 * T * T) % 360)
    Om = r((124.7746 - 1.56375588 * k + 0.0020672 * T * T) % 360)
    f = k % 1
    if f in (0.0, 0.5):
        a = (-0.40720, -0.40614) if f == 0 else (-0.40614, -0.40614)
        c = -0.40720 if f == 0 else -0.40614
        s1 = 0.17241 if f == 0 else 0.17302
        s2 = 0.01608 if f == 0 else 0.01614
        s3 = 0.01039 if f == 0 else 0.01043
        s4 = 0.00739 if f == 0 else 0.00734
        s5 = -0.00514 if f == 0 else -0.00515
        corr = (c * math.sin(Mp) + s1 * E * math.sin(M) + s2 * math.sin(2 * Mp) + s3 * math.sin(2 * F)
                + s4 * E * math.sin(Mp - M) + s5 * E * math.sin(Mp + M) + 0.00208 * E * E * math.sin(2 * M)
                - 0.00111 * math.sin(Mp - 2 * F) - 0.00057 * math.sin(Mp + 2 * F) + 0.00056 * E * math.sin(2 * Mp + M)
                - 0.00042 * math.sin(3 * Mp) + 0.00042 * E * math.sin(M + 2 * F) - 0.00017 * math.sin(Om))
        del a
    else:
        corr = (-0.62801 * math.sin(Mp) + 0.17172 * E * math.sin(M) - 0.01183 * E * math.sin(Mp + M)
                + 0.00862 * math.sin(2 * Mp) + 0.00804 * math.sin(2 * F) + 0.00454 * E * math.sin(Mp - M)
                + 0.00204 * E * E * math.sin(2 * M) - 0.00180 * math.sin(Mp - 2 * F) - 0.00070 * math.sin(Mp + 2 * F)
                - 0.00017 * math.sin(Om))
        W = 0.00306 - 0.00038 * E * math.cos(M) + 0.00026 * math.cos(Mp) - 0.00002 * math.cos(Mp - M) \
            + 0.00002 * math.cos(Mp + M) + 0.00002 * math.cos(2 * F)
        corr += W if f == 0.25 else -W
    return jde + corr


def _jd_to_wib(jd: float) -> datetime:
    # JDE ≈ JD (selisih TT-UT ~70 detik diabaikan pada resolusi harian).
    return (datetime(2000, 1, 1, 12, tzinfo=timezone.utc) + timedelta(days=jd - 2451545.0)).astimezone(WIB)


def moon_phases(start: date, end: date) -> list[dict]:
    """Seluruh fase bulan utama di antara start..end (WIB)."""
    k0 = math.floor((start.year + (start.timetuple().tm_yday - 1) / 365.25 - 2000) * 12.3685) - 1
    out = []
    k = k0
    while True:
        for f in (0.0, 0.25, 0.5, 0.75):
            t = _jd_to_wib(_jde_phase(k + f))
            if t.date() > end:
                return out
            if t.date() >= start:
                out.append({"tgl": t.strftime("%Y-%m-%d"), "jam": t.strftime("%H:%M"), "fase": FASE[f], "utama": f in (0.0, 0.5)})
        k += 1


def _trading_days_after(d: date, n: int) -> date:
    """Tanggal n hari bursa (Senin–Jumat) setelah d; libur bursa diabaikan (perkiraan)."""
    x = d
    while n > 0:
        x += timedelta(days=1)
        if x.weekday() < 5:
            n -= 1
    return x


def _pivots(c: list[float], w: int = 5) -> list[tuple[int, str]]:
    out = []
    for i in range(w, len(c) - w):
        seg = c[i - w:i + w + 1]
        if c[i] == max(seg):
            out.append((i, "puncak"))
        elif c[i] == min(seg):
            out.append((i, "lembah"))
    return out


def fib_levels(hi: float, lo: float, naik: bool) -> list[dict]:
    """Retracement & ekstensi. naik=True: ayunan lembah→puncak (retracement di bawah puncak)."""
    rng = hi - lo
    out = []
    for r in FIB_RET:
        out.append({"rasio": r, "jenis": "retracement", "v": round(hi - rng * r if naik else lo + rng * r)})
    for e in FIB_EXT:
        out.append({"rasio": e, "jenis": "ekstensi", "v": round(lo + rng * e if naik else hi - rng * e)})
    return out


def build(bars: list[dict], today: date | None = None) -> dict | None:
    bars = [b for b in bars if b.get("c")]
    if len(bars) < 120:
        return None
    today = today or datetime.now(WIB).date()
    c = [b["c"] for b in bars]
    d = [date.fromisoformat(b["d"][:10]) for b in bars]
    p0 = c[-1]

    # Ayunan besar 1 tahun & ayunan terakhir (60 hari).
    ih, il = max(range(len(c)), key=lambda i: bars[i]["h"]), min(range(len(c)), key=lambda i: bars[i]["l"])
    hi, lo = bars[ih]["h"], bars[il]["l"]
    naik_besar = il < ih
    r0 = len(c) - 60
    jh = max(range(r0, len(c)), key=lambda i: bars[i]["h"])
    jl = min(range(r0, len(c)), key=lambda i: bars[i]["l"])
    hi2, lo2 = bars[jh]["h"], bars[jl]["l"]
    naik_kini = jl < jh
    ayunan = [
        {"nama": "Ayunan besar 1 tahun", "dari": d[il if naik_besar else ih].isoformat(), "ke": d[ih if naik_besar else il].isoformat(),
         "tinggi": round(hi), "rendah": round(lo), "arah": "naik" if naik_besar else "turun", "level": fib_levels(hi, lo, naik_besar)},
        {"nama": "Ayunan terakhir (60 hari)", "dari": d[jl if naik_kini else jh].isoformat(), "ke": d[jh if naik_kini else jl].isoformat(),
         "tinggi": round(hi2), "rendah": round(lo2), "arah": "naik" if naik_kini else "turun", "level": fib_levels(hi2, lo2, naik_kini)},
    ]
    # Level terdekat di atas/bawah harga kini (gabungan dua ayunan).
    semua = sorted({x["v"] for a in ayunan for x in a["level"]})
    support = [v for v in semua if v < p0][-2:][::-1]
    resist = [v for v in semua if v > p0][:2]

    # Fibonacci waktu dari titik balik utama (puncak/lembah 1 tahun & ayunan terakhir).
    jangkar = {d[ih]: "puncak 1 tahun", d[il]: "lembah 1 tahun", d[jh]: "puncak 60 hari", d[jl]: "lembah 60 hari"}
    akhir = today + timedelta(days=75)
    fase = moon_phases(today - timedelta(days=3), akhir)
    utama = [date.fromisoformat(f["tgl"]) for f in fase if f["utama"]]
    waktu = []
    for a, nm in jangkar.items():
        for n in FIB_T:
            t = _trading_days_after(a, n)
            if today <= t <= akhir:
                dekat = min(utama, key=lambda u: abs((u - t).days)) if utama else None
                cocok = dekat is not None and abs((dekat - t).days) <= 3
                waktu.append({"tgl": t.isoformat(), "dari": nm, "hitungan": n, "bulan": dekat.isoformat() if cocok else None})
    waktu.sort(key=lambda x: x["tgl"])
    jendela = [w for w in waktu if w["bulan"]]

    # Uji historis: titik balik (pivot w=3) dalam ±2 hari bursa dari bulan baru/purnama vs peluang hari acak.
    hist = moon_phases(d[0], d[-1])
    idx = {x: i for i, x in enumerate(d)}

    def near_idx(t: date):
        for k in range(0, 4):
            for s in (t + timedelta(days=k), t - timedelta(days=k)):
                if s in idx:
                    return idx[s]
        return None
    piv = {i for i, _ in _pivots(c)}
    base_rate = len(piv) / max(1, len(c) - 6)
    rows = {}
    for f in hist:
        if not f["utama"]:
            continue
        i = near_idx(date.fromisoformat(f["tgl"]))
        if i is None or i < 3 or i + 5 >= len(c):
            continue
        r = rows.setdefault(f["fase"], {"n": 0, "balik": 0, "ret": []})
        r["n"] += 1
        r["balik"] += any(j in piv for j in range(i - 2, i + 3))
        r["ret"].append((c[i + 5] / c[i] - 1) * 100)
    # Peluang hari acak berada dalam ±2 hari dari titik balik = 1 - (1 - base)^5.
    acak = (1 - (1 - base_rate) ** 5) * 100
    uji = []
    for nm, r in rows.items():
        if not r["n"]:
            continue
        s = sorted(r["ret"])
        uji.append({"fase": nm, "n": r["n"], "balik": round(r["balik"] / r["n"] * 100), "acak": round(acak),
                    "ret5": round(sum(r["ret"]) / len(r["ret"]), 2), "naik5": round(sum(x > 0 for x in r["ret"]) / len(r["ret"]) * 100),
                    "median5": round(s[len(s) // 2], 2)})
    lebih = [u for u in uji if u["balik"] - u["acak"] >= 10 and u["n"] >= 8]
    kesimpulan = (
        "Dalam 1 tahun terakhir, titik balik IHSG di sekitar " + " dan ".join(u["fase"].lower() for u in lebih)
        + " lebih sering dari hari acak; jendela waktu di bawah layak dipantau sebagai konfirmasi, bukan sinyal tunggal."
        if lebih else
        "Dalam 1 tahun terakhir, titik balik IHSG di sekitar bulan baru/purnama tidak lebih sering dari hari acak "
        "(selisih < 10 poin persentase). Siklus bulan dipakai sebagai penanda waktu tambahan; keputusan tetap bertumpu pada level Fibonacci dan konfirmasi harga."
    )
    nxt = [f for f in fase if date.fromisoformat(f["tgl"]) >= today][:6]
    return {"tanggal": bars[-1]["d"], "harga": p0, "ayunan": ayunan, "support": support, "resistance": resist,
            "fase": nxt, "waktu": waktu[:14], "jendela": jendela[:8], "uji": uji, "acak": round(acak),
            "kesimpulan": kesimpulan,
            "catatan": "Fase bulan dihitung astronomis (Meeus, WIB). Hitungan hari bursa mengabaikan libur nasional, sehingga tanggal bisa bergeser 1–2 hari. "
                       "Financial astrology belum terbukti secara ilmiah; uji historis di atas ditampilkan agar keandalannya bisa dinilai sendiri."}
