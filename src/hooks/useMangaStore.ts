import { useState, useEffect, useCallback } from 'react';
import { Manga, Chapter, Page, ReadingProgress, ReadingStatus } from '../types';
import {
  getAllMangas,
  getManga,
  saveManga,
  deleteManga,
  getChaptersByManga,
  getPagesByChapter,
  getProgress,
  saveProgress,
  getRecentProgress,
  getStorageStats,
  generateId,
} from '../services/database';
import { matchesMangaQuery } from '../services/sources/titleHelper';

export function useMangaStore() {
  const [mangas, setMangas] = useState<Manga[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalMangas: 0, totalChapters: 0, totalPages: 0, totalSize: 0 });

  const loadMangas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllMangas();
      setMangas(data.sort((a, b) => b.updatedAt - a.updatedAt));
      const s = await getStorageStats();
      setStats(s);
    } catch (error) {
      console.error('Error loading mangas:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMangas();
  }, [loadMangas]);

  const refreshManga = useCallback(async (id: string) => {
    const manga = await getManga(id);
    if (manga) {
      setMangas(prev => prev.map(m => m.id === id ? manga : m));
    }
    const s = await getStorageStats();
    setStats(s);
  }, []);

  const updateMangaStatus = useCallback(async (id: string, status: ReadingStatus) => {
    const manga = await getManga(id);
    if (manga) {
      manga.status = status;
      manga.updatedAt = Date.now();
      await saveManga(manga);
      setMangas(prev => prev.map(m => m.id === id ? manga : m));
    }
  }, []);

  const toggleFavorite = useCallback(async (id: string) => {
    const manga = await getManga(id);
    if (manga) {
      manga.isFavorite = !manga.isFavorite;
      manga.updatedAt = Date.now();
      await saveManga(manga);
      setMangas(prev => prev.map(m => m.id === id ? manga : m));
    }
  }, []);

  const removeManga = useCallback(async (id: string) => {
    await deleteManga(id);
    setMangas(prev => prev.filter(m => m.id !== id));
    const s = await getStorageStats();
    setStats(s);
  }, []);

  const getFilteredMangas = useCallback((filters: {
    status?: ReadingStatus | 'all' | 'favorites' | 'imported';
    search?: string;
    type?: string;
  }) => {
    let filtered = [...mangas];

    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(m =>
        matchesMangaQuery(m.title, m.altTitles, m.author, filters.search!)
      );
    }

    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'favorites') {
        filtered = filtered.filter(m => m.isFavorite);
      } else if (filters.status === 'imported') {
        filtered = filtered.filter(m => m.source === 'local');
      } else {
        filtered = filtered.filter(m => m.status === filters.status);
      }
    }

    if (filters.type) {
      filtered = filtered.filter(m => m.type === filters.type);
    }

    return filtered;
  }, [mangas]);

  return {
    mangas,
    loading,
    stats,
    loadMangas,
    refreshManga,
    updateMangaStatus,
    toggleFavorite,
    removeManga,
    getFilteredMangas,
  };
}

export function useMangaDetails(mangaId: string | null) {
  const [manga, setManga] = useState<Manga | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [progress, setProgress] = useState<ReadingProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!mangaId) return;
    setLoading(true);
    try {
      const [m, c, p] = await Promise.all([
        getManga(mangaId),
        getChaptersByManga(mangaId),
        getProgress(mangaId),
      ]);
      setManga(m || null);
      setChapters(c);
      setProgress(p || null);
    } catch (error) {
      console.error('Error loading manga details:', error);
    } finally {
      setLoading(false);
    }
  }, [mangaId]);

  useEffect(() => {
    load();
  }, [load]);

  return { manga, chapters, progress, loading, reload: load };
}

export function useReader(mangaId: string | null, chapterId: string | null) {
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<ReadingProgress | null>(null);

  const loadPages = useCallback(async () => {
    if (!chapterId) return;
    setLoading(true);
    try {
      const p = await getPagesByChapter(chapterId);
      setPages(p);

      // Restore progress
      if (mangaId) {
        const prog = await getProgress(mangaId);
        if (prog && prog.chapterId === chapterId) {
          setCurrentPage(Math.max(0, prog.pageNumber - 1));
        } else {
          setCurrentPage(0);
        }
        setProgress(prog || null);
      }
    } catch (error) {
      console.error('Error loading pages:', error);
    } finally {
      setLoading(false);
    }
  }, [chapterId, mangaId]);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  const saveReadingProgress = useCallback(async (pageIndex: number) => {
    if (!mangaId || !chapterId || pages.length === 0) return;

    const newProgress: ReadingProgress = {
      id: progress?.id || generateId(),
      mangaId,
      chapterId,
      pageNumber: pageIndex + 1,
      totalPages: pages.length,
      lastReadAt: Date.now(),
      completed: pageIndex === pages.length - 1,
    };

    await saveProgress(newProgress);
    setProgress(newProgress);

    // Update manga lastReadAt
    const manga = await getManga(mangaId);
    if (manga) {
      manga.lastReadAt = Date.now();
      manga.updatedAt = Date.now();
      await saveManga(manga);
    }
  }, [mangaId, chapterId, pages.length, progress]);

  return {
    pages,
    currentPage,
    setCurrentPage,
    loading,
    progress,
    saveReadingProgress,
    totalPages: pages.length,
  };
}

export function useRecentReads(limit: number = 5) {
  const [recent, setRecent] = useState<ReadingProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getRecentProgress(limit);
        setRecent(data);
      } catch (error) {
        console.error('Error loading recent reads:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [limit]);

  return { recent, loading };
}
