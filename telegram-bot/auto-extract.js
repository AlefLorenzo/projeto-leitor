import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import JSZip from 'jszip';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_ID = parseInt(process.env.TELEGRAM_API_ID || '0');
const API_HASH = process.env.TELEGRAM_API_HASH || '';
const SESSION = process.env.TELEGRAM_SESSION || '';

// Pasta raiz organizada
const LIBRARY_DIR  = path.join(__dirname, '..', 'library');   // biblioteca principal
const CATALOG_DIR  = path.join(__dirname, '..', 'public', 'catalog');
const STATUS_FILE  = path.join(__dirname, 'extraction-status.json');

/*
  Estrutura gerada:
  library/
  └── <titulo-da-obra>/
      ├── cover.jpg
      ├── info.json          (metadados da obra)
      ├── Capitulo 001/
      │   ├── 001.jpg
      │   └── ...
      ├── Capitulo 002/
      │   └── ...
      └── ...

  public/catalog/
  └── <titulo-da-obra>/
      └── cover.jpg          (cópia da capa para o app web)
*/

// --- Canais de obra única (1 obra por canal) ---
const DEDICATED_CHANNELS = [
  { id: '-1003340387097', defaultTitle: 'Pick Me Up!',                        type: 'manhwa', genres: ['Ação','Fantasia','Sistema'] },
  { id: '-1003429556677', defaultTitle: 'Player of a Fallen Noble Family',    type: 'manhwa', genres: ['Ação','Fantasia','Nobreza'] },
  { id: '-1003846994703', defaultTitle: 'I Became the Rogue First Prince',    type: 'manhwa', genres: ['Ação','Fantasia','Príncipe'] },
  { id: '-1003589566501', defaultTitle: 'Unrivaled Spear Demon',              type: 'manhwa', genres: ['Ação','Artes Marciais'] },
  { id: '-1002572469547', defaultTitle: "Swordmaster's Youngest Son",         type: 'manhwa', genres: ['Ação','Fantasia','Espada'] },
  { id: '-1003591071501', defaultTitle: 'Rengoku no Ashe',                    type: 'manga',  genres: ['Ação','Sobrenatural'] },
  { id: '-1002576448823', defaultTitle: 'Gigantomachia',                      type: 'manga',  genres: ['Ação','Ficção Científica'] },
];

// --- Canais índice (múltiplas obras com links) ---
const INDEX_CHANNELS = [
  { id: '-1002333204677', name: 'Bunker Mangás - Brasil' },
  { id: '-1001834602691', name: 'Mangás Brasil - QG BALTIGO' },
];

// ─── Utilitários ────────────────────────────────────────────────────────────

function sanitize(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-').replace(/-+/g, '-')
    .trim().slice(0, 80);
}

function padNum(n, digits = 3) {
  return String(n).padStart(digits, '0');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function downloadWithRetry(client, media, outputFile, retries = 3, label = '') {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await client.downloadMedia(media, { outputFile });
      return true;
    } catch (err) {
      if (attempt === retries) {
        console.error(`     ❌ Falha permanente em ${label || outputFile}: ${err.message}`);
        return false;
      }
      console.log(`     ⚠️  ${label} — tentativa ${attempt}/${retries} falhou. Aguardando 5s...`);
      await sleep(5000);
    }
  }
  return false;
}

// Paginação completa de mensagens (sem limite artificial)
async function getAllMessages(client, entity) {
  const all = [];
  let offsetId = 0;
  const BATCH = 100;
  while (true) {
    try {
      const batch = await client.getMessages(entity, { limit: BATCH, offsetId });
      if (!batch || batch.length === 0) break;
      all.push(...batch);
      offsetId = batch[batch.length - 1].id;
      if (batch.length < BATCH) break;
      await sleep(800);
    } catch (err) {
      console.error(`  ⚠️  Erro paginando (offsetId=${offsetId}): ${err.message}`);
      await sleep(3000);
      break;
    }
  }
  return all;
}

