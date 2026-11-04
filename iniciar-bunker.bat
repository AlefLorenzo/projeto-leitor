@echo off
title Bunker Mangas - Extrator em Massa
color 0d
chcp 65001 >nul

echo ========================================================
echo   BUNKER MANGAS - EXTRATOR EM MASSA
echo ========================================================
echo.
echo [*] Este script le o catalogo do Bunker Mangas - Brasil
echo [*] Entra em cada canal de obra e baixa os capitulos CBZ
echo [*] Se fechar e reabrir, retoma de onde parou!
echo [*] 174 obras disponiveis para baixar.
echo.

cd /d "%~dp0\telegram-bot"

:loop
echo [%date% %time%] Iniciando extrator Bunker...
node bunker-extractor.js

echo.
echo [!] Finalizado ou reiniciando em 15 segundos...
timeout /t 15 /nobreak >nul
goto loop