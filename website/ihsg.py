"""Kondisi IHSG untuk Seasonality: tren & support/resistance (harga harian 1 tahun), sentimen berita pasar, dan
probabilitas pola musiman berulang berdasarkan kondisi tren yang sama di tahun-tahun lalu. Modul murni."""
from __future__ import annotations

import re
import statistics


def ema(xs: list[float], n: int) -> list[float]:
    k, out = 2 / (n + 1), []
    for i, x in enumerate(xs):
        out.append(x if i == 0 else x * k + out[-1] * (1 - k))
    return out


def pivots(bars: list[dict], w: int = 5) -> tuple[list[float], list[float]]:
    lows, highs = [], []
    for i in range(w, len(bars) - w):
        seg = bars[i - w:i + w + 1]
        if bars[i]["l"] == min(b["l"] for b in seg):
            lows.append(bars[i]["l"])
        if bars[i]["h"] == max(b["h"] for b in seg):
            highs.append(bars[i]["h"])
    return lows, highs


def cluster(levels: list[float], tol: float = 0.015) -> list[dict]:
    """Gabungkan titik balik yang berdekatan (selisih <= 1,5%) menjadi satu level beserta jumlah sentuhan."""
    out: list[dict] = []
    for v in sorted(levels):
        if out and abs(v / out[-1]["v"] - 1) <= tol:
            c = out[-1]; c["n"] += 1; c["v"] = c["v"] + (v - c["v"]) / c["n"]
        else:
            out.append({"v": v, "n": 1})
    return out


def technical(bars: list[dict]) -> dict | None:
    """Tren (harga vs EMA50/EMA200 dan kemiringan EMA50), support/resistance terdekat, dan rekomendasi teknikal."""
    if len(bars) < 60:
        return None
    c = [b["c"] for b in bars]
    e20, e50, e200 = ema(c, 20), ema(c, 50), ema(c, 200)
    p = c[-1]
    slope = (e50[-1] / e50[-11] - 1) * 100 if len(e50) > 11 else 0
    if p > e50[-1] > e200[-1] and slope > 0:
        tren, nada = "Uptrend", "good"
    elif p < e50[-1] < e200[-1] and slope < 0:
        tren, nada = "Downtrend", "bad"
    else:
        tren, nada = "Sideways", "warn"
    lows, highs = pivots(bars[-140:])
    sup = sorted([x for x in cluster(lows) if x["v"] < p], key=lambda x: -x["v"])[:2]
    res = sorted([x for x in cluster(highs) if x["v"] > p], key=lambda x: x["v"])[:2]
    s1 = sup[0]["v"] if sup else min(b["l"] for b in bars[-60:])
    r1 = res[0]["v"] if res else max(b["h"] for b in bars[-60:])
    jarakS, jarakR = (p / s1 - 1) * 100, (r1 / p - 1) * 100
    if tren == "Uptrend":
        rek = "Buy on weakness: tren naik; cicil beli mendekati support, batas risiko di bawah support." if jarakS <= 2.5 \
            else "Ikuti tren dengan disiplin: tunggu koreksi ke support atau tembus resistance untuk menambah posisi."
    elif tren == "Downtrend":
        rek = "Wait and see: tren turun; kurangi eksposur, tunggu harga kembali di atas EMA50 atau tembus resistance sebelum agresif."
    else:
        rek = "Trading range: beli dekat support, ambil untung dekat resistance; tunggu tembus salah satu untuk arah baru."
    return {
        "harga": p, "tanggal": bars[-1]["d"], "tren": tren, "nada": nada, "ema20": round(e20[-1], 1), "ema50": round(e50[-1], 1),
        "ema200": round(e200[-1], 1), "slope50": round(slope, 2),
        "support": [{"v": round(x["v"], 1), "n": x["n"]} for x in sup], "resistance": [{"v": round(x["v"], 1), "n": x["n"]} for x in res],
        "jarakSupport": round(jarakS, 1), "jarakResistance": round(jarakR, 1), "rekomendasi": rek,
        "tinggi52": max(b["h"] for b in bars[-250:]), "rendah52": min(b["l"] for b in bars[-250:]),
        # Seri ringkas untuk grafik (tutup + EMA), maks. 260 titik.
        "seri": [{"d": b["d"], "c": b["c"], "e50": round(e50[i], 1), "e200": round(e200[i], 1)} for i, b in enumerate(bars)][-260:],
    }


