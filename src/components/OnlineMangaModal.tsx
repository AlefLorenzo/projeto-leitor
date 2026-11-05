import { useState, useEffect, useMemo } from 'react';
import { SourceManga, SourceChapter, ChapterDownloadState } from '../services/sources/types';
import { naturalChapterSort } from '../services/sources/MangaDexAdapter';
import { onlineSourceManager } from '../services/sources/OnlineSourceManager';
import {
  downloadOnlineChapter,
  downloadOnlineBatch,
  cancelOnlineDownload,
  cancelAllOnlineDownloads,
  getChapterDownloadState,
  deleteChapterDownloadOnly,
  estimateBatchSize,
  ChapterDownloadProgress,
  BatchDownloadProgress,
} from '../services/sources/onlineDownloader';
import { getManga, saveManga } from '../services/database';
import { downloadManager } from '../services/downloadManager';
import { NativeImage } from './NativeImage';

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
  const [error, setError] = useState<string | null>(null);

  // Estados de download por capítulo
  const [downloadStates, setDownloadStates] = useState<Map<string, ChapterDownloadState>>(new Map());
  const [activeProgress, setActiveProgress] = useState<Map<string, ChapterDownloadProgress>>(new Map());

  // Download em Lote
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchDownloadProgress | null>(null);

  // Seleção de capítulos
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());
  const [showRangeSelector, setShowRangeSelector] = useState(false);
  const [rangeStart, setRangeStart] = useState<string>('1');
  const [rangeEnd, setRangeEnd] = useState<string>('10');

  // Filtros e Ordenação na Lista de Capítulos
  const [selectedScanlator, setSelectedScanlator] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchChapter, setSearchChapter] = useState('');

  // UI
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);
  const [showAltTitles, setShowAltTitles] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [preferDataSaver, setPreferDataSaver] = useState(false);

  // 1. Carregar detalhes completos e lista de capítulos ao abrir
  useEffect(() => {
    if (isOpen && manga) {
      setError(null);
      setLoadingChapters(true);
      setSelectedChapterIds(new Set());
      setIsBatchDownloading(false);
      setBatchProgress(null);

      // Checar se já é favorito na biblioteca local
      getManga(manga.id).then((local) => {
        setIsFavorite(Boolean(local?.isFavorite));
      });

      const adapter = onlineSourceManager.getSource(manga.sourceId) || onlineSourceManager.getActiveSource();

      adapter
        .getChapterList(manga.id)
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

  // Sincroniza com a fila persistente do downloadManager em segundo plano
  useEffect(() => {
    if (!isOpen || !manga) return;
    const finalMangaId = manga.id.startsWith('online-') ? manga.id : `online-${manga.id}`;

    const syncWithQueue = () => {
      const queue = downloadManager.getQueue();
      const mangaTasks = queue.filter(t => t.mangaId === finalMangaId);

      setActiveProgress((prev) => {
        const copy = new Map(prev);
        for (const t of mangaTasks) {
          const prefix = `ch-${manga.id}-`;
          const sourceChId = t.chapterId.startsWith(prefix) ? t.chapterId.slice(prefix.length) : t.chapterId;

          if (t.status === 'downloading' || t.status === 'waiting') {
            copy.set(sourceChId, {
              chapterId: sourceChId,
              mangaId: manga.id,
              chapterNumber: t.chapterNumber || 0,
              stage: t.status === 'downloading' ? 'downloading_images' : 'fetching_pages',
              currentImage: t.downloadedFiles || 0,
              totalImages: t.totalFiles || 0,
              percent: t.progress || 0,
              bytesDownloaded: t.downloadedSize || 0,
            });
          } else if (t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled') {
            copy.delete(sourceChId);
          }
        }
        return copy;
      });

      setDownloadStates((prev) => {
        const copy = new Map(prev);
        for (const t of mangaTasks) {
          const prefix = `ch-${manga.id}-`;
          const sourceChId = t.chapterId.startsWith(prefix) ? t.chapterId.slice(prefix.length) : t.chapterId;
          if (t.status === 'downloading' || t.status === 'waiting') {
            copy.set(sourceChId, 'downloading');
          } else if (t.status === 'completed') {
            copy.set(sourceChId, 'downloaded');
          }
        }
        return copy;
      });
    };

    syncWithQueue();
    const unsub = downloadManager.subscribe(() => {
      syncWithQueue();
    });
    return () => unsub();
  }, [isOpen, manga]);

  // Lista única de Scanlators (grupos de tradução) disponíveis para esta obra
  const scanlatorGroups = useMemo(() => {
    const set = new Set<string>();
    chapters.forEach((c) => {
      if (c.scanlator) set.add(c.scanlator);
    });
    return Array.from(set).sort();
  }, [chapters]);

  // Capítulos filtrados e ordenados
  const filteredChapters = useMemo(() => {
    let result = [...chapters];

    // Filtro por grupo
    if (selectedScanlator !== 'all') {
      result = result.filter((c) => c.scanlator === selectedScanlator);
    }

    // Busca rápida por número ou título
    if (searchChapter.trim()) {
      const q = searchChapter.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.chapterStr?.toLowerCase().includes(q) ||
          String(c.number).includes(q)
      );
    }

    // Ordenação natural
    result.sort((a, b) => naturalChapterSort(a, b, sortOrder));
    return result;
  }, [chapters, selectedScanlator, searchChapter, sortOrder]);

  if (!isOpen || !manga) return null;

  // Toggle Favorito Local
  const handleToggleFavorite = async () => {
    const newFav = !isFavorite;
    setIsFavorite(newFav);

    let local = await getManga(manga.id);
    const now = Date.now();
    if (!local) {
      local = {
        id: manga.id,
        title: manga.title,
        synopsis: manga.synopsis,
        coverUrl: manga.coverUrl || manga.thumbnailUrl,
        genres: manga.genres,
        type: manga.type,
        readingDirection: manga.type === 'manhwa' ? 'vertical' : 'rtl',
        status: (manga.status as any) || 'reading',
        source: 'online',
        createdAt: now,
        updatedAt: now,
        isFavorite: newFav,
        totalChapters: chapters.length || manga.totalChapters || 1,
        totalPages: 0,
        storageSize: 0,
        catalogId: manga.id,
        catalogProvider: manga.sourceId,
        altTitles: manga.altTitles,
      };
    } else {
      local.isFavorite = newFav;
      local.updatedAt = now;
    }
    await saveManga(local);
  };

  // Download Individual desacoplado em segundo plano
  const handleDownloadSingle = async (chapter: SourceChapter) => {
    await downloadManager.enqueueOnlineChapter({
      manga,
      chapter,
      preferDataSaver,
    });
  };

  // Cancelar Download Individual
  const handleCancelSingle = async (chapterId: string) => {
    const finalMangaId = manga.id.startsWith('online-') ? manga.id : `online-${manga.id}`;
    const fullChapterId = `ch-${manga.id}-${chapterId}`;
    const queue = downloadManager.getQueue();
    const task = queue.find(t => t.mangaId === finalMangaId && t.chapterId === fullChapterId);
    if (task) {
      await downloadManager.cancelTask(task.id);
    } else {
      cancelOnlineDownload(chapterId);
    }
    setActiveProgress((prev) => {
      const copy = new Map(prev);
      copy.delete(chapterId);
      return copy;
    });
  };

  // Download de Lote em segundo plano
  const handleDownloadBatch = async (chaptersToDownload: SourceChapter[]) => {
    if (chaptersToDownload.length === 0) return;
    await downloadManager.enqueueOnlineBatch(manga, chaptersToDownload, preferDataSaver);
    setSelectedChapterIds(new Set());
  };

  // Cancelar Lote Inteiro
  const handleCancelBatch = () => {
    cancelAllOnlineDownloads();
    setIsBatchDownloading(false);
    setActiveProgress(new Map());
  };

  // Seleção de Intervalo
  const handleApplyRange = () => {
    const start = parseFloat(rangeStart);
    const end = parseFloat(rangeEnd);
    if (isNaN(start) || isNaN(end)) return;

    const min = Math.min(start, end);
    const max = Math.max(start, end);

    const newSelected = new Set(selectedChapterIds);
    chapters.forEach((c) => {
      if (c.number >= min && c.number <= max && downloadStates.get(c.id) !== 'downloaded') {
        newSelected.add(c.id);
      }
    });

    setSelectedChapterIds(newSelected);
    setShowRangeSelector(false);
  };

  // Excluir Download Local (preserva progresso e favoritos!)
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

  // Contadores
  const downloadedCount = Array.from(downloadStates.values()).filter((s) => s === 'downloaded').length;
  const pendingChapters = chapters.filter((c) => downloadStates.get(c.id) !== 'downloaded');
  const selectedCount = selectedChapterIds.size;
  const selectedChaptersList = chapters.filter((c) => selectedChapterIds.has(c.id));
  const estimatedMb = (estimateBatchSize(selectedCount > 0 ? selectedChaptersList : pendingChapters) / (1024 * 1024)).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="glass-card rounded-2xl w-full max-w-4xl max-h-[96vh] sm:max-h-[94vh] flex flex-col overflow-hidden border border-graphite-700/60 shadow-2xl bg-graphite-950/90 text-graphite-100">
        {/* HEADER MODAL */}
        <div className="p-3 sm:p-6 border-b border-graphite-700/40 relative flex gap-3 sm:gap-5 items-start bg-graphite-900/40">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-graphite-400 hover:text-white p-1.5 rounded-xl hover:bg-graphite-800 transition z-10 text-lg"
            title="Fechar"
          >
            ✕
          </button>

          {/* Capa */}
          <div className="w-20 sm:w-36 aspect-[2/3] rounded-xl sm:rounded-2xl overflow-hidden bg-graphite-900 flex-shrink-0 border border-graphite-700 shadow-xl relative group">
            {manga.coverUrl || manga.thumbnailUrl ? (
              <NativeImage
                src={manga.coverUrl || manga.thumbnailUrl}
                fallbackSrc={manga.thumbnailUrl}
                alt={manga.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl sm:text-4xl opacity-30">
                📖
              </div>
            )}
            <div className="absolute top-1.5 left-1.5 px-1 py-0.5 rounded bg-black/75 backdrop-blur-md text-[8px] sm:text-[9px] font-bold text-white uppercase">
              {manga.type}
            </div>
          </div>

          {/* Informações da Obra */}
          <div className="flex-1 pr-8">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-violet-accent/20 text-violet-light border border-violet-accent/40">
                {manga.type}
              </span>

              {manga.status === 'completed' ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  ✓ Concluído
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ⚡ Em andamento
                </span>
              )}

              {manga.originalLanguage && (
                <span className="text-[10px] text-graphite-400 font-mono">
                  Origem: {manga.originalLanguage.toUpperCase()}
                </span>
              )}

              {manga.year && (
                <span className="text-[10px] text-graphite-400 font-mono">
                  • {manga.year}
                </span>
              )}
            </div>

            <h2 className="text-lg sm:text-2xl font-black text-white leading-tight mb-1 break-words">
              {manga.title}
            </h2>

            {/* Títulos Alternativos */}
            {manga.altTitles && manga.altTitles.length > 0 && (
              <div className="mb-2">
                <button
                  onClick={() => setShowAltTitles(!showAltTitles)}
                  className="text-[11px] text-graphite-400 hover:text-violet-light transition flex items-center gap-1"
                >
                  <span>{showAltTitles ? '▲ Ocultar títulos alternativos' : `▼ +${manga.altTitles.length} títulos alternativos`}</span>
                </button>
                {showAltTitles && (
                  <p className="text-[11px] text-graphite-400 mt-1 italic leading-relaxed line-clamp-3">
                    {manga.altTitles.join(' • ')}
                  </p>
                )}
              </div>
            )}

            {/* Autores & Artistas */}
            <p className="text-xs text-graphite-300 mb-2 font-medium">
              {manga.author && <span>Autor: <b className="text-white">{manga.author}</b></span>}
              {manga.artist && manga.artist !== manga.author && (
                <span className="ml-2">• Artista: <b className="text-white">{manga.artist}</b></span>
              )}
            </p>

            {/* Gêneros */}
            <div className="flex flex-wrap gap-1 mb-2.5">
              {manga.genres.map((g) => (
                <span
                  key={g}
                  className="px-2 py-0.5 rounded-md bg-graphite-800 text-[10px] text-graphite-300 border border-graphite-700/50"
                >
                  {g}
                </span>
              ))}
            </div>

            {/* Sinopse com Ver Mais */}
            {manga.synopsis && (
              <div className="relative mb-3">
                <p className={`text-xs text-graphite-300 leading-relaxed ${showFullSynopsis ? '' : 'line-clamp-2'}`}>
                  {manga.synopsis}
                </p>
                {manga.synopsis.length > 150 && (
                  <button
                    onClick={() => setShowFullSynopsis(!showFullSynopsis)}
                    className="text-[11px] text-violet-light font-semibold hover:underline mt-0.5 block"
                  >
                    {showFullSynopsis ? 'Ler menos' : 'Ler sinopse completa...'}
                  </button>
                )}
              </div>
            )}

            {/* Ações do Header (Favoritar + Economia de Dados) */}
            <div className="flex items-center gap-3 flex-wrap pt-1">
              <button
                onClick={handleToggleFavorite}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                  isFavorite
                    ? 'bg-rose-600 text-white shadow-rose-600/30'
                    : 'bg-graphite-800 text-graphite-300 hover:text-white hover:bg-graphite-700 border border-graphite-700'
                }`}
              >
                <span>{isFavorite ? '❤️' : '🤍'}</span>
                <span>{isFavorite ? 'Favorito na Biblioteca' : 'Favoritar Obra'}</span>
              </button>

              <label className="flex items-center gap-1.5 text-xs text-graphite-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={preferDataSaver}
                  onChange={(e) => setPreferDataSaver(e.target.checked)}
                  className="rounded bg-graphite-800 border-graphite-700 text-violet-accent focus:ring-0 w-3.5 h-3.5"
                />
                <span>Economia de dados (Data-Saver)</span>
              </label>
            </div>
          </div>
        </div>

        {/* BARRA DE PROGRESSO DO LOTE ATIVO */}
        {isBatchDownloading && batchProgress && (
          <div className="bg-graphite-900 border-b border-violet-accent/40 px-3 sm:px-4 py-2.5 sm:py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4 animate-slideDown">
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold text-violet-light">
                  ⬇️ Baixando lote: Capítulo {batchProgress.activeChapterNumber || '...'} ({batchProgress.completedChapters}/{batchProgress.totalChapters})
                </span>
                <span className="font-mono text-white">{batchProgress.overallPercent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-graphite-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-accent to-violet-light transition-all duration-300"
                  style={{ width: `${batchProgress.overallPercent}%` }}
                />
              </div>
            </div>
            <button
              onClick={handleCancelBatch}
              className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition flex-shrink-0"
            >
              Cancelar Lote
            </button>
          </div>
        )}

        {/* BARRA DE CONTROLE DE CAPÍTULOS E DOWNLOAD SELETIVO */}
        <div className="p-3 sm:px-6 bg-graphite-900/60 border-b border-graphite-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 text-xs">
          {/* Estatística de Capítulos */}
          <div className="flex items-center gap-3">
            <span className="text-graphite-300 font-semibold">
              Capítulos em Português: <b>{chapters.length}</b>
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
              ✓ {downloadedCount} disponíveis offline
            </span>
          </div>

          {/* Ações em Lote */}
          <div className="flex items-center gap-2 flex-wrap">
            {selectedCount > 0 ? (
              <button
                onClick={() => handleDownloadBatch(selectedChaptersList)}
                disabled={isBatchDownloading}
                className="px-3.5 py-1.5 bg-violet-accent hover:bg-violet-accent/90 text-white rounded-lg font-bold shadow transition flex items-center gap-1.5"
              >
                <span>⬇️</span>
                <span>Baixar {selectedCount} Selecionados (~{estimatedMb} MB)</span>
              </button>
            ) : (
              <button
                onClick={() => handleDownloadBatch(pendingChapters)}
                disabled={isBatchDownloading || pendingChapters.length === 0}
                className="px-3 py-1.5 bg-graphite-800 hover:bg-graphite-700 text-graphite-200 hover:text-white rounded-lg font-semibold border border-graphite-700 transition flex items-center gap-1.5 disabled:opacity-40"
              >
                <span>📦</span>
                <span>Baixar Todos os Pendentes ({pendingChapters.length})</span>
              </button>
            )}

            <button
              onClick={() => setShowRangeSelector(!showRangeSelector)}
              className="px-2.5 py-1.5 bg-graphite-800 text-graphite-300 hover:text-white rounded-lg border border-graphite-700 transition"
              title="Selecionar por intervalo de números"
            >
              Intervalo ▾
            </button>
          </div>
        </div>

        {/* Seletor de Intervalo Expansível */}
        {showRangeSelector && (
          <div className="px-3 sm:px-6 py-2.5 bg-graphite-900 border-b border-graphite-800 flex flex-wrap items-center gap-2 sm:gap-3 text-xs animate-slideDown">
            <span className="text-graphite-300 font-semibold">Selecionar capítulos do:</span>
            <input
              type="number"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              className="w-16 px-2 py-1 bg-graphite-800 border border-graphite-700 rounded text-center text-white"
            />
            <span className="text-graphite-400">até o:</span>
            <input
              type="number"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              className="w-16 px-2 py-1 bg-graphite-800 border border-graphite-700 rounded text-center text-white"
            />
            <button
              onClick={handleApplyRange}
              className="px-3 py-1 bg-violet-accent text-white rounded font-bold hover:bg-violet-dark transition"
            >
              Aplicar Seleção
            </button>
            <button
              onClick={() => setShowRangeSelector(false)}
              className="text-graphite-400 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* FILTROS E BUSCA DE CAPÍTULOS */}
        <div className="px-4 sm:px-6 py-2.5 bg-graphite-950/60 border-b border-graphite-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Busca por capítulo */}
          <div className="relative flex-1 min-w-[140px] max-w-xs">
            <input
              type="text"
              value={searchChapter}
              onChange={(e) => setSearchChapter(e.target.value)}
              placeholder="Filtrar capítulo (ex: 1, 5.5, final)..."
              className="w-full pl-7 pr-2 py-1 bg-graphite-900 border border-graphite-700/60 rounded-lg text-graphite-200 placeholder:text-graphite-500 focus:outline-none focus:border-violet-accent text-xs"
            />
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-graphite-500 text-xs">🔍</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Filtro por Grupo de Tradução */}
            {scanlatorGroups.length > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-graphite-400">Grupo:</span>
                <select
                  value={selectedScanlator}
                  onChange={(e) => setSelectedScanlator(e.target.value)}
                  className="bg-graphite-900 border border-graphite-700/60 rounded-lg px-2 py-1 text-xs text-graphite-200 focus:outline-none focus:border-violet-accent"
                >
                  <option value="all">Todos os grupos ({scanlatorGroups.length})</option>
                  {scanlatorGroups.map((grp) => (
                    <option key={grp} value={grp}>
                      {grp}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Alternador de Ordem Crescente / Decrescente */}
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-2.5 py-1 rounded-lg bg-graphite-900 hover:bg-graphite-800 border border-graphite-700/60 text-graphite-300 hover:text-white flex items-center gap-1 font-mono transition"
            >
              <span>{sortOrder === 'asc' ? '▲ 1 → N' : '▼ N → 1'}</span>
            </button>
          </div>
        </div>

        {/* LISTA DE CAPÍTULOS */}
        <div className="flex-1 overflow-y-auto p-4 sm:px-6 space-y-2 divide-y divide-graphite-800/40">
          {loadingChapters ? (
            <div className="py-20 text-center text-graphite-400">
              <div className="w-9 h-9 border-2 border-violet-accent border-t-transparent rounded-full animate-spin mx-auto mb-2.5"></div>
              <p className="text-sm font-semibold">Carregando lista de capítulos oficiais...</p>
              <p className="text-xs text-graphite-500 mt-0.5">Identificando grupos de tradução e páginas</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <span className="text-3xl block mb-2">⚠️</span>
              <p className="text-sm text-red-400 font-semibold mb-2">{error}</p>
              <button
                onClick={() => {
                  setLoadingChapters(true);
                  const adapter = onlineSourceManager.getSource(manga.sourceId) || onlineSourceManager.getActiveSource();
                  adapter.getChapterList(manga.id).then(setChapters).finally(() => setLoadingChapters(false));
                }}
                className="px-3 py-1.5 bg-graphite-800 text-violet-light rounded text-xs font-semibold"
              >
                Tentar novamente
              </button>
            </div>
          ) : filteredChapters.length === 0 ? (
            <div className="py-14 text-center text-graphite-400">
              <span className="text-3xl block mb-2">📭</span>
              <p className="text-sm font-semibold text-graphite-300">Nenhum capítulo encontrado</p>
              <p className="text-xs text-graphite-500 mt-1">
                Tente desativar o filtro de grupo ou buscar por outro termo.
              </p>
            </div>
          ) : (
            filteredChapters.map((ch) => {
              const state = downloadStates.get(ch.id) || 'online';
              const progress = activeProgress.get(ch.id);
              const isSelected = selectedChapterIds.has(ch.id);

              return (
                <div
                  key={ch.id}
                  className={`pt-2.5 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl px-2 transition-colors ${
                    isSelected ? 'bg-violet-accent/10 border border-violet-accent/30' : 'hover:bg-graphite-900/40'
                  }`}
                >
                  {/* Lado Esquerdo: Checkbox + Título + Metadados */}
                  <div className="flex items-start gap-3">
                    {state !== 'downloaded' && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const copy = new Set(selectedChapterIds);
                          if (e.target.checked) copy.add(ch.id);
                          else copy.delete(ch.id);
                          setSelectedChapterIds(copy);
                        }}
                        className="mt-1 rounded bg-graphite-800 border-graphite-700 text-violet-accent focus:ring-0 w-4 h-4 cursor-pointer"
                      />
                    )}

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white hover:text-violet-light transition">
                          {ch.title}
                        </span>

                        {ch.volume && (
                          <span className="text-[10px] text-graphite-400 bg-graphite-800 px-1.5 py-0.5 rounded font-mono">
                            Vol. {ch.volume}
                          </span>
                        )}

                        {/* Status Badge */}
                        {state === 'downloaded' && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1">
                            ✓ Disponível Offline
                          </span>
                        )}

                        {state === 'downloading' && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold animate-pulse">
                            Baixando {progress ? `${progress.percent}%` : ''}
                          </span>
                        )}
                      </div>

                      {/* Scanlator & Data */}
                      <p className="text-[11px] text-graphite-400 mt-0.5 flex items-center gap-2">
                        {ch.scanlator && (
                          <span>Grupo: <b className="text-graphite-200">{ch.scanlator}</b></span>
                        )}
                        {ch.releaseDate && (
                          <span>• {new Date(ch.releaseDate).toLocaleDateString('pt-BR')}</span>
                        )}
                        {ch.pageCountEstimate ? (
                          <span>• ~{ch.pageCountEstimate} páginas</span>
                        ) : null}
                      </p>

                      {/* Barra de Progresso Ativa deste capítulo */}
                      {state === 'downloading' && progress && (
                        <div className="mt-2 w-full max-w-xs">
                          <div className="flex justify-between text-[10px] text-graphite-400 mb-0.5 font-mono">
                            <span>
                              {progress.stage === 'downloading_images'
                                ? `Baixando página ${progress.currentImage}/${progress.totalImages}`
                                : progress.stage === 'validating'
                                ? 'Validando integridade...'
                                : 'Gravando no disco...'}
                            </span>
                            <span>{progress.percent}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-graphite-800 overflow-hidden">
                            <div
                              className="h-full bg-violet-accent transition-all duration-200"
                              style={{ width: `${progress.percent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Lado Direito: Ações */}
                  <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                    {state === 'downloaded' ? (
                      <>
                        <button
                          onClick={() => onOpenReader(manga.id, ch.id)}
                          className="px-3 py-1.5 bg-violet-accent hover:bg-violet-dark text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1"
                        >
                          <span>📖</span>
                          <span>Ler Agora</span>
                        </button>

                        <button
                          onClick={() => handleDeleteDownload(ch.id)}
                          className="p-1.5 text-graphite-400 hover:text-red-400 rounded-lg hover:bg-graphite-800 transition text-xs"
                          title="Excluir download local (preserva histórico e progresso)"
                        >
                          🗑️
                        </button>
                      </>
                    ) : state === 'downloading' ? (
                      <button
                        onClick={() => handleCancelSingle(ch.id)}
                        className="px-3 py-1 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition"
                      >
                        Cancelar
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDownloadSingle(ch)}
                        className="px-3 py-1.5 bg-graphite-800 hover:bg-violet-accent text-graphite-200 hover:text-white rounded-lg text-xs font-semibold border border-graphite-700 transition flex items-center gap-1.5 shadow-sm"
                      >
                        <span>⬇️</span>
                        <span>Baixar</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER MODAL */}
        <div className="p-3.5 sm:px-6 bg-graphite-900 border-t border-graphite-800 flex items-center justify-between text-xs text-graphite-400">
          <span className="truncate flex-1 min-w-0 mr-2">{manga.title} • Fonte: <b>MangaDex API Oficial</b></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-graphite-800 hover:bg-graphite-700 text-white rounded-lg font-semibold transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
