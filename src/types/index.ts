// Types for Manga Offline Application

export type MangaType = 'manga' | 'manhwa' | 'manhua';
export type ReadingDirection = 'rtl' | 'ltr' | 'vertical';
export type ReadingStatus = 'reading' | 'want_to_read' | 'completed' | 'paused' | 'dropped';
export type ImportSource = 'local' | 'online';

export interface Manga {
  id: string;
  title: string;
  author?: string;
  artist?: string;
  synopsis?: string;
  coverUrl?: string; // base64 or blob URL
  genres: string[];
  type: MangaType;
  readingDirection: ReadingDirection;
  status: ReadingStatus;
  language?: string;
  source: ImportSource;
  createdAt: number;
  updatedAt: number;
  lastReadAt?: number;
  isFavorite: boolean;
  totalChapters: number;
  totalPages: number;
  storageSize: number; // bytes
}

export interface Chapter {
  id: string;
  mangaId: string;
  number: number; // for sorting
  title: string; // e.g. "Capítulo 01", "Prólogo", "Especial"
  pagesCount: number;
  createdAt: number;
  storageSize: number;
}

export interface Page {
  id: string;
  chapterId: string;
  mangaId: string;
  pageNumber: number;
  imageUrl: string; // blob URL or base64
  filePath?: string;
  createdAt: number;
}

export interface ReadingProgress {
  id: string;
  mangaId: string;
  chapterId: string;
  pageNumber: number;
  totalPages: number;
  lastReadAt: number;
  completed: boolean;
}

export interface ImportOptions {
  title: string;
  author?: string;
  artist?: string;
  synopsis?: string;
  genres: string[];
  type: MangaType;
  readingDirection: ReadingDirection;
  language?: string;
  coverFile?: File;
}

export interface ChapterImport {
  title: string;
  number: number;
  files: File[];
}

export interface ImportResult {
  success: boolean;
  mangaId?: string;
  chaptersCreated: number;
  pagesCreated: number;
  errors: string[];
}
