import { openDB, IDBPDatabase } from 'idb';
import { Manga, Chapter, Page, ReadingProgress } from '../types';

const DB_NAME = 'manga-offline-db';
const DB_VERSION = 3;

let dbInstance: IDBPDatabase | null = null;

export async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Manga store
      if (!db.objectStoreNames.contains('mangas')) {
        const mangaStore = db.createObjectStore('mangas', { keyPath: 'id' });
        mangaStore.createIndex('title', 'title');
        mangaStore.createIndex('status', 'status');
        mangaStore.createIndex('type', 'type');
        mangaStore.createIndex('createdAt', 'createdAt');
        mangaStore.createIndex('updatedAt', 'updatedAt');
        mangaStore.createIndex('lastReadAt', 'lastReadAt');
        mangaStore.createIndex('isFavorite', 'isFavorite');
      }

      // Chapter store
      if (!db.objectStoreNames.contains('chapters')) {
        const chapterStore = db.createObjectStore('chapters', { keyPath: 'id' });
        chapterStore.createIndex('mangaId', 'mangaId');
        chapterStore.createIndex('mangaId_number', ['mangaId', 'number']);
      }

      // Page store
      if (!db.objectStoreNames.contains('pages')) {
        const pageStore = db.createObjectStore('pages', { keyPath: 'id' });
        pageStore.createIndex('chapterId', 'chapterId');
        pageStore.createIndex('chapterId_pageNumber', ['chapterId', 'pageNumber']);
        pageStore.createIndex('mangaId', 'mangaId');
      }

      // Reading progress store
      if (!db.objectStoreNames.contains('progress')) {
        const progressStore = db.createObjectStore('progress', { keyPath: 'id' });
        progressStore.createIndex('mangaId', 'mangaId');
        progressStore.createIndex('lastReadAt', 'lastReadAt');
      }

      // Downloads store
      if (!db.objectStoreNames.contains('downloads')) {
        const downloadStore = db.createObjectStore('downloads', { keyPath: 'id' });
        downloadStore.createIndex('mangaId', 'mangaId');
        downloadStore.createIndex('status', 'status');
        downloadStore.createIndex('createdAt', 'createdAt');
      }

      // Notifications store
      if (!db.objectStoreNames.contains('notifications')) {
        const notifStore = db.createObjectStore('notifications', { keyPath: 'id' });
        notifStore.createIndex('createdAt', 'createdAt');
        notifStore.createIndex('read', 'read');
      }

      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }

      // Providers store
      if (!db.objectStoreNames.contains('providers')) {
        db.createObjectStore('providers', { keyPath: 'id' });
      }

      // Reading history store
      if (!db.objectStoreNames.contains('history')) {
        const historyStore = db.createObjectStore('history', { keyPath: 'id' });
        historyStore.createIndex('mangaId', 'mangaId');
        historyStore.createIndex('accessedAt', 'accessedAt');
      }
    },
  });

  return dbInstance;
}

// Manga operations
export async function getAllMangas(): Promise<Manga[]> {
  const db = await getDB();
  return db.getAll('mangas');
}

export async function getManga(id: string): Promise<Manga | undefined> {
  const db = await getDB();
  return db.get('mangas', id);
}

export async function saveManga(manga: Manga): Promise<void> {
  const db = await getDB();
  await db.put('mangas', manga);
}

export async function deleteManga(id: string): Promise<void> {
  const db = await getDB();
  
  // Delete all chapters for this manga
  const chapters = await db.getAllFromIndex('chapters', 'mangaId', id);
  for (const chapter of chapters) {
    await deleteChapter(chapter.id);
  }
  
  // Delete progress
  const progressTx = db.transaction('progress', 'readwrite');
  const progressIndex = progressTx.store.index('mangaId');
  let cursor = await progressIndex.openCursor(id);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await progressTx.done;
  
  // Delete manga
  await db.delete('mangas', id);
}

// Chapter operations
export async function getChaptersByManga(mangaId: string): Promise<Chapter[]> {
  const db = await getDB();
  const chapters = await db.getAllFromIndex('chapters', 'mangaId', mangaId);
  return chapters.sort((a, b) => a.number - b.number);
}

export async function getChapter(id: string): Promise<Chapter | undefined> {
  const db = await getDB();
  return db.get('chapters', id);
}

export async function saveChapter(chapter: Chapter): Promise<void> {
  const db = await getDB();
  await db.put('chapters', chapter);
}

export async function deleteChapter(id: string): Promise<void> {
  const db = await getDB();
  
  // Delete all pages for this chapter
  const pages = await db.getAllFromIndex('pages', 'chapterId', id);
  for (const page of pages) {
    // Revoke blob URL if exists
    if (page.imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(page.imageUrl);
    }
    await db.delete('pages', page.id);
  }
  
  // Delete chapter
  await db.delete('chapters', id);
}

// Page operations
export async function getPagesByChapter(chapterId: string): Promise<Page[]> {
  const db = await getDB();
  const pages = await db.getAllFromIndex('pages', 'chapterId', chapterId);
  return pages.sort((a, b) => a.pageNumber - b.pageNumber);
}

export async function savePage(page: Page): Promise<void> {
  const db = await getDB();
  await db.put('pages', page);
}

export async function savePages(pages: Page[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('pages', 'readwrite');
  for (const page of pages) {
    await tx.store.put(page);
  }
  await tx.done;
}

export async function deletePage(id: string): Promise<void> {
  const db = await getDB();
  const page = await db.get('pages', id);
  if (page && page.imageUrl.startsWith('blob:')) {
    URL.revokeObjectURL(page.imageUrl);
  }
  await db.delete('pages', id);
}

// Reading progress operations
export async function getProgress(mangaId: string): Promise<ReadingProgress | undefined> {
  const db = await getDB();
  const results = await db.getAllFromIndex('progress', 'mangaId', mangaId);
  return results.sort((a, b) => b.lastReadAt - a.lastReadAt)[0];
}

export async function saveProgress(progress: ReadingProgress): Promise<void> {
  const db = await getDB();
  await db.put('progress', progress);
}

export async function getRecentProgress(limit: number = 10): Promise<ReadingProgress[]> {
  const db = await getDB();
  const all = await db.getAll('progress');
  return all.sort((a, b) => b.lastReadAt - a.lastReadAt).slice(0, limit);
}

// Utility
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function getStorageStats(): Promise<{ totalMangas: number; totalChapters: number; totalPages: number; totalSize: number }> {
  const db = await getDB();
  const mangas = await db.getAll('mangas');
  const chapters = await db.getAll('chapters');
  const pages = await db.getAll('pages');
  
  const totalSize = mangas.reduce((sum, m) => sum + (m.storageSize || 0), 0) +
                    chapters.reduce((sum, c) => sum + (c.storageSize || 0), 0);
  
  return {
    totalMangas: mangas.length,
    totalChapters: chapters.length,
    totalPages: pages.length,
    totalSize,
  };
}
