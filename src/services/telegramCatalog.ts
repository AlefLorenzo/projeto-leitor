import { Manga, Chapter, Page } from '../types';
import { getDB, saveManga, saveChapter, savePages, getManga, getAllMangas } from './database';

// Interface do catálogo do Telegram
export interface TelegramCatalog {
  mangas: TelegramManga[];
  lastUpdated: string;
}

export interface TelegramManga {
  id: string;
  title: string;
  type: 'manga' | 'manhwa' | 'manhua';
  genres: string[];
  status: string;
  coverUrl?: string;
  chapters: TelegramChapter[];
  addedAt: string;
  source: string;
  synopsis?: string;
  inviteUrl?: string;
  totalChapters?: number;
}

export interface TelegramChapter {
  id: string;
  number?: number;
  title: string;
  folderName?: string;
  pageCount?: number;
  pages?: string[];
  files?: string[];
  size?: number;
  sizeBytes?: number;
  extractedSizeBytes?: number;
  downloadUrl?: string;
  sha256?: string;
  format?: string;
  updatedAt?: string;
}

let cachedCatalog: TelegramCatalog | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 15000; // 15 segundos

function padNum(n: number, d: number = 3): string {
  return String(Math.round(n)).padStart(d, '0');
}

export function canonicalSlug(input: string): string {
  if (!input) return '';
  let s = input
    .replace(/^telegram-/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
  const redundant = [
    '-manhwa',
    '-manga',
    '-manhua',
    '-qg-baltigo',
    '-baltigo',
    '-brasil',
    '-oficial',
    '-official',
    '-colorido',
    '-edicao-colorida',
    '-promo',
    '-webtoon',
    '-end-line',
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of redundant) {
      if (s.endsWith(suf)) {
        s = s.slice(0, -suf.length).replace(/^[-_]+|[-_]+$/g, '');
        changed = true;
      }
    }
  }
  return s;
}

// Carregar catálogo do Telegram
export async function loadTelegramCatalog(): Promise<TelegramCatalog> {
  const now = Date.now();
  
  if (cachedCatalog && now - lastFetchTime < CACHE_DURATION) {
    return cachedCatalog;
  }
  
  try {
    const response = await fetch('/catalog/catalog.json?t=' + now);
    if (!response.ok) {
      throw new Error('Catálogo não encontrado');
    }
    
    const catalog: TelegramCatalog = await response.json();
    cachedCatalog = catalog;
    lastFetchTime = now;
    
    return catalog;
  } catch (error) {
    console.error('Erro ao carregar catálogo:', error);
    return { mangas: [], lastUpdated: new Date().toISOString() };
  }
}

// Importar uma obra do catálogo do Telegram diretamente para a biblioteca IndexedDB
export async function importTelegramMangaToLibrary(rawId: string): Promise<string> {
  const catalog = await loadTelegramCatalog();
  const cleanId = rawId.replace(/^telegram-/, '');
  const canonId = canonicalSlug(rawId);
  const tgManga = catalog.mangas.find(
    m =>
      m.id === cleanId ||
      m.id === rawId ||
      `telegram-${m.id}` === rawId ||
      canonicalSlug(m.id) === canonId ||
      canonicalSlug(m.title) === canonId
  );
  
  if (!tgManga) {
    throw new Error(`Obra "${rawId}" não encontrada no catálogo.`);
  }

  const finalId = `telegram-${tgManga.id}`;
  const now = Date.now();

  const manga: Manga = {
    id: finalId,
    title: tgManga.title,
    synopsis: tgManga.synopsis || `Obra catalogada do Telegram. Gêneros: ${tgManga.genres.join(', ')}`,
    coverUrl: tgManga.coverUrl,
    genres: tgManga.genres && tgManga.genres.length ? tgManga.genres : ['Ação'],
    type: tgManga.type || 'manhwa',
    readingDirection: tgManga.type === 'manhwa' ? 'vertical' : 'rtl',
    status: (tgManga.status as any) || 'reading',
    source: 'local',
    createdAt: now,
    updatedAt: now,
    isFavorite: false,
    totalChapters: tgManga.chapters ? tgManga.chapters.length : 0,
    totalPages: tgManga.chapters ? tgManga.chapters.reduce((sum, ch) => sum + (ch.pageCount || 15), 0) : 0,
    storageSize: 0,
    catalogId: tgManga.id,
    catalogProvider: 'telegram',
    externalUrl: tgManga.inviteUrl,
  };

  await saveManga(manga);

  // Registrar todos os capítulos e páginas no IndexedDB
  if (tgManga.chapters && tgManga.chapters.length > 0) {
    for (let idx = 0; idx < tgManga.chapters.length; idx++) {
      const ch = tgManga.chapters[idx];
      const chNumber = typeof ch.number === 'number' ? ch.number : (idx + 1);
      const chapterId = `ch-${tgManga.id}-${chNumber}`;
      const folderName = ch.folderName || `Capitulo ${padNum(chNumber)}`;
      const pageCount = ch.pageCount || (ch.pages && ch.pages.length) || 15;

      const chapter: Chapter = {
        id: chapterId,
        mangaId: finalId,
        number: chNumber,
        title: ch.title || `Capítulo ${chNumber}`,
        pagesCount: pageCount,
        createdAt: now - (tgManga.chapters.length - idx) * 3600000,
        storageSize: (ch.size || 500000),
        isDownloaded: true,
        readStatus: 'not_started',
      };
      await saveChapter(chapter);

      // Gerar as páginas
      const pages: Page[] = [];
      const hasSpecificPages = ch.pages && ch.pages.length > 0;
      const count = hasSpecificPages ? ch.pages!.length : pageCount;

      for (let p = 1; p <= count; p++) {
        const pageFileName = hasSpecificPages ? ch.pages![p - 1] : `${padNum(p)}.jpg`;
        const imageUrl = `/library/${tgManga.id}/${folderName}/${pageFileName}`;

        pages.push({
          id: `p-${chapterId}-${p}`,
          chapterId: chapterId,
          mangaId: finalId,
          pageNumber: p,
          imageUrl: imageUrl,
          createdAt: now,
        });
      }

      await savePages(pages);
    }
  }

  return finalId;
}

