import { CatalogProvider, CatalogManga, CatalogChapter } from '../types';
import { getDB } from './database';

// Default catalog providers (demo data for web version)
const DEFAULT_PROVIDERS: CatalogProvider[] = [
  {
    id: 'demo-catalog',
    name: 'Catálogo Demo',
    description: 'Catálogo de demonstração com obras de exemplo',
    icon: '📚',
    baseUrl: '',
    catalogUrl: '',
    enabled: true,
  },
];

// Demo catalog data
const DEMO_MANGAS: CatalogManga[] = [
  {
    id: 'demo-1',
    providerId: 'demo-catalog',
    title: 'Solo Leveling',
    author: 'Chugong',
    synopsis: 'Em um mundo onde caçadores — humanos com poderes mágicos — devem enfrentar monstros mortais para proteger a raça humana, Sung Jin-Woo, o caçador mais fraco de todos, encontra um dungeon secreto que mudará sua vida para sempre.',
    coverUrl: '',
    genres: ['Ação', 'Aventura', 'Fantasia'],
    type: 'manhwa',
    status: 'completed',
    chapters: Array.from({ length: 20 }, (_, i) => ({
      id: `demo-1-ch-${i + 1}`,
      number: i + 1,
      title: `Capítulo ${String(i + 1).padStart(3, '0')}`,
      date: new Date(2024, 0, i + 1).toISOString(),
      pagesCount: 30 + Math.floor(Math.random() * 20),
    })),
    totalViews: 1500000,
    rating: 4.9,
    year: 2018,
  },
  {
    id: 'demo-2',
    providerId: 'demo-catalog',
    title: 'Tower of God',
    author: 'SIU',
    synopsis: 'O que você deseja? Dinheiro e riqueza? Honra e orgulho? Autoridade e poder? Ou vingança? Tudo que você deseja está no topo da Torre.',
    coverUrl: '',
    genres: ['Ação', 'Aventura', 'Fantasia', 'Mistério'],
    type: 'manhwa',
    status: 'ongoing',
    chapters: Array.from({ length: 15 }, (_, i) => ({
      id: `demo-2-ch-${i + 1}`,
      number: i + 1,
      title: `Capítulo ${String(i + 1).padStart(3, '0')}`,
      date: new Date(2024, 0, i + 1).toISOString(),
      pagesCount: 25 + Math.floor(Math.random() * 15),
    })),
    totalViews: 800000,
    rating: 4.7,
    year: 2010,
  },
  {
    id: 'demo-3',
    providerId: 'demo-catalog',
    title: 'One Punch Man',
    author: 'ONE',
    synopsis: 'A história de Saitama, um herói que pode derrotar qualquer inimigo com um único soco, mas que perdeu a emoção de lutar devido ao seu poder esmagador.',
    coverUrl: '',
    genres: ['Ação', 'Comédia', 'Superpoderes'],
    type: 'manga',
    status: 'ongoing',
    chapters: Array.from({ length: 12 }, (_, i) => ({
      id: `demo-3-ch-${i + 1}`,
      number: i + 1,
      title: `Capítulo ${String(i + 1).padStart(3, '0')}`,
      date: new Date(2024, 0, i + 1).toISOString(),
      pagesCount: 20 + Math.floor(Math.random() * 10),
    })),
    totalViews: 2000000,
    rating: 4.8,
    year: 2012,
  },
  {
    id: 'demo-4',
    providerId: 'demo-catalog',
    title: 'The Beginning After The End',
    author: 'TurtleMe',
    synopsis: 'Rei Grey tem poder, riqueza e prestígio inigualáveis em um mundo governado por artes marciais. No entanto, a solidão permeia aqueles com grande poder. Reencarnado em um novo mundo cheio de magia.',
    coverUrl: '',
    genres: ['Ação', 'Fantasia', 'Reencarnação'],
    type: 'manhwa',
    status: 'ongoing',
    chapters: Array.from({ length: 18 }, (_, i) => ({
      id: `demo-4-ch-${i + 1}`,
      number: i + 1,
      title: `Capítulo ${String(i + 1).padStart(3, '0')}`,
      date: new Date(2024, 0, i + 1).toISOString(),
      pagesCount: 28 + Math.floor(Math.random() * 12),
    })),
    totalViews: 1200000,
    rating: 4.6,
    year: 2018,
  },
  {
    id: 'demo-5',
    providerId: 'demo-catalog',
    title: 'Martial Peak',
    author: 'Momo',
    synopsis: 'A jornada de Yang Kai na busca pelo pico das artes marciais. Um servo humilde da High Heaven Sect que descobre um livro misterioso que muda seu destino.',
    coverUrl: '',
    genres: ['Ação', 'Artes Marciais', 'Fantasia'],
    type: 'manhua',
    status: 'ongoing',
    chapters: Array.from({ length: 25 }, (_, i) => ({
      id: `demo-5-ch-${i + 1}`,
      number: i + 1,
      title: `Capítulo ${String(i + 1).padStart(3, '0')}`,
      date: new Date(2024, 0, i + 1).toISOString(),
      pagesCount: 15 + Math.floor(Math.random() * 10),
    })),
    totalViews: 900000,
    rating: 4.3,
    year: 2016,
  },
  {
    id: 'demo-6',
    providerId: 'demo-catalog',
    title: 'Omniscient Reader',
    author: 'Sing Shong',
    synopsis: 'Kim Dokja era um leitor comum que passou 10 anos lendo um web novel obscuro. Quando a história se torna realidade, ele é o único que sabe como o mundo vai acabar.',
    coverUrl: '',
    genres: ['Ação', 'Fantasia', 'Apocalipse'],
    type: 'manhwa',
    status: 'ongoing',
    chapters: Array.from({ length: 16 }, (_, i) => ({
      id: `demo-6-ch-${i + 1}`,
      number: i + 1,
      title: `Capítulo ${String(i + 1).padStart(3, '0')}`,
      date: new Date(2024, 0, i + 1).toISOString(),
      pagesCount: 32 + Math.floor(Math.random() * 15),
    })),
    totalViews: 1800000,
    rating: 4.8,
    year: 2020,
  },
];

