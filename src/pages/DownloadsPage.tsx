import { useState, useEffect } from 'react';
import { DownloadTask } from '../types';
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
import { formatFileSize } from '../services/import';

export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadTask[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const load = async () => {
      const all = await getAllDownloads();
      setDownloads(all);
    };
    load();
    return subscribe(() => {
      getAllDownloads().then(setDownloads);
    });
  }, []);

  const filtered = filter === 'all' ? downloads : downloads.filter(d => d.status === filter);

  const counts = {
    all: downloads.length,
    downloading: downloads.filter(d => d.status === 'downloading').length,
    waiting: downloads.filter(d => d.status === 'waiting').length,
    completed: downloads.filter(d => d.status === 'completed').length,
    failed: downloads.filter(d => d.status === 'failed').length,
  };

  return (
    <div className="slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-graphite-100">Downloads</h1>
          <p className="text-sm text-graphite-400">{downloads.length} tarefas</p>
        </div>
        {counts.completed > 0 && (
          <button
            onClick={clearCompleted}
            className="px-3 py-1.5 text-xs text-graphite-400 hover:text-graphite-200 border border-graphite-700/30 rounded-lg"
          >
            Limpar concluídos
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {[
          { id: 'all', label: 'Todos', count: counts.all },
          { id: 'downloading', label: '📥 Baixando', count: counts.downloading },
          { id: 'waiting', label: '⏳ Aguardando', count: counts.waiting },
          { id: 'completed', label: '✅ Concluídos', count: counts.completed },
          { id: 'failed', label: '❌ Falhou', count: counts.failed },
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

      {/* Download List */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <span className="text-5xl mb-4 block">📥</span>
          <h3 className="text-lg font-semibold text-graphite-200 mb-2">
            {downloads.length === 0 ? 'Nenhum download' : 'Nenhum resultado'}
          </h3>
          <p className="text-sm text-graphite-400">
            {downloads.length === 0
              ? 'Os downloads aparecerão aqui quando você baixar capítulos'
              : 'Tente ajustar os filtros'}
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
                <div className="progress-bar h-full" style={{ width: `${task.progress}%` }}></div>
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
              <button onClick={onPause} className="text-xs text-graphite-400 hover:text-graphite-200 px-2 py-1 bg-graphite-800/40 rounded">
                ⏸️ Pausar
              </button>
            )}
            {task.status === 'paused' && (
              <button onClick={onResume} className="text-xs text-violet-light hover:text-violet-accent px-2 py-1 bg-violet-accent/10 rounded">
                ▶️ Retomar
              </button>
            )}
            {(task.status === 'failed' || task.status === 'cancelled') && (
              <button onClick={onRetry} className="text-xs text-violet-light hover:text-violet-accent px-2 py-1 bg-violet-accent/10 rounded">
                🔄 Tentar novamente
              </button>
            )}
            {(task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') && (
              <button onClick={onRemove} className="text-xs text-graphite-500 hover:text-error px-2 py-1 bg-graphite-800/40 rounded">
                🗑️ Remover
              </button>
            )}
            {(task.status === 'downloading' || task.status === 'waiting') && (
              <button onClick={onCancel} className="text-xs text-error/60 hover:text-error px-2 py-1 bg-graphite-800/40 rounded">
                ✕ Cancelar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
