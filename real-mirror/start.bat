@echo off
chcp 65001 >nul
title Active Theory Mirror
cd /d "%~dp0"

echo ============================================================
echo   Active Theory - byte-exact local mirror (personal study)
echo ============================================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python not found. Install Python 3 from python.org
  pause
  exit /b 1
)

if not exist "site\index.html" (
  echo [1/2] First run - downloading ~180 MB of real assets...
  echo       (only once; subsequent runs skip existing files)
  python tools\build.py
  if errorlevel 1 ( echo [ERROR] build failed & pause & exit /b 1 )
) else (
  echo [OK] site\ already built.
)

echo.
echo [2/2] Starting local server on http://127.0.0.1:8080
echo       Opening GPU self-check page first...
echo       Press Ctrl+C to stop the server.
echo.

start "" "http://127.0.0.1:8080/check-gpu.html"
python tools\serve.py 8080
pause