// Extrai e organiza um .cbz em subpasta numerada
async function extractCbzToFolder(cbzPath, chapterFolder, chapterLabel) {
  try {
    const zipBuffer = await fs.readFile(cbzPath);
    const zip = await JSZip.loadAsync(zipBuffer);
    await fs.mkdir(chapterFolder, { recursive: true });

    // Pegar apenas arquivos de imagem, sem dirs, ordenados
    const imgFiles = Object.keys(zip.files)
      .filter(n => !zip.files[n].dir && n.match(/\.(jpg|jpeg|png|webp|gif)$/i))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (imgFiles.length === 0) {
      console.log(`     ⚠️  Nenhuma imagem em ${path.basename(cbzPath)}`);
      return [];
    }

    const pageFiles = [];
    for (let i = 0; i < imgFiles.length; i++) {
      const ext   = path.extname(imgFiles[i]).toLowerCase() || '.jpg';
      const dest  = path.join(chapterFolder, `${padNum(i + 1)}${ext}`);
      const data  = await zip.files[imgFiles[i]].async('nodebuffer');
      await fs.writeFile(dest, data);
      pageFiles.push(`${padNum(i + 1)}${ext}`);
    }

    // Remover o .cbz original após extração bem-sucedida
    await fs.unlink(cbzPath).catch(() => {});
    console.log(`     📂 ${chapterLabel}: ${imgFiles.length} páginas extraídas`);
    return pageFiles;
  } catch (err) {
    console.error(`     ❌ Erro ao extrair ${path.basename(cbzPath)}: ${err.message}`);
    return [];
  }
}

async function loadCatalog() {
  try {
    return JSON.parse(await fs.readFile(path.join(CATALOG_DIR, 'catalog.json'), 'utf-8'));
  } catch {
    return { mangas: [], lastUpdated: new Date().toISOString() };
  }
}

async function saveCatalog(catalog) {
  catalog.lastUpdated = new Date().toISOString();
  await fs.writeFile(path.join(CATALOG_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2), 'utf-8');
}

async function saveInfo(mangaDir, info) {
  await fs.writeFile(path.join(mangaDir, 'info.json'), JSON.stringify(info, null, 2), 'utf-8');
}

async function updateStatus(data) {
  try {
    await fs.writeFile(STATUS_FILE, JSON.stringify({ ...data, timestamp: new Date().toISOString() }, null, 2), 'utf-8');
  } catch {}
}

// ─── FASE 1: Canal dedicado (1 obra) ─────────────────────────────────────────

