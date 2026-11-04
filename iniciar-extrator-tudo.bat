@echo off
title Manga Offline - Extrator COMPLETO (Todas as Obras)
color 0a
chcp 65001 >nul

echo ========================================================
echo   MANGA OFFLINE - BAIXANDO TODAS AS OBRAS
echo ========================================================
echo.

cd /d "%~dp0\telegram-bot"

:loop
echo [%date% %time%] Baixando todas as obras...
node download-all-chapters.js --all

echo.
echo [!] Reiniciando em 10 segundos para verificar novos capitulos...
timeout /t 10 /nobreak >nul
goto loop