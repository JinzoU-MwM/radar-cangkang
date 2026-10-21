#!/usr/bin/env python3
"""Tarik data pasar dari API tradersaham.com (apiv2) ke website/tsa-*.json.

Data yang ditarik: signals-v2 (teknikal+broker), gems, foreign-flow,
broker-scanner, latest-date → disimpan sebagai snapshot keyed-by-ticker
untuk endpoint /api/tsa/summary dan tab "Intel Pasar".

Auth: Firebase email/password (akun khusus). Kredensial dibaca dari
website/.tsa-creds.json: {"email": "...", "password": "..."  }
Bila file tidak ada, dipakai env TSA_EMAIL / TSA_PASSWORD.
Token dibuat/diperbarui otomatis tiap run (berlaku 1 jam).

Jalankan: python3 website/tsa_refresh.py [--semua] [--outhiraukan-gagal]
Default: hanya menimpa file yang tariknya sukses; gagal satu sumber tidak
menggugurkan sumber lain.
"""
import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
API = "https://apiv2.tradersaham.com/api"
FB_KEY = "AIzaSyAHxkS9wQ0iT2hImeDu5MalWfYboHARTAI"  # public web key (sama dengan frontend situs)
CREDS_FILE = ROOT / ".tsa-creds.json"
LIMIT = 100          # clamp server
MAX_PAGES = 12       # pengaman anti-loop
DELAY = 0.35         # jeda antar halaman (rate limit 3000/900s — longgar, tetap sopan)

TOKEN_FILE = Path("/tmp/tsa_token.json")  # cache token antar-run (opsional)


def rq_headers(path: str) -> dict:
    """Header anti-bot X-RQ-T/X-RQ-S. Formula dari pengamatan: S = base64(
    url_last4 + T + 'trs_idx_v2_2024')[5:21]. (Sebagian endpoint menolak
    tanpa ini meski ada Bearer.)"""
    t = str(int(time.time() * 1000))
    s = base64.b64encode((path[-4:] + t + "trs_idx_v2_2024").encode()).decode()
    return {"X-RQ-T": t, "X-RQ-S": s[5:21]}


def http_json(url, token=None, method="GET", body=None, rq=False):
    req = urllib.request.Request(url, method=method)
    req.add_header("User-Agent", "Mozilla/5.0 (radar-cangkang sync)")
    if rq:
        for k, v in rq_headers(url.split("?", 1)[0]).items():
            req.add_header(k, v)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, data=data, timeout=40) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"null")
        except ValueError:
            return e.code, {}
    except (urllib.error.URLError, OSError, ValueError) as e:
        return 0, {"error": str(e)}


def get_token():
    """Login Firebase email/password → idToken. Cache 45 menit di /tmp."""
    if TOKEN_FILE.exists():
        try:
            t = json.loads(TOKEN_FILE.read_text())
            # idToken berlaku 3600s; cache 45 menit aman
            if time.time() - t.get("_at", 0) < 2700:
                return t["idToken"]
        except (OSError, ValueError, KeyError):
            pass
    if CREDS_FILE.exists():
        creds = json.loads(CREDS_FILE.read_text())
    else:
        creds = {"email": os.environ.get("TSA_EMAIL"), "password": os.environ.get("TSA_PASSWORD")}
    if not creds.get("email") or not creds.get("password"):
        sys.exit("Kredensial tidak ada: buat website/.tsa-creds.json atau set TSA_EMAIL/TSA_PASSWORD")
    body = {"email": creds["email"], "password": creds["password"], "returnSecureToken": True}
    st, r = http_json(f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FB_KEY}",
                      method="POST", body=body)
    if st != 200 or "idToken" not in r:
        # fallback: daftar akun baru bila login gagal (misal akun belum ada)
        st, r = http_json(f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={FB_KEY}",
                          method="POST", body=body)
    if st != 200 or "idToken" not in r:
        sys.exit(f"Firebase auth gagal ({st}): {json.dumps(r)[:200]}")
    TOKEN_FILE.write_text(json.dumps({**r, "_at": time.time()}))
    return r["idToken"]


def sync_user(token):
    http_json(f"{API}/auth/login", token=token, method="POST", body={"idToken": "x"})


