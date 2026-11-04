import { useState, useEffect } from 'react';
import { RemoteCatalogManga, RemoteCatalogChapter } from '../services/githubCatalog';
import { downloadAndUnpackChapter, downloadMultipleChapters, DownloadProgress, cancelChapterDownload } from '../services/chapterDownloader';
import { getDownloadedStatusMap } from '../services/githubCatalog';

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
    if (isOpen && manga) {
      getDownloadedStatusMap(manga.id).then(setDownloadedSet);
    }
  }, [isOpen, manga]);

  if (!isOpen || !manga) return null;

  const chapters = manga.chapters || [];
  const totalDownloaded = chapters.filter((c) => downloadedSet.has(c.number)).length;
  const totalPending = chapters.length - totalDownloaded;

  const totalSizeBytes = chapters.reduce((sum, c) => sum + (c.sizeBytes || 0), 0);
  const totalSizeMb = (totalSizeBytes / (1024 * 1024)).toFixed(1);

  const handleDownloadSingle = async (chapter: RemoteCatalogChapter) => {
    setActiveDownloads((prev) => {
      const copy = new Map(prev);
      copy.set(chapter.number, {
        mangaId: manga.id,
        chapterId: chapter.id,
        chapterNumber: chapter.number,
        stage: 'downloading',
        percent: 0,
        bytesDownloaded: 0,
        totalBytes: chapter.sizeBytes,
      });
      return copy;
    });

    const success = await downloadAndUnpackChapter(manga, chapter, baseUrl, (prog) => {
      setActiveDownloads((prev) => {
        const copy = new Map(prev);
        copy.set(chapter.number, prog);
        return copy;
      });
    });

    if (success) {
      setDownloadedSet((prev) => new Set(prev).add(chapter.number));
      setActiveDownloads((prev) => {
        const copy = new Map(prev);
        copy.delete(chapter.number);
        return copy;
      });
      if (onDownloaded) onDownloaded();
    }
  };

  const handleDownloadAll = async () => {
    setIsDownloadingAll(true);
    const pendingChapters = chapters.filter((c) => !downloadedSet.has(c.number));

    for (const ch of pendingChapters) {
      await handleDownloadSingle(ch);
    }

    setIsDownloadingAll(false);
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
              <div className="w-full h-full flex items-center justify-center text-2xl">📕</div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white truncate">{manga.title}</h2>
              <button
                onClick={onClose}
                className="text-graphite-400 hover:text-white p-1 rounded-lg hover:bg-graphite-800 transition"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-graphite-400 line-clamp-2 mt-1">
              {manga.synopsis || 'Capítulos compactados no GitHub prontos para leitura offline.'}
            </p>

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-violet-accent/20 text-violet-light border border-violet-accent/30">
                📦 {chapters.length} capítulos ({totalSizeMb} MB)
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                ✅ {totalDownloaded} baixados
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                🔒 SHA-256 verificado
              </span>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="px-4 py-3 bg-graphite-850 border-b border-graphite-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-md transition ${filter === 'all' ? 'bg-violet-accent text-white font-medium' : 'text-graphite-400 hover:text-white'}`}
            >
              Todos ({chapters.length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-2.5 py-1 rounded-md transition ${filter === 'pending' ? 'bg-violet-accent text-white font-medium' : 'text-graphite-400 hover:text-white'}`}
            >
              Pendentes ({totalPending})
            </button>
            <button
              onClick={() => setFilter('downloaded')}
              className={`px-2.5 py-1 rounded-md transition ${filter === 'downloaded' ? 'bg-violet-accent text-white font-medium' : 'text-graphite-400 hover:text-white'}`}
            >
              Baixados ({totalDownloaded})
            </button>
          </div>

          {totalPending > 0 && (
            <button
              onClick={handleDownloadAll}
              disabled={isDownloadingAll}
              className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-accent to-indigo-600 hover:brightness-110 text-white shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5 text-center"
            >
              <span>{isDownloadingAll ? '⏳' : '⬇️'}</span>
              <span>{isDownloadingAll ? 'Baixando Tudo...' : `Baixar Todos (${totalPending})`}</span>
            </button>
          )}
        </div>

        {/* Chapters List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {filteredChapters.length === 0 ? (
            <div className="text-center py-10 text-graphite-400 text-sm">
              Nenhum capítulo com o filtro selecionado.
            </div>
          ) : (
            filteredChapters.map((ch) => {
              const isDownloaded = downloadedSet.has(ch.number);
              const active = activeDownloads.get(ch.number);
              const sizeMb = ((ch.sizeBytes || 0) / (1024 * 1024)).toFixed(1);

              return (
                <div
                  key={ch.number}
                  className="p-3 rounded-xl bg-graphite-800/40 border border-graphite-700/30 hover:border-graphite-600/50 transition flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-graphite-100">{ch.title}</span>
                        {ch.sha256 && (
                          <span
                            title={`SHA-256: ${ch.sha256}`}
                            className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-graphite-900/80 text-graphite-400 border border-graphite-700/50"
                          >
                            SHA: {ch.sha256.substring(0, 6)}…
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
                          onClick={() => cancelChapterDownload(manga.id, ch.number)}
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
                          {active.stage === 'downloading' && '⬇️ Baixando do GitHub...'}
                          {active.stage === 'verifying' && '🔒 Verificando hash SHA-256...'}
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
          <span className="truncate flex-1 min-w-0 mr-2">🚀 Arquivos baixados diretamente do GitHub • 100% Offline</span>
          <button onClick={onClose} className="text-violet-light hover:underline font-medium">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
