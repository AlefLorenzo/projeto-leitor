import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import JSZip from 'jszip';
import readline from 'readline';
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
const STATE_FILE = path.join(__dirname, 'extractor-state.json');

// ═══════════════════════════════════════════════════════
// TODOS OS CANAIS/GRUPOS DISPONÍVEIS (Slugs Canônicos Únicos)
// ═══════════════════════════════════════════════════════

// Canais dedicados (1 obra por canal)
const DEDICATED_CHANNELS = [
  { id: '-1003340387097', defaultTitle: 'Pick Me Up!', titleSlug: 'pick-me-up' },
  { id: '-1003429556677', defaultTitle: 'Player of a Fallen Noble Family', titleSlug: 'player-of-a-fallen-noble-family' },
  { id: '-1003846994703', defaultTitle: 'I Became the Rogue First Prince', titleSlug: 'i-became-the-rogue-first-prince' },
  { id: '-1003589566501', defaultTitle: 'Unrivaled Spear Demon', titleSlug: 'unrivaled-spear-demon' },
  { id: '-1002572469547', defaultTitle: "Swordmaster's Youngest Son", titleSlug: 'swordmasters-youngest-son' },
  { id: '-1003591071501', defaultTitle: 'Rengoku no Ashe', titleSlug: 'rengoku-no-ashe' },
  { id: '-1002576448823', defaultTitle: 'Gigantomachia', titleSlug: 'gigantomachia' },
];

// Grupos multi-obras (várias obras dentro)
// NOTA: QG BALTIGO (-1001834602691) e Bunker (-1002333204677) são canais de ANÚNCIOS/CATÁLOGO
// Eles não contêm arquivos CBZ diretamente - apenas anunciam obras que ficam em canais separados.
// Os capítulos reais ficam nos DEDICATED_CHANNELS acima.
const MULTI_GROUPS = [
  // Desativados - são canais de anúncios, não de capítulos
  // { id: '-1001834602691', title: 'Mangás Brasil - QG BALTIGO' },
  // { id: '-1002333204677', title: 'Bunker Mangás - Brasil' },
];

