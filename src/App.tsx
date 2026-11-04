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
import { notifyOtaReady } from './services/otaUpdate';

type View = 'home' | 'library' | 'import' | 'details' | 'reader' | 'explore' | 'downloads' | 'statistics' | 'settings' | 'files' | 'telegram';

function App() {
  const [view, setView] = useState<View>('home');
  const [selectedMangaId, setSelectedMangaId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedMangaTitle, setSelectedMangaTitle] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('home');
  const [showWelcome, setShowWelcome] = useState<boolean>(false);

  // Check inicial - entra direto no app
  useEffect(() => {
    const checkInitialState = async () => {
      try {
        await getAllMangas();
        await notifyOtaReady();
      } catch (error) {
        console.error('Error initializing database:', error);
      }
    };
    checkInitialState();
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

  const navigateTo = (newView: View, tabName?: string) => {
    setView(newView);
    setActiveTab(tabName || newView);
  };

  // Show welcome page apenas se requisitado explicitamente
  if (showWelcome) {
    return <WelcomePage onComplete={handleWelcomeComplete} />;
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
    <div className="flex h-screen overflow-hidden bg-graphite-950 flex-col md:flex-row">
      {/* Sidebar para Tablets e Desktops */}
      <aside className="hidden md:flex w-16 lg:w-56 bg-graphite-900 border-r border-graphite-700/50 flex-col flex-shrink-0">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-graphite-700/50">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-accent to-violet-dark flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">M</span>
          </div>
          <span className="ml-3 text-sm font-semibold text-graphite-100 hidden lg:block">Manga Offline</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          <NavItem icon="🏠" label="Início" active={activeTab === 'home' && view !== 'import' && view !== 'details'} onClick={() => navigateTo('home')} />
          <NavItem icon="🌐" label="Catálogo Git" active={activeTab === 'telegram'} onClick={() => navigateTo('telegram')} />
          <NavItem icon="📙" label="MangaDex" active={activeTab === 'explore'} onClick={() => navigateTo('explore')} />
          <NavItem icon="📚" label="Biblioteca" active={activeTab === 'library' && view !== 'import' && view !== 'details'} onClick={() => navigateTo('library')} />
          <NavItem icon="📥" label="Downloads" active={activeTab === 'downloads'} onClick={() => navigateTo('downloads')} />
          
          <div className="my-3 border-t border-graphite-700/30"></div>
          
          <NavItem icon="📂" label="Importar" active={view === 'import'} onClick={() => navigateTo('import')} />
          <NavItem icon="📊" label="Estatísticas" active={activeTab === 'statistics'} onClick={() => navigateTo('statistics')} />
          <NavItem icon="⚙️" label="Configurações" active={activeTab === 'settings'} onClick={() => navigateTo('settings')} />
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-graphite-700/50 hidden lg:block">
          <div className="glass-card rounded-lg p-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success pulse-glow"></div>
              <span className="text-[10px] text-graphite-400">APK Online + Git</span>
            </div>
            <p className="text-[10px] text-graphite-500 mt-1">Sincronizado ✓</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-28 md:pb-6">
        {/* Top Bar */}
        <div className="sticky top-0 z-30 bg-graphite-950/85 backdrop-blur-md border-b border-graphite-700/30 px-3 sm:px-6 py-2.5 safe-area-top">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-accent to-violet-dark flex items-center justify-center md:hidden">
                <span className="text-white text-xs font-bold">M</span>
              </div>
              <span className="text-sm font-semibold text-graphite-100">Manga Offline</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-medium">Online</span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => navigateTo('settings')}
                className={`p-2 rounded-lg transition-colors md:hidden ${activeTab === 'settings' ? 'text-violet-light bg-violet-accent/15' : 'text-graphite-400 hover:text-white'}`}
                title="Configurações"
                aria-label="Configurações"
              >
                <span className="text-base">⚙️</span>
              </button>
              <NotificationBell />
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {view === 'home' && (
            <HomePage 
              onOpenManga={handleOpenManga} 
              onReadChapter={handleReadChapter} 
              onImport={() => navigateTo('import')}
              onOpenTelegram={() => navigateTo('telegram')}
              onOpenExplore={() => navigateTo('explore')}
            />
          )}
          {view === 'library' && (
            <LibraryPage onOpenManga={handleOpenManga} onImport={() => navigateTo('import')} />
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
            <ExplorePage onOpenReader={(mangaId, chapterId) => handleReadChapter(mangaId, chapterId)} />
          )}
          {view === 'downloads' && <DownloadsPage />}
          {view === 'telegram' && (
            <TelegramPage
              onOpenManga={handleOpenManga}
              onOpenReader={(mangaId, chapterId) => handleReadChapter(mangaId, chapterId)}
            />
          )}
          {view === 'statistics' && <StatisticsPage />}
          {view === 'settings' && <SettingsPage />}
        </div>
      </main>

      {/* Bottom Navigation Bar para Mobile (Celulares Android) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-graphite-900/95 backdrop-blur-md border-t border-graphite-700/50 flex items-center justify-around px-2 py-1.5 safe-area-bottom shadow-2xl">
        <BottomNavItem
          icon="🏠"
          label="Início"
          active={activeTab === 'home' && view !== 'import' && view !== 'details'}
          onClick={() => navigateTo('home')}
        />
        <BottomNavItem
          icon="🌐"
          label="Catálogo Git"
          active={activeTab === 'telegram'}
          onClick={() => navigateTo('telegram')}
        />
        <BottomNavItem
          icon="📙"
          label="MangaDex"
          active={activeTab === 'explore'}
          onClick={() => navigateTo('explore')}
        />
        <BottomNavItem
          icon="📚"
          label="Biblioteca"
          active={activeTab === 'library' && view !== 'import' && view !== 'details'}
          onClick={() => navigateTo('library')}
        />
        <BottomNavItem
          icon="📥"
          label="Downloads"
          active={activeTab === 'downloads'}
          onClick={() => navigateTo('downloads')}
        />
      </nav>
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

function BottomNavItem({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center py-1 px-1 sm:px-2 rounded-lg transition-all flex-1 min-w-0 ${
        active
          ? 'text-violet-light font-semibold scale-105'
          : 'text-graphite-400 hover:text-graphite-200 opacity-80'
      }`}
    >
      <span className="text-lg sm:text-xl mb-0.5">{icon}</span>
      <span className="text-[9px] sm:text-[10px] tracking-tight truncate max-w-full text-center">{label}</span>
      {active && <span className="w-1.5 h-1.5 rounded-full bg-violet-accent mt-0.5"></span>}
    </button>
  );
}

export default App;
