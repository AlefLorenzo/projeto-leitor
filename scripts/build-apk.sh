#!/bin/bash
# Script para gerar APK do Manga Offline
# Uso: ./scripts/build-apk.sh [debug|release]

set -e

BUILD_TYPE=${1:-debug}
APP_NAME="Manga Offline"
APP_ID="com.mangaoffline.app"

echo "🚀 Iniciando build do APK ($BUILD_TYPE)..."
echo ""

# Verificar se o Android Studio está instalado
if ! command -v sdkmanager &> /dev/null; then
    echo "❌ Android SDK não encontrado!"
    echo "📥 Instale o Android Studio: https://developer.android.com/studio"
    exit 1
fi

# Verificar se o Capacitor está instalado
if ! npm list @capacitor/core &> /dev/null; then
    echo "📦 Instalando Capacitor..."
    npm install @capacitor/core @capacitor/cli @capacitor/android
fi

# Verificar se a plataforma Android foi adicionada
if [ ! -d "android" ]; then
    echo "📱 Adicionando plataforma Android..."
    npx cap add android
fi

# Build da aplicação web
echo "🔨 Fazendo build da aplicação web..."
npm run build

# Sincronizar com Android
echo "🔄 Sincronizando com projeto Android..."
npx cap sync android

# Gerar APK
if [ "$BUILD_TYPE" = "release" ]; then
    echo "🔐 Gerando APK Release..."
    cd android
    ./gradlew assembleRelease
    cd ..
    
    APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
else
    echo "🔧 Gerando APK Debug..."
    cd android
    ./gradlew assembleDebug
    cd ..
    
    APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
fi

# Verificar se o APK foi gerado
if [ -f "$APK_PATH" ]; then
    APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
    echo ""
    echo "✅ APK gerado com sucesso!"
    echo "📍 Localização: $APK_PATH"
    echo "📏 Tamanho: $APK_SIZE"
    echo ""
    echo "📲 Para instalar no celular:"
    echo "   1. Conecte o celular via USB"
    echo "   2. Execute: adb install $APK_PATH"
    echo "   Ou transfira o arquivo para o celular e instale manualmente"
else
    echo "❌ Erro: APK não foi gerado!"
    exit 1
fi
