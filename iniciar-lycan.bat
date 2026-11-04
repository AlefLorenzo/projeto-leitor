@echo off
chcp 65001 > nul
cls
echo ============================================================
echo   Manga Offline - Extrator LycanToons Adaptado
echo ============================================================
echo.
echo Este script baixa obras do LycanToons, organiza as paginas,
echo gera pacotes .cbz com hash SHA-256 e sincroniza direto com
echo a biblioteca e o leitor offline do aplicativo!
echo.
set /p OBRA_URL="Cole a URL da obra no LycanToons (ex: https://lycantoons.com/series/nome-da-obra): "

if "%OBRA_URL%"=="" (
    echo.
    echo Nenhuma URL informada. Saindo...
    pause
    exit /b
)

echo.
echo Modo de execucao:
echo 1. Modo Normal (Janela do Chrome visivel caso haja verificacao Cloudflare)
echo 2. Modo Oculto (Headless em segundo plano)
set /p MODO="Escolha (1 ou 2) [padrao 1]: "

if "%MODO%"=="2" (
    python "%~dp0scripts\lycan_extractor.py" %OBRA_URL%
) else (
    python "%~dp0scripts\lycan_extractor.py" %OBRA_URL% --visible
)

echo.
echo ============================================================
echo   Processo finalizado!
echo ============================================================
pause
