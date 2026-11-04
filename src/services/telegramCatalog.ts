import { Manga } from '../types';

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
  source: 'telegram';
}

export interface TelegramChapter {
  id: string;
  title: string;
  pageCount: number;
  files: string[];
}

let cachedCatalog: TelegramCatalog | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 1 minuto

// Carregar catálogo do Telegram
export async function loadTelegramCatalog(): Promise<TelegramCatalog> {
  const now = Date.now();
  
  // Usar cache se disponível e recente
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
    totalChapters: tgManga.chapters.length,
    totalPages: tgManga.chapters.reduce((sum, ch) => sum + ch.pageCount, 0),
    isFavorite: false,
    createdAt: new Date(tgManga.addedAt).getTime(),
    updatedAt: new Date(tgManga.addedAt).getTime(),
    storageSize: 0, // Será calculado quando importado
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
  return catalog.mangas.find(m => m.id === id);
}

// Verificar se há atualizações no catálogo
export async function checkForUpdates(): Promise<boolean> {
  try {
    const catalog = await loadTelegramCatalog();
    const lastUpdated = new Date(catalog.lastUpdated).getTime();
    
    // Se o catálogo foi atualizado nos últimos 5 minutos, há novidades
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    return lastUpdated > fiveMinutesAgo;
  } catch {
    return false;
  }
}

// Obter obras adicionadas recentemente
export async function getRecentTelegramMangas(limit: number = 10): Promise<TelegramManga[]> {
  const catalog = await loadTelegramCatalog();
  
  return catalog.mangas
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
    .slice(0, limit);
}

// Obter estatísticas do catálogo
export async function getTelegramCatalogStats(): Promise<{
  totalMangas: number;
  totalChapters: number;
  totalPages: number;
  lastUpdated: string;
}> {
  const catalog = await loadTelegramCatalog();
  
  const totalChapters = catalog.mangas.reduce((sum, m) => sum + m.chapters.length, 0);
  const totalPages = catalog.mangas.reduce((sum, m) => 
    sum + m.chapters.reduce((chSum, ch) => chSum + ch.pageCount, 0), 0
  );
  
  return {
    totalMangas: catalog.mangas.length,
    totalChapters,
    totalPages,
    lastUpdated: catalog.lastUpdated,
  };
}
