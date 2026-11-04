import { useState, useEffect, useRef, useCallback } from 'react';
import { SourceManga, SourceAvailability, SourceFilterOptions, MangaSortOrder } from '../services/sources/types';
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

  // Filtros
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'manga' | 'manhwa' | 'manhua'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'ongoing' | 'completed' | 'hiatus'>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('pt-br');
  const [selectedOrder, setSelectedOrder] = useState<MangaSortOrder>('popular');

  // Estado dos dados
  const [mangas, setMangas] = useState<SourceManga[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  // Modal de Detalhes
  const [selectedManga, setSelectedManga] = useState<SourceManga | null>(null);

  // Debounce do campo de busca (450ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Volta à página 1 em nova busca
    }, 450);
    return () => clearTimeout(timer);
  }, [search]);

  // Checar disponibilidade da fonte ativa
  const checkSource = useCallback(async (sourceId: string) => {
    try {
      const res = await onlineSourceManager.checkAvailability(sourceId);
      setAvailability(res);
    } catch {
      setAvailability({ available: false, reason: 'Erro ao conectar à fonte.' });
    }
  }, []);

  // Carregar catálogo paginado com filtros aplicados
  const loadCatalog = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError(null);

      const filterOptions: SourceFilterOptions = {
        page: targetPage,
        limit: 24,
        search: debouncedSearch.trim() || undefined,
        type: selectedType,
        status: selectedStatus,
        language: selectedLanguage,
        order: selectedOrder,
      };

      try {
        const result = await activeSource.getMangaList(targetPage, filterOptions);
        setMangas(result.mangas);
        setHasMore(result.hasMore);
        setTotal(result.total);
        setPage(targetPage);
      } catch (err: any) {
        if (err.message !== 'Busca cancelada') {
          setError(err.message || 'Erro ao carregar catálogo da fonte.');
          setMangas([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [activeSource, debouncedSearch, selectedType, selectedStatus, selectedLanguage, selectedOrder]
  );

  // Disparar carga quando filtros mudam
  useEffect(() => {
    checkSource(activeSource.id);
    loadCatalog(page);
  }, [activeSource, debouncedSearch, selectedType, selectedStatus, selectedLanguage, selectedOrder, page, checkSource, loadCatalog]);

  const handleSourceChange = (sourceId: string) => {
    onlineSourceManager.setActiveSource(sourceId);
    const newSource = onlineSourceManager.getActiveSource();
    setActiveSource(newSource);
    setPage(1);
    setSearch('');
  };

  const handleClearFilters = () => {
    setSearch('');
    setSelectedType('all');
    setSelectedStatus('all');
    setSelectedLanguage('pt-br');
    setSelectedOrder('popular');
    setPage(1);
  };

  const totalPages = Math.ceil(total / 24) || 1;

  return (
    <div className="slide-up">
      {/* Header com Seletor de Fontes */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-graphite-100">Explorar Catálogo Online</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-accent/20 text-violet-light border border-violet-accent/40">
              API Oficial MangaDex
            </span>
          </div>
          <p className="text-xs text-graphite-400">
            Descubra milhares de mangás, manhwas e manhuas • Download seletivo e leitura offline atômica
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

      {/* Alerta de Fonte com Limitação */}
      {availability && !availability.available && (
        <div className="glass-card rounded-xl p-4 mb-6 border-amber-500/40 bg-amber-500/10 flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">⚠️</span>
          <div className="text-xs">
            <p className="font-bold text-amber-300 mb-0.5">
              Aviso na Fonte: {activeSource.name}
            </p>
            <p className="text-graphite-300 leading-relaxed mb-2">
              {availability.reason}
            </p>
            {availability.protectionType === 'cloudflare_waf' && (
              <p className="text-graphite-400 text-[11px]">
                🛡️ Conforme nossa política de confiabilidade, não contornamos WAFs anti-bot. Recomendamos utilizar a fonte oficial <b>MangaDex</b> para catálogo autorizado com mais de 10.000 obras em Português.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Barra de Pesquisa e Filtros */}
      <div className="glass-card rounded-xl p-4 mb-6 border border-graphite-700/50 space-y-3.5">
        {/* Campo de Busca */}
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-graphite-400 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Pesquisar títulos no MangaDex (ex: Solo Leveling, Frieren, Chainsaw Man)...`}
            className="w-full pl-10 pr-10 py-2.5 bg-graphite-800/80 border border-graphite-700/50 rounded-xl text-sm text-graphite-100 placeholder:text-graphite-500 focus:outline-none focus:border-violet-accent transition shadow-inner"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-graphite-400 hover:text-white p-1 rounded-full text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Linha de Filtros Rápidos */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Tipos de Obra */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-graphite-400 mr-1">Tipo:</span>
            {[
              { id: 'all', label: 'Todos' },
              { id: 'manga', label: '🇯🇵 Mangá' },
              { id: 'manhwa', label: '🇰🇷 Manhwa' },
              { id: 'manhua', label: '🇨🇳 Manhua' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedType(t.id as any);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  selectedType === t.id
                    ? 'bg-violet-accent text-white shadow-sm font-semibold'
                    : 'bg-graphite-800/60 text-graphite-300 hover:bg-graphite-700/60 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Ordenação */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-graphite-400 mr-1">Ordem:</span>
            {[
              { id: 'popular', label: '🔥 Populares' },
              { id: 'latest', label: '⚡ Recentes' },
              { id: 'rating', label: '⭐ Melhores' },
              { id: 'title', label: '🔤 A-Z' },
            ].map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  setSelectedOrder(o.id as any);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  selectedOrder === o.id
                    ? 'bg-graphite-700 text-violet-light font-semibold border border-violet-accent/40 shadow-sm'
                    : 'bg-graphite-800/40 text-graphite-400 hover:bg-graphite-800 hover:text-graphite-200'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filtros Secundários: Idioma e Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-graphite-700/30 text-xs text-graphite-400">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Idioma */}
            <div className="flex items-center gap-1.5">
              <span>Traduções:</span>
              <select
                value={selectedLanguage}
                onChange={(e) => {
                  setSelectedLanguage(e.target.value);
                  setPage(1);
                }}
                className="bg-graphite-800 border border-graphite-700/60 rounded-lg px-2 py-1 text-xs text-graphite-200 focus:outline-none focus:border-violet-accent"
              >
                <option value="pt-br">🇧🇷 Português (PT-BR prioritário)</option>
                <option value="all">🌐 Todos os idiomas</option>
                <option value="en">🇺🇸 Inglês (EN)</option>
                <option value="es">🇪🇸 Espanhol (ES)</option>
              </select>
            </div>

            {/* Status */}
            <div className="flex items-center gap-1.5">
              <span>Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value as any);
                  setPage(1);
                }}
                className="bg-graphite-800 border border-graphite-700/60 rounded-lg px-2 py-1 text-xs text-graphite-200 focus:outline-none focus:border-violet-accent"
              >
                <option value="all">Todos os status</option>
                <option value="ongoing">Em andamento</option>
                <option value="completed">Concluído</option>
                <option value="hiatus">Em hiato</option>
              </select>
            </div>
          </div>

          {/* Reset */}
          {(search || selectedType !== 'all' || selectedStatus !== 'all' || selectedLanguage !== 'pt-br' || selectedOrder !== 'popular') && (
            <button
              onClick={handleClearFilters}
              className="text-violet-light hover:underline text-xs"
            >
              Limpar todos os filtros
            </button>
          )}
        </div>
      </div>

      {/* Resultados e Grid de Obras */}
      {loading ? (
        <div className="py-24 text-center text-graphite-400">
          <div className="w-12 h-12 border-3 border-violet-accent border-t-transparent rounded-full animate-spin mx-auto mb-3.5"></div>
          <p className="text-sm font-semibold text-graphite-200">Consultando API oficial MangaDex...</p>
          <p className="text-xs text-graphite-500 mt-1">Carregando capas e metadados em tempo real</p>
        </div>
      ) : error ? (
        <div className="glass-card rounded-2xl p-10 text-center border border-red-500/20">
          <span className="text-4xl mb-3 block">📡</span>
          <h3 className="text-base font-semibold text-graphite-200 mb-1">Erro de Conexão com MangaDex</h3>
          <p className="text-xs text-graphite-400 max-w-md mx-auto mb-4">{error}</p>
          <button
            onClick={() => loadCatalog(page)}
            className="px-4 py-2 bg-violet-accent hover:bg-violet-dark text-white rounded-lg text-xs font-semibold shadow transition"
          >
            Tentar novamente
          </button>
        </div>
      ) : mangas.length === 0 ? (
        <div className="glass-card rounded-2xl p-14 text-center border border-graphite-700/40">
          <span className="text-4xl mb-3 block">🔍</span>
          <p className="text-base text-graphite-200 font-bold mb-1">Nenhuma obra encontrada</p>
          <p className="text-xs text-graphite-400 max-w-sm mx-auto mb-4">
            Tente buscar por outro termo, alterar os filtros de tipo ou idioma.
          </p>
          <button
            onClick={handleClearFilters}
            className="px-4 py-2 bg-graphite-800 hover:bg-graphite-700 text-violet-light rounded-lg text-xs font-semibold transition"
          >
            Restaurar filtros padrão
          </button>
        </div>
      ) : (
        <>
          {/* Contador de Resultados */}
          <div className="flex items-center justify-between mb-4 px-1 text-xs text-graphite-400">
            <span>
              Mostrando <b>{mangas.length}</b> obras {total > 0 && `(Total: ~${total.toLocaleString()} títulos)`}
            </span>
            <span>
              Página <b>{page}</b> de <b>{totalPages}</b>
            </span>
          </div>

          {/* Grid de Cards */}
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
          <div className="flex items-center justify-center gap-3 py-6 border-t border-graphite-800/80">
            <button
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setPage((prev) => Math.max(1, prev - 1));
              }}
              disabled={page <= 1 || loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-graphite-850 hover:bg-graphite-800 border border-graphite-700 text-graphite-200 disabled:opacity-40 disabled:cursor-not-allowed transition shadow"
            >
              ← Página Anterior
            </button>

            <span className="px-3 py-1.5 rounded-lg bg-graphite-900 border border-graphite-700/60 text-xs font-mono text-graphite-300">
              Página <b className="text-white">{page}</b> / {totalPages}
            </span>

            <button
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setPage((prev) => prev + 1);
              }}
              disabled={!hasMore || loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-graphite-850 hover:bg-graphite-800 border border-graphite-700 text-graphite-200 disabled:opacity-40 disabled:cursor-not-allowed transition shadow"
            >
              Próxima Página →
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
      className="text-left group flex flex-col focus:outline-none transition-transform hover:-translate-y-1.5"
    >
      <div className="w-full aspect-[2/3] rounded-2xl overflow-hidden bg-graphite-900 relative mb-2 border border-graphite-700/50 group-hover:border-violet-accent transition-all shadow-lg group-hover:shadow-violet-accent/20">
        {manga.thumbnailUrl || manga.coverUrl ? (
          <img
            src={manga.thumbnailUrl || manga.coverUrl}
            alt={manga.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-accent/20 to-graphite-900 flex items-center justify-center">
            <span className="text-4xl opacity-30">📕</span>
          </div>
        )}

        {/* Overlay hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5">
          <span className="w-full text-center py-1.5 bg-violet-accent text-white text-xs font-bold rounded-lg shadow-md">
            Ver Detalhes & Caps
          </span>
        </div>

        {/* Badges Flutuantes */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-semibold text-graphite-200 border border-white/10 shadow">
            {typeIcons[manga.type] || '📖'} {manga.type.toUpperCase()}
          </span>
          {manga.hasPtBrChapters && (
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-600/90 text-white text-[9px] font-bold shadow">
              🇧🇷 PT-BR
            </span>
          )}
        </div>

        {/* Status Badge */}
        {manga.status === 'completed' && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-blue-600/80 backdrop-blur-sm text-[9px] font-bold text-white shadow">
            ✓ Finalizado
          </div>
        )}
      </div>

      <p className="text-xs font-bold text-graphite-100 line-clamp-1 group-hover:text-violet-light transition-colors">
        {manga.title}
      </p>
      <p className="text-[10px] text-graphite-400 line-clamp-1 mt-0.5">
        {manga.author ? `${manga.author} • ` : ''}
        {manga.genres.slice(0, 2).join(', ') || 'Mangá'}
      </p>
    </button>
  );
}
