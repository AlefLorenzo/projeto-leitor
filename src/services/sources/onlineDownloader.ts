import {
  SourceManga,
  SourceChapter,
  ChapterDownloadState,
} from './types';
import { Manga, Chapter, Page } from '../../types';
import {
  getManga,
  saveManga,
  getChapter,
  saveChapter,
  savePages,
  deleteChapter,
  getDB,
} from '../database';
import { onlineSourceManager } from './OnlineSourceManager';
import { isCapacitorNative } from '../platform';

/**
 * Detecta se está rodando como APK nativo (Capacitor).
 * No APK o fetch() de imagens CDN falha por CORS — usamos CapacitorHttp.
 */
function isNativeApp(): boolean {
  return isCapacitorNative();
}

/**
 * Converte uma data URL base64 em Blob.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Faz download de uma imagem de forma segura independente do contexto:
 * - APK: usa CapacitorHttp (HTTP nativo Android, sem CORS)
 *        CapacitorHttp com responseType='blob' retorna base64 data URL
 * - Browser dev: usa fetch() (roteado pelo proxy Vite /api/mdimg)
 */
async function fetchImage(url: string, signal: AbortSignal): Promise<{ blob: Blob; size: number }> {
  if (isNativeApp()) {
    // CapacitorHttp faz a requisição via camada nativa — sem restrições CORS
    const { CapacitorHttp } = await import('@capacitor/core');
    const response = await CapacitorHttp.get({
      url,
      responseType: 'blob',
      headers: {
        'User-Agent': 'MangaOffline/1.0 (https://github.com/AlefLorenzo/projeto-leitor)',
        'Referer': 'https://mangadex.org/',
        'Accept': 'image/webp,image/avif,image/*,*/*',
      },
    });
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status} ao baixar imagem`);
    }
    // CapacitorHttp com responseType='blob' retorna base64 data URL em response.data
    const dataUrl = response.data as string;
    const blob = dataUrlToBlob(dataUrl);
    return { blob, size: blob.size };
  }

  // Browser (dev): fetch normal, URL já proxificada pelo Vite (/api/mdimg?url=...)
  if (signal.aborted) throw new Error('Download cancelado pelo usuário.');
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return { blob, size: blob.size };
}

export interface ChapterDownloadProgress {
  chapterId: string;
  mangaId: string;
  chapterNumber: number;
  stage: 'fetching_pages' | 'downloading_images' | 'validating' | 'saving' | 'completed' | 'failed' | 'cancelled';
  currentImage: number;
  totalImages: number;
  percent: number;
  bytesDownloaded: number;
  error?: string;
}

export interface BatchDownloadProgress {
  mangaId: string;
  completedChapters: number;
  totalChapters: number;
  overallPercent: number;
  activeChapterId?: string;
  activeChapterNumber?: number;
  totalBytesDownloaded: number;
  isCompleted: boolean;
  failedCount: number;
}

const activeDownloads = new Map<string, AbortController>();
let isBatchCancelled = false;

/**
 * Converte Blob para base64 dataUrl para máxima resiliência offline em WebViews e navegadores
 */
async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Consulta o estado de download de um capítulo na biblioteca local
 */
export async function getChapterDownloadState(chapterId: string): Promise<ChapterDownloadState> {
  if (activeDownloads.has(chapterId)) {
    return 'downloading';
  }

  const ch = await getChapter(chapterId);
  if (!ch) return 'online';

  if (ch.isDownloaded) {
    const db = await getDB();
    const count = await db.countFromIndex('pages', 'chapterId', chapterId);
    if (count > 0 && count >= (ch.pagesCount || 1)) {
      return 'downloaded';
    }
    return 'incomplete';
  }

  return 'online';
}

/**
 * Cancela um download ativo individual
 */
export function cancelOnlineDownload(chapterId: string): boolean {
  const controller = activeDownloads.get(chapterId);
  if (controller) {
    controller.abort();
    activeDownloads.delete(chapterId);
    return true;
  }
  return false;
}

/**
 * Cancela todos os downloads ativos e qualquer lote em andamento
 */
export function cancelAllOnlineDownloads(): void {
  isBatchCancelled = true;
  for (const [id, controller] of activeDownloads.entries()) {
    controller.abort();
    activeDownloads.delete(id);
  }
}

/**
 * Estima o tamanho de um lote de capítulos em bytes
 */
export function estimateBatchSize(chapters: SourceChapter[]): number {
  return chapters.reduce((sum, ch) => {
    const pages = ch.pageCountEstimate || 25;
    // Estimativa média de ~350KB por página WebP/JPEG
    return sum + pages * 350 * 1024;
  }, 0);
}

/**
 * Baixa um capítulo de fonte online, valida todas as páginas em área temporária,
 * e finaliza a gravação local de forma ATÔMICA sem deixar capítulos incompletos.
 */
export async function downloadOnlineChapter(
  manga: SourceManga,
  chapter: SourceChapter,
  onProgress?: (p: ChapterDownloadProgress) => void,
  preferDataSaver = false
): Promise<boolean> {
  const chapterId = chapter.id;
  const mangaId = manga.id;

  if (activeDownloads.has(chapterId)) {
    return false;
  }

  const abortController = new AbortController();
  activeDownloads.set(chapterId, abortController);

  const report = (
    stage: ChapterDownloadProgress['stage'],
    currentImage: number,
    totalImages: number,
    percent: number,
    bytesDownloaded: number,
    error?: string
  ) => {
    if (onProgress) {
      onProgress({
        chapterId,
        mangaId,
        chapterNumber: chapter.number,
        stage,
        currentImage,
        totalImages,
        percent,
        bytesDownloaded,
        error,
      });
    }
  };

  try {
    report('fetching_pages', 0, 0, 5, 0);

    // 1. Obter URLs de páginas através do adaptador da fonte
    const adapter = onlineSourceManager.getSource(chapter.sourceId) || onlineSourceManager.getActiveSource();
    const pages = await adapter.getChapterPages(mangaId, chapterId);

    if (!pages || pages.length === 0) {
      throw new Error('Nenhuma página retornada pela fonte para este capítulo.');
    }

    report('downloading_images', 0, pages.length, 10, 0);

    // 2. Área temporária de páginas em memória
    interface TempPage {
      pageNumber: number;
      blob: Blob;
      dataUrl: string;
      size: number;
    }

    const tempPages: TempPage[] = [];
    let totalBytes = 0;

    for (let i = 0; i < pages.length; i++) {
      if (abortController.signal.aborted) {
        throw new Error('Download cancelado pelo usuário.');
      }

      const page = pages[i];
      const targetUrl = preferDataSaver && page.dataSaverUrl ? page.dataSaverUrl : page.imageUrl;
      let blob: Blob | null = null;
      let size = 0;
      let attempts = 0;

      // Retry controlado em caso de instabilidade na CDN
      while (attempts < 3) {
        try {
          if (abortController.signal.aborted) throw new Error('Download cancelado pelo usuário.');
          const result = await fetchImage(targetUrl, abortController.signal);
          blob = result.blob;
          size = result.size;
          break;
        } catch (e: any) {
          if (abortController.signal.aborted) throw new Error('Download cancelado pelo usuário.');
          attempts++;
          if (attempts >= 3) throw new Error(`Falha ao baixar página ${page.pageNumber} após retentativas: ${e.message}`);
          await new Promise((r) => setTimeout(r, 800 * attempts));
        }
      }

      if (!blob || size === 0) {
        throw new Error(`Falha ao baixar página ${page.pageNumber} após retentativas.`);
      }

      // Validação estrita de integridade (< 1KB é inválido/corrompido)
      if (size < 1024) {
        throw new Error(`Página ${page.pageNumber} corrompida ou vazia (${size} bytes).`);
      }

      let dataUrl = '';
      try {
        dataUrl = await blobToDataUrl(blob);
      } catch {
        dataUrl = URL.createObjectURL(blob);
      }

      tempPages.push({
        pageNumber: page.pageNumber,
        blob,
        dataUrl,
        size,
      });

      totalBytes += size;
      const pct = Math.round(10 + ((i + 1) / pages.length) * 75);
      report('downloading_images', i + 1, pages.length, pct, totalBytes);
    }

    // 3. Validação estrita e ordenação das páginas
    report('validating', pages.length, pages.length, 88, totalBytes);
    tempPages.sort((a, b) => a.pageNumber - b.pageNumber);

    if (tempPages.length !== pages.length) {
      throw new Error(`Inconsistência de páginas: esperado ${pages.length}, obtido ${tempPages.length}.`);
    }

    // 4. Instalação Local Atômica no IndexedDB
    report('saving', pages.length, pages.length, 95, totalBytes);
    const now = Date.now();

    // A. Garantir registro da Obra na biblioteca local
    let localManga = await getManga(mangaId);
    if (!localManga) {
      localManga = {
        id: mangaId,
        title: manga.title,
        synopsis: manga.synopsis || `Obra do catálogo ${adapter.name}.`,
        coverUrl: manga.coverUrl || manga.thumbnailUrl,
        genres: manga.genres && manga.genres.length ? manga.genres : ['Ação'],
        type: manga.type || 'manga',
        readingDirection: manga.type === 'manhwa' ? 'vertical' : 'rtl',
        status: (manga.status as any) || 'reading',
        source: 'online',
        createdAt: now,
        updatedAt: now,
        isFavorite: false,
        totalChapters: manga.totalChapters || 1,
        totalPages: tempPages.length,
        storageSize: totalBytes,
        catalogId: manga.id,
        catalogProvider: adapter.id,
        externalUrl: adapter.baseUrl,
      };
      await saveManga(localManga);
    } else {
      localManga.storageSize = (localManga.storageSize || 0) + totalBytes;
      localManga.totalPages = (localManga.totalPages || 0) + tempPages.length;
      await saveManga(localManga);
    }

    // B. Preparar registros de Páginas
    const dbPages: Page[] = tempPages.map((tp) => ({
      id: `p-${chapterId}-${tp.pageNumber}`,
      chapterId: chapterId,
      mangaId: mangaId,
      pageNumber: tp.pageNumber,
      imageUrl: tp.dataUrl,
      createdAt: now,
    }));

    // C. Salvar páginas
    await savePages(dbPages);

    // D. Registrar capítulo como Baixado E Validado
    const chapterRecord: Chapter = {
      id: chapterId,
      mangaId: mangaId,
      number: chapter.number,
      title: chapter.title || `Capítulo ${chapter.number}`,
      pagesCount: dbPages.length,
      createdAt: now,
      storageSize: totalBytes,
      isDownloaded: true, // Marcado como baixado APENAS agora após validação total!
      scanlator: chapter.scanlator,
      readStatus: 'not_started',
    };

    await saveChapter(chapterRecord);

    report('completed', pages.length, pages.length, 100, totalBytes);
    activeDownloads.delete(chapterId);
    return true;
  } catch (err: any) {
    const isCancelled = abortController.signal.aborted;
    const errorMsg = isCancelled ? 'Download cancelado.' : err?.message || 'Falha no download.';
    report(isCancelled ? 'cancelled' : 'failed', 0, 0, 0, 0, errorMsg);
    activeDownloads.delete(chapterId);

    // Limpeza de capítulo corrompido ou incompleto para manter atomicidade estrita
    try {
      await deleteChapter(chapterId);
    } catch {}

    return false;
  }
}

/**
 * Baixa múltiplos capítulos em sequência ordenada com relatório de progresso do lote
 */
export async function downloadOnlineBatch(
  manga: SourceManga,
  chapters: SourceChapter[],
  onBatchProgress?: (p: BatchDownloadProgress) => void,
  onChapterProgress?: (p: ChapterDownloadProgress) => void
): Promise<{ completed: number; failed: number }> {
  isBatchCancelled = false;
  let completed = 0;
  let failed = 0;
  let totalBytes = 0;

  const total = chapters.length;

  for (let i = 0; i < chapters.length; i++) {
    if (isBatchCancelled) break;

    const chapter = chapters[i];

    if (onBatchProgress) {
      onBatchProgress({
        mangaId: manga.id,
        completedChapters: completed,
        totalChapters: total,
        overallPercent: Math.round((i / total) * 100),
        activeChapterId: chapter.id,
        activeChapterNumber: chapter.number,
        totalBytesDownloaded: totalBytes,
        isCompleted: false,
        failedCount: failed,
      });
    }

    const success = await downloadOnlineChapter(
      manga,
      chapter,
      (prog) => {
        if (onChapterProgress) onChapterProgress(prog);
      }
    );

    if (success) {
      completed++;
    } else {
      failed++;
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  if (onBatchProgress) {
    onBatchProgress({
      mangaId: manga.id,
      completedChapters: completed,
      totalChapters: total,
      overallPercent: 100,
      totalBytesDownloaded: totalBytes,
      isCompleted: true,
      failedCount: failed,
    });
  }

  return { completed, failed };
}

/**
 * Exclui o download local de um capítulo, liberando espaço físico no IndexedDB
 * PRESERVANDO rigorosamente o histórico, favoritos e progresso de leitura!
 */
export async function deleteChapterDownloadOnly(chapterId: string): Promise<boolean> {
  try {
    const ch = await getChapter(chapterId);
    if (!ch) return false;

    const db = await getDB();
    const pages = await db.getAllFromIndex('pages', 'chapterId', chapterId);

    // Libera Blob URLs e apaga páginas
    for (const page of pages) {
      if (page.imageUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(page.imageUrl);
      }
      await db.delete('pages', page.id);
    }

    // Atualiza capítulo para isDownloaded = false mantendo o progresso e o registro intactos
    ch.isDownloaded = false;
    ch.storageSize = 0;
    await saveChapter(ch);

    // Atualiza tamanho do manga
    const manga = await getManga(ch.mangaId);
    if (manga && manga.storageSize) {
      manga.storageSize = Math.max(0, manga.storageSize - (ch.storageSize || 0));
      await saveManga(manga);
    }

    return true;
  } catch (err) {
    console.error('Erro ao excluir download do capítulo:', err);
    return false;
  }
}