async function extractDedicatedChannel(client, item, catalog) {
  console.log(`\n🔍 ${item.defaultTitle} (${item.id})`);

  let entity;
  try { entity = await client.getEntity(item.id); }
  catch (err) { console.error(`  ❌ Canal inacessível: ${err.message}`); return; }

  const title  = entity.title || item.defaultTitle;
  const mangaId = sanitize(title);

  // Pastas
  const mangaDir  = path.join(LIBRARY_DIR, mangaId);
  const publicDir = path.join(CATALOG_DIR, mangaId);
  await fs.mkdir(mangaDir,  { recursive: true });
  await fs.mkdir(publicDir, { recursive: true });

  // Buscar TODAS as mensagens
  console.log('  📡 Buscando mensagens...');
  const all = await getAllMessages(client, entity);
  console.log(`  📬 ${all.length} mensagens`);

  const chapterFiles = [];
  let coverPhotoMsg = null;

  for (const msg of all) {
    if (!coverPhotoMsg && msg.media?.photo) coverPhotoMsg = msg;
    if (msg.media?.document) {
      const attr     = msg.media.document.attributes?.find(a => a.fileName);
      const fileName = attr?.fileName || '';
      if (fileName.match(/\.(cbz|zip)$/i)) {
        chapterFiles.push({ id: msg.id, fileName, media: msg.media, size: Number(msg.media.document.size) });
      }
    }
  }

  // Ordenar numericamente
  chapterFiles.sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true }));
  console.log(`  📦 ${chapterFiles.length} capítulos`);

  // Baixar capa oficial
  const coverSrc  = path.join(mangaDir,  'cover.jpg');
  const coverPub  = path.join(publicDir, 'cover.jpg');
  if (!fsSync.existsSync(coverSrc) && coverPhotoMsg) {
    console.log('  🖼️  Baixando capa...');
    await downloadWithRetry(client, coverPhotoMsg.media, coverSrc, 3, 'capa');
  }
  // Copiar para pasta pública (catalog)
  if (fsSync.existsSync(coverSrc) && !fsSync.existsSync(coverPub)) {
    await fs.copyFile(coverSrc, coverPub);
  }

  // Montar lista de capítulos para catálogo e info.json
  const chaptersList = chapterFiles.map((ch, idx) => {
    const numMatch = ch.fileName.match(/(\d+(?:\.\d+)?)/);
    const num = numMatch ? parseFloat(numMatch[1]) : idx + 1;
    const folderName = `Capitulo ${padNum(Math.round(num))}`;
    return {
      id:          `ch-${ch.id}`,
      number:      num,
      title:       ch.fileName.replace(/\.(cbz|zip)$/i, ''),
      folderName,
      telegramMsgId: ch.id,
      channelId:   item.id,
      size:        ch.size,
      pageCount:   0,
      pages:       [],
    };
  });

  // Salvar info.json
  const infoData = {
    id:          mangaId,
    title,
    type:        item.type,
    genres:      item.genres,
    status:      'reading',
    source:      'telegram',
    channelId:   item.id,
    coverUrl:    `/catalog/${mangaId}/cover.jpg`,
    totalChapters: chaptersList.length,
    chapters:    chaptersList,
    addedAt:     new Date().toISOString(),
  };
  await saveInfo(mangaDir, infoData);

  // Atualizar catálogo global
  const existingIdx = catalog.mangas.findIndex(m => m.id === mangaId);
  if (existingIdx >= 0) {
    catalog.mangas[existingIdx] = { ...catalog.mangas[existingIdx], ...infoData };
  } else {
    catalog.mangas.push(infoData);
  }
  await saveCatalog(catalog);
  console.log(`  ✅ "${title}" catalogada com ${chaptersList.length} capítulos!`);

  // Baixar e extrair os 3 primeiros capítulos imediatamente
  const toDownload = chapterFiles.slice(0, 3);
  console.log(`  ⬇️  Baixando e extraindo os primeiros ${toDownload.length} capítulos...`);

  for (let i = 0; i < toDownload.length; i++) {
    const ch          = toDownload[i];
    const chInfo      = chaptersList[i];
    const chapterFolder = path.join(mangaDir, chInfo.folderName);
    const tmpCbz      = path.join(mangaDir, ch.fileName);

    // Verificar se já foi extraído
    if (fsSync.existsSync(chapterFolder)) {
      const existing = await fs.readdir(chapterFolder).catch(() => []);
      if (existing.length > 0) {
        console.log(`     ✓ Já extraído: ${chInfo.folderName}`);
        continue;
      }
    }

    console.log(`     [${i + 1}/${toDownload.length}] Baixando ${ch.fileName}...`);
    const ok = await downloadWithRetry(client, ch.media, tmpCbz, 3, ch.fileName);

    if (ok) {
      const pages = await extractCbzToFolder(tmpCbz, chapterFolder, chInfo.folderName);

      // Atualizar pageCount no catálogo
      chInfo.pageCount = pages.length;
      chInfo.pages     = pages;

      // Usar primeira página como capa se não tiver ainda
      if (!fsSync.existsSync(coverSrc) && pages.length > 0) {
        const firstPage = path.join(chapterFolder, pages[0]);
        await fs.copyFile(firstPage, coverSrc);
        await fs.copyFile(firstPage, coverPub);
        console.log('     🖼️  Capa extraída da primeira página!');
        infoData.coverUrl = `/catalog/${mangaId}/cover.jpg`;
      }
    }

    await sleep(500);
  }

  // Atualizar info.json com pageCount preenchido
  infoData.chapters = chaptersList;
  await saveInfo(mangaDir, infoData);
  await saveCatalog(catalog);
  await updateStatus({ status: 'em_andamento', currentChannel: title, totalCatalogadas: catalog.mangas.length });
}

// ─── FASE 2: Canal índice (múltiplas obras) ───────────────────────────────────

