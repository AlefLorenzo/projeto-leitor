import { useState, useEffect } from 'react';
import { RemoteCatalogManga, RemoteCatalogChapter, getDownloadedStatusMap } from '../services/githubCatalog';
import { downloadManager } from '../services/downloadManager';
import { DownloadProgress } from '../services/chapterDownloader';

interface ChapterDownloadModalProps {
  isOpen: boolean;
  manga: RemoteCatalogManga | null;
  baseUrl: string;
  onClose: () => void;
  onOpenReader: (chapterId: string) => void;
  onDownloaded?: () => void;
}

export function ChapterDownloadModal({
  isOpen,
  manga,
  baseUrl,
  onClose,
  onOpenReader,
  onDownloaded,
}: ChapterDownloadModalProps) {
  const [downloadedSet, setDownloadedSet] = useState<Set<number>>(new Set());
  const [activeDownloads, setActiveDownloads] = useState<Map<number, DownloadProgress>>(new Map());
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'downloaded'>('all');

  useEffect(() => {
    if (!isOpen || !manga) return;

    getDownloadedStatusMap(manga.id).then(setDownloadedSet);

    const syncWithQueue = () => {
      const queue = downloadManager.getQueue();
      const finalMangaId = manga.id.startsWith('telegram-') ? manga.id : `telegram-${manga.id}`;
      const mangaTasks = queue.filter(t => t.mangaId === finalMangaId);

      const activeMap = new Map<number, DownloadProgress>();
      for (const t of mangaTasks) {
        if (t.chapterNumber !== undefined) {
          if (t.status === 'downloading' || t.status === 'waiting') {
            activeMap.set(t.chapterNumber, {
              mangaId: manga.id,
              chapterId: t.chapterId,
              chapterNumber: t.chapterNumber,
              stage: t.status === 'downloading' ? 'downloading' : 'verifying',
              percent: t.progress || 0,
              bytesDownloaded: t.downloadedSize || 0,
              totalBytes: t.totalSize || 0,
            });
          } else if (t.status === 'completed') {
            setDownloadedSet(prev => new Set(prev).add(t.chapterNumber!));
          }
        }
      }
      setActiveDownloads(activeMap);
    };

    syncWithQueue();
    const unsubscribe = downloadManager.subscribe(() => {
      syncWithQueue();
      getDownloadedStatusMap(manga.id).then(setDownloadedSet);
    });

    return () => unsubscribe();
  }, [isOpen, manga]);

  if (!isOpen || !manga) return null;

  const chapters = manga.chapters || [];
  const totalDownloaded = chapters.filter((c) => downloadedSet.has(c.number)).length;
  const totalPending = chapters.length - totalDownloaded;

  const totalSizeBytes = chapters.reduce((sum, c) => sum + (c.sizeBytes || 0), 0);
  const totalSizeMb = (totalSizeBytes / (1024 * 1024)).toFixed(1);

  const handleDownloadSingle = async (chapter: RemoteCatalogChapter) => {
    await downloadManager.enqueueBunkerChapter({ manga, chapter, baseUrl });
    if (onDownloaded) onDownloaded();
  };

  const handleDownloadAll = async () => {
    setIsDownloadingAll(true);
    const pendingChapters = chapters.filter((c) => !downloadedSet.has(c.number));
    await downloadManager.enqueueBunkerBatch(manga, pendingChapters, baseUrl);
    setIsDownloadingAll(false);
    if (onDownloaded) onDownloaded();
  };

  const handleCancel = async (chapter: RemoteCatalogChapter) => {
    const queue = downloadManager.getQueue();
    const finalMangaId = manga.id.startsWith('telegram-') ? manga.id : `telegram-${manga.id}`;
    const task = queue.find(t => t.mangaId === finalMangaId && t.chapterNumber === chapter.number);
    if (task) {
      await downloadManager.cancelTask(task.id);
    }
  };

  const filteredChapters = chapters.filter((c) => {
    const isDownloaded = downloadedSet.has(c.number);
    if (filter === 'pending') return !isDownloaded;
    if (filter === 'downloaded') return isDownloaded;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-graphite-900 border border-graphite-700/60 rounded-2xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-graphite-800 flex items-start gap-3 bg-gradient-to-r from-graphite-900 via-graphite-850 to-graphite-900">
          <div className="w-16 h-22 sm:w-20 sm:h-28 rounded-lg overflow-hidden bg-graphite-800 flex-shrink-0 shadow border border-graphite-700/40">
            {manga.coverUrl ? (
              <img src={manga.coverUrl} alt={manga.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">📚</div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base sm:text-lg font-bold text-graphite-100 line-clamp-1">{manga.title}</h2>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg bg-graphite-800 hover:bg-graphite-700 text-graphite-400 hover:text-white flex items-center justify-center transition flex-shrink-0"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-graphite-400 mt-1 line-clamp-2">{manga.synopsis || 'Capítulos sincronizados do Telegram.'}</p>

            <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-graphite-300">
              <span className="bg-graphite-800 px-2 py-0.5 rounded border border-graphite-700/50">
                📦 {chapters.length} cap.
              </span>
              <span className="bg-graphite-800 px-2 py-0.5 rounded border border-graphite-700/50">
                💾 ~{totalSizeMb} MB total
              </span>
              <span className="bg-emerald-950/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800/40">
                ✓ {totalDownloaded} baixados
              </span>
              {totalPending > 0 && (
                <span className="bg-amber-950/50 text-amber-300 px-2 py-0.5 rounded border border-amber-800/40">
                  ⏳ {totalPending} pendentes
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Toolbar: Filters & Batch Download */}
        <div className="px-4 py-2.5 bg-graphite-850 border-b border-graphite-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                filter === 'all'
                  ? 'bg-violet-accent text-white shadow'
                  : 'bg-graphite-800 text-graphite-400 hover:text-white'
              }`}
            >
              Todos ({chapters.length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                filter === 'pending'
                  ? 'bg-violet-accent text-white shadow'
                  : 'bg-graphite-800 text-graphite-400 hover:text-white'
              }`}
            >
              Pendentes ({totalPending})
            </button>
            <button
              onClick={() => setFilter('downloaded')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                filter === 'downloaded'
                  ? 'bg-violet-accent text-white shadow'
                  : 'bg-graphite-800 text-graphite-400 hover:text-white'
              }`}
            >
              Baixados ({totalDownloaded})
            </button>
          </div>

          {totalPending > 0 && (
            <button
              onClick={handleDownloadAll}
              disabled={isDownloadingAll}
              className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 shadow transition disabled:opacity-50"
            >
              <span>{isDownloadingAll ? '⏳' : '⚡'}</span>
              <span>{isDownloadingAll ? 'Enfileirando...' : `Baixar Todos (${totalPending})`}</span>
            </button>
          )}
        </div>

        {/* Chapter List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {filteredChapters.length === 0 ? (
            <div className="text-center py-12 text-graphite-400 text-xs">
              Nenhum capítulo encontrado para o filtro selecionado.
            </div>
          ) : (
            filteredChapters.map((ch) => {
              const isDownloaded = downloadedSet.has(ch.number);
              const active = activeDownloads.get(ch.number);
              const sizeMb = ((ch.sizeBytes || 0) / (1024 * 1024)).toFixed(1);

              return (
                <div
                  key={ch.number}
                  className={`p-3 rounded-xl border transition flex flex-col gap-2 ${
                    isDownloaded
                      ? 'bg-graphite-850/60 border-emerald-900/40 hover:border-emerald-800/60'
                      : active
                      ? 'bg-graphite-850 border-violet-accent/50'
                      : 'bg-graphite-850/40 border-graphite-800 hover:border-graphite-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-graphite-200">
                          {ch.title || `Capítulo ${ch.number}`}
                        </span>
                        {isDownloaded && (
                          <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-800/50">
                            ✓ Salvo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-graphite-400 mt-0.5">
                        <span>{ch.pageCount} páginas</span>
                        <span>•</span>
                        <span>{sizeMb} MB (CBZ)</span>
                        {isDownloaded && <span className="text-emerald-400 font-semibold">• Offline no celular</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isDownloaded ? (
                        <button
                          onClick={() => {
                            onClose();
                            onOpenReader(`ch-${manga.id}-${ch.number}`);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow transition"
                        >
                          <span>▶</span>
                          <span>Ler</span>
                        </button>
                      ) : active ? (
                        <button
                          onClick={() => handleCancel(ch)}
                          className="px-2.5 py-1 rounded text-xs text-rose-400 hover:bg-rose-500/10 border border-rose-500/30 transition"
                        >
                          Cancelar
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDownloadSingle(ch)}
                          disabled={isDownloadingAll}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-accent hover:bg-violet-accent/90 text-white flex items-center gap-1.5 shadow transition disabled:opacity-50"
                        >
                          <span>⬇️</span>
                          <span>Baixar</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Active Download Progress Bar */}
                  {active && (
                    <div className="w-full pt-1 border-t border-graphite-700/40">
                      <div className="flex justify-between items-center text-[10px] text-graphite-300 mb-1">
                        <span>
                          {active.stage === 'downloading' && '⬇️ Baixando do GitHub em segundo plano...'}
                          {active.stage === 'verifying' && '🔒 Verificando integridade...'}
                          {active.stage === 'extracting' && '📦 Descompactando imagens...'}
                          {active.stage === 'saving' && '💾 Salvando na biblioteca...'}
                          {active.stage === 'failed' && `❌ Erro: ${active.error || 'Falha no download'}`}
                        </span>
                        <span className="font-mono font-bold text-violet-light">{active.percent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-graphite-900 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-150 ${active.stage === 'failed' ? 'bg-rose-500' : 'bg-gradient-to-r from-violet-accent to-emerald-400'}`}
                          style={{ width: `${Math.max(2, active.percent)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-graphite-900 border-t border-graphite-800 text-[11px] text-graphite-400 flex items-center justify-between">
          <span className="truncate flex-1 min-w-0 mr-2">🚀 Downloads persistentes em segundo plano</span>
          <button onClick={onClose} className="text-violet-light hover:underline font-medium">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
