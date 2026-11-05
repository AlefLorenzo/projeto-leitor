import {
  OnlineSourceAdapter,
  SourceManga,
  SourceChapter,
  SourcePage,
  SourceSearchResult,
  SourceAvailability,
  SourceFilterOptions,
} from './types';
import { isCapacitorNative, isViteDev, universalFetch } from '../platform';
import { resolveMangaTitles } from './titleHelper';

/**
 * Ordenação natural e inteligente de capítulos
 * Suporta inteiros (1, 2, 10), decimais (5.5), Prólogos (0 ou negativos),
 * Especiais, Extras, Finais e capítulos sem numeração.
 */
export function naturalChapterSort(
  a: SourceChapter,
  b: SourceChapter,
  direction: 'asc' | 'desc' = 'asc'
): number {
  const numA = typeof a.number === 'number' && !isNaN(a.number) ? a.number : 999999;
  const numB = typeof b.number === 'number' && !isNaN(b.number) ? b.number : 999999;

  let comparison = 0;
  if (numA !== numB) {
    comparison = numA - numB;
  } else {
    // Desempate por título/string ou data
    const strA = a.chapterStr || a.title || '';
    const strB = b.chapterStr || b.title || '';
    comparison = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
  }

  return direction === 'asc' ? comparison : -comparison;
}

/**
 * Adaptador oficial de alta performance para a API pública do MangaDex (https://api.mangadex.org).
 * Implementa rate-limiting, ordenação natural, preservação de versões e scanlators,
 * suporte completo a filtros (Mangá, Manhwa, Manhua, Status, Idioma) e cache resiliente.
 */
export class MangaDexAdapter implements OnlineSourceAdapter {
  readonly id = 'mangadex';
  readonly name = 'MangaDex (Oficial)';
  readonly baseUrl = 'https://api.mangadex.org';
  readonly icon = '📙';
  readonly description = 'Catálogo oficial global com milhares de obras traduzidas em Português';
  readonly isAuthorized = true;

  /**
   * Detecta se o app está rodando como APK nativo (Capacitor).
   */
  private get isDevServer(): boolean {
    return isViteDev();
  }

  private get apiBase(): string {
    if (this.isDevServer) return '/api/mangadex';
    return this.baseUrl; // 'https://api.mangadex.org' sempre no APK nativo!
  }

  private get coverBase(): string {
    if (this.isDevServer) return '/api/mdcovers';
    return 'https://uploads.mangadex.org/covers'; // Direto no APK nativo!
  }

  private coverBaseUrl = 'https://uploads.mangadex.org/covers';
  // Versão v2: invalida caches antigos que não usavam resolveMangaTitles
  private cachePrefix = 'manga_offline_md_cache_v2_';
  private lastRequestTime = 0;
  private minRequestInterval = 200; // Máx ~5 requisições por segundo para respeitar o rate-limit do MangaDex

  // Controle de requisições ativas para cancelamento
  private activeAbortController: AbortController | null = null;

  /**
   * Throttle interno para garantir respeito aos limites da API do MangaDex
   */
  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      await new Promise((resolve) => setTimeout(resolve, this.minRequestInterval - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Fetch seguro com retry exponencial em caso de 429 (Too Many Requests).
   * No APK, universalFetch executa via CapacitorHttp (nativo Java, sem restrições de CORS).
   */
  private async safeFetch(url: string, signal?: AbortSignal, maxRetries = 2): Promise<Response> {
    await this.throttle();
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const res = await universalFetch(url, { signal });
        if (res.status === 429) {
          attempt++;
          const waitTime = Math.pow(2, attempt) * 1000;
          console.warn(`[MangaDex] Rate-limited (429). Aguardando ${waitTime}ms...`);
          await new Promise((r) => setTimeout(r, waitTime));
          continue;
        }
        return res;
      } catch (err: any) {
        if (signal?.aborted) throw err;
        attempt++;
        if (attempt > maxRetries) throw err;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    throw new Error('Falha ao conectar à API MangaDex após retentativas.');
  }

  /**
   * Faz parse seguro de JSON garantindo que respostas HTML (como WAF ou página de erro)
   * não causem erros crípticos de Unexpected token '<'
   */
  private async parseJsonResponse<T>(res: Response, errorContext: string): Promise<T> {
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ao ${errorContext}`);
    }
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) {
      throw new Error(`Falha de conexão com a API MangaDex ao ${errorContext} (resposta do servidor não é JSON).`);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Resposta inválida da API ao ${errorContext}`);
    }
  }

