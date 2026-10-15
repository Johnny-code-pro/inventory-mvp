@echo off
title Enable remote MySQL (3306) - CAUTION
REM 仅在"两台电脑共用一套数据库"且都在可信局域网时使用
REM 会向整个局域网开放 MySQL 3306 端口, 有被扫描爆破的风险
REM 强烈建议: 只在需要时临时开启, 用完即关(运行 close-mysql-remote.bat)

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting administrator permission...
  powershell -Command "Start-Process '%~f0' -Verb RunAs"
  exit /b
)

netsh advfirewall firewall delete rule name="Inventory-MVP-3306" >nul 2>&1
netsh advfirewall firewall add rule name="Inventory-MVP-3306" dir=in action=allow protocol=TCP localport=3306

echo.
echo WARNING: MySQL 3306 is now open to the whole LAN.
echo Only keep this on while needed, then close it.
echo.
pause
