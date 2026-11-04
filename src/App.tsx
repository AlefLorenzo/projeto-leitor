import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Architecture from './pages/Architecture';
import Features from './pages/Features';
import Phases from './pages/Phases';
import UIMockup from './pages/UIMockup';
import TechStack from './pages/TechStack';

type Page = 'dashboard' | 'architecture' | 'features' | 'phases' | 'ui' | 'tech';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'architecture': return <Architecture />;
      case 'features': return <Features />;
      case 'phases': return <Phases />;
      case 'ui': return <UIMockup />;
      case 'tech': return <TechStack />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-graphite-950">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <main className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

export default App;
