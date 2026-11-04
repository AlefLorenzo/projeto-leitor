import { useMangaStore, useRecentReads } from '../hooks/useMangaStore';
import { getManga } from '../services/database';
import { Manga, ReadingProgress } from '../types';
import { useState, useEffect } from 'react';
import { formatFileSize } from '../services/import';

interface HomePageProps {
  onOpenManga: (id: string) => void;
  onReadChapter: (mangaId: string, chapterId: string) => void;
  onImport: () => void;
  onOpenTelegram?: () => void;
  onOpenExplore?: () => void;
}

export default function HomePage({
  onOpenManga,
  onReadChapter,
  onImport,
  onOpenTelegram,
  onOpenExplore,
}: HomePageProps) {
  const { mangas, loading, stats } = useMangaStore();
  const { recent } = useRecentReads(5);
  const [recentMangas, setRecentMangas] = useState<(Manga & { progress?: ReadingProgress })[]>([]);

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
    };
    if (recent.length > 0) loadRecent();
  }, [recent]);

  const favorites = mangas.filter((m) => m.isFavorite).slice(0, 6);
  const recentlyUpdated = mangas.slice(0, 6);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-violet-accent animate-pulse font-medium">Carregando acervo...</div>
      </div>
    );
  }

  return (
    <div className="slide-up">
      {/* Welcome Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-graphite-100 mb-1">
          Manga <span className="gradient-text">Offline</span>
        </h1>
        <p className="text-xs sm:text-sm text-graphite-400">
          Leitor inteligente de Mangás, Manhwas e Manhuas com sincronização online e leitura 100% offline
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon="📚" value={stats.totalMangas} label="Obras Locais" />
        <StatCard icon="📖" value={stats.totalChapters} label="Capítulos Baixados" />
        <StatCard icon="🖼️" value={stats.totalPages} label="Páginas" />
        <StatCard icon="💾" value={formatFileSize(stats.totalSize)} label="Armazenamento" />
      </div>

      {/* Destaque Online - Catálogos Disponíveis */}
      <section className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card Catálogo Git Online */}
          <div className="glass-card rounded-2xl p-5 border border-violet-accent/40 bg-gradient-to-br from-violet-accent/15 via-graphite-900 to-graphite-900 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🌐</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                  Git Bridge Ativo
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mb-1">Catálogo Git Online</h2>
              <p className="text-xs text-graphite-300 leading-relaxed mb-4">
                Acesse o acervo completo sincronizado diretamente pelo repositório GitHub com capítulos prontos para download e leitura offline.
              </p>
            </div>
            <button
              onClick={onOpenTelegram}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-violet-accent to-violet-dark hover:brightness-110 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-accent/25"
            >
              <span>Abrir Catálogo Git</span>
              <span>→</span>
            </button>
          </div>

          {/* Card MangaDex Oficial */}
          <div className="glass-card rounded-2xl p-5 border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-graphite-900 to-graphite-900 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">📙</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                  9.500+ Obras PT-BR
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mb-1">Explorar MangaDex</h2>
              <p className="text-xs text-graphite-300 leading-relaxed mb-4">
                Pesquise milhares de títulos traduzidos em português, ordene capítulos, baixe em segundo plano e leia sem conexão.
              </p>
            </div>
            <button
              onClick={onOpenExplore}
              className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-600/25"
            >
              <span>Explorar MangaDex</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </section>

      {/* Empty State na biblioteca local */}
      {mangas.length === 0 && (
        <div className="glass-card rounded-2xl p-6 sm:p-8 text-center mb-8 border border-graphite-700/50">
          <span className="text-5xl mb-3 block">📥</span>
          <h3 className="text-base sm:text-lg font-bold text-graphite-100 mb-2">
            Sua biblioteca local está vazia
          </h3>
          <p className="text-xs sm:text-sm text-graphite-400 mb-6 max-w-md mx-auto">
            Escolha uma obra no <b>Catálogo Git</b> ou no <b>MangaDex</b> para baixar capítulos e ler mesmo sem internet. Você também pode importar seus próprios arquivos CBZ/ZIP.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2.5 sm:gap-3 w-full">
            <button
              onClick={onOpenTelegram}
              className="w-full sm:w-auto px-5 py-2.5 bg-violet-accent hover:bg-violet-dark text-white rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md shadow-violet-accent/20 text-center"
            >
              🌐 Ver Obras no Git
            </button>
            <button
              onClick={onOpenExplore}
              className="w-full sm:w-auto px-5 py-2.5 bg-graphite-800 hover:bg-graphite-700 text-white border border-graphite-600/50 rounded-xl text-xs sm:text-sm font-semibold transition-all text-center"
            >
              📙 Pesquisar no MangaDex
            </button>
            <button
              onClick={onImport}
              className="w-full sm:w-auto px-5 py-2.5 bg-graphite-800/60 hover:bg-graphite-700 text-graphite-300 rounded-xl text-xs sm:text-sm font-medium transition-all text-center"
            >
              📂 Importar CBZ / ZIP
            </button>
          </div>
        </div>
      )}

      {/* Continue Reading */}
      {recentMangas.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-graphite-100">📖 Continuar Lendo</h2>
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
            <h2 className="text-base sm:text-lg font-semibold text-graphite-100">⭐ Favoritas</h2>
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
            <h2 className="text-base sm:text-lg font-semibold text-graphite-100">🕐 Baixadas Recentemente</h2>
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
          <h2 className="text-base sm:text-lg font-semibold text-graphite-100 mb-4">⚡ Ações Rápidas</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
            <button
              onClick={onOpenTelegram}
              className="glass-card rounded-xl p-3 sm:p-4 text-left hover:border-violet-accent/30 transition-all min-w-0"
            >
              <span className="text-xl sm:text-2xl mb-1.5 sm:mb-2 block">🌐</span>
              <h3 className="text-xs sm:text-sm font-medium text-graphite-200 truncate">Catálogo Git</h3>
              <p className="text-[10px] sm:text-xs text-graphite-500 mt-0.5 truncate">Baixar obras</p>
            </button>
            <button
              onClick={onOpenExplore}
              className="glass-card rounded-xl p-3 sm:p-4 text-left hover:border-violet-accent/30 transition-all min-w-0"
            >
              <span className="text-xl sm:text-2xl mb-1.5 sm:mb-2 block">📙</span>
              <h3 className="text-xs sm:text-sm font-medium text-graphite-200 truncate">MangaDex</h3>
              <p className="text-[10px] sm:text-xs text-graphite-500 mt-0.5 truncate">9.500+ títulos</p>
            </button>
            <button
              onClick={onImport}
              className="glass-card rounded-xl p-3 sm:p-4 text-left hover:border-violet-accent/30 transition-all min-w-0"
            >
              <span className="text-xl sm:text-2xl mb-1.5 sm:mb-2 block">📂</span>
              <h3 className="text-xs sm:text-sm font-medium text-graphite-200 truncate">Importar</h3>
              <p className="text-[10px] sm:text-xs text-graphite-500 mt-0.5 truncate">Adicionar CBZ/ZIP</p>
            </button>
            <button
              onClick={() => onOpenManga(mangas[0]?.id || '')}
              className="glass-card rounded-xl p-3 sm:p-4 text-left hover:border-violet-accent/30 transition-all min-w-0"
            >
              <span className="text-xl sm:text-2xl mb-1.5 sm:mb-2 block">📖</span>
              <h3 className="text-xs sm:text-sm font-medium text-graphite-200 truncate">Ler Agora</h3>
              <p className="text-[10px] sm:text-xs text-graphite-500 mt-0.5 truncate">Continuar leitura</p>
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <div className="glass-card rounded-xl p-2.5 sm:p-3 text-center min-w-0">
      <span className="text-lg sm:text-xl mb-0.5 sm:mb-1 block">{icon}</span>
      <p className="text-base sm:text-lg font-bold text-graphite-100 truncate">{value}</p>
      <p className="text-[10px] text-graphite-500 truncate">{label}</p>
    </div>
  );
}

