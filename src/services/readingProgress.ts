import { ReadingHistoryEntry, ReadingProgress, Chapter, ChapterReadStatus } from '../types';
import { getDB, generateId } from './database';

// History management
export async function addToHistory(
  mangaId: string,
  chapterId: string,
  pageNumber: number,
  duration?: number
): Promise<void> {
  const db = await getDB();
  if (!db.objectStoreNames.contains('history')) return;

  const entry: ReadingHistoryEntry = {
    id: generateId(),
    mangaId,
    chapterId,
    pageNumber,
    accessedAt: Date.now(),
    duration,
  };

  await db.add('history', entry);

  // Keep only last 1000 entries
  const all = await db.getAll('history');
  if (all.length > 1000) {
    const sorted = all.sort((a: ReadingHistoryEntry, b: ReadingHistoryEntry) => b.accessedAt - a.accessedAt);
    const toDelete = sorted.slice(1000);
    const tx = db.transaction('history', 'readwrite');
    for (const entry of toDelete) {
      await tx.store.delete(entry.id);
    }
    await tx.done;
  }
}

export async function getRecentHistory(limit: number = 50): Promise<ReadingHistoryEntry[]> {
  const db = await getDB();
  if (!db.objectStoreNames.contains('history')) return [];

  const all = await db.getAll('history');
  return all
    .sort((a: ReadingHistoryEntry, b: ReadingHistoryEntry) => b.accessedAt - a.accessedAt)
    .slice(0, limit);
}

export async function getHistoryByManga(mangaId: string): Promise<ReadingHistoryEntry[]> {
  const db = await getDB();
  if (!db.objectStoreNames.contains('history')) return [];

  const all = await db.getAllFromIndex('history', 'mangaId', mangaId);
  return all.sort((a: ReadingHistoryEntry, b: ReadingHistoryEntry) => b.accessedAt - a.accessedAt);
}

export async function clearHistory(): Promise<void> {
  const db = await getDB();
  if (!db.objectStoreNames.contains('history')) return;
  await db.clear('history');
}

// Chapter read status management
export async function updateChapterReadStatus(
  chapterId: string,
  status: ChapterReadStatus
): Promise<void> {
  const db = await getDB();
  const chapter = await db.get('chapters', chapterId);
  
  if (chapter) {
    chapter.readStatus = status;
    await db.put('chapters', chapter);
  }
}

export async function getChapterReadStatus(chapterId: string): Promise<ChapterReadStatus> {
  const db = await getDB();
  const chapter = await db.get('chapters', chapterId);
  return chapter?.readStatus || 'not_started';
}

export async function markChapterAsCompleted(chapterId: string): Promise<void> {
  await updateChapterReadStatus(chapterId, 'completed');
}

export async function markChapterAsInProgress(chapterId: string): Promise<void> {
  const currentStatus = await getChapterReadStatus(chapterId);
  if (currentStatus === 'not_started') {
    await updateChapterReadStatus(chapterId, 'in_progress');
  }
}

// Enhanced progress saving
export async function saveEnhancedProgress(
  mangaId: string,
  chapterId: string,
  pageNumber: number,
  totalPages: number,
  scrollPosition?: number,
  pageId?: string
): Promise<ReadingProgress> {
  const db = await getDB();
  
  // Get existing progress or create new
  const allProgress = await db.getAllFromIndex('progress', 'mangaId', mangaId);
  let existing = allProgress.find((p: ReadingProgress) => p.chapterId === chapterId);
  
  const percentComplete = totalPages > 0 ? Math.round((pageNumber / totalPages) * 100) : 0;
  
  const progress: ReadingProgress = {
    id: existing?.id || generateId(),
    mangaId,
    chapterId,
    pageNumber,
    totalPages,
    lastReadAt: Date.now(),
    completed: pageNumber === totalPages,
    scrollPosition,
    percentComplete,
    pageId,
    readingTime: existing?.readingTime || 0,
  };

  await db.put('progress', progress);

  // Update chapter status
  if (pageNumber === totalPages) {
    await markChapterAsCompleted(chapterId);
  } else if (pageNumber > 1) {
    await markChapterAsInProgress(chapterId);
  }

  // Add to history
  await addToHistory(mangaId, chapterId, pageNumber);

  return progress;
}

