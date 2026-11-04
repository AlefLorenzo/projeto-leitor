import { useState, useEffect, useCallback, useRef } from 'react';
import { useReader } from '../hooks/useMangaStore';
import { useMangaDetails } from '../hooks/useMangaStore';
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
  const [showSettings, setShowSettings] = useState(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  const currentChapter = chapters.find(c => c.id === chapterId);
  const chapterIndex = chapters.findIndex(c => c.id === chapterId);

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
      const direction = manga?.readingDirection || 'rtl';
      
      switch (e.key) {
        case 'ArrowRight':
          if (direction === 'rtl') goToPrevPage();
          else goToNextPage();
          break;
        case 'ArrowLeft':
          if (direction === 'rtl') goToNextPage();
          else goToPrevPage();
          break;
        case 'ArrowUp':
          goToPrevPage();
          break;
        case 'ArrowDown':
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
  }, [manga?.readingDirection]);

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
    const direction = manga?.readingDirection || 'rtl';

    // Click zones
    if (x < width * 0.3) {
      if (direction === 'rtl') goToNextPage();
      else goToPrevPage();
    } else if (x > width * 0.7) {
      if (direction === 'rtl') goToPrevPage();
      else goToNextPage();
    } else {
      setShowControls(!showControls);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-violet-accent animate-pulse">Carregando páginas...</div>
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

  const direction = manga?.readingDirection || 'rtl';

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Top Bar */}
      <div className={`absolute top-0 left-0 right-0 z-10 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'}`}>
        <div className="bg-gradient-to-b from-black/90 to-transparent px-4 py-3">
          <div className="flex items-center justify-between">
            <button onClick={onBack} className="text-white/80 hover:text-white text-sm flex items-center gap-2">
              ← Voltar
            </button>
            <div className="text-center">
              <p className="text-sm font-medium text-white truncate max-w-[200px]">{manga?.title}</p>
              <p className="text-xs text-white/60">{currentChapter?.title}</p>
            </div>
            <button onClick={() => setShowSettings(!showSettings)} className="text-white/80 hover:text-white text-sm">
              ⚙️
            </button>
          </div>
        </div>
      </div>

      {/* Reader Content */}
      <div className="flex-1 flex items-center justify-center overflow-hidden" onClick={handlePageClick}>
        {direction === 'vertical' ? (
          // Vertical scroll mode (Manhwa)
          <div className="w-full h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="max-w-2xl mx-auto">
              {pages.map((page, index) => (
                <img
                  key={page.id}
                  src={page.imageUrl}
                  alt={`Página ${index + 1}`}
                  className="w-full"
                  loading="lazy"
                />
              ))}
            </div>
          </div>
        ) : (
          // Page-by-page mode (Manga/Manhua)
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={pages[currentPage]?.imageUrl}
              alt={`Página ${currentPage + 1}`}
              className="max-h-full max-w-full object-contain transition-transform"
              style={{ transform: `scale(${zoom})` }}
              draggable={false}
            />
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className={`absolute bottom-0 left-0 right-0 z-10 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full'}`}>
        <div className="bg-gradient-to-t from-black/90 to-transparent px-4 py-3">
          {/* Progress bar */}
          <div className="mb-2">
            <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer"
              onClick={(e) => {
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
              className="text-white/80 hover:text-white text-sm px-3 py-1"
              disabled={currentPage === 0 && chapterIndex === 0}
            >
              {direction === 'rtl' ? '▶' : '◀'} Anterior
            </button>

            <span className="text-xs text-white/60">
              {currentPage + 1} / {totalPages}
            </span>

            <button
              onClick={(e) => { e.stopPropagation(); goToNextPage(); }}
              className="text-white/80 hover:text-white text-sm px-3 py-1"
              disabled={currentPage === totalPages - 1 && chapterIndex === chapters.length - 1}
            >
              Próximo {direction === 'rtl' ? '◀' : '▶'}
            </button>
          </div>

          {/* Chapter navigation */}
          <div className="flex items-center justify-center gap-4 mt-2">
            {chapterIndex > 0 && (
              <button
                onClick={() => onChangeChapter(chapters[chapterIndex - 1].id)}
                className="text-xs text-white/60 hover:text-white"
              >
                ← Cap. anterior
              </button>
            )}
            {chapterIndex < chapters.length - 1 && (
              <button
                onClick={() => onChangeChapter(chapters[chapterIndex + 1].id)}
                className="text-xs text-white/60 hover:text-white"
              >
                Próx. cap. →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-16 right-4 z-20 glass-card rounded-xl p-4 w-64" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-sm font-semibold text-graphite-100 mb-3">Configurações</h3>
          
          {/* Zoom */}
          <div className="mb-3">
            <label className="text-xs text-graphite-400 mb-1 block">Zoom: {Math.round(zoom * 100)}%</label>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Reading Direction */}
          <div className="mb-3">
            <label className="text-xs text-graphite-400 mb-1 block">Modo de Leitura</label>
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => {/* Would change direction */}}
                className={`text-[10px] p-1.5 rounded ${direction === 'rtl' ? 'bg-violet-accent/20 text-violet-light' : 'bg-graphite-800 text-graphite-400'}`}
              >
                Mangá
              </button>
              <button
                onClick={() => {/* Would change direction */}}
                className={`text-[10px] p-1.5 rounded ${direction === 'vertical' ? 'bg-violet-accent/20 text-violet-light' : 'bg-graphite-800 text-graphite-400'}`}
              >
                Manhwa
              </button>
              <button
                onClick={() => {/* Would change direction */}}
                className={`text-[10px] p-1.5 rounded ${direction === 'ltr' ? 'bg-violet-accent/20 text-violet-light' : 'bg-graphite-800 text-graphite-400'}`}
              >
                Manhua
              </button>
            </div>
          </div>

          <button
            onClick={() => { setZoom(1); }}
            className="w-full text-xs text-graphite-400 hover:text-graphite-200 py-1"
          >
            Resetar zoom
          </button>
        </div>
      )}
    </div>
  );
}
