import {
  SourceManga,
  SourceChapter,
  SourcePage,
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

export interface ChapterDownloadProgress {
  chapterId: string;
  mangaId: string;
  chapterNumber: number;
  stage: 'fetching_pages' | 'downloading_images' | 'validating' | 'saving' | 'completed' | 'failed';
  currentImage: number;
  totalImages: number;
  percent: number;
  bytesDownloaded: number;
  error?: string;
}

const activeDownloads = new Map<string, AbortController>();

/**
 * Converte Blob para base64 dataUrl para máxima resiliência offline em WebViews
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
 * Cancela um download ativo
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
 * Baixa um capítulo de fonte online, valida todas as páginas em área temporária,
 * e finaliza a gravação local de forma ATÔMICA sem deixar capítulos incompletos.
 */
export async function downloadOnlineChapter(
  manga: SourceManga,
  chapter: SourceChapter,
  onProgress?: (p: ChapterDownloadProgress) => void
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
      let res: Response | null = null;
      let attempts = 0;

      // Retry controlado em caso de instabilidade na CDN
      while (attempts < 3) {
        try {
          res = await fetch(page.imageUrl, { signal: abortController.signal });
          if (res.ok) break;
        } catch (e: any) {
          if (abortController.signal.aborted) throw new Error('Download cancelado pelo usuário.');
        }
        attempts++;
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (!res || !res.ok) {
        throw new Error(`Falha ao baixar página ${page.pageNumber} após 3 tentativas.`);
      }

      const blob = await res.blob();
      const size = blob.size;

      // Validação de arquivo corrompido / vazio (< 1KB)
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
        synopsis: manga.synopsis || `Obra importada da fonte ${adapter.name}.`,
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
    const errorMsg = err?.message || 'Falha desconhecida no download.';
    report('failed', 0, 0, 0, 0, errorMsg);
    activeDownloads.delete(chapterId);

    // Limpeza de capítulo corrompido ou incompleto para manter atomicidade
    try {
      await deleteChapter(chapterId);
    } catch {}

    return false;
  }
}

/**
 * Exclui o download local de um capítulo, liberando espaço físico no IndexedDB
 * PRESERVANDO o histórico, favoritos e progresso de leitura!
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