// Get progress with scroll position
export async function getEnhancedProgress(
  mangaId: string,
  chapterId: string
): Promise<ReadingProgress | null> {
  const db = await getDB();
  const allProgress = await db.getAllFromIndex('progress', 'mangaId', mangaId);
  return allProgress.find((p: ReadingProgress) => p.chapterId === chapterId) || null;
}

// Navigation helpers
export async function getPreviousChapter(mangaId: string, currentChapterId: string): Promise<Chapter | null> {
  const db = await getDB();
  const chapters = await db.getAllFromIndex('chapters', 'mangaId', mangaId);
  const sorted = chapters.sort((a: Chapter, b: Chapter) => a.number - b.number);
  
  const currentIndex = sorted.findIndex((c: Chapter) => c.id === currentChapterId);
  if (currentIndex > 0) {
    return sorted[currentIndex - 1];
  }
  return null;
}

export async function getNextChapter(mangaId: string, currentChapterId: string): Promise<Chapter | null> {
  const db = await getDB();
  const chapters = await db.getAllFromIndex('chapters', 'mangaId', mangaId);
  const sorted = chapters.sort((a: Chapter, b: Chapter) => a.number - b.number);
  
  const currentIndex = sorted.findIndex((c: Chapter) => c.id === currentChapterId);
  if (currentIndex >= 0 && currentIndex < sorted.length - 1) {
    return sorted[currentIndex + 1];
  }
  return null;
}

export async function isFirstChapter(mangaId: string, chapterId: string): Promise<boolean> {
  const db = await getDB();
  const chapters = await db.getAllFromIndex('chapters', 'mangaId', mangaId);
  const sorted = chapters.sort((a: Chapter, b: Chapter) => a.number - b.number);
  return sorted.length > 0 && sorted[0].id === chapterId;
}

export async function isLastChapter(mangaId: string, chapterId: string): Promise<boolean> {
  const db = await getDB();
  const chapters = await db.getAllFromIndex('chapters', 'mangaId', mangaId);
  const sorted = chapters.sort((a: Chapter, b: Chapter) => a.number - b.number);
  return sorted.length > 0 && sorted[sorted.length - 1].id === chapterId;
}

// Get all chapters with their read status
export async function getChaptersWithStatus(mangaId: string): Promise<(Chapter & { readStatus: ChapterReadStatus })[]> {
  const db = await getDB();
  const chapters = await db.getAllFromIndex('chapters', 'mangaId', mangaId);
  return chapters
    .sort((a: Chapter, b: Chapter) => a.number - b.number)
    .map((c: Chapter) => ({
      ...c,
      readStatus: c.readStatus || 'not_started',
    }));
}

// Get continue reading info
export async function getContinueReadingInfo(mangaId: string): Promise<{
  chapter: Chapter | null;
  progress: ReadingProgress | null;
} | null> {
  const db = await getDB();
  const allProgress = await db.getAllFromIndex('progress', 'mangaId', mangaId);
  
  if (allProgress.length === 0) return null;
  
  // Get most recent progress
  const sorted = allProgress.sort((a: ReadingProgress, b: ReadingProgress) => b.lastReadAt - a.lastReadAt);
  const latest = sorted[0];
  
  if (!latest || latest.completed) return null;
  
  const chapter = await db.get('chapters', latest.chapterId);
  
  return {
    chapter: chapter || null,
    progress: latest,
  };
}

// Calculate total reading time
export async function getTotalReadingTime(mangaId?: string): Promise<number> {
  const db = await getDB();
  
  if (mangaId) {
    const allProgress = await db.getAllFromIndex('progress', 'mangaId', mangaId);
    return allProgress.reduce((sum: number, p: ReadingProgress) => sum + (p.readingTime || 0), 0);
  }
  
  const allProgress = await db.getAll('progress');
  return allProgress.reduce((sum: number, p: ReadingProgress) => sum + (p.readingTime || 0), 0);
}

// Update reading time
export async function addReadingTime(
  mangaId: string,
  chapterId: string,
  seconds: number
): Promise<void> {
  const db = await getDB();
  const allProgress = await db.getAllFromIndex('progress', 'mangaId', mangaId);
  const progress = allProgress.find((p: ReadingProgress) => p.chapterId === chapterId);
  
  if (progress) {
    progress.readingTime = (progress.readingTime || 0) + seconds;
    await db.put('progress', progress);
  }
}