# Kata kunci sentimen pasar (judul berita). Netral bila tidak ada atau seimbang.
POS = r"menguat|naik|rebound|reli|rally|hijau|net buy|inflow|asing (borong|beli)|suku bunga (turun|dipangkas)|rate cut|stimulus|" \
      r"surplus|investment grade|upgrade|cetak rekor|all time high|ath|optimis|positif|membaik|pemangkasan bunga|dovish"
NEG = r"melemah|turun|merosot|anjlok|ambles|longsor|merah|net sell|outflow|asing (lepas|jual|kabur)|suku bunga naik|hawkish|" \
      r"defisit|downgrade|resesi|perang|konflik|krisis|tekanan|pesimis|negatif|ancaman|standalone|frontier|gagal bayar|inflasi naik|phk"


def sentiment(posts: list[dict], limit: int = 6) -> dict:
    pos, neg = [], []
    for p in posts:
        t = re.sub(r"\s+", " ", str(p.get("title") or "")).strip()
        lo = t.lower()
        a, b = len(re.findall(POS, lo)), len(re.findall(NEG, lo))
        if a == b:
            continue
        (pos if a > b else neg).append({"d": p.get("d"), "judul": t[:160], "url": p.get("url")})
    n = len(pos) + len(neg)
    skor = round((len(pos) - len(neg)) / n * 100) if n else 0
    return {"positif": pos[:limit], "negatif": neg[:limit], "nPos": len(pos), "nNeg": len(neg), "skor": skor,
            "arah": "positif" if skor >= 20 else "negatif" if skor <= -20 else "netral"}


def monthly_levels(series: dict) -> list[tuple[int, int, float]]:
    """Indeks bulanan relatif dari return % (tahun, bulan, level), urut waktu."""
    lv, out = 100.0, []
    for y in sorted(series, key=int):
        for m in sorted(series[y], key=int):
            lv *= 1 + series[y][m] / 100
            out.append((int(y), int(m), lv))
    return out


def conditional(series: dict, month: int, state_now: str, years: int = 10) -> dict:
    """Peluang IHSG naik pada `month` di tahun-tahun ketika kondisi tren akhir bulan sebelumnya sama dengan sekarang.
    Kondisi tren bulanan: level di atas/bawah rata-rata 10 bulan (SMA10), padanan EMA200 harian."""
    lv = monthly_levels(series)
    idx = {(y, m): i for i, (y, m, _) in enumerate(lv)}
    hits = []
    for (y, m), i in idx.items():
        if m != month or i < 11:
            continue
        prev = lv[i - 1][2]
        sma = statistics.mean(x[2] for x in lv[i - 11:i - 1])
        st = "atas" if prev > sma else "bawah"
        hits.append({"tahun": y, "kondisi": st, "ret": round(lv[i][2] / prev * 100 - 100, 2)})
    sama = [h for h in hits if h["kondisi"] == state_now]
    up = sum(1 for h in sama if h["ret"] > 0)
    # Semua bulan dengan kondisi yang sama (sampel lebih besar) sebagai pembanding.
    allm = []
    for i in range(11, len(lv)):
        prev, sma = lv[i - 1][2], statistics.mean(x[2] for x in lv[i - 11:i - 1])
        if ("atas" if prev > sma else "bawah") == state_now:
            allm.append(lv[i][2] > prev)
    return {"kondisi": state_now, "n": len(sama), "up": up, "prob": round(up / len(sama) * 100) if sama else None,
            "tahun": sama, "semuaBulanN": len(allm), "semuaBulanProb": round(sum(allm) / len(allm) * 100) if allm else None}


