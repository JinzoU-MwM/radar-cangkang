#!/usr/bin/env bash
# Ambil refreshToken & idToken Firebase dari perangkat ini (halaman tradersaham
# yang lagi login di browser Firefox/Chromium), lalu tulis ke website/.tsa-creds.json.
#
# Cara pakai:
#   1. Buka https://www.tradersaham.com di browser dan login.
#   2. Jalankan script ini. Ia otomatis:
#      - mencari profile browser Firefox/Chromium di mesin ini
#      - mengekstrak refreshToken + email dari IndexedDB firebaseLocalStorageDb
#      - menulis website/.tsa-creds.json (format: {"refreshToken": ..., "email": ...})
#      - menukar refreshToken jadi idToken baru, cek saldo/trial via apiv2
#
# Kalau ekstraksi dari IndexedDB gagal (proyeksi izin berkas browser), script
# juga support cara manual: tempel refreshToken lewat flag --token.

set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
CREDS="$REPO/website/.tsa-refresh"
BEARER="$REPO/website/.tsa-token"
KEY="AIzaSyAHxkS9wQ0iT2hImeDu5MalWfYboHARTAI"          # public web key (sama dengan frontend)
FIREBASE_DB="firebaseLocalStorageDb"
API="https://apiv2.tradersaham.com/api"

RED=$'\e[31m'; GRN=$'\e[32m'; YLW=$'\e[33m'; RST=$'\e[0m'
log()  { printf '%s\n' "${YLW}[*]${RST} $*"; }
ok()   { printf '%s\n' "${GRN}[+]${RST} $*"; }
err()  { printf '%s\n' "${RED}[!]${RST} $*" >&2; }
need() { command -v "$1" >/dev/null 2>&1 || { err "butuh '$1' — install dulu"; exit 2; }; }

need python3

# ---------------------------------------------------------------- argumen
MODE="auto"
TOKEN=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --token) MODE="manual"; TOKEN="${2:-}"; shift 2 ;;
    --help|-h) sed -n '2,12p' "$0"; exit 0 ;;
    *) err "argumen tidak dikenal: $1"; exit 2 ;;
  esac
done

# ---------------------------------------------------------------- helper
exchange_refresh_token() {
  # Firebase Secure Token API: tukar refreshToken jadi idToken baru
  local rt="$1"
  python3 - "$rt" "$KEY" <<'PY'
import json, sys, urllib.request, urllib.error, urllib.parse
rt, key = sys.argv[1], sys.argv[2]
body = urllib.parse.urlencode({
    "grant_type": "refresh_token", "refresh_token": rt}).encode()
req = urllib.request.Request(
    f"https://securetoken.googleapis.com/v1/token?key={key}", data=body, method="POST")
try:
    with urllib.request.urlopen(req, timeout=20) as r:
        d = json.loads(r.read())
except urllib.error.HTTPError as e:
    print(json.dumps({"error": e.code, "body": e.read().decode()[:200]}))
    sys.exit(1)
print(json.dumps({"id_token": d["id_token"],
                  "refresh_token": d["refresh_token"],
                  "user_id":     d.get("user_id"),
                  "email":       d.get("email","")}))
PY
}

check_tsa_access() {
  # Cek apakah token ini bisa akses apiv2 + seberapa jauh foreign-flow-nya
  local idtok="$1"
  python3 - "$idtok" "$API" <<'PY'
import json, sys, urllib.request, urllib.error
idtok, api = sys.argv[1], sys.argv[2]
def get(path):
    req = urllib.request.Request(f"{api}{path}")
    req.add_header("Authorization", f"Bearer {idtok}")
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, {}
st, d = get("/credits/balance")
if st != 200:
    # perlu /auth/login sync dulu (backend lokal simpan user)
    req = urllib.request.Request(f"{api}/auth/login", method="POST")
    req.add_header("Authorization", f"Bearer {idtok}")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "Mozilla/5.0 (radar-cangkang)")
    try:
        with urllib.request.urlopen(req, data=b'{"idToken":"x"}', timeout=20) as r:
            print("[*] sinkron akun ke backend:", r.status)
    except Exception as e:
        print("[!] sync gagal:", e)
    st, d = get("/credits/balance")
