import { useState, useEffect } from 'react';
import { useMangaDetails } from '../hooks/useMangaStore';
import { getMangaTypeLabel, getReadingDirectionLabel, formatFileSize } from '../services/import';
import { getChaptersWithStatus } from '../services/readingProgress';
import { getContinueReadingInfo } from '../services/readingProgress';
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState<Partial<Manga>>({});
  const [chaptersWithStatus, setChaptersWithStatus] = useState<(Chapter & { readStatus: ChapterReadStatus })[]>([]);
  const [continueInfo, setContinueInfo] = useState<{ chapter: Chapter | null; progress: ReadingProgress | null } | null>(null);
  const [chapterFilter, setChapterFilter] = useState<'all' | 'unread' | 'reading' | 'completed'>('all');

  useEffect(() => {
    const loadExtra = async () => {
      const [chStatus, contInfo] = await Promise.all([
        getChaptersWithStatus(mangaId),
        getContinueReadingInfo(mangaId),
      ]);
      setChaptersWithStatus(chStatus);
      setContinueInfo(contInfo);
    };
    if (mangaId) loadExtra();
  }, [mangaId, chapters]);

  // Force reload when component becomes visible (user returns from reader)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && mangaId) {
        // Reload chapter statuses when page becomes visible
        getChaptersWithStatus(mangaId).then(setChaptersWithStatus);
        getContinueReadingInfo(mangaId).then(setContinueInfo);
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
    not_started: 'Não iniciado',
    in_progress: 'Em andamento',
    completed: 'Concluído',
  };

  const readStatusColors: Record<ChapterReadStatus, string> = {
    not_started: 'text-graphite-500',
    in_progress: 'text-violet-light',
    completed: 'text-success',
  };

  // Filter chapters
  const filteredChapters = chaptersWithStatus.filter(ch => {
    if (chapterFilter === 'all') return true;
    return ch.readStatus === chapterFilter;
  });

  // Calculate chapter counts
  const totalCount = chaptersWithStatus.length;
  const completedCount = chaptersWithStatus.filter(ch => ch.readStatus === 'completed').length;
  const inProgressCount = chaptersWithStatus.filter(ch => ch.readStatus === 'in_progress').length;
  const unreadCount = chaptersWithStatus.filter(ch => ch.readStatus === 'not_started').length;

  return (
    <div className="slide-up">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-graphite-400 hover:text-graphite-200 mb-4">
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
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-graphite-100 mb-1 break-words">{manga.title}</h1>
                {manga.author && <p className="text-sm text-graphite-400">por {manga.author}</p>}
              </div>
              <button
                onClick={handleToggleFavorite}
                className="text-2xl hover:scale-110 transition-transform"
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

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3 mb-4">
              <div className="bg-graphite-800/40 rounded-lg p-2 text-center">
                <p className="text-base sm:text-lg font-bold text-graphite-100 truncate">{totalCount}</p>
                <p className="text-[10px] text-graphite-500">Total</p>
              </div>
              <div className="bg-graphite-800/40 rounded-lg p-2 text-center">
                <p className="text-base sm:text-lg font-bold text-graphite-400 truncate">{unreadCount}</p>
                <p className="text-[10px] text-graphite-500">Não lidos</p>
              </div>
              <div className="bg-graphite-800/40 rounded-lg p-2 text-center">
                <p className="text-base sm:text-lg font-bold text-violet-light truncate">{inProgressCount}</p>
                <p className="text-[10px] text-graphite-500">Em andamento</p>
              </div>
              <div className="bg-graphite-800/40 rounded-lg p-2 text-center">
                <p className="text-base sm:text-lg font-bold text-success truncate">{completedCount}</p>
                <p className="text-[10px] text-graphite-500">Concluídos</p>
              </div>
              <div className="bg-graphite-800/40 rounded-lg p-2 text-center col-span-2 sm:col-span-1">`r`n                <p className="text-base sm:text-base sm:text-lg font-bold text-graphite-100 truncate truncate">{formatFileSize(manga.storageSize)}</p>
                <p className="text-[10px] text-graphite-500">Tamanho</p>
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
                  <div className="flex-1">
                    <p className="text-xs text-violet-light font-medium">Continuar lendo</p>
                    <p className="text-sm text-graphite-200">{continueInfo.chapter.title}</p>
                    {continueInfo.progress && (
                      <p className="text-xs text-graphite-400">
                        Página {continueInfo.progress.pageNumber} de {continueInfo.progress.totalPages} • {continueInfo.progress.percentComplete}%
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
          <div className="px-6 pb-4">
            <p className="text-sm text-graphite-300 leading-relaxed">{manga.synopsis}</p>
          </div>
        )}
      </div>

      {/* Chapters List */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-graphite-100">Índice de Capítulos</h2>
          <div className="flex gap-1">
            {(['all', 'unread', 'reading', 'completed'] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setChapterFilter(filter)}
                className={`px-2 py-1 rounded text-xs transition-all ${
                  chapterFilter === filter
                    ? 'bg-violet-accent/20 text-violet-light border border-violet-accent/40'
                    : 'text-graphite-500 hover:text-graphite-300'
                }`}
              >
                {filter === 'all' ? 'Todos' : 
                 filter === 'unread' ? 'Não lidos' :
                 filter === 'reading' ? 'Em andamento' : 'Concluídos'}
              </button>
            ))}
          </div>
        </div>

        {filteredChapters.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-3xl mb-2 block">📭</span>
            <p className="text-sm text-graphite-400">
              {chapters.length === 0 ? 'Nenhum capítulo importado' : 'Nenhum capítulo com este filtro'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredChapters.map((chapter) => {
              const isCurrentProgress = progress?.chapterId === chapter.id;
              const status = chapter.readStatus || 'not_started';
              
              return (
                <button
                  key={chapter.id}
                  onClick={() => onRead(chapter.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
                    isCurrentProgress
                      ? 'bg-violet-accent/10 border border-violet-accent/30'
                      : 'bg-graphite-800/30 hover:bg-graphite-800/50 border border-transparent'
                  }`}
                >
                  <div className={`text-lg ${readStatusColors[status]}`}>
                    {readStatusIcons[status]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-graphite-200 truncate">{chapter.title}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-graphite-500">{chapter.pagesCount} páginas</p>
                      <span className="text-xs text-graphite-600">•</span>
                      <p className={`text-xs ${readStatusColors[status]}`}>{readStatusLabels[status]}</p>
                    </div>
                  </div>
                  {isCurrentProgress && progress && (
                    <div className="text-right">
                      <span className="text-xs text-violet-light">Pág. {progress.pageNumber}/{progress.totalPages}</span>
                      <div className="w-16 h-1 bg-graphite-800 rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-violet-accent" style={{ width: `${progress.percentComplete || 0}%` }}></div>
                      </div>
                    </div>
                  )}
                  {isCurrentProgress && (
                    <span className="text-xs text-violet-light">▶</span>
                  )}
                </button>
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
