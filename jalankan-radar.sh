#!/usr/bin/env bash
# Linux: jalankan Radar Backdoor di port 8765, terbuka untuk jaringan lokal (LAN/Tailscale).
# --local: hanya komputer ini. Frontend Vue dibangun dulu bila website/dist belum ada.
cd "$(dirname "$0")"
if [ ! -f website/dist/index.html ]; then
  echo "Membangun frontend (sekali)..."
  (cd frontend && { [ -d node_modules ] || npm ci; } && npm run build) || exit 1
fi
if [ "$1" = "--local" ]; then
  exec python3 website/server.py --port 8765
else
  exec python3 website/server.py --port 8765 --lan
fi
