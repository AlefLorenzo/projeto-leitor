import {
  OnlineSourceAdapter,
  SourceManga,
  SourceChapter,
  SourcePage,
  SourceSearchResult,
  SourceAvailability,
} from './types';

/**
 * Adaptador para a fonte Lycantoons (https://lycantoons.com/series).
 * 
 * NOTA DE SEGURANÇA E CONFORMIDADE:
 * Lycantoons não oferece API pública oficial para desenvolvedores e utiliza
 * Cloudflare Bot Management / WAF que responde com HTTP 403 Forbidden para acessos
 * diretos automatizados.
 * 
 * Conforme as diretrizes arquiteturais do projeto:
 * - Não contornamos mecanismos anti-bot ou desafios Cloudflare.
 * - Reportamos a limitação e mantemos a estrutura pronta para quando a fonte oferecer acesso autorizado.
 */
export class LycantoonsAdapter implements OnlineSourceAdapter {
  readonly id = 'lycantoons';
  readonly name = 'Lycan Toons';
  readonly baseUrl = 'https://lycantoons.com';
  readonly icon = '🐺';
  readonly description = 'Scanlator brasileira (referência solicitada - protegida por Cloudflare)';
  readonly isAuthorized = false;

  private cacheKeyPrefix = 'source_cache_lycantoons_';

