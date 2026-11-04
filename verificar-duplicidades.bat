@echo off
title Manga Offline - Verificador de Duplicidades
color 0b
chcp 65001 >nul

echo ========================================================
echo   MANGA OFFLINE - VERIFICADOR ANTI-DUPLICIDADE
echo ========================================================
echo.
echo [*] Este script varre a pasta library/ e o catalog.json.
echo [*] Detecta e mescla obras com nomes parecidos (-manhwa, -manga, etc.)
echo [*] Garante que nenhum capitulo ou pagina seja baixado duas vezes.
echo.

cd /d "%~dp0\telegram-bot"

node deduplicator.cjs

echo.
echo ========================================================
pause