def verdict(base: dict | None, cond: dict, sent: dict) -> dict:
    """Probabilitas pola berulang: rata-rata tertimbang peluang musiman (bobot 0,5), peluang pada kondisi tren yang
    sama (0,3; bila sampel >= 3), dan arah sentimen (0,2: positif 65, netral 50, negatif 35)."""
    parts = []
    if base and base.get("prob") is not None:
        parts.append((base["prob"], 0.5, "pola musiman"))
    if cond.get("prob") is not None and cond.get("n", 0) >= 3:
        parts.append((cond["prob"], 0.3, "kondisi tren sama"))
    parts.append(({"positif": 65, "netral": 50, "negatif": 35}[sent["arah"]], 0.2, "sentimen"))
    w = sum(p[1] for p in parts)
    prob = round(sum(p[0] * p[1] for p in parts) / w)
    label = "Tinggi" if prob >= 60 else "Sedang" if prob >= 45 else "Rendah"
    return {"prob": prob, "label": label, "komponen": [{"nama": n, "nilai": v, "bobot": b} for v, b, n in parts]}


def pattern(bars: list[dict], w: int = 5) -> dict:
    """Struktur harga dari titik balik 140 hari terakhir: higher high / lower low dan double bottom/top
    (dua titik balik berselisih <= 3%, berjarak >= 10 hari bursa; neckline = titik ekstrem di antaranya)."""
    b = bars[-140:]
    lo = [(i, x["l"]) for i, x in enumerate(b) if w <= i < len(b) - w and x["l"] == min(y["l"] for y in b[i - w:i + w + 1])]
    hi = [(i, x["h"]) for i, x in enumerate(b) if w <= i < len(b) - w and x["h"] == max(y["h"] for y in b[i - w:i + w + 1])]
    out = {"hh": hi[-1][1] > hi[-2][1] if len(hi) >= 2 else None, "ll": lo[-1][1] < lo[-2][1] if len(lo) >= 2 else None, "pola": None}
    p = b[-1]["c"]
    if len(lo) >= 2:
        (i1, a), (i2, c) = lo[-2], lo[-1]
        if i2 - i1 >= 10 and abs(c / a - 1) <= 0.03:
            neck = max(x["h"] for x in b[i1:i2 + 1])
            out["pola"] = {"jenis": "double bottom", "dasar": round(min(a, c), 1), "neckline": round(neck, 1),
                           "status": "sudah break neckline" if p > neck else "menunggu break neckline"}
    if not out["pola"] and len(hi) >= 2:
        (i1, a), (i2, c) = hi[-2], hi[-1]
        if i2 - i1 >= 10 and abs(c / a - 1) <= 0.03:
            neck = min(x["l"] for x in b[i1:i2 + 1])
            out["pola"] = {"jenis": "double top", "puncak": round(max(a, c), 1), "neckline": round(neck, 1),
                           "status": "sudah break neckline ke bawah" if p < neck else "menunggu konfirmasi"}
    return out


def _n(v: float) -> str:
    return f"{v:,.0f}".replace(",", ".")


