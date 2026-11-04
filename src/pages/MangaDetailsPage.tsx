import { useState, useEffect } from 'react';
import { useMangaDetails } from '../hooks/useMangaStore';
import { getMangaTypeLabel, getReadingDirectionLabel, formatFileSize } from '../services/import';
import {
  getChaptersWithStatus,
  getContinueReadingInfo,
  markChapterAsCompleted,
  markChapterAsUnread,
  markAllChaptersAsCompleted,
  markAllChaptersAsUnread,
} from '../services/readingProgress';
import { ReadingStatus, Manga, Chapter, ChapterReadStatus, ReadingProgress } from '../types';
import { deleteManga, saveManga, getManga } from '../services/database';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';

interface MangaDetailsPageProps {
  mangaId: string;
  onBack: () => void;
  onRead: (chapterId: string) => void;
  onRefresh: () => void;
  onManageFiles?: (mangaId: string) => void;
}

export default function MangaDetailsPage({ mangaId, onBack, onRead, onRefresh, onManageFiles }: MangaDetailsPageProps) {
  const { addToast } = useToast();
  const { manga, chapters, progress, loading, reload } = useMangaDetails(mangaId);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMarkAllReadConfirm, setShowMarkAllReadConfirm] = useState(false);
  const [showResetAllUnreadConfirm, setShowResetAllUnreadConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState<Partial<Manga>>({});
  const [chaptersWithStatus, setChaptersWithStatus] = useState<(Chapter & { readStatus: ChapterReadStatus })[]>([]);
  const [continueInfo, setContinueInfo] = useState<{ chapter: Chapter | null; progress: ReadingProgress | null } | null>(null);
  const [chapterFilter, setChapterFilter] = useState<'all' | 'unread' | 'reading' | 'completed' | 'downloaded' | 'not_downloaded'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const loadExtra = async () => {
    if (!mangaId) return;
    const [chStatus, contInfo] = await Promise.all([
      getChaptersWithStatus(mangaId),
      getContinueReadingInfo(mangaId),
    ]);
    setChaptersWithStatus(chStatus);
    setContinueInfo(contInfo);
  };

  useEffect(() => {
    loadExtra();
  }, [mangaId, chapters]);

  // Recarrega quando o usuário retorna do leitor
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && mangaId) {
        loadExtra();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [mangaId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-violet-accent animate-pulse">Carregando...</div>
      </div>
    );
  }

  if (!manga) {
    return (
      <div className="glass-card rounded-xl p-12 text-center">
        <span className="text-4xl mb-4 block">❌</span>
        <h3 className="text-lg font-semibold text-graphite-200 mb-2">Obra não encontrada</h3>
        <button onClick={onBack} className="text-sm text-violet-light hover:underline">Voltar à biblioteca</button>
      </div>
    );
  }

  const handleDelete = async () => {
    await deleteManga(manga.id);
    addToast('Obra excluída com sucesso', 'success');
    onRefresh();
    onBack();
  };

  const handleStatusChange = async (status: ReadingStatus) => {
    const updated = await getManga(manga.id);
    if (updated) {
      updated.status = status;
      updated.updatedAt = Date.now();
      await saveManga(updated);
      reload();
      onRefresh();
      addToast(`Status alterado para "${statusLabels[status]}"`, 'success');
    }
  };

  const handleToggleFavorite = async () => {
    const updated = await getManga(manga.id);
    if (updated) {
      updated.isFavorite = !updated.isFavorite;
      updated.updatedAt = Date.now();
      await saveManga(updated);
      reload();
      onRefresh();
      addToast(updated.isFavorite ? 'Adicionado aos favoritos' : 'Removido dos favoritos', 'success');
    }
  };

  const handleSaveEdit = async () => {
    const updated = await getManga(manga.id);
    if (updated) {
      Object.assign(updated, editData);
      updated.updatedAt = Date.now();
      await saveManga(updated);
      setShowEditModal(false);
      reload();
      onRefresh();
      addToast('Informações atualizadas', 'success');
    }
  };

  const handleContinueReading = () => {
    if (continueInfo?.chapter) {
      onRead(continueInfo.chapter.id);
    } else if (chapters.length > 0) {
      onRead(chapters[0].id);
    }
  };

  const handleToggleChapterStatus = async (e: React.MouseEvent, chapter: Chapter & { readStatus: ChapterReadStatus }) => {
    e.stopPropagation();
    if (chapter.readStatus === 'completed') {
      await markChapterAsUnread(chapter.id);
      addToast(`Capítulo marcado como não lido`, 'info');
    } else {
      await markChapterAsCompleted(chapter.id);
      addToast(`Capítulo marcado como concluído`, 'success');
    }
    await loadExtra();
  };

  const handleMarkAllRead = async () => {
    await markAllChaptersAsCompleted(manga.id);
    setShowMarkAllReadConfirm(false);
    addToast('Todos os capítulos foram marcados como concluídos', 'success');
    await loadExtra();
  };

  const handleResetAllUnread = async () => {
    await markAllChaptersAsUnread(manga.id);
    setShowResetAllUnreadConfirm(false);
    addToast('Todos os capítulos foram redefinidos para não lidos', 'info');
    await loadExtra();
  };

  const statusLabels: Record<ReadingStatus, string> = {
    reading: '📖 Lendo',
    want_to_read: '📋 Quero ler',
    completed: '✅ Concluído',
    paused: '⏸️ Pausado',
    dropped: '❌ Abandonado',
  };

  const readStatusIcons: Record<ChapterReadStatus, string> = {
    not_started: '○',
    in_progress: '📖',
    completed: '✅',
  };

  const readStatusLabels: Record<ChapterReadStatus, string> = {
    not_started: 'Não lido',
    in_progress: 'Em andamento',
    completed: 'Concluído',
  };

  const readStatusColors: Record<ChapterReadStatus, string> = {
    not_started: 'text-graphite-500',
    in_progress: 'text-amber-400',
    completed: 'text-emerald-400',
  };

  // Contabilização de capítulos (Soma Exata: Total = Não lidos + Em andamento + Concluídos)
  const totalCount = chaptersWithStatus.length;
  const completedCount = chaptersWithStatus.filter(ch => ch.readStatus === 'completed').length;
  const inProgressCount = chaptersWithStatus.filter(ch => ch.readStatus === 'in_progress').length;
  const unreadCount = chaptersWithStatus.filter(ch => ch.readStatus === 'not_started').length;
  const downloadedCount = chaptersWithStatus.filter(ch => ch.isDownloaded).length;
  const readingPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Filtragem e ordenação dos capítulos
  const filteredChapters = chaptersWithStatus
    .filter(ch => {
      if (chapterFilter === 'all') return true;
      if (chapterFilter === 'unread') return ch.readStatus === 'not_started';
      if (chapterFilter === 'reading') return ch.readStatus === 'in_progress';
      if (chapterFilter === 'completed') return ch.readStatus === 'completed';
      if (chapterFilter === 'downloaded') return ch.isDownloaded;
      if (chapterFilter === 'not_downloaded') return !ch.isDownloaded;
      return true;
    })
    .sort((a, b) => {
      return sortOrder === 'asc' ? a.number - b.number : b.number - a.number;
    });

  return (
    <div className="slide-up">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-graphite-400 hover:text-graphite-200 mb-4 transition">
        ← Voltar à biblioteca
      </button>

      {/* Header with cover */}
      <div className="glass-card rounded-xl overflow-hidden mb-6">
        <div className="flex flex-col md:flex-row gap-4 sm:gap-6 p-4 sm:p-6">
          {/* Cover */}
          <div className="w-36 h-52 sm:w-40 sm:h-56 rounded-lg overflow-hidden bg-graphite-800 flex-shrink-0 cover-shadow mx-auto md:mx-0 relative group">
            {manga.coverUrl ? (
              <img src={manga.coverUrl} alt={manga.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-violet-accent/20 to-graphite-800 flex items-center justify-center">
                <span className="text-4xl opacity-50">📕</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-graphite-100 mb-1 break-words">{manga.title}</h1>
                {manga.author && <p className="text-sm text-graphite-400">por {manga.author}</p>}
              </div>
              <button
                onClick={handleToggleFavorite}
                className="text-2xl hover:scale-110 transition-transform flex-shrink-0"
                title={manga.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              >
                {manga.isFavorite ? '⭐' : '☆'}
              </button>
            </div>
            
            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="text-xs px-2 py-0.5 rounded bg-violet-accent/10 text-violet-light">{getMangaTypeLabel(manga.type)}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-graphite-700/50 text-graphite-300">{getReadingDirectionLabel(manga.readingDirection)}</span>
              {manga.genres.map((g, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded bg-graphite-700/30 text-graphite-400">{g}</span>
              ))}
            </div>

            {/* 3.4 Painel de Progresso da Obra */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3">
              <div className="bg-graphite-800/40 rounded-lg p-2.5 text-center">
                <p className="text-base sm:text-lg font-bold text-graphite-100 truncate">{totalCount}</p>
                <p className="text-[10px] text-graphite-500">📚 Total de Capítulos</p>
              </div>
              <div className="bg-graphite-800/40 rounded-lg p-2.5 text-center">
                <p className="text-base sm:text-lg font-bold text-graphite-400 truncate">{unreadCount}</p>
                <p className="text-[10px] text-graphite-500">🔵 Não lidos</p>
              </div>
              <div className="bg-graphite-800/40 rounded-lg p-2.5 text-center">
                <p className="text-base sm:text-lg font-bold text-amber-400 truncate">{inProgressCount}</p>
                <p className="text-[10px] text-graphite-500">🟡 Em andamento</p>
              </div>
              <div className="bg-graphite-800/40 rounded-lg p-2.5 text-center">
                <p className="text-base sm:text-lg font-bold text-emerald-400 truncate">{completedCount}</p>
                <p className="text-[10px] text-graphite-500">🟢 Concluídos</p>
              </div>
            </div>

            {/* Barra de Progresso Visual de Leitura */}
            <div className="mb-4 bg-graphite-850/60 rounded-lg p-2.5 border border-graphite-800">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-graphite-300 font-medium">📖 Progresso de Leitura</span>
                <span className="text-violet-light font-bold font-mono">{readingPercent}%</span>
              </div>
              <div className="w-full h-2 bg-graphite-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-accent to-emerald-400 transition-all duration-300"
                  style={{ width: `${readingPercent}%` }}
                />
              </div>
            </div>

            {/* Continue Reading Card */}
            {continueInfo?.chapter && (
              <button
                onClick={handleContinueReading}
                className="w-full mb-4 p-3 bg-violet-accent/10 border border-violet-accent/30 rounded-lg text-left hover:bg-violet-accent/20 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">▶️</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-violet-light font-medium">Continuar lendo de onde parou</p>
                    <p className="text-sm font-semibold text-graphite-200 truncate">{continueInfo.chapter.title}</p>
                    {continueInfo.progress && (
                      <p className="text-xs text-graphite-400">
                        Página {continueInfo.progress.pageNumber} de {continueInfo.progress.totalPages} • {continueInfo.progress.percentComplete}% concluído
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <select
                value={manga.status}
                onChange={(e) => handleStatusChange(e.target.value as ReadingStatus)}
                className="px-3 py-1.5 bg-graphite-800/60 border border-graphite-700/30 rounded-lg text-xs text-graphite-200 focus:outline-none"
              >
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <button
                onClick={() => { setEditData({ title: manga.title, author: manga.author, synopsis: manga.synopsis }); setShowEditModal(true); }}
                className="px-3 py-1.5 bg-graphite-800/60 border border-graphite-700/30 rounded-lg text-xs text-graphite-300 hover:border-violet-accent/30"
              >
                ✏️ Editar
              </button>
              {onManageFiles && (
                <button
                  onClick={() => onManageFiles(manga.id)}
                  className="px-3 py-1.5 bg-graphite-800/60 border border-graphite-700/30 rounded-lg text-xs text-graphite-300 hover:border-violet-accent/30"
                >
                  📁 Arquivos
                </button>
              )}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-1.5 bg-graphite-800/60 border border-error/20 rounded-lg text-xs text-error hover:bg-error/10"
              >
                🗑️ Excluir
              </button>
            </div>
          </div>
        </div>

        {/* Synopsis */}
        {manga.synopsis && (
          <div className="px-4 sm:px-6 pb-4">
            <p className="text-sm text-graphite-300 leading-relaxed">{manga.synopsis}</p>
          </div>
        )}
      </div>

      {/* 3.8 / 3.9 Chapters Section with Filters and Sort */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-semibold text-graphite-100">Índice de Capítulos</h2>
            <p className="text-xs text-graphite-400">
              {filteredChapters.length} de {totalCount} capítulos exibidos
            </p>
          </div>

          {/* 3.10 Ações em Lote */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="px-2.5 py-1 text-xs bg-graphite-800 text-graphite-300 hover:text-white rounded border border-graphite-700/40 transition"
              title="Alternar ordem crescente/decrescente"
            >
              {sortOrder === 'asc' ? '⬆️ 1 → N' : '⬇️ N → 1'}
            </button>
            {unreadCount > 0 && (
              <button
                onClick={() => setShowMarkAllReadConfirm(true)}
                className="px-2.5 py-1 text-xs bg-emerald-950/60 text-emerald-400 hover:bg-emerald-900/60 rounded border border-emerald-800/50 transition"
              >
                ✓ Marcar todos lidos
              </button>
            )}
            {completedCount > 0 && (
              <button
                onClick={() => setShowResetAllUnreadConfirm(true)}
                className="px-2.5 py-1 text-xs bg-graphite-800 text-graphite-400 hover:text-graphite-200 rounded border border-graphite-700/40 transition"
              >
                ↺ Redefinir para não lidos
              </button>
            )}
          </div>
        </div>

        {/* Filtros da Obra */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
          {[
            { id: 'all', label: `Todos (${totalCount})` },
            { id: 'unread', label: `Não lidos (${unreadCount})` },
            { id: 'reading', label: `Em andamento (${inProgressCount})` },
            { id: 'completed', label: `Concluídos (${completedCount})` },
            { id: 'downloaded', label: `💾 Baixados (${downloadedCount})` },
            { id: 'not_downloaded', label: `☁️ Não baixados (${totalCount - downloadedCount})` },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setChapterFilter(f.id as any)}
              className={`px-2.5 py-1 rounded text-xs whitespace-nowrap transition-all ${
                chapterFilter === f.id
                  ? 'bg-violet-accent/20 text-violet-light border border-violet-accent/40 font-medium'
                  : 'text-graphite-400 hover:text-graphite-200 bg-graphite-800/40 border border-transparent'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista de Capítulos */}
        {filteredChapters.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-3xl mb-2 block">📭</span>
            <p className="text-sm text-graphite-400">
              {chapters.length === 0 ? 'Nenhum capítulo importado nesta obra.' : 'Nenhum capítulo com este filtro.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredChapters.map((chapter) => {
              const isCurrentProgress = progress?.chapterId === chapter.id;
              const status = chapter.readStatus || 'not_started';

              return (
                <div
                  key={chapter.id}
                  onClick={() => onRead(chapter.id)}
                  className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl transition-all cursor-pointer text-left ${
                    isCurrentProgress
                      ? 'bg-violet-accent/10 border border-violet-accent/30'
                      : 'bg-graphite-800/30 hover:bg-graphite-800/50 border border-transparent'
                  }`}
                >
                  {/* Status Icon */}
                  <div className={`text-lg flex-shrink-0 ${readStatusColors[status]}`}>
                    {readStatusIcons[status]}
                  </div>

                  {/* Chapter Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-graphite-200 truncate">{chapter.title}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-graphite-500">{chapter.pagesCount} páginas</span>
                      <span className="text-[11px] text-graphite-600">•</span>
                      <span className={`text-[11px] font-semibold ${readStatusColors[status]}`}>
                        {readStatusLabels[status]}
                      </span>
                      <span className="text-[11px] text-graphite-600">•</span>
                      <span className={`text-[11px] ${chapter.isDownloaded ? 'text-emerald-400' : 'text-graphite-500'}`}>
                        {chapter.isDownloaded ? `💾 Offline (${formatFileSize(chapter.storageSize || 0)})` : '☁️ Nuvem'}
                      </span>
                    </div>
                  </div>

                  {/* Actions / Read Toggle */}
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleToggleChapterStatus(e, chapter)}
                      className={`px-2.5 py-1 text-xs rounded border transition ${
                        status === 'completed'
                          ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/40'
                          : 'border-graphite-700/50 bg-graphite-800/40 text-graphite-400 hover:text-white'
                      }`}
                      title={status === 'completed' ? 'Marcar como não lido' : 'Marcar como concluído'}
                    >
                      {status === 'completed' ? '✓ Lido' : 'Marcar lido'}
                    </button>
                    <button
                      onClick={() => onRead(chapter.id)}
                      className="w-7 h-7 rounded-lg bg-violet-accent/20 hover:bg-violet-accent text-violet-light hover:text-white flex items-center justify-center transition text-xs"
                      title="Abrir no leitor"
                    >
                      ▶
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Excluir obra?"
        message={`"${manga.title}" será removida permanentemente, incluindo todos os capítulos e páginas. Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        variant="danger"
        icon="🗑️"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Mark All Read Confirmation */}
      <ConfirmModal
        isOpen={showMarkAllReadConfirm}
        title="Marcar todos como lidos?"
        message={`Deseja marcar todos os ${totalCount} capítulos de "${manga.title}" como concluídos?`}
        confirmText="Marcar todos"
        variant="info"
        icon="✅"
        onConfirm={handleMarkAllRead}
        onCancel={() => setShowMarkAllReadConfirm(false)}
      />

      {/* Reset All Unread Confirmation */}
      <ConfirmModal
        isOpen={showResetAllUnreadConfirm}
        title="Redefinir para não lidos?"
        message={`Deseja redefinir o progresso de todos os capítulos de "${manga.title}" para não lidos?`}
        confirmText="Redefinir"
        variant="warning"
        icon="↺"
        onConfirm={handleResetAllUnread}
        onCancel={() => setShowResetAllUnreadConfirm(false)}
      />

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-graphite-100 mb-4">Editar Obra</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-graphite-400 mb-1 block">Título</label>
                <input
                  type="text"
                  value={editData.title || ''}
                  onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 bg-graphite-800/60 border border-graphite-700/30 rounded-lg text-sm text-graphite-200 focus:outline-none focus:border-violet-accent/50"
                />
              </div>
              <div>
                <label className="text-xs text-graphite-400 mb-1 block">Autor</label>
                <input
                  type="text"
                  value={editData.author || ''}
                  onChange={(e) => setEditData(prev => ({ ...prev, author: e.target.value }))}
                  className="w-full px-3 py-2 bg-graphite-800/60 border border-graphite-700/30 rounded-lg text-sm text-graphite-200 focus:outline-none focus:border-violet-accent/50"
                />
              </div>
              <div>
                <label className="text-xs text-graphite-400 mb-1 block">Sinopse</label>
                <textarea
                  value={editData.synopsis || ''}
                  onChange={(e) => setEditData(prev => ({ ...prev, synopsis: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-graphite-800/60 border border-graphite-700/30 rounded-lg text-sm text-graphite-200 focus:outline-none focus:border-violet-accent/50 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-sm text-graphite-400 hover:text-graphite-200">
                Cancelar
              </button>
              <button onClick={handleSaveEdit} className="px-4 py-2 bg-violet-accent hover:bg-violet-dark text-white rounded-lg text-sm font-medium">
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
