import { useState, useEffect, useCallback, useRef } from 'react';
import { useReader, useMangaDetails } from '../hooks/useMangaStore';
import { getSettings } from '../services/settings';
import { ReadingDirection } from '../types';

interface ReaderPageProps {
  mangaId: string;
  chapterId: string;
  onBack: () => void;
  onChangeChapter: (chapterId: string) => void;
}

export default function ReaderPage({ mangaId, chapterId, onBack, onChangeChapter }: ReaderPageProps) {
  const { pages, currentPage, setCurrentPage, loading, totalPages, saveReadingProgress } = useReader(mangaId, chapterId);
  const { manga, chapters } = useMangaDetails(mangaId);
  const [showControls, setShowControls] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [showSettings, setShowSettings] = useState(false);
  const [showChapterList, setShowChapterList] = useState(false);
  const [readingDirection, setReadingDirection] = useState<ReadingDirection>('rtl');
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const currentChapter = chapters.find(c => c.id === chapterId);
  const chapterIndex = chapters.findIndex(c => c.id === chapterId);

  // Load settings
  useEffect(() => {
    getSettings().then(s => {
      setBrightness(s.brightness);
      setReadingDirection(manga?.readingDirection || s.readerMode);
    });
  }, [manga]);

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setShowControls(true);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    resetControlsTimeout();
    return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
  }, [currentPage, resetControlsTimeout]);

  // Save progress on page change
  useEffect(() => {
    if (pages.length > 0 && !loading) {
      saveReadingProgress(currentPage);
    }
  }, [currentPage, pages.length, loading, saveReadingProgress]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          if (readingDirection === 'rtl') goToPrevPage();
          else goToNextPage();
          break;
        case 'ArrowLeft':
          if (readingDirection === 'rtl') goToNextPage();
          else goToPrevPage();
          break;
        case 'ArrowUp':
          e.preventDefault();
          goToPrevPage();
          break;
        case 'ArrowDown':
          e.preventDefault();
          goToNextPage();
          break;
        case 'Escape':
          onBack();
          break;
        case ' ':
          e.preventDefault();
          goToNextPage();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readingDirection, currentPage, totalPages, chapterIndex, chapters.length]);

  const goToNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    } else if (chapterIndex < chapters.length - 1) {
      onChangeChapter(chapters[chapterIndex + 1].id);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    } else if (chapterIndex > 0) {
      onChangeChapter(chapters[chapterIndex - 1].id);
    }
  };

  const handlePageClick = (e: React.MouseEvent) => {
    resetControlsTimeout();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    if (x < width * 0.3) {
      if (readingDirection === 'rtl') goToNextPage();
      else goToPrevPage();
    } else if (x > width * 0.7) {
      if (readingDirection === 'rtl') goToPrevPage();
      else goToNextPage();
    } else {
      setShowControls(!showControls);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-violet-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-graphite-400 text-sm">Carregando páginas...</p>
        </div>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <span className="text-4xl mb-4 block">📭</span>
          <p className="text-graphite-400">Nenhuma página neste capítulo</p>
          <button onClick={onBack} className="mt-4 text-sm text-violet-light hover:underline">Voltar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col" style={{ filter: `brightness(${brightness}%)` }}>
      {/* Top Bar */}
      <div className={`absolute top-0 left-0 right-0 z-10 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'}`}>
        <div className="bg-gradient-to-b from-black/95 via-black/80 to-transparent px-4 py-3">
          <div className="flex items-center justify-between">
            <button onClick={onBack} className="text-white/80 hover:text-white text-sm flex items-center gap-2 px-2 py-1 rounded hover:bg-white/10">
              ← Voltar
            </button>
            <div className="text-center flex-1 mx-4">
              <p className="text-sm font-medium text-white truncate">{manga?.title}</p>
              <p className="text-xs text-white/60">{currentChapter?.title}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowChapterList(!showChapterList)} className="text-white/80 hover:text-white text-sm px-2 py-1 rounded hover:bg-white/10">
                📋
              </button>
              <button onClick={() => setShowSettings(!showSettings)} className="text-white/80 hover:text-white text-sm px-2 py-1 rounded hover:bg-white/10">
                ⚙️
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reader Content */}
      <div className="flex-1 flex items-center justify-center overflow-hidden cursor-pointer" onClick={handlePageClick}>
        {readingDirection === 'vertical' ? (
          <div className="w-full h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="max-w-2xl mx-auto">
              {pages.map((page, index) => (
                <img key={page.id} src={page.imageUrl} alt={`Página ${index + 1}`} className="w-full" loading="lazy" />
              ))}
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={pages[currentPage]?.imageUrl}
              alt={`Página ${currentPage + 1}`}
              className="max-h-full max-w-full object-contain transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
              draggable={false}
            />
            {/* Navigation zones visual feedback */}
            <div className="absolute left-0 top-0 bottom-0 w-1/3 pointer-events-none"></div>
            <div className="absolute right-0 top-0 bottom-0 w-1/3 pointer-events-none"></div>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className={`absolute bottom-0 left-0 right-0 z-10 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'}`}>
        <div className="bg-gradient-to-t from-black/95 via-black/80 to-transparent px-4 py-3">
          {/* Progress bar */}
          <div className="mb-2">
            <div
              className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percent = x / rect.width;
                const page = Math.floor(percent * totalPages);
                setCurrentPage(Math.max(0, Math.min(totalPages - 1, page)));
              }}
            >
              <div className="progress-bar h-full" style={{ width: `${((currentPage + 1) / totalPages) * 100}%` }}></div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={(e) => { e.stopPropagation(); goToPrevPage(); }}
              className="text-white/80 hover:text-white text-sm px-3 py-1 rounded hover:bg-white/10 disabled:opacity-30"
              disabled={currentPage === 0 && chapterIndex === 0}
            >
              {readingDirection === 'rtl' ? '▶' : '◀'} Anterior
            </button>

            <div className="text-center">
              <span className="text-xs text-white/80 font-mono">{currentPage + 1} / {totalPages}</span>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); goToNextPage(); }}
              className="text-white/80 hover:text-white text-sm px-3 py-1 rounded hover:bg-white/10 disabled:opacity-30"
              disabled={currentPage === totalPages - 1 && chapterIndex === chapters.length - 1}
            >
              Próximo {readingDirection === 'rtl' ? '◀' : '▶'}
            </button>
          </div>

          {/* Chapter navigation */}
          <div className="flex items-center justify-center gap-4 mt-2">
            {chapterIndex > 0 && (
              <button
                onClick={() => onChangeChapter(chapters[chapterIndex - 1].id)}
                className="text-xs text-white/60 hover:text-white px-2 py-1 rounded hover:bg-white/10"
              >
                ← Cap. anterior
              </button>
            )}
            {chapterIndex < chapters.length - 1 && (
              <button
                onClick={() => onChangeChapter(chapters[chapterIndex + 1].id)}
                className="text-xs text-white/60 hover:text-white px-2 py-1 rounded hover:bg-white/10"
              >
                Próx. cap. →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-16 right-4 z-20 glass-card rounded-xl p-4 w-72" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-sm font-semibold text-graphite-100 mb-3">Configurações do Leitor</h3>
          
          {/* Zoom */}
          <div className="mb-3">
            <label className="text-xs text-graphite-400 mb-1 block">Zoom: {Math.round(zoom * 100)}%</label>
            <input type="range" min="0.5" max="3" step="0.1" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="w-full" />
          </div>

          {/* Brightness */}
          <div className="mb-3">
            <label className="text-xs text-graphite-400 mb-1 block">☀️ Brilho: {brightness}%</label>
            <input type="range" min="20" max="100" value={brightness} onChange={(e) => setBrightness(parseInt(e.target.value))} className="w-full" />
          </div>

          {/* Reading Direction */}
          <div className="mb-3">
            <label className="text-xs text-graphite-400 mb-1 block">Modo de Leitura</label>
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => setReadingDirection('rtl')}
                className={`text-[10px] p-1.5 rounded ${readingDirection === 'rtl' ? 'bg-violet-accent/20 text-violet-light border border-violet-accent/40' : 'bg-graphite-800 text-graphite-400'}`}
              >
                🇯🇵 Mangá
              </button>
              <button
                onClick={() => setReadingDirection('vertical')}
                className={`text-[10px] p-1.5 rounded ${readingDirection === 'vertical' ? 'bg-violet-accent/20 text-violet-light border border-violet-accent/40' : 'bg-graphite-800 text-graphite-400'}`}
              >
                🇰🇷 Manhwa
              </button>
              <button
                onClick={() => setReadingDirection('ltr')}
                className={`text-[10px] p-1.5 rounded ${readingDirection === 'ltr' ? 'bg-violet-accent/20 text-violet-light border border-violet-accent/40' : 'bg-graphite-800 text-graphite-400'}`}
              >
                🇨🇳 Manhua
              </button>
            </div>
          </div>

          <button onClick={() => { setZoom(1); setBrightness(100); }} className="w-full text-xs text-graphite-400 hover:text-graphite-200 py-1 border-t border-graphite-700/30 mt-2">
            Resetar configurações
          </button>
        </div>
      )}

      {/* Chapter List Panel */}
      {showChapterList && (
        <div className="absolute top-16 right-4 z-20 glass-card rounded-xl p-4 w-72 max-h-[60vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-sm font-semibold text-graphite-100 mb-3">Capítulos</h3>
          <div className="space-y-1">
            {chapters.map((ch, idx) => (
              <button
                key={ch.id}
                onClick={() => { onChangeChapter(ch.id); setShowChapterList(false); }}
                className={`w-full text-left px-3 py-2 rounded text-xs transition-all ${
                  ch.id === chapterId
                    ? 'bg-violet-accent/20 text-violet-light border border-violet-accent/30'
                    : 'text-graphite-400 hover:bg-graphite-800/50 hover:text-graphite-200'
                }`}
              >
                <span className="font-medium">{ch.title}</span>
                <span className="text-graphite-500 ml-2">({ch.pagesCount} págs.)</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
