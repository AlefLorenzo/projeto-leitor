import { useState } from 'react';

type FeatureCategory = 'reader' | 'library' | 'downloads' | 'explore' | 'automation' | 'storage';

const categories: { id: FeatureCategory; label: string; icon: string }[] = [
  { id: 'reader', label: 'Leitor', icon: '📖' },
  { id: 'library', label: 'Biblioteca', icon: '📚' },
  { id: 'downloads', label: 'Downloads', icon: '📥' },
  { id: 'explore', label: 'Explorar', icon: '🔍' },
  { id: 'automation', label: 'Automação', icon: '⚙️' },
  { id: 'storage', label: 'Armazenamento', icon: '💾' },
];

const features: Record<FeatureCategory, { title: string; items: string[] }[]> = {
  reader: [
    {
      title: 'Modo Mangá (Direita → Esquerda)',
      items: ['Navegação página por página', 'Zoom com gestos', 'Página dupla opcional', 'Navegação entre capítulos'],
    },
    {
      title: 'Modo Manhwa (Vertical Contínuo)',
      items: ['Rolagem vertical contínua', 'Carregamento progressivo', 'Espaçamento configurável', 'Preservação de posição'],
    },
    {
      title: 'Modo Manhua (Esquerda → Direita)',
      items: ['Navegação página por página', 'Rolagem vertical opcional', 'Zoom', 'Navegação entre capítulos'],
    },
    {
      title: 'Recursos Gerais do Leitor',
      items: [
        'Salvamento automático de progresso',
        'Restauração da última posição',
        'Ajuste de brilho',
        'Bloqueio de orientação',
        'Modo imersivo',
        'Controles ocultáveis',
        'Indicador de página e barra de progresso',
        'Configuração independente por obra',
      ],
    },
  ],
  library: [
    {
      title: 'Organização',
      items: ['Visualização em grade', 'Capas em destaque', 'Progresso de leitura', 'Último capítulo lido', 'Indicador de novos capítulos'],
    },
    {
      title: 'Gerenciamento',
      items: ['Favoritos', 'Pesquisa', 'Filtros e ordenação', 'Categorias personalizadas', 'Status individual por obra'],
    },
    {
      title: 'Status Disponíveis',
      items: ['📖 Lendo', '📋 Quero ler', '✅ Concluído', '⏸️ Pausado', '❌ Abandonado'],
    },
    {
      title: 'Seções Especiais',
      items: ['Continuar lendo', 'Leitura recente', 'Obras acompanhadas', 'Favoritos em destaque'],
    },
  ],
  downloads: [
    {
      title: 'Operações',
      items: ['Download individual', 'Download em lote', 'Fila de downloads', 'Progresso individual em tempo real'],
    },
    {
      title: 'Controle',
      items: ['Pausar', 'Retomar', 'Cancelar', 'Remover da fila', 'Repetir downloads com falha'],
    },
    {
      title: 'Inteligência',
      items: ['Retomada de transferências', 'Validação SHA-256', 'Controle de duplicidade', 'Até 3 tentativas automáticas', 'Controle de armazenamento'],
    },
    {
      title: 'Estados',
      items: ['⏳ Aguardando', '📥 Baixando', '⏸️ Pausado', '✅ Concluído', '❌ Falhou', '🚫 Cancelado'],
    },
  ],
  explore: [
    {
      title: 'Descoberta',
      items: ['Catálogo de obras', 'Pesquisa por título', 'Filtros por gênero', 'Filtros por tipo', 'Ordenação'],
    },
    {
      title: 'Detalhes da Obra',
      items: ['Capa em destaque', 'Sinopse completa', 'Autor', 'Gêneros', 'Lista de capítulos', 'Status de acompanhamento'],
    },
    {
      title: 'Ações',
      items: ['Adicionar à biblioteca', 'Baixar capítulos', 'Diferenciar online/local', 'Sem conteúdo fictício'],
    },
  ],
  automation: [
    {
      title: 'Atualizações',
      items: ['Verificação periódica (6h, 12h, 24h)', 'Verificação manual', 'Comparação de versões', 'ETag quando suportado', 'Identificação de novos capítulos'],
    },
    {
      title: 'Downloads Automáticos',
      items: ['Fila automática', 'Notificações locais', 'Apenas Wi-Fi (configurável)', 'Limite de downloads simultâneos', 'Limite de armazenamento'],
    },
    {
      title: 'WorkManager',
      items: ['Compatível com restrições Android', 'Verificação ao abrir app', 'Sem garantia de horário exato', 'Tarefas periódicas confiáveis'],
    },
  ],
  storage: [
    {
      title: 'Visualização',
      items: ['Espaço ocupado pelo app', 'Espaço por capítulos', 'Espaço por obra', 'Quantidade de capítulos baixados', 'Espaço disponível estimado'],
    },
    {
      title: 'Gerenciamento',
      items: ['Apagar capítulo individual', 'Apagar capítulos lidos', 'Apagar downloads de uma obra', 'Limpar arquivos temporários', 'Configurar limite de armazenamento'],
    },
    {
      title: 'Segurança',
      items: ['Nunca excluir sem permissão', 'Respeitar preferências do usuário', 'Armazenamento em diretório privado', 'Organização por obra/capítulo'],
    },
  ],
};

export default function Features() {
  const [activeCategory, setActiveCategory] = useState<FeatureCategory>('reader');

  return (
    <div className="slide-up">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-graphite-100 mb-2">
          Funcionalidades <span className="gradient-text">Completas</span>
        </h1>
        <p className="text-graphite-300 text-sm">
          Todas as funcionalidades planejadas para o Manga Offline
        </p>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeCategory === cat.id
                ? 'bg-violet-accent/20 text-violet-light border border-violet-accent/40'
                : 'bg-graphite-800/40 text-graphite-400 border border-graphite-700/30 hover:border-graphite-600/50'
            }`}
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features[activeCategory].map((section, idx) => (
          <div key={idx} className="glass-card rounded-xl p-5 glass-card-hover transition-all">
            <h3 className="text-sm font-semibold text-graphite-100 mb-3">{section.title}</h3>
            <ul className="space-y-2">
              {section.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-graphite-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-accent/50 mt-1.5 flex-shrink-0"></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Import Section */}
      <div className="mt-8 glass-card rounded-xl p-6">
        <h2 className="text-lg font-semibold text-graphite-100 mb-4 flex items-center gap-2">
          <span>📂</span> Importação Local — Formatos Suportados
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FormatCard format="CBZ" description="Comic Book ZIP" icon="📦" />
          <FormatCard format="ZIP" description="Com imagens" icon="🗜️" />
          <FormatCard format="PDF" description="Documentos" icon="📄" />
          <FormatCard format="Pastas" description="Diretórios de imagens" icon="📁" />
        </div>
      </div>
    </div>
  );
}

function FormatCard({ format, description, icon }: { format: string; description: string; icon: string }) {
  return (
    <div className="bg-graphite-800/40 rounded-lg p-4 text-center border border-graphite-700/20 hover:border-violet-accent/30 transition-all">
      <span className="text-2xl mb-2 block">{icon}</span>
      <p className="text-sm font-semibold text-graphite-100">{format}</p>
      <p className="text-xs text-graphite-400">{description}</p>
    </div>
  );
}
