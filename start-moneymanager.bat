@echo off
title MoneyManager local server
cd /d "%~dp0"
echo.
echo  Starting MoneyManager from %cd%
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
if %errorlevel% neq 0 (
  echo.
  echo  Trying the backup starter...
  where py >nul 2>nul && ( start "" http://localhost:5500/ & py -m http.server 5500 --bind 127.0.0.1 & goto end )
  where python >nul 2>nul && ( start "" http://localhost:5500/ & python -m http.server 5500 --bind 127.0.0.1 & goto end )
  echo  No backup starter found. Double-click index.html to preview the site instead.
)
:end
echo.
echo  The server has stopped. You can close this window.
pause
