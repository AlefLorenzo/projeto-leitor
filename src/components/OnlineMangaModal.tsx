import { useState, useEffect } from 'react';
import { SourceManga, SourceChapter, ChapterDownloadState } from '../services/sources/types';
import { onlineSourceManager } from '../services/sources/OnlineSourceManager';
import {
  downloadOnlineChapter,
  cancelOnlineDownload,
  getChapterDownloadState,
  deleteChapterDownloadOnly,
  ChapterDownloadProgress,
} from '../services/sources/onlineDownloader';

interface OnlineMangaModalProps {
  isOpen: boolean;
  manga: SourceManga | null;
  onClose: () => void;
  onOpenReader: (mangaId: string, chapterId: string) => void;
}

export function OnlineMangaModal({
  isOpen,
  manga,
  onClose,
  onOpenReader,
}: OnlineMangaModalProps) {
  const [chapters, setChapters] = useState<SourceChapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [downloadStates, setDownloadStates] = useState<Map<string, ChapterDownloadState>>(new Map());
  const [activeProgress, setActiveProgress] = useState<Map<string, ChapterDownloadProgress>>(new Map());
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar lista de capítulos sob demanda ao abrir a obra
  useEffect(() => {
    if (isOpen && manga) {
      setError(null);
      setLoadingChapters(true);
      const adapter = onlineSourceManager.getSource(manga.sourceId) || onlineSourceManager.getActiveSource();

      adapter.getChapterList(manga.id)
        .then(async (list) => {
          setChapters(list);
          // Consulta o estado offline de cada capítulo no IndexedDB
          const stateMap = new Map<string, ChapterDownloadState>();
          for (const ch of list) {
            const st = await getChapterDownloadState(ch.id);
            stateMap.set(ch.id, st);
          }
          setDownloadStates(stateMap);
        })
        .catch((err) => {
          setError(err.message || 'Erro ao carregar capítulos da fonte.');
        })
        .finally(() => {
          setLoadingChapters(false);
        });
    } else {
      setChapters([]);
      setActiveProgress(new Map());
    }
  }, [isOpen, manga]);

  if (!isOpen || !manga) return null;

  const handleDownloadSingle = async (chapter: SourceChapter) => {
    const chapterId = chapter.id;
    setActiveProgress((prev) => {
      const copy = new Map(prev);
      copy.set(chapterId, {
        chapterId,
        mangaId: manga.id,
        chapterNumber: chapter.number,
        stage: 'fetching_pages',
        currentImage: 0,
        totalImages: 0,
        percent: 0,
        bytesDownloaded: 0,
      });
      return copy;
    });

    setDownloadStates((prev) => new Map(prev).set(chapterId, 'downloading'));

    const success = await downloadOnlineChapter(manga, chapter, (prog) => {
      setActiveProgress((prev) => {
        const copy = new Map(prev);
        copy.set(chapterId, prog);
        return copy;
      });
    });

    setActiveProgress((prev) => {
      const copy = new Map(prev);
      copy.delete(chapterId);
      return copy;
    });

    setDownloadStates((prev) => {
      const copy = new Map(prev);
      copy.set(chapterId, success ? 'downloaded' : 'incomplete');
      return copy;
    });
  };

  const handleDownloadAll = async () => {
    setIsDownloadingAll(true);
    const toDownload = chapters.filter((c) => downloadStates.get(c.id) !== 'downloaded');

    for (const ch of toDownload) {
      await handleDownloadSingle(ch);
    }
    setIsDownloadingAll(false);
  };

  const handleDeleteDownload = async (chapterId: string) => {
    const ok = await deleteChapterDownloadOnly(chapterId);
    if (ok) {
      setDownloadStates((prev) => {
        const copy = new Map(prev);
        copy.set(chapterId, 'online');
        return copy;
      });
    }
  };

  const downloadedCount = Array.from(downloadStates.values()).filter((s) => s === 'downloaded').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="glass-card rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-graphite-700/60 shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-graphite-700/40 flex flex-col sm:flex-row gap-4 items-start relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-graphite-400 hover:text-white p-1 rounded-lg hover:bg-graphite-800 transition"
          >
            ✕
          </button>

          {/* Capa */}
          <div className="w-24 sm:w-28 aspect-[2/3] rounded-xl overflow-hidden bg-graphite-800 flex-shrink-0 border border-graphite-700 shadow-md">
            {manga.coverUrl || manga.thumbnailUrl ? (
              <img
                src={manga.thumbnailUrl || manga.coverUrl}
                alt={manga.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl opacity-30">
                📖
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 pr-6">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-violet-accent/20 text-violet-light border border-violet-accent/40">
                {manga.type}
              </span>
              <span className="text-xs text-graphite-400">
                Fonte: <b className="text-graphite-200">{manga.sourceId}</b>
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                manga.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
              }`}>
                {manga.status === 'completed' ? 'Concluído' : 'Em lançamento'}
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-white mb-2 leading-snug">
              {manga.title}
            </h2>

            {manga.synopsis && (
              <p className="text-xs text-graphite-400 line-clamp-3 mb-2 leading-relaxed">
                {manga.synopsis}
              </p>
            )}

            <div className="flex flex-wrap gap-1.5 mt-2">
              {manga.genres.map((g) => (
                <span
                  key={g}
                  className="px-2 py-0.5 rounded text-[10px] bg-graphite-800 text-graphite-300 border border-graphite-700/50"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Toolbar de Ações */}
        <div className="px-4 py-3 bg-graphite-900/60 border-b border-graphite-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="text-graphite-300">
            <span>Capítulos: <b>{chapters.length}</b></span>
            <span className="mx-2">•</span>
            <span className="text-emerald-400">Baixados: <b>{downloadedCount}</b></span>
          </div>

          <div className="flex items-center gap-2">
            {chapters.length > 0 && downloadedCount < chapters.length && (
              <button
                onClick={handleDownloadAll}
                disabled={isDownloadingAll}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-accent hover:bg-violet-accent/90 text-white flex items-center gap-1.5 shadow transition disabled:opacity-50"
              >
                <span>⬇️</span>
                <span>{isDownloadingAll ? 'Baixando todos...' : 'Baixar Todos os Capítulos'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Lista de Capítulos */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loadingChapters ? (
            <div className="py-12 text-center text-graphite-400">
              <div className="w-8 h-8 border-2 border-violet-accent border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <span>Carregando capítulos da fonte remota...</span>
            </div>
          ) : error ? (
            <div className="glass-card rounded-xl p-6 text-center border-amber-500/30">
              <span className="text-3xl mb-2 block">⚠️</span>
              <p className="text-sm font-semibold text-amber-300 mb-1">Não foi possível carregar os capítulos</p>
              <p className="text-xs text-graphite-400 mb-3">{error}</p>
              <p className="text-[11px] text-graphite-500">
                Se a fonte estiver sob proteção Cloudflare WAF, selecione outra fonte autorizada (ex: MangaDex) no menu superior.
              </p>
            </div>
          ) : chapters.length === 0 ? (
            <div className="py-12 text-center text-graphite-400">
              Nenhum capítulo disponível nesta fonte.
            </div>
          ) : (
            chapters.map((ch) => {
              const state = downloadStates.get(ch.id) || 'online';
              const progress = activeProgress.get(ch.id);

              return (
                <div
                  key={ch.id}
                  className="p-3 rounded-xl bg-graphite-850/60 border border-graphite-800/80 hover:border-graphite-700 transition flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-graphite-100 truncate">
                          {ch.title}
                        </span>
                        {state === 'downloaded' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            ✓ Baixado
                          </span>
                        )}
                        {state === 'incomplete' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            Falha
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-graphite-400 mt-0.5 flex gap-2">
                        {ch.scanlator && <span>Scan: {ch.scanlator}</span>}
                        {ch.releaseDate && (
                          <span>{new Date(ch.releaseDate).toLocaleDateString('pt-BR')}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {state === 'downloaded' ? (
                        <>
                          <button
                            onClick={() => {
                              onClose();
                              onOpenReader(manga.id, ch.id);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow transition"
                          >
                            <span>▶</span>
                            <span>Ler Offline</span>
                          </button>
                          <button
                            onClick={() => handleDeleteDownload(ch.id)}
                            title="Excluir download e liberar espaço (mantém histórico/progresso)"
                            className="p-1.5 rounded-lg text-graphite-400 hover:text-rose-400 hover:bg-graphite-800 transition"
                          >
                            🗑️
                          </button>
                        </>
                      ) : state === 'downloading' ? (
                        <button
                          onClick={() => cancelOnlineDownload(ch.id)}
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

                  {/* Barra de Progresso do Download */}
                  {progress && (
                    <div className="w-full pt-1 border-t border-graphite-800">
                      <div className="flex justify-between items-center text-[10px] text-graphite-300 mb-1">
                        <span>
                          {progress.stage === 'fetching_pages' && '🔍 Mapeando páginas...'}
                          {progress.stage === 'downloading_images' && `⬇️ Baixando página ${progress.currentImage}/${progress.totalImages}...`}
                          {progress.stage === 'validating' && '🔒 Validando integridade das imagens...'}
                          {progress.stage === 'saving' && '💾 Instalando na biblioteca offline...'}
                          {progress.stage === 'failed' && `❌ ${progress.error || 'Falha no download'}`}
                        </span>
                        <span className="font-mono font-bold text-violet-light">{progress.percent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-graphite-900 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-150 ${progress.stage === 'failed' ? 'bg-rose-500' : 'bg-gradient-to-r from-violet-accent to-emerald-400'}`}
                          style={{ width: `${Math.max(2, progress.percent)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-graphite-900 border-t border-graphite-800 text-[11px] text-graphite-400 flex items-center justify-between">
          <span>🛡️ Download com validação atômica e leitura 100% offline</span>
          <button onClick={onClose} className="text-violet-light hover:underline font-medium">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