async function extractIndexChannel(client, channelInfo, catalog) {
  console.log(`\n📋 Índice: ${channelInfo.name} (${channelInfo.id})`);

  let entity;
  try { entity = await client.getEntity(channelInfo.id); }
  catch (err) { console.error(`  ❌ Canal inacessível: ${err.message}`); return; }

  console.log('  📡 Buscando mensagens...');
  const all = await getAllMessages(client, entity);
  console.log(`  📬 ${all.length} mensagens encontradas`);

  let added = 0, skipped = 0, errors = 0;

  for (const msg of all) {
    if (!msg.message || !msg.replyMarkup?.rows) continue;

    try {
      const lines    = msg.message.split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.length) continue;

      const rawTitle = lines[0].split('|')[0].trim();
      if (!rawTitle || rawTitle.length < 2 || rawTitle.includes('http')) continue;

      const mangaId = sanitize(rawTitle);
      if (!mangaId || mangaId.length < 2) continue;

      if (catalog.mangas.some(m => m.id === mangaId)) { skipped++; continue; }

      // Extrair metadados
      const msgLow = msg.message.toLowerCase();
      const genres = (msg.message.match(/#(\w+)/g) || [])
        .map(g => g.replace('#', ''))
        .filter(g => !['Em','Finalizado','Cancelada','Hiato'].includes(g));
      let type   = msgLow.includes('tipo: mangá') ? 'manga' : msgLow.includes('tipo: manhua') ? 'manhua' : 'manhwa';
      let status = msgLow.includes('finalizado') ? 'completed' : msgLow.includes('cancelad') ? 'dropped' : msgLow.includes('hiato') ? 'on_hold' : 'reading';

      // Link do botão
      let inviteUrl = '';
      for (const row of msg.replyMarkup.rows) {
        for (const btn of row.buttons || []) {
          if (btn.url) { inviteUrl = btn.url; break; }
        }
        if (inviteUrl) break;
      }

      // Criar pastas
      const mangaDir  = path.join(LIBRARY_DIR, mangaId);
      const publicDir = path.join(CATALOG_DIR,  mangaId);
      await fs.mkdir(mangaDir,  { recursive: true });
      await fs.mkdir(publicDir, { recursive: true });

      // Baixar capa se houver foto
      const coverSrc = path.join(mangaDir,  'cover.jpg');
      const coverPub = path.join(publicDir, 'cover.jpg');
      if (!fsSync.existsSync(coverSrc) && msg.media?.photo) {
        await downloadWithRetry(client, msg.media, coverSrc, 2, `capa-${rawTitle}`);
        if (fsSync.existsSync(coverSrc)) await fs.copyFile(coverSrc, coverPub).catch(() => {});
      }

      const mangaData = {
        id:          mangaId,
        title:       rawTitle,
        type,
        genres:      genres.length ? genres : ['Ação'],
        status,
        synopsis:    msg.message.slice(0, 500),
        coverUrl:    fsSync.existsSync(coverPub) ? `/catalog/${mangaId}/cover.jpg` : undefined,
        inviteUrl,
        chapters:    [],
        totalChapters: 0,
        addedAt:     new Date().toISOString(),
        source:      `telegram-index:${channelInfo.name}`,
      };

      // Salvar info.json na pasta da obra
      await saveInfo(mangaDir, mangaData);
      catalog.mangas.push(mangaData);
      added++;

      if (added % 10 === 0) {
        await saveCatalog(catalog);
        await updateStatus({ status: 'em_andamento', currentChannel: channelInfo.name, totalCatalogadas: catalog.mangas.length });
        process.stdout.write(`  ... ${added} obras indexadas\r`);
      }

      await sleep(300);
    } catch (msgErr) {
      errors++;
      console.error(`  ⚠️  Erro msg #${msg.id}: ${msgErr.message}`);
    }
  }

  await saveCatalog(catalog);
  console.log(`\n  ✅ ${channelInfo.name}: +${added} novas | ${skipped} já existiam | ${errors} erros ignorados`);
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Extrator Telegram — estrutura organizada\n');
  await fs.mkdir(LIBRARY_DIR, { recursive: true });
  await fs.mkdir(CATALOG_DIR, { recursive: true });

  const client = new TelegramClient(new StringSession(SESSION), API_ID, API_HASH, {
    connectionRetries: 10,
    retryDelay: 2000,
    autoReconnect: true,
  });

  await client.connect();
  console.log('✅ Conectado ao Telegram!\n');

  let catalog = await loadCatalog();
  console.log(`📚 Catálogo atual: ${catalog.mangas.length} obras.\n`);

  // FASE 1 — canais dedicados
  console.log('═══════════════════════════════════════');
  console.log('  FASE 1 — Canais dedicados (obra única)');
  console.log('═══════════════════════════════════════');
  for (const item of DEDICATED_CHANNELS) {
    try {
      await extractDedicatedChannel(client, item, catalog);
    } catch (err) {
      console.error(`\n❌ Falha no canal "${item.defaultTitle}": ${err.message}`);
      console.log('   Continuando próximo canal...\n');
    }
    await sleep(2000);
  }

  // FASE 2 — canais índice
  console.log('\n═══════════════════════════════════════');
  console.log('  FASE 2 — Canais índice (múltiplas obras)');
  console.log('═══════════════════════════════════════');
  for (const channelInfo of INDEX_CHANNELS) {
    try {
      await extractIndexChannel(client, channelInfo, catalog);
    } catch (err) {
      console.error(`\n❌ Falha no índice "${channelInfo.name}": ${err.message}`);
      console.log('   Continuando próximo índice...\n');
    }
    await sleep(3000);
  }

  await saveCatalog(catalog);
  console.log(`\n🎉 Extração completa! Total: ${catalog.mangas.length} obras`);
  await updateStatus({ status: 'concluido', totalMangas: catalog.mangas.length });
  await client.disconnect();
  console.log('👋 Desconectado.');
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message);
  process.exit(1);
});
