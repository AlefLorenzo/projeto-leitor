import { Capacitor } from '@capacitor/core';

/**
 * Detecta se o app está rodando dentro do APK Android / iOS (Capacitor nativo)
 */
export function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (Capacitor.isNativePlatform()) return true;
    const platform = Capacitor.getPlatform();
    if (platform === 'android' || platform === 'ios') return true;
    if (window.location.protocol === 'capacitor:') return true;
    // No APK Android, a WebView do Capacitor serve em https://localhost (sem porta 5173)
    if (
      window.location.hostname === 'localhost' &&
      (!window.location.port || window.location.port === '80' || window.location.port === '443')
    ) {
      return true;
    }
  } catch {
    // fallback
  }
  return false;
}

/**
 * Detecta se está rodando no servidor de desenvolvimento Vite (localhost:5173)
 */
export function isViteDev(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' && window.location.port === '5173';
}

/**
 * Fetch universal de alta resiliência.
 *
 * ARQUITETURA (após análise profunda):
 * ─────────────────────────────────────────────────────────────────────────────
 * CapacitorHttp.enabled = FALSE (desativado no capacitor.config.ts)
 *
 * APK Android (WebView em https://localhost):
 *   - API MangaDex: retorna CORS "Access-Control-Allow-Origin: https://localhost"
 *     ✅ → fetch() nativo da WebView funciona diretamente sem proxy
 *   - Imagens de capa (<img>): tratadas pelo componente NativeImage via CapacitorHttp
 *   - Downloads de capítulos: tratados por onlineDownloader via CapacitorHttp.get()
 *
 * Browser dev (localhost:5173):
 *   - Requests da API → Proxy Vite → /api/mangadex → https://api.mangadex.org
 *   - Imagens → Proxy Vite → /api/mdcovers, /api/mdimg
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function universalFetch(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    body?: any;
  } = {}
): Promise<Response> {
  // URLs relativas locais (/catalog/..., /api/...) sempre usam fetch padrão
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return fetch(url, options as RequestInit);
  }

  // Monta os headers base com User-Agent correto
  const baseHeaders: Record<string, string> = {
    'Accept': 'application/json, text/plain, */*',
    ...(options.headers || {}),
  };

  // No APK nativo, adicionar User-Agent e Referer para melhor compatibilidade
  if (isCapacitorNative()) {
    baseHeaders['User-Agent'] =
      'MangaOfflineApp/1.0.0 (Android; https://github.com/AlefLorenzo/projeto-leitor)';
    baseHeaders['Referer'] = 'https://mangadex.org/';
  }

  // fetch() nativo — no APK, a WebView faz requisições diretas à API (CORS habilitado pela MangaDex)
  // No dev, as requests passam pelo proxy do Vite
  return fetch(url, {
    method: options.method || 'GET',
    headers: baseHeaders,
    signal: options.signal,
    body: options.body,
  });
}
