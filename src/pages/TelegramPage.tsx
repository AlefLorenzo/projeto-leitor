import { useState, useEffect } from 'react';
import { TelegramManga, loadTelegramCatalog, getTelegramCatalogStats } from '../services/telegramCatalog';
import { formatFileSize } from '../services/import';

interface TelegramPageProps {
  onOpenManga: (id: string) => void;
}

export default function TelegramPage({ onOpenManga }: TelegramPageProps) {
  const [mangas, setMangas] = useState<TelegramManga[]>([]);
  const [stats, setStats] = useState<{ totalMangas: number; totalChapters: number; totalPages: number; lastUpdated: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [catalog, catalogStats] = await Promise.all([
          loadTelegramCatalog(),
          getTelegramCatalogStats(),
        ]);
        setMangas(catalog.mangas);
        setStats(catalogStats);
      } catch (error) {
        console.error('Erro ao carregar catálogo:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredMangas = mangas.filter(m => 
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.genres.some(g => g.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-violet-accent animate-pulse">Carregando catálogo...</div>
      </div>
    );
  }

  return (
    <div className="slide-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-graphite-100 mb-1">📱 Telegram</h1>
        <p className="text-sm text-graphite-400">Obras enviadas pelo bot do Telegram</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-violet-light">{stats.totalMangas}</p>
            <p className="text-[10px] text-graphite-500">Obras</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-graphite-100">{stats.totalChapters}</p>
            <p className="text-[10px] text-graphite-500">Capítulos</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-graphite-100">{stats.totalPages}</p>
            <p className="text-[10px] text-graphite-500">Páginas</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-success">
              {new Date(stats.lastUpdated).toLocaleDateString('pt-BR')}
            </p>
            <p className="text-[10px] text-graphite-500">Atualizado</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="glass-card rounded-xl p-4 mb-6">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite-500">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar obras do Telegram..."
            className="w-full pl-9 pr-3 py-2 bg-graphite-800/60 border border-graphite-700/30 rounded-lg text-sm text-graphite-200 placeholder:text-graphite-500 focus:outline-none focus:border-violet-accent/50"
          />
        </div>
      </div>

      {/* Empty State */}
      {filteredMangas.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center">
          <span className="text-5xl mb-4 block">📱</span>
          <h3 className="text-lg font-semibold text-graphite-200 mb-2">
            {mangas.length === 0 ? 'Nenhuma obra no Telegram' : 'Nenhum resultado'}
          </h3>
          <p className="text-sm text-graphite-400 mb-4">
            {mangas.length === 0
              ? 'Envie obras pelo bot do Telegram para vê-las aqui'
              : 'Tente ajustar a pesquisa'}
          </p>
          {mangas.length === 0 && (
            <div className="text-left max-w-md mx-auto bg-graphite-800/30 rounded-lg p-4 mt-4">
              <p className="text-xs text-graphite-300 mb-2 font-semibold">Como usar:</p>
              <ol className="text-xs text-graphite-400 space-y-1 list-decimal list-inside">
                <li>Inicie o bot: <code className="bg-graphite-900 px-1 rounded">/start</code></li>
                <li>Envie um arquivo CBZ, ZIP ou imagem</li>
                <li>Responda com o nome da obra</li>
                <li>Pronto! A obra aparecerá aqui</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Mangas Grid */}
      {filteredMangas.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredMangas.map((manga) => (
            <TelegramMangaCard
              key={manga.id}
              manga={manga}
              onClick={() => onOpenManga(`telegram-${manga.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TelegramMangaCard({ manga, onClick }: { manga: TelegramManga; onClick: () => void }) {
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
          <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium">Importar</span>
        </div>
        <div className="absolute top-1.5 left-1.5 text-sm">{typeLabels[manga.type]}</div>
        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white">
          📱 Telegram
        </div>
      </div>
      <p className="text-xs font-medium text-graphite-200 truncate">{manga.title}</p>
      <p className="text-[10px] text-graphite-500">{manga.chapters.length} cap.</p>
    </button>
  );
}
