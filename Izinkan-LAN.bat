@echo off
rem SEKALI SAJA. Klik kanan > Run as administrator.
rem 1) Izinkan akun Anda membuka port 8765 untuk jaringan (URL ACL).
rem 2) Buka firewall Windows untuk port 8765 pada jaringan Public & Private,
rem    HANYA dari perangkat di subnet yang sama (remoteip=localsubnet).
rem    Akses tetap butuh kunci di link (lihat jendela Jalankan-Radar-LAN.bat).
net session >nul 2>&1 || (echo Jalankan file ini dengan klik kanan ^> Run as administrator. & pause & exit /b 1)
netsh http add urlacl url=http://+:8765/ user="%USERDOMAIN%\%USERNAME%"
netsh advfirewall firewall delete rule name="Radar Backdoor 8765" >nul 2>&1
netsh advfirewall firewall add rule name="Radar Backdoor 8765" dir=in action=allow protocol=TCP localport=8765 profile=public,private remoteip=localsubnet
echo.
echo Selesai. Sekarang jalankan Jalankan-Radar-LAN.bat dan bagikan link yang ditampilkan.
echo Untuk mencabut izin (sebagai Administrator):
echo   netsh http delete urlacl url=http://+:8765/
echo   netsh advfirewall firewall delete rule name="Radar Backdoor 8765"
pause
