import { Page } from '../../types';
import { onlineSourceManager } from './OnlineSourceManager';
import { SourcePage } from './types';
import { canProceedWithOnlineReading } from '../networkDetection';
import { getSettings } from '../settings';

export interface OnlinePageStatus {
  pageNumber: number;
  url: string;
  blobUrl?: string;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error?: string;
}

export interface OnlineChapterPagesResult {
  pages: Page[];
  sourcePages: SourcePage[];
  total: number;
}

/**
 * Gerenciador da sessão de Leitura Online em Memória.
 *
 * Características essenciais:
 * 1. NUNCA grava registros de páginas no IndexedDB (isolamento total dos downloads).
 * 2. Carregamento progressivo (sob demanda + 2 páginas de prefetch).
 * 3. Janela deslizante LRU (descarta e revoga Blob URLs de páginas com distância > 5).
 * 4. Cancelamento imediato de downloads via AbortController.
 * 5. Verificação estrita de rede (Wi-Fi / autorização celular) antes de cada download de imagem.
 */
class OnlineReaderService {
  private currentChapterId: string | null = null;
  private currentMangaId: string | null = null;
  private pagesStatus = new Map<number, OnlinePageStatus>();
  private activeControllers = new Map<number, AbortController>();
  private sourcePages: SourcePage[] = [];
  private hasCellularAuth: boolean = false;
  private onStatusChangeListeners = new Set<(pageNumber: number, status: OnlinePageStatus) => void>();

  /**
   * Concede autorização temporária por sessão/capítulo para uso de dados móveis
   */
  public authorizeCellularForSession(): void {
    this.hasCellularAuth = true;
  }

  /**
   * Reseta autorização de dados móveis
   */
  public resetCellularAuth(): void {
    this.hasCellularAuth = false;
  }

  /**
   * Carrega metadados e lista de páginas do capítulo a partir da fonte online
   */
  public async loadChapterPages(
    mangaId: string,
    chapterId: string,
    sourceId: string = 'mangadex'
  ): Promise<OnlineChapterPagesResult> {
    // Se mudou de capítulo, libera todos os recursos do capítulo anterior
    if (this.currentChapterId !== chapterId) {
      this.cleanup();
    }

    this.currentMangaId = mangaId;
    this.currentChapterId = chapterId;

    const adapter = onlineSourceManager.getSource(sourceId) || onlineSourceManager.getActiveSource();
    const sourcePages = await adapter.getChapterPages(mangaId, chapterId);

    if (!sourcePages || sourcePages.length === 0) {
      throw new Error('Nenhuma página retornada pela fonte para este capítulo.');
    }

    this.sourcePages = sourcePages;
    this.pagesStatus.clear();

    const dbCompatiblePages: Page[] = [];

    for (const sp of sourcePages) {
      this.pagesStatus.set(sp.pageNumber, {
        pageNumber: sp.pageNumber,
        url: sp.imageUrl,
        status: 'idle',
      });

      // Gera estrutura Page compatível com o ReaderPage sem persistir no IndexedDB
      dbCompatiblePages.push({
        id: `online-p-${chapterId}-${sp.pageNumber}`,
        chapterId: chapterId,
        mangaId: mangaId,
        pageNumber: sp.pageNumber,
        imageUrl: sp.imageUrl,
        createdAt: Date.now(),
      });
    }

    return {
      pages: dbCompatiblePages,
      sourcePages,
      total: dbCompatiblePages.length,
    };
  }

  /**
   * Solicita o carregamento da página atual e dispara pré-carregamento das 2 páginas seguintes
   */
  public async requestPage(
    pageNumber: number,
    preferDataSaver: boolean = false
  ): Promise<string> {
    // 1. Descartar páginas distantes (janela LRU: manter páginas entre pageNumber - 4 e pageNumber + 4)
    this.pruneDistantPages(pageNumber);

    // 2. Carregar página atual em alta prioridade
    const currentUrl = await this.fetchPageImage(pageNumber, preferDataSaver);

    // 3. Pré-carregar páginas seguintes progressivamente em segundo plano
    this.preloadUpcomingPages(pageNumber, preferDataSaver);

    return currentUrl;
  }

  /**
   * Pré-carrega até 2 páginas à frente da posição de leitura atual
   */
  private preloadUpcomingPages(currentPage: number, preferDataSaver: boolean): void {
    const next1 = currentPage + 1;
    const next2 = currentPage + 2;

    if (next1 <= this.sourcePages.length) {
      this.fetchPageImage(next1, preferDataSaver).catch(() => {});
    }
    if (next2 <= this.sourcePages.length) {
      this.fetchPageImage(next2, preferDataSaver).catch(() => {});
    }
  }

