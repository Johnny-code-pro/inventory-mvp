@echo off
title Enable LAN access for port 3000
REM Self-elevate to admin, then open Windows Firewall for inbound TCP 3000
REM So other computers on the same network can visit http://LAN-IP:3000
REM NOTE: This ONLY opens the web port 3000. MySQL port 3306 is NOT opened here
REM for security. Only run enable-mysql-remote.bat if you REALLY need the
REM "share one database" feature on your trusted office LAN.

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting administrator permission...
  powershell -Command "Start-Process '%~f0' -Verb RunAs"
  exit /b
)

netsh advfirewall firewall delete rule name="Inventory-MVP-3000" >nul 2>&1
netsh advfirewall firewall add rule name="Inventory-MVP-3000" dir=in action=allow protocol=TCP localport=3000

echo.
echo Done. Port 3000 is now open on Windows Firewall.
echo Other computers on the same network can visit:  http://YOUR-LAN-IP:3000
echo.
echo Security note: MySQL 3306 is NOT exposed. If you need the shared-DB
echo feature, run enable-mysql-remote.bat separately (trusted LAN only).
echo.
pause