print(f"[*] credits/balance: {st} {json.dumps(d)[:140]}")
st, d = get("/analytics/screener/foreign-flow?page=1&limit=100")
if st == 200:
    uniq = len({x.get("stock_code") for x in d.get("data", [])})
    preview = d.get("is_preview")
    print(f"[*] foreign-flow: total={d.get('total_count')} "
          f"dapat={uniq} unik, pratinjau={preview}")
st, d = get("/analytics/screener/gems?page=1&limit=5")
print(f"[*] gems: {st} total={d.get('total')}")
st, d = get("/analytics/broker-scanner?start_date=2026-10-20&end_date=2026-10-20")
print(f"[*] broker-scanner: {st} stocks={len(d.get('stocks',[]))}")
PY
}

# ---------------------------------------------------------------- manual mode
if [[ "$MODE" == "manual" ]]; then
  [[ -n "$TOKEN" ]] || { err "--token kosong"; exit 2; }
  log "menukar refreshToken → idToken"
  OUT="$(exchange_refresh_token "$TOKEN")" || { err "$OUT"; exit 1; }
  EMAIL="$(echo "$OUT" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("email",""))')"
  RT="$(echo "$OUT" | python3 -c 'import json,sys;print(json.load(sys.stdin)["refresh_token"])')"
  printf '%s' "$RT" > "$CREDS"
  chmod 600 "$CREDS"
  ok "tersimpan ke $CREDS (email: ${EMAIL:-tidak diketahui})"
  IDT="$(echo "$OUT" | python3 -c 'import json,sys;print(json.load(sys.stdin)["id_token"])')"
  log "cek akses apiv2 dengan idToken ini"
  check_tsa_access "$IDT"
  exit 0
fi

# ---------------------------------------------------------------- auto mode
log "cari data IndexedDB firebaseLocalStorageDb di browser."

