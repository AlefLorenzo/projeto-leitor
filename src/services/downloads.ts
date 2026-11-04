import { DownloadTask, DownloadStatus } from '../types';
import { getDB, generateId } from './database';

let downloadQueue: DownloadTask[] = [];
let activeDownloads: Map<string, DownloadTask> = new Map();
let listeners: Set<() => void> = new Set();

const MAX_CONCURRENT = 2;

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach(l => l());
}

export function getDownloadQueue(): DownloadTask[] {
  return [...downloadQueue];
}

export function getActiveDownloads(): DownloadTask[] {
  return Array.from(activeDownloads.values());
}

export async function getAllDownloads(): Promise<DownloadTask[]> {
  const db = await getDB();
  if (!db.objectStoreNames.contains('downloads')) return [];
  const all = await db.getAll('downloads');
  return all.sort((a: DownloadTask, b: DownloadTask) => b.createdAt - a.createdAt);
}

export async function createDownloadTask(
  mangaId: string,
  chapterId: string,
  mangaTitle: string,
  chapterTitle: string,
  totalFiles: number,
  totalSize: number,
  url?: string
): Promise<DownloadTask> {
  const task: DownloadTask = {
    id: generateId(),
    mangaId,
    chapterId,
    mangaTitle,
    chapterTitle,
    status: 'waiting',
    progress: 0,
    totalFiles,
    downloadedFiles: 0,
    totalSize,
    downloadedSize: 0,
    url,
    createdAt: Date.now(),
    retries: 0,
    maxRetries: 3,
  };

  // Save to DB
  const db = await getDB();
  if (db.objectStoreNames.contains('downloads')) {
    await db.put('downloads', task);
  }

  downloadQueue.push(task);
  notify();
  processQueue();

  return task;
}

async function processQueue() {
  while (activeDownloads.size < MAX_CONCURRENT && downloadQueue.length > 0) {
    const task = downloadQueue.shift();
    if (!task) break;

    task.status = 'downloading';
    task.startedAt = Date.now();
    activeDownloads.set(task.id, task);
    notify();

    // Simulate download (in real app, this would fetch actual files)
    simulateDownload(task);
  }
}

async function simulateDownload(task: DownloadTask) {
  const totalSteps = task.totalFiles || 10;
  
  for (let i = 0; i <= totalSteps; i++) {
    // Check if paused or cancelled
    if (task.status === 'paused' || task.status === 'cancelled') {
      activeDownloads.delete(task.id);
      notify();
      return;
    }

    // Simulate progress
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    task.downloadedFiles = i;
    task.progress = Math.round((i / totalSteps) * 100);
    task.downloadedSize = Math.round((i / totalSteps) * task.totalSize);
    
    // Update DB
    const db = await getDB();
    if (db.objectStoreNames.contains('downloads')) {
      await db.put('downloads', task);
    }
    
    notify();
  }

  // Complete
  task.status = 'completed';
  task.completedAt = Date.now();
  task.progress = 100;
  task.downloadedFiles = task.totalFiles;
  task.downloadedSize = task.totalSize;

  const db = await getDB();
  if (db.objectStoreNames.contains('downloads')) {
    await db.put('downloads', task);
  }

  activeDownloads.delete(task.id);
  notify();
  processQueue();
}

export async function pauseDownload(taskId: string) {
  const task = activeDownloads.get(taskId) || downloadQueue.find(t => t.id === taskId);
  if (task) {
    task.status = 'paused';
    activeDownloads.delete(taskId);
    
    const db = await getDB();
    if (db.objectStoreNames.contains('downloads')) {
      await db.put('downloads', task);
    }
    
    notify();
  }
}

export async function resumeDownload(taskId: string) {
  const task = downloadQueue.find(t => t.id === taskId);
  if (!task) {
    // Find in DB
    const db = await getDB();
    if (db.objectStoreNames.contains('downloads')) {
      const saved = await db.get('downloads', taskId);
      if (saved && saved.status === 'paused') {
        saved.status = 'waiting';
        await db.put('downloads', saved);
        downloadQueue.push(saved);
        notify();
        processQueue();
      }
    }
  } else {
    task.status = 'waiting';
    notify();
    processQueue();
  }
}

export async function cancelDownload(taskId: string) {
  const task = activeDownloads.get(taskId) || downloadQueue.find(t => t.id === taskId);
  if (task) {
    task.status = 'cancelled';
    activeDownloads.delete(taskId);
    downloadQueue = downloadQueue.filter(t => t.id !== taskId);
    
    const db = await getDB();
    if (db.objectStoreNames.contains('downloads')) {
      await db.put('downloads', task);
    }
    
    notify();
    processQueue();
  }
}

export async function retryDownload(taskId: string) {
  const db = await getDB();
  if (!db.objectStoreNames.contains('downloads')) return;
  
  const task = await db.get('downloads', taskId);
  if (task && (task.status === 'failed' || task.status === 'cancelled')) {
    task.status = 'waiting';
    task.progress = 0;
    task.downloadedFiles = 0;
    task.downloadedSize = 0;
    task.retries += 1;
    task.error = undefined;
    
    await db.put('downloads', task);
    downloadQueue.push(task);
    notify();
    processQueue();
  }
}

export async function removeDownload(taskId: string) {
  downloadQueue = downloadQueue.filter(t => t.id !== taskId);
  activeDownloads.delete(taskId);
  
  const db = await getDB();
  if (db.objectStoreNames.contains('downloads')) {
    await db.delete('downloads', taskId);
  }
  
  notify();
  processQueue();
}

export async function clearCompleted() {
  const db = await getDB();
  if (!db.objectStoreNames.contains('downloads')) return;
  
  const all = await db.getAll('downloads');
  for (const task of all) {
    if (task.status === 'completed' || task.status === 'cancelled') {
      await db.delete('downloads', task.id);
    }
  }
  
  notify();
}

export function getDownloadStatus(): { waiting: number; downloading: number; paused: number; completed: number; failed: number } {
  const all = [...downloadQueue, ...activeDownloads.values()];
  return {
    waiting: all.filter(t => t.status === 'waiting').length,
    downloading: all.filter(t => t.status === 'downloading').length,
    paused: all.filter(t => t.status === 'paused').length,
    completed: all.filter(t => t.status === 'completed').length,
    failed: all.filter(t => t.status === 'failed').length,
  };
}

export function getStatusLabel(status: DownloadStatus): string {
  const labels: Record<DownloadStatus, string> = {
    waiting: '⏳ Aguardando',
    downloading: '📥 Baixando',
    paused: '⏸️ Pausado',
    completed: '✅ Concluído',
    failed: '❌ Falhou',
    cancelled: '🚫 Cancelado',
  };
  return labels[status];
}

export function getStatusColor(status: DownloadStatus): string {
  const colors: Record<DownloadStatus, string> = {
    waiting: 'text-warning',
    downloading: 'text-violet-light',
    paused: 'text-graphite-400',
    completed: 'text-success',
    failed: 'text-error',
    cancelled: 'text-graphite-500',
  };
  return colors[status];
}
