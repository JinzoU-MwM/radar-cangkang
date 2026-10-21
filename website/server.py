#!/usr/bin/env python3
"""Server lokal + proxy Stockbit untuk Radar Cangkang (pemakaian pribadi).

Penggati serve.ps1: port Python stdlib murni (tanpa dependensi eksternal),
concurrency beneran (ThreadingHTTPServer), cache SQLite, fallback halaman publik.

Jalankan:
  python3 server.py            # hanya komputer ini (localhost)
  python3 server.py --lan      # terbuka untuk jaringan lokal (LAN/Tailscale)
  python3 server.py --port 8765

Token Stockbit dibaca dari env STOCKBIT_TOKEN atau file .stockbit-token di folder ini.
Token hanya dipakai server ini untuk memanggil Stockbit; tidak pernah dikirim ke browser.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import ipaddress
import html as html_mod
import json
import os
import re
import sqlite3
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "stockbit.config.json"
TOKEN_PATH = ROOT / ".stockbit-token"
CACHE_DB = ROOT / ".cache.sqlite"
DIST = ROOT / "dist"
CGNAT = ipaddress.ip_network("100.64.0.0/10")

UA_BROWSER = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
UA_PAGE = "Mozilla/5.0 RadarCangkang/1.0"

# ---------------------------------------------------------------- token ----

def read_token(path: Path) -> str | None:
    if not path.exists():
        return None
    try:
        # utf-8-sig: file token dari aplikasi lain (mis. trade-platform) bisa diawali BOM.
        for line in path.read_text(encoding="utf-8-sig", errors="replace").splitlines():
            s = line.strip()
            if s and not s.startswith("#"):
                return re.sub(r"(?i)^bearer\s+", "", s)
    except OSError:
        pass
    return None


def get_token() -> str | None:
    t = os.environ.get("STOCKBIT_TOKEN")
    return t or read_token(TOKEN_PATH)


def token_exp() -> int | None:
    t = get_token()
    if not t or "." not in t:
        return None
    try:
        p = t.split(".")[1]
        payload = json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)))
        return int(payload["exp"]) if payload.get("exp") else None
    except Exception:
        return None

# ---------------------------------------------------------------- cache ----
# Respons Stockbit dan sumber berita disimpan di .cache.sqlite sehingga semua
# perangkat memakai salinan yang sama; Stockbit hanya dipanggil saat kedaluwarsa.

_db_lock = threading.Lock()
_db: sqlite3.Connection | None = None


def db() -> sqlite3.Connection | None:
    global _db
    with _db_lock:
        if _db is None:
            try:
                _db = sqlite3.connect(CACHE_DB, check_same_thread=False)
                _db.execute("PRAGMA journal_mode=WAL")
                _db.execute("CREATE TABLE IF NOT EXISTS http_cache("
                            "url TEXT PRIMARY KEY, body TEXT NOT NULL, fetched_at INTEGER NOT NULL)")
                _db.commit()
            except sqlite3.Error as e:
                print(f"[cache] SQLite tidak tersedia, server jalan tanpa cache: {e}", file=sys.stderr)
                _db = None if _db is None else _db
        return _db


def market_open() -> bool:
    n = datetime.now()
    if n.weekday() >= 5:
        return False
    return 8 * 60 + 45 <= n.hour * 60 + n.minute <= 16 * 60 + 15


def cache_ttl(url: str) -> int:
    # Data yang jarang berubah (profil, kepemilikan, aksi korporasi) disimpan setengah hari;
    # harga/candle 10 menit saat bursa buka dan sampai sesi berikutnya saat tutup.
    if re.search(r"corpaction|tenderoffer|majorholder|emitten|profile|keystats|financial|shareholding", url):
        return 12 * 3600
    if "/stream/" in url:
        return 60 * 60
    if "timeframe=3y" in url:
        # Deret 3 tahun untuk siklus/benchmark: candle hari ini tidak mengubah polanya.
        return 12 * 3600
    if re.search(r"stockbit\.com/symbol/|chartbit|/charts/|prices|orderbook|running|marketdetector", url):
        return 10 * 60 if market_open() else 12 * 3600
    return 60 * 60


# Statistik pemakaian Stockbit (1 jam terakhir) untuk /api/status.
FRESH_MIN_AGE = 5 * 60  # fresh=1 tidak memanggil ulang salinan yang umurnya < 5 menit
FAIL_BACKOFF = 5 * 60   # jeda setelah panggilan gagal sebelum mencoba Stockbit lagi
_fail_until: dict[str, int] = {}
_stats_lock = threading.Lock()
_upstream: list[float] = []
_upstream_n = 0  # total panggilan Stockbit sejak server jalan (tidak berkurang)
_hits: list[float] = []


def _stat(bucket: list[float]) -> None:
    now = time.time()
    with _stats_lock:
        bucket.append(now)
        while bucket and bucket[0] < now - 3600:
            bucket.pop(0)


def stats_1h() -> dict:
    now = time.time()
    with _stats_lock:
        return {"upstream": sum(1 for t in _upstream if t >= now - 3600),
                "cacheHits": sum(1 for t in _hits if t >= now - 3600)}


def cache_read(url: str, min_time: int) -> str | None:
    con = db()
    if not con:
        return None
    with _db_lock:
        row = con.execute("SELECT body FROM http_cache WHERE url=? AND fetched_at>=?",
                          (url, min_time)).fetchone()
    return row[0] if row else None


def cache_write(url: str, body: str) -> None:
    con = db()
    if not con:
        return
    with _db_lock:
        con.execute("INSERT OR REPLACE INTO http_cache VALUES(?,?,?)",
                    (url, body, int(time.time())))
        con.commit()


# ----------------------------------------------------------------- data ----
# Data radar tim (item, update, posisi node diagram). Terpisah dari cache supaya
# .cache.sqlite boleh dihapus tanpa kehilangan catatan tim.

DATA_DB = ROOT / ".radar.sqlite"
TICKER_RE = re.compile(r"^[A-Z]{4}$")
MAX_BODY = 8_000_000
_data_lock = threading.Lock()
_data: sqlite3.Connection | None = None


def data_db() -> sqlite3.Connection:
    global _data
    with _data_lock:
        if _data is None:
            _data = sqlite3.connect(DATA_DB, check_same_thread=False)
            _data.execute("PRAGMA journal_mode=WAL")
            _data.executescript(
                "CREATE TABLE IF NOT EXISTS items(ticker TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL);"
                "CREATE TABLE IF NOT EXISTS updates(id TEXT PRIMARY KEY, data TEXT NOT NULL, date TEXT);"
                "CREATE TABLE IF NOT EXISTS layout(ticker TEXT PRIMARY KEY, data TEXT NOT NULL);"
                "CREATE TABLE IF NOT EXISTS kandidat_hidden(ticker TEXT PRIMARY KEY, hidden_at INTEGER NOT NULL);"
                "CREATE TABLE IF NOT EXISTS snapshots(day TEXT NOT NULL, ticker TEXT NOT NULL, taken_at INTEGER NOT NULL,"
                " data TEXT NOT NULL, PRIMARY KEY(day, ticker));")
            _data.commit()
        return _data


def data_rows(sql: str, args: tuple = ()) -> list:
    con = data_db()
    with _data_lock:
        return con.execute(sql, args).fetchall()


def data_exec(sql: str, rows: list[tuple]) -> None:
    con = data_db()
    with _data_lock:
        con.executemany(sql, rows)
        con.commit()


def items_all() -> list[dict]:
    return [json.loads(r[0]) for r in data_rows("SELECT data FROM items ORDER BY ticker")]


def item_put(item: dict) -> None:
    data_exec("INSERT OR REPLACE INTO items VALUES(?,?,?)",
              [(item["ticker"], json.dumps(item, ensure_ascii=False), int(time.time()))])


def updates_all() -> list[dict]:
    return [json.loads(r[0]) for r in data_rows("SELECT data FROM updates ORDER BY date DESC")]


def updates_put(ups: list[dict]) -> None:
    data_exec("INSERT OR REPLACE INTO updates VALUES(?,?,?)",
              [(str(u["id"]), json.dumps(u, ensure_ascii=False), str(u.get("date") or "")) for u in ups])


def valid_item(it) -> bool:
    return isinstance(it, dict) and isinstance(it.get("ticker"), str) and bool(TICKER_RE.match(it["ticker"]))


def valid_update(u) -> bool:
    return isinstance(u, dict) and isinstance(u.get("id"), (str, int)) and str(u["id"]) != ""


def migrate(payload: dict) -> dict:
    """Impor data localStorage lama. Hanya berjalan bila tabel items masih kosong,
    supaya perangkat kedua tidak menimpa data tim."""
    if data_rows("SELECT 1 FROM items LIMIT 1"):
        return {"migrated": False, "reason": "sudah ada data di server"}
    items = [it for it in (payload.get("items") or []) if valid_item(it)]
    ups = [u for u in (payload.get("updates") or []) if valid_update(u)]
    for it in items:
        item_put(it)
    if ups:
        updates_put(ups)
    return {"migrated": True, "items": len(items), "updates": len(ups)}


class Stale(Exception):
    """Dibangkitkan fetch untuk menandakan salinan lama boleh dipakai."""


class PublicNoCache(Exception):
    """Pengunjung publik meminta data yang belum ada di cache."""


# Pengunjung lewat domain publik (Cloudflare Tunnel) hanya boleh membaca cache:
# tidak memanggil Stockbit/sumber berita dan tidak menulis data tim.
_req = threading.local()


def is_public_request() -> bool:
    return getattr(_req, "public", False)


def cached_text(url: str, fetch, fresh: bool = False) -> str:
    """Ambil dari cache bila segar; bila tidak, jalankan fetch lalu simpan.
    Bila fetch gagal, salinan lama dipakai daripada error."""
    now = int(time.time())
    if is_public_request():
        hit = cache_read(url, 0)
        if hit is None:
            raise PublicNoCache("Data ini belum tersedia di versi publik.")
        _stat(_hits)
        return hit
    # fresh=1 (tombol "Perbarui") tetap memakai salinan yang baru diambil < 5 menit lalu,
    # supaya klik berulang atau beberapa perangkat sekaligus tidak memanggil Stockbit lagi.
    hit = cache_read(url, now - (FRESH_MIN_AGE if fresh else cache_ttl(url)))
    if hit is None and _fail_until.get(url, 0) > now:
        # Baru saja gagal (mis. token kedaluwarsa): jangan ulangi selama jeda, pakai salinan lama.
        hit = cache_read(url, 0)
    if hit is not None:
        _stat(_hits)
        return hit
    global _upstream_n
    try:
        _stat(_upstream)
        _upstream_n += 1
        body = fetch()
    except Exception as e:
        _fail_until[url] = now + FAIL_BACKOFF
        old = cache_read(url, 0)
        if old is not None:
            print(f"[cache] basi dipakai ({e}): {url}", file=sys.stderr)
            return old
        raise
    _fail_until.pop(url, None)
    cache_write(url, body)
    return body

# ------------------------------------------------------------- http util ----

_inflight: dict[str, threading.Lock] = {}
_inflight_lock = threading.Lock()


def http_get(url: str, headers: dict, timeout: int = 20) -> str:
    """GET dengan dedup in-flight: request identik paralel menunggu satu fetch."""
    with _inflight_lock:
        lock = _inflight.setdefault(url, threading.Lock())
    with lock:
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode("utf-8", "replace")
        finally:
            with _inflight_lock:
                if _inflight.get(url) is lock and not lock.locked():
                    _inflight.pop(url, None)


def http_get_api(url: str, token: str) -> str:
    return http_get(url, {
        "Authorization": f"Bearer {token}", "Accept": "application/json",
        "Origin": "https://stockbit.com", "Referer": "https://stockbit.com/",
        "User-Agent": UA_BROWSER,
    }, timeout=15)

# ----------------------------------------------------------- stockbit API ----


def page_props(ticker: str, fresh: bool = False) -> dict:
    """__NEXT_DATA__ dari halaman publik stockbit.com/symbol/XXXX (tanpa token)."""
    url = f"https://stockbit.com/symbol/{ticker}"
    raw = cached_text(url, lambda: http_get(url, {"User-Agent": UA_PAGE}), fresh)
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', raw, re.S)
    if not m:
        raise RuntimeError("Format halaman Stockbit berubah (__NEXT_DATA__ tidak ditemukan).")
    return json.loads(m.group(1))["props"]["pageProps"]


def page_quote(ticker: str, fresh: bool = False) -> dict:
    """Quote tanpa token dari halaman publik; bentuk sama dengan jalur API."""
    co = page_props(ticker, fresh).get("company", {})

    def numv(v):
        try:
            return float(v) if v not in ("", None) else None
        except (TypeError, ValueError):
            return None

    price = numv(co.get("lastprice")) or numv(co.get("price"))
    return {
        "ticker": ticker, "name": co.get("name") or "", "price": price, "mcap": None,
        "float": None, "uma": co.get("uma") is True,
        "corpAction": (co.get("corp_action") or {}).get("active") is True,
        "volume": numv(co.get("volume")), "avgVolume": numv(co.get("average")),
        "change": numv(co.get("change")), "pctChange": numv(co.get("percentage_change")),
        "pageFallback": True,
    }


class NoToken(Exception):
    pass


class Upstream401(Exception):
    pass


def stockbit_api(full_url: str, fresh: bool = False) -> dict:
    """Panggil endpoint API Stockbit dengan token Bearer; JSON kembali."""
    token = get_token()
    if not token:
        raise NoToken()
    if fresh or token_expired():
        # Token kedaluwarsa: coba dulu (server mungkin menerima), gagal → fallback lewat Stale.
        pass
    text = cached_text(full_url, lambda: http_get_api(full_url, token), fresh)
    return json.loads(text)


def token_expired() -> bool:
    exp = token_exp()
    return bool(exp and exp < time.time())

# ------------------------------------------------------------- kategori ----


def news_type(title: str) -> str:
    t = title.lower()
    if re.search(r"tender|\bmto\b", t):
        return "tender"
    if re.search(r"pengalihan saham|pengambilalihan|pengendali|akuisisi|akusisi|acquisition|caplok|negosiasi|backdoor", t):
        return "pengendali"
    if re.search(r"hmetd|hak memesan|rights issue|penambahan modal|private placement|inbreng", t):
        return "rights"
    if re.search(r"rups|rapat umum", t):
        return "rupslb"
    if re.search(r"\buma\b|suspensi|penghentian sementara|unusual|volatilitas", t):
        return "uma"
    return "lainnya"


def clean_text(s: str) -> str:
    s = re.sub(r"<!\[CDATA\[|\]\]>", "", s or "")
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"\s+", " ", s)
    return html_mod.unescape(s).strip()


def source_articles(src: dict) -> list[dict]:
    url = src["url"]
    raw = cached_text(url, lambda: http_get(url, {"User-Agent": UA_BROWSER}, 15))
    out = []
    if src.get("type") == "rss":
        for m in re.finditer(r"<item>([\s\S]*?)</item>", raw):
            x = m.group(1)
            title = clean_text(re.search(r"<title>([\s\S]*?)</title>", x).group(1)) \
                if re.search(r"<title>([\s\S]*?)</title>", x) else ""
            link_m = re.search(r"<link>([\s\S]*?)</link>", x)
            desc_m = re.search(r"<description>([\s\S]*?)</description>", x)
            pub_m = re.search(r"<pubDate>([\s\S]*?)</pubDate>", x)
            date = None
            if pub_m and pub_m.group(1).strip():
                try:
                    from email.utils import parsedate_to_datetime
                    date = parsedate_to_datetime(pub_m.group(1).strip()).astimezone().strftime("%Y-%m-%d")
                except Exception:
                    pass
            if title and link_m:
                out.append({"title": title, "url": clean_text(link_m.group(1)),
                            "desc": clean_text(desc_m.group(1)) if desc_m else "", "date": date})
    else:
        seen = set()
        pat = re.compile(src.get("pattern", r"$^"))
        for m in re.finditer(r'<a\b([^>]*?)href="([^"#]+)"([^>]*)>([\s\S]{0,2500}?)</a>', raw):
            href = m.group(2)
            if not pat.search(href) or href in seen:
                continue
            inner = m.group(4)
            alt = re.search(r'\balt="([^"]{20,})"', inner)
            title = clean_text(alt.group(1)) if alt else clean_text(inner)
            if not (25 <= len(title) <= 250):
                continue
            seen.add(href)
            out.append({"title": title, "url": href, "desc": "", "date": None})
    return out


def get_news(cfg_news: dict, tickers: list[str], fresh: bool = False) -> dict:
    kw = cfg_news.get("keywords", r"$^")
    items, errors = [], []
    tick_re = (re.compile(
        r"Tbk\.?\s*\((" + "|".join(tickers) + r")\)|\b(?:saham|emiten|kode|perseroan)\s+("
        + "|".join(tickers) + r")\b|\b(" + "|".join(tickers) + r")\s+Tbk\b", re.I)
        if tickers else None)
    today = datetime.now().strftime("%Y-%m-%d")
    for src in cfg_news.get("sources", []):
        try:
            for a in source_articles(src):
                text = f"{a['title']} {a['desc']}"
                hit = ""
                if tick_re and (m := tick_re.search(text)):
                    hit = next(g for g in m.groups() if g).upper()
                if not (re.search(kw, text, re.I) or hit):
                    continue
                if not hit:
                    m = re.search(r"\(([A-Z]{4})\)", a["title"])
                    hit = m.group(1) if m else ""
                nid = hashlib.md5(a["url"].encode()).hexdigest()[:16]
                desc = a["desc"] or ""
                items.append({
                    "id": f"news-{nid}", "date": a["date"] or today, "ticker": hit,
                    "type": news_type(a["title"]), "title": a["title"],
                    "summary": desc[:300] if len(desc) > 20 else "",
                    "source": src["name"], "url": a["url"],
                })
        except Exception as e:
            code = f"HTTP {getattr(getattr(e, 'reason', None), 'code', '')}" if isinstance(e, urllib.error.URLError) else str(e)
            errors.append({"source": src["name"], "error": code})
    return {"items": items, "errors": errors}

# ------------------------------------------------ data profil & skeleton ----

SB = "https://exodus.stockbit.com"


def get_by_path(obj, path: str):
    cur = obj
    for seg in path.split("."):
        if cur is None:
            return None
        cur = cur[int(seg)] if isinstance(cur, list) and seg.isdigit() else \
            (cur.get(seg) if isinstance(cur, dict) else None)
    return cur


def to_num(s):
    if s is None or str(s).strip() in ("-", "", "None"):
        return None
    s = str(s)
    neg = bool(re.match(r"^\(.*\)$", s)) or s.strip().startswith("-")
    m = re.search(r"([\d.,]+)\s*([KMBT])?", s)
    if not m:
        return None
    v = float(m.group(1).replace(",", ""))
    v *= {"K": 1e3, "M": 1e6, "B": 1e9, "T": 1e12}.get(m.group(2) or "", 1)
    return -v if neg else v


def sb_fetch(path: str, fresh: bool = False) -> dict:
    return stockbit_api(SB + path, fresh)


def insider_moves(ticker: str, max_pages: int = 8, fresh: bool = False) -> list[dict]:
    out = []
    for pg in range(1, max_pages + 1):
        j = sb_fetch(f"/insider/company/majorholder?symbol={ticker}&page={pg}", fresh)
        out += j.get("data", {}).get("movement") or []
        if not j.get("data", {}).get("is_more"):
            break
        time.sleep(0.2)
    return out


def norm_name(s: str) -> str:
    s = re.sub(r"\b(PT|TBK|LTD|PTE|LIMITED|INC)\b", "", (s or "").upper())
    return re.sub(r"[^A-Z0-9]", "", s)


def parse_pct(s) -> float:
    return float(re.sub(r"[^\d.]", "", str(s)) or 0)


def parse_date_ddmmyy(s):
    for fmt in ("%d %b %y", "%d %B %y"):
        try:
            return datetime.strptime(str(s).strip(), fmt)
        except ValueError:
            continue
    return None


def get_profile(ticker: str, fresh: bool = False) -> dict:
    p = sb_fetch(f"/emitten/{ticker}/profile", fresh).get("data", {})
    k = sb_fetch(f"/keystats/ratio/v1/{ticker}?year_limit=10", fresh).get("data", {})
    kv = {}
    for g in k.get("closure_fin_items_results") or []:
        for f in g.get("fin_name_results") or []:
            fi = f.get("fitem") or {}
            kv[fi.get("name") or ""] = fi.get("value")
    year_ago = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")
    prices = [x for x in chart_prices(ticker, fresh) if x["d"] >= year_ago]
    step = max(1, len(prices) // 60)
    chart = prices[::step] + prices[-1:]
    ke = p.get("key_executive") or {}
    stats = k.get("stats") or {}
    return {
        "ticker": ticker,
        "background": re.sub(r"\s+", " ", str(p.get("background") or "")).strip(),
        "sector": (p.get("classification") or {}).get("sector", {}).get("name", ""),
        "subSector": (p.get("classification") or {}).get("sub_sector", {}).get("name", ""),
        "industry": (p.get("classification") or {}).get("industry", {}).get("name", ""),
        "website": ((p.get("address") or [{}])[0].get("website") or "").strip(),
        "office": ((p.get("address") or [{}])[0].get("office") or "").strip(),
        "shareholders": [{"name": s.get("name"), "pct": s.get("percentage"),
                          "value": s.get("value"),
                          "pengendali": "pengendali" in (s.get("badges") or [])}
                         for s in p.get("shareholder") or []],
        "beneficiary": [b.get("name") for b in p.get("beneficiary") or []],
        "directors": [d.get("value") for d in ke.get("director") or []],
        "commissioners": [str(c.get("value")) + (" (independen)" if "Independent" in str(c.get("key", "")) else "")
                          for c in list(ke.get("commissioner") or []) + list(ke.get("independent_commissioner") or []) if c],
        "stats": {"marketCap": to_num(stats.get("market_cap")),
                  "shares": to_num(stats.get("current_share_outstanding")),
                  "freeFloat": to_num(stats.get("free_float")),
                  "ev": to_num(stats.get("enterprise_value"))},
        "metrics": {"pbv": to_num(kv.get("Current Price to Book Value")),
                    "bvps": to_num(kv.get("Current Book Value Per Share")),
                    "epsAnn": to_num(kv.get("Current EPS (Annualised)")),
                    "per": to_num(kv.get("Current PE Ratio (Annualised)")),
                    "equity": to_num(kv.get("Total Equity")),
                    "cash": to_num(kv.get("Cash (Quarter)")),
                    "assets": to_num(kv.get("Total Assets (Quarter)")),
                    "revenueTtm": to_num(kv.get("Revenue (TTM)")),
                    "netIncomeTtm": to_num(kv.get("Net Income (TTM)")),
                    "revGrowth": kv.get("Revenue (Quarter YoY Growth)"),
                    "netMargin": kv.get("Net Profit Margin (Quarter)"),
                    "high52": to_num(kv.get("52 Week High")),
                    "low52": to_num(kv.get("52 Week Low")),
                    "ret1y": kv.get("1 Year Price Returns"),
                    "ret3m": kv.get("3 Month Price Returns"),
                    "ytd": kv.get("Year to Date Price Returns")},
        "chart": chart,
    }


chart_mem: dict[str, tuple[float, list]] = {}
chart_mem_lock = threading.Lock()


def chart_prices(ticker: str, fresh: bool = False) -> list[dict]:
    with chart_mem_lock:
        c = chart_mem.get(ticker)
        if c and time.time() - c[0] < 6 * 3600 and not fresh:
            return c[1]
    res = sb_fetch(f"/charts/{ticker}/daily?timeframe=3y", fresh)
    prices = [{"d": x.get("formatted_date"), "v": float(x["value"])}
              for x in (res.get("data", {}).get("prices") or [])
              if x.get("formatted_date") and x.get("value")]
    with chart_mem_lock:
        chart_mem[ticker] = (time.time(), prices)
    return prices


ohlc_mem: dict[str, tuple[float, list]] = {}


def get_ohlc(ticker: str, tf: str = "1y", fresh: bool = False) -> list[dict]:
    key = f"{ticker}|{tf}"
    c = ohlc_mem.get(key)
    if c and time.time() - c[0] < 30 * 60 and not fresh:
        return c[1]
    res = sb_fetch(f"/charts/{ticker}/daily?timeframe={tf}&chart_type=PRICE_CHART_TYPE_CANDLE", fresh)
    bars = []
    for x in res.get("data", {}).get("prices") or []:
        if not (x.get("formatted_date") and x.get("value")):
            continue
        cl = float(x["value"])
        o = float(x["open"]) if x.get("open") else cl
        bars.append({"d": x["formatted_date"], "o": o, "h": float(x["high"]) if x.get("high") else cl,
                     "l": float(x["low"]) if x.get("low") else cl, "c": cl,
                     "v": float(x.get("volume") or 0)})
    ohlc_mem[key] = (time.time(), bars)
    return bars


def get_ownership(ticker: str, fresh: bool = False) -> dict:
    p = sb_fetch(f"/emitten/{ticker}/profile", fresh).get("data", {})
    k = sb_fetch(f"/keystats/ratio/v1/{ticker}?year_limit=10", fresh).get("data", {})
    ctrl = [s for s in p.get("shareholder") or [] if "pengendali" in (s.get("badges") or [])]
    guess = False
    if not ctrl:
        ctrl = sorted((s for s in p.get("shareholder") or []
                       if not re.search(r"MASYARAKAT|PUBLIK|PUBLIC", str(s.get("name", "")), re.I)),
                      key=lambda s: parse_pct(s.get("percentage")), reverse=True)[:1]
        guess = bool(ctrl)
    stats = k.get("stats") or {}
    return {"ticker": ticker, "controllerGuess": guess,
            "marketCap": to_num(stats.get("market_cap")),
            "freeFloat": to_num(stats.get("free_float")),
            "controllerPct": round(sum(parse_pct(s.get("percentage")) for s in ctrl), 2) if ctrl else None,
            "controllerName": ", ".join(str(s.get("name")) for s in ctrl) if ctrl else ""}


def get_story(ticker: str, controller: str, near: str, fresh: bool = False) -> dict:
    p = sb_fetch(f"/emitten/{ticker}/profile", fresh).get("data", {})
    bg = re.sub(r"\s+", " ", str(p.get("background") or "")).strip()
    moves = insider_moves(ticker, 8, fresh)
    rows = []
    for m in moves:
        d = parse_date_ddmmyy(m.get("date"))
        if not d:
            continue
        prev, cur = parse_pct((m.get("previous") or {}).get("percentage")), parse_pct((m.get("current") or {}).get("percentage"))
        if prev > 100 or cur > 100:
            continue
        rows.append({"date": d, "name": str(m.get("name", "")).strip(), "prev": prev,
                     "cur": cur, "action": m.get("action_type") or ""})
    nc = norm_name(controller or "")
    buys = sorted((r for r in rows if "SELL" not in r["action"] and r["cur"] > r["prev"]),
                  key=lambda r: r["cur"] - r["prev"], reverse=True)
    if re.match(r"^\d{4}-\d{2}-\d{2}$", near or ""):
        nd = datetime.strptime(near, "%Y-%m-%d")
        win = [b for b in buys if nd - timedelta(days=240) <= b["date"] <= nd + timedelta(days=15)]
        if win:
            buys = win
    is_ctrl = lambda n: bool(nc) and (nc in norm_name(n) or norm_name(n) in nc)
    buy = next((b for b in buys if is_ctrl(b["name"])), None)
    if not buy:
        big = sorted((b for b in buys if b["cur"] - b["prev"] >= 15), key=lambda b: b["date"], reverse=True)
        buy = big[0] if big else None
    old = []
    if buy:
        win = [r for r in rows if r["cur"] < r["prev"] and abs((r["date"] - buy["date"]).days) <= 45
               and norm_name(r["name"]) != norm_name(buy["name"])]
        groups: dict[str, list] = {}
        for r in win:
            groups.setdefault(r["name"], []).append(r)
        old = [{"name": n, "before": max(x["prev"] for x in g), "after": min(x["cur"] for x in g)}
               for n, g in groups.items() if max(x["prev"] for x in g) >= 5]
        old = sorted(old, key=lambda o: o["before"], reverse=True)[:4]
        if not old:
            prior = sorted((r for r in rows if r["date"] < buy["date"]
                            and max(r["prev"], r["cur"]) >= 20
                            and norm_name(r["name"]) != norm_name(buy["name"])),
                           key=lambda r: r["date"], reverse=True)
            if prior:
                old = [{"name": prior[0]["name"], "before": max(prior[0]["prev"], prior[0]["cur"]),
                        "after": None, "inferred": True}]
    cls = p.get("classification") or {}
    takeover = {"date": buy["date"].strftime("%Y-%m-%d"), "buyer": buy["name"],
                "before": buy["prev"], "after": buy["cur"]} if buy else None
    return {"ticker": ticker,
            "sector": cls.get("sector", {}).get("name", ""),
            "subSector": cls.get("sub_sector", {}).get("name", ""),
            "industry": cls.get("industry", {}).get("name", ""),
            "background": bg[:420] + "…" if len(bg) > 420 else bg,
            "takeover": takeover, "oldControllers": old}


def get_controller(ticker: str, name: str, fresh: bool = False) -> dict:
    p = sb_fetch(f"/emitten/{ticker}/profile", fresh).get("data", {})
    nc = norm_name(name or "")
    hid, hname = None, name or ""
    for pg in range(1, 9):
        j = sb_fetch(f"/insider/company/majorholder?symbol={ticker}&page={pg}", fresh)
        hit = next((m for m in j.get("data", {}).get("movement") or []
                    if nc and (nc in norm_name(m.get("name")) or norm_name(m.get("name")) in nc)), None)
        if hit:
            hid, hname = str(hit.get("id")), str(hit.get("name", "")).strip()
            break
        if not j.get("data", {}).get("is_more"):
            break
        time.sleep(0.2)
    holdings = []
    if hid:
        moves = []
        for pg in range(1, 7):
            j = sb_fetch(f"/insider/company/majorholder?insider={hid}&page={pg}", fresh)
            moves += j.get("data", {}).get("movement") or []
            if not j.get("data", {}).get("is_more"):
                break
            time.sleep(0.2)
        rows = []
        for m in moves:
            d = parse_date_ddmmyy(m.get("date"))
            if d and m.get("symbol"):
                rows.append({"symbol": m["symbol"], "date": d,
                             "cur": parse_pct((m.get("current") or {}).get("percentage")),
                             "action": str(m.get("action_type", "")).replace("ACTION_TYPE_", ""), "_i": len(rows)})
        by: dict[str, list] = {}
        for r in rows:
            by.setdefault(r["symbol"], []).append(r)
        holdings = sorted(({"symbol": s, "pct": g[0]["cur"],
                            "lastDate": g[0]["date"].strftime("%Y-%m-%d"),
                            "lastAction": g[0]["action"],
                            "since": g[-1]["date"].strftime("%Y-%m-%d")}
                           for s, g in by.items()), key=lambda h: h["pct"], reverse=True)
    ke = p.get("key_executive") or {}
    ctrl = next((s for s in p.get("shareholder") or []
                 if nc and (nc in norm_name(s.get("name")) or norm_name(s.get("name")) in nc)), None)
    return {"ticker": ticker, "name": hname, "holderId": hid,
            "pct": ctrl.get("percentage") if ctrl else "",
            "shares": ctrl.get("value") if ctrl else "",
            "nationality": ctrl.get("nationality") if ctrl else "",
            "beneficiary": [b.get("name") for b in p.get("beneficiary") or []],
            "directors": [d.get("value") for d in ke.get("director") or []],
            "commissioners": [c.get("value") for c in list(ke.get("commissioner") or []) + list(ke.get("independent_commissioner") or []) if c],
            "holdings": holdings}


def get_insider(ticker: str, days: int = 180, fresh: bool = False) -> dict:
    cutoff = datetime.now() - timedelta(days=days)
    rows = []
    for pg in range(1, 9):
        j = sb_fetch(f"/insider/company/majorholder?symbol={ticker}&page={pg}", fresh)
        page = j.get("data", {}).get("movement") or []
        for m in page:
            d = parse_date_ddmmyy(m.get("date"))
            if not d:
                continue
            prev, cur = to_num((m.get("previous") or {}).get("percentage")), to_num((m.get("current") or {}).get("percentage"))
            if (prev or 0) > 100 or (cur or 0) > 100:
                continue
            rows.append({"date": d, "name": str(m.get("name", "")).strip(),
                         "action": str(m.get("action_type", "")).replace("ACTION_TYPE_", ""),
                         "prev": prev or 0, "cur": cur or 0,
                         "price": to_num((m.get("price_formatted") or ""))})
        if not j.get("data", {}).get("is_more") or (rows and min(r["date"] for r in rows) < cutoff):
            break
        time.sleep(0.2)
    recent = [r for r in rows if r["date"] >= cutoff]
    groups: dict[str, list] = {}
    for r in recent:
        groups.setdefault(r["name"], []).append(r)
    holders = sorted(({
        "name": n, "from": g[-1]["prev"], "to": g[0]["cur"],
        "change": round(g[0]["cur"] - g[-1]["prev"], 2),
        "buys": sum(1 for x in g if x["action"] == "BUY"),
        "sells": sum(1 for x in g if x["action"] == "SELL"),
        "lastDate": g[0]["date"].strftime("%Y-%m-%d"),
        "firstDate": g[-1]["date"].strftime("%Y-%m-%d"),
        "lastPrice": g[0]["price"],
    } for n, g in groups.items()), key=lambda h: abs(h["change"]), reverse=True)
    return {"ticker": ticker, "days": days, "holders": holders}


_bm_memo: dict[str, tuple[float, dict]] = {}


def get_benchmark(deals: list[str], fresh: bool = False) -> dict:
    # Hasil dihitung ulang paling sering 10 menit sekali untuk kumpulan transaksi yang sama.
    key = ",".join(sorted(deals))
    hit = _bm_memo.get(key)
    if hit and not fresh and time.time() - hit[0] < 600:
        return hit[1]
    res = _benchmark(deals, fresh)
    _bm_memo[key] = (time.time(), res)
    return res


def _benchmark(deals: list[str], fresh: bool = False) -> dict:
    rows = []
    for dl in deals:
        if ":" not in dl:
            continue
        sym, start = dl.split(":", 1)
        if not (re.match(r"^[A-Z]{4}$", sym) and re.match(r"^\d{4}-\d{2}-\d{2}$", start)):
            continue
        calls0 = _upstream_n  # bukan "before": nama itu dipakai untuk deret harga di bawah
        try:
            pr = chart_prices(sym, fresh)
            d0 = datetime.strptime(start, "%Y-%m-%d")
            pre_from = (d0 - timedelta(days=240)).strftime("%Y-%m-%d")
            run_to = (d0 + timedelta(days=90)).strftime("%Y-%m-%d")
            before = [x for x in pr if pre_from <= x["d"] < start]
            after = [x for x in pr if x["d"] >= start]
            if len(before) < 20 or len(after) < 5:
                continue
            base = min(x["v"] for x in before)
            base_date = next(x["d"] for x in before if x["v"] == base)
            peak = max(x["v"] for x in pr if base_date <= x["d"] <= run_to)
            p0, last = after[0]["v"], after[-1]["v"]
            if base <= 0 or p0 <= 0:
                continue
            peak_date = next((x["d"] for x in pr if base_date <= x["d"] <= run_to and x["v"] == peak), None)

            def day_of(s: str) -> int:
                return (datetime.strptime(s, "%Y-%m-%d") - d0).days

            # Deret siklus: harga ÷ harga saat PTW dimulai, per hari dari awal PTW
            # (tiap 3 bar bursa supaya respons ringan).
            win = [x for x in pr if x["d"] >= pre_from]
            series = [[day_of(win[i]["d"]), round(win[i]["v"] / p0, 4)] for i in range(0, len(win), 3)]
            rows.append({"ticker": sym, "start": start, "base": base, "peak": peak, "p0": p0,
                         "last": last, "runupX": round(peak / base, 2), "postX": round(last / p0, 2),
                         "baseDay": day_of(base_date), "peakDay": day_of(peak_date) if peak_date else None,
                         "lastDay": day_of(after[-1]["d"]), "series": series})
        except Exception:
            continue
        finally:
            # Jeda sopan hanya bila benar-benar memanggil Stockbit (bukan dari cache).
            if _upstream_n > calls0:
                time.sleep(0.2)

    def quart(arr, f):
        s = sorted(arr)
        if not s:
            return None
        i = (len(s) - 1) * f
        lo, hi = int(i // 1), int(-(-i // 1))
        return round(s[lo] + (s[hi] - s[lo]) * (i - lo), 2)

    rx = [r["runupX"] for r in rows]
    px = [r["postX"] for r in rows]
    return {"n": len(rows), "runupQ1": quart(rx, 0.25), "runupMedian": quart(rx, 0.5),
            "runupQ3": quart(rx, 0.75), "postMedian": quart(px, 0.5), "deals": rows}


def convert_reports(res: dict, ticker: str, cfg_reports: dict) -> list[dict]:
    days = int(cfg_reports.get("days") or 180)
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    skip = str(cfg_reports.get("skipTitle") or "")
    out = []
    for s in res.get("data", {}).get("stream") or []:
        title = re.sub(r"\s*\[[A-Z0-9-]+\]\s*$", "", str(s.get("title") or "")).strip()
        created = str(s.get("created_at") or "")
        date = created[:10] if len(created) >= 10 else created
        if not title or date < cutoff or (skip and re.search(skip, title)):
            continue
        t = news_type(title)
        _sum = s.get("summary") or {}
        text = [x for x in [_sum.get("summary"),
                            ("Inti: " + _sum["key_takeaway"]) if _sum.get("key_takeaway") else None] if x]
        points = " · ".join(x for x in (_sum.get("key_points") or []) if x)
        out.append({"id": f"sb-report-{s.get('stream_id')}", "date": date, "ticker": ticker,
                    "type": t, "title": title, "summary": (" ".join(text) + " (Ringkasan AI Stockbit)") if text else "",
                    "points": points, "source": "Stockbit Reports",
                    "url": f"https://stockbit.com/post/{s.get('stream_id')}"})
    return out

def get_reports(cfg_reports: dict, ticker: str, fresh: bool = False, max_pages: int | None = None) -> list[dict]:
    """Keterbukaan informasi satu emiten dari stream Stockbit (beberapa halaman, sampai batas hari)."""
    max_pages = max_pages or int(cfg_reports.get("maxPages") or 1)
    days = int(cfg_reports.get("days") or 180)
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    all_pg, cursor = [], 0
    for _ in range(max_pages):
        url = re.sub(r"last_stream_id=\d+", f"last_stream_id={cursor}", cfg_reports["url"]).replace("{ticker}", ticker)
        res = stockbit_api(url, fresh)
        page = res.get("data", {}).get("stream") or []
        all_pg += page
        dates = [str(x.get("created_at") or "")[:10] for x in page if x.get("created_at")]
        if res.get("data", {}).get("pagination", {}).get("is_last_page") or not page or (dates and min(dates) < cutoff):
            break
        cursor = res.get("data", {}).get("pagination", {}).get("next_cursor") or 0
        time.sleep(0.25)
    return convert_reports({"data": {"stream": all_pg}}, ticker, cfg_reports)


# ------------------------------------------------------------- kandidat ----
# Calon cangkang otomatis: emiten di luar radar yang punya sinyal awal di data seluruh bursa
# (rights issue, UMA, berita), lalu diperiksa keterbukaan informasinya di Stockbit.

KANDIDAT_SIG = [
    ("akuisisi", r"pengendali|pengambilalihan|akuisisi|negosiasi|pengalihan saham|penjualan saham|jual beli saham|"
                 r"ppjb|term sheet|nota kesepahaman|\bmou\b|investor strategis|tender|\bmto\b|backdoor|caplok"),
    ("kbli", r"kegiatan usaha|\bkbli\b|perubahan nama|nama perseroan"),
    ("rights", r"hmetd|hak memesan|rights issue|penambahan modal|private placement|inbreng"),
    ("direksi", r"perubahan (susunan )?(anggota )?(direksi|dewan komisaris|komisaris|pengurus)|"
                r"pengunduran diri (anggota )?(direk|komisaris)|pengangkatan (direk|komisaris)"),
    ("uma", r"\buma\b|unusual market|suspensi|penghentian sementara|volatilitas"),
]


def big_holder_moves(fresh: bool = False, pages: int = 60) -> list[dict]:
    """Perpindahan blok besar: pemegang baru naik ke ≥ 20%, atau pemegang ≥ 20% turun ≥ 10 poin.
    Entri yang dibalik pada tanggal yang sama (koreksi data) dan persentase > 100 diabaikan."""
    raw = []
    for pg in range(1, pages + 1):
        j = sb_fetch(f"/insider/company/majorholder?page={pg}", fresh)
        raw += j.get("data", {}).get("movement") or []
        if not j.get("data", {}).get("is_more"):
            break
        time.sleep(0.2)
    rows = []
    for m in raw:
        d = parse_date_ddmmyy(m.get("date"))
        prev = to_num((m.get("previous") or {}).get("percentage")) or 0
        cur = to_num((m.get("current") or {}).get("percentage")) or 0
        if d and prev <= 100 and cur <= 100:
            rows.append((d.strftime("%Y-%m-%d"), str(m.get("symbol") or ""), str(m.get("name") or "").strip(), prev, cur,
                         str(m.get("price_formatted") or "")))
    keys = {(d, t, n, p, c) for d, t, n, p, c, _ in rows}
    out, seen = [], set()
    for d, t, n, p, c, price in rows:
        if (d, t, n, c, p) in keys or (d, t, n, p, c) in seen:
            continue  # pasangan koreksi atau duplikat
        seen.add((d, t, n, p, c))
        if (p < 5 and c >= 20) or (p >= 20 and p - c >= 10):
            verb = "masuk" if c > p else "melepas"
            out.append({"ticker": t, "date": d,
                        "text": f"{n.title()} {verb}: {p:g}% → {c:g}%" + (f" @Rp{price}" if price else "")})
    return out


def kandidat_sigs(title: str) -> list[str]:
    t = (title or "").lower()
    return [sid for sid, rx in KANDIDAT_SIG if re.search(rx, t)]


_kd_memo: tuple[float, dict] | None = None
_kd_lock = threading.Lock()
KANDIDAT_MAX = 40


def get_kandidat(cfg: dict, fresh: bool = False) -> dict:
    # Dihitung ulang paling sering 6 jam sekali; satu perhitungan berjalan pada satu waktu.
    global _kd_memo
    with _kd_lock:
        public = is_public_request()
        if _kd_memo and (public or (not fresh and time.time() - _kd_memo[0] < 6 * 3600)):
            return _kd_memo[1]
        res = _kandidat(cfg, fresh)
        if not public:  # versi publik hanya membaca cache; hasilnya tidak lengkap, jangan disimpan
            _kd_memo = (time.time(), res)
        return res


# ------------------------------------------------------- diff harian ----
# Snapshot ringkas tiap emiten sekali sehari (dini hari), supaya Monitor bisa menunjukkan apa yang berubah
# sejak kemarin atau sejak N hari: harga, porsi pengendali, tonggak transaksi, tender, laporan baru.

SNAP_KEEP_DAYS = 60


def snap_of(item: dict) -> dict:
    return {"price": item.get("price"), "ctrlPct": item.get("ctrlPct"), "ctrlName": item.get("ctrlName") or "",
            "ms": sorted(k for k, v in (item.get("ms") or {}).items() if v),
            "tender": (item.get("tender") or {}).get("price"), "stage": item.get("stage") or ""}


def snapshot_today(force: bool = False) -> str:
    day = datetime.now().strftime("%Y-%m-%d")
    if not force and data_rows("SELECT 1 FROM snapshots WHERE day=? LIMIT 1", (day,)):
        return day
    now = int(time.time())
    data_exec("INSERT OR REPLACE INTO snapshots VALUES(?,?,?,?)",
              [(day, i["ticker"], now, json.dumps(snap_of(i), ensure_ascii=False)) for i in items_all()])
    cutoff = (datetime.now() - timedelta(days=SNAP_KEEP_DAYS)).strftime("%Y-%m-%d")
    data_exec("DELETE FROM snapshots WHERE day < ?", [(cutoff,)])
    return day


def snapshot_loop() -> None:
    """Ambil snapshot saat server mulai (bila hari ini belum ada), lalu tiap hari pukul 00:05."""
    while True:
        try:
            snapshot_today()
        except Exception as e:
            print(f"[snapshot] gagal: {e}", file=sys.stderr)
        nxt = (datetime.now() + timedelta(days=1)).replace(hour=0, minute=5, second=0, microsecond=0)
        time.sleep(max(60, (nxt - datetime.now()).total_seconds()))


def get_diff(days: int = 1) -> dict:
    """Perubahan tiap emiten dibanding snapshot `days` hari lalu (1 = snapshot dini hari ini = tutup kemarin)."""
    target = (datetime.now() - timedelta(days=max(0, days - 1))).strftime("%Y-%m-%d")
    row = data_rows("SELECT day, MIN(taken_at) FROM snapshots WHERE day <= ? GROUP BY day ORDER BY day DESC LIMIT 1", (target,))
    if not row:
        row = data_rows("SELECT day, MIN(taken_at) FROM snapshots GROUP BY day ORDER BY day ASC LIMIT 1")
    if not row:
        return {"base": None, "items": []}
    base_day, taken = row[0]
    base = {t: json.loads(d) for t, d in data_rows("SELECT ticker, data FROM snapshots WHERE day=?", (base_day,))}
    since_iso = datetime.fromtimestamp(taken, timezone.utc).isoformat().replace("+00:00", "Z")
    new_reports: dict[str, int] = {}
    for u in updates_all():
        if u.get("ticker") and str(u.get("updatedAt") or "") > since_iso:
            new_reports[u["ticker"]] = new_reports.get(u["ticker"], 0) + 1
    out = []
    for item in items_all():
        t, cur, old = item["ticker"], snap_of(item), base.get(item["ticker"])
        ch = []
        if old is None:
            ch.append({"k": "new"})
        else:
            p0, p1 = old.get("price"), cur["price"]
            if p0 and p1 and p0 != p1:
                ch.append({"k": "price", "from": p0, "to": p1, "pct": round((p1 - p0) / p0 * 100, 1)})
            if old.get("ctrlPct") != cur["ctrlPct"] and cur["ctrlPct"] is not None:
                ch.append({"k": "ctrl", "from": old.get("ctrlPct"), "to": cur["ctrlPct"],
                           "name": cur["ctrlName"] if cur["ctrlName"] != old.get("ctrlName") else ""})
            added = [m for m in cur["ms"] if m not in (old.get("ms") or [])]
            if added:
                ch.append({"k": "ms", "added": added})
            if old.get("tender") != cur["tender"] and cur["tender"]:
                ch.append({"k": "tender", "from": old.get("tender"), "to": cur["tender"]})
        if new_reports.get(t):
            ch.append({"k": "reports", "n": new_reports[t]})
        if ch:
            out.append({"ticker": t, "changes": ch})
    return {"base": base_day, "since": since_iso, "items": out}


def kandidat_loop() -> None:
    """Hitung kandidat di latar belakang (setelah start, lalu tiap 6 jam) supaya halaman
    Kandidat — termasuk versi publik yang hanya membaca hasil jadi — tidak menunggu pemindaian."""
    time.sleep(20)
    while True:
        cfg = load_config()
        if cfg and get_token():
            try:
                get_kandidat(cfg)
            except Exception as e:
                print(f"[kandidat] gagal: {e}", file=sys.stderr)
        time.sleep(6 * 3600 + 60)


def _kandidat(cfg: dict, fresh: bool = False) -> dict:
    bd = cfg.get("backdoor") or {}
    skip = {i["ticker"] for i in items_all() if i.get("stage") != "radar"} | set(bd.get("include") or []) \
        | set(bd.get("exclude") or [])
    found: dict[str, dict] = {}
    errors: list[dict] = []

    def add(t: str, sid: str, d: str, text: str, src: str) -> None:
        if not TICKER_RE.match(t or "") or t in skip:
            return
        k = found.setdefault(t, {"ticker": t, "signals": {}})
        sig = k["signals"].setdefault(sid, {"st": "on", "d": d, "ev": []})
        if not any(e["text"] == text for e in sig["ev"]):
            sig["ev"].append({"d": d, "text": text, "src": src})
        sig["d"] = max(sig["d"], d)

    today = datetime.now().strftime("%Y-%m-%d")
    # 0) Perpindahan blok pemegang saham besar di seluruh BEI (data KSEI/IDX via Stockbit).
    try:
        for m in big_holder_moves(fresh):
            add(m["ticker"], "akuisisi", m["date"], m["text"], "https://stockbit.com/symbol/" + m["ticker"])
    except Exception as e:
        errors.append({"source": "Pemegang saham besar", "error": str(e)})
    # 1) Rights issue seluruh BEI: hanya yang mendilusi besar (≥ 1 saham baru per saham lama).
    try:
        for r in (stockbit_api(SB + "/corpaction/rightissue?limit=100", fresh).get("data") or {}).get("rightissue") or []:
            try:
                ratio = float(r.get("rightissue_new") or 0) / float(r.get("rightissue_old") or 1)
            except ValueError:
                continue
            if ratio >= 1:
                add(r.get("company_symbol"), "rights", r.get("rightissue_cumdate") or today,
                    f"Rights issue {r.get('rightissue_ratio')} @Rp{r.get('rightissue_price_formatted')} (cum {r.get('rightissue_cumdate')})",
                    "https://stockbit.com/symbol/" + str(r.get("company_symbol")))
    except Exception as e:
        errors.append({"source": "Rights issue", "error": str(e)})
    # 2) UMA seluruh BEI.
    try:
        uma = stockbit_api(SB + "/corpaction/uma?limit=100", fresh).get("data") or []
        for u in uma if isinstance(uma, list) else []:
            t = u.get("company_symbol") or u.get("symbol")
            add(t, "uma", str(u.get("uma_date") or u.get("date") or today)[:10], "Unusual Market Activity (BEI)",
                "https://stockbit.com/symbol/" + str(t))
    except Exception as e:
        errors.append({"source": "UMA", "error": str(e)})
    # 3) Berita yang menyebut kode saham di judul.
    if cfg.get("news"):
        try:
            for n in get_news(cfg["news"], [], fresh)["items"]:
                for sid in kandidat_sigs(n["title"]):
                    add(n["ticker"], sid, n["date"], n["title"], n["url"])
        except Exception as e:
            errors.append({"source": "Berita", "error": str(e)})

    # 4) Periksa keterbukaan informasi tiap calon; data harga dari halaman Stockbit.
    out = []
    for t in sorted(found, key=lambda x: -len(found[x]["signals"]))[:KANDIDAT_MAX]:
        k = found[t]
        try:
            if cfg.get("reports"):
                for r in get_reports(cfg["reports"], t, fresh, max_pages=1):
                    for sid in kandidat_sigs(r["title"]):
                        add(t, sid, r["date"], r["title"], r["url"])
            co = page_props(t, fresh).get("company") or {}
            k["name"] = co.get("name") or ""
            k["price"] = float(co["lastprice"]) if co.get("lastprice") not in (None, "") else None
        except PublicNoCache:
            pass
        except Exception as e:
            errors.append({"source": t, "error": str(e)[:120]})
        sig = k["signals"]
        # Rights issue saja pada saham mahal biasanya penggalangan dana biasa, bukan cangkang.
        if set(sig) == {"rights"} and (k.get("price") is None or k["price"] > 300):
            continue
        for v in sig.values():
            v["ev"].sort(key=lambda e: e["d"], reverse=True)
            del v["ev"][5:]
        k["flags"] = {sid: True for sid in sig}
        out.append(k)
    return {"asOf": datetime.now().isoformat(timespec="seconds"), "items": out, "errors": errors}

# ---------------------------------------------------------------- server ----


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "RadarCangkang/2.0"

    # ---- helpers
    def reply(self, body: bytes, status: int = 200, ctype: str = "application/json; charset=utf-8") -> None:
        # Cloudflare mengganti 502 dari origin dengan halaman error-nya sendiri; untuk pengunjung
        # publik, kegagalan data (biasanya: belum ada di cache) dikirim sebagai 503 agar pesannya sampai.
        if status == 502 and is_public_request():
            status = 503
        try:
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def reply_json(self, obj, status: int = 200) -> None:
        self.reply(json.dumps(obj, ensure_ascii=False).encode(), status)

    def qs(self, name: str) -> str:
        return urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query).get(name, [""])[0]

    def is_local(self) -> bool:
        # IP privat, loopback, link-local, dan CGNAT 100.64/10 (Tailscale). Alamat IPv4
        # yang dipetakan ke IPv6 (::ffff:a.b.c.d) dibuka dulu.
        try:
            ip = ipaddress.ip_address(self.client_address[0])
        except ValueError:
            return False
        if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
            ip = ip.ipv4_mapped
        return ip.is_private or ip.is_loopback or ip.is_link_local or ip in CGNAT

    # ---- HTTP
    def is_public(self) -> bool:
        # cloudflared selalu menambahkan Cf-Connecting-Ip; akses LAN/Tailscale langsung tidak.
        return bool(self.headers.get("Cf-Connecting-Ip"))

    def do_GET(self) -> None:  # noqa: N802
        _req.public = self.is_public()
        try:
            if not self.is_local():
                self.reply(b"", 403)
                return
            path = urllib.parse.unquote(urllib.parse.urlparse(self.path).path.lstrip("/"))
            fresh = self.qs("fresh") == "1" and not _req.public
            if path.startswith("api/"):
                self.handle_api(path, fresh)
                return
            self.serve_static(path)
        except PublicNoCache:
            self.reply_json({"error": "Data ini belum tersedia di versi publik."}, 503)
        except Exception as e:
            print(f"[error] {self.path}: {e}", file=sys.stderr)
            try:
                self.reply_json({"error": f"Server error: {e}"}, 500)
            except Exception:
                pass

    def do_PUT(self) -> None:  # noqa: N802
        self.handle_write("PUT")

    def do_POST(self) -> None:  # noqa: N802
        self.handle_write("POST")

    def do_DELETE(self) -> None:  # noqa: N802
        self.handle_write("DELETE")

    def read_json(self):
        """Body JSON penulisan. Content-Type wajib application/json: permintaan lintas situs
        dengan tipe ini selalu butuh preflight CORS, yang tidak dijawab server ini."""
        if not (self.headers.get("Content-Type") or "").startswith("application/json"):
            raise ValueError("Content-Type harus application/json.")
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BODY:
            raise ValueError("Body terlalu besar.")
        return json.loads(self.rfile.read(n) or b"null")

    def handle_write(self, method: str) -> None:
        try:
            if self.is_public():
                self.reply_json({"error": "Versi publik hanya baca."}, 403)
                return
            if not self.is_local():
                self.reply(b"", 403)
                return
            path = urllib.parse.urlparse(self.path).path.strip("/")
            parts = path.split("/")
            body = None if method == "DELETE" else self.read_json()
            if len(parts) == 3 and parts[:2] == ["api", "items"] and TICKER_RE.match(parts[2]):
                t = parts[2]
                if method == "DELETE":
                    data_exec("DELETE FROM items WHERE ticker=?", [(t,)])
                    self.reply_json({"ok": True})
                elif method == "PUT" and valid_item(body) and body["ticker"] == t:
                    item_put(body)
                    self.reply_json({"ok": True})
                else:
                    self.reply_json({"error": "Item tidak valid."}, 400)
            elif path == "api/updates" and method == "POST":
                if not isinstance(body, list) or not all(valid_update(u) for u in body):
                    self.reply_json({"error": "Update tidak valid."}, 400)
                    return
                updates_put(body)
                self.reply_json({"ok": True, "count": len(body)})
            elif path == "api/migrate" and method == "POST" and isinstance(body, dict):
                self.reply_json(migrate(body))
            elif (len(parts) == 4 and parts[:3] == ["api", "kandidat", "hidden"] and TICKER_RE.match(parts[3])
                  and method in ("PUT", "DELETE")):
                # Kandidat otomatis yang disembunyikan tim (tidak relevan); DELETE memulihkan.
                if method == "PUT":
                    data_exec("INSERT OR REPLACE INTO kandidat_hidden VALUES(?,?)", [(parts[3], int(time.time()))])
                else:
                    data_exec("DELETE FROM kandidat_hidden WHERE ticker=?", [(parts[3],)])
                self.reply_json({"ok": True})
            elif (len(parts) == 3 and parts[:2] == ["api", "layout"] and TICKER_RE.match(parts[2])
                  and method == "PUT" and isinstance(body, dict)):
                data_exec("INSERT OR REPLACE INTO layout VALUES(?,?)",
                          [(parts[2], json.dumps(body, ensure_ascii=False))])
                self.reply_json({"ok": True})
            else:
                self.reply_json({"error": "Tidak ditemukan."}, 404)
        except (ValueError, json.JSONDecodeError) as e:
            self.reply_json({"error": str(e)}, 400)
        except Exception as e:
            print(f"[error] {method} {self.path}: {e}", file=sys.stderr)
            self.reply_json({"error": f"Server error: {e}"}, 500)

    def serve_static(self, path: str) -> None:
        # Hasil build Vue (dist/) didahulukan; file data JSON tetap dari ROOT.
        if path == "":
            path = "index.html"
        f = None
        for base in (DIST, ROOT):
            cand = (base / path).resolve()
            if cand.is_relative_to(base) and cand.is_file():
                f = cand
                break
        name = f.name if f else ""
        blocked = (not f or name.startswith(".") or name.endswith(".ps1") or name == "server.py"
                   or name == "stockbit.config.json")
        if blocked:
            self.reply(b"", 404)
            return
        ext = f.suffix.lower()
        types = {".html": "text/html; charset=utf-8", ".css": "text/css",
                 ".js": "text/javascript", ".mjs": "text/javascript",
                 ".png": "image/png", ".svg": "image/svg+xml",
                 ".json": "application/json", ".ico": "image/x-icon",
                 ".woff2": "font/woff2", ".map": "application/json",
                 ".webmanifest": "application/manifest+json"}
        try:
            self.reply(f.read_bytes(), 200, types.get(ext, "application/octet-stream"))
        except OSError:
            self.reply(b"", 404)

    # ---- API
    def handle_api(self, path: str, fresh: bool) -> None:
        cfg = load_config()
        ticker = self.qs("ticker").upper()

        if path == "api/items":
            self.reply_json(items_all())
        elif path == "api/updates":
            self.reply_json(updates_all())
        elif path.startswith("api/layout/"):
            t = path.rsplit("/", 1)[1]
            if not TICKER_RE.match(t):
                self.reply_json({"error": "Kode saham harus 4 huruf."}, 400)
                return
            rows = data_rows("SELECT data FROM layout WHERE ticker=?", (t,))
            self.reply_json(json.loads(rows[0][0]) if rows else {})
        elif path == "api/features":
            self.reply_json(cfg.get("features") or {})
        elif path == "api/status":
            exp = token_exp()
            self.reply_json({
                "ok": True, "tokenLoaded": bool(get_token()), "tokenExp": exp,
                "tokenStale": bool(exp and exp < time.time()),
                "pageFallback": False,
                "needsToken": bool(cfg and cfg.get("quote", {}).get("source") != "page"),
                "configured": bool(cfg and cfg.get("quote", {}).get("url")
                                   and "GANTI" not in cfg["quote"]["url"]),
                "reports": bool(cfg.get("reports", {}).get("url")) if cfg else False,
                "news": bool(cfg.get("news", {}).get("sources")) if cfg else False,
                "tenders": bool(cfg.get("tenders", {}).get("url")) if cfg else False,
                "stockbit1h": stats_1h(),
                "readOnly": is_public_request(),
            })
        elif path == "api/tenders":
            self.api_tenders(cfg, fresh)
        elif path == "api/ohlc":
            tf = self.qs("tf") if self.qs("tf") in ("3m", "6m", "1y", "3y") else "1y"
            self.guard_token() or self.guard_ticker(ticker) or self.reply_json(
                {"ticker": ticker, "tf": tf, "bars": get_ohlc(ticker, tf, fresh)})
        elif path == "api/insider":
            self.guard_token() or self.guard_ticker(ticker) or self.reply_json(
                get_insider(ticker, max(30, min(720, int(self.qs("days") or 180))), fresh))
        elif path == "api/controller":
            self.guard_token() or self.guard_ticker(ticker) or self.reply_json(
                get_controller(ticker, self.qs("name"), fresh))
        elif path == "api/story":
            self.guard_token() or self.guard_ticker(ticker) or self.reply_json(
                get_story(ticker, self.qs("controller"), self.qs("near"), fresh))
        elif path == "api/ownership":
            self.guard_token() or self.guard_ticker(ticker) or self.reply_json(
                get_ownership(ticker, fresh))
        elif path in ("api/profile", "api/benchmark"):
            if not self.guard_token():
                if path == "api/profile":
                    if not self.guard_ticker(ticker):
                        self.reply_json(get_profile(ticker, fresh))
                else:
                    deals = [d for d in self.qs("deals").split(",") if d]
                    self.reply_json(get_benchmark(deals, fresh))
        elif path == "api/news":
            if not cfg or not cfg.get("news"):
                self.reply_json({"error": "Bagian news belum ada di stockbit.config.json."}, 500)
                return
            tickers = [t for t in self.qs("tickers").upper().split(",") if re.match(r"^[A-Z]{4}$", t)]
            self.reply_json(get_news(cfg["news"], tickers, fresh))
        elif path == "api/reports":
            self.api_reports(cfg, ticker, fresh)
        elif path == "api/diff":
            try:
                days = max(1, min(SNAP_KEEP_DAYS, int(self.qs("days") or 1)))
            except ValueError:
                days = 1
            self.reply_json(get_diff(days))
        elif path == "api/kandidat":
            if not self.guard_token():
                res = get_kandidat(cfg, fresh)
                # Penyaringan "disembunyikan" di luar memo supaya langsung berlaku.
                hidden = {t: at for t, at in data_rows("SELECT ticker, hidden_at FROM kandidat_hidden")}
                self.reply_json({**res, "items": [k for k in res["items"] if k["ticker"] not in hidden],
                                 "hidden": [{"ticker": t, "at": at, "name": next((k.get("name") for k in res["items"]
                                             if k["ticker"] == t), "")} for t, at in sorted(hidden.items())]})
        elif path == "api/viz/summary":
            # Agregat lokal untuk infografis: komposisi tahap emiten dari story-verified.json +
            # daftar backdoor di config — tanpa token Stockbit.
            bd = (cfg.get("backdoor") or {})
            include = [x for x in (bd.get("include") or []) if TICKER_RE.match(str(x))]
            stages = {"spa": 0, "tender": 0, "rupslb": 0, "injeksi": 0, "selesai": 0}
            verified = 0
            try:
                sv = json.loads((ROOT / "story-verified.json").read_text(encoding="utf-8"))
                for tkr, st in sv.items():
                    if tkr not in include or not isinstance(st, dict):
                        continue
                    verified += 1
                    # tahap ditentukan field yang terisi: target/nominal terisi = injeksi;
                    # ada normalized data lain = tender; kosong semua = spa (negosiasi).
                    if (str(st.get("target") or "")).strip() or (str(st.get("injectTarget") or "")).strip():
                        stages["injeksi"] += 1
                    elif (str(st.get("nominal") or "")).strip():
                        stages["tender"] += 1
                    else:
                        stages["spa"] += 1
            except Exception:
                pass
            rest = max(0, len(include) - verified)
            stages["spa"] += rest
            self.reply_json({
                "total": len(include),
                "verified": verified,
                "stages": [
                    {"label": "PPJB/negosiasi", "value": stages["spa"]},
                    {"label": "PTW/tender", "value": stages["tender"]},
                    {"label": "RUPSLB", "value": stages["rupslb"]},
                    {"label": "Injeksi aset", "value": stages["injeksi"]},
                    {"label": "Selesai", "value": stages["selesai"]},
                ],
                "generated": int(time.time()),
            })
        elif path == "api/raw":
            if self.guard_ticker(ticker):
                return
            try:
                pp = page_props(ticker, fresh)
                pp.pop("posts", None)   # postingan pengguna tidak ikut dikirim
                self.reply_json(pp)
            except Exception as e:
                self.reply_json({"error": f"Gagal memanggil Stockbit: {e}"}, 502)
        else:
            self.api_quote(cfg, ticker, fresh)

    def guard_token(self) -> bool:
        """True bila error sudah dikirim (token hilang/ditolak)."""
        if get_token():
            return False
        self.reply_json({"error": "Token belum diisi. Simpan di file .stockbit-token."}, 401)
        return True

    def guard_ticker(self, ticker: str) -> bool:
        if re.match(r"^[A-Z]{4}$", ticker):
            return False
        self.reply_json({"error": "Kode saham harus 4 huruf."}, 400)
        return True

    def api_quote(self, cfg, ticker: str, fresh: bool) -> None:
        if not self.guard_ticker(ticker):
            if not cfg or not cfg.get("quote"):
                self.reply_json({"error": "stockbit.config.json belum diisi."}, 500)
                return
            q = cfg["quote"]
            if q.get("source") == "page":
                try:
                    self.reply_json(self.page_quote_fields(q, ticker, fresh))
                except Exception as e:
                    self.reply_json({"error": f"Gagal memanggil Stockbit: {e}"}, 502)
                return
            # source=api → fallback halaman publik bila token hilang/kedaluwarsa/ditolak.
            try:
                res = stockbit_api(q["url"].replace("{ticker}", ticker), fresh)
            except (NoToken, Upstream401):
                try:
                    self.reply_json(page_quote(ticker, fresh))
                except NoToken:
                    self.reply_json({"error": "Token belum diisi. Simpan di file .stockbit-token."}, 401)
                except Exception as e:
                    self.reply_json({"error": f"Token ditolak Stockbit dan fallback gagal: {e}"}, 502)
                return
            except Exception as e:
                self.reply_json({"error": f"Gagal memanggil Stockbit: {e}"}, 502)
                return
            self.reply_json(self.map_fields(q, res))

    def page_quote_fields(self, q, ticker: str, fresh: bool) -> dict:
        pp = page_props(ticker, fresh)
        f = q.get("fields", {})
        # Field config ditulis relatif ke root __NEXT_DATA__ (mis. props.pageProps.company.name);
        # fallback tanpa prefix bila field ditulis relatif ke company.
        cp = {"company": pp.get("company", {})}

        def num(v):
            try:
                return float(v) if v not in ("", None) else None
            except (TypeError, ValueError):
                return None

        def val(key: str, dflt_path: str):
            raw = get_by_path(pp, f.get(key) or "") if f.get(key) else None
            if raw is None:
                raw = get_by_path(cp, dflt_path)
            return raw

        mcap = num(val("mcap", "") or None)
        return {"ticker": ticker,
                "name": val("name", "company.name"),
                "price": num(val("price", "company.lastprice")),
                "mcap": (mcap / float(q["mcapDivisor"])) if mcap is not None and q.get("mcapDivisor") else mcap,
                "float": num(val("float", "")),
                "uma": val("uma", "company.uma") is True,
                "corpAction": val("corpAction", "company.corp_action.active") is True,
                "volume": num(val("volume", "company.volume")),
                "avgVolume": num(val("avgVolume", "company.average")),
                # perubahan harga sesi terakhir (%) dari halaman Stockbit
                "pctChange": num(get_by_path(cp, "company.percentage_change"))}

    def map_fields(self, q, res) -> dict:
        f = q.get("fields", {})

        def num(v):
            if v in ("", None):
                return None
            try:
                return float(re.sub(r"[^\d.\-]", "", str(v)))
            except ValueError:
                return None

        mcap = num(get_by_path(res, f.get("mcap") or ""))
        if mcap is not None and q.get("mcapDivisor"):
            mcap = mcap / float(q["mcapDivisor"])
        return {"ticker": self.qs("ticker").upper(),
                "name": get_by_path(res, f.get("name") or ""),
                "price": num(get_by_path(res, f.get("price") or "")),
                "mcap": mcap, "float": num(get_by_path(res, f.get("float") or "")),
                "uma": get_by_path(res, f.get("uma") or "") is True,
                "corpAction": get_by_path(res, f.get("corpAction") or "") is True,
                "volume": num(get_by_path(res, f.get("volume") or "")),
                "avgVolume": num(get_by_path(res, f.get("avgVolume") or ""))}

    def api_tenders(self, cfg, fresh: bool) -> None:
        if not cfg or not cfg.get("tenders"):
            self.reply_json({"error": "Bagian tenders belum ada di stockbit.config.json."}, 500)
            return
        try:
            res = stockbit_api(cfg["tenders"]["url"], fresh)
        except NoToken:
            self.reply_json({"error": "Token belum diisi. Simpan di file .stockbit-token."}, 401)
            return
        except urllib.error.HTTPError as e:
            if e.code == 401:
                self.reply_json({"error": "Token ditolak Stockbit (kedaluwarsa?). Ambil token baru."}, 401)
            else:
                self.reply_json({"error": f"Gagal memanggil Stockbit: HTTP {e.code}"}, 502)
            return
        except Exception as e:
            self.reply_json({"error": f"Gagal memanggil Stockbit: {e}"}, 502)
            return
        min_pct = float(cfg["tenders"].get("minPercent") or 0)
        by = {}
        for t in res.get("data", {}).get("tender") or []:
            sym = str(t.get("company_symbol") or "")
            if not re.match(r"^[A-Z]{4}$", sym):
                continue
            try:
                if float(t.get("tender_percentage") or 0) < min_pct:
                    continue
            except (TypeError, ValueError):
                continue
            if sym not in by or str(t.get("tender_start") or "") > str(by[sym].get("start") or ""):
                by[sym] = {"ticker": sym, "name": t.get("company_name"),
                           "price": float(t.get("tender_price") or 0),
                           "percent": float(t.get("tender_percentage") or 0),
                           "shares": str(t.get("tender_shares") or ""),
                           "start": str(t.get("tender_start") or ""),
                           "end": str(t.get("tender_end") or ""),
                           "paydate": str(t.get("tender_paydate") or ""),
                           "active": bool(t.get("corp_action_active"))}
        bd = cfg.get("backdoor") or {}
        include = [s for s in (bd.get("include") or []) if re.match(r"^[A-Z]{4}$", str(s))]
        for sym in include:
            if sym in by:
                by[sym]["confirmed"] = True
                continue
            entry = {"ticker": sym, "name": "", "confirmed": True}
            try:
                ca = stockbit_api(bd.get("corpactionUrl", "").replace("{ticker}", sym), fresh)
                tos = sorted((a.get("action_info", {}).get("tenderoffer")
                              for a in ca.get("data") or []
                              if a.get("action_type") == "tenderoffer" and a.get("action_info")),
                             key=lambda t: str(t.get("tender_start") or ""), reverse=True)
                if tos:
                    to = tos[0]
                    entry.update({"name": to.get("company_name"),
                                  "price": float(to.get("tender_price") or 0),
                                  "percent": float(to.get("tender_percentage") or 0),
                                  "shares": str(to.get("tender_shares") or ""),
                                  "start": str(to.get("tender_start") or ""),
                                  "end": str(to.get("tender_end") or ""),
                                  "paydate": str(to.get("tender_paydate") or ""),
                                  "active": bool(to.get("corp_action_active"))})
            except Exception:
                pass
            by[sym] = entry
            time.sleep(0.3)
        for x in bd.get("exclude") or []:
            by.pop(str(x), None)
        self.reply_json({"items": list(by.values()), "exclude": bd.get("exclude") or []})

    def api_reports(self, cfg, ticker: str, fresh: bool) -> None:
        if not cfg.get("reports"):
            self.reply_json({"error": "Bagian reports belum ada di stockbit.config.json."}, 500)
            return
        if not self.guard_ticker(ticker):
            try:
                self.reply_json({"ticker": ticker, "items": get_reports(cfg["reports"], ticker, fresh)})
            except NoToken:
                self.reply_json({"error": "Token belum diisi. Simpan di file .stockbit-token."}, 401)
            except urllib.error.HTTPError as e:
                self.reply_json({"error": f"Token ditolak Stockbit (HTTP {e.code})." if e.code == 401
                                 else f"Gagal memanggil Stockbit: HTTP {e.code}"}, 401 if e.code == 401 else 502)
            except Exception as e:
                self.reply_json({"error": f"Gagal memanggil Stockbit: {e}"}, 502)

    def log_message(self, fmt, *args):  # quiet
        pass


def num_get(obj, path):
    v = get_by_path(obj, path or "")
    if v in ("", None):
        return None
    try:
        return float(re.sub(r"[^\d.\-]", "", str(v)))
    except ValueError:
        return None


_config_cache: tuple[float, dict | None] | None = None
_config_lock = threading.Lock()


def load_config() -> dict | None:
    global _config_cache
    with _config_lock:
        try:
            m = CONFIG_PATH.stat().st_mtime
            if _config_cache and _config_cache[0] == m:
                return _config_cache[1]
            cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
            _config_cache = (m, cfg)
            return cfg
        except Exception:
            return None


def main() -> int:
    ap = argparse.ArgumentParser(description="Radar Cangkang server")
    ap.add_argument("--lan", action="store_true", help="terbuka untuk jaringan lokal")
    ap.add_argument("--port", type=int, default=8765)
    args = ap.parse_args()

    host = "0.0.0.0" if args.lan else "127.0.0.1"
    try:
        srv = ThreadingHTTPServer((host, args.port), Handler)
    except OSError as e:
        print(f"Port {args.port} sedang dipakai ({e}). Tutup proses lain dulu.", file=sys.stderr)
        return 1
    daemon = threading.Thread(target=srv.serve_forever, daemon=False)
    daemon.start()
    threading.Thread(target=kandidat_loop, daemon=True).start()
    threading.Thread(target=snapshot_loop, daemon=True).start()
    print(f"Radar Backdoor berjalan di http://localhost:{args.port}")
    print(f"Token Stockbit: {'terbaca' if get_token() else 'belum ada (tidak wajib untuk mode page)'}")
    if args.lan:
        import socket
        ips = set()
        try:
            for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
                ip = info[4][0]
                if not ip.startswith("127."):
                    ips.add(ip)
        except OSError:
            pass
        if ips:
            print("\nBuka dari perangkat lain di jaringan lokal:")
            for ip in sorted(ips):
                print(f"  http://{ip}:{args.port}/")
    try:
        daemon.join()
    except KeyboardInterrupt:
        print("\nServer dimatikan.")
        srv.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