  /**
   * Verifica se a API do MangaDex está disponível
   */
  async isAvailable(): Promise<SourceAvailability> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await this.safeFetch(`${this.apiBase}/ping`, controller.signal);
      clearTimeout(timeout);

      if (res.ok) {
        return { available: true };
      }
      return {
        available: false,
        statusCode: res.status,
        reason: `MangaDex retornou HTTP ${res.status}`,
      };
    } catch (err: any) {
      return {
        available: false,
        reason: `Falha de conexão com a API MangaDex: ${err.message}`,
      };
    }
  }

  /**
   * Lista e pesquisa obras com suporte a filtros completos (Tipo, Status, Idioma, Gênero, Ordenação)
   */
  async getMangaList(
    page: number = 1,
    filtersOrSearch?: SourceFilterOptions | string
  ): Promise<SourceSearchResult> {
    const options: SourceFilterOptions =
      typeof filtersOrSearch === 'string'
        ? { search: filtersOrSearch, page }
        : { page, ...filtersOrSearch };

    const limit = options.limit || 24;
    const currentPage = options.page || page || 1;
    const offset = (currentPage - 1) * limit;

    // Cancelar requisição anterior se houver
    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }
    this.activeAbortController = new AbortController();
    const currentSignal = this.activeAbortController.signal;

    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      'contentRating[]': 'safe',
    });
    params.append('includes[]', 'cover_art');
    params.append('includes[]', 'author');
    params.append('includes[]', 'artist');
    params.append('contentRating[]', 'suggestive');

    // Idioma das traduções disponíveis
    const lang = options.language || 'pt-br';
    if (lang !== 'all') {
      params.append('availableTranslatedLanguage[]', lang);
    }

    // Filtro por Tipo de Obra (originalLanguage)
    if (options.type && options.type !== 'all') {
      if (options.type === 'manga') params.append('originalLanguage[]', 'ja');
      if (options.type === 'manhwa') params.append('originalLanguage[]', 'ko');
      if (options.type === 'manhua') params.append('originalLanguage[]', 'zh');
    }

    // Filtro por Status da Obra
    if (options.status && options.status !== 'all') {
      params.append('status[]', options.status);
    }

    // Busca textual por título
    if (options.search && options.search.trim()) {
      params.set('title', options.search.trim());
    }

    // Ordenação
    const order = options.order || 'popular';
    switch (order) {
      case 'popular':
        params.set('order[followedCount]', 'desc');
        break;
      case 'rating':
        params.set('order[rating]', 'desc');
        break;
      case 'latest':
        params.set('order[latestUploadedChapter]', 'desc');
        break;
      case 'relevance':
        params.set('order[relevance]', 'desc');
        break;
      case 'title':
        params.set('order[title]', options.sortDirection || 'asc');
        break;
      default:
        params.set('order[followedCount]', 'desc');
    }

    const cacheKey = `list_${JSON.stringify({ ...options, page: currentPage, limit })}`;
    const url = `${this.apiBase}/manga?${params.toString()}`;

    try {
      const res = await this.safeFetch(url, currentSignal);
      const data = await this.parseJsonResponse<any>(res, 'consultar catálogo');

      const mangas: SourceManga[] = (data.data || []).map((item: any) => {
        const attr = item.attributes;

        // Tipo da obra (baseado no idioma original)
        const origLang = attr.originalLanguage;
        let type: 'manga' | 'manhwa' | 'manhua' = 'manga';
        if (origLang === 'ko') type = 'manhwa';
        else if (origLang === 'zh' || origLang === 'zh-hk') type = 'manhua';

        // Título principal com prioridade pt-br → pt → original → en → outros
        const resolved = resolveMangaTitles(attr.title, attr.altTitles, origLang);
        const title = resolved.title;
        const altTitles = resolved.altTitles;
        const synopsis =
          attr.description?.['pt-br'] ||
          attr.description?.['pt'] ||
          attr.description?.en ||
          Object.values(attr.description || {})[0] ||
          '';

        // Capa e miniatura
        const coverRel = item.relationships?.find((r: any) => r.type === 'cover_art');
        const coverFileName = coverRel?.attributes?.fileName;
        const coverUrl = coverFileName
          ? `${this.coverBase}/${item.id}/${coverFileName}.512.jpg`
          : undefined;
        const thumbnailUrl = coverFileName
          ? `${this.coverBase}/${item.id}/${coverFileName}.256.jpg`
          : undefined;

        // Autor e Artista
        const authorRel = item.relationships?.find((r: any) => r.type === 'author');
        const artistRel = item.relationships?.find((r: any) => r.type === 'artist');

        // Gêneros e Tags
        const genres = (attr.tags || [])
          .map((t: any) => t.attributes?.name?.en)
          .filter(Boolean);

        // Tipo da obra (baseado no idioma original)
        const origLang = attr.originalLanguage;
        let type: 'manga' | 'manhwa' | 'manhua' = 'manga';
        if (origLang === 'ko') type = 'manhwa';
        else if (origLang === 'zh' || origLang === 'zh-hk') type = 'manhua';

        // Status
        let status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled' = 'ongoing';
        if (attr.status === 'completed') status = 'completed';
        else if (attr.status === 'hiatus') status = 'hiatus';
        else if (attr.status === 'cancelled') status = 'cancelled';

        // Idiomas de tradução disponíveis
        const availableLanguages: string[] = attr.availableTranslatedLanguages || [];
        const hasPtBrChapters =
          availableLanguages.includes('pt-br') || availableLanguages.includes('pt');

        return {
          id: `mangadex:${item.id}`,
          sourceId: this.id,
          title: String(title),
          altTitles,
          synopsis: String(synopsis),
          coverUrl,
          thumbnailUrl,
          genres,
          type,
          status,
          author: authorRel?.attributes?.name,
          artist: artistRel?.attributes?.name,
          language: lang === 'all' ? 'pt-br' : lang,
          originalLanguage: origLang,
          year: attr.year,
          contentRating: attr.contentRating,
          hasPtBrChapters,
          availableLanguages,
        };
      });

      const result: SourceSearchResult = {
        mangas,
        total: data.total || mangas.length,
        hasMore: offset + limit < (data.total || 0),
        page: currentPage,
        limit,
      };

      this.saveCache(cacheKey, result);
      return result;
    } catch (err: any) {
      if (currentSignal.aborted) {
        throw new Error('Busca cancelada');
      }
      // Tentar resgatar do cache offline
      const cached = this.getCache<SourceSearchResult>(cacheKey);
      if (cached) {
        console.info(`[MangaDex] Retornando catálogo do cache offline para: ${cacheKey}`);
        return cached;
      }
      throw err;
    }
  }

  /**
   * Consulta os detalhes aprofundados de uma obra
   */
  async getMangaDetails(sourceMangaId: string): Promise<SourceManga> {
    const mangaId = sourceMangaId.replace(/^mangadex:/, '');
    const cacheKey = `manga_details_${mangaId}`;

    const url = `${this.apiBase}/manga/${mangaId}?includes[]=cover_art&includes[]=author&includes[]=artist`;

    try {
      const res = await this.safeFetch(url);
      const json = await this.parseJsonResponse<any>(res, 'carregar detalhes da obra');
      const item = json.data;
      const attr = item.attributes;

      const title =
        attr.title?.['pt-br'] ||
        attr.title?.['pt'] ||
        attr.title?.en ||
        attr.title?.['ja-ro'] ||
        attr.title?.['ko-ro'] ||
        attr.title?.['zh-ro'] ||
        Object.values(attr.title || {})[0] ||
        'Sem título';

      const altTitles: string[] = (attr.altTitles || [])
        .map((alt: any) => Object.values(alt)[0] as string)
        .filter(Boolean);

      const synopsis =
        attr.description?.['pt-br'] ||
        attr.description?.['pt'] ||
        attr.description?.en ||
        Object.values(attr.description || {})[0] ||
        '';

      const coverRel = item.relationships?.find((r: any) => r.type === 'cover_art');
      const coverFileName = coverRel?.attributes?.fileName;
      const coverUrl = coverFileName
        ? `${this.coverBase}/${item.id}/${coverFileName}.512.jpg`
        : undefined;
      const thumbnailUrl = coverFileName
        ? `${this.coverBase}/${item.id}/${coverFileName}.256.jpg`
        : undefined;

      const authorRel = item.relationships?.find((r: any) => r.type === 'author');
      const artistRel = item.relationships?.find((r: any) => r.type === 'artist');

      const genres = (attr.tags || [])
        .map((t: any) => t.attributes?.name?.en)
        .filter(Boolean);

      const origLang = attr.originalLanguage;
      let type: 'manga' | 'manhwa' | 'manhua' = 'manga';
      if (origLang === 'ko') type = 'manhwa';
      else if (origLang === 'zh' || origLang === 'zh-hk') type = 'manhua';

      let status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled' = 'ongoing';
      if (attr.status === 'completed') status = 'completed';
      else if (attr.status === 'hiatus') status = 'hiatus';
      else if (attr.status === 'cancelled') status = 'cancelled';

      const availableLanguages: string[] = attr.availableTranslatedLanguages || [];
      const hasPtBrChapters =
        availableLanguages.includes('pt-br') || availableLanguages.includes('pt');

      const manga: SourceManga = {
        id: `mangadex:${item.id}`,
        sourceId: this.id,
        title: String(title),
        altTitles,
        synopsis: String(synopsis),
        coverUrl,
        thumbnailUrl,
        genres,
        type,
        status,
        author: authorRel?.attributes?.name,
        artist: artistRel?.attributes?.name,
        language: 'pt-br',
        originalLanguage: origLang,
        year: attr.year,
        contentRating: attr.contentRating,
        hasPtBrChapters,
        availableLanguages,
      };

      this.saveCache(cacheKey, manga);
      return manga;
    } catch (err: any) {
      const cached = this.getCache<SourceManga>(cacheKey);
      if (cached) return cached;
      throw err;
    }
  }

  /**
   * Lista todos os capítulos de uma obra, preservando grupos de tradução e ordenando naturalmente
   */
  async getChapterList(sourceMangaId: string, language: string = 'pt-br'): Promise<SourceChapter[]> {
    const mangaId = sourceMangaId.replace(/^mangadex:/, '');
    const cacheKey = `chapters_${mangaId}_${language}`;

    const limit = 100;
    let offset = 0;
    const allChapters: SourceChapter[] = [];

    try {
      while (true) {
        const params = new URLSearchParams({
          limit: String(limit),
          offset: String(offset),
          'order[chapter]': 'asc',
          'order[volume]': 'asc',
          'contentRating[]': 'safe',
        });
        params.append('includes[]', 'scanlation_group');
        params.append('contentRating[]', 'suggestive');

        if (language && language !== 'all') {
          params.append('translatedLanguage[]', language);
          if (language === 'pt-br') {
            params.append('translatedLanguage[]', 'pt');
          }
        }

        const res = await this.safeFetch(`${this.apiBase}/manga/${mangaId}/feed?${params.toString()}`);
        const data = await this.parseJsonResponse<any>(res, 'carregar capítulos');

        const items = data.data || [];
        for (const ch of items) {
          const attr = ch.attributes;
          const rawChapterStr = attr.chapter !== null && attr.chapter !== undefined ? String(attr.chapter).trim() : '';

          // Trata capítulo número (ex: 5.5, 10, 0)
          let chNum: number;
          if (rawChapterStr && !isNaN(parseFloat(rawChapterStr))) {
            chNum = parseFloat(rawChapterStr);
          } else {
            // Capítulos especiais sem número (ex: Prólogo, Extra, Oneshot)
            chNum = allChapters.length > 0 ? allChapters[allChapters.length - 1].number + 0.1 : 0;
          }

          const scanRel = ch.relationships?.find((r: any) => r.type === 'scanlation_group');
          const scanlatorName = scanRel?.attributes?.name || 'Scan Independente';

          let title = '';
          if (attr.title) {
            title = rawChapterStr ? `Cap. ${rawChapterStr} - ${attr.title}` : attr.title;
          } else if (rawChapterStr) {
            title = `Capítulo ${rawChapterStr}`;
          } else {
            title = `Capítulo Especial`;
          }

          allChapters.push({
            id: `mangadex:${ch.id}`,
            sourceId: this.id,
            mangaId: sourceMangaId,
            number: chNum,
            chapterStr: rawChapterStr || 'Especial',
            volume: attr.volume || undefined,
            title,
            releaseDate: attr.publishAt,
            scanlator: scanlatorName,
            scanlatorGroup: scanRel ? { id: scanRel.id, name: scanlatorName } : undefined,
            language: attr.translatedLanguage,
            pageCountEstimate: attr.pages || 0,
            isExternal: Boolean(attr.externalUrl),
            externalUrl: attr.externalUrl || undefined,
          });
        }

        offset += limit;
        if (offset >= (data.total || 0) || items.length === 0) break;
      }

      // Ordenar com algoritmo natural
      allChapters.sort((a, b) => naturalChapterSort(a, b, 'asc'));

      this.saveCache(cacheKey, allChapters);
      return allChapters;
    } catch (err: any) {
      const cached = this.getCache<SourceChapter[]>(cacheKey);
      if (cached) return cached;
      throw err;
    }
  }

  /**
   * Obtém as páginas de um capítulo através do servidor At-Home
   */
  async getChapterPages(sourceMangaId: string, chapterId: string): Promise<SourcePage[]> {
    const cleanChapterId = chapterId.replace(/^mangadex:/, '');
    const url = `${this.apiBase}/at-home/server/${cleanChapterId}`;

    const res = await this.safeFetch(url);
    const json = await this.parseJsonResponse<any>(res, 'obter servidor de imagens MangaDex');

    const host = json.baseUrl;
    const hash = json.chapter?.hash;
    const files: string[] = json.chapter?.data || [];
    const filesSaver: string[] = json.chapter?.dataSaver || [];

    if (!host || !hash || files.length === 0) {
      throw new Error('Nenhuma página retornada para este capítulo no MangaDex.');
    }

    /**
     * Resolução de URL de imagem por contexto:
     * - Node.js (testes): URL direta do CDN
     * - APK nativo (Capacitor): URL direta — o MainActivity.java intercepta
     *   e faz proxy nativo via shouldInterceptRequest com CORS adicionado
     * - Browser dev: /api/mdimg?url=... via proxy dinâmico do Vite
     */
    const resolveImageUrl = (imgHost: string, path: string): string => {
      const fullUrl = `${imgHost}${path}`;
      if (typeof window === 'undefined') return fullUrl; // Node.js
      if (!this.isDevServer) return fullUrl; // APK nativo e produção usam CDN direta!
      return `/api/mdimg?url=${encodeURIComponent(fullUrl)}`; // Browser dev
    };

    return files.map((fileName, index) => {
      const saverFileName = filesSaver[index] || fileName;
      return {
        pageNumber: index + 1,
        imageUrl: resolveImageUrl(host, `/data/${hash}/${fileName}`),
        dataSaverUrl: resolveImageUrl(host, `/data-saver/${hash}/${saverFileName}`),
      };
    });
  }

  // --- Helpers de Cache Persistente ---
  private getCache<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(`${this.cachePrefix}${key}`);
      if (!item) return null;
      const parsed = JSON.parse(item);
      // TTL de 2 horas para catálogo e 24 horas para detalhes
      const ttl = key.startsWith('list_') ? 2 * 3600 * 1000 : 24 * 3600 * 1000;
      if (Date.now() - parsed.timestamp > ttl) {
        localStorage.removeItem(`${this.cachePrefix}${key}`);
        return null;
      }
      return parsed.data as T;
    } catch {
      return null;
    }
  }

  private saveCache(key: string, data: any): void {
    try {
      localStorage.setItem(
        `${this.cachePrefix}${key}`,
        JSON.stringify({ timestamp: Date.now(), data })
      );
    } catch (e) {
      // Limpar entradas antigas do cache se localStorage encher
      this.pruneOldCache();
    }
  }

  private pruneOldCache(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this.cachePrefix)) {
          keysToRemove.push(k);
        }
      }
      // Remove metade dos itens mais antigos
      keysToRemove.slice(0, Math.ceil(keysToRemove.length / 2)).forEach((k) => localStorage.removeItem(k));
    } catch {}
  }
}
