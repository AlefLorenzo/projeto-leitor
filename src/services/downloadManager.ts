import { DownloadTask, DownloadStatus, DownloadHistoryEntry, DownloadStats } from '../types';
import {
  saveDownloadTask,
  getAllDownloadTasks,
  deleteDownloadTask,
  clearCompletedDownloadTasks,
  addDownloadHistory,
  getAllDownloadHistory,
  clearDownloadHistory,
  getRealDownloadStats,
  generateId,
  getChapter,
  saveChapter,
  getManga,
  saveManga,
} from './database';
import { downloadOnlineChapter, cancelOnlineDownload } from './sources/onlineDownloader';
import { downloadAndUnpackChapter, cancelChapterDownload } from './chapterDownloader';
import { SourceManga, SourceChapter } from './sources/types';
import { RemoteCatalogManga, RemoteCatalogChapter } from './githubCatalog';

type Listener = () => void;

export interface EnqueueOnlineOptions {
  manga: SourceManga;
  chapter: SourceChapter;
  preferDataSaver?: boolean;
}

export interface EnqueueBunkerOptions {
  manga: RemoteCatalogManga;
  chapter: RemoteCatalogChapter;
  baseUrl: string;
}

class DownloadManagerService {
  private queue: DownloadTask[] = [];
  private activeControllers: Map<string, AbortController> = new Map();
  private listeners: Set<Listener> = new Set();
  private isProcessing = false;
  private maxConcurrent = 2;
  private isInitialized = false;

