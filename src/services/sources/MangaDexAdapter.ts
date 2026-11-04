import {
  OnlineSourceAdapter,
  SourceManga,
  SourceChapter,
  SourcePage,
  SourceSearchResult,
  SourceAvailability,
} from './types';

/**
 * Adaptador oficial para a API pública do MangaDex (https://api.mangadex.org).
 * Totalmente compatível, público, autorizado, sem WAF bloqueador e com mais de 13.000 obras em Português (pt-br).
 */
export class MangaDexAdapter implements OnlineSourceAdapter {
  readonly id = 'mangadex';
  readonly name = 'MangaDex (Oficial / Aberto)';
  readonly baseUrl = 'https://api.mangadex.org';
  readonly icon = '📙';
  readonly description = 'Catálogo aberto global com milhares de obras traduzidas em Português';
  readonly isAuthorized = true;

  private coverBaseUrl = 'https://uploads.mangadex.org/covers';
  private cachePrefix = 'source_cache_mangadex_';

  async isAvailable(): Promise<SourceAvailability> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${this.baseUrl}/ping`, { signal: controller.signal });
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

  async getMangaList(page: number = 1, search?: string, genre?: string): Promise<SourceSearchResult> {
    const limit = 20;
    const offset = (page - 1) * limit;

    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      'availableTranslatedLanguage[]': 'pt-br',
      'includes[]': 'cover_art',
      'order[followedCount]': 'desc',
      'contentRating[]': 'safe',
    });

    if (search && search.trim()) {
      params.set('title', search.trim());
    }

    const url = `${this.baseUrl}/manga?${params.toString()}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} ao consultar MangaDex`);
      const data = await res.json();

      const mangas: SourceManga[] = (data.data || []).map((item: any) => {
        const attr = item.attributes;
        const title = attr.title?.['pt-br'] || attr.title?.en || Object.values(attr.title || {})[0] || 'Sem título';
        const synopsis = attr.description?.['pt-br'] || attr.description?.en || '';

        // Obter capa
        const coverRel = item.relationships?.find((r: any) => r.type === 'cover_art');
        const coverFileName = coverRel?.attributes?.fileName;
        const coverUrl = coverFileName ? `${this.coverBaseUrl}/${item.id}/${coverFileName}.512.jpg` : undefined;
        const thumbnailUrl = coverFileName ? `${this.coverBaseUrl}/${item.id}/${coverFileName}.256.jpg` : undefined;

        // Tags / Gêneros
        const genres = (attr.tags || [])
          .map((t: any) => t.attributes?.name?.en)
          .filter(Boolean)
          .slice(0, 5);

        return {
          id: `mangadex:${item.id}`,
          sourceId: this.id,
          title: String(title),
          synopsis: String(synopsis),
          coverUrl,
          thumbnailUrl,
          genres,
          type: (attr.originalLanguage === 'ko' ? 'manhwa' : attr.originalLanguage === 'zh' ? 'manhua' : 'manga') as any,
          status: attr.status === 'completed' ? 'completed' : 'ongoing',
          language: 'pt-br',
        };
      });

      // Salva no cache local para resiliência offline
      this.saveCache(`list_${page}_${search || ''}`, mangas, data.total || 0);

      return {
        mangas,
        total: data.total || mangas.length,
        hasMore: offset + limit < (data.total || 0),
        page,
      };
    } catch (err: any) {
      // Fallback para cache local se offline
      const cached = this.getCache<SourceSearchResult>(`list_${page}_${search || ''}`);
      if (cached) return cached;
      throw err;
    }
  }

  async getMangaDetails(sourceMangaId: string): Promise<SourceManga> {
    const mangaId = sourceMangaId.replace(/^mangadex:/, '');
    const url = `${this.baseUrl}/manga/${mangaId}?includes[]=cover_art&includes[]=author&includes[]=artist`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} ao carregar detalhes`);
      const json = await res.json();
      const item = json.data;
      const attr = item.attributes;

      const title = attr.title?.['pt-br'] || attr.title?.en || Object.values(attr.title || {})[0] || 'Sem título';
      const synopsis = attr.description?.['pt-br'] || attr.description?.en || '';

      const coverRel = item.relationships?.find((r: any) => r.type === 'cover_art');
      const coverFileName = coverRel?.attributes?.fileName;
      const coverUrl = coverFileName ? `${this.coverBaseUrl}/${item.id}/${coverFileName}.512.jpg` : undefined;

      const authorRel = item.relationships?.find((r: any) => r.type === 'author');
      const artistRel = item.relationships?.find((r: any) => r.type === 'artist');

      const genres = (attr.tags || [])
        .map((t: any) => t.attributes?.name?.en)
        .filter(Boolean);

      const manga: SourceManga = {
        id: `mangadex:${item.id}`,
        sourceId: this.id,
        title: String(title),
        synopsis: String(synopsis),
        coverUrl,
        thumbnailUrl: coverUrl,
        genres,
        type: (attr.originalLanguage === 'ko' ? 'manhwa' : attr.originalLanguage === 'zh' ? 'manhua' : 'manga') as any,
        status: attr.status === 'completed' ? 'completed' : 'ongoing',
        author: authorRel?.attributes?.name,
        artist: artistRel?.attributes?.name,
        language: 'pt-br',
      };

      this.saveCache(`manga_${mangaId}`, manga);
      return manga;
    } catch (err: any) {
      const cached = this.getCache<SourceManga>(`manga_${mangaId}`);
      if (cached) return cached;
      throw err;
    }
  }

  async getChapterList(sourceMangaId: string): Promise<SourceChapter[]> {
    const mangaId = sourceMangaId.replace(/^mangadex:/, '');
    const limit = 100;
    let offset = 0;
    const allChapters: SourceChapter[] = [];

    try {
      while (true) {
        const params = new URLSearchParams({
          limit: String(limit),
          offset: String(offset),
          'translatedLanguage[]': 'pt-br',
          'order[chapter]': 'asc',
          'includes[]': 'scanlation_group',
        });

        const res = await fetch(`${this.baseUrl}/manga/${mangaId}/feed?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status} ao listar capítulos`);
        const data = await res.json();

        const items = data.data || [];
        for (const ch of items) {
          const attr = ch.attributes;
          const chNum = parseFloat(attr.chapter) || (allChapters.length + 1);
          const scanRel = ch.relationships?.find((r: any) => r.type === 'scanlation_group');

          allChapters.push({
            id: `mangadex:${ch.id}`,
            sourceId: this.id,
            mangaId: sourceMangaId,
            number: chNum,
            title: attr.title ? `Cap. ${chNum} - ${attr.title}` : `Capítulo ${chNum}`,
            releaseDate: attr.publishAt,
            scanlator: scanRel?.attributes?.name,
            language: 'pt-br',
            pageCountEstimate: attr.pages || 0,
          });
        }

        offset += limit;
        if (offset >= (data.total || 0) || items.length === 0) break;
      }

      // Ordenar por número
      allChapters.sort((a, b) => a.number - b.number);
      this.saveCache(`chapters_${mangaId}`, allChapters);
      return allChapters;
    } catch (err: any) {
      const cached = this.getCache<SourceChapter[]>(`chapters_${mangaId}`);
      if (cached) return cached;
      throw err;
    }
  }

  async getChapterPages(sourceMangaId: string, chapterId: string): Promise<SourcePage[]> {
    const cleanChapterId = chapterId.replace(/^mangadex:/, '');
    const url = `${this.baseUrl}/at-home/server/${cleanChapterId}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} ao obter servidor de imagens`);
    const json = await res.json();

    const host = json.baseUrl;
    const hash = json.chapter?.hash;
    const fileNames: string[] = json.chapter?.data || [];

    if (!host || !hash || fileNames.length === 0) {
      throw new Error('Nenhuma página válida retornada pelo servidor MangaDex');
    }

    return fileNames.map((fn, index) => ({
      pageNumber: index + 1,
      imageUrl: `${host}/data/${hash}/${fn}`,
    }));
  }

  // --- Cache helpers ---
  private getCache<T>(key: string): T | null {
    try {
      const val = localStorage.getItem(`${this.cachePrefix}${key}`);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  }

  private saveCache(key: string, data: any, total?: number) {
    try {
      localStorage.setItem(`${this.cachePrefix}${key}`, JSON.stringify(data));
    } catch {}
  }
}
