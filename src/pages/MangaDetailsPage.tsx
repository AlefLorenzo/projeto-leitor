import { useState } from 'react';
import { useMangaDetails } from '../hooks/useMangaStore';
import { getMangaTypeLabel, getReadingDirectionLabel, formatFileSize } from '../services/import';
import { ReadingStatus, Manga } from '../types';
import { deleteManga, saveManga, getManga } from '../services/database';

interface MangaDetailsPageProps {
  mangaId: string;
  onBack: () => void;
  onRead: (chapterId: string) => void;
  onRefresh: () => void;
}

export default function MangaDetailsPage({ mangaId, onBack, onRead, onRefresh }: MangaDetailsPageProps) {
  const { manga, chapters, progress, loading, reload } = useMangaDetails(mangaId);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState<Partial<Manga>>({});

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
    }
  };

  const statusLabels: Record<ReadingStatus, string> = {
    reading: '📖 Lendo',
    want_to_read: '📋 Quero ler',
    completed: '✅ Concluído',
    paused: '⏸️ Pausado',
    dropped: '❌ Abandonado',
  };

  return (
    <div className="slide-up">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-graphite-400 hover:text-graphite-200 mb-4">
        ← Voltar à biblioteca
      </button>

      {/* Header with cover */}
      <div className="glass-card rounded-xl overflow-hidden mb-6">
        <div className="flex flex-col md:flex-row gap-6 p-6">
          {/* Cover */}
          <div className="w-40 h-56 rounded-lg overflow-hidden bg-graphite-800 flex-shrink-0 cover-shadow mx-auto md:mx-0">
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
            <h1 className="text-2xl font-bold text-graphite-100 mb-1">{manga.title}</h1>
            {manga.author && <p className="text-sm text-graphite-400 mb-3">por {manga.author}</p>}
            
            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="text-xs px-2 py-0.5 rounded bg-violet-accent/10 text-violet-light">{getMangaTypeLabel(manga.type)}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-graphite-700/50 text-graphite-300">{getReadingDirectionLabel(manga.readingDirection)}</span>
              {manga.genres.map((g, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded bg-graphite-700/30 text-graphite-400">{g}</span>
              ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-graphite-800/40 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-graphite-100">{chapters.length}</p>
                <p className="text-[10px] text-graphite-500">Capítulos</p>
              </div>
              <div className="bg-graphite-800/40 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-graphite-100">{manga.totalPages}</p>
                <p className="text-[10px] text-graphite-500">Páginas</p>
              </div>
              <div className="bg-graphite-800/40 rounded-lg p-2 text-center">
                <p className="text-lg font-bold text-graphite-100">{formatFileSize(manga.storageSize)}</p>
                <p className="text-[10px] text-graphite-500">Tamanho</p>
              </div>
            </div>

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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-graphite-100">Capítulos</h2>
          <span className="text-xs text-graphite-500">{chapters.length} capítulos</span>
        </div>

        {chapters.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-3xl mb-2 block">📭</span>
            <p className="text-sm text-graphite-400">Nenhum capítulo importado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {chapters.map((chapter) => {
              const isLastRead = progress?.chapterId === chapter.id;
              return (
                <button
                  key={chapter.id}
                  onClick={() => onRead(chapter.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
                    isLastRead
                      ? 'bg-violet-accent/10 border border-violet-accent/30'
                      : 'bg-graphite-800/30 hover:bg-graphite-800/50 border border-transparent'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-graphite-700/50 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">📖</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-graphite-200 truncate">{chapter.title}</p>
                    <p className="text-xs text-graphite-500">{chapter.pagesCount} páginas • {formatFileSize(chapter.storageSize)}</p>
                  </div>
                  {isLastRead && (
                    <span className="text-xs text-violet-light">Continuar →</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-graphite-100 mb-2">Excluir obra?</h3>
            <p className="text-sm text-graphite-400 mb-4">
              "{manga.title}" será removida permanentemente, incluindo todos os capítulos e páginas. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-sm text-graphite-400 hover:text-graphite-200">
                Cancelar
              </button>
              <button onClick={handleDelete} className="px-4 py-2 bg-error/20 border border-error/30 text-error rounded-lg text-sm font-medium hover:bg-error/30">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

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
