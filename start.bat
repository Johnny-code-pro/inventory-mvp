@echo off
title Inventory MVP - Start
set "ROOT=%~dp0"

echo ============================================
echo   Inventory MVP System - Start
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found, please install https://nodejs.org/
  pause
  exit /b 1
)

if not exist "%ROOT%server\node_modules" (
  echo [1/3] Installing backend dependencies...
  pushd "%ROOT%server"
  call npm install
  popd
)
if not exist "%ROOT%frontend\node_modules" (
  echo [1/3] Installing frontend dependencies...
  pushd "%ROOT%frontend"
  call npm install
  popd
)

REM build frontend once (fast on next starts)
if not exist "%ROOT%frontend\dist\index.html" (
  echo [2/3] Building frontend...
  pushd "%ROOT%frontend"
  call npm run build
  popd
) else (
  echo [2/3] Frontend already built
)

echo [3/3] Starting service (single port 3000)...
pushd "%ROOT%server"
start "inv-backend" cmd /k "node app.js"
popd

ping 127.0.0.1 -n 6 >nul

start http://127.0.0.1:3000

echo.
echo ============================================
echo   Startup complete!
echo   Local    : http://127.0.0.1:3000
echo   LAN      : http://YOUR-LAN-IP:3000 (see backend window)
echo   Login    : admin/admin123  or  operator/123456
echo   Tunnel   : run frp/start-frpc.bat for internet access
echo   Stop     : close the black backend window
echo ============================================
echo.
pause
