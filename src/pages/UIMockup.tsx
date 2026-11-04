import { useState } from 'react';

type Screen = 'home' | 'library' | 'reader' | 'explore' | 'downloads';

const screens: { id: Screen; label: string; icon: string }[] = [
  { id: 'home', label: 'Início', icon: '🏠' },
  { id: 'explore', label: 'Explorar', icon: '🔍' },
  { id: 'library', label: 'Biblioteca', icon: '📚' },
  { id: 'reader', label: 'Leitor', icon: '📖' },
  { id: 'downloads', label: 'Downloads', icon: '📥' },
];

export default function UIMockup() {
  const [activeScreen, setActiveScreen] = useState<Screen>('home');

  return (
    <div className="slide-up">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-graphite-100 mb-2">
          UI <span className="gradient-text">Preview</span>
        </h1>
        <p className="text-graphite-300 text-sm">
          Demonstração da identidade visual Dark Premium — Grafite + Violeta
        </p>
      </div>

      {/* Design Guidelines */}
      <div className="glass-card rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-graphite-100 mb-4 flex items-center gap-2">
          <span>🎨</span> Diretrizes Visuais
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <ColorSwatch color="#0a0a0f" name="Fundo Principal" label="Preto Grafite" />
          <ColorSwatch color="#1a1a2e" name="Cartões" label="Grafite Escuro" />
          <ColorSwatch color="#8b5cf6" name="Destaque" label="Violeta" />
          <ColorSwatch color="#e5e5e5" name="Texto" label="Branco Suave" dark />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-graphite-800/40 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-graphite-300 uppercase mb-2">Princípios</h4>
            <ul className="space-y-1.5 text-xs text-graphite-400">
              <li>• Capas são protagonistas da interface</li>
              <li>• Bordas arredondadas e consistentes</li>
              <li>• Animações suaves e rápidas</li>
              <li>• Hierarquia visual clara</li>
            </ul>
          </div>
          <div className="bg-graphite-800/40 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-graphite-300 uppercase mb-2">Evitar</h4>
            <ul className="space-y-1.5 text-xs text-graphite-400">
              <li>• Excesso de cores e gradientes</li>
              <li>• Cartões ocupando espaço desnecessário</li>
              <li>• Preto absoluto em todas as superfícies</li>
              <li>• Elementos cortados ou sobrepostos</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Screen Selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {screens.map((screen) => (
          <button
            key={screen.id}
            onClick={() => setActiveScreen(screen.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeScreen === screen.id
                ? 'bg-violet-accent/20 text-violet-light border border-violet-accent/40'
                : 'bg-graphite-800/40 text-graphite-400 border border-graphite-700/30 hover:border-graphite-600/50'
            }`}
          >
            <span>{screen.icon}</span>
            {screen.label}
          </button>
        ))}
      </div>

      {/* Phone Mockup */}
      <div className="flex justify-center mb-8">
        <div className="w-[320px] bg-graphite-900 rounded-[2rem] border-2 border-graphite-700/50 overflow-hidden shadow-2xl shadow-violet-accent/5">
          {/* Status Bar */}
          <div className="flex items-center justify-between px-6 py-2 bg-graphite-950">
            <span className="text-[10px] text-graphite-400">9:41</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-graphite-400">📶</span>
              <span className="text-[10px] text-graphite-400">🔋</span>
            </div>
          </div>

          {/* Screen Content */}
          <div className="h-[560px] overflow-hidden">
            {activeScreen === 'home' && <HomeScreen />}
            {activeScreen === 'explore' && <ExploreScreen />}
            {activeScreen === 'library' && <LibraryScreen />}
            {activeScreen === 'reader' && <ReaderScreen />}
            {activeScreen === 'downloads' && <DownloadsScreen />}
          </div>

          {/* Bottom Navigation */}
          <div className="flex items-center justify-around py-3 bg-graphite-950 border-t border-graphite-800">
            <NavButton icon="🏠" label="Início" active={activeScreen === 'home'} />
            <NavButton icon="🔍" label="Explorar" active={activeScreen === 'explore'} />
            <NavButton icon="📚" label="Biblioteca" active={activeScreen === 'library'} />
            <NavButton icon="📥" label="Downloads" active={activeScreen === 'downloads'} />
          </div>
        </div>
      </div>

      {/* Navigation Info */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-lg font-semibold text-graphite-100 mb-4 flex items-center gap-2">
          <span>📱</span> Navegação Principal
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NavInfo icon="🏠" title="Início" desc="Continuar lendo, recentes, recomendações" />
          <NavInfo icon="🔍" title="Explorar" desc="Catálogo, busca, filtros, descoberta" />
          <NavInfo icon="📚" title="Biblioteca" desc="Obras pessoais, status, categorias" />
          <NavInfo icon="📥" title="Downloads" desc="Fila, progresso, gerenciamento" />
        </div>
      </div>
    </div>
  );
}

function HomeScreen() {
  return (
    <div className="p-4 bg-gradient-to-b from-graphite-900 to-graphite-950 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-graphite-100">Manga Offline</h2>
        <div className="w-7 h-7 rounded-full bg-violet-accent/20 flex items-center justify-center">
          <span className="text-xs">⚙️</span>
        </div>
      </div>

      {/* Continue Reading */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-graphite-300 mb-2">Continuar Lendo</h3>
        <div className="flex gap-2 overflow-hidden">
          <ContinueCard title="Solo Leveling" chapter="Cap. 145" color="from-purple-900 to-indigo-900" />
          <ContinueCard title="Tower of God" chapter="Cap. 580" color="from-blue-900 to-cyan-900" />
        </div>
      </div>

      {/* Recent Updates */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-graphite-300 mb-2">Atualizações Recentes</h3>
        <div className="grid grid-cols-3 gap-2">
          <MangaCard title="One Piece" color="from-red-900 to-orange-900" />
          <MangaCard title="Jujutsu Kaisen" color="from-purple-900 to-pink-900" />
          <MangaCard title="Chainsaw Man" color="from-gray-800 to-red-900" />
        </div>
      </div>

      {/* Favorites */}
      <div>
        <h3 className="text-xs font-semibold text-graphite-300 mb-2">Favoritos</h3>
        <div className="grid grid-cols-4 gap-1.5">
          <MiniCover color="from-emerald-900 to-teal-900" />
          <MiniCover color="from-amber-900 to-yellow-900" />
          <MiniCover color="from-rose-900 to-pink-900" />
          <MiniCover color="from-sky-900 to-blue-900" />
        </div>
      </div>
    </div>
  );
}

function ExploreScreen() {
  return (
    <div className="p-4 bg-gradient-to-b from-graphite-900 to-graphite-950 h-full">
      <h2 className="text-base font-bold text-graphite-100 mb-3">Explorar</h2>
      
      {/* Search Bar */}
      <div className="bg-graphite-800 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
        <span className="text-xs text-graphite-500">🔍</span>
        <span className="text-xs text-graphite-500">Buscar obras...</span>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 mb-3 overflow-hidden">
        <span className="text-[10px] px-2 py-1 rounded-full bg-violet-accent/20 text-violet-light border border-violet-accent/30">Todos</span>
        <span className="text-[10px] px-2 py-1 rounded-full bg-graphite-800 text-graphite-400">Mangá</span>
        <span className="text-[10px] px-2 py-1 rounded-full bg-graphite-800 text-graphite-400">Manhwa</span>
        <span className="text-[10px] px-2 py-1 rounded-full bg-graphite-800 text-graphite-400">Manhua</span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-2">
        <MangaCard title="Naruto" color="from-orange-800 to-red-900" />
        <MangaCard title="Bleach" color="from-gray-700 to-blue-900" />
        <MangaCard title="Dragon Ball" color="from-yellow-800 to-orange-900" />
        <MangaCard title="Attack on Titan" color="from-gray-800 to-gray-900" />
        <MangaCard title="Demon Slayer" color="from-teal-800 to-green-900" />
        <MangaCard title="My Hero Academia" color="from-green-800 to-emerald-900" />
      </div>
    </div>
  );
}

function LibraryScreen() {
  return (
    <div className="p-4 bg-gradient-to-b from-graphite-900 to-graphite-950 h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-graphite-100">Biblioteca</h2>
        <span className="text-xs text-graphite-500">12 obras</span>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1.5 mb-3 overflow-hidden">
        <span className="text-[10px] px-2 py-1 rounded-full bg-violet-accent/20 text-violet-light border border-violet-accent/30">Lendo (5)</span>
        <span className="text-[10px] px-2 py-1 rounded-full bg-graphite-800 text-graphite-400">Quero ler</span>
        <span className="text-[10px] px-2 py-1 rounded-full bg-graphite-800 text-graphite-400">Concluído</span>
      </div>

      {/* Library Grid with Progress */}
      <div className="grid grid-cols-3 gap-2">
        <LibraryCard title="Solo Leveling" progress={75} color="from-purple-900 to-indigo-900" />
        <LibraryCard title="Tower of God" progress={45} color="from-blue-900 to-cyan-900" />
        <LibraryCard title="One Piece" progress={90} color="from-red-900 to-orange-900" />
        <LibraryCard title="Jujutsu Kaisen" progress={60} color="from-purple-900 to-pink-900" />
        <LibraryCard title="Chainsaw Man" progress={30} color="from-gray-800 to-red-900" />
        <LibraryCard title="Berserk" progress={15} color="from-gray-700 to-gray-900" />
      </div>
    </div>
  );
}

function ReaderScreen() {
  return (
    <div className="h-full bg-black flex flex-col">
      {/* Reader Top Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/80">
        <span className="text-[10px] text-graphite-400">← Voltar</span>
        <span className="text-[10px] text-graphite-300 font-medium">Cap. 145</span>
        <span className="text-[10px] text-graphite-400">⋮</span>
      </div>

      {/* Reader Content */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-gray-900 to-black relative">
        <div className="text-center">
          <div className="w-32 h-44 bg-gradient-to-br from-purple-900/40 to-indigo-900/40 rounded-lg border border-violet-accent/20 flex items-center justify-center mb-2">
            <span className="text-2xl">📖</span>
          </div>
          <p className="text-[10px] text-graphite-500">Página 12 de 32</p>
        </div>
        
        {/* Navigation Zones */}
        <div className="absolute left-0 top-0 bottom-0 w-1/4 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <span className="text-graphite-500 text-lg">◀</span>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-1/4 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <span className="text-graphite-500 text-lg">▶</span>
        </div>
      </div>

      {/* Reader Bottom Bar */}
      <div className="px-3 py-2 bg-black/80">
        <div className="w-full h-1 bg-graphite-800 rounded-full overflow-hidden mb-1">
          <div className="progress-bar h-full" style={{ width: '37%' }}></div>
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-graphite-500">Pág. 12</span>
          <span className="text-[10px] text-graphite-500">Pág. 32</span>
        </div>
      </div>
    </div>
  );
}

function DownloadsScreen() {
  return (
    <div className="p-4 bg-gradient-to-b from-graphite-900 to-graphite-950 h-full">
      <h2 className="text-base font-bold text-graphite-100 mb-3">Downloads</h2>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-graphite-800/60 rounded-lg p-2 text-center">
          <p className="text-sm font-bold text-violet-light">8</p>
          <p className="text-[9px] text-graphite-500">Ativos</p>
        </div>
        <div className="bg-graphite-800/60 rounded-lg p-2 text-center">
          <p className="text-sm font-bold text-success">142</p>
          <p className="text-[9px] text-graphite-500">Concluídos</p>
        </div>
        <div className="bg-graphite-800/60 rounded-lg p-2 text-center">
          <p className="text-sm font-bold text-graphite-300">2.4GB</p>
          <p className="text-[9px] text-graphite-500">Usado</p>
        </div>
      </div>

      {/* Download Items */}
      <div className="space-y-2">
        <DownloadItem title="Solo Leveling — Cap. 146" progress={65} status="downloading" />
        <DownloadItem title="Tower of God — Cap. 581" progress={100} status="completed" />
        <DownloadItem title="One Piece — Cap. 1100" progress={30} status="downloading" />
        <DownloadItem title="Jujutsu Kaisen — Cap. 240" progress={0} status="paused" />
        <DownloadItem title="Chainsaw Man — Cap. 155" progress={100} status="completed" />
      </div>
    </div>
  );
}

// Sub-components

function ColorSwatch({ color, name, label, dark }: { color: string; name: string; label: string; dark?: boolean }) {
  return (
    <div className="text-center">
      <div
        className="w-full aspect-square rounded-xl mb-2 border border-graphite-700/30"
        style={{ backgroundColor: color }}
      ></div>
      <p className={`text-xs font-medium ${dark ? 'text-graphite-800' : 'text-graphite-200'}`}>{name}</p>
      <p className="text-[10px] text-graphite-500">{label}</p>
    </div>
  );
}

function NavButton({ icon, label, active }: { icon: string; label: string; active: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-0.5 ${active ? 'text-violet-light' : 'text-graphite-500'}`}>
      <span className="text-sm">{icon}</span>
      <span className="text-[9px]">{label}</span>
    </div>
  );
}

function NavInfo({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-graphite-800/40 rounded-lg p-3 text-center">
      <span className="text-xl mb-1 block">{icon}</span>
      <p className="text-xs font-medium text-graphite-200">{title}</p>
      <p className="text-[10px] text-graphite-500 mt-0.5">{desc}</p>
    </div>
  );
}

function ContinueCard({ title, chapter, color }: { title: string; chapter: string; color: string }) {
  return (
    <div className={`flex-1 bg-gradient-to-br ${color} rounded-lg p-2 min-w-[120px]`}>
      <p className="text-[10px] font-medium text-white/90 truncate">{title}</p>
      <p className="text-[9px] text-white/60">{chapter}</p>
      <div className="mt-1.5 w-full h-0.5 bg-white/20 rounded-full overflow-hidden">
        <div className="h-full bg-violet-accent rounded-full" style={{ width: '60%' }}></div>
      </div>
    </div>
  );
}

function MangaCard({ title, color }: { title: string; color: string }) {
  return (
    <div className="text-center">
      <div className={`aspect-[2/3] bg-gradient-to-br ${color} rounded-md mb-1 flex items-center justify-center`}>
        <span className="text-lg opacity-50">📕</span>
      </div>
      <p className="text-[9px] text-graphite-400 truncate">{title}</p>
    </div>
  );
}

function MiniCover({ color }: { color: string }) {
  return (
    <div className={`aspect-[2/3] bg-gradient-to-br ${color} rounded-md`}></div>
  );
}

function LibraryCard({ title, progress, color }: { title: string; progress: number; color: string }) {
  return (
    <div className="text-center">
      <div className={`aspect-[2/3] bg-gradient-to-br ${color} rounded-md mb-1 relative overflow-hidden`}>
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
          <div className="h-full bg-violet-accent" style={{ width: `${progress}%` }}></div>
        </div>
      </div>
      <p className="text-[9px] text-graphite-400 truncate">{title}</p>
      <p className="text-[8px] text-graphite-600">{progress}%</p>
    </div>
  );
}

function DownloadItem({ title, progress, status }: { title: string; progress: number; status: string }) {
  const statusColors: Record<string, string> = {
    downloading: 'text-violet-light',
    completed: 'text-success',
    paused: 'text-warning',
    failed: 'text-error',
  };

  const statusLabels: Record<string, string> = {
    downloading: '📥 Baixando',
    completed: '✅ Concluído',
    paused: '⏸️ Pausado',
    failed: '❌ Falhou',
  };

  return (
    <div className="bg-graphite-800/40 rounded-lg p-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] text-graphite-300 truncate flex-1">{title}</p>
        <span className={`text-[9px] ${statusColors[status]}`}>{statusLabels[status]}</span>
      </div>
      {status === 'downloading' && (
        <div className="w-full h-1 bg-graphite-700 rounded-full overflow-hidden">
          <div className="progress-bar h-full" style={{ width: `${progress}%` }}></div>
        </div>
      )}
    </div>
  );
}
