@echo off
title Manga Offline - Continuando Download Anterior
color 0e
chcp 65001 >nul

echo ========================================================
echo   MANGA OFFLINE - RETOMANDO DOWNLOAD ANTERIOR
echo ========================================================
echo.

cd /d "%~dp0\telegram-bot"

:loop
echo [%date% %time%] Retomando de onde parou...
node download-all-chapters.js --resume

echo.
echo [!] Reiniciando em 10 segundos...
timeout /t 10 /nobreak >nul
goto loop