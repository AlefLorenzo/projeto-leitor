type Page = 'dashboard' | 'architecture' | 'features' | 'phases' | 'ui' | 'tech';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const navItems: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'architecture', label: 'Arquitetura', icon: '🏗️' },
  { id: 'features', label: 'Funcionalidades', icon: '⚡' },
  { id: 'phases', label: 'Fases', icon: '🚀' },
  { id: 'ui', label: 'UI Preview', icon: '🎨' },
  { id: 'tech', label: 'Tech Stack', icon: '🔧' },
];

export default function Sidebar({ currentPage, onNavigate, isOpen, onToggle }: SidebarProps) {
  return (
    <aside className={`fixed left-0 top-0 h-full bg-graphite-900 border-r border-graphite-700/50 transition-all duration-300 z-50 ${isOpen ? 'w-64' : 'w-16'}`}>
      {/* Header */}
      <div className="flex items-center h-16 px-4 border-b border-graphite-700/50">
        <button onClick={onToggle} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-graphite-700/50 transition-colors">
          <span className="text-lg">{isOpen ? '◀' : '▶'}</span>
        </button>
        {isOpen && (
          <div className="ml-3 flex items-center gap-2 fade-in">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-accent to-violet-dark flex items-center justify-center">
              <span className="text-white text-sm font-bold">M</span>
            </div>
            <span className="text-sm font-semibold text-graphite-100">Manga Offline</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="mt-4 px-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all duration-200 ${
              currentPage === item.id
                ? 'nav-item-active text-violet-light'
                : 'text-graphite-300 hover:bg-graphite-800/50 hover:text-graphite-100'
            }`}
          >
            <span className="text-lg flex-shrink-0">{item.icon}</span>
            {isOpen && <span className="text-sm font-medium">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Footer */}
      {isOpen && (
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-graphite-700/50 fade-in">
          <div className="glass-card rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-success pulse-glow"></div>
              <span className="text-xs text-graphite-300">Fase 0 — Concluída</span>
            </div>
            <p className="text-xs text-graphite-400">Pronto para iniciar Fase 1</p>
          </div>
        </div>
      )}
    </aside>
  );
}
