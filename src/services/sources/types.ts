// Interfaces agnósticas para Adaptadores de Fontes Online e MangaDex

export type ChapterDownloadState =
  | 'online'               // Disponível online no catálogo
  | 'downloading'          // Baixando ativamente
  | 'downloaded'           // Baixado, validado e disponível offline
  | 'incomplete'          // Download incompleto ou falho
  | 'offline_unavailable'; // Indisponível offline

export type MangaSortOrder = 'popular' | 'latest' | 'rating' | 'relevance' | 'title';

export interface SourceFilterOptions {
  search?: string;
  page?: number;
  limit?: number;
  type?: 'all' | 'manga' | 'manhwa' | 'manhua';
  status?: 'all' | 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
  language?: string; // ex: 'pt-br' (padrão), 'all', 'en', 'es'
  genre?: string;
  order?: MangaSortOrder;
  sortDirection?: 'asc' | 'desc';
}

export interface SourceManga {
  id: string;              // Identificador estável (ex: "mangadex:uuid")
  sourceId: string;        // ID do provedor (ex: "mangadex")
  title: string;
  altTitles?: string[];    // Títulos alternativos
  synopsis?: string;
  coverUrl?: string;
  thumbnailUrl?: string;   // Miniatura otimizada para listagens
  genres: string[];
  type: 'manga' | 'manhwa' | 'manhua';
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
  totalChapters?: number;
  author?: string;
  artist?: string;
  language?: string;       // Idioma da tradução prioritária (ex: 'pt-br')
  originalLanguage?: string; // Idioma de origem (ex: 'ja', 'ko', 'zh')
  year?: number;
  contentRating?: string;
  hasPtBrChapters?: boolean;
  availableLanguages?: string[];
}

export interface SourceChapter {
  id: string;              // Identificador estável do capítulo
  sourceId: string;
  mangaId: string;
  number: number;
  chapterStr?: string;     // Representação exata (ex: "0", "1", "5.5", "Prólogo", "Extra")
  volume?: string;
  title: string;
  releaseDate?: string;
  scanlator?: string;
  scanlatorGroup?: { id: string; name: string };
  language?: string;
  sizeEstimateBytes?: number;
  pageCountEstimate?: number;
  isExternal?: boolean;
  externalUrl?: string;
}

export interface SourcePage {
  pageNumber: number;
  imageUrl: string;
  dataSaverUrl?: string;
}

export interface SourceSearchResult {
  mangas: SourceManga[];
  total: number;
  hasMore: boolean;
  page: number;
  limit: number;
}

export interface SourceAvailability {
  available: boolean;
  reason?: string;
  statusCode?: number;
  protectionType?: 'none' | 'cloudflare_waf' | 'auth_required' | 'unknown';
}

export interface OnlineSourceAdapter {
  readonly id: string;
  readonly name: string;
  readonly baseUrl: string;
  readonly icon: string;
  readonly description: string;
  readonly isAuthorized: boolean;

  /** Verifica se a fonte continua disponível e acessível */
  isAvailable(): Promise<SourceAvailability>;

  /** Lista obras de forma paginada com suporte a filtros completos */
  getMangaList(page?: number, filters?: SourceFilterOptions | string): Promise<SourceSearchResult>;

  /** Carrega os detalhes completos de uma obra */
  getMangaDetails(sourceMangaId: string): Promise<SourceManga>;

  /** Lista todos os capítulos de uma obra respeitando idioma e múltiplos grupos */
  getChapterList(sourceMangaId: string, language?: string): Promise<SourceChapter[]>;

  /** Obtém as URLs de páginas de um capítulo */
  getChapterPages(sourceMangaId: string, chapterId: string): Promise<SourcePage[]>;
}
