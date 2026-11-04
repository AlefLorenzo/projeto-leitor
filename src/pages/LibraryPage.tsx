import { useState } from 'react';
import { useMangaStore } from '../hooks/useMangaStore';
import { Manga, ReadingStatus } from '../types';
import { formatFileSize, getMangaTypeLabel } from '../services/import';

interface LibraryPageProps {
  onOpenManga: (id: string) => void;
  onImport: () => void;
}

export default function LibraryPage({ onOpenManga, onImport }: LibraryPageProps) {
  const { mangas, loading, stats, getFilteredMangas, toggleFavorite, removeManga, updateMangaStatus } = useMangaStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReadingStatus | 'all' | 'favorites' | 'imported'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'updated' | 'title' | 'created'>('updated');
  const [contextMenu, setContextMenu] = useState<{ manga: Manga; x: number; y: number } | null>(null);

  let filtered = getFilteredMangas({ status: statusFilter, search });

  // Sort
  filtered = filtered.sort((a, b) => {
    switch (sortBy) {
      case 'title': return a.title.localeCompare(b.title);
      case 'created': return b.createdAt - a.createdAt;
      default: return b.updatedAt - a.updatedAt;
    }
  });

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      all: 'Todas',
      reading: '📖 Lendo',
      want_to_read: '📋 Quero ler',
      completed: '✅ Concluídas',
      paused: '⏸️ Pausadas',
      dropped: '❌ Abandonadas',
      favorites: '⭐ Favoritas',
      imported: '📂 Importadas',
    };
    return labels[status] || status;
  };

  const handleContextMenu = (e: React.MouseEvent, manga: Manga) => {
    e.preventDefault();
    setContextMenu({ manga, x: e.clientX, y: e.clientY });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-violet-accent animate-pulse">Carregando biblioteca...</div>
      </div>
    );
  }

  return (
    <div className="slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-graphite-100">Biblioteca</h1>
          <p className="text-sm text-graphite-400">{stats.totalMangas} obras • {stats.totalChapters} capítulos • {formatFileSize(stats.totalSize)}</p>
        </div>
        <button
          onClick={onImport}
          className="flex items-center gap-2 px-4 py-2 bg-violet-accent hover:bg-violet-dark text-white rounded-lg transition-colors text-sm font-medium"
        >
          <span>+</span> Importar Obra
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite-500">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar obras..."
                className="w-full pl-9 pr-3 py-2 bg-graphite-800/60 border border-graphite-700/30 rounded-lg text-sm text-graphite-200 placeholder:text-graphite-500 focus:outline-none focus:border-violet-accent/50"
              />
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-graphite-800/60 border border-graphite-700/30 rounded-lg text-sm text-graphite-200 focus:outline-none focus:border-violet-accent/50"
          >
            <option value="all">{getStatusLabel('all')}</option>
            <option value="reading">{getStatusLabel('reading')}</option>
            <option value="want_to_read">{getStatusLabel('want_to_read')}</option>
            <option value="completed">{getStatusLabel('completed')}</option>
            <option value="paused">{getStatusLabel('paused')}</option>
            <option value="dropped">{getStatusLabel('dropped')}</option>
            <option value="favorites">{getStatusLabel('favorites')}</option>
            <option value="imported">{getStatusLabel('imported')}</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-graphite-800/60 border border-graphite-700/30 rounded-lg text-sm text-graphite-200 focus:outline-none focus:border-violet-accent/50"
          >
            <option value="updated">Mais recente</option>
            <option value="title">Título A-Z</option>
            <option value="created">Data de criação</option>
          </select>

          {/* View Mode */}
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-violet-accent/20 text-violet-light' : 'text-graphite-500 hover:text-graphite-300'}`}
            >
              ▦
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-violet-accent/20 text-violet-light' : 'text-graphite-500 hover:text-graphite-300'}`}
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center">
          <span className="text-5xl mb-4 block">📚</span>
          <h3 className="text-lg font-semibold text-graphite-200 mb-2">
            {mangas.length === 0 ? 'Biblioteca vazia' : 'Nenhum resultado'}
          </h3>
          <p className="text-sm text-graphite-400 mb-4">
            {mangas.length === 0
              ? 'Importe sua primeira obra para começar a ler'
              : 'Tente ajustar os filtros de pesquisa'}
          </p>
          {mangas.length === 0 && (
            <button
              onClick={onImport}
              className="px-6 py-2.5 bg-violet-accent hover:bg-violet-dark text-white rounded-lg transition-colors text-sm font-medium"
            >
              Importar Primeira Obra
            </button>
          )}
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-4">
          {filtered.map((manga) => (
            <MangaGridCard
              key={manga.id}
              manga={manga}
              onClick={() => onOpenManga(manga.id)}
              onContextMenu={(e) => handleContextMenu(e, manga)}
              onToggleFavorite={() => toggleFavorite(manga.id)}
            />
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((manga) => (
            <MangaListCard
              key={manga.id}
              manga={manga}
              onClick={() => onOpenManga(manga.id)}
              onContextMenu={(e) => handleContextMenu(e, manga)}
              onToggleFavorite={() => toggleFavorite(manga.id)}
            />
          ))}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 glass-card rounded-lg p-1 min-w-[160px] shadow-xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => { toggleFavorite(contextMenu.manga.id); setContextMenu(null); }}
              className="w-full text-left px-3 py-2 text-sm text-graphite-200 hover:bg-graphite-700/50 rounded"
            >
              {contextMenu.manga.isFavorite ? '⭐ Remover dos favoritos' : '⭐ Adicionar aos favoritos'}
            </button>
            <div className="border-t border-graphite-700/30 my-1"></div>
            <button
              onClick={() => { updateMangaStatus(contextMenu.manga.id, 'completed'); setContextMenu(null); }}
              className="w-full text-left px-3 py-2 text-sm text-graphite-200 hover:bg-graphite-700/50 rounded"
            >
              ✅ Marcar como concluída
            </button>
            <button
              onClick={() => { updateMangaStatus(contextMenu.manga.id, 'paused'); setContextMenu(null); }}
              className="w-full text-left px-3 py-2 text-sm text-graphite-200 hover:bg-graphite-700/50 rounded"
            >
              ⏸️ Pausar
            </button>
            <div className="border-t border-graphite-700/30 my-1"></div>
            <button
              onClick={() => {
                if (confirm(`Excluir "${contextMenu.manga.title}"? Esta ação não pode ser desfeita.`)) {
                  removeManga(contextMenu.manga.id);
                }
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-sm text-error hover:bg-error/10 rounded"
            >
              🗑️ Excluir obra
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MangaGridCard({ manga, onClick, onContextMenu, onToggleFavorite }: {
  manga: Manga;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onToggleFavorite: () => void;
}) {
  const progress = manga.totalPages > 0
    ? Math.round(((manga.totalPages - (manga.totalPages * 0.3)) / manga.totalPages) * 100)
    : 0;

  return (
    <div
      className="group relative cursor-pointer min-w-0 w-full"
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {/* Cover */}
      <div className="aspect-[2/3] rounded-lg overflow-hidden bg-graphite-800 cover-shadow relative">
        {manga.coverUrl ? (
          <img src={manga.coverUrl} alt={manga.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-accent/20 to-graphite-800 flex items-center justify-center">
            <span className="text-3xl opacity-50">📕</span>
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
          <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-sm font-medium">Ler</span>
        </div>

        {/* Favorite badge */}
        {manga.isFavorite && (
          <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-graphite-900/80 flex items-center justify-center">
            <span className="text-xs">⭐</span>
          </div>
        )}

        {/* Type badge */}
        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-violet-accent/80 text-white">
          {getMangaTypeLabel(manga.type)}
        </div>

        {/* Progress bar */}
        {manga.totalPages > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
            <div className="h-full bg-violet-accent" style={{ width: `${Math.min(progress, 100)}%` }}></div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-2">
        <h3 className="text-xs font-medium text-graphite-200 truncate">{manga.title}</h3>
        <p className="text-[10px] text-graphite-500">{manga.totalChapters} cap. • {manga.totalPages} págs.</p>
      </div>
    </div>
  );
}

function MangaListCard({ manga, onClick, onContextMenu, onToggleFavorite }: {
  manga: Manga;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onToggleFavorite: () => void;
}) {
  return (
    <div
      className="glass-card rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:border-violet-accent/30 transition-all"
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {/* Cover */}
      <div className="w-12 h-16 rounded overflow-hidden bg-graphite-800 flex-shrink-0">
        {manga.coverUrl ? (
          <img src={manga.coverUrl} alt={manga.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-accent/20 to-graphite-800 flex items-center justify-center">
            <span className="text-lg opacity-50">📕</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-graphite-200 truncate">{manga.title}</h3>
        <p className="text-xs text-graphite-400">{manga.author || 'Autor desconhecido'}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-accent/10 text-violet-light">{getMangaTypeLabel(manga.type)}</span>
          <span className="text-[10px] text-graphite-500">{manga.totalChapters} cap.</span>
          <span className="text-[10px] text-graphite-500">{manga.totalPages} págs.</span>
        </div>
      </div>

      {/* Actions */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
        className="p-2 rounded-lg hover:bg-graphite-700/50 transition-colors"
      >
        <span className="text-sm">{manga.isFavorite ? '⭐' : '☆'}</span>
      </button>
    </div>
  );
}
