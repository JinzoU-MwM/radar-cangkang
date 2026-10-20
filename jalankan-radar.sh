#!/usr/bin/env bash
# Linux: jalankan Radar Backdoor di port 8765, terbuka untuk jaringan lokal (LAN/Tailscale).
# --local: hanya komputer ini.
cd "$(dirname "$0")"
if [ "$1" = "--local" ]; then
  exec python3 website/server.py --port 8765
else
  exec python3 website/server.py --port 8765 --lan
fi
