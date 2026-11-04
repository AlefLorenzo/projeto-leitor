# 📱 Guia Completo - Gerar APK do Manga Offline

## ⚠️ IMPORTANTE - Leia Primeiro

**O ambiente web atual não pode gerar APK diretamente.** Este guia ensina como gerar o APK no seu computador local usando **Capacitor** (framework oficial para empacotar apps web como Android nativo).

**Tempo estimado:** 30-60 minutos na primeira vez (depois, apenas 2-3 minutos para rebuilds)

---

## 📋 Pré-requisitos

Antes de começar, instale no seu computador:

### 1. Node.js (v18 ou superior)
- Download: https://nodejs.org/
- Verificar: `node --version`

### 2. Android Studio
- Download: https://developer.android.com/studio
- Durante instalação, marque:
  - ✅ Android SDK
  - ✅ Android SDK Platform
  - ✅ Android Virtual Device (opcional, para emulador)

### 3. Java JDK 17
- O Android Studio instala automaticamente
- Verificar: `java --version`

### 4. Configurar Variáveis de Ambiente

**Windows:**
```powershell
# Adicionar ao PATH do sistema:
ANDROID_HOME=C:\Users\SEU_USUARIO\AppData\Local\Android\Sdk
JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
```

**Linux/Mac:**
```bash
# Adicionar ao ~/.bashrc ou ~/.zshrc:
export ANDROID_HOME=$HOME/Android/Sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools
```

---

## 🚀 Passo a Passo - Gerar APK

### Passo 1: Preparar o Projeto

```bash
# Navegue até a pasta do projeto
cd manga-offline

# Instale as dependências
npm install

# Instale Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# Inicialize Capacitor (se ainda não inicializado)
npx cap init "Manga Offline" "com.mangaoffline.app" --web-dir=dist
```

### Passo 2: Build da Aplicação Web

```bash
# Gere os arquivos otimizados
npm run build
```

Isso cria a pasta `dist/` com todos os arquivos web otimizados.

### Passo 3: Adicionar Plataforma Android

```bash
# Adicione a plataforma Android
npx cap add android

# Sincronize os arquivos web com o projeto Android
npx cap sync android
```

Isso cria a pasta `android/` com o projeto Android completo.

### Passo 4: Abrir no Android Studio

```bash
# Abra o projeto no Android Studio
npx cap open android
```

O Android Studio abrirá automaticamente. Aguarde o Gradle sincronizar (pode levar alguns minutos na primeira vez).

### Passo 5: Gerar APK Debug (para testes)

No Android Studio:
1. Menu: **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Aguarde a compilação (2-5 minutos)
3. O APK será gerado em: `android/app/build/outputs/apk/debug/app-debug.apk`

**Ou via linha de comando:**
```bash
cd android
./gradlew assembleDebug
```

O APK estará em: `android/app/build/outputs/apk/debug/app-debug.apk`

### Passo 6: Gerar APK Release (assinado, para distribuição)

#### 6.1. Criar Chave de Assinatura

```bash
# Gere uma keystore (chave de assinatura)
keytool -genkey -v -keystore manga-offline.keystore -alias manga-offline -keyalg RSA -keysize 2048 -validity 10000
```

Você será solicitado a criar uma senha. **ANOTE ESTA SENHA!** Você precisará dela para futuras atualizações.

**IMPORTANTE:** 
- Guarde o arquivo `manga-offline.keystore` em local seguro
- NÃO compartilhe este arquivo
- NÃO coloque no Git/GitHub
- Se perder, não poderá atualizar o app na Play Store

#### 6.2. Configurar Assinatura no Gradle

Edite o arquivo `android/app/build.gradle` e adicione:

```gradle
android {
    // ... configurações existentes ...
    
    signingConfigs {
        release {
            storeFile file('../../manga-offline.keystore')
            storePassword 'SUA_SENHA_AQUI'
            keyAlias 'manga-offline'
            keyPassword 'SUA_SENHA_AQUI'
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

**SEGURANÇA:** Para não colocar a senha no código, crie o arquivo `android/keystore.properties`:

```properties
storePassword=SUA_SENHA_AQUI
keyPassword=SUA_SENHA_AQUI
keyAlias=manga-offline
storeFile=../../manga-offline.keystore
```

E no `build.gradle`:

```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('keystore.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
        }
    }
}
```

#### 6.3. Gerar APK Release

No Android Studio:
1. Menu: **Build** → **Generate Signed Bundle / APK**
2. Selecione **APK**
3. Selecione a keystore criada
4. Selecione **release**
5. Marque **V1 (Jar Signature)** e **V2 (Full APK Signature)**
6. Clique em **Finish**

**Ou via linha de comando:**
```bash
cd android
./gradlew assembleRelease
```

O APK estará em: `android/app/build/outputs/apk/release/app-release.apk`

---

## 📲 Instalar no Celular

### Método 1: Via Cabo USB

1. Ative o **Modo Desenvolvedor** no celular:
   - Configurações → Sobre o telefone → Toque 7 vezes em "Número da build"
2. Ative **Depuração USB**:
   - Configurações → Opções do desenvolvedor → Depuração USB
3. Conecte o celular ao computador via USB
4. No Android Studio, selecione seu dispositivo
5. Clique em **Run** (▶️) ou execute:
   ```bash
   npx cap run android
   ```

### Método 2: Transferir APK

1. Copie o arquivo `app-release.apk` para o celular (USB, Bluetooth, email, etc.)
2. No celular, abra o arquivo APK
3. Permita **Instalar de fontes desconhecidas** se solicitado
4. Toque em **Instalar**
5. Aguarde a instalação concluir

### Método 3: Via ADB (linha de comando)

```bash
# Com o celular conectado via USB
adb install android/app/build/outputs/apk/release/app-release.apk
```

---

## 🧪 Testes Obrigatórios

Antes de distribuir, teste todas as funcionalidades:

### Testes Básicos
- [ ] O app abre sem erros
- [ ] A tela de boas-vindas aparece na primeira execução
- [ ] É possível carregar a demo
- [ ] A biblioteca exibe as obras

### Testes de Importação
- [ ] Importar imagens avulsas funciona
- [ ] Importar pasta com capítulos funciona
- [ ] Importar arquivos CBZ/ZIP funciona
- [ ] Os capítulos são organizados corretamente

### Testes do Leitor
- [ ] Abrir um capítulo funciona
- [ ] Avançar/voltar páginas funciona
- [ ] Avançar/voltar capítulos funciona
- [ ] Tocar na tela mostra/oculta controles
- [ ] O progresso é salvo corretamente
- [ ] Fechar e reabrir restaura a página exata

### Testes de Funcionalidades
- [ ] Favoritar/desfavoritar obras funciona
- [ ] Filtros da biblioteca funcionam
- [ ] Estatísticas são calculadas corretamente
- [ ] Configurações são salvas

### Testes Offline
- [ ] Desative o Wi-Fi/dados móveis
- [ ] Abra o app
- [ ] Leia um capítulo importado
- [ ] Todas as funcionalidades devem funcionar

---

## 🔄 Atualizações Futuras

Quando fizer alterações no código:

```bash
# 1. Faça as alterações no código

# 2. Rebuild da aplicação web
npm run build

# 3. Sincronize com o projeto Android
npx cap sync android

