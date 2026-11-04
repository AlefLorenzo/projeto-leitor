import { useState, useEffect } from 'react';
import {
  TelegramManga,
  loadTelegramCatalog,
  getTelegramCatalogStats,
  importTelegramMangaToLibrary,
} from '../services/telegramCatalog';
import {
  fetchRemoteCatalog,
  RemoteCatalogManga,
  DEFAULT_GITHUB_CONFIG,
} from '../services/githubCatalog';
import { ChapterDownloadModal } from '../components/ChapterDownloadModal';
import { NativeImage } from '../components/NativeImage';

interface TelegramPageProps {
  onOpenManga: (id: string) => void;
  onOpenReader?: (mangaId: string, chapterId: string) => void;
}

interface LiveProgress {
  status: string;
  currentManga: string;
  chapter: string;
  progress: string;
  chapterProgress?: number;
  downloadedMb?: string;
  totalMb?: string;
  mangaPercent?: number;
  totalDownloaded?: number;
  timestamp: string;
}

export default function TelegramPage({ onOpenManga, onOpenReader }: TelegramPageProps) {
  const [mangas, setMangas] = useState<TelegramManga[]>([]);
  const [stats, setStats] = useState<{ totalMangas: number; totalChapters: number; totalPages: number; lastUpdated: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importAllStatus, setImportAllStatus] = useState<string | null>(null);
  const [filterWithChapters, setFilterWithChapters] = useState(false);
  const [liveProgress, setLiveProgress] = useState<LiveProgress | null>(null);
  const [selectedMangaForDownload, setSelectedMangaForDownload] = useState<RemoteCatalogManga | null>(null);
  const [catalogBaseUrl, setCatalogBaseUrl] = useState<string>(DEFAULT_GITHUB_CONFIG.rawBaseUrl);

  const loadData = async () => {
    setLoading(true);
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

  useEffect(() => {
    loadData();

    // Polling do progresso em tempo real a cada 1.5s
    const pollProgress = async () => {
      try {
        const res = await fetch('/download-progress.json?t=' + Date.now());
        if (res.ok) {
          const data: LiveProgress = await res.json();
          setLiveProgress(data);
        }
      } catch {}
    };
    pollProgress();
    const interval = setInterval(pollProgress, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleCardClick = async (manga: TelegramManga) => {
    // Se a obra possui capítulos para download, abre o modal de download remoto do GitHub
    if (manga.chapters && manga.chapters.length > 0) {
      const remoteManga: RemoteCatalogManga = {
        id: manga.id,
        title: manga.title,
        synopsis: manga.synopsis,
        coverUrl: manga.coverUrl || '',
        genres: manga.genres || [],
        type: manga.type || 'manhwa',
        status: manga.status || 'ongoing',
        totalChapters: manga.chapters.length,
        chapters: manga.chapters.map((c, i) => ({
          id: c.id || `${manga.id}-cap-${c.number || i + 1}`,
          number: typeof c.number === 'number' ? c.number : i + 1,
          title: c.title || `Capítulo ${c.number || i + 1}`,
          downloadUrl: c.downloadUrl || `obras/${manga.id}/capitulos/cap-${String(c.number || i + 1).padStart(3, '0')}.cbz`,
          sizeBytes: c.sizeBytes || c.size || 15000000,
          extractedSizeBytes: c.extractedSizeBytes,
          sha256: c.sha256,
          pageCount: c.pageCount || c.pages?.length || 15,
        })),
      };
      setSelectedMangaForDownload(remoteManga);
      return;
    }

    try {
      setImportingId(manga.id);
      const finalId = await importTelegramMangaToLibrary(manga.id);
      onOpenManga(finalId);
    } catch (err: any) {
      console.error('Erro ao importar obra:', err);
      alert('Erro ao importar obra: ' + err.message);
    } finally {
      setImportingId(null);
    }
  };

  const handleImportAllWithChapters = async () => {
    setImportAllStatus('Importando obras para a biblioteca...');
    const withChapters = mangas.filter(m => m.chapters && m.chapters.length > 0);
    let count = 0;
    for (const m of withChapters) {
      try {
        await importTelegramMangaToLibrary(m.id);
        count++;
        setImportAllStatus(`Importadas ${count}/${withChapters.length}: ${m.title}`);
      } catch (e) {}
    }
    setImportAllStatus(`✅ ${count} obras completas importadas com sucesso!`);
    setTimeout(() => setImportAllStatus(null), 4000);
  };

  const filteredMangas = mangas.filter(m => {
    const matchesSearch =
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.genres.some(g => g.toLowerCase().includes(search.toLowerCase()));
    
    if (filterWithChapters) {
      return matchesSearch && m.chapters && m.chapters.length > 0;
    }
    return matchesSearch;
  });

  const totalWithChapters = mangas.filter(m => m.chapters && m.chapters.length > 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-violet-accent animate-pulse font-medium">Carregando catálogo do Telegram...</div>
      </div>
    );
  }

  return (
    <div className="slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-graphite-100 mb-1">🌐 Catálogo Git Online</h1>
          <p className="text-sm text-graphite-400">
            {mangas.length} obras extraídas • Clique em qualquer uma para ler na sua Biblioteca
          </p>
        </div>

        <button
          onClick={handleImportAllWithChapters}
          disabled={!!importAllStatus}
          className="self-start sm:self-auto px-4 py-2 bg-gradient-to-r from-violet-accent to-violet-dark hover:brightness-110 text-white rounded-lg text-xs font-semibold shadow-lg shadow-violet-accent/20 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <span>⚡</span>
          <span>{importAllStatus || `Importar Todas com Capítulos (${totalWithChapters})`}</span>
        </button>
      </div>

      {/* Live Extraction Progress Banner com Barra de Progresso Real por Capítulo */}
      {liveProgress && liveProgress.status === 'baixando' && (
        <div className="glass-card rounded-xl p-4 mb-6 border border-violet-accent/50 bg-gradient-to-r from-violet-accent/15 via-graphite-900/80 to-violet-accent/10 shadow-lg shadow-violet-accent/15">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div>
                <span className="text-xs font-bold text-white">⬇️ Extraindo: </span>
                <span className="text-xs font-bold text-violet-light">{liveProgress.currentManga}</span>
                <span className="ml-2 text-[11px] bg-graphite-800 text-violet-light px-2 py-0.5 rounded border border-violet-accent/30 font-mono font-semibold">
                  {liveProgress.chapter} ({liveProgress.progress})
                </span>
              </div>
            </div>

            <div className="text-[11px] text-graphite-300 font-mono">
              Capítulo: <b className="text-emerald-400 font-bold">{liveProgress.chapterProgress || 0}%</b> ({liveProgress.downloadedMb || 0} / {liveProgress.totalMb || 0} MB)
            </div>
          </div>

          {/* Barra de Progresso do Capítulo */}
          <div className="w-full bg-graphite-800/90 rounded-full h-3 overflow-hidden p-0.5 border border-graphite-700/60 shadow-inner">
            <div
              className="bg-gradient-to-r from-violet-accent via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-200 shadow-sm"
              style={{ width: `${Math.max(2, liveProgress.chapterProgress || 0)}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] text-graphite-400 mt-2 font-mono">
            <span>⚡ Modo acelerado (pacotes de 512KB) • Salvo direto no PC</span>
            <span>Progresso da Obra: <b className="text-violet-light">{liveProgress.mangaPercent || 0}%</b></span>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-violet-light">{stats.totalMangas}</p>
            <p className="text-[10px] text-graphite-500">Obras no Catálogo</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-graphite-100">{stats.totalChapters}</p>
            <p className="text-[10px] text-graphite-500">Capítulos Mapeados</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-graphite-100">{totalWithChapters}</p>
            <p className="text-[10px] text-graphite-500">Obras com Capítulos</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-success">
              {new Date(stats.lastUpdated).toLocaleDateString('pt-BR')}
            </p>
            <p className="text-[10px] text-graphite-500">Sincronizado</p>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="glass-card rounded-xl p-4 mb-6 flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite-500">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar entre 527 obras do Telegram..."
            className="w-full pl-9 pr-3 py-2 bg-graphite-800/60 border border-graphite-700/30 rounded-lg text-sm text-graphite-200 placeholder:text-graphite-500 focus:outline-none focus:border-violet-accent/50"
          />
        </div>

        <button
          onClick={() => setFilterWithChapters(!filterWithChapters)}
          className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${
            filterWithChapters
              ? 'bg-violet-accent/20 border-violet-accent text-violet-light'
              : 'bg-graphite-800/40 border-graphite-700/40 text-graphite-400 hover:text-graphite-200'
          }`}
        >
          {filterWithChapters ? '✓ Apenas com Capítulos' : 'Mostrar Todas'}
        </button>
      </div>

      {/* Empty State */}
      {filteredMangas.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center">
          <span className="text-5xl mb-4 block">🔍</span>
          <h3 className="text-lg font-semibold text-graphite-200 mb-2">Nenhum resultado</h3>
          <p className="text-sm text-graphite-400 mb-4">Tente buscar por outro nome ou gênero.</p>
        </div>
      )}

      {/* Mangas Grid */}
      {filteredMangas.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredMangas.map((manga) => (
            <TelegramMangaCard
              key={manga.id}
              manga={manga}
              isImporting={importingId === manga.id}
              onClick={() => handleCardClick(manga)}
            />
          ))}
        </div>
      )}

      {/* Modal de Download Direto do GitHub com Verificação SHA-256 e Descompactação */}
      <ChapterDownloadModal
        isOpen={!!selectedMangaForDownload}
        manga={selectedMangaForDownload}
        baseUrl={catalogBaseUrl}
        onClose={() => setSelectedMangaForDownload(null)}
        onOpenReader={(chapterId) => {
          if (selectedMangaForDownload) {
            const finalMangaId = selectedMangaForDownload.id.startsWith('telegram-')
              ? selectedMangaForDownload.id
              : `telegram-${selectedMangaForDownload.id}`;
            if (onOpenReader) {
              onOpenReader(finalMangaId, chapterId);
            } else {
              onOpenManga(finalMangaId);
            }
          }
        }}
        onDownloaded={() => loadData()}
      />
    </div>
  );
}

function TelegramMangaCard({
  manga,
  isImporting,
  onClick
}: {
  manga: TelegramManga;
  isImporting: boolean;
  onClick: () => void;
}) {
  const typeLabels: Record<string, string> = { manga: '🇯🇵 Mangá', manhwa: '🇰🇷 Manhwa', manhua: '🇨🇳 Manhua' };
  const hasChapters = manga.chapters && manga.chapters.length > 0;

  return (
    <button
      onClick={onClick}
      disabled={isImporting}
      className="text-left group flex flex-col focus:outline-none transition-transform hover:-translate-y-1"
    >
      <div className="w-full aspect-[2/3] rounded-lg overflow-hidden bg-graphite-800 cover-shadow relative mb-1.5 border border-graphite-700/20 group-hover:border-violet-accent/50 transition-colors">
        {manga.coverUrl ? (
          <img
            src={manga.coverUrl}
            alt={manga.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
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
            <span className="text-3xl opacity-30">📕</span>
          </div>
        )}

        {/* Hover / Status Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 text-center">
          <span className="bg-violet-accent text-white px-2.5 py-1 rounded text-xs font-semibold shadow">
            {isImporting ? '⏳ Importando...' : '📥 Adicionar à Biblioteca'}
          </span>
        </div>

        {/* Top Badges */}
        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] text-graphite-200">
          {typeLabels[manga.type] || '📖'}
        </div>

        {hasChapters ? (
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-violet-accent text-[10px] font-bold text-white shadow">
            {manga.chapters.length} cap.
          </div>
        ) : (
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] text-graphite-400">
            Catálogo
          </div>
        )}
      </div>

      <p className="text-xs font-semibold text-graphite-200 truncate group-hover:text-violet-light transition-colors">
        {manga.title}
      </p>
      <p className="text-[10px] text-graphite-500 truncate">
        {hasChapters ? `${manga.chapters.length} capítulos disponíveis` : 'Canal Telegram'}
      </p>
    </button>
  );
}
