import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import JSZip from 'jszip';
import {
  canonicalSlug,
  findExistingMangaDir,
  isChapterAlreadyDownloaded,
  mergeLibraryDuplicates,
  cleanCatalogDuplicates,
} from './deduplicator.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_ID = parseInt(process.env.TELEGRAM_API_ID || '0');
const API_HASH = process.env.TELEGRAM_API_HASH || '';
const SESSION = process.env.TELEGRAM_SESSION || '';

const LIBRARY_DIR = path.join(__dirname, '..', 'library');
const CATALOG_DIR = path.join(__dirname, '..', 'public', 'catalog');
const TEMP_DIR = path.join(__dirname, '.temp');
const PROGRESS_FILE = path.join(__dirname, 'download-progress.json');
const PUBLIC_PROGRESS_FILE = path.join(__dirname, '..', 'public', 'download-progress.json');
const BUNKER_STATE_FILE = path.join(__dirname, 'bunker-state.json');

// ID do grupo catálogo Bunker
const BUNKER_GROUP_ID = '-1002333204677';

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
function padNum(n, d = 3) { return String(Math.round(n)).padStart(d, '0'); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

function renderProgressBar(percent, length = 20) {
  const p = Math.max(0, Math.min(100, percent));
  const filled = Math.round((p / 100) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

// ═══════════════════════════════════════════════════════
// PERSISTÊNCIA DE ESTADO (retomada automática)
// ═══════════════════════════════════════════════════════
async function loadBunkerState() {
  try { return JSON.parse(await fs.readFile(BUNKER_STATE_FILE, 'utf-8')); }
  catch { return { joinedChannels: {}, completedChannels: [] }; }
}

async function saveBunkerState(state) {
  await fs.writeFile(BUNKER_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

// ═══════════════════════════════════════════════════════
// PROGRESSO WEB
// ═══════════════════════════════════════════════════════
let lastProgressWrite = 0;
async function publishProgress(data) {
  const now = Date.now();
  if (now - lastProgressWrite < 400 && data.status === 'baixando') return;
  lastProgressWrite = now;
  const payload = JSON.stringify({ ...data, timestamp: new Date().toISOString() }, null, 2);
  try {
    await fs.writeFile(PROGRESS_FILE, payload, 'utf-8');
    await fs.writeFile(PUBLIC_PROGRESS_FILE, payload, 'utf-8');
  } catch {}
}

// ═══════════════════════════════════════════════════════
// EXTRAÇÃO CBZ
// ═══════════════════════════════════════════════════════
async function extractCbz(cbzPath, destFolder) {
  try {
    const buf = await fs.readFile(cbzPath);
    const zip = await JSZip.loadAsync(buf);
    await fs.mkdir(destFolder, { recursive: true });
    const imgs = Object.keys(zip.files)
      .filter(n => !zip.files[n].dir && /\.(jpg|jpeg|png|webp|gif)$/i.test(n))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (imgs.length === 0) return [];
    const pageFiles = [];
    for (let i = 0; i < imgs.length; i++) {
      const ext = path.extname(imgs[i]).toLowerCase() || '.jpg';
      const pageName = `${padNum(i + 1)}${ext}`;
      const data = await zip.files[imgs[i]].async('nodebuffer');
      await fs.writeFile(path.join(destFolder, pageName), data);
      pageFiles.push(pageName);
    }
    await fs.unlink(cbzPath).catch(() => {});
    return pageFiles;
  } catch (err) {
    await fs.unlink(cbzPath).catch(() => {});
    console.error(`\n  ❌ Erro ao extrair: ${err.message}`);
    return [];
  }
}

// ═══════════════════════════════════════════════════════
// DOWNLOAD COM BARRA DE PROGRESSO E RETRY
// ═══════════════════════════════════════════════════════
async function downloadFile(client, media, fileSize, destFile, mangaTitle, chapterName, idx, total, entity, msgId) {
  const sizeMb = (fileSize / 1048576).toFixed(1);
  let lastPct = -1;
  let currentMedia = media;

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await client.downloadMedia(currentMedia, {
        outputFile: destFile,
        partSizeKb: 512,
        progressCallback: async (bytes) => {
          const pct = Math.min(100, Math.round((Number(bytes) / Math.max(fileSize, 1)) * 100));
          const dlMb = (Number(bytes) / 1048576).toFixed(1);
          if (pct !== lastPct) {
            lastPct = pct;
            const bar = renderProgressBar(pct);
            process.stdout.write(`\r  [${bar}] ${pct}% (${dlMb}/${sizeMb}MB) | ${chapterName} [${idx}/${total}]`);
            await publishProgress({
              status: 'baixando', currentManga: mangaTitle, chapter: chapterName,
              chapterProgress: pct, downloadedMb: dlMb, totalMb: sizeMb,
              progress: `${idx}/${total}`, mangaPercent: Math.round((idx / total) * 100),
            });
          }
        },
      });
      process.stdout.write('\r' + ' '.repeat(100) + '\r');
      return true;
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes('FLOOD_WAIT_')) {
        const sec = parseInt(msg.replace(/\D/g, '')) || 30;
        console.log(`\n  ⏳ FloodWait: aguardando ${sec}s...`);
        await sleep((sec + 3) * 1000);
        continue;
      }
      if (msg.includes('FILE_REFERENCE_EXPIRED')) {
        console.log(`\n  🔄 File reference expirado em ${chapterName}. Renovando mensagem #${msgId}...`);
        try {
          if (entity && msgId) {
            const fresh = await client.getMessages(entity, { ids: [msgId] });
            if (fresh && fresh[0] && fresh[0].media) {
              currentMedia = fresh[0].media;
              console.log(`  ✓ Referência renovada com sucesso! Retentando...`);
              await sleep(1000);
              continue;
            }
          }
        } catch (rErr) {
          console.log(`  ⚠️ Erro ao renovar referência: ${rErr.message}`);
        }
      }
      if (attempt === 5) {
        console.error(`\n  ❌ Falhou após 5 tentativas: ${msg}`);
        await fs.unlink(destFile).catch(() => {});
        return false;
      }
      console.log(`\n  ⚠️  Tentativa ${attempt}/5 falhou (${msg.substring(0, 60)}). Retentando...`);
      await sleep(5000);
      try { await client.connect(); } catch {}
    }
  }
  return false;
}

// ═══════════════════════════════════════════════════════
// BUSCAR MENSAGENS COM RETRY
// ═══════════════════════════════════════════════════════
async function fetchAllMessages(client, entity) {
  const all = [];
  let offsetId = 0;
  let retries = 0;
  while (true) {
    try {
      const batch = await client.getMessages(entity, { limit: 100, offsetId });
      if (!batch || batch.length === 0) break;
      all.push(...batch);
      offsetId = batch[batch.length - 1].id;
      if (batch.length < 100) break;
      await sleep(400);
      retries = 0;
    } catch (err) {
      retries++;
      const msg = err?.message || '';
      if (msg.includes('FLOOD_WAIT_')) {
        const sec = parseInt(msg.replace(/\D/g, '')) || 30;
        console.log(`\n  ⏳ FloodWait ao listar: ${sec}s...`);
        await sleep((sec + 3) * 1000);
      } else if (retries > 5) {
        break;
      } else {
        await sleep(3000);
        try { await client.connect(); } catch {}
      }
    }
  }
  return all;
}

// ═══════════════════════════════════════════════════════
// ENTRAR NUM CANAL PRIVADO (JOIN)
// ═══════════════════════════════════════════════════════
async function joinChannel(client, inviteLink) {
  try {
    // Link de convite privado: t.me/+HASH
    const hash = inviteLink.replace(/.*\/\+/, '').replace(/.*\+/, '');
    if (hash && inviteLink.includes('/+')) {
      const result = await client.invoke(new Api.messages.ImportChatInvite({ hash }));
      await sleep(1000);
      return result?.chats?.[0] || null;
    }
    // Link público: t.me/username
    const username = inviteLink.replace(/.*t\.me\//, '').replace(/[?#].*/, '');
    if (username) {
      const entity = await client.getEntity(username);
      await client.invoke(new Api.channels.JoinChannel({ channel: entity }));
      await sleep(1000);
      return entity;
    }
  } catch (err) {
    const msg = err?.message || String(err);
    // USER_ALREADY_PARTICIPANT = já participa, não é erro
    if (msg.includes('USER_ALREADY_PARTICIPANT') || msg.includes('already')) return 'already';
    return null;
  }
  return null;
}

// ═══════════════════════════════════════════════════════
// BAIXAR CAPÍTULOS DE UM CANAL DE OBRA
// ═══════════════════════════════════════════════════════
async function downloadWorkFromChannel(client, entity, mangaTitle, titleSlug, catalog, workIdx, totalWorks) {
  const cleanSlug = canonicalSlug(titleSlug || mangaTitle);
  const mangaDir = findExistingMangaDir(LIBRARY_DIR, cleanSlug);
  await fs.mkdir(mangaDir, { recursive: true });

  // Buscar mensagens do canal
  const allMsgs = await fetchAllMessages(client, entity);

  // Filtrar CBZ/ZIP
  const chapters = [];
  for (const msg of allMsgs) {
    if (!msg.media?.document) continue;
    const attr = msg.media.document.attributes?.find(a => a.fileName);
    const fn = attr?.fileName || '';
    if (!fn.match(/\.(cbz|zip)$/i)) continue;
    const numMatch = fn.match(/(\d+(?:\.\d+)?)/);
    const num = numMatch ? parseFloat(numMatch[1]) : chapters.length + 1;
    chapters.push({
      fileName: fn, media: msg.media,
      size: Number(msg.media.document.size || 0), chapterNum: num,
      id: msg.id,
    });
  }
  chapters.sort((a, b) => a.chapterNum - b.chapterNum);

  if (chapters.length === 0) {
    console.log(`  ⚠️  Sem capítulos CBZ neste canal`);
    return 0;
  }

  // Verificar quais já estão prontos (com verificação rigorosa anti-duplicidade)
  let done = 0;
  for (const ch of chapters) {
    if (isChapterAlreadyDownloaded(mangaDir, ch.chapterNum)) {
      done++;
    }
  }

  const pending = chapters.length - done;
  console.log(`  📦 ${chapters.length} caps | ✅ ${done} prontos | ⬇️  ${pending} para baixar`);
  if (pending === 0) { console.log(`  ✓ Completo (nenhuma duplicata baixada)!\n`); return 0; }

  // Garantir entrada no catálogo
  let catManga = catalog.mangas.find(m => canonicalSlug(m.id || m.title) === cleanSlug);
  if (!catManga) {
    catManga = { id: cleanSlug, title: mangaTitle.replace(/^📚\s*/, ''), chapters: [] };
    catalog.mangas.push(catManga);
  }
  if (!catManga.chapters) catManga.chapters = [];

  let newDownloads = 0;
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const folderName = `Capitulo ${padNum(ch.chapterNum)}`;
    const chapterFolder = path.join(mangaDir, folderName);

    // Verificação estrita anti-duplicidade de capítulos e conteúdos
    if (isChapterAlreadyDownloaded(mangaDir, ch.chapterNum)) {
      let chInCat = catManga.chapters.find(c => c.number === ch.chapterNum);
      if (chInCat && (!chInCat.pages || chInCat.pages.length === 0)) {
        try {
          const pgs = fsSync.readdirSync(chapterFolder).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
          chInCat.pageCount = pgs.length;
          chInCat.pages = pgs;
        } catch {}
      }
      continue;
    }

    const tempFile = path.join(TEMP_DIR, `${titleSlug}_ch${padNum(ch.chapterNum)}.cbz`);
    const ok = await downloadFile(client, ch.media, ch.size, tempFile, mangaTitle, folderName, i + 1, chapters.length, entity, ch.id);

    if (ok) {
      const pages = await extractCbz(tempFile, chapterFolder);
      if (pages.length > 0) {
        console.log(`  ✅ [${i + 1}/${chapters.length}] ${folderName}: ${pages.length} páginas`);
        newDownloads++;
        let chInCat = catManga.chapters.find(c => c.number === ch.chapterNum);
        if (!chInCat) {
          chInCat = { id: `ch-${titleSlug}-${ch.chapterNum}`, number: ch.chapterNum, title: ch.fileName.replace(/\.(cbz|zip)$/i, ''), folderName };
          catManga.chapters.push(chInCat);
        }
        chInCat.pageCount = pages.length; chInCat.pages = pages;
        await fs.writeFile(path.join(CATALOG_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2), 'utf-8');
      } else {
        console.log(`  ⚠️  ${folderName}: arquivo sem imagens`);
      }
    }
    await sleep(300);
  }
  return newDownloads;
}

// ═══════════════════════════════════════════════════════
// EXTRAIR OBRAS DO BUNKER (catálogo com botões de link)
// ═══════════════════════════════════════════════════════
async function extractWorksFromCatalogChannel(client, groupId) {
  const entity = await client.getEntity(groupId);
  console.log(`  📡 Lendo catálogo: ${entity.title}`);
  const allMsgs = await fetchAllMessages(client, entity);

  const works = [];
  for (const msg of allMsgs) {
    const text = msg.message || '';
    if (!text || text.length < 5) continue;

    // Pegar link do botão inline
    let link = '';
    if (msg.replyMarkup?.rows) {
      for (const row of msg.replyMarkup.rows) {
        for (const btn of row.buttons) {
          if (btn.url && btn.url.includes('t.me')) { link = btn.url; break; }
        }
        if (link) break;
      }
    }
    if (!link) continue;

    // Título = primeira linha antes do '|'
    const title = text.split('\n')[0].split('|')[0].trim().replace(/^📚\s*/, '');
    if (!title || title.length < 2) continue;

    works.push({ title, link, slug: canonicalSlug(title) });
  }

  // Deduplicar por link
  const seen = new Set();
  return works.filter(w => {
    if (seen.has(w.link)) return false;
    seen.add(w.link);
    return true;
  });
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  🌊 BUNKER MANGÁS - EXTRATOR EM MASSA                  ║');
  console.log('║  Entra em cada canal, baixa todos os capítulos CBZ     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  await fs.mkdir(LIBRARY_DIR, { recursive: true });
  await fs.mkdir(CATALOG_DIR, { recursive: true });
  await fs.mkdir(TEMP_DIR, { recursive: true });

  // Carregar estado (progresso anterior)
  const state = await loadBunkerState();
  const completedSet = new Set(state.completedChannels || []);
  const joinedMap = state.joinedChannels || {};

  // Carregar catálogo
  let catalog = { mangas: [] };
  try { catalog = JSON.parse(await fs.readFile(path.join(CATALOG_DIR, 'catalog.json'), 'utf-8')); } catch {}

  // Conectar
  console.log('🔌 Conectando ao Telegram...');
  const client = new TelegramClient(new StringSession(SESSION), API_ID, API_HASH, {
    connectionRetries: 20, retryDelay: 3000, autoReconnect: true,
  });
  await client.connect();
  console.log('✅ Conectado!\n');

  // 1. Ler catálogo do Bunker e extrair todos os links de obras
  console.log('📖 Lendo catálogo Bunker Mangás...\n');
  const works = await extractWorksFromCatalogChannel(client, BUNKER_GROUP_ID);
  console.log(`\n✅ ${works.length} obras encontradas no Bunker!\n`);

  // 2. Verificar quantas já estão completas
  const pending = works.filter(w => !completedSet.has(w.link));
  const skipped = works.length - pending.length;
  console.log(`📊 ${skipped} já concluídas | ${pending.length} obras para baixar\n`);

  // 3. Processar cada obra
  let totalNewChapters = 0;
  let worksDone = 0;

  for (const work of pending) {
    worksDone++;
    const workLabel = `[${worksDone + skipped}/${works.length}] ${work.title.substring(0, 42)}`;

    console.log(`╔══════════════════════════════════════════════════════════╗`);
    console.log(`║ 📖 ${workLabel.padEnd(54)} ║`);
    console.log(`╚══════════════════════════════════════════════════════════╝`);
    console.log(`  🔗 ${work.link}`);

    // 3a. Verificar se já temos capítulos no disco (retomada anti-duplicidade)
    const cleanSlug = canonicalSlug(work.slug || work.title);
    const mangaDir = findExistingMangaDir(LIBRARY_DIR, cleanSlug);
    let existingCaps = 0;
    if (fsSync.existsSync(mangaDir)) {
      existingCaps = fsSync.readdirSync(mangaDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name.toLowerCase().startsWith('capitulo')).length;
    }

    // 3b. Entrar no canal (ou verificar se já entramos)
    let entity = null;
    if (joinedMap[work.link]) {
      // Já entramos antes - tentar acessar diretamente pelo ID salvo
      try {
        entity = await client.getEntity(joinedMap[work.link]);
      } catch {
        entity = null;
      }
    }

    if (!entity) {
      process.stdout.write(`  🚪 Entrando no canal...`);
      const joinResult = await joinChannel(client, work.link);
      if (!joinResult) {
        console.log(` ❌ Falha ao entrar. Pulando.`);
        await sleep(2000);
        continue;
      }
      if (joinResult === 'already') {
        console.log(` ✓ Já participa`);
        // Tentar pegar pela URL
        try {
          const username = work.link.replace(/.*t\.me\//, '').replace(/\+.*/, '').replace(/[?#].*/, '');
          if (username && !work.link.includes('/+')) entity = await client.getEntity(username);
        } catch {}
      } else {
        console.log(` ✅ Entrou com sucesso`);
        entity = joinResult;
      }

      if (!entity) {
        // Tentar pegar pelo hash do invite
        try {
          const hash = work.link.replace(/.*\/\+/, '');
          if (hash) {
            const info = await client.invoke(new Api.messages.CheckChatInvite({ hash }));
            if (info?.chat) entity = info.chat;
          }
        } catch {}
      }

      if (!entity) {
        console.log(`  ❌ Não conseguiu acessar o canal. Pulando.`);
        await sleep(2000);
        continue;
      }
    }

    // Salvar ID do canal no estado
    const entityId = entity.id ? '-100' + entity.id.toString() : null;
    if (entityId) {
      state.joinedChannels = state.joinedChannels || {};
      state.joinedChannels[work.link] = entityId;
    }
    await saveBunkerState(state);

    // 3c. Baixar capítulos
    try {
      const n = await downloadWorkFromChannel(
        client, entity, work.title, work.slug, catalog,
        worksDone, pending.length
      );
      totalNewChapters += n;

      // Marcar como concluída (mesmo que tenha 0 capítulos CBZ - pode ser só imagens)
      state.completedChannels = state.completedChannels || [];
      state.completedChannels.push(work.link);
      await saveBunkerState(state);
    } catch (err) {
      console.error(`  ❌ Erro: ${err.message}`);
      try { await client.connect(); } catch {}
    }

    // Pausa entre obras para não estressar a API
    await sleep(1000);
  }

  // Finalizar
  await publishProgress({
    status: 'concluido',
    totalNewChapters,
    message: `Bunker concluído! ${totalNewChapters} capítulos de ${works.length} obras.`,
  });

  console.log('');
  console.log(`╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  🎉 BUNKER CONCLUÍDO!                                  ║`);
  console.log(`║  📦 ${String(totalNewChapters).padStart(5)} capítulos baixados                        ║`);
  console.log(`║  📚 ${String(works.length).padStart(5)} obras processadas                          ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);

  try { await client.disconnect(); } catch {}
}

main().catch(err => {
  console.error('\n❌ Erro fatal:', err.message || err);
  process.exit(1);
});
