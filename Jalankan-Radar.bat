@echo off
rem Klik dua kali untuk menjalankan Radar Backdoor di http://localhost:8765
start "" http://localhost:8765
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0website\serve.ps1"
