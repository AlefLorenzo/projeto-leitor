@echo off
title Manga Offline - Extrator de Mangas/Manhwas do Telegram
color 0b
chcp 65001 >nul

echo ========================================================
echo   MANGA OFFLINE - EXTRATOR DE CAPITULOS DO TELEGRAM
echo ========================================================
echo.
echo [*] Este script escaneia seus canais e grupos do Telegram.
echo [*] Voce pode escolher quantas e quais obras baixar!
echo [*] Se fechar e reabrir, ele continua de onde parou.
echo [*] Pressione Ctrl + C para pausar a qualquer momento.
echo.

cd /d "%~dp0\telegram-bot"

:loop
echo [%date% %time%] Iniciando extrator...
node download-all-chapters.js %*

echo.
echo [!] Processo finalizado. Reiniciando em 10 segundos...
echo [!] Pressione Ctrl+C para sair, ou espere para retomar.
timeout /t 10 /nobreak >nul
goto loop