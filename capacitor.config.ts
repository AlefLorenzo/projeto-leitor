import type { CapacitorConfig } from '@capacitor/cli';

const APP_USER_AGENT = 'MangaOfflineApp/1.0.0 (Android; https://github.com/AlefLorenzo/projeto-leitor)';

const config: CapacitorConfig = {
  appId: 'com.mangaoffline.app',
  appName: 'Manga Offline',
  webDir: 'dist',
  bundledWebRuntime: false,
  overrideUserAgent: APP_USER_AGENT,
  server: {
    androidScheme: 'https',
    allowNavigation: ['*'],
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    backgroundColor: '#0a0a0f',
    overrideUserAgent: APP_USER_AGENT,
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
    CapacitorHttp: {
      // DESATIVADO: com enabled=true, o Capacitor patcha o fetch() global
      // causando conflitos. Usamos CapacitorHttp explicitamente no universalFetch
      // com responseType: 'text' e headers autorizados.
      enabled: false,
    },
  },
};

export default config;
