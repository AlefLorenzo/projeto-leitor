import { DownloadTask, DownloadStatus } from '../types';
import { downloadManager } from './downloadManager';
import { getAllDownloadTasks } from './database';

export function subscribe(listener: () => void): () => void {
  return downloadManager.subscribe(listener);
}

export function getDownloadQueue(): DownloadTask[] {
  return downloadManager.getQueue();
}

export function getActiveDownloads(): DownloadTask[] {
  return downloadManager.getQueue().filter(t => t.status === 'downloading');
}

export async function getAllDownloads(): Promise<DownloadTask[]> {
  return getAllDownloadTasks();
}

export async function pauseDownload(taskId: string): Promise<void> {
  await downloadManager.pauseTask(taskId);
}

export async function resumeDownload(taskId: string): Promise<void> {
  await downloadManager.resumeTask(taskId);
}

export async function cancelDownload(taskId: string): Promise<void> {
  await downloadManager.cancelTask(taskId);
}

export async function retryDownload(taskId: string): Promise<void> {
  await downloadManager.retryTask(taskId);
}

export async function removeDownload(taskId: string): Promise<void> {
  await downloadManager.removeTask(taskId);
}

export async function clearCompleted(): Promise<void> {
  await downloadManager.clearCompleted();
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
  return labels[status] || status;
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
  return colors[status] || 'text-graphite-400';
}
