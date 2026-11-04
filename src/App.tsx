import { useState } from 'react';
import HomePage from './pages/HomePage';
import LibraryPage from './pages/LibraryPage';
import ImportPage from './pages/ImportPage';
import MangaDetailsPage from './pages/MangaDetailsPage';
import ReaderPage from './pages/ReaderPage';

type View = 'home' | 'library' | 'import' | 'details' | 'reader' | 'docs';

function App() {
  const [view, setView] = useState<View>('home');
  const [selectedMangaId, setSelectedMangaId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'library'>('home');

  const handleOpenManga = (id: string) => {
    setSelectedMangaId(id);
    setView('details');
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
        <nav className="flex-1 py-4 px-2">
          <NavItem
            icon="🏠"
            label="Início"
            active={activeTab === 'home' && view !== 'import' && view !== 'details'}
            onClick={() => { setActiveTab('home'); setView('home'); }}
          />
          <NavItem
            icon="📚"
            label="Biblioteca"
            active={activeTab === 'library' && view !== 'import' && view !== 'details'}
            onClick={() => { setActiveTab('library'); setView('library'); }}
          />
          <NavItem
            icon="📂"
            label="Importar"
            active={view === 'import'}
            onClick={() => setView('import')}
          />
          
          <div className="my-4 border-t border-graphite-700/30"></div>
          
          <NavItem
            icon="📊"
            label="Documentação"
            active={view === 'docs'}
            onClick={() => setView('docs')}
          />
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-graphite-700/50 hidden lg:block">
          <div className="glass-card rounded-lg p-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success pulse-glow"></div>
              <span className="text-[10px] text-graphite-400">App funcional</span>
            </div>
            <p className="text-[10px] text-graphite-500 mt-1">IndexedDB ativo</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          {view === 'home' && (
            <HomePage
              onOpenManga={handleOpenManga}
              onReadChapter={handleReadChapter}
              onImport={() => setView('import')}
            />
          )}
          {view === 'library' && (
            <LibraryPage
              onOpenManga={handleOpenManga}
              onImport={() => setView('import')}
            />
          )}
          {view === 'import' && (
            <ImportPage
              onComplete={handleImportComplete}
              onCancel={handleBackToLibrary}
            />
          )}
          {view === 'details' && selectedMangaId && (
            <MangaDetailsPage
              mangaId={selectedMangaId}
              onBack={handleBackToLibrary}
              onRead={(chapterId) => handleReadChapter(selectedMangaId, chapterId)}
              onRefresh={() => {}}
            />
          )}
          {view === 'docs' && <DocsPage />}
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

function DocsPage() {
  return (
    <div className="slide-up">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-graphite-100 mb-2">
          Documentação do <span className="gradient-text">Projeto</span>
        </h1>
        <p className="text-graphite-300 text-sm">
          Esta é uma demonstração web funcional do projeto Manga Offline. A versão Android completa está em desenvolvimento com Flutter.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-graphite-100 mb-3">🎯 Funcionalidades Implementadas</h2>
          <ul className="space-y-2 text-sm text-graphite-300">
            <li className="flex items-center gap-2"><span className="text-success">✓</span> Importação de imagens (JPG, PNG, WEBP)</li>
            <li className="flex items-center gap-2"><span className="text-success">✓</span> Organização em obras e capítulos</li>
            <li className="flex items-center gap-2"><span className="text-success">✓</span> Detecção automática de capítulos por pasta</li>
            <li className="flex items-center gap-2"><span className="text-success">✓</span> Ordenação natural de páginas</li>
            <li className="flex items-center gap-2"><span className="text-success">✓</span> Leitor com 3 modos (Mangá, Manhwa, Manhua)</li>
            <li className="flex items-center gap-2"><span className="text-success">✓</span> Persistência com IndexedDB</li>
            <li className="flex items-center gap-2"><span className="text-success">✓</span> Progresso de leitura salvo</li>
            <li className="flex items-center gap-2"><span className="text-success">✓</span> Biblioteca com filtros e pesquisa</li>
            <li className="flex items-center gap-2"><span className="text-success">✓</span> Favoritos e status</li>
            <li className="flex items-center gap-2"><span className="text-success">✓</span> Edição e exclusão de obras</li>
            <li className="flex items-center gap-2"><span className="text-success">✓</span> Interface Dark Premium</li>
            <li className="flex items-center gap-2"><span className="text-success">✓</span> Navegação por teclado no leitor</li>
          </ul>
        </div>

        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-graphite-100 mb-3">🛠️ Tecnologias Utilizadas</h2>
          <ul className="space-y-2 text-sm text-graphite-300">
            <li className="flex items-center gap-2"><span className="text-violet-accent">•</span> React + TypeScript</li>
            <li className="flex items-center gap-2"><span className="text-violet-accent">•</span> Tailwind CSS</li>
            <li className="flex items-center gap-2"><span className="text-violet-accent">•</span> IndexedDB (via idb)</li>
            <li className="flex items-center gap-2"><span className="text-violet-accent">•</span> File API (importação)</li>
            <li className="flex items-center gap-2"><span className="text-violet-accent">•</span> Vite (build tool)</li>
          </ul>

          <h3 className="text-sm font-semibold text-graphite-200 mt-4 mb-2">📱 Versão Android (Flutter)</h3>
          <ul className="space-y-2 text-sm text-graphite-300">
            <li className="flex items-center gap-2"><span className="text-violet-accent">•</span> Flutter + Dart</li>
            <li className="flex items-center gap-2"><span className="text-violet-accent">•</span> SQLite + Drift</li>
            <li className="flex items-center gap-2"><span className="text-violet-accent">•</span> Riverpod (estado)</li>
            <li className="flex items-center gap-2"><span className="text-violet-accent">•</span> GoRouter (navegação)</li>
            <li className="flex items-center gap-2"><span className="text-violet-accent">•</span> WorkManager (background)</li>
          </ul>
        </div>

        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-graphite-100 mb-3">📖 Como Usar</h2>
          <ol className="space-y-2 text-sm text-graphite-300 list-decimal list-inside">
            <li>Clique em "Importar" na barra lateral</li>
            <li>Escolha o tipo de importação</li>
            <li>Selecione imagens do seu dispositivo</li>
            <li>Preencha as informações da obra</li>
            <li>Organize os capítulos (opcional)</li>
            <li>Confirme a importação</li>
            <li>Acesse a obra na Biblioteca</li>
            <li>Clique em um capítulo para ler</li>
          </ol>
        </div>

        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-graphite-100 mb-3">⌨️ Atalhos do Leitor</h2>
          <div className="space-y-2 text-sm text-graphite-300">
            <div className="flex justify-between"><span>Próxima página</span><kbd className="text-xs bg-graphite-800 px-2 py-0.5 rounded">→ / Espaço</kbd></div>
            <div className="flex justify-between"><span>Página anterior</span><kbd className="text-xs bg-graphite-800 px-2 py-0.5 rounded">←</kbd></div>
            <div className="flex justify-between"><span>Fechar leitor</span><kbd className="text-xs bg-graphite-800 px-2 py-0.5 rounded">Esc</kbd></div>
            <div className="flex justify-between"><span>Mostrar/ocultar controles</span><kbd className="text-xs bg-graphite-800 px-2 py-0.5 rounded">Clique centro</kbd></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
