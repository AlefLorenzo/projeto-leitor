export default function Dashboard() {
  return (
    <div className="slide-up">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-graphite-100 mb-2">
          Manga <span className="gradient-text">Offline</span>
        </h1>
        <p className="text-graphite-300 text-sm">
          Aplicativo Android de leitura offline com biblioteca pessoal e integração com catálogos online
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatusCard
          title="Fase Atual"
          value="0 — Análise"
          subtitle="Concluída ✓"
          color="success"
          icon="📋"
        />
        <StatusCard
          title="Próxima Fase"
          value="1 — Fundação"
          subtitle="Aguardando aprovação"
          color="violet"
          icon="🏗️"
        />
        <StatusCard
          title="Plataforma"
          value="Android"
          subtitle="Flutter + Dart"
          color="info"
          icon="📱"
        />
        <StatusCard
          title="Visual"
          value="Dark Premium"
          subtitle="Grafite + Violeta"
          color="warning"
          icon="🎨"
        />
      </div>

      {/* Key Decisions */}
      <div className="glass-card rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-graphite-100 mb-4 flex items-center gap-2">
          <span>🎯</span> Decisões Técnicas Definidas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <DecisionItem label="Framework" value="Flutter" />
          <DecisionItem label="Linguagem" value="Dart" />
          <DecisionItem label="Banco de Dados" value="SQLite + Drift" />
          <DecisionItem label="Estado" value="Riverpod" />
          <DecisionItem label="Navegação" value="GoRouter" />
          <DecisionItem label="HTTP" value="Dio" />
          <DecisionItem label="Downloads" value="WorkManager" />
          <DecisionItem label="Armazenamento" value="Diretório privado" />
          <DecisionItem label="Formatos" value="CBZ, ZIP, PDF" />
        </div>
      </div>

      {/* Two Paths */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="glass-card rounded-xl p-6 glass-card-hover transition-all">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-violet-accent/10 flex items-center justify-center">
              <span className="text-xl">📂</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-graphite-100">Biblioteca Local</h3>
              <p className="text-xs text-graphite-400">Importação de arquivos</p>
            </div>
          </div>
          <ul className="space-y-2">
            <ListItem text="Importar CBZ, ZIP, PDF e pastas" />
            <ListItem text="Validação e extração segura" />
            <ListItem text="Identificação e ordenação de páginas" />
            <ListItem text="Importação automática de capas" />
            <ListItem text="Cadastro na biblioteca" />
            <ListItem text="Funcionamento 100% offline" />
          </ul>
        </div>

        <div className="glass-card rounded-xl p-6 glass-card-hover transition-all">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-violet-accent/10 flex items-center justify-center">
              <span className="text-xl">🌐</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-graphite-100">Catálogos Online</h3>
              <p className="text-xs text-graphite-400">Fontes autorizadas</p>
            </div>
          </div>
          <ul className="space-y-2">
            <ListItem text="Provedores de conteúdo independentes" />
            <ListItem text="Catálogo JSON próprio" />
            <ListItem text="Busca e descoberta de obras" />
            <ListItem text="Download para leitura offline" />
            <ListItem text="Atualizações automáticas" />
            <ListItem text="Preparado para APIs oficiais" />
          </ul>
        </div>
      </div>

      {/* Critical Tests */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-lg font-semibold text-graphite-100 mb-4 flex items-center gap-2">
          <span>🔬</span> Critérios de Aprovação Obrigatórios
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CriticalTest
            title="Leitura Offline Real"
            description="Modo avião → continuar lendo capítulos baixados, inclusive após fechar e abrir o app"
            icon="✈️"
          />
          <CriticalTest
            title="Downloads Confiáveis"
            description="Interromper download → fechar app → retomar sem corromper arquivo"
            icon="📥"
          />
          <CriticalTest
            title="Persistência Real"
            description="Reiniciar aparelho → biblioteca, favoritos, progresso e configurações preservados"
            icon="💾"
          />
        </div>
      </div>
    </div>
  );
}

function StatusCard({ title, value, subtitle, color, icon }: {
  title: string; value: string; subtitle: string; color: string; icon: string;
}) {
  const colorClasses: Record<string, string> = {
    success: 'border-success/30 bg-success/5',
    violet: 'border-violet-accent/30 bg-violet-accent/5',
    info: 'border-info/30 bg-info/5',
    warning: 'border-warning/30 bg-warning/5',
  };

  return (
    <div className={`glass-card rounded-xl p-4 border ${colorClasses[color]} glass-card-hover transition-all`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-graphite-400 font-medium">{title}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <p className="text-lg font-bold text-graphite-100">{value}</p>
      <p className="text-xs text-graphite-400 mt-1">{subtitle}</p>
    </div>
  );
}

function DecisionItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between bg-graphite-800/40 rounded-lg px-3 py-2">
      <span className="text-xs text-graphite-400">{label}</span>
      <span className="text-xs font-medium text-violet-light">{value}</span>
    </div>
  );
}

function ListItem({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2 text-sm text-graphite-300">
      <span className="w-1.5 h-1.5 rounded-full bg-violet-accent/60 flex-shrink-0"></span>
      {text}
    </li>
  );
}

function CriticalTest({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className="bg-graphite-800/40 rounded-lg p-4 border border-graphite-700/30">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <h4 className="text-sm font-semibold text-graphite-100">{title}</h4>
      </div>
      <p className="text-xs text-graphite-400 leading-relaxed">{description}</p>
    </div>
  );
}
