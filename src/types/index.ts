// Types for Manga Offline Application

export type MangaType = 'manga' | 'manhwa' | 'manhua';
export type ReadingDirection = 'rtl' | 'ltr' | 'vertical';
export type ReadingStatus = 'reading' | 'want_to_read' | 'completed' | 'paused' | 'dropped';
export type ImportSource = 'local' | 'online';
export type DownloadStatus = 'waiting' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface Manga {
  id: string;
  title: string;
  author?: string;
  artist?: string;
  synopsis?: string;
  coverUrl?: string;
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
  storageSize: number;
  // Online catalog fields
  catalogId?: string;
  catalogProvider?: string;
  externalUrl?: string;
  autoDownload?: boolean;
  /** Títulos alternativos (pt, en, ja-ro, etc.) para busca multilíngue */
  altTitles?: string[];
  // Per-manga settings
  customSettings?: MangaSettings;
}

export interface MangaSettings {
  readingDirection?: ReadingDirection;
  zoomLevel?: number;
  brightness?: number;
  showPageNumber?: boolean;
  immersiveMode?: boolean;
  autoNextChapter?: boolean;
  pageSpacing?: number;
  doublePage?: boolean;
}

export type ChapterReadStatus = 'not_started' | 'in_progress' | 'completed';

export interface Chapter {
  id: string;
  mangaId: string;
  number: number;
  title: string;
  pagesCount: number;
  createdAt: number;
  storageSize: number;
  // Online fields
  externalUrl?: string;
  isDownloaded: boolean;
  scanlator?: string;
  // Reading status
  readStatus?: ChapterReadStatus;
}

export interface Page {
  id: string;
  chapterId: string;
  mangaId: string;
  pageNumber: number;
  imageUrl: string;
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
  // Enhanced progress tracking
  scrollPosition?: number; // For vertical mode
  percentComplete?: number; // 0-100
  pageId?: string; // Stable page identifier
  readingTime?: number; // Seconds spent reading
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

// Catalog types
export interface CatalogProvider {
  id: string;
  name: string;
  description: string;
  icon: string;
  baseUrl: string;
  catalogUrl: string;
  enabled: boolean;
  lastUpdated?: number;
}

export interface CatalogManga {
  id: string;
  providerId: string;
  title: string;
  author?: string;
  synopsis?: string;
  coverUrl: string;
  genres: string[];
  type: MangaType;
  status: string;
  chapters: CatalogChapter[];
  totalViews?: number;
  rating?: number;
  year?: number;
}

export interface CatalogChapter {
  id: string;
  number: number;
  title: string;
  date?: string;
  pagesCount?: number;
  size?: number;
  downloadUrl?: string;
}

// Download types
export interface DownloadTask {
  id: string;
  mangaId: string;
  chapterId: string;
  mangaTitle: string;
  chapterTitle: string;
  chapterNumber?: number;
  source?: 'mangadex' | 'telegram' | 'github' | 'local' | string;
  sourceData?: any;
  status: DownloadStatus;
  progress: number; // 0-100
  totalFiles: number;
  downloadedFiles: number;
  totalSize: number;
  downloadedSize: number;
  url?: string;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  retries: number;
  maxRetries: number;
}

export interface DownloadHistoryEntry {
  id: string;
  mangaId: string;
  chapterId: string;
  mangaTitle: string;
  chapterTitle: string;
  chapterNumber: number;
  completedAt: number;
  sizeBytes: number;
  source: string;
  status: 'completed' | 'failed' | 'cancelled';
  errorMessage?: string;
}

export interface DownloadStats {
  totalDownloads: number;
  totalChaptersDownloaded: number;
  totalMangasDownloaded: number;
  downloading: number;
  waiting: number;
  paused: number;
  completed: number;
  failed: number;
  totalBytesDownloaded: number;
}

// Settings
export interface AppSettings {
  readerMode: ReadingDirection;
  zoomLevel: number;
  brightness: number;
  showPageNumber: boolean;
  keepScreenOn: boolean;
  immersiveMode: boolean;
  autoSaveProgress: boolean;
  downloadWifiOnly: boolean;
  maxConcurrentDownloads: number;
  maxStorageMB: number;
  updateIntervalHours: number;
  autoUpdate: boolean;
  notificationsEnabled: boolean;
  language: string;
  theme: 'dark' | 'amoled';
}

// Statistics
export interface ReadingStats {
  totalMangas: number;
  totalChapters: number;
  totalPages: number;
  totalReadTime: number; // minutes
  totalPagesRead: number;
  longestStreak: number; // days
  currentStreak: number;
  averagePerPage: number;
  favoriteGenres: { genre: string; count: number }[];
  readingByDay: { day: string; count: number }[];
  monthlyActivity: { month: string; pages: number }[];
}

// Notification
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  createdAt: number;
  read: boolean;
  actionUrl?: string;
}

// Reading history
export interface ReadingHistoryEntry {
  id: string;
  mangaId: string;
  chapterId: string;
  pageNumber: number;
  accessedAt: number;
  duration?: number; // seconds
}

// File management
export interface MangaFileInfo {
  mangaId: string;
  totalSize: number;
  chaptersCount: number;
  pagesCount: number;
  storageLocation: string;
  lastModified: number;
  chapters: ChapterFileInfo[];
}

export interface ChapterFileInfo {
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  pagesCount: number;
  size: number;
  pages: PageFileInfo[];
}

export interface PageFileInfo {
  pageId: string;
  pageNumber: number;
  size: number;
  format: string;
}
