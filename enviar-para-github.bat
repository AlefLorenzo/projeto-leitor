@echo off
chcp 65001 > nul
cls
echo ============================================================
echo   Manga Offline - Envio Incremental para o GitHub
echo ============================================================
echo.
echo Este script publica o catalogo e os capitulos compactados (.cbz)
echo no repositorio do GitHub em lotes seguros para evitar erros de rede.
echo.
pause
cd /d "%~dp0\telegram-bot"
node push-to-github.js
echo.
pause
