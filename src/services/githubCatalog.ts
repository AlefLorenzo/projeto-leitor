import { Manga, Chapter, Page } from '../types';
import { universalFetch } from './platform';
import { getDB, saveManga, saveChapter, savePages, getManga, getAllMangas, getChaptersByManga } from './database';

export interface RemoteCatalogChapter {
  id: string;
  number: number;
  title: string;
  format?: 'cbz' | 'zip' | 'pages';
  downloadUrl: string;
  sizeBytes: number;
  extractedSizeBytes?: number;
  sha256?: string;
  pageCount: number;
  updatedAt?: string;
  // Campos extras para download pagina por pagina (catalogo Telegram)
  folderName?: string;
  pages?: string[];
  telegramMsgId?: number;
  channelId?: string;
}

export interface RemoteCatalogManga {
  id: string;
  title: string;
  synopsis?: string;
  coverUrl: string;
  genres: string[];
  type: 'manga' | 'manhwa' | 'manhua';
  status: string;
  totalChapters: number;
  updatedAt?: string;
  chapters: RemoteCatalogChapter[];
}

export interface RemoteCatalog {
  version: string;
  lastUpdated: string;
  repository: string;
  baseUrl: string;
  mangas: RemoteCatalogManga[];
}

// Configuração Padrão do Repositório GitHub
export const DEFAULT_GITHUB_CONFIG = {
  owner: 'AlefLorenzo',
  repo: 'projeto-leitor',
  branch: 'main',
  get rawBaseUrl() {
    return `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${this.branch}`;
  },
  get catalogUrl() {
    return `${this.rawBaseUrl}/app/catalog.json`;
  },
};

const LOCAL_STORAGE_CATALOG_KEY = 'manga_offline_cached_catalog';
const LOCAL_STORAGE_CATALOG_TIME = 'manga_offline_cached_catalog_time';

/**
 * Resolve URL relativa para a URL completa do GitHub Raw ou relativa local
 */
export function resolveResourceUrl(relativeOrAbsoluteUrl: string, baseUrl?: string): string {
  if (!relativeOrAbsoluteUrl) return '';
  if (relativeOrAbsoluteUrl.startsWith('http://') || relativeOrAbsoluteUrl.startsWith('https://')) {
    return relativeOrAbsoluteUrl;
  }
  const base = baseUrl || DEFAULT_GITHUB_CONFIG.rawBaseUrl;
  const cleanPath = relativeOrAbsoluteUrl.replace(/^\/+/, '');
  return `${base}/${cleanPath}`;
}

/**
 * Carrega o catálogo remoto com suporte a cache offline em caso de falha de conexão
 */
export async function fetchRemoteCatalog(customUrl?: string): Promise<{ catalog: RemoteCatalog; fromCache: boolean }> {
  const url = customUrl || DEFAULT_GITHUB_CONFIG.catalogUrl;
  const localFallbackUrl = '/catalog/catalog.json';

  // 1. Tentar buscar online (GitHub Raw ou customUrl)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s timeout

    const res = await universalFetch(url + '?t=' + Date.now(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data: RemoteCatalog = await res.json();
      // Salva no cache local para persistência offline
      try {
        localStorage.setItem(LOCAL_STORAGE_CATALOG_KEY, JSON.stringify(data));
        localStorage.setItem(LOCAL_STORAGE_CATALOG_TIME, String(Date.now()));
      } catch {}
      return { catalog: data, fromCache: false };
    }
  } catch (onlineErr) {
    console.warn('Falha ao conectar com o GitHub remoto, tentando fallback local...', onlineErr);
  }

  // 2. Tentar fallback local relativo (quando rodando local ou web app)
  try {
    const res = await fetch(localFallbackUrl + '?t=' + Date.now());
    if (res.ok) {
      const data: RemoteCatalog = await res.json();
      return { catalog: data, fromCache: false };
    }
  } catch {}

  // 3. Fallback para cache offline no localStorage
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_CATALOG_KEY);
    if (cached) {
      const data: RemoteCatalog = JSON.parse(cached);
      return { catalog: data, fromCache: true };
    }
  } catch {}

  // 4. Catálogo vazio de emergência se estiver sem internet e sem cache
  return {
    catalog: {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      repository: DEFAULT_GITHUB_CONFIG.rawBaseUrl,
      baseUrl: DEFAULT_GITHUB_CONFIG.rawBaseUrl,
      mangas: [],
    },
    fromCache: true,
  };
}

/**
 * Verifica se uma obra ou capítulo do catálogo remoto já está baixado no IndexedDB
 */
export async function getDownloadedStatusMap(mangaId: string): Promise<Set<number>> {
  const finalId = mangaId.startsWith('telegram-') ? mangaId : `telegram-${mangaId}`;
  const chapters = await getChaptersByManga(finalId);
  const downloadedNumbers = new Set<number>();

  for (const ch of chapters) {
    if (ch.isDownloaded) {
      downloadedNumbers.add(ch.number);
    }
  }

  return downloadedNumbers;
}
