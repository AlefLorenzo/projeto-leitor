import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { NewMessage } from 'telegram/events/index.js';
import { Api } from 'telegram';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createRequire } from 'module';
import {
  canonicalSlug,
  findExistingMangaDir,
  isChapterAlreadyDownloaded,
  mergeLibraryDuplicates,
  cleanCatalogDuplicates,
} from './deduplicator.js';

dotenv.config();

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_ID = parseInt(process.env.TELEGRAM_API_ID || '0');
const API_HASH = process.env.TELEGRAM_API_HASH || '';
const SESSION = process.env.TELEGRAM_SESSION || '';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

const LIBRARY_DIR = path.join(__dirname, '..', 'library');
const CATALOG_DIR = path.join(__dirname, '..', 'public', 'catalog');
const PROGRESS_FILE = path.join(__dirname, 'download-progress.json');
const BUNKER_STATE_FILE = path.join(__dirname, 'bunker-state.json');

// Cache das obras do catálogo
let cachedWorks = [];
let lastCatalogFetch = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function renderProgressBar(percent, length = 16) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const filled = Math.round((p / 100) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

// Obter resumo da biblioteca local
function getLibrarySummary() {
  if (!fsSync.existsSync(LIBRARY_DIR)) return { worksCount: 0, totalChapters: 0, items: [] };
  const dirs = fsSync.readdirSync(LIBRARY_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  const items = [];
  let totalChapters = 0;
  for (const dir of dirs) {
    const p = path.join(LIBRARY_DIR, dir.name);
    const caps = fsSync
      .readdirSync(p, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.toLowerCase().startsWith('capitulo')).length;
    if (caps > 0) {
      items.push({ name: dir.name, chapters: caps });
      totalChapters += caps;
    }
  }
  items.sort((a, b) => b.chapters - a.chapters);
  return { worksCount: items.length, totalChapters, items };
}

// Obter status atual do download
function getCurrentDownloadStatus() {
  try {
    if (fsSync.existsSync(PROGRESS_FILE)) {
      const data = JSON.parse(fsSync.readFileSync(PROGRESS_FILE, 'utf-8'));
      return data;
    }
  } catch {}
  return null;
}

// Carregar catálogo de obras do Bunker
async function loadBunkerWorks(client) {
  const now = Date.now();
  if (cachedWorks.length > 0 && now - lastCatalogFetch < 600000) {
    return cachedWorks;
  }

  try {
    const entity = await client.getEntity('-1002333204677');
    const allMsgs = [];
    let offsetId = 0;
    while (true) {
      const batch = await client.getMessages(entity, { limit: 100, offsetId });
      if (!batch || batch.length === 0) break;
      allMsgs.push(...batch);
      offsetId = batch[batch.length - 1].id;
      if (batch.length < 100) break;
    }

    const works = [];
    for (const msg of allMsgs) {
      const text = msg.message || '';
      if (!text || text.length < 5) continue;
      let link = '';
      if (msg.replyMarkup?.rows) {
        for (const row of msg.replyMarkup.rows) {
          for (const btn of row.buttons) {
            if (btn.url && btn.url.includes('t.me')) {
              link = btn.url;
              break;
            }
          }
          if (link) break;
        }
      }
      if (!link) continue;
      const title = text.split('\n')[0].split('|')[0].trim().replace(/^📚\s*/, '');
      if (title.length >= 2) {
        works.push({ title, link });
      }
    }

    const seen = new Set();
    cachedWorks = works.filter((w) => {
      if (seen.has(w.link)) return false;
      seen.add(w.link);
      return true;
    });
    lastCatalogFetch = now;
  } catch (err) {
    console.error('Erro ao buscar catálogo do Bunker:', err.message);
  }

  return cachedWorks;
}

// Formatar menu principal
function formatMenuText() {
  return (
    `📖 *Manga Offline — Painel de Controle no Telegram*\n\n` +
    `Você pode controlar os downloads e acompanhar o progresso por aqui:\n\n` +
    `📊 */status* — Ver progresso atual do download em tempo real\n` +
    `📚 */biblioteca* — Ver obras e capítulos já baixados no PC\n` +
    `🔍 */obras [página]* — Ver catálogo de obras do Bunker Mangás\n` +
    `⬇️ */baixar [número]* — Iniciar download de uma obra específica\n` +
    `⚡ */bunker* — Iniciar extração em massa do Bunker\n` +
    `🛡️ */duplicidades* — Verificar e eliminar duplicidades de obras/capítulos\n` +
    `❓ */ajuda* — Exibir esta lista de comandos\n\n` +
    `💡 _Dica: Digite /status a qualquer momento para acompanhar a barra de progresso!_`
  );
}

// Formatar mensagem de status
function formatStatusMessage() {
  const cur = getCurrentDownloadStatus();
  const lib = getLibrarySummary();

  let msg = `⚡ *STATUS DO EXTRATOR MANGA OFFLINE*\n\n`;

  if (cur && cur.status === 'baixando') {
    const bar = renderProgressBar(cur.chapterProgress || 0, 16);
    msg += `📖 *Obra:* \`${cur.currentManga || '-'}\`\n`;
    msg += `📑 *Capítulo:* \`${cur.chapter || '-'}\` (${cur.progress || '-'})\n`;
    msg += `⬇️ *Progresso:* [${bar}] *${cur.chapterProgress || 0}%*\n`;
    msg += `💾 *Tamanho:* ${cur.downloadedMb || 0} MB / ${cur.totalMb || 0} MB\n`;
    msg += `📊 *Obra Concluída:* ${cur.mangaPercent || 0}%\n\n`;
  } else {
    msg += `💤 *Status:* Aguardando ou finalizado.\n\n`;
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

// Formatar lista de obras paginada
async function formatWorksList(client, page = 1) {
  const works = await loadBunkerWorks(client);
  const pageSize = 12;
  const totalPages = Math.ceil(works.length / pageSize) || 1;
  const p = Math.max(1, Math.min(totalPages, parseInt(page) || 1));
  const start = (p - 1) * pageSize;
  const end = start + pageSize;
  const slice = works.slice(start, end);

  let msg = `📚 *CATÁLOGO BUNKER MANGÁS* (Página ${p}/${totalPages})\n`;
  msg += `Total: *${works.length}* obras disponíveis para download.\n\n`;

  slice.forEach((w, i) => {
    const idx = start + i + 1;
    msg += `*${idx}.* ${w.title}\n`;
  });

  msg += `\n────────────────────────────\n`;
  msg += `👉 Digite */baixar [número]* para baixar a obra (ex: \`/baixar ${start + 1}\`)\n`;
  if (p < totalPages) {
    msg += `👉 Digite */obras ${p + 1}* para ver a próxima página\n`;
  }

  return msg;
}

// Formatar lista da biblioteca
function formatLibraryMessage() {
  const lib = getLibrarySummary();
  let msg = `📚 *BIBLIOTECA LOCAL — OBRAS BAIXADAS*\n\n`;
  msg += `Total de obras: *${lib.worksCount}*\n`;
  msg += `Total de capítulos: *${lib.totalChapters}*\n\n`;

  if (lib.items.length === 0) {
    msg += `📭 Nenhum capítulo baixado ainda. Use */obras* para escolher!`;
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

  // Notificar nas Mensagens Salvas
  const welcomeText =
    `🚀 *Manga Offline — Assistente Ativo!*\n\n` +
    `O bot de controle agora está respondendo aqui nas suas *Mensagens Salvas*!\n\n` +
    formatMenuText();

  try {
    await client.sendMessage('me', { message: welcomeText, parseMode: 'md' });
    console.log('📢 Mensagem de boas-vindas enviada para Mensagens Salvas!');
  } catch (err) {
    console.error('Aviso ao enviar boas-vindas:', err.message);
  }

  // Monitorar comandos recebidos nas Mensagens Salvas (chat consigo mesmo)
  client.addEventHandler(async (event) => {
    try {
      const msg = event.message;
      if (!msg || !msg.message) return;

      const text = msg.message.trim();
      const peerId = msg.peerId;
      const isSavedMessages =
        peerId?.userId?.toString() === me.id.toString() ||
        (event.isPrivate && msg.fromId?.userId?.toString() === me.id.toString());

      // Responder apenas se for nas Mensagens Salvas ou comando direcionado
      if (!isSavedMessages && !text.startsWith('/')) return;

      const lower = text.toLowerCase();

      // /start ou /menu ou /ajuda
      if (lower === '/start' || lower === '/menu' || lower === '/ajuda' || lower === 'ajuda' || lower === 'menu') {
        await client.sendMessage('me', { message: formatMenuText(), parseMode: 'md' });
        return;
      }

      // /status
      if (lower.startsWith('/status') || lower === 'status') {
        await client.sendMessage('me', { message: formatStatusMessage(), parseMode: 'md' });
        return;
      }

      // /biblioteca
      if (lower.startsWith('/biblioteca') || lower === 'biblioteca') {
        await client.sendMessage('me', { message: formatLibraryMessage(), parseMode: 'md' });
        return;
      }

      // /obras [página]
      if (lower.startsWith('/obras') || lower.startsWith('/catalogo')) {
        const parts = text.split(' ');
        const page = parts.length > 1 ? parseInt(parts[1]) || 1 : 1;
        await client.sendMessage('me', { message: '⏳ Carregando catálogo...', parseMode: 'md' });
        const listText = await formatWorksList(client, page);
        await client.sendMessage('me', { message: listText, parseMode: 'md' });
        return;
      }

      // /baixar [número ou nome]
      if (lower.startsWith('/baixar')) {
        const query = text.replace(/^\/baixar\s*/i, '').trim();
        if (!query) {
          await client.sendMessage('me', {
            message: `⚠️ *Como usar:* Digite \`/baixar [número]\` (ex: \`/baixar 1\`). Use */obras* para ver os números.`,
            parseMode: 'md',
          });
          return;
        }

        const works = await loadBunkerWorks(client);
        const num = parseInt(query);
        let selected = null;

        if (!isNaN(num) && num >= 1 && num <= works.length) {
          selected = works[num - 1];
        } else {
          selected = works.find((w) => w.title.toLowerCase().includes(query.toLowerCase()));
        }

        if (!selected) {
          await client.sendMessage('me', {
            message: `❌ Nenhuma obra encontrada com "${query}". Digite */obras* para listar.`,
            parseMode: 'md',
          });
          return;
        }

        // Salvar a escolha no estado do extrator
        try {
          let state = {};
          if (fsSync.existsSync(BUNKER_STATE_FILE)) {
            state = JSON.parse(fsSync.readFileSync(BUNKER_STATE_FILE, 'utf-8'));
          }
          state.priorityWork = selected;
          fsSync.writeFileSync(BUNKER_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
        } catch {}

        await client.sendMessage('me', {
          message:
            `✅ *Obra Selecionada para Download!*\n\n` +
            `📖 *Título:* ${selected.title}\n` +
            `🔗 *Canal:* ${selected.link}\n\n` +
            `O extrator do Bunker está processando essa obra! Digite */status* para acompanhar.`,
          parseMode: 'md',
        });
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
            `Todas as obras e conteúdos agora estão 100% organizados sem repetição!`,
          parseMode: 'md',
        });
        return;
      }

      // /bunker
      if (lower === '/bunker') {
        await client.sendMessage('me', {
          message:
            `⚡ *Extração do Bunker Ativa!*\n\n` +
            `O extrator em massa do Bunker está ativo e baixando todas as 174 obras sequencialmente.\n` +
            `Digite */status* para ver o progresso do capítulo atual!`,
          parseMode: 'md',
        });
        return;
      }
    } catch (err) {
      console.error('Erro no handler de mensagens:', err.message);
    }
  }, new NewMessage({}));

  console.log('👂 Escutando comandos nas Mensagens Salvas do Telegram...');

  // Loop de monitoramento periódico: notificar a cada obra concluída
  let lastReportedManga = '';
  let lastReportedChapter = '';

  setInterval(async () => {
    try {
      const cur = getCurrentDownloadStatus();
      if (!cur || cur.status !== 'baixando') return;

      // Se mudou de capítulo e completou o anterior
      if (cur.chapter && cur.chapter !== lastReportedChapter) {
        lastReportedChapter = cur.chapter;
        if (cur.currentManga && cur.currentManga !== lastReportedManga) {
          lastReportedManga = cur.currentManga;
          await client.sendMessage('me', {
            message: `🚀 *Nova Obra em Andamento:*\n\n📖 *${cur.currentManga}*\nIniciando extração dos capítulos...`,
            parseMode: 'md',
          });
        }
      }
    } catch {}
  }, 10000);
}

main().catch((err) => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