  async isAvailable(): Promise<SourceAvailability> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`${this.baseUrl}/series`, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      }).catch((e) => {
        // Erro de rede ou CORS
        return null;
      });

      clearTimeout(timeout);

      if (!res) {
        return {
          available: false,
          reason: 'Falha na conexão de rede ou bloqueio de CORS ao tentar acessar lycantoons.com.',
          protectionType: 'unknown',
        };
      }

      if (res.status === 403) {
        return {
          available: false,
          statusCode: 403,
          protectionType: 'cloudflare_waf',
          reason: 'Bloqueio Cloudflare WAF ativo (HTTP 403 - Attention Required!). O site exige interação humana no navegador e não disponibiliza API pública aberta.',
        };
      }

      if (!res.ok) {
        return {
          available: false,
          statusCode: res.status,
          reason: `Servidor retornou HTTP ${res.status}: ${res.statusText}`,
        };
      }

      return { available: true };
    } catch (err: any) {
      return {
        available: false,
        reason: `Erro ao consultar disponibilidade: ${err.message}`,
        protectionType: 'unknown',
      };
    }
  }

  async getMangaList(page: number = 1, search?: string, genre?: string): Promise<SourceSearchResult> {
    const availability = await this.isAvailable();
    if (!availability.available) {
      // Tentar recuperar do cache local se disponível
      const cached = this.getCachedList(page, search);
      if (cached) {
        return cached;
      }
      throw new Error(`Fonte Lycan Toons indisponível: ${availability.reason}`);
    }

    // Se estiver disponível (ex: acesso liberado ou proxy permitido), processa o catálogo
    const url = search 
      ? `${this.baseUrl}/series?search=${encodeURIComponent(search)}&page=${page}`
      : `${this.baseUrl}/series?page=${page}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Falha HTTP ${res.status} ao carregar catálogo do Lycan Toons.`);
    const html = await res.text();

    const mangas = this.parseSeriesHtml(html);
    this.saveCachedList(page, search, mangas);

    return {
      mangas,
      total: mangas.length * 10,
      hasMore: mangas.length >= 12,
      page,
    };
  }

  async getMangaDetails(sourceMangaId: string): Promise<SourceManga> {
    const cleanId = sourceMangaId.replace(/^lycantoons:/, '');
    const url = `${this.baseUrl}/series/${cleanId}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} ao obter detalhes de ${cleanId}`);
    const html = await res.text();

    return this.parseDetailsHtml(cleanId, html);
  }

  async getChapterList(sourceMangaId: string): Promise<SourceChapter[]> {
    const cleanId = sourceMangaId.replace(/^lycantoons:/, '');
    const url = `${this.baseUrl}/series/${cleanId}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} ao listar capítulos.`);
    const html = await res.text();

    return this.parseChaptersHtml(cleanId, html);
  }

  async getChapterPages(sourceMangaId: string, chapterId: string): Promise<SourcePage[]> {
    const cleanMangaId = sourceMangaId.replace(/^lycantoons:/, '');
    const cleanChapterId = chapterId.replace(/^lycantoons:/, '');
    const url = `${this.baseUrl}/series/${cleanMangaId}/${cleanChapterId}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} ao carregar páginas do capítulo.`);
    const html = await res.text();

    return this.parsePagesHtml(html);
  }

  // --- Parsers HTML auxiliares ---
  private parseSeriesHtml(html: string): SourceManga[] {
    const results: SourceManga[] = [];
    // Regex segura para links de séries
    const regex = /<a[^>]+href=["']\/series\/([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const slug = match[1];
      const content = match[2];
      const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
      const titleMatch = content.match(/<h[2-4][^>]*>([^<]+)<\/h[2-4]>/i) || content.match(/title=["']([^"']+)["']/i);

      if (slug && !slug.includes('/')) {
        results.push({
          id: `lycantoons:${slug}`,
          sourceId: this.id,
          title: titleMatch ? titleMatch[1].trim() : slug.replace(/-/g, ' '),
          coverUrl: imgMatch ? imgMatch[1] : undefined,
          thumbnailUrl: imgMatch ? imgMatch[1] : undefined,
          genres: ['Manhwa'],
          type: 'manhwa',
          status: 'ongoing',
        });
      }
    }
    return results;
  }

  private parseDetailsHtml(slug: string, html: string): SourceManga {
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const descMatch = html.match(/<div[^>]*class=["'][^"']*synopsis[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const coverMatch = html.match(/<img[^>]*class=["'][^"']*cover[^"']*["'][^>]*src=["']([^"']+)["']/i);

    return {
      id: `lycantoons:${slug}`,
      sourceId: this.id,
      title: titleMatch ? titleMatch[1].trim() : slug.replace(/-/g, ' '),
      synopsis: descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : undefined,
      coverUrl: coverMatch ? coverMatch[1] : undefined,
      genres: ['Manhwa', 'Ação'],
      type: 'manhwa',
      status: 'ongoing',
    };
  }

  private parseChaptersHtml(mangaSlug: string, html: string): SourceChapter[] {
    const chapters: SourceChapter[] = [];
    const chRegex = /<a[^>]+href=["']\/series\/[^/]+\/([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    let idx = 1;
    while ((match = chRegex.exec(html)) !== null) {
      const chSlug = match[1];
      const titleMatch = match[2].match(/(?:cap[ií]tulo|cap\.?|ch\.?)\s*(\d+(?:\.\d+)?)/i);
      const num = titleMatch ? parseFloat(titleMatch[1]) : idx++;

      chapters.push({
        id: `lycantoons:${mangaSlug}:${chSlug}`,
        sourceId: this.id,
        mangaId: `lycantoons:${mangaSlug}`,
        number: num,
        title: `Capítulo ${num}`,
      });
    }
    return chapters.sort((a, b) => a.number - b.number);
  }

  private parsePagesHtml(html: string): SourcePage[] {
    const pages: SourcePage[] = [];
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*class=["'][^"']*(?:page|reader-img)[^"']*["']/gi;
    let match;
    let pageNum = 1;
    while ((match = imgRegex.exec(html)) !== null) {
      pages.push({
        pageNumber: pageNum++,
        imageUrl: match[1],
      });
    }
    return pages;
  }

  private getCachedList(page: number, search?: string): SourceSearchResult | null {
    try {
      const raw = localStorage.getItem(`${this.cacheKeyPrefix}_${page}_${search || ''}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  private saveCachedList(page: number, search: string | undefined, mangas: SourceManga[]) {
    try {
      localStorage.setItem(
        `${this.cacheKeyPrefix}_${page}_${search || ''}`,
        JSON.stringify({
          mangas,
          total: mangas.length,
          hasMore: false,
          page,
        })
      );
    } catch {}
  }
}