function padNum(n, d = 3) {
  return String(Math.round(n)).padStart(d, '0');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

function renderProgressBar(percent, length = 24) {
  const p = Math.max(0, Math.min(100, percent));
  const filled = Math.round((p / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function askQuestion(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ═══════════════════════════════════════════════════════
// ESTADO PERSISTENTE
// ═══════════════════════════════════════════════════════
async function loadState() {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE, 'utf-8'));
  } catch {
    return { selectedTargets: null, lastRun: null };
  }
}

async function saveState(state) {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
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
    console.error(`\n  ❌ Erro ao extrair ${path.basename(cbzPath)}: ${err.message}`);
    // Limpar arquivo corrompido
    await fs.unlink(cbzPath).catch(() => {});
    return [];
  }
}

// ═══════════════════════════════════════════════════════
// PROGRESSO WEB
// ═══════════════════════════════════════════════════════
let lastProgressWrite = 0;
async function publishProgress(data) {
  const now = Date.now();
  if (now - lastProgressWrite < 300 && data.status === 'baixando') return;
  lastProgressWrite = now;
  const payload = JSON.stringify({ ...data, timestamp: new Date().toISOString() }, null, 2);
  try {
    await fs.writeFile(PROGRESS_FILE, payload, 'utf-8');
    await fs.writeFile(PUBLIC_PROGRESS_FILE, payload, 'utf-8');
  } catch {}
}

// ═══════════════════════════════════════════════════════
// DOWNLOAD COM RETRY ROBUSTO E RENOVAÇÃO DE FILE REFERENCE
// ═══════════════════════════════════════════════════════
async function downloadFileWithProgress(client, mediaObj, fileSize, destFile, mangaTitle, chapterName, currentIdx, totalManga, channelId, msgId) {
  const fileSizeMb = (fileSize / (1024 * 1024)).toFixed(1);
  let lastPercent = -1;
  let currentMedia = mediaObj;

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await client.downloadMedia(currentMedia, {
        outputFile: destFile,
        partSizeKb: 512,
        progressCallback: async (downloadedBytes) => {
          const downloaded = Number(downloadedBytes) || 0;
          const percent = Math.min(100, Math.round((downloaded / Math.max(fileSize, 1)) * 100));
          const dlMb = (downloaded / (1024 * 1024)).toFixed(1);

          if (percent !== lastPercent) {
            lastPercent = percent;
            const bar = renderProgressBar(percent, 20);
            process.stdout.write(`\r  [${bar}] ${percent}% (${dlMb}/${fileSizeMb}MB) | ${chapterName} [${currentIdx}/${totalManga}]`);
            await publishProgress({
              status: 'baixando',
              currentManga: mangaTitle,
              chapter: chapterName,
              chapterProgress: percent,
              downloadedMb: dlMb,
              totalMb: fileSizeMb,
              progress: `${currentIdx}/${totalManga}`,
              mangaPercent: Math.round((currentIdx / totalManga) * 100),
            });
          }
        },
      });
      process.stdout.write('\r' + ' '.repeat(100) + '\r');
      return true;
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes('FLOOD_WAIT_')) {
        const seconds = parseInt(msg.replace(/\D/g, '')) || 30;
        console.log(`\n  ⏳ FloodWait: pausando ${seconds}s...`);
        await sleep((seconds + 3) * 1000);
        continue;
      }
      if (msg.includes('FILE_REFERENCE_EXPIRED')) {
        console.log(`\n  🔄 File reference expirou em ${chapterName}. Renovando mensagem #${msgId}...`);
        try {
          if (channelId && msgId) {
            const freshMsgs = await client.getMessages(channelId, { ids: [msgId] });
            if (freshMsgs && freshMsgs[0] && freshMsgs[0].media) {
              currentMedia = freshMsgs[0].media;
              console.log(`  ✓ Referência renovada com sucesso! Retentando...`);
              await sleep(1000);
              continue;
            }
          }
        } catch (rErr) {
          console.log(`  ⚠️ Erro ao atualizar referência: ${rErr.message}`);
        }
      }
      if (msg.includes('TIMEOUT') || msg.includes('CONNECTION') || msg.includes('NETWORK')) {
        console.log(`\n  ⚠️  Erro de conexão (tentativa ${attempt}/5): ${msg}. Reconectando em 10s...`);
        await sleep(10000);
        try { await client.connect(); } catch {}
        continue;
      }
      if (attempt === 5) {
        console.error(`\n  ❌ Falha após 5 tentativas em ${chapterName}: ${msg}`);
        // Limpar arquivo parcial
        await fs.unlink(destFile).catch(() => {});
        return false;
      }
      console.log(`\n  ⚠️  Tentativa ${attempt}/5 falhou (${msg}). Retentando em 5s...`);
      await sleep(5000);
    }
  }
  return false;
}

// ═══════════════════════════════════════════════════════
// BUSCAR MENSAGENS DE UM CANAL/GRUPO
// ═══════════════════════════════════════════════════════
async function fetchAllMessages(client, entity) {
  const allMsgs = [];
  let offsetId = 0;
  let retries = 0;
  while (true) {
    try {
      const batch = await client.getMessages(entity, { limit: 100, offsetId });
      if (!batch || batch.length === 0) break;
      allMsgs.push(...batch);
      offsetId = batch[batch.length - 1].id;
      if (batch.length < 100) break;
      await sleep(400);
      retries = 0;
    } catch (err) {
      retries++;
      if (retries > 5) {
        console.error(`  ❌ Falha ao buscar mensagens após 5 tentativas: ${err.message}`);
        break;
      }
      const msg = err?.message || '';
      if (msg.includes('FLOOD_WAIT_')) {
        const sec = parseInt(msg.replace(/\D/g, '')) || 30;
        console.log(`  ⏳ FloodWait ao listar: pausando ${sec}s...`);
        await sleep((sec + 3) * 1000);
      } else {
        console.log(`  ⚠️  Erro ao buscar mensagens (tentativa ${retries}/5): ${msg}. Retentando...`);
        await sleep(3000);
        try { await client.connect(); } catch {}
      }
    }
  }
  return allMsgs;
}