def _rp(v: float) -> str:
    a = abs(v)
    s = f"Rp{a / 1e12:,.2f} T" if a >= 1e12 else f"Rp{a / 1e9:,.1f} M"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def narrative(tek: dict, pat: dict, flow: dict | None, berulang: dict, nama_bulan: str) -> dict:
    """Narasi Analisa Teknikal & Flow IHSG gaya riset (struktur, flow, rencana) + level area beli/target/risiko."""
    p, sup, res = tek["harga"], tek.get("support") or [], tek.get("resistance") or []
    s1 = sup[0]["v"] if sup else tek["rendah52"]
    s2 = sup[1]["v"] if len(sup) > 1 else s1 * 0.97
    r1 = res[0]["v"] if res else tek["tinggi52"]
    r2 = res[1]["v"] if len(res) > 1 else r1 * 1.03
    st = [f"IHSG secara struktur berada dalam fase {tek['tren'].lower()}: harga {_n(p)} {'di atas' if p > tek['ema50'] else 'di bawah'} "
          f"EMA50 ({_n(tek['ema50'])}) dan {'di atas' if p > tek['ema200'] else 'di bawah'} EMA200 ({_n(tek['ema200'])})."]
    if pat.get("hh") is not None and pat.get("ll") is not None:
        st.append("Titik balik terakhir membentuk " + ("higher high" if pat["hh"] else "lower high") + " dan "
                  + ("lower low" if pat["ll"] else "higher low") + ".")
    pl = pat.get("pola")
    if pl and pl["jenis"] == "double bottom":
        st.append(f"Terbentuk pola double bottom dengan dasar di area {_n(pl['dasar'])} dan neckline di {_n(pl['neckline'])} ({pl['status']}).")
    elif pl:
        st.append(f"Terbentuk pola double top dengan puncak di area {_n(pl['puncak'])} dan neckline di {_n(pl['neckline'])} ({pl['status']}).")
    st.append(f"Support terdekat di {_n(s1)} dan resistance terdekat di {_n(r1)}.")
    fl = []
    if flow:
        fl.append(f"Secara flow bulan {flow['bulanNama']} (s.d. {flow['sampai']}), broker asing tercatat {'net buy' if flow['asing'] > 0 else 'net sell'} "
                  f"{_rp(flow['asing'])} dan broker domestik {'net buy' if flow['domestik'] > 0 else 'net sell'} {_rp(flow['domestik'])} pada saham-saham teraktif.")
        if flow.get("brokerAsing"):
            fl.append("Broker asing terbesar: " + ", ".join(f"{b['kode']} {'net buy' if b['net'] > 0 else 'net sell'} {_rp(b['net'])}" for b in flow["brokerAsing"]) + ".")
        ak = [x for x in flow.get("sahamAsing") or [] if x.get("avg")]
        if ak:
            fl.append("Saham yang paling diakumulasi asing: " + ", ".join(f"{x['s']} ({_rp(x['net'])} di average {_n(x['avg'])})" for x in ak) + ".")
        if flow.get("sahamJualAsing"):
            fl.append("Distribusi asing terbesar di " + ", ".join(f"{x['s']} ({_rp(x['net'])})" for x in flow["sahamJualAsing"]) + ".")
    beli = [round(s1), round(s1 * 1.01)]
    # Batas risiko: support kedua bila dekat (<= 3% di bawah support pertama), selain itu 1,5% di bawah support pertama.
    risiko = round(s2) if s2 >= s1 * 0.97 else round(s1 * 0.985)
    if tek["tren"] == "Downtrend":
        rk = (f"Selama IHSG belum kembali di atas EMA50 ({_n(tek['ema50'])}), strategi yang disarankan adalah wait and see atau beli bertahap "
              f"dengan porsi kecil di area support {_n(beli[0])}–{_n(beli[1])}. Target pemulihan ke {_n(r1)} lalu {_n(r2)}; "
              f"risiko dijaga bila penutupan harian di bawah {_n(risiko)}.")
    elif tek["tren"] == "Uptrend":
        rk = (f"Tren naik masih valid selama IHSG bertahan di atas {_n(s1)}. Akumulasi saat koreksi ke {_n(beli[0])}–{_n(beli[1])} "
              f"dengan target {_n(r1)} lalu {_n(r2)}; risiko dijaga bila penutupan harian di bawah {_n(risiko)}.")
    else:
        rk = (f"IHSG bergerak dalam rentang {_n(s1)}–{_n(r1)}: beli dekat support {_n(beli[0])}–{_n(beli[1])}, ambil untung dekat {_n(r1)}; "
              f"tembus {_n(r1)} membuka ruang ke {_n(r2)}. Risiko dijaga bila penutupan harian di bawah {_n(risiko)}.")
    rk += f" Probabilitas pola {nama_bulan} berulang: {berulang['prob']}% ({berulang['label'].lower()})."
    return {"struktur": " ".join(st), "flow": " ".join(fl), "rencana": rk,
            "level": {"beli": beli, "target": [round(r1), round(r2)], "risiko": risiko}}
