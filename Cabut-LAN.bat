@echo off
rem Mencabut izin jaringan Radar Backdoor (kebalikan Izinkan-LAN.bat).
rem Klik kanan > Run as administrator.
net session >nul 2>&1 || (echo Jalankan file ini dengan klik kanan ^> Run as administrator. & pause & exit /b 1)
netsh http delete urlacl url=http://+:8765/
netsh advfirewall firewall delete rule name="Radar Backdoor 8765"
echo.
echo Izin jaringan dicabut. Website hanya bisa dibuka dari laptop ini (Jalankan-Radar.bat).
pause
