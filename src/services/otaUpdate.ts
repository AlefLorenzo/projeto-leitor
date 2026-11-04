import { isCapacitorNative } from './platform';
import { DEFAULT_GITHUB_CONFIG } from './githubCatalog';

export const CURRENT_APP_VERSION = '1.2.0';

// CDN que serve arquivos do GitHub sem bloqueios em Android
// raw.githubusercontent.com bloqueia downloads de ZIP no WebView nativo
const JSDELIVR_BASE = 'https://cdn.jsdelivr.net/gh/AlefLorenzo/projeto-leitor@main';

export interface RemoteVersionInfo {
  version: string;
  bundleUrl: string;
  releaseDate?: string;
  releaseNotes?: string;
  releaseNotes_pt?: string;
  minApkVersion?: string;
  publishedAt?: string;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  remoteVersion?: string;
  releaseNotes?: string;
  bundleUrl?: string;
}

/**
 * Normaliza versões no padrão SemVer simples (ex: 1.0.0 vs 1.1.0)
 */
function compareSemver(v1: string, v2: string): number {
  const parts1 = v1.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const parts2 = v2.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < len; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * Converte URL raw.githubusercontent.com para jsDelivr CDN (mais confiável no Android)
 * raw.githubusercontent.com/owner/repo/branch/path -> cdn.jsdelivr.net/gh/owner/repo@branch/path
 */
function toJsDelivrUrl(url: string): string {
  if (!url) return url;
  // Já é jsDelivr
  if (url.includes('cdn.jsdelivr.net')) return url;
  // Converte raw.githubusercontent.com
  const match = url.match(/https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/);
  if (match) {
    const [, owner, repo, branch, path] = match;
    return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${path}`;
  }
  return url;
}

/**
 * Notifica o plugin de atualização nativa que o app carregou com sucesso
 */
export async function notifyOtaReady(): Promise<void> {
  if (isCapacitorNative()) {
    try {
      const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
      await CapacitorUpdater.notifyAppReady();
      console.log('[OTA] App ready confirmado ao CapacitorUpdater');
    } catch (e) {
      console.warn('[OTA] notifyAppReady não disponível:', e);
    }
  }
}

/**
 * Consulta o arquivo version.json hospedado no GitHub via jsDelivr CDN
 * Fallback para raw.githubusercontent.com se CDN falhar
 */
export async function checkRemoteUpdate(): Promise<UpdateCheckResult> {
  // Tenta jsDelivr primeiro (mais confiável no Android), depois raw GitHub
  const cdnUrl = `${JSDELIVR_BASE}/app/version.json?_t=${Date.now()}`;
  const rawUrl = `${DEFAULT_GITHUB_CONFIG.rawBaseUrl}/app/version.json?_t=${Date.now()}`;

  let data: RemoteVersionInfo | null = null;

  for (const url of [cdnUrl, rawUrl]) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (res.ok) {
        data = await res.json();
        break;
      }
    } catch {
      // tenta próxima URL
    }
  }

  if (!data?.version) {
    return { hasUpdate: false, currentVersion: CURRENT_APP_VERSION };
  }

  const isNewer = compareSemver(data.version, CURRENT_APP_VERSION) > 0;

  // Garante que bundleUrl usa jsDelivr CDN para máxima compatibilidade com Android
  const resolvedBundleUrl = toJsDelivrUrl(data.bundleUrl);

  return {
    hasUpdate: isNewer,
    currentVersion: CURRENT_APP_VERSION,
    remoteVersion: data.version,
    releaseNotes: data.releaseNotes || data.releaseNotes_pt,
    bundleUrl: resolvedBundleUrl,
  };
}

/**
 * Baixa e aplica o pacote web (dist.zip) via OTA sem reinstalar o APK.
 *
 * Estratégia de download no Android nativo:
 * 1. Usa CapacitorHttp (HTTP nativo) para baixar o ZIP — sem restrições de CORS ou User-Agent
 * 2. Converte para Blob e cria URL temporária que o CapacitorUpdater consegue usar
 * 3. Passa para CapacitorUpdater.download() que extrai e aplica o bundle
 */
export async function applyOtaUpdate(
  bundleUrl: string,
  targetVersion: string,
  onProgress?: (percent: number) => void
): Promise<boolean> {
  if (!isCapacitorNative()) {
    console.log('[OTA] Não está em ambiente nativo Android (Capacitor), simulando...');
    return false;
  }

  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    const { CapacitorHttp } = await import('@capacitor/core');

    // Garante URL via CDN confiável
    const finalUrl = toJsDelivrUrl(bundleUrl);
    console.log('[OTA] Iniciando download via CapacitorHttp:', finalUrl);

    if (onProgress) onProgress(5);

    // Tenta direto com CapacitorUpdater (que usa HTTP nativo internamente)
    // passando URL jsDelivr que é compatível com Android
    let versionObj: any;
    try {
      versionObj = await CapacitorUpdater.download({
        url: finalUrl,
        version: targetVersion,
      });
      if (onProgress) onProgress(80);
    } catch (downloadErr: any) {
      console.warn('[OTA] CapacitorUpdater.download falhou, tentando via CapacitorHttp:', downloadErr.message);

      // Fallback: baixa manualmente via CapacitorHttp e passa como dataUrl
      if (onProgress) onProgress(10);

      const response = await CapacitorHttp.get({
        url: finalUrl,
        responseType: 'blob',
        headers: {
          'User-Agent': 'MangaOffline/1.0 Android',
          'Accept': 'application/zip, application/octet-stream, */*',
        },
      });

      if (response.status !== 200) {
        throw new Error(`Falha ao baixar pacote OTA (HTTP ${response.status})`);
      }

      if (onProgress) onProgress(60);

      // Cria Blob URL temporária para o CapacitorUpdater
      let base64Data = typeof response.data === 'string' ? response.data : '';
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      }
      base64Data = base64Data.replace(/[\r\n\s]/g, '');

      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/zip' });
      const blobUrl = URL.createObjectURL(blob);

      if (onProgress) onProgress(70);

      try {
        versionObj = await CapacitorUpdater.download({
          url: blobUrl,
          version: targetVersion,
        });
      } finally {
        URL.revokeObjectURL(blobUrl);
      }

      if (onProgress) onProgress(80);
    }

    if (versionObj) {
      await CapacitorUpdater.set(versionObj);
      if (onProgress) onProgress(100);
      return true;
    }

    return false;
  } catch (err) {
    console.error('[OTA] Erro ao aplicar atualização OTA:', err);
    throw err;
  }
}