// ═══════════════════════════════════════════════════════
// EXTRAIR CBZ/ZIP DE UM CANAL DEDICADO
// ═══════════════════════════════════════════════════════
function filterChapterMessages(allMsgs) {
  const chapterMsgs = [];
  for (const msg of allMsgs) {
    if (msg.media?.document) {
      const attr = msg.media.document.attributes?.find(a => a.fileName);
      const fileName = attr?.fileName || '';
      if (fileName.match(/\.(cbz|zip)$/i)) {
        chapterMsgs.push({
          id: msg.id,
          fileName,
          media: msg.media,
          size: Number(msg.media.document.size || 0),
        });
      }
    }
  }
  chapterMsgs.sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true }));
  return chapterMsgs;
}

// ═══════════════════════════════════════════════════════
// DESCOBRIR OBRAS DENTRO DE UM GRUPO MULTI-OBRAS
// ═══════════════════════════════════════════════════════
function discoverWorksInGroup(allMsgs, groupTitle) {
  // Agrupa arquivos CBZ/ZIP por "nome da obra" extraído do nome do arquivo
  // Exemplos: "Solo Leveling Cap 001.cbz" => "Solo Leveling"
  //           "Capitulo 015 - Dandadan.cbz" => "Dandadan"
  const works = new Map(); // slug -> { title, slug, files: [] }

  for (const msg of allMsgs) {
    if (!msg.media?.document) continue;
    const attr = msg.media.document.attributes?.find(a => a.fileName);
    const fileName = attr?.fileName || '';
    if (!fileName.match(/\.(cbz|zip)$/i)) continue;

    // Tentar extrair o nome da obra do nome do arquivo
    const baseName = fileName.replace(/\.(cbz|zip)$/i, '');
    
    // Padrões comuns:
    // "NomeDaObra Cap 001", "NomeDaObra Capitulo 001", "NomeDaObra - Cap. 001"
    // "Cap 001 - NomeDaObra", "Capitulo 001", "001"
    let workTitle = '';
    
    // Padrão: "Título - Cap(ítulo) NNN" ou "Título Cap NNN"
    const matchTitleFirst = baseName.match(/^(.+?)[\s_-]+(?:cap(?:[ií]tulo)?\.?|ch(?:apter)?\.?|ep(?:isode)?\.?)[\s._-]*(\d+)/i);
    if (matchTitleFirst && matchTitleFirst[1].length > 2) {
      workTitle = matchTitleFirst[1].replace(/[\s_-]+$/, '');
    }
    
    // Padrão: "Cap NNN - Título"
    if (!workTitle) {
      const matchCapFirst = baseName.match(/^(?:cap(?:[ií]tulo)?\.?|ch(?:apter)?\.?)[\s._-]*\d+[\s._-]+(.+)/i);
      if (matchCapFirst && matchCapFirst[1].length > 2) {
        workTitle = matchCapFirst[1].replace(/^[\s_-]+|[\s_-]+$/g, '');
      }
    }

    // Se não encontrou padrão, usa o nome inteiro sem números finais
    if (!workTitle) {
      workTitle = baseName.replace(/[\s._-]*\d+[\s._-]*$/, '').trim();
    }
    
    if (!workTitle || workTitle.length < 2) {
      workTitle = baseName;
    }

    const slug = slugify(workTitle);
    if (!slug) continue;

    if (!works.has(slug)) {
      works.set(slug, { title: workTitle, slug, files: [] });
    }

    // Extrair número do capítulo
    const numMatch = fileName.match(/(\d+(?:\.\d+)?)/);
    const num = numMatch ? parseFloat(numMatch[1]) : works.get(slug).files.length + 1;

    works.get(slug).files.push({
      id: msg.id,
      fileName,
      media: msg.media,
      size: Number(msg.media.document.size || 0),
      chapterNum: num,
    });
  }

  // Ordenar capítulos dentro de cada obra
  for (const [, work] of works) {
    work.files.sort((a, b) => a.chapterNum - b.chapterNum);
  }

  return works;
}

