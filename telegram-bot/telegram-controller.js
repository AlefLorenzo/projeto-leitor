import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  loadBunkerCatalog,
  loadBunkerState,
  saveBunkerState,
  inspectWorkChapters,
  parseDownloadSelection,
  getLocalLibrarySummary,
  getCurrentProgress,
  DownloadQueueManager,
} from './bunker-service.js';
import { mergeLibraryDuplicates, cleanCatalogDuplicates } from './deduplicator.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_ID = parseInt(process.env.TELEGRAM_API_ID || '0');
const API_HASH = process.env.TELEGRAM_API_HASH || '';
const SESSION = process.env.TELEGRAM_SESSION || '';

const LIBRARY_DIR = path.join(__dirname, '..', 'library');
const CATALOG_DIR = path.join(__dirname, '..', 'public', 'catalog');

function renderProgressBar(percent, length = 16) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const filled = Math.round((p / 100) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

// Formatar Menu Principal
function formatMenuText() {
  return (
    `📖 *Manga Offline — Painel de Controle no Telegram*\n\n` +
    `Escolha quantas obras baixar e acompanhe os capítulos em tempo real:\n\n` +
    `🔍 */obras [página]* — Ver catálogo de obras e quantidade de capítulos\n` +
    `⬇️ */baixar [quantidade | intervalo | #]* — Baixar obras (ex: \`/baixar 5\`, \`/baixar 1-10\`, \`/baixar todas\`)\n` +
    `📦 */fila* — Ver obras que estão na fila de download\n` +
    `🛑 */parar* — Cancelar/pausar a fila de download atual\n` +
    `📊 */status* — Ver progresso atual do download em tempo real\n` +
    `📚 */biblioteca* — Ver obras e capítulos já baixados no PC\n` +
    `ℹ️ */info [número]* — Inspecionar e contar capítulos de uma obra\n` +
    `🛡️ */duplicidades* — Verificar e eliminar duplicidades\n` +
    `❓ */ajuda* — Exibir esta lista de comandos\n\n` +
    `💡 *Exemplos rápidos de download:*\n` +
    `• \`/baixar 5\` — Baixa as próximas 5 obras pendentes\n` +
    `• \`/baixar 10\` — Baixa as próximas 10 obras pendentes\n` +
    `• \`/baixar 1-10\` — Baixa do nº 1 ao nº 10\n` +
    `• \`/baixar todas\` — Baixa todas as obras do catálogo\n` +
    `• \`/baixar #3\` — Baixa apenas a obra #3\n` +
    `• \`/baixar solo leveling\` — Baixa buscando pelo nome`
  );
}

// Formatar Mensagem de Status
function formatStatusMessage(queueManager) {
  const cur = getCurrentProgress();
  const lib = getLocalLibrarySummary();
  const queueStatus = queueManager ? queueManager.getStatus() : { isRunning: false, queueLength: 0, activeWork: null };

  let msg = `⚡ *STATUS DO EXTRATOR MANGA OFFLINE*\n\n`;

  if (queueStatus.isRunning && queueStatus.activeWork) {
    msg += `📖 *Obra em Download:* \`${queueStatus.activeWork.title}\`\n`;
    if (queueStatus.queueLength > 0) {
      msg += `📦 *Obras Restantes na Fila:* *${queueStatus.queueLength}* obras\n`;
    }
  }

  if (cur && cur.status === 'baixando') {
    const bar = renderProgressBar(cur.chapterProgress || 0, 16);
    msg += `📑 *Capítulo:* \`${cur.chapter || '-'}\` (${cur.progress || '-'})\n`;
    msg += `⬇️ *Progresso:* [${bar}] *${cur.chapterProgress || 0}%*\n`;
    msg += `💾 *Tamanho:* ${cur.downloadedMb || 0} MB / ${cur.totalMb || 0} MB\n`;
    msg += `📊 *Obra Concluída:* ${cur.mangaPercent || 0}%\n\n`;
  } else if (queueStatus.isRunning) {
    msg += `⏳ *Status:* Processando conexão e iniciando capítulos...\n\n`;
  } else {
    msg += `💤 *Status:* Aguardando comandos ou finalizado.\n\n`;
  }

  msg += `📚 *Biblioteca Local:* \n`;
  msg += `• *${lib.worksCount}* obras com *${lib.totalChapters}* capítulos prontos.\n\n`;

  if (lib.items.length > 0) {
    msg += `*Top Obras no seu PC:*\n`;
    for (const item of lib.items.slice(0, 5)) {
      msg += `  ✅ \`${item.name}\`: *${item.chapters}* caps\n`;
    }
  }

  return msg;
}

// Formatar Fila de Downloads
function formatQueueMessage(queueManager) {
  const status = queueManager.getStatus();

  let msg = `📦 *FILA DE DOWNLOADS MANGA OFFLINE*\n\n`;

  if (!status.isRunning && status.queueLength === 0) {
    msg += `📭 Nenhuma obra na fila no momento.\n\n`;
    msg += `👉 Digite */obras* para ver o catálogo.\n`;
    msg += `👉 Digite \`/baixar 5\` para enfileirar as próximas 5 obras!\n`;
    return msg;
  }

  if (status.activeWork) {
    const caps = status.activeWork.totalChapters ? ` (*${status.activeWork.totalChapters}* caps)` : '';
    msg += `▶️ *Obra Ativa (Baixando agora):*\n`;
    msg += `• \`${status.activeWork.title}\`${caps}\n\n`;
  }

  if (status.queueLength > 0) {
    msg += `⏳ *Próximas Obras na Fila (${status.queueLength} restantes):*\n`;
    const preview = status.queue.slice(0, 10);
    preview.forEach((w, i) => {
      const caps = w.totalChapters ? ` — *${w.totalChapters}* caps` : '';
      msg += `  ${i + 1}. *${w.title}*${caps}\n`;
    });
    if (status.queueLength > 10) {
      msg += `  _... e mais ${status.queueLength - 10} obra(s)_\n`;
    }
    msg += `\n`;
  }

  msg += `────────────────────────────\n`;
  msg += `👉 Digite */status* para ver o progresso do capítulo\n`;
  msg += `👉 Digite */parar* para cancelar a fila`;

  return msg;
}

// Formatar Catálogo de Obras Paginado
async function formatWorksList(client, page = 1) {
  const works = await loadBunkerCatalog(client);
  const pageSize = 12;
  const totalPages = Math.ceil(works.length / pageSize) || 1;
  const p = Math.max(1, Math.min(totalPages, parseInt(page) || 1));
  const start = (p - 1) * pageSize;
  const end = start + pageSize;
  const slice = works.slice(start, end);

  const completedCount = works.filter((w) => w.isCompleted).length;
  const withDlCount = works.filter((w) => w.downloadedChapters > 0).length;

  let msg = `📚 *CATÁLOGO BUNKER MANGÁS* (Página ${p}/${totalPages})\n`;
  msg += `Total: *${works.length}* obras mapeadas | *${withDlCount}* na biblioteca | *${completedCount}* concluídas\n\n`;

  slice.forEach((w) => {
    let capStatus = '';
    if (w.isCompleted) {
      const total = w.totalChapters || w.downloadedChapters;
      capStatus = `— *${total}* caps (✅ Baixado completo)`;
    } else if (w.totalChapters && w.downloadedChapters > 0) {
      capStatus = `— *${w.totalChapters}* caps (📥 ${w.downloadedChapters} baixados)`;
    } else if (w.totalChapters) {
      capStatus = `— *${w.totalChapters}* caps (⬇️ Pendente)`;
    } else if (w.downloadedChapters > 0) {
      capStatus = `— *${w.downloadedChapters}* caps baixados (📥 Parcial)`;
    } else {
      capStatus = `— (⬇️ Pronto para baixar)`;
    }

    msg += `*${w.index}.* ${w.title} ${capStatus}\n`;
  });

  msg += `\n────────────────────────────\n`;
  msg += `📥 *Escolha quantas obras quer baixar:*\n`;
  msg += `• \`/baixar 5\` — Baixa as próximas 5 obras pendentes\n`;
  msg += `• \`/baixar 10\` — Baixa as próximas 10 obras pendentes\n`;
  msg += `• \`/baixar 1-10\` — Baixa do nº 1 ao nº 10\n`;
  msg += `• \`/baixar todas\` — Baixa todas as obras pendentes\n`;
  msg += `• \`/baixar #${slice[0]?.index || 1}\` — Baixa somente a obra #${slice[0]?.index || 1}\n`;
  if (p < totalPages) {
    msg += `👉 Digite */obras ${p + 1}* para ver a próxima página\n`;
  }

  return msg;
}

// Formatar Biblioteca Local
function formatLibraryMessage() {
  const lib = getLocalLibrarySummary();
  let msg = `📚 *BIBLIOTECA LOCAL — OBRAS BAIXADAS*\n\n`;
  msg += `Total de obras com capítulos: *${lib.worksCount}*\n`;
  msg += `Total de capítulos prontos: *${lib.totalChapters}*\n\n`;

  if (lib.items.length === 0) {
    msg += `📭 Nenhum capítulo baixado ainda. Use */obras* para escolher quantas baixar!`;
    return msg;
  }

  for (const item of lib.items) {
    msg += `✅ *${item.name}*: \`${item.chapters}\` capítulos prontos\n`;
  }

  return msg;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  🤖 MANGA OFFLINE — TELEGRAM CHAT CONTROLLER             ║');
  console.log('║  Controle e acompanhamento direto na conversa            ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const client = new TelegramClient(new StringSession(SESSION), API_ID, API_HASH, {
    connectionRetries: 20,
    retryDelay: 3000,
    autoReconnect: true,
  });

  await client.connect();
  const me = await client.getMe();
  console.log(`✅ Conectado como ${me.firstName} (ID: ${me.id})`);

  // Carregar catálogo de obras na inicialização
  console.log('📖 Indexando obras do Bunker Mangás...');
  const initialWorks = await loadBunkerCatalog(client);
  console.log(`✅ ${initialWorks.length} obras mapeadas com sucesso!\n`);

  // Gerenciador de fila de downloads
  const queueManager = new DownloadQueueManager(client, async (text) => {
    try {
      await client.sendMessage('me', { message: text, parseMode: 'md' });
    } catch (err) {
      console.error('Aviso ao enviar notificação para Mensagens Salvas:', err.message);
    }
  });

  // Restaurar fila anterior se houver
  queueManager.restoreQueue();

  // Enviar mensagem de inicialização nas Mensagens Salvas
  const welcomeText =
    `🚀 *Manga Offline — Assistente Ativo!*\n\n` +
    `O bot de controle agora permite escolher quantas obras baixar e ver a quantidade de capítulos de cada uma!\n\n` +
    formatMenuText();

  try {
    await client.sendMessage('me', { message: welcomeText, parseMode: 'md' });
    console.log('📢 Mensagem de boas-vindas enviada para Mensagens Salvas!');
  } catch (err) {
    console.error('Aviso ao enviar boas-vindas:', err.message);
  }

  let lastHandledMsgId = 0;

  // Função central para processar comandos do usuário
  async function handleUserCommand(text, msgId) {
    if (msgId && msgId <= lastHandledMsgId) return;
    if (msgId) lastHandledMsgId = Math.max(lastHandledMsgId, msgId);

    const cleanText = text.trim();
    const lower = cleanText.toLowerCase();

    // Ignorar respostas do próprio bot
    if (
      cleanText.startsWith('📚 *CATÁLOGO') ||
      cleanText.startsWith('⚡ *STATUS') ||
      cleanText.startsWith('🚀 *Manga') ||
      cleanText.startsWith('📦 *FILA') ||
      cleanText.startsWith('📖 *Manga') ||
      cleanText.startsWith('🛑 *Fila') ||
      cleanText.startsWith('⏳ Carregando') ||
      cleanText.startsWith('🔍 *Inspecionando')
    ) {
      return;
    }

    // /start ou /menu ou /ajuda
    if (
      lower === '/start' ||
      lower === '/menu' ||
      lower === '/ajuda' ||
      lower === 'ajuda' ||
      lower === 'menu'
    ) {
      await client.sendMessage('me', { message: formatMenuText(), parseMode: 'md' });
      return;
    }

    // /status
    if (lower.startsWith('/status') || lower === 'status') {
      await client.sendMessage('me', { message: formatStatusMessage(queueManager), parseMode: 'md' });
      return;
    }

    // /fila
    if (lower.startsWith('/fila') || lower === 'fila') {
      await client.sendMessage('me', { message: formatQueueMessage(queueManager), parseMode: 'md' });
      return;
    }

    // /parar ou /cancelar ou /pause
    if (lower.startsWith('/parar') || lower.startsWith('/cancelar') || lower === 'parar') {
      const removed = queueManager.stopQueue();
      await client.sendMessage('me', {
        message:
          `🛑 *Fila de Downloads Interrompida!*\n\n` +
          `• *${removed}* obras pendentes foram removidas da fila.\n` +
          `O capítulo atualmente em transferência será finalizado com segurança.\n\n` +
          `Digite */obras* para escolher novas obras quando quiser!`,
        parseMode: 'md',
      });
      return;
    }

    // /biblioteca
    if (lower.startsWith('/biblioteca') || lower === 'biblioteca') {
      await client.sendMessage('me', { message: formatLibraryMessage(), parseMode: 'md' });
      return;
    }

    // /obras [página] ou /catalogo [página]
    if (lower.startsWith('/obras') || lower.startsWith('/catalogo') || lower === 'obras' || lower === 'catalogo') {
      const parts = cleanText.split(' ');
      const page = parts.length > 1 ? parseInt(parts[1]) || 1 : 1;
      await client.sendMessage('me', { message: '⏳ Carregando catálogo e capítulos...', parseMode: 'md' });
      const listText = await formatWorksList(client, page);
      await client.sendMessage('me', { message: listText, parseMode: 'md' });
      return;
    }

    // /info [número ou nome]
    if (lower.startsWith('/info') || lower.startsWith('/capitulos') || lower.startsWith('/inspecionar')) {
      const query = cleanText.replace(/^\/(?:info|capitulos|inspecionar)\s*/i, '').trim();
      if (!query) {
        await client.sendMessage('me', {
          message: `⚠️ *Como usar:* Digite \`/info [número da obra]\` (ex: \`/info 3\`).`,
          parseMode: 'md',
        });
        return;
      }

      const works = await loadBunkerCatalog(client);
      const parseResult = parseDownloadSelection(query, works);
      const target = parseResult.selectedWorks?.[0];

      if (!target) {
        await client.sendMessage('me', {
          message: `❌ Nenhuma obra encontrada com "${query}". Digite */obras* para listar.`,
          parseMode: 'md',
        });
        return;
      }

      await client.sendMessage('me', {
        message: `🔍 *Inspecionando capítulos de:* \`${target.title}\`...\nAguarde alguns segundos.`,
        parseMode: 'md',
      });

      const count = await inspectWorkChapters(client, target);
      const downloaded = target.downloadedChapters || 0;

      await client.sendMessage('me', {
        message:
          `📖 *Detalhes da Obra:*\n\n` +
          `• *Título:* ${target.title}\n` +
          `• *Capítulos Encontrados:* *${count || target.totalChapters || 'Desconhecido'}*\n` +
          `• *Capítulos Baixados no PC:* *${downloaded}*\n` +
          `• *Status:* ${downloaded >= (count || 0) && count > 0 ? '✅ Completo' : '⬇️ Pronto para baixar'}\n` +
          `• *Link do Canal:* ${target.link}\n\n` +
          `👉 Digite \`/baixar #${target.index}\` para baixar esta obra!`,
        parseMode: 'md',
      });
      return;
    }

    // /baixar [quantidade | intervalo | obra | todas]
    if (lower.startsWith('/baixar') || lower.startsWith('baixar')) {
      const query = cleanText.replace(/^\/?baixar\s*/i, '').trim();
      if (!query) {
        await client.sendMessage('me', {
          message:
            `⚠️ *Como usar o /baixar:*\n\n` +
            `Você pode escolher quantas obras quiser baixar:\n\n` +
            `• \`/baixar 5\` — Baixa as próximas 5 obras pendentes\n` +
            `• \`/baixar 10\` — Baixa as próximas 10 obras pendentes\n` +
            `• \`/baixar 1-10\` — Baixa do nº 1 ao nº 10 da lista\n` +
            `• \`/baixar todas\` — Baixa todas as obras pendentes\n` +
            `• \`/baixar #3\` — Baixa apenas a obra #3\n` +
            `• \`/baixar solo leveling\` — Baixa buscando pelo nome\n\n` +
            `Digite */obras* para ver a lista de obras e seus números!`,
          parseMode: 'md',
        });
        return;
      }

      const works = await loadBunkerCatalog(client);
      const result = parseDownloadSelection(query, works);

      if (result.error || !result.selectedWorks || result.selectedWorks.length === 0) {
        await client.sendMessage('me', {
          message: `❌ Nenhuma obra correspondente encontrada para "${query}". Digite */obras* para ver os números.`,
          parseMode: 'md',
        });
        return;
      }

      const added = queueManager.enqueue(result.selectedWorks);

      let response = `📥 *Obras Adicionadas à Fila de Download!*\n\n`;
      response += `📋 *Seleção:* ${result.summary}\n`;
      response += `➕ *${added.length}* nova(s) obra(s) adicionada(s) à fila.\n\n`;

      response += `*Lista de Obras Selecionadas:*\n`;
      result.selectedWorks.slice(0, 8).forEach((w, i) => {
        const capText = w.totalChapters ? ` (*${w.totalChapters}* caps)` : '';
        const dlText = w.downloadedChapters > 0 ? ` [${w.downloadedChapters} prontos]` : '';
        response += `  ${i + 1}. *#${w.index}* ${w.title}${capText}${dlText}\n`;
      });

      if (result.selectedWorks.length > 8) {
        response += `  _... e mais ${result.selectedWorks.length - 8} obra(s)_\n`;
      }

      if (result.mode === 'quantity' && result.targetSingleWork) {
        response += `\n💡 _Dica: Para baixar somente a obra #${result.targetSingleWork.index}, use: \`/baixar #${result.targetSingleWork.index}\`_\n`;
      }

      response += `\n⚡ *Download iniciado em segundo plano!*\n`;
      response += `👉 Digite */status* para acompanhar o progresso em tempo real\n`;
      response += `👉 Digite */fila* para gerenciar a fila`;

      await client.sendMessage('me', { message: response, parseMode: 'md' });
      return;
    }

    // /duplicidades ou /limpar_duplicatas
    if (lower.startsWith('/duplicidades') || lower.startsWith('/limpar_duplicatas')) {
      await client.sendMessage('me', {
        message: `🛡️ *Verificando e eliminando duplicidades na biblioteca e catálogo...*`,
        parseMode: 'md',
      });
      const catalogPath = path.join(CATALOG_DIR, 'catalog.json');
      const resLib = mergeLibraryDuplicates(LIBRARY_DIR, true);
      const resCat = cleanCatalogDuplicates(catalogPath, true);
      await client.sendMessage('me', {
        message:
          `✅ *Verificação de Duplicidades Concluída!*\n\n` +
          `📂 *Pastas e Capítulos Mesclados:* ${resLib.merged} capítulos consolidados\n` +
          `🗑️ *Pastas Redundantes Removidas:* ${resLib.removed}\n` +
          `📚 *Entradas Duplicadas no Catálogo Resolvidas:* ${resCat.duplicatesRemoved}\n\n` +
          `Todas as obras e conteúdos estão 100% organizados sem nenhuma repetição!`,
        parseMode: 'md',
      });
      return;
    }
  }

  // 1. Escuta via Event Handler
  client.addEventHandler(async (event) => {
    try {
      const msg = event.message;
      if (!msg || !msg.message) return;
      await handleUserCommand(msg.message, msg.id);
    } catch (err) {
      console.error('Erro no handler de eventos:', err.message);
    }
  }, new NewMessage({ incoming: true, outgoing: true }));

  // 2. Polling de fallback a cada 2.5s nas Mensagens Salvas (garante detecção perfeita)
  setInterval(async () => {
    try {
      const msgs = await client.getMessages('me', { limit: 2 });
      if (msgs && msgs.length > 0) {
        for (const m of msgs) {
          if (m && m.id > lastHandledMsgId && m.message) {
            const t = m.message.trim();
            if (t.startsWith('/') || ['status', 'fila', 'obras', 'biblioteca', 'ajuda', 'menu', 'parar'].includes(t.toLowerCase())) {
              await handleUserCommand(t, m.id);
            }
          }
        }
      }
    } catch {}
  }, 2500);

  console.log('👂 Escutando comandos nas Mensagens Salvas do Telegram...');

  // 3. Scanner leve em background: mapeia e conta capítulos das obras progressivamente
  setTimeout(async () => {
    try {
      const works = await loadBunkerCatalog(client);
      const toScan = works.filter((w) => w.totalChapters === null);
      console.log(`🔍 Scanner em background: ${toScan.length} obras para mapear capítulos.`);

      for (const w of toScan) {
        // Se a fila estiver baixando no momento, aguarda para não dividir banda
        while (queueManager.isRunning) {
          await new Promise((r) => setTimeout(r, 8000));
        }

        try {
          const count = await inspectWorkChapters(client, w);
          if (count > 0) {
            console.log(`  ✓ [Scanner] ${w.title}: ${count} capítulos mapeados.`);
          }
        } catch (scanErr) {
          if (scanErr.message?.includes('FLOOD_WAIT_')) {
            const sec = parseInt(scanErr.message.replace(/\D/g, '')) || 30;
            console.log(`  ⏳ Scanner pausado por flood wait: ${sec}s`);
            await new Promise((r) => setTimeout(r, (sec + 5) * 1000));
          }
        }

        // Intervalo seguro de 4.5 segundos entre canais
        await new Promise((r) => setTimeout(r, 4500));
      }
      console.log('✅ Scanner em background finalizado! Todas as obras têm capítulos mapeados.');
    } catch (err) {
      console.log('Aviso no scanner em background:', err.message);
    }
  }, 5000);
}

main().catch((err) => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
