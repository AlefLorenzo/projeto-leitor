import { isCapacitorNative } from './platform';
import { DEFAULT_GITHUB_CONFIG } from './githubCatalog';

export const CURRENT_APP_VERSION = '1.3.0';

// CDN que serve arquivos do GitHub sem restrições
const JSDELIVR_BASE = 'https://cdn.jsdelivr.net/gh/AlefLorenzo/projeto-leitor@main';

export interface RemoteVersionInfo {
  version: string;
  bundleUrl: string;
  checksum?: string;
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
  checksum?: string;
}

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
 * Converte URL raw.githubusercontent.com para jsDelivr CDN
 */
function toJsDelivrUrl(url: string): string {
  if (!url) return url;
  if (url.includes('cdn.jsdelivr.net')) return url;
  const match = url.match(/https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/);
  if (match) {
    const [, owner, repo, branch, path] = match;
    return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${path}`;
  }
  return url;
}

/**
 * Notifica o plugin que o app carregou com sucesso
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
 * Consulta version.json via jsDelivr CDN com fallback para raw GitHub
 */
export async function checkRemoteUpdate(): Promise<UpdateCheckResult> {
  const urls = [
    `${JSDELIVR_BASE}/app/version.json?_t=${Date.now()}`,
    `${DEFAULT_GITHUB_CONFIG.rawBaseUrl}/app/version.json?_t=${Date.now()}`,
  ];

  let data: RemoteVersionInfo | null = null;

  for (const url of urls) {
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
  const resolvedBundleUrl = toJsDelivrUrl(data.bundleUrl);

  return {
    hasUpdate: isNewer,
    currentVersion: CURRENT_APP_VERSION,
    remoteVersion: data.version,
    releaseNotes: data.releaseNotes || data.releaseNotes_pt,
    bundleUrl: resolvedBundleUrl,
    checksum: data.checksum,
  };
}

/**
 * Baixa e aplica o pacote web (dist.zip) via OTA sem reinstalar o APK.
 */
export async function applyOtaUpdate(
  bundleUrl: string,
  targetVersion: string,
  onProgress?: (percent: number) => void,
  checksum?: string
): Promise<boolean> {
  if (!isCapacitorNative()) {
    console.log('[OTA] Não está em ambiente nativo Android, simulando...');
    return false;
  }

  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');

    const finalUrl = toJsDelivrUrl(bundleUrl);
    console.log('[OTA] Baixando bundle OTA:', finalUrl, 'versão:', targetVersion, 'checksum:', checksum);

    if (onProgress) onProgress(10);

    const downloadOptions: any = {
      url: finalUrl,
      version: targetVersion,
    };

    if (checksum) {
      downloadOptions.checksum = checksum;
    }

    const versionObj = await CapacitorUpdater.download(downloadOptions);

    if (onProgress) onProgress(80);

    if (versionObj) {
      console.log('[OTA] Bundle baixado com sucesso, aplicando...', versionObj);
      await CapacitorUpdater.set(versionObj);
      if (onProgress) onProgress(100);
      return true;
    }

    return false;
  } catch (err: any) {
    console.error('[OTA] Erro ao aplicar atualização OTA:', err);
    throw err;
  }
}
