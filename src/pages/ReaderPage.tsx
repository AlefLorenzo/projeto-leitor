import { useState, useEffect, useCallback, useRef } from 'react';
import { useMangaDetails } from '../hooks/useMangaStore';
import { getPagesByChapter, getManga, saveManga } from '../services/database';
import { 
  saveEnhancedProgress,
  markChapterAsUnread, 
  getEnhancedProgress,
  isFirstChapter,
  isLastChapter,
  addReadingTime,
} from '../services/readingProgress';
import { getSettings, saveSettings } from '../services/settings';
import { Page, Chapter, ReadingProgress, ReadingDirection, MangaType, MangaSettings, Manga, ConnectionStatus } from '../types';
import { useToast } from '../components/Toast';
import { onlineReaderService } from '../services/sources/onlineReaderService';
import { canProceedWithOnlineReading, subscribeNetworkStatus, getCurrentNetworkStatus } from '../services/networkDetection';
import { onlineSourceManager } from '../services/sources/OnlineSourceManager';
import { SourceManga, SourceChapter } from '../services/sources/types';

interface ReaderPageProps {
  mangaId: string;
  chapterId: string;
  onBack: () => void;
  onChangeChapter: (chapterId: string) => void;
}

export default function ReaderPage({ mangaId, chapterId, onBack, onChangeChapter }: ReaderPageProps) {
  const { addToast } = useToast();
  const { manga: localManga, chapters: localChapters, reload: reloadManga } = useMangaDetails(mangaId);
  
  // Dados de fallback para obras online não registradas no IndexedDB
  const [onlineManga, setOnlineManga] = useState<SourceManga | null>(null);
  const [onlineChapters, setOnlineChapters] = useState<SourceChapter[]>([]);

  const manga = localManga || onlineManga;
  const chapters = (localChapters && localChapters.length > 0) ? localChapters : (onlineChapters as any[]);

  const [pages, setPages] = useState<Page[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChapterList, setShowChapterList] = useState(false);
  const [showBoundaryMessage, setShowBoundaryMessage] = useState<string | null>(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showPageSelector, setShowPageSelector] = useState(false);

  // Estados de Leitura Online e Conexão
  const [isOnlineMode, setIsOnlineMode] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<ConnectionStatus | null>(null);
  const [isNetworkInterrupted, setIsNetworkInterrupted] = useState(false);
  const [showCellularPrompt, setShowCellularPrompt] = useState(false);
  const [networkBlockReason, setNetworkBlockReason] = useState<string | null>(null);
  const [pageBlobUrls, setPageBlobUrls] = useState<Map<number, string>>(new Map());
  const [pageErrors, setPageErrors] = useState<Map<number, string>>(new Map());
  
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

  // Monitoramento contínuo de status de rede
  useEffect(() => {
    getCurrentNetworkStatus().then(setNetworkStatus);
    const unsubscribe = subscribeNetworkStatus(async (status) => {
      setNetworkStatus(status);
      if (isOnlineMode) {
        const settings = await getSettings();
        const check = await canProceedWithOnlineReading(settings.onlineReadingNetwork || 'wifi_only', true);
        if (!check.allowed) {
          setIsNetworkInterrupted(true);
        } else {
          setIsNetworkInterrupted(false);
          // Retomar carregamento da página atual
          onlineReaderService.requestPage(currentPage + 1).catch(() => {});
        }
      }
    });
    return unsubscribe;
  }, [isOnlineMode, currentPage]);

  // Ouvinte de status de download das páginas online
  useEffect(() => {
    if (!isOnlineMode) return;
    const unsubscribe = onlineReaderService.onStatusChange((pageNum, status) => {
      if (status.status === 'loaded' && status.blobUrl) {
        setPageBlobUrls(prev => {
          const map = new Map(prev);
          map.set(pageNum, status.blobUrl!);
          return map;
        });
        setPageErrors(prev => {
          if (!prev.has(pageNum)) return prev;
          const map = new Map(prev);
          map.delete(pageNum);
          return map;
        });
      } else if (status.status === 'error') {
        setPageErrors(prev => {
          const map = new Map(prev);
          map.set(pageNum, status.error || 'Erro ao carregar');
          return map;
        });
      }
    });
    return unsubscribe;
  }, [isOnlineMode]);

  // Carregamento do capítulo (Decisão transparente Online vs Offline)
  const loadChapter = useCallback(async () => {
    setLoading(true);
    setNetworkBlockReason(null);
    setShowCellularPrompt(false);

    try {
      const [chapterPages, dbManga, settings, savedProgress] = await Promise.all([
        getPagesByChapter(chapterId),
        getManga(mangaId),
        getSettings(),
        getEnhancedProgress(mangaId, chapterId),
      ]);

      // 1. Caso haja páginas salvas localmente -> MODO OFFLINE (Prioridade máxima)
      if (chapterPages && chapterPages.length > 0) {
        setIsOnlineMode(false);
        setPages(chapterPages);
      } else {
        // 2. Não há páginas locais -> MODO ONLINE (Sob demanda)
        setIsOnlineMode(true);

        const networkCheck = await canProceedWithOnlineReading(
          settings.onlineReadingNetwork || 'wifi_only',
          false
        );

        if (networkCheck.needsCellularAuth) {
          setShowCellularPrompt(true);
          setLoading(false);
          return;
        }

        if (!networkCheck.allowed) {
          setNetworkBlockReason(networkCheck.reason || 'Conexão Wi-Fi necessária para leitura online.');
          setLoading(false);
          return;
        }

        // Buscar páginas pela fonte online oficial (MangaDex)
        const sourceId = dbManga?.catalogProvider || 'mangadex';
        const onlineResult = await onlineReaderService.loadChapterPages(mangaId, chapterId, sourceId);
        setPages(onlineResult.pages);

        // Se obra ou capítulos não existirem na biblioteca local, busca detalhes online para navegação
        if (!dbManga) {
          const adapter = onlineSourceManager.getSource(sourceId) || onlineSourceManager.getActiveSource();
          adapter.getMangaDetails(mangaId).then(setOnlineManga).catch(() => {});
          adapter.getChapterList(mangaId).then(setOnlineChapters).catch(() => {});
        } else if (localChapters.length === 0) {
          const adapter = onlineSourceManager.getSource(sourceId) || onlineSourceManager.getActiveSource();
          adapter.getChapterList(mangaId).then(setOnlineChapters).catch(() => {});
        }

        // Dispara o download da página inicial
        const initialPage = (savedProgress && !savedProgress.completed) ? Math.max(1, savedProgress.pageNumber) : 1;
        onlineReaderService.requestPage(initialPage).catch(() => {});
      }

      // Configurações do Leitor
      setBrightness(settings.brightness);

      // Prioridade: LocalStorage do mangá > Banco de Dados > Tipo da Obra Online > Preferência Geral
      let savedDirection: ReadingDirection | undefined;
      try {
        const stored = localStorage.getItem(`manga_settings_${mangaId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.readingDirection) savedDirection = parsed.readingDirection;
        }
      } catch {}

      const direction: ReadingDirection =
        savedDirection ||
        dbManga?.customSettings?.readingDirection ||
        dbManga?.readingDirection ||
        (onlineManga?.type === 'manhwa' ? 'vertical' : onlineManga?.type === 'manhua' ? 'ltr' : undefined) ||
        settings.readerMode ||
        'rtl';

      setReadingDirection(direction);
      setImmersiveMode(settings.immersiveMode);
      setZoom(dbManga?.customSettings?.zoomLevel || settings.zoomLevel || 1);

      // Restauração de Progresso
      if (savedProgress && !savedProgress.completed) {
        setCurrentPage(Math.max(0, savedProgress.pageNumber - 1));
        setProgress(savedProgress);
        setChapterStatus('in_progress');
        
        if (savedProgress.scrollPosition && direction === 'vertical') {
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

      // Limites de capítulos (primeiro e último)
      const [first, last] = await Promise.all([
        isFirstChapter(mangaId, chapterId),
        isLastChapter(mangaId, chapterId),
      ]);
      setIsFirst(first);
      setIsLast(last);

      startTimeRef.current = Date.now();
    } catch (error: any) {
      console.error('Error loading chapter:', error);
      addToast(error?.message || 'Erro ao carregar capítulo', 'error');
    } finally {
      setLoading(false);
    }
  }, [chapterId, mangaId, localChapters.length, addToast]);

  useEffect(() => {
    loadChapter();
    return () => {
      onlineReaderService.cleanup();
    };
  }, [loadChapter]);

  // Pré-carregamento progressivo de páginas online ao virar de página
  useEffect(() => {
    if (isOnlineMode && pages.length > 0) {
      onlineReaderService.requestPage(currentPage + 1).catch(() => {});
    }
  }, [currentPage, isOnlineMode, pages.length]);

  // Salvar progresso de leitura periodicamente
  const saveCurrentProgress = useCallback(async (force = false) => {
    if (pages.length === 0 || loading) return;

    const now = Date.now();
    if (!force && now - lastSaveRef.current < 5000) return;
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
      const readingSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      if (readingSeconds > 0) {
        addReadingTime(mangaId, chapterId, readingSeconds).catch(console.error);
      }
      saveCurrentProgress(true);
    };
  }, [mangaId, chapterId, saveCurrentProgress]);

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
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
      } else {
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      }
      return newState;
    });
  }, [immersiveMode]);

  useEffect(() => {
    if (pages.length > 0 && !loading) {
      showControlsFn();
    }
    return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
  }, [pages.length, loading, showControlsFn]);

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
    await saveCurrentProgress(true);
    onBack();
  };

  const goToNextPage = useCallback(() => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(prev => prev + 1);
      showControlsFn();
    } else if (!isLast && chapterIndex < chapters.length - 1) {
      setShowBoundaryMessage('last_page');
    } else {
      setShowBoundaryMessage('last_chapter');
    }
  }, [currentPage, pages.length, isLast, chapterIndex, chapters.length, showControlsFn]);

  const goToPrevPage = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
      showControlsFn();
    } else if (!isFirst && chapterIndex > 0) {
      setShowBoundaryMessage('first_page');
    } else {
      setShowBoundaryMessage('first_chapter');
    }
  }, [currentPage, isFirst, chapterIndex, showControlsFn]);

  const handlePageInteraction = (clientX: number, clientY: number, isDoubleClick: boolean) => {
    if (isDoubleClick) {
      setZoom(prev => prev === 1 ? 1.5 : 1);
      return;
    }

    const container = document.querySelector('[data-reader-container]');
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const width = rect.width;

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

  const handlePageClick = (e: React.MouseEvent) => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    lastTapRef.current = now;
    const isDoubleClick = timeSinceLastTap < 300 && timeSinceLastTap > 0;
    handlePageInteraction(e.clientX, e.clientY, isDoubleClick);
  };

  const handleTouchTap = (e: React.TouchEvent) => {
    if (!dragStart) return;
    const touch = e.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - dragStart.x);
    const deltaY = Math.abs(touch.clientY - dragStart.y);
    if (deltaX > 10 || deltaY > 10) return;

    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    lastTapRef.current = now;
    const isDoubleClick = timeSinceLastTap < 300 && timeSinceLastTap > 0;
    handlePageInteraction(touch.clientX, touch.clientY, isDoubleClick);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX, y: touch.clientY });
    } else if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setPinchStart(distance);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStart) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = distance / pinchStart;
      setZoom(prev => Math.min(Math.max(0.5, prev * scale), 3));
      setPinchStart(distance);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStart && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - dragStart.x;
      const deltaY = touch.clientY - dragStart.y;
      
      if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 100) {
        if (deltaX > 0) {
          if (readingDirection === 'rtl') goToNextPage();
          else goToPrevPage();
        } else {
          if (readingDirection === 'rtl') goToPrevPage();
          else goToNextPage();
        }
      } else {
        handleTouchTap(e);
      }
    }
    setDragStart(null);
    setPinchStart(null);
  };

  const handleChangeChapter = async (newChapterId: string) => {
    await saveCurrentProgress(true);
    onChangeChapter(newChapterId);
  };

  const handleGoToPreviousChapter = async () => {
    if (chapterIndex > 0) {
      setShowBoundaryMessage(null);
      await handleChangeChapter(chapters[chapterIndex - 1].id);
    }
  };

  const handleGoToNextChapter = async () => {
    if (chapterIndex >= 0 && chapterIndex < chapters.length - 1) {
      setShowBoundaryMessage(null);
      await handleChangeChapter(chapters[chapterIndex + 1].id);
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

  const handleMarkAsUnread = async () => {
    await markChapterAsUnread(chapterId);
    setChapterStatus('not_started');
    setCurrentPage(0);
    addToast('Capítulo marcado como não lido', 'info');
  };

  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current && readingDirection === 'vertical') {
      const scrollTop = scrollContainerRef.current.scrollTop;
      setScrollPosition(scrollTop);
      
      const totalHeight = scrollContainerRef.current.scrollHeight;
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
    if (newDirection === readingDirection) return;

    // 1. Aplicação imediata no leitor
    setReadingDirection(newDirection);

    const typeMap: Record<ReadingDirection, MangaType> = {
      rtl: 'manga',
      vertical: 'manhwa',
      ltr: 'manhua',
    };
    const newType = typeMap[newDirection];

    // Atualiza onlineManga em memória se estiver no modo online
    if (onlineManga) {
      setOnlineManga(prev => prev ? { ...prev, type: newType } : null);
    }

    // 2. Persistência instantânea no localStorage por mangaId (à prova de falhas)
    try {
      localStorage.setItem(`manga_settings_${mangaId}`, JSON.stringify({
        readingDirection: newDirection,
        type: newType,
        updatedAt: Date.now(),
      }));
    } catch (storageErr) {
      console.warn('Aviso ao salvar configuração em localStorage:', storageErr);
    }

    // 3. Salva progresso atual da leitura com nova direção
    saveCurrentProgress(true).catch(() => {});

    // 4. Salva no IndexedDB de forma resiliente
    try {
      const dbManga = await getManga(mangaId);
      if (dbManga) {
        const customSettings: MangaSettings = {
          ...(dbManga.customSettings || {}),
          readingDirection: newDirection,
        };
        const updatedManga: Manga = {
          ...dbManga,
          type: newType,
          readingDirection: newDirection,
          customSettings,
          updatedAt: Date.now(),
        };
        await saveManga(updatedManga);
      } else if (onlineManga) {
        // Obra online sem registro prévio: armazena entrada leve no catálogo local
        const now = Date.now();
        const newDbManga: Manga = {
          id: mangaId,
          title: onlineManga.title || 'Obra Online',
          synopsis: onlineManga.synopsis,
          coverUrl: onlineManga.coverUrl || onlineManga.thumbnailUrl,
          genres: onlineManga.genres || [],
          type: newType,
          readingDirection: newDirection,
          status: 'reading',
          source: 'online',
          createdAt: now,
          updatedAt: now,
          isFavorite: false,
          totalChapters: onlineManga.totalChapters || 1,
          totalPages: pages.length || 0,
          storageSize: 0,
          catalogId: onlineManga.id,
          catalogProvider: onlineManga.sourceId,
          altTitles: onlineManga.altTitles,
          customSettings: {
            readingDirection: newDirection,
          },
        };
        await saveManga(newDbManga);
      }
    } catch (err) {
      console.warn('Aviso ao sincronizar tipo de obra no IndexedDB (mantido via localStorage):', err);
    }

    // 5. Toast de sucesso amigável
    const label = newType === 'manga' ? 'Mangá (Direita → Esquerda)' : newType === 'manhwa' ? 'Manhwa (Vertical)' : 'Manhua (Esquerda → Direita)';
    addToast(`Tipo de obra alterado para ${label}`, 'success');

    // 6. Se alternou para vertical, rola suavemente para a página atual
    if (newDirection === 'vertical') {
      setTimeout(() => {
        if (scrollContainerRef.current) {
          const el = scrollContainerRef.current.querySelector(`[data-page-index="${currentPage}"]`);
          if (el) {
            el.scrollIntoView({ behavior: 'auto', block: 'start' });
          }
        }
      }, 80);
    }
  };

  // TELA DE BLOQUEIO DE REDE
  if (networkBlockReason) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-6 max-w-sm w-full text-center border border-graphite-700">
          <span className="text-4xl mb-3 block">📶</span>
          <h3 className="text-base font-bold text-graphite-100 mb-2">Conexão Wi-Fi Necessária</h3>
          <p className="text-xs text-graphite-400 mb-5 leading-relaxed">{networkBlockReason}</p>
          <div className="space-y-2">
            <button
              onClick={() => { setNetworkBlockReason(null); loadChapter(); }}
              className="w-full py-2.5 bg-violet-accent hover:bg-violet-dark text-white rounded-xl text-xs font-semibold transition"
            >
              🔄 Tentar Novamente
            </button>
            <button
              onClick={onBack}
              className="w-full py-2 bg-graphite-800 hover:bg-graphite-700 text-graphite-300 rounded-xl text-xs font-medium transition"
            >
              ← Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MODAL DE AUTORIZAÇÃO DE DADOS MÓVEIS (PERGUNTAR ANTES)
  if (showCellularPrompt) {
    return (
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-6 max-w-sm w-full text-center border border-amber-600/40">
          <span className="text-4xl mb-3 block">📱</span>
          <h3 className="text-base font-bold text-graphite-100 mb-2">Autorizar Dados Móveis?</h3>
          <p className="text-xs text-graphite-400 mb-5 leading-relaxed">
            Você não está conectado ao Wi-Fi. Deseja autorizar o uso do seu plano de dados móveis para carregar as imagens deste capítulo online?
          </p>
          <div className="space-y-2">
            <button
              onClick={() => {
                onlineReaderService.authorizeCellularForSession();
                setShowCellularPrompt(false);
                loadChapter();
              }}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold transition shadow"
            >
              ⚡ Autorizar para Este Capítulo
            </button>
            <button
              onClick={onBack}
              className="w-full py-2 bg-graphite-800 hover:bg-graphite-700 text-graphite-300 rounded-xl text-xs font-medium transition"
            >
              ← Voltar (Não consumir dados)
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        <div className="bg-gradient-to-b from-black/95 via-black/80 to-transparent px-3 sm:px-4 py-2 sm:py-3 safe-area-top">
          <div className="flex items-center justify-between">
            <button onClick={handleExit} className="text-white/80 hover:text-white text-sm flex items-center gap-2 px-2 py-1 rounded hover:bg-white/10">
              ← Voltar
            </button>
            <div className="text-center flex-1 mx-4">
              <p className="text-sm font-medium text-white truncate">{manga?.title}</p>
              <div className="flex items-center justify-center gap-1.5 mt-0.5">
                <p className="text-xs text-white/60 truncate max-w-[130px] sm:max-w-xs">{currentChapter?.title}</p>
                {isOnlineMode ? (
                  networkStatus?.isCellular ? (
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] border border-amber-500/30 font-semibold flex items-center gap-1">
                      <span>📱</span> Online (Móvel)
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] border border-emerald-500/30 font-semibold flex items-center gap-1">
                      <span>📶</span> Online (Wi-Fi)
                    </span>
                  )
                ) : (
                  <span className="px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-300 text-[10px] border border-violet-500/30 font-semibold flex items-center gap-1">
                    <span>💾</span> Offline
                  </span>
                )}
              </div>
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

      {/* BANNER DISCRETO DE RECONEXÃO WI-FI */}
      {isNetworkInterrupted && (
        <div className="absolute top-14 left-3 right-3 sm:left-4 sm:right-4 z-30 bg-amber-950/90 border border-amber-600/50 text-amber-200 px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between text-xs backdrop-blur-sm animate-pulse">
          <div className="flex items-center gap-2">
            <span className="text-base">📶</span>
            <div>
              <p className="font-semibold">Conexão Wi-Fi interrompida</p>
              <p className="text-[11px] text-amber-300/80">Sua leitura está preservada na página {currentPage + 1}. Aguardando reconexão...</p>
            </div>
          </div>
        </div>
      )}

      {/* Reader Content */}
      <div 
        data-reader-container
        className="flex-1 flex items-center justify-center overflow-hidden cursor-pointer relative" 
        onClick={handlePageClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={(e) => {
          handleTouchEnd(e);
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
              {pages.map((page, index) => {
                const pageNum = index + 1;
                const pageError = pageErrors.get(pageNum);
                const imgSrc = pageBlobUrls.get(pageNum) || page.imageUrl;
                return (
                  <div key={page.id} className="w-full relative min-h-[300px] flex items-center justify-center bg-black/40" data-page-index={index}>
                    {pageError ? (
                      <div className="text-center p-6 my-6 bg-graphite-900/90 rounded-xl border border-red-500/30 max-w-xs">
                        <p className="text-xs text-red-300 mb-2">Erro ao carregar página {pageNum}</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onlineReaderService.retryPage(pageNum);
                          }}
                          className="px-3 py-1.5 bg-violet-accent hover:bg-violet-dark text-white rounded-lg text-xs font-semibold shadow"
                        >
                          🔄 Recarregar
                        </button>
                      </div>
                    ) : (
                      <img 
                        src={imgSrc} 
                        alt={`Página ${pageNum}`} 
                        className="w-full" 
                        loading="lazy"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center">
            {pageErrors.get(currentPage + 1) ? (
              <div className="text-center p-6 bg-graphite-900/90 rounded-xl border border-red-500/30 max-w-xs">
                <span className="text-3xl mb-2 block">⚠️</span>
                <p className="text-xs text-red-300 mb-3">{pageErrors.get(currentPage + 1)}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onlineReaderService.retryPage(currentPage + 1);
                  }}
                  className="px-3 py-1.5 bg-violet-accent hover:bg-violet-dark text-white rounded-lg text-xs font-semibold shadow"
                >
                  🔄 Recarregar Página
                </button>
              </div>
            ) : (
              <img
                src={pageBlobUrls.get(currentPage + 1) || pages[currentPage]?.imageUrl}
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
            )}
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className={`absolute bottom-0 left-0 right-0 z-20 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'}`}>
        <div className="bg-gradient-to-t from-black/95 via-black/80 to-transparent px-3 sm:px-4 py-2 sm:py-3 safe-area-bottom">
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
                  handleGoToPage(Math.floor(percent * pages.length));
                }}
              >
                <div 
                  className="h-full bg-violet-accent transition-all duration-150"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs text-white/60 font-mono">{pages.length}</span>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between gap-2 max-w-md mx-auto">
            <button
              onClick={(e) => { e.stopPropagation(); handleGoToPreviousChapter(); }}
              className="text-white/80 hover:text-white text-xs px-2 py-2 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={chapterIndex === 0}
              title="Capítulo anterior"
            >
              ⏮
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goToPrevPage(); }}
              className="text-white/80 hover:text-white text-sm px-3 py-2 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={currentPage === 0 && chapterIndex === 0}
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
              disabled={currentPage === pages.length - 1 && chapterIndex === chapters.length - 1}
              title="Próxima página"
            >
              {readingDirection === 'rtl' ? '◀' : '▶'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleGoToNextChapter(); }}
              className="text-white/80 hover:text-white text-xs px-2 py-2 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              disabled={chapterIndex === chapters.length - 1}
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
            <span className="text-xs text-white/40 truncate max-w-[100px] sm:max-w-xs">{currentChapter?.title}</span>
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
        <div className="absolute top-14 sm:top-16 right-2 sm:right-4 z-30 glass-card rounded-xl p-2 w-[calc(100vw-32px)] max-w-xs sm:w-64" onClick={(e) => e.stopPropagation()}>
          <div className="space-y-1">
            <button
              onClick={() => { handleExit(); setShowOptionsMenu(false); }}
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
            <button
              onClick={() => { handleMarkAsUnread(); setShowOptionsMenu(false); }}
              className="w-full text-left px-3 py-2 text-xs text-graphite-300 hover:bg-graphite-800/50 rounded transition-colors"
            >
              ○ Marcar como não lido
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
                {chapterIndex > 0 && (
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
                <p className="text-sm text-graphite-400 mb-4">Este é o primeiro capítulo disponível.</p>
              </>
            )}
            {showBoundaryMessage === 'last_page' && (
              <>
                <span className="text-4xl mb-3 block">➡️</span>
                <h3 className="text-lg font-semibold text-graphite-100 mb-2">Fim do Capítulo</h3>
                <p className="text-sm text-graphite-400 mb-4">Você concluiu este capítulo!</p>
                {chapterIndex < chapters.length - 1 && (
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
                <p className="text-sm text-graphite-400 mb-4">Você chegou ao último capítulo desta obra.</p>
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
        <div className="absolute top-14 sm:top-16 right-2 sm:right-4 z-30 glass-card rounded-xl p-4 w-[calc(100vw-32px)] max-w-xs sm:w-80 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-sm font-semibold text-graphite-100 mb-4">Configurações do Leitor</h3>
          
          {/* Tipo de Obra */}
          <div className="mb-4">
            <label className="text-xs text-graphite-400 mb-2 block font-medium">Tipo de Obra</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleDirectionChange('rtl')}
                className={`text-xs p-2 rounded transition-all ${readingDirection === 'rtl' ? 'bg-violet-accent/20 text-violet-light border border-violet-accent/40' : 'bg-graphite-800 text-graphite-400 hover:bg-graphite-700'}`}
                title="Mangá: Leitura da direita para a esquerda"
              >
                <div className="text-lg mb-1">🇯🇵</div>
                <div>Mangá</div>
                <div className="text-[10px] text-graphite-500">Direita→Esq.</div>
              </button>
              <button
                onClick={() => handleDirectionChange('vertical')}
                className={`text-xs p-2 rounded transition-all ${readingDirection === 'vertical' ? 'bg-violet-accent/20 text-violet-light border border-violet-accent/40' : 'bg-graphite-800 text-graphite-400 hover:bg-graphite-700'}`}
                title="Manhwa: Rolagem vertical contínua"
              >
                <div className="text-lg mb-1">🇰🇷</div>
                <div>Manhwa</div>
                <div className="text-[10px] text-graphite-500">Vertical</div>
              </button>
              <button
                onClick={() => handleDirectionChange('ltr')}
                className={`text-xs p-2 rounded transition-all ${readingDirection === 'ltr' ? 'bg-violet-accent/20 text-violet-light border border-violet-accent/40' : 'bg-graphite-800 text-graphite-400 hover:bg-graphite-700'}`}
                title="Manhua: Leitura da esquerda para a direita"
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
        <div className="absolute top-14 sm:top-16 right-2 sm:right-4 z-30 glass-card rounded-xl p-4 w-[calc(100vw-32px)] max-w-xs sm:w-80 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
                  {ch.pagesCount ? <span className="text-graphite-500 text-[10px]">{ch.pagesCount} págs.</span> : null}
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
