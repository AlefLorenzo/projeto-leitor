import { Capacitor, CapacitorHttp } from '@capacitor/core';

/**
 * Detecta com 100% de precisão se o app está rodando dentro do APK Android / iOS (Capacitor nativo)
 */
export function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (Capacitor.isNativePlatform()) return true;
    const platform = Capacitor.getPlatform();
    if (platform === 'android' || platform === 'ios') return true;
    if (window.location.protocol === 'capacitor:') return true;
    // No APK Android, a WebView do Capacitor serve em https://localhost (sem porta 5173)
    if (window.location.hostname === 'localhost' && !window.location.port) return true;
  } catch {
    // fallback
  }
  return false;
}

/**
 * Fetch universal que no APK roda via CapacitorHttp (nativo Java, sem CORS nem 403)
 * e no browser dev roda via fetch() normal (com proxy Vite)
 */
export async function universalFetch(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  } = {}
): Promise<Response> {
  if (isCapacitorNative()) {
    try {
      const res = await CapacitorHttp.get({
        url,
        headers: {
          'User-Agent': 'MangaOffline/1.0 (https://github.com/AlefLorenzo/projeto-leitor)',
          'Referer': 'https://mangadex.org/',
          ...(options.headers || {}),
        },
      });

      const bodyText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      return new Response(bodyText, {
        status: res.status,
        headers: new Headers(res.headers as Record<string, string>),
      });
    } catch (nativeErr: any) {
      // Se falhar no nativo, tenta o fetch padrão como contingência
      console.warn('[universalFetch] Fallback para fetch:', nativeErr);
    }
  }

  // Browser / Node.js
  return fetch(url, options as RequestInit);
}
