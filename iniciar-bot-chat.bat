@echo off
title Manga Offline - Assistente no Chat do Telegram
color 0a
chcp 65001 >nul

echo ========================================================
echo   MANGA OFFLINE - ASSISTENTE NO CHAT DO TELEGRAM
echo ========================================================
echo.
echo [*] Este bot atende comandos nas suas Mensagens Salvas!
echo [*] Abra o Telegram e envie /status, /obras, /baixar
echo [*] Voce acompanha e escolhe as obras direto pelo Telegram!
echo.

cd /d "%~dp0\telegram-bot"

:loop
echo [%date% %time%] Iniciando assistente...
node telegram-controller.js

echo.
echo [!] Reiniciando em 5 segundos...
timeout /t 5 /nobreak >nul
goto loop