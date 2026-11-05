import { Api } from 'telegram';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import {
  canonicalSlug,
  findExistingMangaDir,
  isChapterAlreadyDownloaded,
  mergeLibraryDuplicates,
  cleanCatalogDuplicates,
} from './deduplicator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LIBRARY_DIR = path.join(__dirname, '..', 'library');
const CATALOG_DIR = path.join(__dirname, '..', 'public', 'catalog');
const TEMP_DIR = path.join(__dirname, '.temp');
const PROGRESS_FILE = path.join(__dirname, 'download-progress.json');
const PUBLIC_PROGRESS_FILE = path.join(__dirname, '..', 'public', 'download-progress.json');
const BUNKER_STATE_FILE = path.join(__dirname, 'bunker-state.json');
const BUNKER_CACHE_FILE = path.join(__dirname, 'bunker-works-cache.json');
const BUNKER_CATALOG_CHANNEL = '-1002333204677';

function padNum(n, d = 3) {
  return String(Math.round(n)).padStart(d, '0');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function renderProgressBar(percent, length = 16) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const filled = Math.round((p / 100) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

// ═══════════════════════════════════════════════════════
// ESTADO E PERSISTÊNCIA
// ═══════════════════════════════════════════════════════
export function loadBunkerState() {
  try {
    if (fsSync.existsSync(BUNKER_STATE_FILE)) {
      return JSON.parse(fsSync.readFileSync(BUNKER_STATE_FILE, 'utf-8'));
    }
  } catch {}
  return { joinedChannels: {}, completedChannels: [], queue: [] };
}

export function saveBunkerState(state) {
  try {
    fsSync.writeFileSync(BUNKER_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar bunker-state.json:', err.message);
  }
}

// ═══════════════════════════════════════════════════════
// PUBLICAÇÃO DE PROGRESSO
// ═══════════════════════════════════════════════════════
let lastProgressWrite = 0;
export async function publishProgress(data) {
  const now = Date.now();
  if (now - lastProgressWrite < 400 && data.status === 'baixando') return;
  lastProgressWrite = now;
  const payload = JSON.stringify({ ...data, timestamp: new Date().toISOString() }, null, 2);
  try {
    await fs.writeFile(PROGRESS_FILE, payload, 'utf-8');
    await fs.writeFile(PUBLIC_PROGRESS_FILE, payload, 'utf-8');
  } catch {}
}

export function getCurrentProgress() {
  try {
    if (fsSync.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fsSync.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch {}
  return null;
}

// ═══════════════════════════════════════════════════════
// RESUMO DA BIBLIOTECA LOCAL
// ═══════════════════════════════════════════════════════
export function getLocalLibrarySummary() {
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

export function countDownloadedChapters(slug) {
  const mangaDir = findExistingMangaDir(LIBRARY_DIR, slug);
  if (!fsSync.existsSync(mangaDir)) return 0;
  try {
    const caps = fsSync
      .readdirSync(mangaDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.toLowerCase().startsWith('capitulo'));
    return caps.length;
  } catch {
    return 0;
  }
}

// ═══════════════════════════════════════════════════════
// CARREGAR CATÁLOGO COMPLETO DO BUNKER
// ═══════════════════════════════════════════════════════
export async function loadBunkerCatalog(client, forceRefresh = false) {
  let cached = [];
  try {
    if (!forceRefresh && fsSync.existsSync(BUNKER_CACHE_FILE)) {
      cached = JSON.parse(fsSync.readFileSync(BUNKER_CACHE_FILE, 'utf-8'));
    }
  } catch {}

  // Se já temos cache válido, apenas atualizamos a contagem de capítulos baixados
  if (cached && cached.length >= 100 && !forceRefresh) {
    for (const w of cached) {
      w.downloadedChapters = countDownloadedChapters(w.slug);
      if (w.totalChapters && w.downloadedChapters >= w.totalChapters) {
        w.isCompleted = true;
      }
    }
    return cached;
  }

  // Buscar mensagens do canal do Bunker
  const entity = await client.getEntity(BUNKER_CATALOG_CHANNEL);
  let allMsgs = [];
  let offsetId = 0;
  while (true) {
    const batch = await client.getMessages(entity, { limit: 100, offsetId });
    if (!batch || batch.length === 0) break;
    allMsgs.push(...batch);
    offsetId = batch[batch.length - 1].id;
    if (batch.length < 100) break;
  }

  // Carregar catálogo existente para sincronizar contagem de caps
  let catalogData = { mangas: [] };
  try {
    const p = path.join(CATALOG_DIR, 'catalog.json');
    if (fsSync.existsSync(p)) {
      catalogData = JSON.parse(fsSync.readFileSync(p, 'utf-8'));
    }
  } catch {}

  const state = loadBunkerState();
  const joinedMap = state.joinedChannels || {};
  const completedSet = new Set(state.completedChannels || []);

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
    if (title.length < 2) continue;

    const slug = canonicalSlug(title);
    const downloadedCaps = countDownloadedChapters(slug);

    // Contagem via catalog.json
    let catalogCaps = 0;
    const catItem = catalogData.mangas.find((m) => canonicalSlug(m.id || m.title) === slug);
    if (catItem && catItem.chapters && catItem.chapters.length > 0) {
      catalogCaps = catItem.chapters.length;
    }

    // Menção direta no texto do post
    let textCaps = 0;
    const m = text.match(/cap[ií]tulos?:\s*(\d+)/i) || text.match(/total de cap[ií]tulos?:\s*(\d+)/i);
    if (m) textCaps = parseInt(m[1]);

    // Verificar se já temos contagem no cache anterior
    let prevTotal = null;
    if (cached && cached.length > 0) {
      const pWork = cached.find((cw) => cw.link === link || cw.slug === slug);
      if (pWork && pWork.totalChapters) prevTotal = pWork.totalChapters;
    }

    const totalChapters = prevTotal || catalogCaps || textCaps || (downloadedCaps > 0 ? downloadedCaps : null);
    const isCompleted = completedSet.has(link) || (totalChapters && downloadedCaps >= totalChapters);

    works.push({
      id: msg.id,
      title,
      slug,
      link,
      channelId: joinedMap[link] || null,
      totalChapters,
      downloadedChapters: downloadedCaps,
      isCompleted: Boolean(isCompleted),
    });
  }

  // Deduplicar por link
  const seen = new Set();
  const uniqueWorks = works.filter((w) => {
    if (seen.has(w.link)) return false;
    seen.add(w.link);
    return true;
  });

  // Atribuir índices 1..N
  uniqueWorks.forEach((w, i) => {
    w.index = i + 1;
  });

  try {
    fsSync.writeFileSync(BUNKER_CACHE_FILE, JSON.stringify(uniqueWorks, null, 2), 'utf-8');
  } catch (err) {
    console.error('Aviso ao salvar cache de obras:', err.message);
  }

  return uniqueWorks;
}

// ═══════════════════════════════════════════════════════
// INSPECIONAR CAPÍTULOS DE UM CANAL
// ═══════════════════════════════════════════════════════
export async function inspectWorkChapters(client, work) {
  const state = loadBunkerState();
  const joinedMap = state.joinedChannels || {};

  let entity = null;
  if (work.channelId || joinedMap[work.link]) {
    try {
      entity = await client.getEntity(work.channelId || joinedMap[work.link]);
    } catch {}
  }

  if (!entity) {
    // Tentar acessar ou entrar
    try {
      const hash = work.link.replace(/.*\/\+/, '').replace(/.*\+/, '');
      if (hash && work.link.includes('/+')) {
        const check = await client.invoke(new Api.messages.CheckChatInvite({ hash }));
        if (check?.chat) {
          entity = check.chat;
        } else {
          const joined = await client.invoke(new Api.messages.ImportChatInvite({ hash }));
          if (joined?.chats?.[0]) entity = joined.chats[0];
        }
      } else {
        const username = work.link.replace(/.*t\.me\//, '').replace(/[?#].*/, '');
        if (username) {
          entity = await client.getEntity(username);
        }
      }
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('USER_ALREADY_PARTICIPANT')) {
        // Tentar pegar pelo username se disponível
        try {
          const username = work.link.replace(/.*t\.me\//, '').replace(/[?#].*/, '');
          if (username && !work.link.includes('/+')) entity = await client.getEntity(username);
        } catch {}
      }
    }
  }

  if (!entity) return null;

  // Salvar canal no estado
  if (entity.id) {
    const fullId = '-100' + entity.id.toString();
    work.channelId = fullId;
    state.joinedChannels = state.joinedChannels || {};
    state.joinedChannels[work.link] = fullId;
    saveBunkerState(state);
  }

  // Contar mensagens CBZ
  let cbzCount = 0;
  let offsetId = 0;
  while (true) {
    const batch = await client.getMessages(entity, { limit: 100, offsetId });
    if (!batch || batch.length === 0) break;
    for (const m of batch) {
      if (m.media?.document) {
        const attr = m.media.document.attributes?.find((a) => a.fileName);
        if (attr && attr.fileName?.match(/\.(cbz|zip)$/i)) cbzCount++;
      }
    }
    offsetId = batch[batch.length - 1].id;
    if (batch.length < 100) break;
  }

  if (cbzCount > 0) {
    work.totalChapters = cbzCount;
    // Atualizar no cache de arquivo
    try {
      if (fsSync.existsSync(BUNKER_CACHE_FILE)) {
        const cached = JSON.parse(fsSync.readFileSync(BUNKER_CACHE_FILE, 'utf-8'));
        const target = cached.find((w) => w.link === work.link || w.slug === work.slug);
        if (target) {
          target.totalChapters = cbzCount;
          target.channelId = work.channelId;
          fsSync.writeFileSync(BUNKER_CACHE_FILE, JSON.stringify(cached, null, 2), 'utf-8');
        }
      }
    } catch {}
  }

  return cbzCount;
}

// ═══════════════════════════════════════════════════════
// ANALISADOR INTELIGENTE DE SELEÇÃO DE OBRAS (/baixar ...)
// ═══════════════════════════════════════════════════════
export function parseDownloadSelection(rawText, works) {
  const clean = rawText
    .replace(/^\/baixar\s*/i, '')
    .trim()
    .toLowerCase();

  if (!clean) {
    return { error: 'empty', message: 'Nenhum parâmetro informado.' };
  }

  const pendingWorks = works.filter((w) => !w.isCompleted);

  // 1. Todas as obras: /baixar todas, /baixar tudo, /baixar all
  if (clean === 'todas' || clean === 'tudo' || clean === 'all') {
    return {
      mode: 'all',
      selectedWorks: pendingWorks,
      summary: `Todas as ${pendingWorks.length} obras pendentes selecionadas.`,
    };
  }

  // 2. Intervalo numérico: /baixar 1-10, /baixar 1 a 10, /baixar 5 ate 15
  const rangeMatch = clean.match(/^(\d+)\s*(?:-|a|ate|to)\s*(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1]);
    const end = parseInt(rangeMatch[2]);
    const min = Math.min(start, end);
    const max = Math.max(start, end);

    const selected = works.filter((w) => w.index >= min && w.index <= max);
    return {
      mode: 'range',
      selectedWorks: selected,
      summary: `Obras do número #${min} até #${max} (${selected.length} obras selecionadas).`,
    };
  }

  // 3. Obra específica explícita: /baixar obra 5, /baixar #5, /baixar num 5
  const singleExplicitMatch = clean.match(/^(?:obra|#|num|no|numero)\s*(\d+)$/);
  if (singleExplicitMatch) {
    const num = parseInt(singleExplicitMatch[1]);
    const found = works.find((w) => w.index === num);
    if (found) {
      return {
        mode: 'single',
        selectedWorks: [found],
        summary: `Obra #${found.index}: "${found.title}".`,
      };
    }
  }

  // 4. Quantidade de obras com palavra chave: /baixar 5 obras, /baixar prox 5, /baixar proximas 10 obras
  const qtyWordsMatch = clean.match(/^(?:prox|proximas?|qtd)?\s*(\d+)\s*(?:obras?|mangas?)?$/);

  // 5. Se for número puro com palavra 'obra' ou '#': /baixar #5, /baixar obra 5
  // (já tratado na regra 3)

  // 6. Se for apenas número puro: /baixar 5
  const plainNumMatch = clean.match(/^(\d+)$/);
  if (plainNumMatch) {
    const n = parseInt(plainNumMatch[1]);
    const workAtIndex = works.find((w) => w.index === n);

    // Se n === 1 e a obra #1 existe:
    if (n === 1 && workAtIndex) {
      return {
        mode: 'single',
        selectedWorks: [workAtIndex],
        summary: `Obra #1: "${workAtIndex.title}".`,
      };
    }

    // Se n > 1: pega as próximas n pendentes
    const slice = pendingWorks.slice(0, n);
    return {
      mode: 'quantity',
      quantity: n,
      targetSingleWork: workAtIndex,
      selectedWorks: slice,
      summary: `Próximas ${slice.length} obras pendentes adicionadas à fila.`,
    };
  }

  // 6. Busca por nome da obra: /baixar solo leveling, /baixar trashero
  const foundByName = works.filter((w) => {
    const titleMatch = w.title.toLowerCase().includes(clean);
    const slugMatch = w.slug.includes(canonicalSlug(clean));
    return titleMatch || slugMatch;
  });

  if (foundByName.length > 0) {
    return {
      mode: 'search',
      selectedWorks: foundByName.slice(0, 5), // até 5 se der match múltiplo
      summary: `${foundByName.length} obra(s) correspondente(s) encontrada(s).`,
    };
  }

  return { error: 'not_found', message: `Nenhuma obra encontrada para "${rawText}".` };
}

// ═══════════════════════════════════════════════════════
// DOWNLOAD E EXTRAÇÃO DE CBZ
// ═══════════════════════════════════════════════════════
export async function extractCbz(cbzPath, destFolder) {
  try {
    const buf = await fs.readFile(cbzPath);
    const zip = await JSZip.loadAsync(buf);
    await fs.mkdir(destFolder, { recursive: true });
    const imgs = Object.keys(zip.files)
      .filter((n) => !zip.files[n].dir && /\.(jpg|jpeg|png|webp|gif)$/i.test(n))
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
    console.error(`Erro ao extrair CBZ: ${err.message}`);
    return [];
  }
}

async function downloadFileWithProgress(
  client,
  media,
  fileSize,
  destFile,
  mangaTitle,
  chapterName,
  idx,
  total,
  entity,
  msgId
) {
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
            const bar = renderProgressBar(pct, 14);
            process.stdout.write(`\r  [${bar}] ${pct}% (${dlMb}/${sizeMb}MB) | ${chapterName} [${idx}/${total}]`);
            await publishProgress({
              status: 'baixando',
              currentManga: mangaTitle,
              chapter: chapterName,
              chapterProgress: pct,
              downloadedMb: dlMb,
              totalMb: sizeMb,
              progress: `${idx}/${total}`,
              mangaPercent: Math.round((idx / total) * 100),
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
        console.log(`\n⏳ FloodWait: aguardando ${sec}s...`);
        await sleep((sec + 3) * 1000);
        continue;
      }
      if (msg.includes('FILE_REFERENCE_EXPIRED')) {
        try {
          if (entity && msgId) {
            const fresh = await client.getMessages(entity, { ids: [msgId] });
            if (fresh?.[0]?.media) {
              currentMedia = fresh[0].media;
              await sleep(1000);
              continue;
            }
          }
        } catch {}
      }
      if (attempt === 5) {
        await fs.unlink(destFile).catch(() => {});
        return false;
      }
      await sleep(3000);
    }
  }
  return false;
}

// ═══════════════════════════════════════════════════════
// DOWNLOAD WORK FROM CHANNEL COM ANTI-DUPLICIDADE
// ═══════════════════════════════════════════════════════
export async function downloadWorkChapters(client, work, onChapterDone = null) {
  await fs.mkdir(LIBRARY_DIR, { recursive: true });
  await fs.mkdir(CATALOG_DIR, { recursive: true });
  await fs.mkdir(TEMP_DIR, { recursive: true });

  const cleanSlug = canonicalSlug(work.slug || work.title);
  const mangaDir = findExistingMangaDir(LIBRARY_DIR, cleanSlug);
  await fs.mkdir(mangaDir, { recursive: true });

  const state = loadBunkerState();
  const joinedMap = state.joinedChannels || {};

  // 1. Obter entidade do canal
  let entity = null;
  if (work.channelId || joinedMap[work.link]) {
    try {
      entity = await client.getEntity(work.channelId || joinedMap[work.link]);
    } catch {}
  }

  if (!entity) {
    try {
      const hash = work.link.replace(/.*\/\+/, '').replace(/.*\+/, '');
      if (hash && work.link.includes('/+')) {
        const res = await client.invoke(new Api.messages.ImportChatInvite({ hash }));
        entity = res?.chats?.[0] || null;
      } else {
        const username = work.link.replace(/.*t\.me\//, '').replace(/[?#].*/, '');
        if (username) {
          entity = await client.getEntity(username);
          await client.invoke(new Api.channels.JoinChannel({ channel: entity }));
        }
      }
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('USER_ALREADY_PARTICIPANT')) {
        try {
          const username = work.link.replace(/.*t\.me\//, '').replace(/[?#].*/, '');
          if (username && !work.link.includes('/+')) entity = await client.getEntity(username);
        } catch {}
      }
    }
  }

  if (!entity) {
    console.error(`Não foi possível acessar canal de ${work.title}`);
    return { success: false, reason: 'channel_access_failed' };
  }

  if (entity.id) {
    const fullId = '-100' + entity.id.toString();
    work.channelId = fullId;
    state.joinedChannels[work.link] = fullId;
    saveBunkerState(state);
  }

  // 2. Buscar todas as mensagens com CBZ
  let allMsgs = [];
  let offsetId = 0;
  while (true) {
    const batch = await client.getMessages(entity, { limit: 100, offsetId });
    if (!batch || batch.length === 0) break;
    allMsgs.push(...batch);
    offsetId = batch[batch.length - 1].id;
    if (batch.length < 100) break;
  }

  const chapters = [];
  for (const msg of allMsgs) {
    if (!msg.media?.document) continue;
    const attr = msg.media.document.attributes?.find((a) => a.fileName);
    const fn = attr?.fileName || '';
    if (!fn.match(/\.(cbz|zip)$/i)) continue;
    const numMatch = fn.match(/(\d+(?:\.\d+)?)/);
    const num = numMatch ? parseFloat(numMatch[1]) : chapters.length + 1;
    chapters.push({
      fileName: fn,
      media: msg.media,
      size: Number(msg.media.document.size || 0),
      chapterNum: num,
      id: msg.id,
    });
  }

  chapters.sort((a, b) => a.chapterNum - b.chapterNum);
  work.totalChapters = chapters.length;

  if (chapters.length === 0) {
    return { success: true, downloaded: 0, total: 0, reason: 'no_cbz' };
  }

  // 3. Carregar catálogo para atualizar
  let catalog = { mangas: [] };
  const catPath = path.join(CATALOG_DIR, 'catalog.json');
  try {
    if (fsSync.existsSync(catPath)) {
      catalog = JSON.parse(fsSync.readFileSync(catPath, 'utf-8'));
    }
  } catch {}

  let catManga = catalog.mangas.find((m) => canonicalSlug(m.id || m.title) === cleanSlug);
  if (!catManga) {
    catManga = { id: cleanSlug, title: work.title, chapters: [] };
    catalog.mangas.push(catManga);
  }
  if (!catManga.chapters) catManga.chapters = [];

  let newlyDownloaded = 0;

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const folderName = `Capitulo ${padNum(ch.chapterNum)}`;
    const chapterFolder = path.join(mangaDir, folderName);

    // Verificação estrita anti-duplicidade
    if (isChapterAlreadyDownloaded(mangaDir, ch.chapterNum)) {
      let chInCat = catManga.chapters.find((c) => c.number === ch.chapterNum);
      if (!chInCat) {
        try {
          const pgs = fsSync.readdirSync(chapterFolder).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));
          catManga.chapters.push({
            id: `ch-${cleanSlug}-${ch.chapterNum}`,
            number: ch.chapterNum,
            title: ch.fileName.replace(/\.(cbz|zip)$/i, ''),
            folderName,
            pageCount: pgs.length,
            pages: pgs,
          });
        } catch {}
      }
      continue;
    }

    const tempFile = path.join(TEMP_DIR, `${cleanSlug}_ch${padNum(ch.chapterNum)}.cbz`);
    const ok = await downloadFileWithProgress(
      client,
      ch.media,
      ch.size,
      tempFile,
      work.title,
      folderName,
      i + 1,
      chapters.length,
      entity,
      ch.id
    );

    if (ok) {
      const pages = await extractCbz(tempFile, chapterFolder);
      if (pages.length > 0) {
        newlyDownloaded++;
        let chInCat = catManga.chapters.find((c) => c.number === ch.chapterNum);
        if (!chInCat) {
          chInCat = {
            id: `ch-${cleanSlug}-${ch.chapterNum}`,
            number: ch.chapterNum,
            title: ch.fileName.replace(/\.(cbz|zip)$/i, ''),
            folderName,
          };
          catManga.chapters.push(chInCat);
        }
        chInCat.pageCount = pages.length;
        chInCat.pages = pages;

        await fs.writeFile(catPath, JSON.stringify(catalog, null, 2), 'utf-8');

        if (typeof onChapterDone === 'function') {
          await onChapterDone({
            work,
            chapterNum: ch.chapterNum,
            pagesCount: pages.length,
            current: i + 1,
            total: chapters.length,
          });
        }
      }
    }
    await sleep(250);
  }

  work.downloadedChapters = countDownloadedChapters(cleanSlug);
  if (work.downloadedChapters >= chapters.length) {
    work.isCompleted = true;
    state.completedChannels = state.completedChannels || [];
    if (!state.completedChannels.includes(work.link)) {
      state.completedChannels.push(work.link);
    }
    saveBunkerState(state);
  }

  return { success: true, downloaded: newlyDownloaded, total: chapters.length };
}

// ═══════════════════════════════════════════════════════
// GERENCIADOR DE FILA DE DOWNLOADS (QUEUE MANAGER)
// ═══════════════════════════════════════════════════════
export class DownloadQueueManager {
  constructor(client, notifier = null) {
    this.client = client;
    this.notifier = notifier; // função async (msg) => client.sendMessage('me', ...)
    this.queue = [];
    this.activeWork = null;
    this.isRunning = false;
    this.isPaused = false;
  }

  // Enfileirar obras
  enqueue(works) {
    const added = [];
    for (const w of works) {
      const exists = this.queue.some((item) => item.link === w.link || item.slug === w.slug);
      const isCurrent = this.activeWork && (this.activeWork.link === w.link || this.activeWork.slug === w.slug);
      if (!exists && !isCurrent) {
        this.queue.push(w);
        added.push(w);
      }
    }
    this.persistQueue();
    if (!this.isRunning && !this.isPaused && this.queue.length > 0) {
      this.startProcessing();
    }
    return added;
  }

  // Persistir fila em disco
  persistQueue() {
    const state = loadBunkerState();
    state.queue = this.queue.map((w) => ({
      index: w.index,
      title: w.title,
      slug: w.slug,
      link: w.link,
      totalChapters: w.totalChapters,
      downloadedChapters: w.downloadedChapters,
    }));
    saveBunkerState(state);
  }

  // Carregar fila pendente salva
  restoreQueue() {
    const state = loadBunkerState();
    if (Array.isArray(state.queue) && state.queue.length > 0) {
      this.queue = [...state.queue];
    }
  }

  // Parar/Pausar fila
  stopQueue() {
    const count = this.queue.length;
    this.queue = [];
    this.isPaused = true;
    this.persistQueue();
    return count;
  }

  // Obter status da fila
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeWork: this.activeWork,
      queueLength: this.queue.length,
      queue: this.queue,
    };
  }

  // Loop de processamento
  async startProcessing() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;

    try {
      while (this.queue.length > 0 && !this.isPaused) {
        const currentWork = this.queue.shift();
        this.activeWork = currentWork;
        this.persistQueue();

        if (this.notifier) {
          const capInfo = currentWork.totalChapters ? ` (*${currentWork.totalChapters}* capítulos)` : '';
          await this.notifier(
            `🚀 *Iniciando Download da Fila!*\n\n` +
              `📖 *Obra:* \`${currentWork.title}\`${capInfo}\n` +
              `📦 *Posição:* Restam *${this.queue.length}* obra(s) na fila.\n` +
              `Acompanhe com */status*!`
          );
        }

        const res = await downloadWorkChapters(this.client, currentWork, async (event) => {
          // Callback a cada 10 capítulos ou no último
          if (event.current % 10 === 0 || event.current === event.total) {
            if (this.notifier && event.current % 25 === 0) {
              await this.notifier(
                `📑 *${currentWork.title}* — Progresso:\n` +
                  `Capítulo *${event.current}/${event.total}* concluído! ✅`
              );
            }
          }
        });

        if (this.notifier) {
          if (res.success) {
            await this.notifier(
              `✅ *Obra Concluída:*\n` +
                `📖 *${currentWork.title}*\n` +
                `• *${res.downloaded}* novos capítulos baixados (Total: ${res.total})\n` +
                (this.queue.length > 0
                  ? `➡️ Indo para a próxima obra da fila...`
                  : `🎉 *Todas as obras da fila foram finalizadas!*`)
            );
          } else {
            await this.notifier(
              `⚠️ Não foi possível baixar *${currentWork.title}* (${res.reason || 'erro'}). Pulando para a próxima.`
            );
          }
        }

        this.activeWork = null;
        this.persistQueue();
        await sleep(1500);
      }

      await publishProgress({
        status: 'concluido',
        message: 'Fila de downloads concluída.',
      });
    } catch (err) {
      console.error('Erro no loop da fila de download:', err.message);
    } finally {
      this.isRunning = false;
      this.activeWork = null;
      this.persistQueue();
    }
  }
}
