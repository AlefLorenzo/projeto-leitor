import { useState, useEffect } from 'react';
import WelcomePage from './pages/WelcomePage';
import HomePage from './pages/HomePage';
import LibraryPage from './pages/LibraryPage';
import ImportPage from './pages/ImportPage';
import MangaDetailsPage from './pages/MangaDetailsPage';
import ReaderPage from './pages/ReaderPage';
import ExplorePage from './pages/ExplorePage';
import DownloadsPage from './pages/DownloadsPage';
import StatisticsPage from './pages/StatisticsPage';
import SettingsPage from './pages/SettingsPage';
import FileManagerPage from './pages/FileManagerPage';
import TelegramPage from './pages/TelegramPage';
import { NotificationBell } from './components/NotificationBell';
import { getAllMangas, getManga } from './services/database';

type View = 'home' | 'library' | 'import' | 'details' | 'reader' | 'explore' | 'downloads' | 'statistics' | 'settings' | 'files' | 'telegram';

function App() {
  const [view, setView] = useState<View>('home');
  const [selectedMangaId, setSelectedMangaId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedMangaTitle, setSelectedMangaTitle] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('home');
  const [showWelcome, setShowWelcome] = useState<boolean | null>(null);

  // Check if first time
  useEffect(() => {
    const checkFirstTime = async () => {
      try {
        const mangas = await getAllMangas();
        setShowWelcome(mangas.length === 0);
      } catch (error) {
        console.error('Error checking first time:', error);
        setShowWelcome(false);
      }
    };
    checkFirstTime();
  }, []);

  const handleOpenManga = async (id: string) => {
    setSelectedMangaId(id);
    const manga = await getManga(id);
    if (manga) setSelectedMangaTitle(manga.title);
    setView('details');
  };

  const handleManageFiles = async (id: string) => {
    setSelectedMangaId(id);
    const manga = await getManga(id);
    if (manga) setSelectedMangaTitle(manga.title);
    setView('files');
  };

  const handleReadChapter = (mangaId: string, chapterId: string) => {
    setSelectedMangaId(mangaId);
    setSelectedChapterId(chapterId);
    setView('reader');
  };

  const handleImportComplete = (mangaId: string) => {
    setSelectedMangaId(mangaId);
    setView('details');
  };

  const handleBackToLibrary = () => {
    setView('library');
    setActiveTab('library');
  };

  const handleWelcomeComplete = () => {
    setShowWelcome(false);
  };

  // Show welcome page on first time
  if (showWelcome === true) {
    return <WelcomePage onComplete={handleWelcomeComplete} />;
  }

  // Show loading while checking
  if (showWelcome === null) {
    return (
      <div className="min-h-screen bg-graphite-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-violet-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Reader is fullscreen
  if (view === 'reader' && selectedMangaId && selectedChapterId) {
    return (
      <ReaderPage
        mangaId={selectedMangaId}
        chapterId={selectedChapterId}
        onBack={() => setView('details')}
        onChangeChapter={(chapterId) => setSelectedChapterId(chapterId)}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-graphite-950">
      {/* Sidebar */}
      <aside className="w-16 lg:w-56 bg-graphite-900 border-r border-graphite-700/50 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-graphite-700/50">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-accent to-violet-dark flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">M</span>
          </div>
          <span className="ml-3 text-sm font-semibold text-graphite-100 hidden lg:block">Manga Offline</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          <NavItem icon="🏠" label="Início" active={activeTab === 'home' && view !== 'import' && view !== 'details'} onClick={() => { setActiveTab('home'); setView('home'); }} />
          <NavItem icon="📚" label="Biblioteca" active={activeTab === 'library' && view !== 'import' && view !== 'details'} onClick={() => { setActiveTab('library'); setView('library'); }} />
          <NavItem icon="📱" label="Telegram" active={activeTab === 'telegram'} onClick={() => { setActiveTab('telegram'); setView('telegram'); }} />
          <NavItem icon="🔍" label="Explorar" active={activeTab === 'explore'} onClick={() => { setActiveTab('explore'); setView('explore'); }} />
          <NavItem icon="📥" label="Downloads" active={activeTab === 'downloads'} onClick={() => { setActiveTab('downloads'); setView('downloads'); }} />
          
          <div className="my-3 border-t border-graphite-700/30"></div>
          
          <NavItem icon="📂" label="Importar" active={view === 'import'} onClick={() => setView('import')} />
          <NavItem icon="📊" label="Estatísticas" active={activeTab === 'statistics'} onClick={() => { setActiveTab('statistics'); setView('statistics'); }} />
          <NavItem icon="⚙️" label="Configurações" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setView('settings'); }} />
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-graphite-700/50 hidden lg:block">
          <div className="glass-card rounded-lg p-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success pulse-glow"></div>
              <span className="text-[10px] text-graphite-400">Fase 7 — Completa</span>
            </div>
            <p className="text-[10px] text-graphite-500 mt-1">Demo ativa ✓</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top Bar */}
        <div className="sticky top-0 z-30 bg-graphite-950/80 backdrop-blur-sm border-b border-graphite-700/30 px-4 lg:px-8 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="lg:hidden">
              <span className="text-sm font-semibold text-graphite-100">Manga Offline</span>
            </div>
            <div className="hidden lg:block"></div>
            <NotificationBell />
          </div>
        </div>

        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          {view === 'home' && (
            <HomePage onOpenManga={handleOpenManga} onReadChapter={handleReadChapter} onImport={() => setView('import')} />
          )}
          {view === 'library' && (
            <LibraryPage onOpenManga={handleOpenManga} onImport={() => setView('import')} />
          )}
          {view === 'import' && (
            <ImportPage onComplete={handleImportComplete} onCancel={handleBackToLibrary} />
          )}
          {view === 'details' && selectedMangaId && (
            <MangaDetailsPage 
              mangaId={selectedMangaId} 
              onBack={handleBackToLibrary} 
              onRead={(chapterId) => handleReadChapter(selectedMangaId, chapterId)} 
              onRefresh={() => {}} 
              onManageFiles={handleManageFiles}
            />
          )}
          {view === 'files' && selectedMangaId && (
            <FileManagerPage 
              mangaId={selectedMangaId}
              mangaTitle={selectedMangaTitle}
              onBack={() => setView('details')}
            />
          )}
          {view === 'explore' && (
            <ExplorePage onOpenCatalogManga={() => {}} onAddToLibrary={() => {}} />
          )}
          {view === 'downloads' && <DownloadsPage />}
          {view === 'telegram' && (
            <TelegramPage onOpenManga={(id) => {
              // Para obras do Telegram, mostrar mensagem de importação
              alert(`Para importar "${id}", use o botão de importação na biblioteca.`);
            }} />
          )}
          {view === 'statistics' && <StatisticsPage />}
          {view === 'settings' && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all ${
        active
          ? 'bg-violet-accent/15 text-violet-light border-l-2 border-violet-accent'
          : 'text-graphite-400 hover:bg-graphite-800/50 hover:text-graphite-200'
      }`}
    >
      <span className="text-lg flex-shrink-0">{icon}</span>
      <span className="text-sm font-medium hidden lg:block">{label}</span>
    </button>
  );
}

export default App;