// Provider management
export async function getProviders(): Promise<CatalogProvider[]> {
  const db = await getDB();
  if (!db.objectStoreNames.contains('providers')) {
    // Initialize with defaults
    await initProviders();
  }
  try {
    const providers = await db.getAll('providers');
    return providers.length > 0 ? providers : DEFAULT_PROVIDERS;
  } catch {
    return DEFAULT_PROVIDERS;
  }
}

async function initProviders() {
  const db = await getDB();
  if (!db.objectStoreNames.contains('providers')) {
    // Store will be created on next DB upgrade
    return;
  }
  const tx = db.transaction('providers', 'readwrite');
  for (const provider of DEFAULT_PROVIDERS) {
    await tx.store.put(provider);
  }
  await tx.done;
}

// Catalog browsing
export async function searchCatalog(query: string, filters?: { type?: string; genre?: string }): Promise<CatalogManga[]> {
  let results = [...DEMO_MANGAS];

  if (query) {
    const q = query.toLowerCase();
    results = results.filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.author?.toLowerCase().includes(q) ||
      m.genres.some(g => g.toLowerCase().includes(q))
    );
  }

  if (filters?.type) {
    results = results.filter(m => m.type === filters.type);
  }

  if (filters?.genre) {
    results = results.filter(m => m.genres.includes(filters.genre!));
  }

  return results;
}

export async function getCatalogManga(id: string): Promise<CatalogManga | undefined> {
  return DEMO_MANGAS.find(m => m.id === id);
}

export async function getCatalogChapters(mangaId: string): Promise<CatalogChapter[]> {
  const manga = DEMO_MANGAS.find(m => m.id === mangaId);
  return manga?.chapters || [];
}

export async function getPopularMangas(limit: number = 10): Promise<CatalogManga[]> {
  return [...DEMO_MANGAS].sort((a, b) => (b.totalViews || 0) - (a.totalViews || 0)).slice(0, limit);
}

export async function getLatestMangas(limit: number = 10): Promise<CatalogManga[]> {
  return [...DEMO_MANGAS].sort((a, b) => {
    const aDate = a.chapters[a.chapters.length - 1]?.date || '';
    const bDate = b.chapters[b.chapters.length - 1]?.date || '';
    return bDate.localeCompare(aDate);
  }).slice(0, limit);
}

export async function getNewestChapters(limit: number = 20): Promise<{ manga: CatalogManga; chapter: CatalogChapter }[]> {
  const results: { manga: CatalogManga; chapter: CatalogChapter }[] = [];
  
  for (const manga of DEMO_MANGAS) {
    for (const chapter of manga.chapters) {
      results.push({ manga, chapter });
    }
  }
  
  return results
    .sort((a, b) => (b.chapter.date || '').localeCompare(a.chapter.date || ''))
    .slice(0, limit);
}

export function getAllGenres(): string[] {
  const genres = new Set<string>();
  DEMO_MANGAS.forEach(m => m.genres.forEach(g => genres.add(g)));
  return Array.from(genres).sort();
}

export function formatViews(views: number): string {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(0)}K`;
  return views.toString();
}
