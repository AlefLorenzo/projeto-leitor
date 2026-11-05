@echo off
chcp 65001 > nul
cls
title Sincronizador Automatico Git - Projeto Leitor
echo ============================================================
echo   Sincronizador Automatico com GitHub (Auto-Sync)
echo ============================================================
echo.
echo Este script fica em execucao monitorando a pasta do projeto.
echo Qualquer arquivo alterado, criado ou excluido sera enviado
echo automaticamente para o seu repositorio no GitHub.
echo.
echo Pressione Ctrl + C para fechar quando terminar de trabalhar.
echo ============================================================
echo.
node "%~dp0scripts\auto-sync-git.js"
pause

