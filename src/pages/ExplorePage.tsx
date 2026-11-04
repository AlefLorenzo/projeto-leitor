import { useState, useEffect } from 'react';
import { CatalogManga } from '../types';
import { searchCatalog, getPopularMangas, getLatestMangas, getAllGenres, formatViews, getCatalogManga } from '../services/catalog';
import { getManga } from '../services/database';
import { formatFileSize } from '../services/import';

interface ExplorePageProps {
  onOpenCatalogManga: (id: string) => void;
  onAddToLibrary: (catalogId: string) => void;
}

export default function ExplorePage({ onOpenCatalogManga, onAddToLibrary }: ExplorePageProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<CatalogManga[]>([]);
  const [popular, setPopular] = useState<CatalogManga[]>([]);
  const [latest, setLatest] = useState<CatalogManga[]>([]);
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [genres, setGenres] = useState<string[]>([]);
  const [inLibrary, setInLibrary] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [pop, lat, g] = await Promise.all([
        getPopularMangas(6),
        getLatestMangas(6),
        Promise.resolve(getAllGenres()),
      ]);
      setPopular(pop);
      setLatest(lat);
      setGenres(g);
    };
    load();
  }, []);

  useEffect(() => {
    const doSearch = async () => {
      if (!search && !selectedType && !selectedGenre) {
        setResults([]);
        return;
      }
      setLoading(true);
      const r = await searchCatalog(search, {
        type: selectedType || undefined,
        genre: selectedGenre || undefined,
      });
      setResults(r);
      setLoading(false);
    };
    const timeout = setTimeout(doSearch, 300);
    return () => clearTimeout(timeout);
  }, [search, selectedType, selectedGenre]);

  const isSearching = search || selectedType || selectedGenre;

  return (
    <div className="slide-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-graphite-100 mb-1">Explorar</h1>
        <p className="text-sm text-graphite-400">Descubra novas obras nos catálogos</p>
      </div>

      {/* Search */}
      <div className="glass-card rounded-xl p-4 mb-6">
        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite-500">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar obras..."
            className="w-full pl-9 pr-3 py-2.5 bg-graphite-800/60 border border-graphite-700/30 rounded-lg text-sm text-graphite-200 placeholder:text-graphite-500 focus:outline-none focus:border-violet-accent/50"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-1.5 bg-graphite-800/60 border border-graphite-700/30 rounded-lg text-xs text-graphite-300 focus:outline-none"
          >
            <option value="">Todos os tipos</option>
            <option value="manga">🇯🇵 Mangá</option>
            <option value="manhwa">🇰🇷 Manhwa</option>
            <option value="manhua">🇨🇳 Manhua</option>
          </select>
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="px-3 py-1.5 bg-graphite-800/60 border border-graphite-700/30 rounded-lg text-xs text-graphite-300 focus:outline-none"
          >
            <option value="">Todos os gêneros</option>
            {genres.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          {(search || selectedType || selectedGenre) && (
            <button
              onClick={() => { setSearch(''); setSelectedType(''); setSelectedGenre(''); }}
              className="px-3 py-1.5 text-xs text-graphite-400 hover:text-graphite-200"
            >
              ✕ Limpar
            </button>
          )}
        </div>
      </div>

      {/* Search Results */}
      {isSearching && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-graphite-100 mb-4">
            {loading ? 'Buscando...' : `Resultados (${results.length})`}
          </h2>
          {results.length === 0 && !loading ? (
            <div className="glass-card rounded-xl p-8 text-center">
              <span className="text-3xl mb-2 block">🔍</span>
              <p className="text-sm text-graphite-400">Nenhuma obra encontrada</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {results.map(manga => (
                <CatalogCard key={manga.id} manga={manga} onClick={() => onOpenCatalogManga(manga.id)} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Popular */}
      {!isSearching && (
        <>
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-graphite-100 mb-4">🔥 Populares</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {popular.map(manga => (
                <CatalogCard key={manga.id} manga={manga} onClick={() => onOpenCatalogManga(manga.id)} />
              ))}
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-graphite-100 mb-4">🕐 Atualizados Recentemente</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {latest.map(manga => (
                <CatalogCard key={manga.id} manga={manga} onClick={() => onOpenCatalogManga(manga.id)} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-graphite-100 mb-4">📚 Gêneros</h2>
            <div className="flex flex-wrap gap-2">
              {genres.map(genre => (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(genre)}
                  className="px-3 py-1.5 bg-graphite-800/40 border border-graphite-700/30 rounded-lg text-xs text-graphite-300 hover:border-violet-accent/30 hover:text-violet-light transition-all"
                >
                  {genre}
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function CatalogCard({ manga, onClick }: { manga: CatalogManga; onClick: () => void }) {
  const typeLabels: Record<string, string> = { manga: '🇯🇵', manhwa: '🇰🇷', manhua: '🇨🇳' };
  
  return (
    <button onClick={onClick} className="text-left group">
      <div className="aspect-[2/3] rounded-lg overflow-hidden bg-graphite-800 cover-shadow relative mb-1.5">
        {manga.coverUrl ? (
          <img src={manga.coverUrl} alt={manga.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-accent/20 to-graphite-800 flex items-center justify-center">
            <span className="text-3xl opacity-30">📕</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
          <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium">Ver detalhes</span>
        </div>
        <div className="absolute top-1.5 left-1.5 text-sm">{typeLabels[manga.type]}</div>
        {manga.rating && (
          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-yellow-400">
            ★ {manga.rating}
          </div>
        )}
      </div>
      <p className="text-xs font-medium text-graphite-200 truncate">{manga.title}</p>
      <p className="text-[10px] text-graphite-500">{manga.chapters.length} cap. • {manga.status === 'ongoing' ? 'Em andamento' : 'Concluído'}</p>
    </button>
  );
}
