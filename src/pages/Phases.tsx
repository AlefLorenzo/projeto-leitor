import { useState } from 'react';

interface Phase {
  id: number;
  title: string;
  subtitle: string;
  status: 'completed' | 'current' | 'pending';
  items: string[];
  deliverables: string[];
}

const phases: Phase[] = [
  {
    id: 0,
    title: 'Análise Técnica',
    subtitle: 'Planejamento e definição',
    status: 'completed',
    items: [
      'Análise do ambiente de desenvolvimento',
      'Definição da arquitetura',
      'Estrutura de pastas',
      'Dependências e versões',
      'Banco de dados',
      'Fluxo de funcionamento',
      'Cronograma',
      'Riscos identificados',
    ],
    deliverables: ['Documento técnico', 'Estrutura definida', 'Aprovação do usuário'],
  },
  {
    id: 1,
    title: 'Fundação',
    subtitle: 'Base do projeto',
    status: 'current',
    items: [
      'Criar projeto Flutter',
      'Configurar Android',
      'Configurar dependências',
      'Implementar tema Dark Premium',
      'Configurar banco de dados (Drift)',
      'Implementar navegação (GoRouter)',
      'Criar componentes reutilizáveis',
    ],
    deliverables: ['App compilando', 'Tema aplicado', 'Navegação funcional', 'Banco configurado'],
  },
  {
    id: 2,
    title: 'Biblioteca Local',
    subtitle: 'Importação e organização',
    status: 'pending',
    items: [
      'Importação de arquivos',
      'Organização no storage',
      'Integração com banco',
      'Extração de capas',
      'Status de leitura',
      'Favoritos',
      'Histórico',
    ],
    deliverables: ['Importação funcional', 'Biblioteca visual', 'Progresso salvo'],
  },
  {
    id: 3,
    title: 'Leitor',
    subtitle: 'Experiência de leitura',
    status: 'pending',
    items: [
      'Leitura de CBZ/ZIP',
      'Leitura de PDF',
      'Leitura de imagens',
      'Modo Mangá (RTL)',
      'Modo Manhwa (vertical)',
      'Modo Manhua (LTR)',
      'Progresso e posição',
      'Funcionamento offline',
    ],
    deliverables: ['3 modos de leitura', 'Offline funcional', 'Progresso persistente'],
  },
  {
    id: 4,
    title: 'Catálogos',
    subtitle: 'Conteúdo online',
    status: 'pending',
    items: [
      'Sistema de provedores',
      'Catálogo JSON próprio',
      'Tela Explorar',
      'Pesquisa e filtros',
      'Detalhes da obra',
      'Lista de capítulos',
    ],
    deliverables: ['Catálogo navegável', 'Busca funcional', 'Detalhes completos'],
  },
  {
    id: 5,
    title: 'Downloads',
    subtitle: 'Gerenciamento de transferências',
    status: 'pending',
    items: [
      'Fila de downloads',
      'Transferência com progresso',
      'Pausa e retomada',
      'Validação SHA-256',
      'Armazenamento organizado',
      'Retry automático',
    ],
    deliverables: ['Download funcional', 'Retomada confiável', 'Integridade validada'],
  },
  {
    id: 6,
    title: 'Automação',
    subtitle: 'WorkManager e notificações',
    status: 'pending',
    items: [
      'WorkManager configurado',
      'Atualizações periódicas',
      'Downloads automáticos',
      'Notificações locais',
      'Controle de conectividade',
    ],
    deliverables: ['Atualizações automáticas', 'Notificações funcionais'],
  },
  {
    id: 7,
    title: 'Polimento',
    subtitle: 'Refinamento final',
    status: 'pending',
    items: [
      'Melhorias visuais',
      'Otimização de desempenho',
      'Estatísticas de leitura',
      'Gerenciamento de armazenamento',
      'Acessibilidade',
      'Testes de regressão',
    ],
    deliverables: ['App polido', 'Performance otimizada', 'Testes passando'],
  },
  {
    id: 8,
    title: 'Publicação',
    subtitle: 'Preparação para Play Store',
    status: 'pending',
    items: [
      'Identidade visual final',
      'Ícone do app',
      'Splash screen',
      'Permissões Android',
      'Política de privacidade',
      'Assinatura do APK',
      'Android App Bundle',
      'Testes finais',
    ],
    deliverables: ['APK de testes', 'AAB para Play Store', 'Documentação completa'],
  },
];

export default function Phases() {
  const [expandedPhase, setExpandedPhase] = useState<number | null>(1);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success/20 text-success border-success/30';
      case 'current': return 'bg-violet-accent/20 text-violet-light border-violet-accent/30';
      case 'pending': return 'bg-graphite-700/30 text-graphite-400 border-graphite-600/30';
      default: return '';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return '✓ Concluída';
      case 'current': return '● Em andamento';
      case 'pending': return '○ Pendente';
      default: return '';
    }
  };

  const progress = (phases.filter(p => p.status === 'completed').length / phases.length) * 100;

  return (
    <div className="slide-up">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-graphite-100 mb-2">
          Fases de <span className="gradient-text">Desenvolvimento</span>
        </h1>
        <p className="text-graphite-300 text-sm">
          Cronograma de execução do projeto — 9 fases sequenciais
        </p>
      </div>

      {/* Progress Bar */}
      <div className="glass-card rounded-xl p-5 mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-graphite-200">Progresso Geral</span>
          <span className="text-sm text-violet-light font-mono">{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-2 bg-graphite-800 rounded-full overflow-hidden">
          <div className="progress-bar h-full" style={{ width: `${progress}%` }}></div>
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-graphite-500">Fase 0</span>
          <span className="text-xs text-graphite-500">Fase 8</span>
        </div>
      </div>

      {/* Phase Timeline */}
      <div className="space-y-3">
        {phases.map((phase) => (
          <div
            key={phase.id}
            className={`glass-card rounded-xl overflow-hidden transition-all ${
              phase.status === 'current' ? 'border-violet-accent/30' : ''
            }`}
          >
            {/* Phase Header */}
            <button
              onClick={() => setExpandedPhase(expandedPhase === phase.id ? null : phase.id)}
              className="w-full flex items-center gap-4 p-4 text-left hover:bg-graphite-800/30 transition-colors"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                phase.status === 'completed' ? 'bg-success/20' :
                phase.status === 'current' ? 'bg-violet-accent/20 pulse-glow' :
                'bg-graphite-700/30'
              }`}>
                <span className="text-sm font-bold text-graphite-200">{phase.id}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-graphite-100">{phase.title}</h3>
                <p className="text-xs text-graphite-400">{phase.subtitle}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(phase.status)}`}>
                {getStatusLabel(phase.status)}
              </span>
              <span className={`text-graphite-500 transition-transform ${expandedPhase === phase.id ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>

            {/* Phase Details */}
            {expandedPhase === phase.id && (
              <div className="px-4 pb-4 pt-0 border-t border-graphite-700/30 fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <h4 className="text-xs font-semibold text-graphite-300 uppercase tracking-wider mb-2">Tarefas</h4>
                    <ul className="space-y-1.5">
                      {phase.items.map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-graphite-400">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            phase.status === 'completed' ? 'bg-success' :
                            phase.status === 'current' ? 'bg-violet-accent' :
                            'bg-graphite-600'
                          }`}></span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-graphite-300 uppercase tracking-wider mb-2">Entregáveis</h4>
                    <ul className="space-y-1.5">
                      {phase.deliverables.map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-graphite-400">
                          <span className="text-violet-accent">📦</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