// ═══════════════════════════════════════════════════════
// BAIXAR CAPÍTULOS DE UMA OBRA
// ═══════════════════════════════════════════════════════
async function downloadWorkChapters(client, mangaTitle, titleSlug, chapterFiles, catalog, channelId) {
  const cleanSlug = canonicalSlug(titleSlug || mangaTitle);
  const mangaDir = findExistingMangaDir(LIBRARY_DIR, cleanSlug);
  await fs.mkdir(mangaDir, { recursive: true });

  let catManga = catalog.mangas.find(m => canonicalSlug(m.id || m.title) === cleanSlug);
  if (!catManga) {
    catManga = {
      id: cleanSlug,
      title: mangaTitle.replace(/^📚\s*/, ''),
      chapters: [],
    };
    catalog.mangas.push(catManga);
  }
  if (!catManga.chapters) catManga.chapters = [];

  // Contar já baixados (anti-duplicidade)
  let alreadyDone = 0;
  let newDownloads = 0;

  for (const ch of chapterFiles) {
    if (isChapterAlreadyDownloaded(mangaDir, ch.chapterNum)) {
      alreadyDone++;
    }
  }

  const pending = chapterFiles.length - alreadyDone;
  console.log(`  📦 ${chapterFiles.length} capítulos no total | ✅ ${alreadyDone} já baixados | ⬇️  ${pending} pendentes`);
  if (pending === 0) {
    console.log(`  ✓ Todos os capítulos já estão extraídos (anti-duplicidade)!\n`);
    return 0;
  }

  let idx = 0;
  for (const ch of chapterFiles) {
    idx++;
    const folderName = `Capitulo ${padNum(ch.chapterNum)}`;
    const chapterFolder = path.join(mangaDir, folderName);

    // Pular se já extraído com imagens válidas
    if (isChapterAlreadyDownloaded(mangaDir, ch.chapterNum)) {
      let chInCat = catManga.chapters.find(c => c.number === ch.chapterNum || c.folderName === folderName);
      if (chInCat && (!chInCat.pages || chInCat.pages.length === 0)) {
        try {
          const pgs = fsSync.readdirSync(chapterFolder).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
          chInCat.pageCount = pgs.length;
          chInCat.pages = pgs;
        } catch {}
      }
      continue;
    }

    // Download
    const tempFile = path.join(TEMP_DIR, `${cleanSlug}_ch${padNum(ch.chapterNum)}.cbz`);
    const ok = await downloadFileWithProgress(
      client, ch.media, ch.size, tempFile,
      mangaTitle, folderName, idx, chapterFiles.length,
      channelId, ch.id
    );

    if (ok) {
      const pages = await extractCbz(tempFile, chapterFolder);
      if (pages.length > 0) {
        console.log(`  ✅ [${idx}/${chapterFiles.length}] ${folderName}: ${pages.length} páginas`);
        newDownloads++;

        let chInCat = catManga.chapters.find(c => c.number === ch.chapterNum || c.folderName === folderName);
        if (!chInCat) {
          chInCat = {
            id: `ch-${titleSlug}-${ch.chapterNum}`,
            number: ch.chapterNum,
            title: ch.fileName.replace(/\.(cbz|zip)$/i, ''),
            folderName,
          };
          catManga.chapters.push(chInCat);
        }
        chInCat.pageCount = pages.length;
        chInCat.pages = pages;

        // Salvar catálogo a cada capítulo
        await fs.writeFile(path.join(CATALOG_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2), 'utf-8');
      } else {
        console.log(`  ⚠️  [${idx}/${chapterFiles.length}] ${folderName}: arquivo sem imagens, pulando`);
      }
    } else {
      console.log(`  ❌ [${idx}/${chapterFiles.length}] ${folderName}: falha no download, será retentado na próxima execução`);
    }

    await sleep(300);
  }

  return newDownloads;
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  ⚡ EXTRATOR DE MANGÁS/MANHWAS DO TELEGRAM             ║');
  console.log('║  📦 Retomada automática + Escolha de obras             ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  await fs.mkdir(LIBRARY_DIR, { recursive: true });
  await fs.mkdir(CATALOG_DIR, { recursive: true });
  await fs.mkdir(TEMP_DIR, { recursive: true });

  // Conectar ao Telegram
  console.log('🔌 Conectando ao Telegram...');
  const client = new TelegramClient(new StringSession(SESSION), API_ID, API_HASH, {
    connectionRetries: 20,
    retryDelay: 3000,
    autoReconnect: true,
  });
  await client.connect();
  console.log('✅ Conectado ao Telegram!\n');

  // Carregar catálogo
  let catalog = { mangas: [] };
  try {
    const raw = await fs.readFile(path.join(CATALOG_DIR, 'catalog.json'), 'utf-8');
    catalog = JSON.parse(raw);
  } catch {}

  // Carregar estado
  const state = await loadState();

  // ═══════════════════════════════════════════════════════
  // FASE 1: ESCANEAR TUDO E MONTAR LISTA DE OBRAS
  // ═══════════════════════════════════════════════════════
  console.log('📡 Escaneando canais e grupos...\n');

  const allWorks = []; // { title, slug, channelId, files: [], source }

  // 1. Canais dedicados
  for (const ch of DEDICATED_CHANNELS) {
    try {
      process.stdout.write(`  🔍 ${ch.defaultTitle}...`);
      const entity = await client.getEntity(ch.id);
      const msgs = await fetchAllMessages(client, entity);
      const chapters = filterChapterMessages(msgs);
      if (chapters.length > 0) {
        allWorks.push({
          title: ch.defaultTitle,
          slug: ch.titleSlug,
          channelId: ch.id,
          files: chapters.map(c => ({
            ...c,
            chapterNum: (() => {
              const m = c.fileName.match(/(\d+(?:\.\d+)?)/);
              return m ? parseFloat(m[1]) : 0;
            })(),
          })),
          source: 'canal',
        });
        console.log(` ${chapters.length} capítulos`);
      } else {
        console.log(` sem capítulos CBZ`);
      }
      await sleep(500);
    } catch (err) {
      console.log(` ❌ ${err.message}`);
    }
  }

  // 2. Grupos multi-obras
  for (const group of MULTI_GROUPS) {
    try {
      console.log(`\n  🔍 Escaneando grupo: ${group.title}...`);
      const entity = await client.getEntity(group.id);
      const msgs = await fetchAllMessages(client, entity);
      console.log(`     ${msgs.length} mensagens encontradas`);

      const works = discoverWorksInGroup(msgs, group.title);
      let workCount = 0;
      for (const [, work] of works) {
        if (work.files.length > 0) {
          allWorks.push({
            title: work.title,
            slug: work.slug,
            channelId: group.id,
            files: work.files,
            source: group.title,
          });
          workCount++;
        }
      }
      console.log(`     ${workCount} obras encontradas com capítulos`);
      await sleep(500);
    } catch (err) {
      console.log(`     ❌ ${err.message}`);
    }
  }

  // Ordenar por nome
  allWorks.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));

  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`📚 Total: ${allWorks.length} obras encontradas com capítulos para baixar`);
  console.log(`══════════════════════════════════════════════════════════\n`);

  if (allWorks.length === 0) {
    console.log('❌ Nenhuma obra encontrada. Verifique se você tem acesso aos canais.');
    await client.disconnect();
    return;
  }

  // ═══════════════════════════════════════════════════════
  // FASE 2: SELEÇÃO DE OBRAS
  // ═══════════════════════════════════════════════════════

  let selectedSlugs = state.selectedTargets;

  // Verificar se há argumento de linha de comando
  const args = process.argv.slice(2);
  const argAll = args.includes('--all') || args.includes('-a');
  const argResume = args.includes('--resume') || args.includes('-r');
  const argMax = args.find(a => a.startsWith('--max='));
  const maxWorks = argMax ? parseInt(argMax.split('=')[1]) : 0;

  if (argAll) {
    // Baixar TODAS
    selectedSlugs = allWorks.map(w => w.slug);
    console.log(`✅ Modo --all: baixando todas as ${selectedSlugs.length} obras.\n`);
  } else if (argResume && selectedSlugs && selectedSlugs.length > 0) {
    // Retomar seleção anterior
    console.log(`🔄 Retomando seleção anterior: ${selectedSlugs.length} obras.\n`);
  } else {
    // Menu interativo
    console.log('📋 OBRAS DISPONÍVEIS:');
    console.log('────────────────────────────────────────────────────────────');
    for (let i = 0; i < allWorks.length; i++) {
      const w = allWorks[i];
      const existingDir = path.join(LIBRARY_DIR, w.slug);
      let done = 0;
      if (fsSync.existsSync(existingDir)) {
        try { done = fsSync.readdirSync(existingDir, { withFileTypes: true }).filter(d => d.isDirectory()).length; } catch {}
      }
      const statusStr = done > 0 ? `[${done}/${w.files.length} ✅]` : `[${w.files.length} caps]`;
      console.log(`  ${String(i + 1).padStart(3)}. ${w.title.substring(0, 40).padEnd(40)} ${statusStr.padStart(14)}  (${w.source})`);
    }
    console.log('────────────────────────────────────────────────────────────');
    console.log('');
    console.log('  OPÇÕES:');
    console.log('    all       → Baixar TODAS as obras');
    console.log('    1,3,5     → Baixar obras específicas (separadas por vírgula)');
    console.log('    1-10      → Baixar um intervalo de obras');
    console.log('    20        → Baixar as primeiras 20 obras');
    console.log('');

    const answer = await askQuestion('  ➤ Sua escolha: ');

    if (answer.toLowerCase() === 'all' || answer.toLowerCase() === 'todas') {
      selectedSlugs = allWorks.map(w => w.slug);
    } else if (answer.includes('-') && !answer.includes(',')) {
      // Intervalo: "1-10"
      const [start, end] = answer.split('-').map(n => parseInt(n.trim()));
      if (!isNaN(start) && !isNaN(end)) {
        selectedSlugs = allWorks.slice(start - 1, end).map(w => w.slug);
      }
    } else if (answer.includes(',')) {
      // Lista: "1,3,5,7"
      const nums = answer.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n) && n > 0 && n <= allWorks.length);
      selectedSlugs = nums.map(n => allWorks[n - 1].slug);
    } else {
      const n = parseInt(answer);
      if (!isNaN(n) && n > 0) {
        if (n <= allWorks.length) {
          // Se n é razoável como "primeiras N obras"
          selectedSlugs = allWorks.slice(0, n).map(w => w.slug);
        }
      }
    }

    if (!selectedSlugs || selectedSlugs.length === 0) {
      console.log('❌ Nenhuma obra selecionada. Saindo.');
      await client.disconnect();
      return;
    }

    console.log(`\n✅ ${selectedSlugs.length} obras selecionadas para download.\n`);
  }

  // Limitar se --max
  if (maxWorks > 0 && selectedSlugs.length > maxWorks) {
    selectedSlugs = selectedSlugs.slice(0, maxWorks);
    console.log(`  (Limitado a ${maxWorks} obras pelo --max)\n`);
  }

  // Salvar seleção
  state.selectedTargets = selectedSlugs;
  state.lastRun = new Date().toISOString();
  await saveState(state);

  // ═══════════════════════════════════════════════════════
  // FASE 3: DOWNLOAD
  // ═══════════════════════════════════════════════════════
  const selectedWorks = allWorks.filter(w => selectedSlugs.includes(w.slug));
  let totalNewChapters = 0;
  let worksDone = 0;

  for (const work of selectedWorks) {
    worksDone++;
    console.log(`\n╔══════════════════════════════════════════════════════════╗`);
    console.log(`║ 📖 [${worksDone}/${selectedWorks.length}] ${work.title.substring(0, 48).padEnd(48)} ║`);
    console.log(`╚══════════════════════════════════════════════════════════╝`);

    try {
      const n = await downloadWorkChapters(client, work.title, work.slug, work.files, catalog, work.channelId);
      totalNewChapters += n;
    } catch (err) {
      console.error(`  ❌ Erro na obra ${work.title}: ${err.message}`);
      // Reconectar e continuar
      try { await client.connect(); } catch {}
    }
  }

  // Finalização
  await publishProgress({
    status: 'concluido',
    totalNewChapters,
    message: `Extração concluída! ${totalNewChapters} capítulos baixados de ${selectedWorks.length} obras.`,
  });

  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  🎉 EXTRAÇÃO CONCLUÍDA!                                ║`);
  console.log(`║  📦 ${String(totalNewChapters).padStart(4)} novos capítulos baixados                    ║`);
  console.log(`║  📚 ${String(selectedWorks.length).padStart(4)} obras processadas                          ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);

  try { await client.disconnect(); } catch {}
}

main().catch(err => {
  console.error('\n❌ Erro fatal:', err.message || err);
  process.exit(1);
});
