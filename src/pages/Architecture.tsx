export default function Architecture() {
  return (
    <div className="slide-up">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-graphite-100 mb-2">
          Arquitetura <span className="gradient-text">Técnica</span>
        </h1>
        <p className="text-graphite-300 text-sm">
          Estrutura modular com separação clara de responsabilidades
        </p>
      </div>

      {/* Architecture Diagram */}
      <div className="glass-card rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-graphite-100 mb-6 flex items-center gap-2">
          <span>🏗️</span> Diagrama de Camadas
        </h2>
        <div className="space-y-3">
          <ArchLayer
            name="Interface Flutter"
            items={['Telas', 'Widgets', 'Navegação', 'Animações']}
            color="violet"
            level={0}
          />
          <Arrow />
          <ArchLayer
            name="Gerenciamento de Estado"
            items={['Riverpod', 'Providers', 'State Notifiers']}
            color="info"
            level={1}
          />
          <Arrow />
          <ArchLayer
            name="Camada de Negócio"
            items={['Use Cases', 'Validação', 'Lógica de Download', 'Importação']}
            color="success"
            level={2}
          />
          <Arrow />
          <ArchLayer
            name="Repositórios"
            items={['Local Repository', 'Remote Repository', 'Download Repository']}
            color="warning"
            level={3}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <ArchLayer
              name="Banco SQLite (Drift)"
              items={['Obras', 'Capítulos', 'Progresso', 'Downloads', 'Configurações']}
              color="error"
              level={4}
            />
            <ArchLayer
              name="Fontes de Conteúdo"
              items={['Catálogo JSON', 'APIs Autorizadas', 'Importação Local']}
              color="violet"
              level={4}
            />
          </div>
        </div>
      </div>

      {/* Directory Structure */}
      <div className="glass-card rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-graphite-100 mb-4 flex items-center gap-2">
          <span>📁</span> Estrutura de Diretórios
        </h2>
        <div className="bg-graphite-950 rounded-lg p-4 font-mono text-sm overflow-x-auto">
          <pre className="text-graphite-300 leading-relaxed">
{`lib/
├── main.dart
├── app/
│   ├── app.dart
│   ├── router/          `}<span className="text-violet-light">{'// GoRouter'}</span>{`
│   └── theme/           `}<span className="text-violet-light">{'// Dark Premium'}</span>{`
│
├── core/
│   ├── constants/
│   ├── errors/
│   ├── extensions/
│   ├── services/
│   ├── utils/
│   └── widgets/         `}<span className="text-violet-light">{'// Componentes reutilizáveis'}</span>{`
│
├── database/
│   ├── app_database.dart `}<span className="text-violet-light">{'// Drift'}</span>{`
│   ├── tables/
│   └── migrations/
│
├── features/
│   ├── home/            `}<span className="text-violet-light">{'// Tela inicial'}</span>{`
│   ├── library/         `}<span className="text-violet-light">{'// Biblioteca pessoal'}</span>{`
│   ├── explore/         `}<span className="text-violet-light">{'// Descoberta'}</span>{`
│   ├── manga_details/   `}<span className="text-violet-light">{'// Detalhes da obra'}</span>{`
│   ├── reader/          `}<span className="text-violet-light">{'// Leitor (3 modos)'}</span>{`
│   ├── downloads/       `}<span className="text-violet-light">{'// Gerenciamento'}</span>{`
│   ├── history/
│   ├── favorites/
│   ├── statistics/
│   ├── import_files/    `}<span className="text-violet-light">{'// Importação local'}</span>{`
│   └── settings/
│
├── data/
│   ├── repositories/
│   ├── models/
│   ├── local/           `}<span className="text-violet-light">{'// SQLite'}</span>{`
│   └── remote/          `}<span className="text-violet-light">{'// APIs e catálogos'}</span>{`
│
├── providers/
│   ├── content_provider.dart
│   ├── local_provider.dart
│   ├── catalog_provider.dart
│   └── provider_manager.dart
│
└── background/
    ├── download_worker.dart  `}<span className="text-violet-light">{'// WorkManager'}</span>{`
    ├── update_worker.dart
    └── notification_service.dart`}
          </pre>
        </div>
      </div>

      {/* Data Flow */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-lg font-semibold text-graphite-100 mb-4 flex items-center gap-2">
          <span>🔄</span> Fluxo de Dados
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-violet-light mb-3">📂 Fluxo de Importação Local</h3>
            <div className="space-y-2">
              <FlowStep step={1} text="Usuário seleciona arquivo (CBZ/ZIP/PDF)" />
              <FlowStep step={2} text="Validação e verificação de integridade" />
              <FlowStep step={3} text="Extração segura para diretório privado" />
              <FlowStep step={4} text="Identificação de páginas e ordenação" />
              <FlowStep step={5} text="Extração de capa" />
              <FlowStep step={6} text="Registro no banco de dados" />
              <FlowStep step={7} text="Disponível na biblioteca offline" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-violet-light mb-3">🌐 Fluxo de Catálogo Online</h3>
            <div className="space-y-2">
              <FlowStep step={1} text="Consulta ao provedor de conteúdo" />
              <FlowStep step={2} text="Exibição de catálogo com busca/filtros" />
              <FlowStep step={3} text="Usuário adiciona à biblioteca" />
              <FlowStep step={4} text="Download do capítulo solicitado" />
              <FlowStep step={5} text="Validação SHA-256" />
              <FlowStep step={6} text="Armazenamento no diretório privado" />
              <FlowStep step={7} text="Leitura offline disponível" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArchLayer({ name, items, color, level }: { name: string; items: string[]; color: string; level: number }) {
  const colors: Record<string, string> = {
    violet: 'border-violet-accent/30 bg-violet-accent/5',
    info: 'border-info/30 bg-info/5',
    success: 'border-success/30 bg-success/5',
    warning: 'border-warning/30 bg-warning/5',
    error: 'border-error/30 bg-error/5',
  };

  return (
    <div className={`rounded-lg p-4 border ${colors[color]} transition-all hover:scale-[1.01]`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-graphite-100">{name}</h4>
        <span className="text-xs text-graphite-500">Nível {level}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span key={i} className="text-xs bg-graphite-800/60 text-graphite-300 px-2 py-1 rounded">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex justify-center">
      <div className="w-px h-4 bg-graphite-600"></div>
    </div>
  );
}

function FlowStep({ step, text }: { step: number; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 rounded-full bg-violet-accent/20 border border-violet-accent/40 flex items-center justify-center flex-shrink-0">
        <span className="text-xs text-violet-light font-medium">{step}</span>
      </div>
      <span className="text-xs text-graphite-300">{text}</span>
    </div>
  );
}
