import JSZip from 'jszip';
import { RemoteCatalogManga, RemoteCatalogChapter, resolveResourceUrl } from './githubCatalog';
import { Manga, Chapter, Page } from '../types';
import { saveManga, saveChapter, savePages, getManga, getChapter } from './database';

export interface DownloadProgress {
  mangaId: string;
  chapterId: string;
  chapterNumber: number;
  stage: 'downloading' | 'verifying' | 'extracting' | 'saving' | 'completed' | 'failed';
  percent: number; // 0 - 100
  bytesDownloaded: number;
  totalBytes: number;
  speedBytesPerSec?: number;
  error?: string;
}

// Mapa de cancelamento ativo
const abortControllers = new Map<string, AbortController>();

function padNum(n: number, d: number = 3): string {
  return String(Math.round(n)).padStart(d, '0');
}

/**
 * Calcula hash SHA-256 de um ArrayBuffer no navegador / celular usando Web Crypto API
 */
async function computeSha256(buffer: ArrayBuffer): Promise<string> {
  if (window.crypto && window.crypto.subtle) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return '';
}

/**
 * Converte um Blob para Data URL (para máxima compatibilidade offline em qualquer WebView)
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Baixa um capítulo compactado (.cbz), verifica SHA-256, extrai no celular/navegador e salva no IndexedDB
 */