  /**
   * Baixa a imagem de uma página com validação de rede, timeout e conversão em Blob URL local
   */
  private async fetchPageImage(
    pageNumber: number,
    preferDataSaver: boolean = false
  ): Promise<string> {
    const pageStatus = this.pagesStatus.get(pageNumber);
    if (!pageStatus) {
      throw new Error(`Página ${pageNumber} inexistente no capítulo.`);
    }

    // Se já estiver carregada com Blob URL válida, retorna imediatamente
    if (pageStatus.status === 'loaded' && pageStatus.blobUrl) {
      return pageStatus.blobUrl;
    }

    // Se já estiver baixando, aguarda ou deixa fluir
    if (pageStatus.status === 'loading' && this.activeControllers.has(pageNumber)) {
      return pageStatus.url;
    }

    // Validação estrita de política de rede
    const settings = await getSettings();
    const networkCheck = await canProceedWithOnlineReading(
      settings.onlineReadingNetwork || 'wifi_only',
      this.hasCellularAuth
    );

    if (!networkCheck.allowed) {
      pageStatus.status = 'error';
      pageStatus.error = networkCheck.reason || 'Conexão bloqueada pela política de rede.';
      this.notifyStatus(pageNumber);
      throw new Error(pageStatus.error);
    }

    const controller = new AbortController();
    this.activeControllers.set(pageNumber, controller);

    pageStatus.status = 'loading';
    pageStatus.error = undefined;
    this.notifyStatus(pageNumber);

    const sourcePage = this.sourcePages.find((p) => p.pageNumber === pageNumber);
    const targetUrl = preferDataSaver && sourcePage?.dataSaverUrl ? sourcePage.dataSaverUrl : pageStatus.url;

    try {
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout por página

      const response = await fetch(targetUrl, {
        signal: controller.signal,
        cache: 'force-cache',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Servidor MangaDex retornou HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      pageStatus.blobUrl = blobUrl;
      pageStatus.status = 'loaded';
      pageStatus.error = undefined;
      this.notifyStatus(pageNumber);

      return blobUrl;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        pageStatus.status = 'idle';
      } else {
        pageStatus.status = 'error';
        pageStatus.error = err.message || 'Falha ao carregar imagem da página.';
        this.notifyStatus(pageNumber);
      }
      // Retorna a URL original de fallback se o blob falhar
      return targetUrl;
    } finally {
      this.activeControllers.delete(pageNumber);
    }
  }

  /**
   * Força uma nova tentativa de carregamento para uma página com falha
   */
  public async retryPage(pageNumber: number, preferDataSaver: boolean = false): Promise<string> {
    const pageStatus = this.pagesStatus.get(pageNumber);
    if (pageStatus) {
      if (pageStatus.blobUrl) {
        URL.revokeObjectURL(pageStatus.blobUrl);
        pageStatus.blobUrl = undefined;
      }
      pageStatus.status = 'idle';
      pageStatus.error = undefined;
    }
    return this.fetchPageImage(pageNumber, preferDataSaver);
  }

  /**
   * Descarta da memória e revoga Blob URLs de páginas distantes mais de 5 posições da atual
   */
  private pruneDistantPages(currentPage: number): void {
    const minPage = currentPage - 4;
    const maxPage = currentPage + 4;

    for (const [pageNum, status] of this.pagesStatus.entries()) {
      if (pageNum < minPage || pageNum > maxPage) {
        // Cancelar requisição se estiver baixando
        if (this.activeControllers.has(pageNum)) {
          this.activeControllers.get(pageNum)?.abort();
          this.activeControllers.delete(pageNum);
        }

        // Revogar Blob URL da memória gráfica
        if (status.blobUrl) {
          try {
            URL.revokeObjectURL(status.blobUrl);
          } catch {}
          status.blobUrl = undefined;
          status.status = 'idle';
        }
      }
    }
  }

  /**
   * Limpa integralmente toda a memória alocada, cancela conexões e revoga todas as URLs
   */
  public cleanup(): void {
    // 1. Cancela todas as requisições em trânsito
    for (const controller of this.activeControllers.values()) {
      try {
        controller.abort();
      } catch {}
    }
    this.activeControllers.clear();

    // 2. Revoga todas as Blob URLs alocadas
    for (const status of this.pagesStatus.values()) {
      if (status.blobUrl) {
        try {
          URL.revokeObjectURL(status.blobUrl);
        } catch {}
      }
    }
    this.pagesStatus.clear();
    this.sourcePages = [];
    this.currentChapterId = null;
    this.currentMangaId = null;
    this.hasCellularAuth = false;
  }

  /**
   * Adiciona ouvinte para alterações de status de carregamento das páginas
   */
  public onStatusChange(listener: (pageNumber: number, status: OnlinePageStatus) => void): () => void {
    this.onStatusChangeListeners.add(listener);
    return () => {
      this.onStatusChangeListeners.delete(listener);
    };
  }

  private notifyStatus(pageNumber: number): void {
    const status = this.pagesStatus.get(pageNumber);
    if (status) {
      for (const listener of this.onStatusChangeListeners) {
        try {
          listener(pageNumber, status);
        } catch {}
      }
    }
  }
}

export const onlineReaderService = new OnlineReaderService();
