import { useState, useEffect } from 'react';
import { DownloadTask, DownloadHistoryEntry, DownloadStats } from '../types';
import {
  getAllDownloads,
  pauseDownload,
  resumeDownload,
  cancelDownload,
  retryDownload,
  removeDownload,
  clearCompleted,
  getStatusLabel,
  getStatusColor,
  subscribe,
} from '../services/downloads';
import { downloadManager } from '../services/downloadManager';
import { formatFileSize } from '../services/import';

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadTask[]>([]);
  const [history, setHistory] = useState<DownloadHistoryEntry[]>([]);
  const [stats, setStats] = useState<DownloadStats | null>(null);
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [filter, setFilter] = useState<string>('all');

  const loadData = async () => {
    const [tasks, hist, st] = await Promise.all([
      getAllDownloads(),
      downloadManager.getHistory(),
      downloadManager.getStats(),
    ]);
    setDownloads(tasks);
    setHistory(hist);
    setStats(st);
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  const filtered = filter === 'all' ? downloads : downloads.filter(d => d.status === filter);

  const counts = {
    all: downloads.length,
    downloading: downloads.filter(d => d.status === 'downloading').length,
    waiting: downloads.filter(d => d.status === 'waiting').length,
    paused: downloads.filter(d => d.status === 'paused').length,
    completed: downloads.filter(d => d.status === 'completed').length,
    failed: downloads.filter(d => d.status === 'failed').length,
  };

  const handleClearHistory = async () => {
    if (confirm('Deseja limpar o histórico de downloads? (Os arquivos baixados serão mantidos)')) {
      await downloadManager.clearHistory();
      const hist = await downloadManager.getHistory();
      setHistory(hist);
    }
  };

  return (
    <div className="slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-graphite-100">Downloads</h1>
          <p className="text-sm text-graphite-400">Gerenciamento e histórico persistente</p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {counts.downloading > 0 && (
            <button
              onClick={() => downloadManager.pauseAll()}
              className="px-3 py-1.5 text-xs text-graphite-300 hover:text-white bg-graphite-800/60 border border-graphite-700/40 rounded-lg transition"
            >
              ⏸️ Pausar Todos
            </button>
          )}
          {counts.paused > 0 && (
            <button
              onClick={() => downloadManager.resumeAll()}
              className="px-3 py-1.5 text-xs text-violet-light hover:text-violet-accent bg-violet-accent/10 border border-violet-accent/30 rounded-lg transition"
            >
              ▶️ Retomar Todos
            </button>
          )}
          {counts.completed > 0 && (
            <button
              onClick={clearCompleted}
              className="px-3 py-1.5 text-xs text-graphite-400 hover:text-graphite-200 border border-graphite-700/40 rounded-lg transition"
            >
              Limpar fila
            </button>
          )}
        </div>
      </div>

      {/* 1.1 Estatísticas Reais de Downloads */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-6">
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-violet-light truncate">{stats.totalChaptersDownloaded}</p>
            <p className="text-[10px] text-graphite-400">Capítulos baixados</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-emerald-400 truncate">{stats.totalMangasDownloaded}</p>
            <p className="text-[10px] text-graphite-400">Obras na biblioteca</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-graphite-100 truncate">{formatFileSize(stats.totalBytesDownloaded)}</p>
            <p className="text-[10px] text-graphite-400">Dados baixados</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-amber-300 truncate">{stats.totalDownloads}</p>
            <p className="text-[10px] text-graphite-400">Total de operações</p>
          </div>
        </div>
      )}

      {/* Tab Selector: Fila vs Histórico */}
      <div className="flex border-b border-graphite-800 mb-4 gap-4">
        <button
          onClick={() => setActiveTab('queue')}
          className={`pb-2 text-sm font-semibold transition border-b-2 flex items-center gap-1.5 ${
            activeTab === 'queue'
              ? 'border-violet-accent text-violet-light'
              : 'border-transparent text-graphite-500 hover:text-graphite-300'
          }`}
        >
          <span>📥 Fila de Downloads</span>
          <span className="text-xs bg-graphite-800 px-1.5 py-0.2 rounded-full text-graphite-400">
            {downloads.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-2 text-sm font-semibold transition border-b-2 flex items-center gap-1.5 ${
            activeTab === 'history'
              ? 'border-violet-accent text-violet-light'
              : 'border-transparent text-graphite-500 hover:text-graphite-300'
          }`}
        >
          <span>📜 Histórico de Downloads</span>
          <span className="text-xs bg-graphite-800 px-1.5 py-0.2 rounded-full text-graphite-400">
            {history.length}
          </span>
        </button>
      </div>

      {activeTab === 'queue' ? (
        <>
          {/* Filters */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {[
              { id: 'all', label: 'Todos', count: counts.all },
              { id: 'downloading', label: '📥 Baixando', count: counts.downloading },
              { id: 'waiting', label: '⏳ Aguardando', count: counts.waiting },
              { id: 'paused', label: '⏸️ Pausados', count: counts.paused },
              { id: 'completed', label: '✅ Concluídos', count: counts.completed },
              { id: 'failed', label: '❌ Erros', count: counts.failed },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  filter === f.id
                    ? 'bg-violet-accent/20 text-violet-light border border-violet-accent/40'
                    : 'bg-graphite-800/40 text-graphite-400 border border-graphite-700/30'
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          {/* Download Queue List */}
          {filtered.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <span className="text-5xl mb-4 block">📥</span>
              <h3 className="text-lg font-semibold text-graphite-200 mb-2">
                {downloads.length === 0 ? 'Fila de downloads vazia' : 'Nenhuma tarefa com este filtro'}
              </h3>
              <p className="text-sm text-graphite-400">
                {downloads.length === 0
                  ? 'Os downloads em segundo plano aparecerão aqui quando você iniciar um download.'
                  : 'Tente alternar para a aba Todos ou outro filtro.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(task => (
                <DownloadCard
                  key={task.id}
                  task={task}
                  onPause={() => pauseDownload(task.id)}
                  onResume={() => resumeDownload(task.id)}
                  onCancel={() => cancelDownload(task.id)}
                  onRetry={() => retryDownload(task.id)}
                  onRemove={() => removeDownload(task.id)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        /* 1.2 Histórico Persistente de Downloads */
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs text-graphite-400">Registros permanentes de downloads concluídos e tentativas</span>
            {history.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-xs text-rose-400 hover:text-rose-300 transition"
              >
                Limpar histórico
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="glass-card rounded-xl p-12 text-center">
              <span className="text-4xl mb-3 block">📜</span>
              <h3 className="text-base font-semibold text-graphite-200 mb-1">Nenhum registro de histórico</h3>
              <p className="text-xs text-graphite-400">O histórico de downloads concluídos aparecerá aqui.</p>
            </div>
          ) : (
            history.map((entry) => (
              <div key={entry.id} className="glass-card rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-graphite-200 truncate">{entry.mangaTitle}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                      entry.status === 'completed'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                        : entry.status === 'failed'
                        ? 'bg-rose-950 text-rose-400 border border-rose-800/50'
                        : 'bg-graphite-800 text-graphite-400 border border-graphite-700/50'
                    }`}>
                      {entry.status === 'completed' ? '✓ Concluído' : entry.status === 'failed' ? '✕ Falhou' : 'Cancelado'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-graphite-400 mt-1">
                    <span>{entry.chapterTitle}</span>
                    <span>•</span>
                    <span>{formatFileSize(entry.sizeBytes)}</span>
                    <span>•</span>
                    <span className="uppercase text-[10px] text-graphite-500">{entry.source}</span>
                  </div>
                  {entry.errorMessage && (
                    <p className="text-[11px] text-rose-400 mt-1 truncate">{entry.errorMessage}</p>
                  )}
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-[11px] text-graphite-500">
                    {new Date(entry.completedAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function DownloadCard({ task, onPause, onResume, onCancel, onRetry, onRemove }: {
  task: DownloadTask;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-10 h-10 rounded-lg bg-graphite-800/60 flex items-center justify-center flex-shrink-0">
          <span className="text-lg">
            {task.status === 'completed' ? '✅' :
             task.status === 'downloading' ? '📥' :
             task.status === 'paused' ? '⏸️' :
             task.status === 'failed' ? '❌' :
             task.status === 'cancelled' ? '🚫' : '⏳'}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-graphite-200 truncate">{task.mangaTitle}</h3>
            <span className={`text-xs ${getStatusColor(task.status)}`}>{getStatusLabel(task.status)}</span>
          </div>
          <p className="text-xs text-graphite-400 mb-2">{task.chapterTitle}</p>

          {/* Progress */}
          {(task.status === 'downloading' || task.status === 'completed') && (
            <div className="mb-2">
              <div className="w-full h-1.5 bg-graphite-800 rounded-full overflow-hidden">
                <div className="progress-bar h-full bg-violet-accent transition-all" style={{ width: `${task.progress}%` }}></div>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-graphite-500">{task.progress}%</span>
                <span className="text-[10px] text-graphite-500">
                  {formatFileSize(task.downloadedSize)} / {formatFileSize(task.totalSize)}
                </span>
              </div>
            </div>
          )}

          {/* Error */}
          {task.error && (
            <p className="text-xs text-error mb-2">{task.error}</p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {task.status === 'downloading' && (
              <button onClick={onPause} className="text-xs text-graphite-400 hover:text-graphite-200 px-2.5 py-1 bg-graphite-800/40 rounded transition">
                ⏸️ Pausar
              </button>
            )}
            {task.status === 'paused' && (
              <button onClick={onResume} className="text-xs text-violet-light hover:text-violet-accent px-2.5 py-1 bg-violet-accent/10 rounded transition">
                ▶️ Retomar
              </button>
            )}
            {(task.status === 'failed' || task.status === 'cancelled') && (
              <button onClick={onRetry} className="text-xs text-violet-light hover:text-violet-accent px-2.5 py-1 bg-violet-accent/10 rounded transition">
                🔄 Tentar novamente
              </button>
            )}
            {(task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') && (
              <button onClick={onRemove} className="text-xs text-graphite-500 hover:text-error px-2.5 py-1 bg-graphite-800/40 rounded transition">
                🗑️ Remover
              </button>
            )}
            {(task.status === 'downloading' || task.status === 'waiting') && (
              <button onClick={onCancel} className="text-xs text-error/60 hover:text-error px-2.5 py-1 bg-graphite-800/40 rounded transition">
                ✕ Cancelar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
