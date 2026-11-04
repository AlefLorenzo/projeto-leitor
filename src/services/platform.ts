import { Capacitor, CapacitorHttp } from '@capacitor/core';

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
    if (window.location.hostname === 'localhost' && (!window.location.port || window.location.port === '80' || window.location.port === '443')) {
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
 * Fetch universal que no APK roda via CapacitorHttp (nativo Java, sem CORS nem 403)
 * para requisições externas (http/https). Para assets locais (/catalog/...), roda via fetch() normal.
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
  // URLs relativas locais (/catalog/...) sempre usam fetch padrão do WebView
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return fetch(url, options as RequestInit);
  }

  if (isCapacitorNative()) {
    try {
      const method = (options.method || 'GET').toUpperCase();
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko)',
        'Referer': 'https://mangadex.org/',
        'Accept': 'application/json, text/plain, */*',
        ...(options.headers || {}),
      };

      let res;
      if (method === 'POST') {
        res = await CapacitorHttp.post({ url, headers, data: options.body });
      } else {
        res = await CapacitorHttp.get({ url, headers });
      }

      const bodyText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      return new Response(bodyText, {
        status: res.status,
        headers: new Headers(res.headers as Record<string, string>),
      });
    } catch (nativeErr: any) {
      console.warn('[universalFetch] Fallback nativo para fetch:', nativeErr);
    }
  }

  // Browser / Node.js
  return fetch(url, options as RequestInit);
}
