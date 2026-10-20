#!/usr/bin/env bash
# Linux: jalankan Radar Backdoor di port 8765, terbuka untuk jaringan lokal (LAN/Tailscale).
# --local: hanya komputer ini.
cd "$(dirname "$0")"
[ "$1" = "--local" ] || LAN=-Lan
(sleep 2; xdg-open http://localhost:8765 >/dev/null 2>&1) &
exec pwsh -NoProfile -File website/serve.ps1 $LAN
