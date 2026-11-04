import { isCapacitorNative } from './platform';
import { DEFAULT_GITHUB_CONFIG } from './githubCatalog';

export const CURRENT_APP_VERSION = '1.1.0';

export interface RemoteVersionInfo {
  version: string;
  bundleUrl: string;
  releaseDate?: string;
  releaseNotes?: string;
  minApkVersion?: string;
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
 * Consulta o arquivo version.json hospedado no GitHub
 */
export async function checkRemoteUpdate(): Promise<UpdateCheckResult> {
  const versionUrl = `${DEFAULT_GITHUB_CONFIG.rawBaseUrl}/app/version.json?_t=${Date.now()}`;

  try {
    const res = await fetch(versionUrl, { cache: 'no-cache' });
    if (!res.ok) {
      return { hasUpdate: false, currentVersion: CURRENT_APP_VERSION };
    }

    const data: RemoteVersionInfo = await res.json();
    if (!data.version) {
      return { hasUpdate: false, currentVersion: CURRENT_APP_VERSION };
    }

    const isNewer = compareSemver(data.version, CURRENT_APP_VERSION) > 0;

    return {
      hasUpdate: isNewer,
      currentVersion: CURRENT_APP_VERSION,
      remoteVersion: data.version,
      releaseNotes: data.releaseNotes,
      bundleUrl: data.bundleUrl,
    };
  } catch (err) {
    console.warn('[OTA] Erro ao verificar atualização remota:', err);
    return { hasUpdate: false, currentVersion: CURRENT_APP_VERSION };
  }
}

/**
 * Baixa e aplica o pacote web (dist.zip) via OTA sem reinstalar o APK
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

    if (onProgress) onProgress(10);

    const versionObj = await CapacitorUpdater.download({
      url: bundleUrl,
      version: targetVersion,
    });

    if (onProgress) onProgress(80);

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