  constructor() {
    this.init();
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      const storedTasks = await getAllDownloadTasks();
      
      // Se o app foi fechado durante um download, recupera tarefas interrompidas
      // marcando de 'downloading' para 'waiting' para retomar de forma íntegra
      for (const task of storedTasks) {
        if (task.status === 'downloading') {
          task.status = 'waiting';
          task.error = 'Retomado após reinicialização';
          await saveDownloadTask(task);
        }
      }

      this.queue = storedTasks;
      this.isInitialized = true;
      this.notify();
      this.processQueue();
    } catch (err) {
      console.error('[DownloadManager] Erro ao carregar fila do IndexedDB:', err);
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('[DownloadManager] Erro no listener:', e);
      }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('download-queue-changed', {
        detail: { count: this.queue.length }
      }));
    }
  }

  public getQueue(): DownloadTask[] {
    return [...this.queue];
  }

  public async getStats(): Promise<DownloadStats> {
    return getRealDownloadStats();
  }

  public async getHistory(limit: number = 100): Promise<DownloadHistoryEntry[]> {
    return getAllDownloadHistory(limit);
  }

  public async clearHistory(): Promise<void> {
    await clearDownloadHistory();
    this.notify();
  }

  public setMaxConcurrent(limit: number): void {
    if (limit > 0 && limit <= 5) {
      this.maxConcurrent = limit;
      this.processQueue();
    }
  }

  /**
   * Enfileira um capítulo do MangaDex / catálogo online
   */
  public async enqueueOnlineChapter(options: EnqueueOnlineOptions): Promise<DownloadTask> {
    await this.init();
    const { manga, chapter, preferDataSaver = true } = options;
    const finalMangaId = manga.id.startsWith('online-') ? manga.id : `online-${manga.id}`;
    const chapterId = `ch-${manga.id}-${chapter.id}`;

    // Evita duplicar se já estiver na fila ativa ou baixando
    const existing = this.queue.find(
      (t) => t.mangaId === finalMangaId && t.chapterId === chapterId && (t.status === 'waiting' || t.status === 'downloading')
    );
    if (existing) {
      return existing;
    }

    const task: DownloadTask = {
      id: generateId(),
      mangaId: finalMangaId,
      chapterId: chapterId,
      mangaTitle: manga.title,
      chapterTitle: chapter.title || `Capítulo ${chapter.number}`,
      chapterNumber: chapter.number,
      source: 'mangadex',
      sourceData: { manga, chapter, preferDataSaver },
      status: 'waiting',
      progress: 0,
      totalFiles: chapter.pageCountEstimate || 20,
      downloadedFiles: 0,
      totalSize: (chapter.pageCountEstimate || 20) * 350 * 1024,
      downloadedSize: 0,
      createdAt: Date.now(),
      retries: 0,
      maxRetries: 3,
    };

    await saveDownloadTask(task);
    this.queue.push(task);
    this.notify();
    this.processQueue();
    return task;
  }

  /**
   * Enfileira lote de capítulos online
   */
  public async enqueueOnlineBatch(manga: SourceManga, chapters: SourceChapter[], preferDataSaver = true): Promise<DownloadTask[]> {
    const created: DownloadTask[] = [];
    for (const chapter of chapters) {
      const task = await this.enqueueOnlineChapter({ manga, chapter, preferDataSaver });
      created.push(task);
    }
    return created;
  }

  /**
   * Enfileira capítulo do Bunker Telegram / GitHub
   */
  public async enqueueBunkerChapter(options: EnqueueBunkerOptions): Promise<DownloadTask> {
    await this.init();
    const { manga, chapter, baseUrl } = options;
    const finalMangaId = manga.id.startsWith('telegram-') ? manga.id : `telegram-${manga.id}`;
    const chapterId = `ch-${manga.id}-${chapter.number}`;

    const existing = this.queue.find(
      (t) => t.mangaId === finalMangaId && t.chapterId === chapterId && (t.status === 'waiting' || t.status === 'downloading')
    );
    if (existing) {
      return existing;
    }

    const task: DownloadTask = {
      id: generateId(),
      mangaId: finalMangaId,
      chapterId: chapterId,
      mangaTitle: manga.title,
      chapterTitle: chapter.title || `Capítulo ${chapter.number}`,
      chapterNumber: chapter.number,
      source: 'telegram',
      sourceData: { manga, chapter, baseUrl },
      status: 'waiting',
      progress: 0,
      totalFiles: chapter.pageCount || 25,
      downloadedFiles: 0,
      totalSize: chapter.sizeBytes || 0,
      downloadedSize: 0,
      createdAt: Date.now(),
      retries: 0,
      maxRetries: 3,
    };

    await saveDownloadTask(task);
    this.queue.push(task);
    this.notify();
    this.processQueue();
    return task;
  }

  /**
   * Enfileira múltiplos capítulos do Bunker
   */
  public async enqueueBunkerBatch(manga: RemoteCatalogManga, chapters: RemoteCatalogChapter[], baseUrl: string): Promise<DownloadTask[]> {
    const created: DownloadTask[] = [];
    for (const chapter of chapters) {
      const task = await this.enqueueBunkerChapter({ manga, chapter, baseUrl });
      created.push(task);
    }
    return created;
  }

  /**
   * Pausa uma tarefa
   */
  public async pauseTask(taskId: string): Promise<void> {
    const task = this.queue.find((t) => t.id === taskId);
    if (!task) return;

    if (task.status === 'downloading') {
      const controller = this.activeControllers.get(taskId);
      if (controller) {
        controller.abort();
        this.activeControllers.delete(taskId);
      }
    }

    task.status = 'paused';
    await saveDownloadTask(task);
    this.notify();
    this.processQueue();
  }

  /**
   * Retoma uma tarefa pausada
   */
  public async resumeTask(taskId: string): Promise<void> {
    const task = this.queue.find((t) => t.id === taskId);
    if (!task) return;

    if (task.status === 'paused' || task.status === 'failed') {
      task.status = 'waiting';
      task.error = undefined;
      await saveDownloadTask(task);
      this.notify();
      this.processQueue();
    }
  }

  /**
   * Cancela uma tarefa
   */
  public async cancelTask(taskId: string): Promise<void> {
    const task = this.queue.find((t) => t.id === taskId);
    if (!task) return;

    if (task.status === 'downloading') {
      const controller = this.activeControllers.get(taskId);
      if (controller) {
        controller.abort();
        this.activeControllers.delete(taskId);
      }
      if (task.source === 'mangadex' && task.sourceData?.chapter?.id) {
        cancelOnlineDownload(task.sourceData.chapter.id);
      } else if (task.source === 'telegram' && task.sourceData?.chapter?.number) {
        cancelChapterDownload(task.mangaId, task.sourceData.chapter.number);
      }
    }

    task.status = 'cancelled';
    task.completedAt = Date.now();
    await saveDownloadTask(task);

    // Registra no histórico de downloads
    await addDownloadHistory({
      id: generateId(),
      mangaId: task.mangaId,
      chapterId: task.chapterId,
      mangaTitle: task.mangaTitle,
      chapterTitle: task.chapterTitle,
      chapterNumber: task.chapterNumber || 0,
      completedAt: Date.now(),
      sizeBytes: task.downloadedSize || 0,
      source: task.source || 'online',
      status: 'cancelled',
      errorMessage: 'Cancelado pelo usuário',
    });

    this.notify();
    this.processQueue();
  }

  /**
   * Tenta novamente uma tarefa com falha
   */
  public async retryTask(taskId: string): Promise<void> {
    const task = this.queue.find((t) => t.id === taskId);
    if (!task) return;

    task.status = 'waiting';
    task.error = undefined;
    task.progress = 0;
    task.downloadedFiles = 0;
    task.downloadedSize = 0;
    task.retries = 0;
    await saveDownloadTask(task);
    this.notify();
    this.processQueue();
  }

  /**
   * Pausa todas as tarefas ativas e pendentes
   */
  public async pauseAll(): Promise<void> {
    for (const task of this.queue) {
      if (task.status === 'downloading' || task.status === 'waiting') {
        const controller = this.activeControllers.get(task.id);
        if (controller) {
          controller.abort();
          this.activeControllers.delete(task.id);
        }
        task.status = 'paused';
        await saveDownloadTask(task);
      }
    }
    this.notify();
  }

  /**
   * Retoma todas as tarefas pausadas
   */
  public async resumeAll(): Promise<void> {
    for (const task of this.queue) {
      if (task.status === 'paused') {
        task.status = 'waiting';
        task.error = undefined;
        await saveDownloadTask(task);
      }
    }
    this.notify();
    this.processQueue();
  }

  /**
   * Remove uma tarefa da fila visual (sem apagar o arquivo baixado nem o histórico)
   */
  public async removeTask(taskId: string): Promise<void> {
    const index = this.queue.findIndex((t) => t.id === taskId);
    if (index !== -1) {
      const task = this.queue[index];
      if (task.status === 'downloading') {
        const controller = this.activeControllers.get(task.id);
        if (controller) {
          controller.abort();
          this.activeControllers.delete(task.id);
        }
      }
      this.queue.splice(index, 1);
      await deleteDownloadTask(taskId);
      this.notify();
    }
  }

  /**
   * Limpa tarefas concluídas da fila visual
   */
  public async clearCompleted(): Promise<void> {
    this.queue = this.queue.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
    await clearCompletedDownloadTasks();
    this.notify();
  }

  /**
   * Loop central de processamento da fila persistente em segundo plano
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (true) {
        const activeCount = this.queue.filter((t) => t.status === 'downloading').length;
        if (activeCount >= this.maxConcurrent) {
          break;
        }

        const nextTask = this.queue.find((t) => t.status === 'waiting');
        if (!nextTask) {
          break;
        }

        // Inicia o download da tarefa de forma assíncrona desacoplada da tela
        this.executeTask(nextTask);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Executa uma tarefa individual de forma isolada e persistente
   */
  private async executeTask(task: DownloadTask): Promise<void> {
    task.status = 'downloading';
    task.startedAt = Date.now();
    await saveDownloadTask(task);
    this.notify();

    const controller = new AbortController();
    this.activeControllers.set(task.id, controller);

    let success = false;
    let errorMessage: string | undefined;

    try {
      if (task.source === 'mangadex' && task.sourceData) {
        const { manga, chapter, preferDataSaver } = task.sourceData;
        success = await downloadOnlineChapter(
          manga,
          chapter,
          (prog) => {
            task.progress = prog.percent;
            task.downloadedFiles = prog.currentImage;
            task.totalFiles = prog.totalImages || task.totalFiles;
            task.downloadedSize = prog.bytesDownloaded;
            if (prog.stage === 'failed') {
              task.error = prog.error;
            }
            saveDownloadTask(task);
            this.notify();
          },
          preferDataSaver
        );
      } else if (task.source === 'telegram' && task.sourceData) {
        const { manga, chapter, baseUrl } = task.sourceData;
        success = await downloadAndUnpackChapter(
          manga,
          chapter,
          baseUrl,
          (prog) => {
            task.progress = prog.percent;
            task.downloadedSize = prog.bytesDownloaded;
            task.totalSize = prog.totalBytes || task.totalSize;
            if (prog.stage === 'failed') {
              task.error = prog.error;
            }
            saveDownloadTask(task);
            this.notify();
          }
        );
      } else {
        throw new Error(`Origem de download desconhecida: ${task.source}`);
      }
    } catch (err: any) {
      errorMessage = err?.message || String(err);
      success = false;
    } finally {
      this.activeControllers.delete(task.id);
    }

    if (success) {
      task.status = 'completed';
      task.progress = 100;
      task.completedAt = Date.now();
      task.error = undefined;
      await saveDownloadTask(task);

      // Marca o capítulo como baixado na biblioteca se existir
      const localCh = await getChapter(task.chapterId);
      if (localCh) {
        localCh.isDownloaded = true;
        await saveChapter(localCh);
      }

      // Adiciona ao histórico persistente
      await addDownloadHistory({
        id: generateId(),
        mangaId: task.mangaId,
        chapterId: task.chapterId,
        mangaTitle: task.mangaTitle,
        chapterTitle: task.chapterTitle,
        chapterNumber: task.chapterNumber || 0,
        completedAt: Date.now(),
        sizeBytes: task.downloadedSize || task.totalSize || 0,
        source: task.source || 'online',
        status: 'completed',
      });
    } else {
      task.retries = (task.retries || 0) + 1;
      if (task.retries < (task.maxRetries || 3)) {
        // Tenta novamente marcando como waiting
        task.status = 'waiting';
        task.error = errorMessage || 'Falha temporária, aguardando nova tentativa';
      } else {
        task.status = 'failed';
        task.error = errorMessage || task.error || 'Falha após múltiplas tentativas';
        task.completedAt = Date.now();

        // Registra histórico de falha
        await addDownloadHistory({
          id: generateId(),
          mangaId: task.mangaId,
          chapterId: task.chapterId,
          mangaTitle: task.mangaTitle,
          chapterTitle: task.chapterTitle,
          chapterNumber: task.chapterNumber || 0,
          completedAt: Date.now(),
          sizeBytes: task.downloadedSize || 0,
          source: task.source || 'online',
          status: 'failed',
          errorMessage: task.error,
        });
      }
      await saveDownloadTask(task);
    }

    this.notify();
    // Continua a processar a fila em segundo plano
    this.processQueue();
  }
}

export const downloadManager = new DownloadManagerService();
