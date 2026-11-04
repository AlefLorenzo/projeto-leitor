import { Capacitor, CapacitorHttp } from '@capacitor/core';

export const APP_USER_AGENT = 'MangaOfflineApp/1.0.0 (Android; https://github.com/AlefLorenzo/projeto-leitor)';

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
 * Fetch universal de alta resiliência:
 *
 * - APK Android: Executa via camada nativa Java (CapacitorHttp).
 *   MOTIVO CRUCIAL: O Cloudflare / DDoS-Guard da API MangaDex bloqueia com HTTP 403
 *   qualquer requisição que use o User-Agent padrão do Android WebView (Mozilla/5.0).
 *   O browser fetch() da WebView PROÍBE alterar o User-Agent (é um "forbidden header").
 *   Ao usar CapacitorHttp na camada Java nativa, enviamos o User-Agent oficial
 *   MangaOfflineApp/1.0.0 que é autorizado pelo MangaDex com HTTP 200.
 *
 *   Usamos responseType: 'text' para obter o corpo bruto sem dupla conversão JSON.
 *
 * - Browser dev: Usa fetch() padrão (roteado pelo proxy Vite que adiciona os headers).
 * - Assets locais (/catalog/...): Usa fetch() padrão do WebView.
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
  // URLs relativas locais (/catalog/..., /download-progress.json) sempre usam fetch padrão do WebView
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return fetch(url, options as RequestInit);
  }

  // APK Android / Capacitor nativo: executa via camada nativa Java
  if (isCapacitorNative()) {
    try {
      const method = (options.method || 'GET').toUpperCase();
      const headers: Record<string, string> = {
        'User-Agent': APP_USER_AGENT,
        'Referer': 'https://mangadex.org/',
        'Accept': 'application/json, text/plain, */*',
        ...(options.headers || {}),
      };

      let res;
      if (method === 'POST') {
        res = await CapacitorHttp.post({
          url,
          headers,
          data: options.body,
          responseType: 'text',
        });
      } else {
        res = await CapacitorHttp.get({
          url,
          headers,
          responseType: 'text',
        });
      }

      // Com responseType: 'text', res.data é string pura
      const bodyText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '');

      return new Response(bodyText, {
        status: res.status,
        headers: new Headers(res.headers as Record<string, string>),
      });
    } catch (nativeErr: any) {
      console.warn('[universalFetch] Erro na requisição nativa CapacitorHttp:', nativeErr);
      throw new Error(`Falha de rede nativa (${nativeErr.message || 'Sem conexão com a internet'})`);
    }
  }

  // Browser dev (localhost:5173) ou Node.js
  return fetch(url, options as RequestInit);
}