# 4. No Android Studio, gere o APK novamente
# Build → Build APK(s)
```

**IMPORTANTE:** Use a mesma keystore para todas as atualizações, caso contrário, os usuários não poderão atualizar o app.

---

## 📦 Tamanho do APK

Tamanhos esperados:
- **APK Debug:** ~15-20 MB
- **APK Release (otimizado):** ~8-12 MB

Para reduzir o tamanho:
```gradle
// Em android/app/build.gradle
android {
    buildTypes {
        release {
            minifyEnabled true      // Remove código não utilizado
            shrinkResources true    // Remove recursos não utilizados
        }
    }
    
    // Gere APKs separados por arquitetura
    splits {
        abi {
            enable true
            reset()
            include 'armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'
            universalApk false
        }
    }
}
```

---

## 🐛 Problemas Comuns

### "SDK location not found"
**Solução:** Crie o arquivo `android/local.properties`:
```properties
sdk.dir=C:\\Users\\SEU_USUARIO\\AppData\\Local\\Android\\Sdk
```

### "Gradle sync failed"
**Solução:** 
1. No Android Studio: File → Invalidate Caches / Restart
2. Delete a pasta `android/.gradle`
3. Reabra o projeto

### "App not installed"
**Solução:**
1. Desinstale versões anteriores do app
2. Verifique se há espaço suficiente no celular
3. Tente instalar via ADB: `adb install app-release.apk`

### "Keystore not found"
**Solução:**
1. Verifique o caminho no `build.gradle`
2. Use caminho absoluto se necessário
3. Verifique permissões do arquivo

### "App crashes on launch"
**Solução:**
1. Conecte o celular via USB
2. No Android Studio: Run → Debug
3. Veja os logs no Logcat
4. Verifique se há erros de JavaScript no console

---

## 📁 Estrutura de Arquivos

```
manga-offline/
├── android/                    # Projeto Android (gerado pelo Capacitor)
│   ├── app/
│   │   ├── build/
│   │   │   └── outputs/
│   │   │       └── apk/
│   │   │           ├── debug/
│   │   │           │   └── app-debug.apk        ← APK Debug
│   │   │           └── release/
│   │   │               └── app-release.apk      ← APK Release
│   │   └── src/
│   └── build.gradle
├── dist/                       # Build web otimizado
├── public/
│   ├── icons/                  # Ícones do app
│   ├── manifest.json           # PWA manifest
│   └── sw.js                   # Service Worker
├── src/                        # Código fonte
├── capacitor.config.ts         # Configuração Capacitor
├── manga-offline.keystore      # Chave de assinatura (NÃO COMITAR!)
└── package.json
```

---

## 🔐 Segurança

### Arquivos que NÃO devem ir para o Git:

Crie o arquivo `.gitignore`:

```gitignore
# Keystore (NUNCA comitar)
*.keystore
*.jks
keystore.properties

# Android build
android/.gradle/
android/app/build/
android/captures/
android/local.properties

# Node
node_modules/
dist/

# IDE
.idea/
.vscode/
*.iml

# OS
.DS_Store
Thumbs.db
```

### Proteja sua Keystore:
- Faça backup em local seguro (USB, nuvem criptografada)
- Nunca compartilhe a senha
- Nunca comite no Git
- Se perder, não poderá atualizar o app na Play Store

---

## 📊 Checklist Final

Antes de distribuir o APK:

- [ ] Todas as funcionalidades testadas e funcionando
- [ ] APK gerado com sucesso
- [ ] APK instalado e testado no celular
- [ ] Funcionamento offline verificado
- [ ] Ícone do app configurado
- [ ] Nome do app correto ("Manga Offline")
- [ ] Versão atualizada no `package.json`
- [ ] Keystore segura e backed up
- [ ] `.gitignore` configurado
- [ ] Documentação atualizada

---

## 🎯 Próximos Passos

### Para Publicar na Play Store:

1. Crie uma conta de desenvolvedor Google Play ($25 USD)
2. Prepare os assets:
   - Ícone em alta resolução (512x512)
   - Screenshots (mínimo 2)
   - Feature graphic (1024x500)
   - Descrição do app
   - Política de privacidade
3. Gere um **Android App Bundle (AAB)** em vez de APK:
   ```bash
   cd android
   ./gradlew bundleRelease
   ```
4. Faça upload do AAB na Play Console
5. Preencha as informações da listing
6. Envie para revisão

### Para Distribuição Alternativa:

- **GitHub Releases:** Publique o APK nos releases do repositório
- **Site próprio:** Hospede o APK para download direto
- **F-Droid:** Submeta para o repositório open source
- **APKPure/APKMirror:** Plataformas de distribuição alternativas

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs no Android Studio (Logcat)
2. Consulte a documentação do Capacitor: https://capacitorjs.com/docs
3. Verifique a documentação do Android: https://developer.android.com/docs
4. Abra uma issue no repositório do projeto

---

## ✅ Resumo

**O que você tem agora:**
- ✅ Projeto web completo e funcional
- ✅ Configuração Capacitor pronta
- ✅ Manifest PWA configurado
- ✅ Service Worker para offline
- ✅ Guia completo de build
- ✅ Scripts de automação

**O que você precisa fazer:**
1. Instalar Android Studio
2. Executar os comandos do guia
3. Gerar o APK no Android Studio
4. Testar no celular
5. Distribuir!

**Tempo total estimado:** 30-60 minutos na primeira vez

---

**Boa sorte! 🚀📱**
