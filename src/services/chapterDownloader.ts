import JSZip from 'jszip';
import { RemoteCatalogManga, RemoteCatalogChapter, resolveResourceUrl, DEFAULT_GITHUB_CONFIG } from './githubCatalog';
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
 * Faz HEAD request para verificar se uma URL existe (status 200)
 */
async function urlExists(url: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD', signal });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Converte ArrayBuffer para dataUrl via Blob
 */
async function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType: string = 'image/jpeg'): Promise<string> {
  const blob = new Blob([buffer], { type: mimeType });
  return blobToDataUrl(blob);
}

/**
 * Download de uma imagem individual retornando ArrayBuffer
 */
async function fetchPageBuffer(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao baixar página: ${url}`);
  }
  return response.arrayBuffer();
}

/**
 * Detecta o mime-type correto a partir do nome do arquivo de imagem
 */
function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    default: return 'image/jpeg';
  }
}

/**
 * Download página por página de um capítulo do catálogo Telegram
 * As imagens estão em: obras/{mangaShortId}/capitulos/{folderName}/{pageFileName}
 * ou em: catalog/{mangaId}/{folderName}/{pageFileName}
 */
async function downloadChapterByPages(
  manga: RemoteCatalogManga,
  chapter: RemoteCatalogChapter,
  finalMangaId: string,
  chapterId: string,
  baseUrl: string,
  signal: AbortSignal,
  report: (stage: DownloadProgress['stage'], percent: number, bytesDownloaded: number, totalBytes: number, err?: string) => void
): Promise<{ pages: Page[]; totalBytes: number }> {
  const rawBase = DEFAULT_GITHUB_CONFIG.rawBaseUrl;

  if (!chapter.folderName || !chapter.pages || chapter.pages.length === 0) {
    throw new Error('Capítulo não possui lista de páginas (folderName/pages ausentes).');
  }

  const totalPages = chapter.pages.length;
  const pages: Page[] = [];
  let totalBytes = 0;
  const now = Date.now();

  // Tenta construir URL base das páginas — testa catalog/ e obras/ automaticamente
  // Padrão 1: obras/{mangaSlug}/capitulos/{folderName}/{page}
  // Padrão 2: catalog/{mangaId}/{folderName}/{page}
  const folderEncoded = encodeURIComponent(chapter.folderName);

  // Detecta qual padrão de URL é válido para o primeiro arquivo
  const firstPage = chapter.pages[0];
  const candidateUrls = [
    `${rawBase}/catalog/${manga.id}/${folderEncoded}/${encodeURIComponent(firstPage)}`,
    `${rawBase}/catalog/${manga.id}/${chapter.folderName}/${firstPage}`,
    `${rawBase}/obras/${manga.id}/${folderEncoded}/${encodeURIComponent(firstPage)}`,
    `${rawBase}/obras/${manga.id}/${chapter.folderName}/${firstPage}`,
  ];

  let detectedBasePattern = '';
  for (const candidateUrl of candidateUrls) {
    if (signal.aborted) throw new DOMException('Download cancelado', 'AbortError');
    const exists = await urlExists(candidateUrl, signal);
    if (exists) {
      // Extract the base pattern before the page filename
      detectedBasePattern = candidateUrl.substring(0, candidateUrl.lastIndexOf('/') + 1);
      break;
    }
  }

  if (!detectedBasePattern) {
    throw new Error(
      `Páginas não encontradas no GitHub. Capítulo ${chapter.number} de "${manga.title}" ` +
      `(folderName: ${chapter.folderName}) não está disponível para download página por página.`
    );
  }

  report('downloading', 0, 0, totalPages * 200000); // estimativa

  for (let i = 0; i < totalPages; i++) {
    if (signal.aborted) throw new DOMException('Download cancelado', 'AbortError');

    const pageFile = chapter.pages[i];
    const pageUrl = detectedBasePattern + encodeURIComponent(pageFile);

    const buffer = await fetchPageBuffer(pageUrl, signal);
    const mimeType = getMimeType(pageFile);
    const dataUrl = await arrayBufferToDataUrl(buffer, mimeType);

    totalBytes += buffer.byteLength;

    pages.push({
      id: `p-${chapterId}-${i + 1}`,
      chapterId,
      mangaId: finalMangaId,
      pageNumber: i + 1,
      imageUrl: dataUrl,
      createdAt: now,
    });

    const pct = Math.round(((i + 1) / totalPages) * 100);
    report('downloading', pct, totalBytes, totalPages * 200000);
  }

  return { pages, totalBytes };
}

/**
 * Baixa um capítulo compactado (.cbz), verifica SHA-256, extrai no celular/navegador e salva no IndexedDB
 * Com fallback automático para download página por página quando o CBZ não está disponível (HTTP 404).
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
  const { signal } = abortController;

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

    // ─── MODO 1: Download CBZ ──────────────────────────────────────────────────
    // Verifica primeiro se o CBZ existe antes de tentar baixar
    let useCbz = false;
    if (chapter.downloadUrl && chapter.format !== 'pages') {
      const headCheck = await fetch(fullDownloadUrl, { method: 'HEAD', signal });
      useCbz = headCheck.ok;
      if (!headCheck.ok) {
        console.warn(
          `[chapterDownloader] CBZ não encontrado (HTTP ${headCheck.status}) para ${chapter.downloadUrl}. ` +
          `Usando fallback página por página.`
        );
      }
    }

    let pages: Page[];
    let receivedBytes = 0;
    const now = Date.now();

    if (useCbz) {
      // ─── Download e extração do CBZ ─────────────────────────────────────────
      const response = await fetch(fullDownloadUrl, { signal });

      if (!response.ok) {
        throw new Error(`Falha no download (HTTP ${response.status}): ${response.statusText}`);
      }

      const contentLength = Number(response.headers.get('content-length')) || chapter.sizeBytes || 1;

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

      // Verificação de Integridade SHA-256
      report('verifying', 100, receivedBytes, receivedBytes);
      if (chapter.sha256) {
        const computedHash = await computeSha256(buffer);
        if (computedHash && computedHash.toLowerCase() !== chapter.sha256.toLowerCase()) {
          throw new Error(
            `Corrupção de dados: Hash SHA-256 não confere (esperado: ${chapter.sha256}, obtido: ${computedHash})`
          );
        }
      }

      // Descompactação com JSZip
      report('extracting', 100, receivedBytes, receivedBytes);
      const zip = await JSZip.loadAsync(buffer);

      const imageFileNames = Object.keys(zip.files)
        .filter((name) => {
          const entry = zip.files[name];
          if (entry.dir) return false;
          if (name.includes('..') || name.startsWith('/') || name.startsWith('\\')) return false;
          return /\.(jpg|jpeg|png|webp|gif)$/i.test(name);
        })
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      if (imageFileNames.length === 0) {
        throw new Error('Nenhuma imagem válida encontrada dentro do pacote compactado.');
      }

      report('saving', 100, receivedBytes, receivedBytes);
      pages = [];

      for (let i = 0; i < imageFileNames.length; i++) {
        const fileName = imageFileNames[i];
        const fileData = await zip.files[fileName].async('blob');
        const blobUrl = URL.createObjectURL(fileData);
        let dataUrl = '';
        try {
          dataUrl = await blobToDataUrl(fileData);
        } catch {
          dataUrl = blobUrl;
        }

        pages.push({
          id: `p-${chapterId}-${i + 1}`,
          chapterId,
          mangaId: finalMangaId,
          pageNumber: i + 1,
          imageUrl: dataUrl || blobUrl,
          createdAt: now,
        });
      }
    } else {
      // ─── MODO 2: Download página por página (fallback para catálogo Telegram) ─
      report('downloading', 0, 0, (chapter.pageCount || 20) * 200000);
      const result = await downloadChapterByPages(
        manga, chapter, finalMangaId, chapterId, baseUrl, signal, report
      );
      pages = result.pages;
      receivedBytes = result.totalBytes;
    }

    // ─── Salvar Obra e Capítulo no IndexedDB ──────────────────────────────────
    report('saving', 100, receivedBytes, receivedBytes);

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
