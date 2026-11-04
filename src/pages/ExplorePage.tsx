import { useState, useEffect } from 'react';
import { SourceManga, SourceAvailability } from '../services/sources/types';
import { onlineSourceManager } from '../services/sources/OnlineSourceManager';
import { OnlineMangaModal } from '../components/OnlineMangaModal';

interface ExplorePageProps {
  onOpenCatalogManga?: (id: string) => void;
  onOpenReader?: (mangaId: string, chapterId: string) => void;
}

export default function ExplorePage({ onOpenReader }: ExplorePageProps) {
  const [sources] = useState(onlineSourceManager.getAllSources());
  const [activeSource, setActiveSource] = useState(onlineSourceManager.getActiveSource());
  const [availability, setAvailability] = useState<SourceAvailability | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const [search, setSearch] = useState('');
  const [mangas, setMangas] = useState<SourceManga[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const [selectedManga, setSelectedManga] = useState<SourceManga | null>(null);

  // Checar disponibilidade da fonte ativa
  const checkSource = async (sourceId: string) => {
    setCheckingAvailability(true);
    try {
      const res = await onlineSourceManager.checkAvailability(sourceId);
      setAvailability(res);
    } catch {
      setAvailability({ available: false, reason: 'Erro ao conectar à fonte.' });
    } finally {
      setCheckingAvailability(false);
    }
  };

  // Carregar catálogo paginado
  const loadCatalog = async (p: number, q: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await activeSource.getMangaList(p, q);
      setMangas(result.mangas);
      setHasMore(result.hasMore);
      setTotal(result.total);
      setPage(p);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar catálogo da fonte.');
      setMangas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSource(activeSource.id);
    loadCatalog(1, search);
  }, [activeSource]);

  const handleSourceChange = (sourceId: string) => {
    onlineSourceManager.setActiveSource(sourceId);
    const newSource = onlineSourceManager.getActiveSource();
    setActiveSource(newSource);
    setPage(1);
    setSearch('');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadCatalog(1, search);
  };

  return (
    <div className="slide-up">
      {/* Header com Seletor de Fontes */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-graphite-100 mb-1">Explorar Fontes Online</h1>
          <p className="text-sm text-graphite-400">
            Catálogos remotos sob demanda • Download atômico e leitura offline
          </p>
        </div>

        {/* Seletor de Fonte */}
        <div className="flex items-center gap-2 bg-graphite-900 border border-graphite-700/60 p-1.5 rounded-xl shadow-inner">
          <span className="text-xs text-graphite-400 pl-2">Fonte:</span>
          {sources.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSourceChange(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeSource.id === s.id
                  ? 'bg-violet-accent text-white shadow-md'
                  : 'text-graphite-300 hover:text-white hover:bg-graphite-800'
              }`}
            >
              <span>{s.icon}</span>
              <span>{s.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Banner de Status da Fonte */}
      {availability && !availability.available && (
        <div className="glass-card rounded-xl p-4 mb-6 border-amber-500/40 bg-amber-500/10 flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">⚠️</span>
          <div className="text-xs">
            <p className="font-bold text-amber-300 mb-0.5">
              Limitação Detectada na Fonte: {activeSource.name}
            </p>
            <p className="text-graphite-300 leading-relaxed mb-2">
              {availability.reason}
            </p>
            {availability.protectionType === 'cloudflare_waf' && (
              <p className="text-graphite-400 text-[11px]">
                🛡️ Conforme a política de confiabilidade do app, não contornamos WAFs ou proteções anti-bot.
                Você pode utilizar a fonte <b>MangaDex</b> para catálogo oficial com mais de 13.000 obras em Português.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Busca */}
      <div className="glass-card rounded-xl p-4 mb-6">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite-500">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Pesquisar títulos em ${activeSource.name}...`}
              className="w-full pl-9 pr-3 py-2.5 bg-graphite-800/60 border border-graphite-700/30 rounded-lg text-sm text-graphite-200 placeholder:text-graphite-500 focus:outline-none focus:border-violet-accent/50"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-violet-accent hover:bg-violet-accent/90 text-white rounded-lg text-sm font-semibold shadow transition"
          >
            Buscar
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                loadCatalog(1, '');
              }}
              className="px-3 py-2.5 bg-graphite-800 text-graphite-400 hover:text-white rounded-lg text-xs"
            >
              Limpar
            </button>
          )}
        </form>
      </div>

      {/* Grid de Obras */}
      {loading ? (
        <div className="py-20 text-center text-graphite-400">
          <div className="w-10 h-10 border-3 border-violet-accent border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm font-medium">Consultando catálogo remoto...</p>
        </div>
      ) : error ? (
        <div className="glass-card rounded-xl p-10 text-center">
          <span className="text-4xl mb-3 block">📡</span>
          <h3 className="text-base font-semibold text-graphite-200 mb-1">Erro ao conectar à fonte</h3>
          <p className="text-xs text-graphite-400 mb-4">{error}</p>
          <button
            onClick={() => loadCatalog(page, search)}
            className="px-4 py-2 bg-graphite-800 hover:bg-graphite-700 text-violet-light rounded-lg text-xs font-semibold border border-graphite-700 transition"
          >
            Tentar novamente
          </button>
        </div>
      ) : mangas.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <span className="text-4xl mb-2 block">🔍</span>
          <p className="text-sm text-graphite-300 font-semibold mb-1">Nenhuma obra encontrada</p>
          <p className="text-xs text-graphite-400">Tente buscar por outro termo ou trocar a fonte.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mb-8">
            {mangas.map((manga) => (
              <SourceMangaCard
                key={manga.id}
                manga={manga}
                onClick={() => setSelectedManga(manga)}
              />
            ))}
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-center gap-3 py-4">
            <button
              onClick={() => loadCatalog(page - 1, search)}
              disabled={page <= 1 || loading}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-graphite-850 hover:bg-graphite-800 border border-graphite-700 text-graphite-200 disabled:opacity-40 transition"
            >
              ← Anterior
            </button>
            <span className="text-xs text-graphite-400 font-mono">
              Página <b className="text-white">{page}</b> {total > 0 && `(de ~${Math.ceil(total / 20)})`}
            </span>
            <button
              onClick={() => loadCatalog(page + 1, search)}
              disabled={!hasMore || loading}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-graphite-850 hover:bg-graphite-800 border border-graphite-700 text-graphite-200 disabled:opacity-40 transition"
            >
              Próxima →
            </button>
          </div>
        </>
      )}

      {/* Modal de Detalhes da Obra e Download Seletivo */}
      <OnlineMangaModal
        isOpen={!!selectedManga}
        manga={selectedManga}
        onClose={() => setSelectedManga(null)}
        onOpenReader={(mangaId, chapterId) => {
          setSelectedManga(null);
          if (onOpenReader) onOpenReader(mangaId, chapterId);
        }}
      />
    </div>
  );
}

