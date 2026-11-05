import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import dotenv from 'dotenv';
import {
  loadBunkerCatalog,
  loadBunkerState,
  saveBunkerState,
  downloadWorkChapters,
  publishProgress,
  parseDownloadSelection,
} from './bunker-service.js';

dotenv.config();

const API_ID = parseInt(process.env.TELEGRAM_API_ID || '0');
const API_HASH = process.env.TELEGRAM_API_HASH || '';
const SESSION = process.env.TELEGRAM_SESSION || '';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  🌊 BUNKER MANGÁS — EXTRATOR AUTOMATIZADO                ║');
  console.log('║  Download com seleção de quantidade e anti-duplicidade   ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Argumentos de linha de comando: ex: node bunker-extractor.js 5 ou --limit 10 ou 1-10
  const args = process.argv.slice(2).join(' ');

  console.log('🔌 Conectando ao Telegram...');
  const client = new TelegramClient(new StringSession(SESSION), API_ID, API_HASH, {
    connectionRetries: 20,
    retryDelay: 3000,
    autoReconnect: true,
  });

  await client.connect();
  console.log('✅ Conectado com sucesso!\n');

  // Carregar obras do catálogo do Bunker
  console.log('📖 Carregando catálogo do Bunker Mangás...');
  const works = await loadBunkerCatalog(client);
  console.log(`✅ ${works.length} obras mapeadas no total.\n`);

  let targetWorks = [];

  // Se passou argumento na linha de comando
  if (args.trim()) {
    const parseRes = parseDownloadSelection(args, works);
    if (parseRes.selectedWorks && parseRes.selectedWorks.length > 0) {
      targetWorks = parseRes.selectedWorks;
      console.log(`🎯 Modo selecionado via comando: ${parseRes.summary}`);
    }
  }

  // Se não passou argumento, verificar se há fila em bunker-state.json
  if (targetWorks.length === 0) {
    const state = loadBunkerState();
    if (Array.isArray(state.queue) && state.queue.length > 0) {
      targetWorks = state.queue;
      console.log(`📋 Retomando ${targetWorks.length} obras da fila pendente salva.`);
    } else {
      // Padrão: todas as obras pendentes
      targetWorks = works.filter((w) => !w.isCompleted);
      console.log(`📚 Modo padrão: ${targetWorks.length} obras pendentes restantes.`);
    }
  }

  console.log(`\n🚀 Iniciando processamento de ${targetWorks.length} obra(s)...\n`);

  let totalNewCaps = 0;
  for (let i = 0; i < targetWorks.length; i++) {
    const work = targetWorks[i];
    console.log(`\n════════════════════════════════════════════════════════════`);
    console.log(`[${i + 1}/${targetWorks.length}] 📖 ${work.title}`);
    console.log(`🔗 Canal: ${work.link}`);
    console.log(`════════════════════════════════════════════════════════════`);

    const res = await downloadWorkChapters(client, work, async (event) => {
      // Callback de capítulo
    });

    if (res.success) {
      totalNewCaps += res.downloaded;
      console.log(`\n✅ Obra finalizada: ${res.downloaded} novos capítulos baixados (Total: ${res.total})`);
    } else {
      console.log(`\n⚠️ Não foi possível processar obra: ${res.reason}`);
    }
  }

  await publishProgress({
    status: 'concluido',
    totalNewChapters: totalNewCaps,
    message: `Extração concluída! ${totalNewCaps} novos capítulos baixados.`,
  });

  console.log('\n🎉 Processo concluído com sucesso!');
  await client.disconnect();
}

main().catch((err) => {
  console.error('\n❌ Erro fatal:', err.message || err);
  process.exit(1);
});
