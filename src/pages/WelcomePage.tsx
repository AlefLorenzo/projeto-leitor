import { useState } from 'react';
import { seedDemoData } from '../services/seed';

interface WelcomePageProps {
  onComplete: () => void;
}

export default function WelcomePage({ onComplete }: WelcomePageProps) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'welcome' | 'loading' | 'done'>('welcome');

  const handleLoadDemo = async () => {
    setLoading(true);
    setStep('loading');
    
    try {
      await seedDemoData();
      setStep('done');
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (error) {
      console.error('Error loading demo data:', error);
      setStep('welcome');
      setLoading(false);
    }
  };

  const handleStartEmpty = () => {
    onComplete();
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-graphite-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-violet-accent border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-xl font-bold text-graphite-100 mb-2">Carregando demonstração...</h2>
          <p className="text-sm text-graphite-400">Preparando obras de exemplo e páginas</p>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-graphite-950 flex items-center justify-center p-4">
        <div className="text-center slide-up">
          <div className="text-6xl mb-4">✓</div>
          <h2 className="text-xl font-bold text-graphite-100 mb-2">Demonstração carregada!</h2>
          <p className="text-sm text-graphite-400">Redirecionando para o aplicativo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-graphite-950 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-accent to-violet-dark flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-accent/20">
            <span className="text-4xl font-bold text-white">M</span>
          </div>
          <h1 className="text-3xl font-bold text-graphite-100 mb-2">
            Manga <span className="gradient-text">Offline</span>
          </h1>
          <p className="text-sm text-graphite-400">Sua biblioteca pessoal de mangás, manhwas e manhuas</p>
        </div>

        {/* Welcome Card */}
        <div className="glass-card rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-graphite-100 mb-4 flex items-center gap-2">
            <span>👋</span> Bem-vindo!
          </h2>
          <p className="text-sm text-graphite-300 mb-6 leading-relaxed">
            Este é um aplicativo completo de leitura offline. Você pode começar de duas formas:
          </p>

          <div className="space-y-4">
            {/* Demo Option */}
            <button
              onClick={handleLoadDemo}
              disabled={loading}
              className="w-full p-5 rounded-xl border-2 border-violet-accent/30 hover:border-violet-accent/60 bg-violet-accent/5 hover:bg-violet-accent/10 transition-all text-left group disabled:opacity-50"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-violet-accent/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <span className="text-2xl">🎮</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-graphite-100 mb-1">Carregar Demonstração</h3>
                  <p className="text-xs text-graphite-400 leading-relaxed">
                    Carrega 4 obras de exemplo com capas, capítulos e páginas para você testar todas as funcionalidades imediatamente.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-[10px] px-2 py-0.5 bg-violet-accent/10 text-violet-light rounded">4 obras</span>
                    <span className="text-[10px] px-2 py-0.5 bg-violet-accent/10 text-violet-light rounded">12 capítulos</span>
                    <span className="text-[10px] px-2 py-0.5 bg-violet-accent/10 text-violet-light rounded">60 páginas</span>
                  </div>
                </div>
              </div>
            </button>

            {/* Empty Start Option */}
            <button
              onClick={handleStartEmpty}
              className="w-full p-5 rounded-xl border border-graphite-700/30 hover:border-graphite-600/50 bg-graphite-800/20 hover:bg-graphite-800/40 transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-graphite-700/30 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <span className="text-2xl">📝</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-graphite-100 mb-1">Começar do Zero</h3>
                  <p className="text-xs text-graphite-400 leading-relaxed">
                    Comece com a biblioteca vazia e importe suas próprias obras. Ideal se você já tem arquivos prontos para importar.
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Features Preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="glass-card rounded-lg p-4 text-center">
            <span className="text-3xl mb-2 block">📚</span>
            <h4 className="text-xs font-semibold text-graphite-200 mb-1">Biblioteca</h4>
            <p className="text-[10px] text-graphite-500">Organize suas obras</p>
          </div>
          <div className="glass-card rounded-lg p-4 text-center">
            <span className="text-3xl mb-2 block">📖</span>
            <h4 className="text-xs font-semibold text-graphite-200 mb-1">Leitor</h4>
            <p className="text-[10px] text-graphite-500">3 modos de leitura</p>
          </div>
          <div className="glass-card rounded-lg p-4 text-center">
            <span className="text-3xl mb-2 block">✈️</span>
            <h4 className="text-xs font-semibold text-graphite-200 mb-1">Offline</h4>
            <p className="text-[10px] text-graphite-500">Leia sem internet</p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-graphite-500">
            Versão 1.0 • Todas as fases concluídas ✓
          </p>
        </div>
      </div>
    </div>
  );
}