# Cari semua profile Firefox dan Chromium/Chrome yang kelihatan
FIREFOX_DIRS=("$HOME/.mozilla/firefox"/*)
CHROMIUM_DIRS=(
  "$HOME/.config/google-chrome"/*/*
  "$HOME/.config/chromium"/*/*
  "$HOME/.config/BraveSoftware/Brave-Browser"/*/*
  "$HOME/snap/firefox/common/.mozilla/firefox"/*
)
CANDS=()
for d in "${FIREFOX_DIRS[@]}" "${CHROMIUM_DIRS[@]}"; do
  [[ -d "$d" ]] && CANDS+=("$d")
done
if [[ ${#CANDS[@]} -eq 0 ]]; then
  err "tidak menemukan profile browser — jalankan manual: $0 --token <refreshToken>"
  exit 3
fi

log "profil kandidat: ${#CANDS[@]} — cari file IndexedDB '*.sqlite' yang cocok"
hits=()
for d in "${CANDS[@]}"; do
  while IFS= read -r f; do hits+=("$f"); done < <(find "$d" -name '*.sqlite' -path '*firebaseLocalStorage*' 2>/dev/null)
done
ok "file firebase IndexedDB ditemukan: ${#hits[@]}"

# Firefox/Chromium menyimpan IndexedDB dalam format binary-with-sqlite.
# Kita scan file-menjalan-byte yang mengandung substring 'refreshToken' di dekat
# apiKey tradersaham (AIzaSyAHxkS9wQ0iT2hImeDu5MalWfYboHARTAI) — pendekatan朴素
# yang efektif: cari blok byte tempat idToken+refreshToken adalah UUID-like string
# panjang yang menempel di sekitar apiKey.
mkdir -p /tmp/tsa-idx-extract
i=0
for f in "${hits[@]}"; do
  i=$((i+1))
  log "scanning $f"
  if grep -aob "AIzaSyAHxkS9wQ0iT2hImeDu5MalWfYboHARTAI" "$f" >/dev/null 2>&1; then
    cp "$f" "/tmp/tsa-idx-extract/profile-$i.sqlite"
    ok "match → /tmp/tsa-idx-extract/profile-$i.sqlite"
  fi
done

match_files=(/tmp/tsa-idx-extract/profile-*.sqlite)
if [[ ! -e "${match_files[0]}" ]]; then
  err "tidak ada file IndexedDB yang memuat apiKey tradersaham"
  err "pastikan sudah login di browser dan tutup browser dulu (agar SQLite flushed)"
  exit 4
fi

log "ekstrak refreshToken/email dari file match — but python sqlite3 + parsing blob"
python3 <<'PY'
import json, os, re, sqlite3, sys, glob

KEY = "AIzaSyAHxkS9wQ0iT2hImeDu5MalWfYboHARTAI"
out = {}
TARGET_KEY_PREFIX = "firebase:authUser:AIzaSyAHxkS9wQ0iT2hImeDu5MalWfYboHARTAI"
for path in sorted(glob.glob("/tmp/tsa-idx-extract/profile-*.sqlite")):
    try:
        con = sqlite3.connect(path)
        rows = con.execute(
            "SELECT key, value FROM firebaseLocalStorage ORDER BY key").fetchall()
        con.close()
    except Exception:
        continue
    for k, v in rows:
        ks = k.decode("utf-8", errors="ignore") if isinstance(k, bytes) else str(k)
        if not ks.startswith(TARGET_KEY_PREFIX):
            continue
        # nilai bisa: JSON string, bytes berisi JSON, atau dict
        if isinstance(v, bytes):
            v = v.decode("utf-8", errors="ignore")
        try:
            obj = json.loads(v) if isinstance(v, str) else v
        except Exception:
            continue
        val = obj.get("value", obj) if isinstance(obj, dict) else {}
        stm = (val or {}).get("stsTokenManager") or {}
        rt = stm.get("refreshToken")
        em = (val or {}).get("email") or ""
        uid = (val or {}).get("uid") or ""
        if rt and rt not in {x["refreshToken"] for x in out.values()}:
            out[em or uid or uid] = {"refreshToken": rt, "email": em, "uid": uid}
if not out:
    print("[!] tidak menemukan refreshToken di IndexedDB — coba jalankan manual:",
          file=sys.stderr)
    sys.exit(5)
# simpan semua kandidat
with open("/tmp/tsa-idx-extract/found.json", "w") as f:
    json.dump(out, f, indent=1)
print(json.dumps(out, indent=1))
PY
RC=$?
[[ $RC -eq 0 ]] || exit $RC

# Bila >1 akun, ambil yang pertama + beri tahu
N=$(python3 -c "import json;print(len(json.load(open('/tmp/tsa-idx-extract/found.json'))))")
if [[ "$N" -gt 1 ]]; then
  log "ditemukan $N akun — pakai yang pertama; cek semuanya di /tmp/tsa-idx-extract/found.json"
fi
RT="$(python3 -c "import json;d=json.load(open('/tmp/tsa-idx-extract/found.json'));print(next(iter(d.values()))['refreshToken'])")"
EMAIL="$(python3 -c "import json;d=json.load(open('/tmp/tsa-idx-extract/found.json'));print(next(iter(d.values())).get('email',''))")"

log "menukar refreshToken → idToken untuk validasi"
OUT="$(exchange_refresh_token "$RT")" || { err "$OUT"; exit 1; }
IDT="$(echo "$OUT" | python3 -c 'import json,sys;print(json.load(sys.stdin)["id_token"])')"
RT_NEW="$(echo "$OUT" | python3 -c 'import json,sys;print(json.load(sys.stdin)["refresh_token"])')"

printf '%s' "$RT_NEW" > "$CREDS"
chmod 600 "$CREDS"
ok "refresh token tersimpan ke $CREDS (email: ${EMAIL:-tidak diketahui})"

log "cek akses apiv2 dengan idToken ini"
check_tsa_access "$IDT"

ok "selesai. Sekarang jalankan: python3 $REPO/website/tsa_refresh.py"
