@echo off
rem Windows: jalankan Radar Backdoor di komputer ini saja (http://localhost:8765).
rem Frontend Vue dibangun dulu bila website\dist belum ada (butuh Node.js 20+).
cd /d "%~dp0"
if exist website\dist\index.html goto run
echo Membangun frontend, sekali saja...
pushd frontend
if not exist node_modules call npm ci
call npm run build
if errorlevel 1 goto fail
popd
:run
start "" http://localhost:8765/
python website\server.py --port 8765 %*
pause
exit /b 0
:fail
popd
echo Build frontend gagal.
pause
exit /b 1
