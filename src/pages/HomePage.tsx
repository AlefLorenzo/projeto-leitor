import { useMangaStore, useRecentReads } from '../hooks/useMangaStore';
import { getManga, getChapter } from '../services/database';
import { Manga, ReadingProgress } from '../types';
import { useState, useEffect } from 'react';
import { formatFileSize } from '../services/import';

interface HomePageProps {
  onOpenManga: (id: string) => void;
  onReadChapter: (mangaId: string, chapterId: string) => void;
  onImport: () => void;
}

export default function HomePage({ onOpenManga, onReadChapter, onImport }: HomePageProps) {
  const { mangas, loading, stats } = useMangaStore();
  const { recent } = useRecentReads(5);
  const [recentMangas, setRecentMangas] = useState<(Manga & { progress?: ReadingProgress })[]>([]);
  const [recentLoaded, setRecentLoaded] = useState(false);

  useEffect(() => {
    const loadRecent = async () => {
      const items: (Manga & { progress?: ReadingProgress })[] = [];
      for (const prog of recent) {
        if (prog.mangaId) {
          const manga = await getManga(prog.mangaId);
          if (manga) {
            items.push({ ...manga, progress: prog });
          }
        }
      }
      setRecentMangas(items);
      setRecentLoaded(true);
    };
    if (recent.length > 0) loadRecent();
    else setRecentLoaded(true);
  }, [recent]);

  const favorites = mangas.filter(m => m.isFavorite).slice(0, 6);
  const recentlyUpdated = mangas.slice(0, 6);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-violet-accent animate-pulse">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="slide-up">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-graphite-100 mb-1">
          Manga <span className="gradient-text">Offline</span>
        </h1>
        <p className="text-sm text-graphite-400">Sua biblioteca pessoal de mangás, manhwas e manhuas</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard icon="📚" value={stats.totalMangas} label="Obras" />
        <StatCard icon="📖" value={stats.totalChapters} label="Capítulos" />
        <StatCard icon="🖼️" value={stats.totalPages} label="Páginas" />
        <StatCard icon="💾" value={formatFileSize(stats.totalSize)} label="Armazenamento" />
      </div>

      {/* Empty State */}
      {mangas.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center mb-8">
          <span className="text-6xl mb-4 block">📚</span>
          <h2 className="text-xl font-bold text-graphite-100 mb-2">Bem-vindo ao Manga Offline!</h2>
          <p className="text-sm text-graphite-400 mb-6 max-w-md mx-auto">
            Importe suas obras favoritas em formato de imagens, organize em capítulos e leia offline com uma experiência premium.
          </p>
          <button
            onClick={onImport}
            className="px-6 py-3 bg-violet-accent hover:bg-violet-dark text-white rounded-lg font-medium transition-colors"
          >
            + Importar Primeira Obra
          </button>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-left max-w-2xl mx-auto">
            <FeatureCard icon="📂" title="Importação Local" desc="Importe CBZ, ZIP, imagens e pastas do seu dispositivo" />
            <FeatureCard icon="📖" title="Leitor Completo" desc="3 modos de leitura: Mangá, Manhwa e Manhua" />
            <FeatureCard icon="✈️" title="100% Offline" desc="Leia sem internet após importar suas obras" />
          </div>
        </div>
      )}

      {/* Continue Reading */}
      {recentMangas.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-graphite-100">📖 Continuar Lendo</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {recentMangas.map((manga) => (
              <ContinueReadingCard
                key={manga.id}
                manga={manga}
                onClick={() => {
                  if (manga.progress?.chapterId) {
                    onReadChapter(manga.id, manga.progress.chapterId);
                  } else {
                    onOpenManga(manga.id);
                  }
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Favorites */}
      {favorites.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-graphite-100">⭐ Favoritas</h2>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {favorites.map((manga) => (
              <MangaMiniCard key={manga.id} manga={manga} onClick={() => onOpenManga(manga.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Recently Updated */}
      {recentlyUpdated.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-graphite-100">🕐 Adicionadas Recentemente</h2>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {recentlyUpdated.map((manga) => (
              <MangaMiniCard key={manga.id} manga={manga} onClick={() => onOpenManga(manga.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      {mangas.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-graphite-100 mb-4">⚡ Ações Rápidas</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={onImport}
              className="glass-card rounded-xl p-4 text-left hover:border-violet-accent/30 transition-all"
            >
              <span className="text-2xl mb-2 block">📂</span>
              <h3 className="text-sm font-medium text-graphite-200">Importar</h3>
              <p className="text-xs text-graphite-500 mt-1">Adicionar nova obra</p>
            </button>
            <button
              onClick={() => onOpenManga(mangas[0]?.id || '')}
              className="glass-card rounded-xl p-4 text-left hover:border-violet-accent/30 transition-all"
            >
              <span className="text-2xl mb-2 block">📖</span>
              <h3 className="text-sm font-medium text-graphite-200">Ler</h3>
              <p className="text-xs text-graphite-500 mt-1">Continuar lendo</p>
            </button>
            <button
              onClick={() => {}}
              className="glass-card rounded-xl p-4 text-left hover:border-violet-accent/30 transition-all"
            >
              <span className="text-2xl mb-2 block">🔍</span>
              <h3 className="text-sm font-medium text-graphite-200">Explorar</h3>
              <p className="text-xs text-graphite-500 mt-1">Descobrir obras</p>
            </button>
            <button
              onClick={() => {}}
              className="glass-card rounded-xl p-4 text-left hover:border-violet-accent/30 transition-all"
            >
              <span className="text-2xl mb-2 block">📊</span>
              <h3 className="text-sm font-medium text-graphite-200">Stats</h3>
              <p className="text-xs text-graphite-500 mt-1">{stats.totalPages} páginas</p>
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <div className="glass-card rounded-xl p-3 text-center">
      <span className="text-xl mb-1 block">{icon}</span>
      <p className="text-lg font-bold text-graphite-100">{value}</p>
      <p className="text-[10px] text-graphite-500">{label}</p>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-graphite-800/40 rounded-lg p-3">
      <span className="text-xl mb-1 block">{icon}</span>
      <h4 className="text-xs font-semibold text-graphite-200">{title}</h4>
      <p className="text-[10px] text-graphite-500 mt-0.5">{desc}</p>
    </div>
  );
}

function ContinueReadingCard({ manga, onClick }: { manga: Manga & { progress?: ReadingProgress }; onClick: () => void }) {
  const progressPercent = manga.progress && manga.progress.totalPages > 0
    ? Math.round((manga.progress.pageNumber / manga.progress.totalPages) * 100)
    : 0;

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-40 glass-card rounded-lg overflow-hidden hover:border-violet-accent/30 transition-all text-left"
    >
      <div className="aspect-[3/2] bg-gradient-to-br from-violet-accent/20 to-graphite-800 relative">
        {manga.coverUrl ? (
          <img src={manga.coverUrl} alt={manga.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-2xl opacity-50">📕</span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
          <div className="h-full bg-violet-accent" style={{ width: `${progressPercent}%` }}></div>
        </div>
      </div>
      <div className="p-2">
        <p className="text-xs font-medium text-graphite-200 truncate">{manga.title}</p>
        <p className="text-[10px] text-graphite-500">{progressPercent}% concluído</p>
      </div>
    </button>
  );
}

function MangaMiniCard({ manga, onClick }: { manga: Manga; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left group">
      <div className="aspect-[2/3] rounded-lg overflow-hidden bg-graphite-800 cover-shadow relative mb-1.5">
        {manga.coverUrl ? (
          <img src={manga.coverUrl} alt={manga.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-accent/20 to-graphite-800 flex items-center justify-center">
            <span className="text-2xl opacity-50">📕</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
          <span className="text-white opacity-0 group-hover:opacity-100 text-xs">Ler</span>
        </div>
      </div>
      <p className="text-[10px] font-medium text-graphite-300 truncate">{manga.title}</p>
    </button>
  );
}
