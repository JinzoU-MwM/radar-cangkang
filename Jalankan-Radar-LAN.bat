@echo off
rem Jalankan Radar Backdoor agar bisa dibuka dari perangkat lain di jaringan lokal (port 8765).
rem Sekali saja sebelumnya, jalankan Izinkan-LAN.bat sebagai Administrator.
start "" http://localhost:8765
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0website\serve.ps1" -Lan
pause
