// Interfaces agnósticas para Adaptadores de Fontes Online

export type ChapterDownloadState = 
  | 'online'               // Disponível online
  | 'downloading'          // Baixando
  | 'downloaded'           // Baixado e validado
  | 'incomplete'          // Download incompleto / com falha
  | 'offline_unavailable'; // Indisponível offline

export interface SourceManga {
  id: string;              // Identificador estável (ex: "mangadex:uuid" ou "lycan:slug")
  sourceId: string;        // ID do provedor (ex: "mangadex", "lycantoons", "github")
  title: string;
  synopsis?: string;
  coverUrl?: string;
  thumbnailUrl?: string;   // Miniatura para economizar largura de banda
  genres: string[];
  type: 'manga' | 'manhwa' | 'manhua';
  status: 'ongoing' | 'completed' | 'hiatus';
  totalChapters?: number;
  author?: string;
  artist?: string;
  language?: string;
}

export interface SourceChapter {
  id: string;              // Identificador estável do capítulo
  sourceId: string;
  mangaId: string;
  number: number;
  title: string;
  releaseDate?: string;
  scanlator?: string;
  language?: string;
  sizeEstimateBytes?: number;
  pageCountEstimate?: number;
}

export interface SourcePage {
  pageNumber: number;
  imageUrl: string;
}

export interface SourceSearchResult {
  mangas: SourceManga[];
  total: number;
  hasMore: boolean;
  page: number;
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

  /** Lista obras de forma paginada com suporte a busca e filtros */
  getMangaList(page: number, search?: string, genre?: string): Promise<SourceSearchResult>;

  /** Carrega os detalhes completos de uma obra */
  getMangaDetails(sourceMangaId: string): Promise<SourceManga>;

  /** Lista todos os capítulos de uma obra */
  getChapterList(sourceMangaId: string): Promise<SourceChapter[]>;

  /** Obtém as URLs de páginas de um capítulo */
  getChapterPages(sourceMangaId: string, chapterId: string): Promise<SourcePage[]>;
}
