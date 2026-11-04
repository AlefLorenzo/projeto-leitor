import { useState, useEffect, useCallback, useRef } from 'react';
import { useMangaDetails } from '../hooks/useMangaStore';
import { getPagesByChapter } from '../services/database';
import { 
  saveEnhancedProgress, 
  getEnhancedProgress,
  getPreviousChapter,
  getNextChapter,
  isFirstChapter,
  isLastChapter,
  getChaptersWithStatus,
  addReadingTime,
} from '../services/readingProgress';
import { getSettings, saveSettings } from '../services/settings';
import { Page, Chapter, ReadingProgress, ReadingDirection, MangaSettings } from '../types';
import { useToast } from '../components/Toast';

interface ReaderPageProps {
  mangaId: string;
  chapterId: string;
  onBack: () => void;
  onChangeChapter: (chapterId: string) => void;
}

export default function ReaderPage({ mangaId, chapterId, onBack, onChangeChapter }: ReaderPageProps) {
  const { addToast } = useToast();
  const { manga, chapters } = useMangaDetails(mangaId);
  
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChapterList, setShowChapterList] = useState(false);
  const [showBoundaryMessage, setShowBoundaryMessage] = useState<string | null>(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showPageSelector, setShowPageSelector] = useState(false);
  
  // Reader settings
  const [zoom, setZoom] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [readingDirection, setReadingDirection] = useState<ReadingDirection>('rtl');
  const [scrollPosition, setScrollPosition] = useState(0);
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [fitMode, setFitMode] = useState<'width' | 'height' | 'original'>('width');
  
  // Progress tracking
  const [progress, setProgress] = useState<ReadingProgress | null>(null);
  const [isFirst, setIsFirst] = useState(false);
  const [isLast, setIsLast] = useState(false);
  const [chapterStatus, setChapterStatus] = useState<'not_started' | 'in_progress' | 'completed'>('not_started');
  
  // Gesture tracking
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [pinchStart, setPinchStart] = useState<number | null>(null);
  
  // Timing
  const startTimeRef = useRef<number>(Date.now());
  const lastSaveRef = useRef<number>(Date.now());
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);

  const currentChapter = chapters.find(c => c.id === chapterId);
  const chapterIndex = chapters.findIndex(c => c.id === chapterId);

  // Load chapter data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const chapterPages = await getPagesByChapter(chapterId);
        setPages(chapterPages);

        // Load settings
        const settings = await getSettings();
        setBrightness(settings.brightness);
        setReadingDirection(manga?.customSettings?.readingDirection || manga?.readingDirection || settings.readerMode);
        setImmersiveMode(settings.immersiveMode);
        setZoom(manga?.customSettings?.zoomLevel || settings.zoomLevel || 1);

        // Load progress
        const savedProgress = await getEnhancedProgress(mangaId, chapterId);
        if (savedProgress && !savedProgress.completed) {
          setCurrentPage(Math.max(0, savedProgress.pageNumber - 1));
          setProgress(savedProgress);
          setChapterStatus('in_progress');
          
          // Restore scroll position for vertical mode
          if (savedProgress.scrollPosition && readingDirection === 'vertical') {
            setTimeout(() => {
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = savedProgress.scrollPosition!;
              }
            }, 100);
          }
        } else {
          setCurrentPage(0);
          setChapterStatus('not_started');
        }

        // Check boundaries
        const [first, last] = await Promise.all([
          isFirstChapter(mangaId, chapterId),
          isLastChapter(mangaId, chapterId),
        ]);
        setIsFirst(first);
        setIsLast(last);

        startTimeRef.current = Date.now();
      } catch (error) {
        console.error('Error loading chapter:', error);
        addToast('Erro ao carregar capítulo', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [chapterId, mangaId, manga, readingDirection, addToast]);

  // Save progress periodically
  const saveCurrentProgress = useCallback(async () => {
    if (pages.length === 0 || loading) return;

    const now = Date.now();
    // Save at most every 5 seconds to avoid excessive writes
    if (now - lastSaveRef.current < 5000) return;
    lastSaveRef.current = now;

    try {
      const newProgress = await saveEnhancedProgress(
        mangaId,
        chapterId,
        currentPage + 1,
        pages.length,
        readingDirection === 'vertical' ? scrollPosition : undefined,
        pages[currentPage]?.id
      );
      setProgress(newProgress);
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  }, [mangaId, chapterId, currentPage, pages, loading, readingDirection, scrollPosition]);

  // Auto-save on page change
  useEffect(() => {
    saveCurrentProgress();
  }, [currentPage, saveCurrentProgress]);

  // Save on unmount
  useEffect(() => {
    return () => {
      // Save reading time
      const readingSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      if (readingSeconds > 0) {
        addReadingTime(mangaId, chapterId, readingSeconds).catch(console.error);
      }
      // Final progress save
      saveCurrentProgress();
    };
  }, [mangaId, chapterId, saveCurrentProgress, addReadingTime]);

  // Controls visibility management
  const showControlsFn = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setShowControls(true);
    if (!immersiveMode) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [immersiveMode]);

  const hideControls = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setShowControls(false);
  }, []);

  const toggleControls = useCallback(() => {
    setShowControls(prev => {
      const newState = !prev;
      if (newState && !immersiveMode) {
        // If showing controls, start auto-hide timer
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
      } else {
        // If hiding controls, clear timer
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      }
      return newState;
    });
  }, [immersiveMode]);

  // Show controls on page change (but don't force if user explicitly hid them)
  useEffect(() => {
    // Only auto-show on initial load, not on every page change
    if (pages.length > 0 && !loading) {
      showControlsFn();
    }
    return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
  }, [pages.length, loading]); // Remove currentPage from dependencies

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          if (readingDirection === 'rtl') goToPrevPage();
          else goToNextPage();
          break;
        case 'ArrowLeft':
          e.preventDefault();
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
          handleExit();
          break;
        case ' ':
          e.preventDefault();
          goToNextPage();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readingDirection, currentPage, pages.length, chapterIndex, chapters.length]);

  const handleExit = async () => {
    await saveCurrentProgress();
    onBack();
  };

  const goToNextPage = useCallback(() => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(prev => prev + 1);
      showControlsFn();
    } else if (!isLast) {
      // Show boundary message and offer next chapter
      setShowBoundaryMessage('last_page');
    } else {
      setShowBoundaryMessage('last_chapter');
    }
  }, [currentPage, pages.length, isLast, showControlsFn]);

  const goToPrevPage = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
      showControlsFn();
    } else if (!isFirst) {
      setShowBoundaryMessage('first_page');
    } else {
      setShowBoundaryMessage('first_chapter');
    }
  }, [currentPage, isFirst, showControlsFn]);

  // toggleControls já foi definido acima

  // Handle tap/click on page - unified for desktop and mobile
  const handlePageInteraction = (clientX: number, clientY: number, isDoubleClick: boolean) => {
    if (isDoubleClick) {
      // Double tap - toggle zoom
      setZoom(prev => prev === 1 ? 1.5 : 1);
      return;
    }

    // Single tap - check navigation zones
    const container = document.querySelector('[data-reader-container]');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const width = rect.width;

    // Navigation zones (30% left, 40% center, 30% right)
    if (x < width * 0.3) {
      if (readingDirection === 'rtl') goToNextPage();
      else goToPrevPage();
    } else if (x > width * 0.7) {
      if (readingDirection === 'rtl') goToPrevPage();
      else goToNextPage();
    } else {
      toggleControls();
    }
  };

  // Desktop click handler
  const handlePageClick = (e: React.MouseEvent) => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    lastTapRef.current = now;

    // Double tap detection
    const isDoubleClick = timeSinceLastTap < 300 && timeSinceLastTap > 0;
    handlePageInteraction(e.clientX, e.clientY, isDoubleClick);
  };

  // Mobile touch handler - only handle taps, not swipes
  const handleTouchTap = (e: React.TouchEvent) => {
    // Only handle if it's a simple tap (no swipe)
    if (!dragStart) return;
    
    const touch = e.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - dragStart.x);
    const deltaY = Math.abs(touch.clientY - dragStart.y);
    
    // If moved more than 10px, it's a swipe, not a tap
    if (deltaX > 10 || deltaY > 10) return;

    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    lastTapRef.current = now;

    const isDoubleClick = timeSinceLastTap < 300 && timeSinceLastTap > 0;
    handlePageInteraction(touch.clientX, touch.clientY, isDoubleClick);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX, y: touch.clientY });
    } else if (e.touches.length === 2) {
      // Pinch start
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      setPinchStart(distance);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStart !== null) {
      // Pinch zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const scale = distance / pinchStart;
      setZoom(prev => Math.max(0.5, Math.min(3, prev * scale)));
      setPinchStart(distance);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStart && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - dragStart.x;
      const deltaY = touch.clientY - dragStart.y;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Swipe detection (minimum 50px, horizontal dominant)
      if (absX > 50 && absX > absY * 1.5) {
        if (deltaX > 0) {
          // Swipe right
          if (readingDirection === 'rtl') goToNextPage();
          else goToPrevPage();
        } else {
          // Swipe left
          if (readingDirection === 'rtl') goToPrevPage();
          else goToNextPage();
        }
      } else {
        // It's a tap, not a swipe
        handleTouchTap(e);
      }
    }
    setDragStart(null);
    setPinchStart(null);
  };

  const handleChangeChapter = async (newChapterId: string) => {
    await saveCurrentProgress();
    onChangeChapter(newChapterId);
  };

  const handleGoToPreviousChapter = async () => {
    const prev = await getPreviousChapter(mangaId, chapterId);
    if (prev) {
      setShowBoundaryMessage(null);
      await handleChangeChapter(prev.id);
    }
  };

  const handleGoToNextChapter = async () => {
    const next = await getNextChapter(mangaId, chapterId);
    if (next) {
      setShowBoundaryMessage(null);
      await handleChangeChapter(next.id);
    }
  };

  const handleGoToFirstChapter = async () => {
    if (chapters.length > 0) {
      await handleChangeChapter(chapters[0].id);
    }
  };

  const handleGoToLastChapter = async () => {
    if (chapters.length > 0) {
      await handleChangeChapter(chapters[chapters.length - 1].id);
    }
  };

  const handleGoToPage = (pageIndex: number) => {
    setCurrentPage(Math.max(0, Math.min(pages.length - 1, pageIndex)));
    setShowPageSelector(false);
  };

  const handleMarkAsCompleted = async () => {
    if (pages.length > 0) {
      await saveEnhancedProgress(mangaId, chapterId, pages.length, pages.length);
      setChapterStatus('completed');
      addToast('Capítulo marcado como concluído', 'success');
    }
  };

  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current && readingDirection === 'vertical') {
      const scrollTop = scrollContainerRef.current.scrollTop;
      setScrollPosition(scrollTop);
      
      // Calculate current page based on scroll position
      const totalHeight = scrollContainerRef.current.scrollHeight;
      const viewportHeight = scrollContainerRef.current.clientHeight;
      const pageHeight = totalHeight / pages.length;
      const newPage = Math.min(
        pages.length - 1,
        Math.floor(scrollTop / pageHeight)
      );
      if (newPage !== currentPage) {
        setCurrentPage(newPage);
      }
    }
  }, [readingDirection, pages.length, currentPage]);

  const handleDirectionChange = async (newDirection: ReadingDirection) => {
    setReadingDirection(newDirection);
    // Save per-manga setting
    if (manga) {
      const customSettings: MangaSettings = {
        ...manga.customSettings,
        readingDirection: newDirection,
      };
      manga.customSettings = customSettings;
      // Would save to DB here
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-violet-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-graphite-400 text-sm">Carregando capítulo...</p>
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

  const progressPercent = pages.length > 0 ? Math.round(((currentPage + 1) / pages.length) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col" style={{ filter: `brightness(${brightness}%)` }}>
      {/* Top Bar */}
      <div className={`absolute top-0 left-0 right-0 z-20 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'}`}>
        <div className="bg-gradient-to-b from-black/95 via-black/80 to-transparent px-4 py-3">
          <div className="flex items-center justify-between">
            <button onClick={handleExit} className="text-white/80 hover:text-white text-sm flex items-center gap-2 px-2 py-1 rounded hover:bg-white/10">
              ← Voltar
            </button>
            <div className="text-center flex-1 mx-4">
              <p className="text-sm font-medium text-white truncate">{manga?.title}</p>
              <p className="text-xs text-white/60">{currentChapter?.title}</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowOptionsMenu(!showOptionsMenu)} 
                className="text-white/80 hover:text-white text-sm px-2 py-1 rounded hover:bg-white/10" 
                title="Menu de opções"
              >
                ⋮
              </button>
              <button 
                onClick={() => setShowChapterList(!showChapterList)} 
                className="text-white/80 hover:text-white text-sm px-2 py-1 rounded hover:bg-white/10" 
                title="Índice de capítulos"
              >
                📋
              </button>
              <button 
                onClick={() => setShowSettings(!showSettings)} 
                className="text-white/80 hover:text-white text-sm px-2 py-1 rounded hover:bg-white/10" 
                title="Configurações"
              >
                ⚙️
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reader Content */}
      <div 
        data-reader-container
        className="flex-1 flex items-center justify-center overflow-hidden cursor-pointer relative" 
        onClick={handlePageClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={(e) => {
          handleTouchEnd(e);
          // Prevent onClick from firing on mobile after touch
          if ('ontouchstart' in window) {
            e.preventDefault();
          }
        }}
      >
        {readingDirection === 'vertical' ? (
          <div 
            ref={scrollContainerRef}
            className="w-full h-full overflow-y-auto"
            onScroll={handleScroll}
          >
            <div className="max-w-2xl mx-auto">
              {pages.map((page, index) => (
                <img 
                  key={page.id} 
                  src={page.imageUrl} 
                  alt={`Página ${index + 1}`} 
                  className="w-full" 
                  loading="lazy"
                  data-page-index={index}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={pages[currentPage]?.imageUrl}
              alt={`Página ${currentPage + 1}`}
              className={`transition-transform duration-200 ${
                fitMode === 'width' ? 'max-w-full' : 
                fitMode === 'height' ? 'max-h-full' : ''
              }`}
              style={{ 
                transform: `scale(${zoom})`,
                objectFit: fitMode === 'original' ? 'none' : 'contain'
              }}
              draggable={false}
            />
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className={`absolute bottom-0 left-0 right-0 z-20 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'}`}>
        <div className="bg-gradient-to-t from-black/95 via-black/80 to-transparent px-4 py-3">
          {/* Progress bar with slider */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-white/60 font-mono">{currentPage + 1}</span>
              <div
                className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer relative"
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const percent = x / rect.width;
                  const page = Math.floor(percent * pages.length);
                  handleGoToPage(page);
                }}
              >
                <div className="progress-bar h-full transition-all" style={{ width: `${progressPercent}%` }}></div>
              </div>
              <span className="text-xs text-white/60 font-mono">{pages.length}</span>
            </div>
            <div className="text-center">
              <span className="text-xs text-white/80">{progressPercent}%</span>
              {chapterStatus === 'in_progress' && (
                <span className="text-[10px] text-violet-light ml-2">• Em andamento</span>
              )}
              {chapterStatus === 'completed' && (
                <span className="text-[10px] text-success ml-2">• ✓ Concluído</span>
              )}
            </div>
          </div>

          {/* Main controls */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); handleGoToPreviousChapter(); }}
              className="text-white/80 hover:text-white text-xs px-2 py-2 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={isFirst}
              title="Capítulo anterior"
            >
              ⏮
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goToPrevPage(); }}
              className="text-white/80 hover:text-white text-sm px-3 py-2 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={currentPage === 0 && isFirst}
              title="Página anterior"
            >
              {readingDirection === 'rtl' ? '▶' : '◀'}
            </button>
            
            <button
              onClick={(e) => { e.stopPropagation(); setShowPageSelector(!showPageSelector); }}
              className="flex-1 max-w-[120px] text-center py-2 rounded bg-white/5 hover:bg-white/10 text-xs text-white/80"
              title="Ir para página"
            >
              Pág. {currentPage + 1} / {pages.length}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); goToNextPage(); }}
              className="text-white/80 hover:text-white text-sm px-3 py-2 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={currentPage === pages.length - 1 && isLast}
              title="Próxima página"
            >
              {readingDirection === 'rtl' ? '◀' : '▶'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleGoToNextChapter(); }}
              className="text-white/80 hover:text-white text-xs px-2 py-2 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={isLast}
              title="Próximo capítulo"
            >
              ⏭
            </button>
          </div>

          {/* Chapter info */}
          <div className="flex items-center justify-center gap-4 mt-2">
            {chapterIndex > 0 && (
              <button
                onClick={() => handleChangeChapter(chapters[chapterIndex - 1].id)}
                className="text-xs text-white/60 hover:text-white px-2 py-1 rounded hover:bg-white/10"
              >
                ← Cap. anterior
              </button>
            )}
            <span className="text-xs text-white/40">
              {currentChapter?.title}
            </span>
            {chapterIndex < chapters.length - 1 && (
              <button
                onClick={() => handleChangeChapter(chapters[chapterIndex + 1].id)}
                className="text-xs text-white/60 hover:text-white px-2 py-1 rounded hover:bg-white/10"
              >
                Próx. cap. →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Options Menu */}
      {showOptionsMenu && (
        <div className="absolute top-16 right-4 z-30 glass-card rounded-xl p-2 w-64" onClick={(e) => e.stopPropagation()}>
          <div className="space-y-1">
            <button
              onClick={() => { onBack(); setShowOptionsMenu(false); }}
              className="w-full text-left px-3 py-2 text-xs text-graphite-300 hover:bg-graphite-800/50 rounded transition-colors"
            >
              📚 Ir para biblioteca
            </button>
            <button
              onClick={() => { setShowChapterList(true); setShowOptionsMenu(false); }}
              className="w-full text-left px-3 py-2 text-xs text-graphite-300 hover:bg-graphite-800/50 rounded transition-colors"
            >
              📋 Índice de capítulos
            </button>
            <div className="border-t border-graphite-700/30 my-1"></div>
            <button
              onClick={() => { handleGoToFirstChapter(); setShowOptionsMenu(false); }}
              className="w-full text-left px-3 py-2 text-xs text-graphite-300 hover:bg-graphite-800/50 rounded transition-colors"
            >
              ⏮ Ir para primeiro capítulo
            </button>
            <button
              onClick={() => { handleGoToLastChapter(); setShowOptionsMenu(false); }}
              className="w-full text-left px-3 py-2 text-xs text-graphite-300 hover:bg-graphite-800/50 rounded transition-colors"
            >
              ⏭ Ir para último capítulo
            </button>
            <div className="border-t border-graphite-700/30 my-1"></div>
            <button
              onClick={() => { handleMarkAsCompleted(); setShowOptionsMenu(false); }}
              className="w-full text-left px-3 py-2 text-xs text-graphite-300 hover:bg-graphite-800/50 rounded transition-colors"
            >
              ✓ Marcar como concluído
            </button>
          </div>
        </div>
      )}

      {/* Page Selector Modal */}
      {showPageSelector && (
        <div className="fixed inset-0 bg-black/80 z-30 flex items-center justify-center fade-in" onClick={() => setShowPageSelector(false)}>
          <div className="glass-card rounded-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-graphite-100 mb-4">Ir para página</h3>
            <input
              type="range"
              min="1"
              max={pages.length}
              value={currentPage + 1}
              onChange={(e) => handleGoToPage(parseInt(e.target.value) - 1)}
              className="w-full mb-4"
            />
            <div className="text-center mb-4">
              <span className="text-2xl font-bold text-violet-light">{currentPage + 1}</span>
              <span className="text-sm text-graphite-400"> / {pages.length}</span>
            </div>
            <div className="grid grid-cols-5 gap-2 mb-4 max-h-60 overflow-y-auto">
              {pages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleGoToPage(index)}
                  className={`aspect-square rounded text-xs font-medium transition-all ${
                    index === currentPage
                      ? 'bg-violet-accent text-white'
                      : 'bg-graphite-800/50 text-graphite-400 hover:bg-graphite-700/50'
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowPageSelector(false)}
              className="w-full py-2 text-sm text-graphite-400 hover:text-graphite-200"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Boundary Messages */}
      {showBoundaryMessage && (
        <div className="fixed inset-0 bg-black/80 z-20 flex items-center justify-center fade-in" onClick={() => setShowBoundaryMessage(null)}>
          <div className="glass-card rounded-xl p-6 max-w-sm mx-4 text-center" onClick={(e) => e.stopPropagation()}>
            {showBoundaryMessage === 'first_page' && (
              <>
                <span className="text-4xl mb-3 block">⬅️</span>
                <h3 className="text-lg font-semibold text-graphite-100 mb-2">Início do Capítulo</h3>
                <p className="text-sm text-graphite-400 mb-4">Você está na primeira página deste capítulo.</p>
                {!isFirst && (
                  <button
                    onClick={handleGoToPreviousChapter}
                    className="w-full py-2 bg-violet-accent hover:bg-violet-dark text-white rounded-lg text-sm font-medium"
                  >
                    Ir para capítulo anterior
                  </button>
                )}
              </>
            )}
            {showBoundaryMessage === 'first_chapter' && (
              <>
                <span className="text-4xl mb-3 block">📖</span>
                <h3 className="text-lg font-semibold text-graphite-100 mb-2">Primeiro Capítulo</h3>
                <p className="text-sm text-graphite-400 mb-4">Este é o primeiro capítulo da obra. Não há capítulo anterior.</p>
              </>
            )}
            {showBoundaryMessage === 'last_page' && (
              <>
                <span className="text-4xl mb-3 block">➡️</span>
                <h3 className="text-lg font-semibold text-graphite-100 mb-2">Fim do Capítulo</h3>
                <p className="text-sm text-graphite-400 mb-4">Você concluiu este capítulo!</p>
                {!isLast && (
                  <button
                    onClick={handleGoToNextChapter}
                    className="w-full py-2 bg-violet-accent hover:bg-violet-dark text-white rounded-lg text-sm font-medium"
                  >
                    Ir para próximo capítulo
                  </button>
                )}
              </>
            )}
            {showBoundaryMessage === 'last_chapter' && (
              <>
                <span className="text-4xl mb-3 block">🎉</span>
                <h3 className="text-lg font-semibold text-graphite-100 mb-2">Último Capítulo</h3>
                <p className="text-sm text-graphite-400 mb-4">Você chegou ao último capítulo disponível desta obra.</p>
              </>
            )}
            <button
              onClick={() => setShowBoundaryMessage(null)}
              className="w-full py-2 mt-2 text-sm text-graphite-400 hover:text-graphite-200"
            >
              Continuar lendo
            </button>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-16 right-4 z-30 glass-card rounded-xl p-4 w-80 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-sm font-semibold text-graphite-100 mb-4">Configurações do Leitor</h3>
          
          {/* Reading Direction */}
          <div className="mb-4">
            <label className="text-xs text-graphite-400 mb-2 block">Direção de Leitura</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleDirectionChange('rtl')}
                className={`text-xs p-2 rounded transition-all ${readingDirection === 'rtl' ? 'bg-violet-accent/20 text-violet-light border border-violet-accent/40' : 'bg-graphite-800 text-graphite-400 hover:bg-graphite-700'}`}
              >
                <div className="text-lg mb-1">🇯🇵</div>
                <div>Mangá</div>
                <div className="text-[10px] text-graphite-500">Direita→Esq.</div>
              </button>
              <button
                onClick={() => handleDirectionChange('vertical')}
                className={`text-xs p-2 rounded transition-all ${readingDirection === 'vertical' ? 'bg-violet-accent/20 text-violet-light border border-violet-accent/40' : 'bg-graphite-800 text-graphite-400 hover:bg-graphite-700'}`}
              >
                <div className="text-lg mb-1">🇰🇷</div>
                <div>Manhwa</div>
                <div className="text-[10px] text-graphite-500">Vertical</div>
              </button>
              <button
                onClick={() => handleDirectionChange('ltr')}
                className={`text-xs p-2 rounded transition-all ${readingDirection === 'ltr' ? 'bg-violet-accent/20 text-violet-light border border-violet-accent/40' : 'bg-graphite-800 text-graphite-400 hover:bg-graphite-700'}`}
              >
                <div className="text-lg mb-1">🇨🇳</div>
                <div>Manhua</div>
                <div className="text-[10px] text-graphite-500">Esq.→Direita</div>
              </button>
            </div>
          </div>

          {/* Fit Mode */}
          <div className="mb-4">
            <label className="text-xs text-graphite-400 mb-2 block">Ajuste da Imagem</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setFitMode('width')}
                className={`text-xs p-2 rounded transition-all ${fitMode === 'width' ? 'bg-violet-accent/20 text-violet-light border border-violet-accent/40' : 'bg-graphite-800 text-graphite-400 hover:bg-graphite-700'}`}
              >
                Largura
              </button>
              <button
                onClick={() => setFitMode('height')}
                className={`text-xs p-2 rounded transition-all ${fitMode === 'height' ? 'bg-violet-accent/20 text-violet-light border border-violet-accent/40' : 'bg-graphite-800 text-graphite-400 hover:bg-graphite-700'}`}
              >
                Altura
              </button>
              <button
                onClick={() => setFitMode('original')}
                className={`text-xs p-2 rounded transition-all ${fitMode === 'original' ? 'bg-violet-accent/20 text-violet-light border border-violet-accent/40' : 'bg-graphite-800 text-graphite-400 hover:bg-graphite-700'}`}
              >
                Original
              </button>
            </div>
          </div>

          {/* Zoom */}
          <div className="mb-4">
            <label className="text-xs text-graphite-400 mb-2 block">Zoom: {Math.round(zoom * 100)}%</label>
            <input type="range" min="0.5" max="3" step="0.1" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="w-full" />
          </div>

          {/* Brightness */}
          <div className="mb-4">
            <label className="text-xs text-graphite-400 mb-2 block">☀️ Brilho: {brightness}%</label>
            <input type="range" min="20" max="100" value={brightness} onChange={(e) => setBrightness(parseInt(e.target.value))} className="w-full" />
          </div>

          {/* Toggles */}
          <div className="space-y-3 mb-4">
            <label className="flex items-center justify-between text-xs text-graphite-400">
              <span>Modo imersivo</span>
              <button
                onClick={() => setImmersiveMode(!immersiveMode)}
                className={`w-10 h-5 rounded-full transition-colors relative ${immersiveMode ? 'bg-violet-accent' : 'bg-graphite-700'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${immersiveMode ? 'left-5.5' : 'left-0.5'}`}></div>
              </button>
            </label>
          </div>

          <button 
            onClick={() => { setZoom(1); setBrightness(100); setFitMode('width'); }} 
            className="w-full text-xs text-graphite-400 hover:text-graphite-200 py-2 border-t border-graphite-700/30"
          >
            Resetar configurações
          </button>
        </div>
      )}

      {/* Chapter List Panel */}
      {showChapterList && (
        <div className="absolute top-16 right-4 z-30 glass-card rounded-xl p-4 w-80 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-sm font-semibold text-graphite-100 mb-3">Índice de Capítulos</h3>
          <div className="space-y-1">
            {chapters.map((ch, idx) => {
              const status = ch.readStatus || 'not_started';
              const statusIcon = status === 'completed' ? '✅' : status === 'in_progress' ? '📖' : '○';
              const statusColor = status === 'completed' ? 'text-success' : status === 'in_progress' ? 'text-violet-light' : 'text-graphite-500';
              
              return (
                <button
                  key={ch.id}
                  onClick={() => { handleChangeChapter(ch.id); setShowChapterList(false); }}
                  className={`w-full text-left px-3 py-2 rounded text-xs transition-all flex items-center gap-2 ${
                    ch.id === chapterId
                      ? 'bg-violet-accent/20 text-violet-light border border-violet-accent/30'
                      : 'text-graphite-400 hover:bg-graphite-800/50 hover:text-graphite-200'
                  }`}
                >
                  <span className={statusColor}>{statusIcon}</span>
                  <span className="font-medium flex-1">{ch.title}</span>
                  <span className="text-graphite-500 text-[10px]">{ch.pagesCount} págs.</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Click outside to close menus */}
      {(showOptionsMenu || showSettings || showChapterList) && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={() => {
            setShowOptionsMenu(false);
            setShowSettings(false);
            setShowChapterList(false);
          }}
        />
      )}
    </div>
  );
}
