@echo off
REM Script para gerar APK do Manga Offline (Windows)
REM Uso: scripts\build-apk.bat [debug|release]

setlocal enabledelayedexpansion

set BUILD_TYPE=%1
if "%BUILD_TYPE%"=="" set BUILD_TYPE=debug

echo.
echo 🚀 Iniciando build do APK (%BUILD_TYPE%)...
echo.

REM Verificar se o Node.js está instalado
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Node.js não encontrado!
    echo 📥 Instale o Node.js: https://nodejs.org/
    exit /b 1
)

REM Verificar se o JAVA_HOME está configurado
if "%JAVA_HOME%"=="" (
    echo ⚠️  JAVA_HOME não configurado!
    echo Configure a variável JAVA_HOME nas variáveis de ambiente
)

REM Verificar se o ANDROID_HOME está configurado
if "%ANDROID_HOME%"=="" (
    echo ⚠️  ANDROID_HOME não configurado!
    echo Configure a variável ANDROID_HOME nas variáveis de ambiente
)

REM Verificar se o Capacitor está instalado
npm list @capacitor/core >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo 📦 Instalando Capacitor...
    call npm install @capacitor/core @capacitor/cli @capacitor/android
)

REM Verificar se a plataforma Android foi adicionada
if not exist "android" (
    echo 📱 Adicionando plataforma Android...
    call npx cap add android
)

REM Build da aplicação web
echo 🔨 Fazendo build da aplicação web...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo ❌ Erro no build da aplicação web!
    exit /b 1
)

REM Sincronizar com Android
echo 🔄 Sincronizando com projeto Android...
call npx cap sync android
if %ERRORLEVEL% neq 0 (
    echo ❌ Erro na sincronização!
    exit /b 1
)

REM Gerar APK
cd android
if "%BUILD_TYPE%"=="release" (
    echo 🔐 Gerando APK Release...
    call gradlew.bat assembleRelease
    set APK_PATH=app\build\outputs\apk\release\app-release.apk
) else (
    echo 🔧 Gerando APK Debug...
    call gradlew.bat assembleDebug
    set APK_PATH=app\build\outputs\apk\debug\app-debug.apk
)
cd ..

REM Verificar se o APK foi gerado
if exist "android\%APK_PATH%" (
    echo.
    echo ✅ APK gerado com sucesso!
    echo 📍 Localização: android\%APK_PATH%
    echo.
    echo 📲 Para instalar no celular:
    echo    1. Conecte o celular via USB
    echo    2. Execute: adb install android\%APK_PATH%
    echo    Ou transfira o arquivo para o celular e instale manualmente
) else (
    echo ❌ Erro: APK não foi gerado!
    exit /b 1
)

endlocal