def fetch_all_pages(path, token, extra=""):
    """Ambil semua halaman endpoint ber-paginasi; kembalikan list `data`."""
    rows, page = [], 1
    while page <= MAX_PAGES:
        st, r = http_json(f"{API}{path}?page={page}&limit={LIMIT}{extra}", token)
        if st != 200:
            raise RuntimeError(f"{path} page {page}: {st} {json.dumps(r)[:120]}")
        rows.extend(r.get("data", []))
        tp = r.get("total_pages") or r.get("totalPages") or 1
        if page >= tp:
            break
        page += 1
        time.sleep(DELAY)
    return rows


def tarik_semua(token, include_ff=True):
    hasil = {}
    # 1. signals-v2
    try:
        rows = fetch_all_pages("/analytics/screener/signals-v2", token)
        hasil["signals"] = {x["stockCode"]: x for x in rows if x.get("stockCode")}
        print(f"signals: {len(hasil['signals'])} emiten")
    except RuntimeError as e:
        print(f"signals GAGAL: {e}", file=sys.stderr)
    # 2. gems
    try:
        rows = fetch_all_pages("/analytics/screener/gems", token)
        hasil["gems"] = {x["stockCode"]: x for x in rows if x.get("stockCode")}
        print(f"gems: {len(hasil['gems'])} emiten")
    except RuntimeError as e:
        print(f"gems GAGAL: {e}", file=sys.stderr)
    # 3. foreign-flow (444 emiten; bila include_ff)
    if include_ff:
        try:
            rows = fetch_all_pages("/analytics/screener/foreign-flow", token)
            hasil["foreign-flow"] = rows
            print(f"foreign-flow: {len(rows)} baris")
        except RuntimeError as e:
            print(f"foreign-flow GAGAL: {e}", file=sys.stderr)
    # 4. broker-scanner (butuh rentang tanggal + header X-RQ). Data saham hari
    # ini baru lengkap setelah bursa tutup; fallback mundur 3 hari.
    try:
        def _bs(a, b):
            return http_json(f"{API}/analytics/broker-scanner?start_date={a}&end_date={b}",
                             token, rq=True)
        today = date.today()
        st, r = _bs(today.isoformat(), today.isoformat())
        if st != 200 or not r.get("stocks"):
            st, r = _bs((today - timedelta(days=3)).isoformat(), today.isoformat())
        if st != 200:
            raise RuntimeError(f"{st} {json.dumps(r)[:120]}")
        hasil["broker-scanner"] = r
        print(f"broker-scanner: {len(r.get('stocks', []))} emiten")
    except RuntimeError as e:
        print(f"broker-scanner GAGAL: {e}", file=sys.stderr)
    # 5. latest-date (tanggal data aktual)
    st, r = http_json(f"{API}/analytics/screener/latest-date", token)
    hasil["latest_date"] = r.get("date") if st == 200 else None
    return hasil


def simpan(hasil):
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    if "signals" in hasil:
        (ROOT / "tsa-signals.json").write_text(
            json.dumps(hasil["signals"], ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    if "gems" in hasil:
        (ROOT / "tsa-gems.json").write_text(
            json.dumps(hasil["gems"], ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    if "foreign-flow" in hasil:
        (ROOT / "tsa-foreign-flow.json").write_text(
            json.dumps(hasil["foreign-flow"], ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    if "broker-scanner" in hasil:
        (ROOT / "tsa-broker-scanner.json").write_text(
            json.dumps(hasil["broker-scanner"], ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (ROOT / "tsa-meta.json").write_text(json.dumps({
        "sumber": "tradersaham.com apiv2 (IDX backend read-only)",
        "tarik": now,
        "tanggal_data": hasil.get("latest_date"),
        "catatan": "Refresh otomatis via website/tsa_refresh.py",
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    return now


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--tanpa-ff", action="store_true", help="lewati foreign-flow (speed up)")
    args = ap.parse_args()
    token = get_token()
    sync_user(token)
    hasil = tarik_semua(token, include_ff=not args.tanpa_ff)
    if not (hasil.get("signals") or hasil.get("gems")):
        sys.exit("Data inti (signals/gems) gagal semua — file lama tidak ditimpa.")
    now = simpan(hasil)
    print(f"Selesai {now}; tanggal data: {hasil.get('latest_date')}")


if __name__ == "__main__":
    main()
