# 📱 Manga Offline - APK Build

## ⚡ Quick Start (5 minutos)

### 1. Instalar Dependências

```bash
# Instalar Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# Build da aplicação web
npm run build

# Adicionar plataforma Android
npx cap add android

# Sincronizar arquivos
npx cap sync android
```

### 2. Gerar APK

**Opção A: Via Script Automático**
```bash
# Linux/Mac
chmod +x scripts/build-apk.sh
./scripts/build-apk.sh debug

# Windows
scripts\build-apk.bat debug
```

**Opção B: Manualmente**
```bash
# Abrir no Android Studio
npx cap open android

# No Android Studio:
# Build → Build Bundle(s) / APK(s) → Build APK(s)
```

### 3. Instalar no Celular

```bash
# Via ADB (celular conectado via USB)
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Ou transfira o arquivo APK para o celular e instale manualmente
```

---

## 📋 Pré-requisitos

- ✅ Node.js 18+
- ✅ Android Studio
- ✅ Java JDK 17
- ✅ Android SDK configurado

**Guia completo:** [ANDROID_BUILD_GUIDE.md](./ANDROID_BUILD_GUIDE.md)

---

## 📦 Arquivos Gerados

- **APK Debug:** `android/app/build/outputs/apk/debug/app-debug.apk`
- **APK Release:** `android/app/build/outputs/apk/release/app-release.apk`

---

## 🔧 Configurações

### App ID
```
com.mangaoffline.app
```

### App Name
```
Manga Offline
```

### Versão
```
1.0.0
```

### Android Mínimo
```
API 22 (Android 5.1)
```

---

## 🧪 Testes

Antes de distribuir, teste:

- [ ] Importação de mangás
- [ ] Leitor funciona offline
- [ ] Progresso é salvo
- [ ] Favoritos funcionam
- [ ] Controles do leitor respondem ao toque
- [ ] App abre sem erros

---

## 📚 Documentação

- [Guia Completo de Build](./ANDROID_BUILD_GUIDE.md)
- [README Principal](./README.md)
- [Guia Rápido](./GUIA_RAPIDO.md)

---

## 🐛 Problemas?

Consulte o [Guia Completo](./ANDROID_BUILD_GUIDE.md#-problemas-comuns) para soluções de problemas comuns.

---

**Status:** ✅ Pronto para build