// Importar todas as obras disponíveis do catálogo para a biblioteca IndexedDB
export async function importAllTelegramMangasToLibrary(
  onProgress?: (current: number, total: number, title: string) => void
): Promise<number> {
  const catalog = await loadTelegramCatalog();
  const total = catalog.mangas.length;
  let imported = 0;

  for (let i = 0; i < total; i++) {
    const tgManga = catalog.mangas[i];
    if (onProgress) onProgress(i + 1, total, tgManga.title);
    try {
      await importTelegramMangaToLibrary(tgManga.id);
      imported++;
    } catch (err) {
      console.warn(`Erro ao importar ${tgManga.title}:`, err);
    }
  }

  return imported;
}

// Converter manga do Telegram para o formato do app
export function convertTelegramMangaToApp(tgManga: TelegramManga): Partial<Manga> {
  return {
    id: `telegram-${tgManga.id}`,
    title: tgManga.title,
    type: tgManga.type,
    genres: tgManga.genres,
    status: (tgManga.status as any) || 'reading',
    coverUrl: tgManga.coverUrl,
    source: 'online',
    catalogId: tgManga.id,
    catalogProvider: 'telegram',
    totalChapters: tgManga.chapters ? tgManga.chapters.length : 0,
    totalPages: tgManga.chapters ? tgManga.chapters.reduce((sum, ch) => sum + (ch.pageCount || 15), 0) : 0,
    isFavorite: false,
    createdAt: new Date(tgManga.addedAt).getTime(),
    updatedAt: new Date(tgManga.addedAt).getTime(),
    storageSize: 0,
  };
}

// Buscar obras do Telegram
export async function searchTelegramMangas(query: string): Promise<TelegramManga[]> {
  const catalog = await loadTelegramCatalog();
  
  if (!query) {
    return catalog.mangas;
  }
  
  const q = query.toLowerCase();
  return catalog.mangas.filter(m => 
    m.title.toLowerCase().includes(q) ||
    m.genres.some(g => g.toLowerCase().includes(q))
  );
}

// Obter obra específica do Telegram
export async function getTelegramManga(id: string): Promise<TelegramManga | undefined> {
  const catalog = await loadTelegramCatalog();
  const clean = id.replace(/^telegram-/, '');
  return catalog.mangas.find(m => m.id === clean || m.id === id);
}

// Verificar se há atualizações no catálogo
export async function checkForUpdates(): Promise<boolean> {
  try {
    const catalog = await loadTelegramCatalog();
    const lastUpdated = new Date(catalog.lastUpdated).getTime();
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    return lastUpdated > fiveMinutesAgo;
  } catch {
    return false;
  }
}

// Obter estatísticas do catálogo
export async function getTelegramCatalogStats(): Promise<{
  totalMangas: number;
  totalChapters: number;
  totalPages: number;
  lastUpdated: string;
}> {
  const catalog = await loadTelegramCatalog();
  
  const totalChapters = catalog.mangas.reduce((sum, m) => sum + (m.chapters ? m.chapters.length : 0), 0);
  const totalPages = catalog.mangas.reduce((sum, m) => 
    sum + (m.chapters ? m.chapters.reduce((chSum, ch) => chSum + (ch.pageCount || 15), 0) : 0), 0
  );
  
  return {
    totalMangas: catalog.mangas.length,
    totalChapters,
    totalPages,
    lastUpdated: catalog.lastUpdated,
  };
}
