@echo off
title Close remote MySQL (3306)
REM 关闭防火墙上的 MySQL 3306 入站规则(用完即关, 降低风险)

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting administrator permission...
  powershell -Command "Start-Process '%~f0' -Verb RunAs"
  exit /b
)

netsh advfirewall firewall delete rule name="Inventory-MVP-3306" >nul 2>&1

echo Done. MySQL 3306 remote access is closed.
pause
