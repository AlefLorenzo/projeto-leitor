import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mangaoffline.app',
  appName: 'Manga Offline',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    // http permite que o WebView acesse APIs externas com menos restrições
    androidScheme: 'https',
    allowNavigation: [
      'api.mangadex.org',
      'uploads.mangadex.org',
      '*.mangadex.network',
      'mangadex.org',
    ],
  },
  android: {
    // allowMixedContent necessário para imagens HTTP em contexto HTTPS
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#0a0a0f',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0a0a0f',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a0f',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    // CapacitorHttp: faz requisições pelo layer nativo Android, sem CORS
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
