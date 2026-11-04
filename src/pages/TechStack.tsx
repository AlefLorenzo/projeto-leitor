export default function TechStack() {
  return (
    <div className="slide-up">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-graphite-100 mb-2">
          Tech <span className="gradient-text">Stack</span>
        </h1>
        <p className="text-graphite-300 text-sm">
          Tecnologias e dependências do projeto Manga Offline
        </p>
      </div>

      {/* Main Technologies */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <TechCard
          name="Flutter"
          version="3.x (stable)"
          description="Framework principal para desenvolvimento Android"
          icon="🦋"
          category="Framework"
        />
        <TechCard
          name="Dart"
          version="3.x"
          description="Linguagem de programação principal"
          icon="🎯"
          category="Linguagem"
        />
        <TechCard
          name="SQLite + Drift"
          version="Latest"
          description="Banco de dados local com type-safety"
          icon="🗄️"
          category="Database"
        />
        <TechCard
          name="Riverpod"
          version="2.x"
          description="Gerenciamento de estado reativo"
          icon="🌊"
          category="State"
        />
        <TechCard
          name="GoRouter"
          version="Latest"
          description="Navegação declarativa entre telas"
          icon="🧭"
          category="Navigation"
        />
        <TechCard
          name="Dio"
          version="5.x"
          description="Cliente HTTP para requisições de rede"
          icon="🌐"
          category="HTTP"
        />
      </div>

      {/* Platform & Tools */}
      <div className="glass-card rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-graphite-100 mb-4 flex items-center gap-2">
          <span>🛠️</span> Ferramentas e Plataformas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <ToolRow name="Android SDK" desc="API Level 21+ (Android 5.0+)" icon="🤖" />
            <ToolRow name="WorkManager" desc="Tarefas em background e atualizações" icon="⚙️" />
            <ToolRow name="Notificações Locais" desc="Alertas de novos capítulos" icon="🔔" />
            <ToolRow name="GitHub Pages" desc="Hospedagem de catálogos JSON" icon="📄" />
          </div>
          <div className="space-y-3">
            <ToolRow name="GitHub Releases" desc="Distribuição de conteúdo autorizado" icon="📦" />
            <ToolRow name="SHA-256" desc="Validação de integridade de downloads" icon="🔐" />
            <ToolRow name="Arquivo Privado" desc="Armazenamento seguro no dispositivo" icon="🔒" />
            <ToolRow name="Material Design 3" desc="Base visual dos componentes" icon="🎨" />
          </div>
        </div>
      </div>

      {/* Database Schema */}
      <div className="glass-card rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-graphite-100 mb-4 flex items-center gap-2">
          <span>🗄️</span> Esquema do Banco de Dados
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <TableCard
            name="Obras"
            fields={['id (PK)', 'titulo', 'autor', 'sinopse', 'capa_url', 'tipo', 'status', 'direcao_leitura']}
          />
          <TableCard
            name="Capítulos"
            fields={['id (PK)', 'obra_id (FK)', 'numero', 'titulo', 'data_publicacao', 'arquivo_local']}
          />
          <TableCard
            name="Downloads"
            fields={['id (PK)', 'capitulo_id (FK)', 'status', 'progresso', 'caminho_arquivo', 'hash_sha256', 'tamanho']}
          />
          <TableCard
            name="Progresso"
            fields={['id (PK)', 'capitulo_id (FK)', 'pagina_atual', 'ultima_pagina', 'concluido', 'data_atualizacao']}
          />
          <TableCard
            name="Favoritos"
            fields={['id (PK)', 'obra_id (FK)', 'data_adicao', 'ordem']}
          />
          <TableCard
            name="Configurações"
            fields={['id (PK)', 'chave', 'valor', 'tipo', 'categoria']}
          />
        </div>
      </div>

      {/* Security */}
      <div className="glass-card rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-graphite-100 mb-4 flex items-center gap-2">
          <span>🔐</span> Segurança e Integridade
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SecurityItem
            title="Validação de Arquivos"
            items={['Verificação de formato', 'Detecção de corrupção', 'Limite de tamanho', 'Path traversal prevention']}
          />
          <SecurityItem
            title="Downloads Seguros"
            items={['Validação SHA-256', 'HTTPS obrigatório', 'Controle de duplicidade', 'Retomada verificada']}
          />
          <SecurityItem
            title="Dados Locais"
            items={['Diretório privado do app', 'Sem credenciais no código', 'Proteção contra acesso externo', 'Backup de configurações']}
          />
          <SecurityItem
            title="Conteúdo Autorizado"
            items={['Apenas fontes autorizadas', 'Sem raspagem indevida', 'Sem bypass de proteções', 'Respeito a direitos autorais']}
          />
        </div>
      </div>

      {/* Performance */}
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-lg font-semibold text-graphite-100 mb-4 flex items-center gap-2">
          <span>⚡</span> Estratégia de Performance
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <PerfCard icon="🖼️" title="Imagens" desc="Carregamento progressivo com cache inteligente" />
          <PerfCard icon="🧠" title="Memória" desc="Liberação automática de recursos não utilizados" />
          <PerfCard icon="📋" title="Listas" desc="Paginação e lazy loading para grandes volumes" />
          <PerfCard icon="🔄" title="Downloads" desc="Controle de simultaneidade e priorização" />
        </div>
      </div>
    </div>
  );
}

function TechCard({ name, version, description, icon, category }: {
  name: string; version: string; description: string; icon: string; category: string;
}) {
  return (
    <div className="glass-card rounded-xl p-5 glass-card-hover transition-all">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-violet-accent/10 flex items-center justify-center flex-shrink-0">
          <span className="text-xl">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-graphite-100">{name}</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-graphite-700/50 text-graphite-400">{category}</span>
          </div>
          <p className="text-xs text-violet-light font-mono mb-1">{version}</p>
          <p className="text-xs text-graphite-400">{description}</p>
        </div>
      </div>
    </div>
  );
}

function ToolRow({ name, desc, icon }: { name: string; desc: string; icon: string }) {
  return (
    <div className="flex items-center gap-3 bg-graphite-800/30 rounded-lg px-3 py-2.5">
      <span className="text-lg">{icon}</span>
      <div>
        <p className="text-xs font-medium text-graphite-200">{name}</p>
        <p className="text-[10px] text-graphite-500">{desc}</p>
      </div>
    </div>
  );
}

function TableCard({ name, fields }: { name: string; fields: string[] }) {
  return (
    <div className="bg-graphite-800/40 rounded-lg p-3 border border-graphite-700/20">
      <h4 className="text-xs font-semibold text-violet-light mb-2 flex items-center gap-1">
        <span className="text-graphite-500">📋</span> {name}
      </h4>
      <div className="space-y-1">
        {fields.map((field, i) => (
          <p key={i} className="text-[10px] text-graphite-400 font-mono">{field}</p>
        ))}
      </div>
    </div>
  );
}

function SecurityItem({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-graphite-800/30 rounded-lg p-4">
      <h4 className="text-xs font-semibold text-graphite-200 mb-2">{title}</h4>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-xs text-graphite-400">
            <span className="w-1 h-1 rounded-full bg-success/60"></span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PerfCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-graphite-800/30 rounded-lg p-3 text-center">
      <span className="text-xl mb-1 block">{icon}</span>
      <p className="text-xs font-medium text-graphite-200 mb-0.5">{title}</p>
      <p className="text-[10px] text-graphite-500">{desc}</p>
    </div>
  );
}
