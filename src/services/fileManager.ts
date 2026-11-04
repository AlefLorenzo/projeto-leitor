import { MangaFileInfo, ChapterFileInfo, PageFileInfo } from '../types';
import { getDB } from './database';

export async function getMangaFileInfo(mangaId: string): Promise<MangaFileInfo | null> {
  const db = await getDB();
  
  const manga = await db.get('mangas', mangaId);
  if (!manga) return null;

  const chapters = await db.getAllFromIndex('chapters', 'mangaId', mangaId);
  const pages = await db.getAllFromIndex('pages', 'mangaId', mangaId);

  const chapterFiles: ChapterFileInfo[] = chapters.map((chapter: any) => {
    const chapterPages = pages
      .filter((p: any) => p.chapterId === chapter.id)
      .sort((a: any, b: any) => a.pageNumber - b.pageNumber);

    const pageFiles: PageFileInfo[] = chapterPages.map((page: any) => ({
      pageId: page.id,
      pageNumber: page.pageNumber,
      size: page.imageUrl ? Math.round(page.imageUrl.length * 0.75) : 0, // Estimate size from base64
      format: page.imageUrl ? page.imageUrl.split(';')[0].split('/')[1] || 'unknown' : 'unknown',
    }));

    return {
      chapterId: chapter.id,
      chapterNumber: chapter.number,
      chapterTitle: chapter.title,
      pagesCount: chapter.pagesCount,
      size: chapter.storageSize || pageFiles.reduce((sum, p) => sum + p.size, 0),
      pages: pageFiles,
    };
  });

  const totalSize = chapterFiles.reduce((sum, c) => sum + c.size, 0);
  const totalPages = pages.length;

  return {
    mangaId,
    totalSize,
    chaptersCount: chapters.length,
    pagesCount: totalPages,
    storageLocation: 'IndexedDB (Armazenamento local do navegador)',
    lastModified: manga.updatedAt,
    chapters: chapterFiles.sort((a, b) => a.chapterNumber - b.chapterNumber),
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export async function exportMangaAsJSON(mangaId: string): Promise<string> {
  const db = await getDB();
  
  const manga = await db.get('mangas', mangaId);
  if (!manga) throw new Error('Obra não encontrada');

  const chapters = await db.getAllFromIndex('chapters', 'mangaId', mangaId);
  const pages = await db.getAllFromIndex('pages', 'mangaId', mangaId);
  const progress = await db.getAllFromIndex('progress', 'mangaId', mangaId);

  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    manga: {
      ...manga,
      coverUrl: manga.coverUrl ? '[CAPA_OMITIDA]' : null,
    },
    chapters: chapters.map((c: any) => ({
      ...c,
    })),
    pages: pages.map((p: any) => ({
      id: p.id,
      chapterId: p.chapterId,
      pageNumber: p.pageNumber,
      imageUrl: '[IMAGEM_OMITIDA]',
      createdAt: p.createdAt,
    })),
    progress,
    statistics: {
      totalChapters: chapters.length,
      totalPages: pages.length,
      totalSize: manga.storageSize,
    },
  };

  return JSON.stringify(exportData, null, 2);
}

export async function getStorageBreakdown(): Promise<{
  totalSize: number;
  byManga: { id: string; title: string; size: number; percentage: number }[];
}> {
  const db = await getDB();
  const mangas = await db.getAll('mangas');
  
  let totalSize = 0;
  const byManga: { id: string; title: string; size: number; percentage: number }[] = [];

  for (const manga of mangas) {
    const size = manga.storageSize || 0;
    totalSize += size;
    byManga.push({
      id: manga.id,
      title: manga.title,
      size,
      percentage: 0, // Will calculate after
    });
  }

  // Calculate percentages
  byManga.forEach(item => {
    item.percentage = totalSize > 0 ? (item.size / totalSize) * 100 : 0;
  });

  // Sort by size descending
  byManga.sort((a, b) => b.size - a.size);

  return { totalSize, byManga };
}

export async function getChapterStorageInfo(chapterId: string): Promise<{
  size: number;
  pagesCount: number;
  averagePageSize: number;
}> {
  const db = await getDB();
  const chapter = await db.get('chapters', chapterId);
  const pages = await db.getAllFromIndex('pages', 'chapterId', chapterId);

  const totalSize = pages.reduce((sum: number, p: any) => {
    return sum + (p.imageUrl ? Math.round(p.imageUrl.length * 0.75) : 0);
  }, 0);

  return {
    size: chapter?.storageSize || totalSize,
    pagesCount: pages.length,
    averagePageSize: pages.length > 0 ? Math.round(totalSize / pages.length) : 0,
  };
}

export async function cleanupOrphanedFiles(): Promise<{
  deletedChapters: number;
  deletedPages: number;
  freedSpace: number;
}> {
  const db = await getDB();
  let deletedChapters = 0;
  let deletedPages = 0;
  let freedSpace = 0;

  // Find chapters without manga
  const allChapters = await db.getAll('chapters');
  for (const chapter of allChapters) {
    const manga = await db.get('mangas', chapter.mangaId);
    if (!manga) {
      // Delete chapter and its pages
      const pages = await db.getAllFromIndex('pages', 'chapterId', chapter.id);
      for (const page of pages) {
        freedSpace += page.storageSize || 0;
        await db.delete('pages', page.id);
        deletedPages++;
      }
      freedSpace += chapter.storageSize || 0;
      await db.delete('chapters', chapter.id);
      deletedChapters++;
    }
  }

  // Find pages without chapter
  const allPages = await db.getAll('pages');
  for (const page of allPages) {
    const chapter = await db.get('chapters', page.chapterId);
    if (!chapter) {
      freedSpace += page.storageSize || 0;
      await db.delete('pages', page.id);
      deletedPages++;
    }
  }

  return { deletedChapters, deletedPages, freedSpace };
}