function ContinueReadingCard({ manga, onClick }: { manga: Manga & { progress?: ReadingProgress }; onClick: () => void }) {
  const progressPercent =
    manga.progress && manga.progress.totalPages > 0
      ? Math.round((manga.progress.pageNumber / manga.progress.totalPages) * 100)
      : 0;

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-32 sm:w-40 glass-card rounded-xl overflow-hidden hover:border-violet-accent/30 transition-all text-left min-w-0"
    >
      <div className="aspect-[3/2] bg-gradient-to-br from-violet-accent/20 to-graphite-800 relative">
        {manga.coverUrl ? (
          <img
            src={manga.coverUrl}
            alt={manga.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.dataset.triedGithub && manga.coverUrl?.startsWith('/catalog/')) {
                target.dataset.triedGithub = 'true';
                target.src = `https://raw.githubusercontent.com/AlefLorenzo/projeto-leitor/main/public${manga.coverUrl}`;
              }
            }}
          />
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
    <button onClick={onClick} className="text-left group min-w-0 w-full">
      <div className="aspect-[2/3] rounded-lg overflow-hidden bg-graphite-800 cover-shadow relative mb-1.5">
        {manga.coverUrl ? (
          <img
            src={manga.coverUrl}
            alt={manga.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.dataset.triedGithub && manga.coverUrl?.startsWith('/catalog/')) {
                target.dataset.triedGithub = 'true';
                target.src = `https://raw.githubusercontent.com/AlefLorenzo/projeto-leitor/main/public${manga.coverUrl}`;
              }
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-accent/20 to-graphite-800 flex items-center justify-center">
            <span className="text-2xl opacity-50">📕</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
          <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium">Ler</span>
        </div>
      </div>
      <p className="text-[10px] font-medium text-graphite-300 truncate">{manga.title}</p>
    </button>
  );
}