function SourceMangaCard({ manga, onClick }: { manga: SourceManga; onClick: () => void }) {
  const typeIcons: Record<string, string> = { manga: '🇯🇵', manhwa: '🇰🇷', manhua: '🇨🇳' };

  return (
    <button
      onClick={onClick}
      className="text-left group flex flex-col focus:outline-none transition-transform hover:-translate-y-1"
    >
      <div className="w-full aspect-[2/3] rounded-xl overflow-hidden bg-graphite-800 relative mb-1.5 border border-graphite-700/40 group-hover:border-violet-accent/60 transition-colors shadow-md">
        {manga.thumbnailUrl || manga.coverUrl ? (
          <img
            src={manga.thumbnailUrl || manga.coverUrl}
            alt={manga.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-accent/20 to-graphite-800 flex items-center justify-center">
            <span className="text-3xl opacity-30">📕</span>
          </div>
        )}

        {/* Overlay hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 text-center">
          <span className="bg-violet-accent text-white px-2.5 py-1 rounded text-xs font-semibold shadow">
            Ver Capítulos
          </span>
        </div>

        {/* Badges */}
        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] text-graphite-200">
          {typeIcons[manga.type] || '📖'} {manga.type}
        </div>
      </div>

      <p className="text-xs font-semibold text-graphite-200 truncate group-hover:text-violet-light transition-colors">
        {manga.title}
      </p>
      <p className="text-[10px] text-graphite-500 truncate">
        {manga.genres.slice(0, 2).join(' • ') || 'Mangá Online'}
      </p>
    </button>
  );
}