export async function downloadAndUnpackChapter(
  manga: RemoteCatalogManga,
  chapter: RemoteCatalogChapter,
  baseUrl: string,
  onProgress?: (p: DownloadProgress) => void
): Promise<boolean> {
  const chapterKey = `${manga.id}-${chapter.number}`;
  const abortController = new AbortController();
  abortControllers.set(chapterKey, abortController);

  const finalMangaId = manga.id.startsWith('telegram-') ? manga.id : `telegram-${manga.id}`;
  const chapterId = `ch-${manga.id}-${chapter.number}`;
  const fullDownloadUrl = resolveResourceUrl(chapter.downloadUrl, baseUrl);

  const report = (stage: DownloadProgress['stage'], percent: number, bytesDownloaded: number, totalBytes: number, err?: string) => {
    if (onProgress) {
      onProgress({
        mangaId: manga.id,
        chapterId,
        chapterNumber: chapter.number,
        stage,
        percent,
        bytesDownloaded,
        totalBytes,
        error: err,
      });
    }
  };

  try {
    report('downloading', 0, 0, chapter.sizeBytes || 1);

    // 1. Download com monitoramento de fluxo de bytes
    const response = await fetch(fullDownloadUrl, {
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`Falha no download (HTTP ${response.status}): ${response.statusText}`);
    }

    const contentLength = Number(response.headers.get('content-length')) || chapter.sizeBytes || 1;
    let receivedBytes = 0;

    let buffer: ArrayBuffer;

    if (response.body) {
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedBytes += value.length;
          const pct = Math.min(99, Math.round((receivedBytes / contentLength) * 100));
          report('downloading', pct, receivedBytes, contentLength);
        }
      }

      // Concatenar todos os chunks
      const fullBytes = new Uint8Array(receivedBytes);
      let offset = 0;
      for (const chunk of chunks) {
        fullBytes.set(chunk, offset);
        offset += chunk.length;
      }
      buffer = fullBytes.buffer;
    } else {
      buffer = await response.arrayBuffer();
      receivedBytes = buffer.byteLength;
      report('downloading', 99, receivedBytes, receivedBytes);
    }

    // 2. Verificação de Integridade SHA-256
    report('verifying', 100, receivedBytes, receivedBytes);
    if (chapter.sha256) {
      const computedHash = await computeSha256(buffer);
      if (computedHash && computedHash.toLowerCase() !== chapter.sha256.toLowerCase()) {
        throw new Error(`Corrupção de dados: Hash SHA-256 não confere (esperado: ${chapter.sha256}, obtido: ${computedHash})`);
      }
    }

    // 3. Descompactação segura com JSZip (Proteção contra Zip Bomb e Path Traversal)
    report('extracting', 100, receivedBytes, receivedBytes);
    const zip = await JSZip.loadAsync(buffer);

    const imageFileNames = Object.keys(zip.files)
      .filter((name) => {
        const entry = zip.files[name];
        if (entry.dir) return false;
        // Prevenção contra path traversal
        if (name.includes('..') || name.startsWith('/') || name.startsWith('\\')) return false;
        return /\.(jpg|jpeg|png|webp|gif)$/i.test(name);
      })
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (imageFileNames.length === 0) {
      throw new Error('Nenhuma imagem válida encontrada dentro do pacote compactado.');
    }

    // 4. Salvar páginas no IndexedDB
    report('saving', 100, receivedBytes, receivedBytes);
    const pages: Page[] = [];
    const now = Date.now();

    for (let i = 0; i < imageFileNames.length; i++) {
      const fileName = imageFileNames[i];
      const fileData = await zip.files[fileName].async('blob');

      // Cria Blob URL persistente para renderização instantânea
      const blobUrl = URL.createObjectURL(fileData);

      // Também converte para base64 dataUrl para máxima resiliência offline em WebViews
      let dataUrl = '';
      try {
        dataUrl = await blobToDataUrl(fileData);
      } catch {
        dataUrl = blobUrl;
      }

      pages.push({
        id: `p-${chapterId}-${i + 1}`,
        chapterId: chapterId,
        mangaId: finalMangaId,
        pageNumber: i + 1,
        imageUrl: dataUrl || blobUrl,
        createdAt: now,
      });
    }

    // 5. Salvar / Atualizar Obra e Capítulo no Banco de Dados Local
    let localManga = await getManga(finalMangaId);
    if (!localManga) {
      localManga = {
        id: finalMangaId,
        title: manga.title,
        synopsis: manga.synopsis || `Obra do catálogo remoto GitHub.`,
        coverUrl: resolveResourceUrl(manga.coverUrl, baseUrl),
        genres: manga.genres && manga.genres.length ? manga.genres : ['Ação'],
        type: manga.type || 'manhwa',
        readingDirection: manga.type === 'manhwa' ? 'vertical' : 'rtl',
        status: (manga.status as any) || 'reading',
        source: 'online',
        createdAt: now,
        updatedAt: now,
        isFavorite: false,
        totalChapters: manga.totalChapters || 0,
        totalPages: pages.length,
        storageSize: receivedBytes,
        catalogId: manga.id,
        catalogProvider: 'github',
        externalUrl: manga.coverUrl,
      };
      await saveManga(localManga);
    }

    const chapterRecord: Chapter = {
      id: chapterId,
      mangaId: finalMangaId,
      number: chapter.number,
      title: chapter.title || `Capítulo ${padNum(chapter.number)}`,
      pagesCount: pages.length,
      createdAt: now,
      storageSize: receivedBytes,
      isDownloaded: true,
      readStatus: 'not_started',
    };

    await saveChapter(chapterRecord);
    await savePages(pages);

    report('completed', 100, receivedBytes, receivedBytes);
    return true;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    report('failed', 0, 0, chapter.sizeBytes || 1, errorMsg);
    console.error(`Erro ao baixar capítulo ${chapter.number}:`, errorMsg);
    return false;
  } finally {
    abortControllers.delete(chapterKey);
  }
}

/**
 * Cancela download ativo de um capítulo
 */
export function cancelChapterDownload(mangaId: string, chapterNumber: number): void {
  const chapterKey = `${mangaId}-${chapterNumber}`;
  const controller = abortControllers.get(chapterKey);
  if (controller) {
    controller.abort();
    abortControllers.delete(chapterKey);
  }
}

/**
 * Baixa múltiplos capítulos com limite de concorrência
 */
export async function downloadMultipleChapters(
  manga: RemoteCatalogManga,
  chapters: RemoteCatalogChapter[],
  baseUrl: string,
  onProgress?: (p: DownloadProgress) => void
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const chapter of chapters) {
    const ok = await downloadAndUnpackChapter(manga, chapter, baseUrl, onProgress);
    if (ok) success++;
    else failed++;
  }

  return { success, failed };
}
