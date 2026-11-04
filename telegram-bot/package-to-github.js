import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import JSZip from 'jszip';
import { fileURLToPath } from 'url';
import { canonicalSlug, padNum } from './deduplicator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '..');
const LIBRARY_DIR = path.join(ROOT_DIR, 'library');
const OBRAS_DIR = path.join(ROOT_DIR, 'obras');
const APP_DIR = path.join(ROOT_DIR, 'app');
const PUBLIC_CATALOG_DIR = path.join(ROOT_DIR, 'public', 'catalog');

// Configuração do repositório GitHub
const GITHUB_OWNER = 'AlefLorenzo';
const GITHUB_REPO = 'projeto-leitor';
const GITHUB_BRANCH = 'main';
const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}`;

// Limite estrito do GitHub por arquivo (100MB)
const GITHUB_MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fsSync.createReadStream(filePath);
    stream.on('data', (d) => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function zipFolderToCbz(folderPath, destCbzPath) {
  const zip = new JSZip();
  const files = (await fs.readdir(folderPath))
    .filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (files.length === 0) return { pageCount: 0, extractedSize: 0, compressedSize: 0, sha256: '' };

  let extractedSize = 0;
  for (let i = 0; i < files.length; i++) {
    const filePath = path.join(folderPath, files[i]);
    const stat = await fs.stat(filePath);
    extractedSize += stat.size;
    const data = await fs.readFile(filePath);
    const ext = path.extname(files[i]).toLowerCase() || '.jpg';
    zip.file(`${padNum(i + 1)}${ext}`, data);
  }

  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const compressedSize = content.length;
  if (compressedSize > GITHUB_MAX_FILE_BYTES) {
    console.warn(`⚠️ ALERTA: Arquivo ${path.basename(destCbzPath)} tem ${(compressedSize / (1024*1024)).toFixed(1)}MB (excede limite de 100MB do GitHub!)`);
  }

  await fs.writeFile(destCbzPath, content);
  const hash = sha256Buffer(content);

  return {
    pageCount: files.length,
    extractedSize,
    compressedSize,
    sha256: hash,
  };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  📦 EMPACOTADOR PARA GITHUB — CAPÍTULOS COMPACTADOS      ║');
  console.log('║  Gera /obras e catalog.json com Hashes SHA-256           ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  await fs.mkdir(OBRAS_DIR, { recursive: true });
  await fs.mkdir(APP_DIR, { recursive: true });
  await fs.mkdir(PUBLIC_CATALOG_DIR, { recursive: true });

  // Carregar catálogo existente para metadados (sinopse, gêneros, tipo)
  let existingCatalog = { mangas: [] };
  try {
    const raw = await fs.readFile(path.join(PUBLIC_CATALOG_DIR, 'catalog.json'), 'utf-8');
    existingCatalog = JSON.parse(raw);
  } catch {}

  const mangaDirs = (await fs.readdir(LIBRARY_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  console.log(`🔍 Encontradas ${mangaDirs.length} pastas na biblioteca...\n`);

  const remoteCatalog = {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    repository: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`,
    baseUrl: GITHUB_RAW_BASE,
    mangas: [],
  };

  let totalChaptersPackaged = 0;
  let totalBytesCompressed = 0;

  for (const dirName of mangaDirs) {
    const cleanSlug = canonicalSlug(dirName);
    const mangaLibDir = path.join(LIBRARY_DIR, dirName);

    // Listar pastas de capítulos
    const capFolders = (await fs.readdir(mangaLibDir, { withFileTypes: true }))
      .filter((d) => d.isDirectory() && d.name.toLowerCase().startsWith('capitulo'))
      .map((d) => d.name);

    if (capFolders.length === 0) continue;

    console.log(`────────────────────────────────────────────────────────────`);
    console.log(`📖 Processando: ${cleanSlug} (${capFolders.length} capítulos)`);

    const obraDestDir = path.join(OBRAS_DIR, cleanSlug);
    const capitulosDestDir = path.join(obraDestDir, 'capitulos');
    await fs.mkdir(capitulosDestDir, { recursive: true });

    // Buscar metadados existentes
    const metaMatch = existingCatalog.mangas.find((m) => canonicalSlug(m.id || m.title) === cleanSlug);
    const title = metaMatch?.title || cleanSlug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

    // Copiar capa se existir
    let coverRelativeUrl = `obras/${cleanSlug}/cover.jpg`;
    const possibleCoverSrc = [
      path.join(PUBLIC_CATALOG_DIR, dirName, 'cover.jpg'),
      path.join(PUBLIC_CATALOG_DIR, cleanSlug, 'cover.jpg'),
    ];
    let coverFound = false;
    for (const src of possibleCoverSrc) {
      if (fsSync.existsSync(src)) {
        await fs.copyFile(src, path.join(obraDestDir, 'cover.jpg'));
        coverFound = true;
        break;
      }
    }
    if (!coverFound) {
      // Se não achou cover, pega a primeira página do capítulo 1 como capa
      const firstCapPages = path.join(mangaLibDir, capFolders[0]);
      if (fsSync.existsSync(firstCapPages)) {
        const pgs = fsSync.readdirSync(firstCapPages).filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
        if (pgs.length > 0) {
          await fs.copyFile(path.join(firstCapPages, pgs[0]), path.join(obraDestDir, 'cover.jpg'));
          coverFound = true;
        }
      }
    }

    const packagedChapters = [];

    // Ordenar capítulos numericamente
    capFolders.sort((a, b) => {
      const numA = parseFloat((a.match(/\d+(\.\d+)?/) || [0])[0]);
      const numB = parseFloat((b.match(/\d+(\.\d+)?/) || [0])[0]);
      return numA - numB;
    });

    for (let idx = 0; idx < capFolders.length; idx++) {
      const capName = capFolders[idx];
      const numMatch = capName.match(/(\d+(?:\.\d+)?)/);
      const num = numMatch ? parseFloat(numMatch[1]) : idx + 1;
      const formattedNum = padNum(num);

      const capSourceFolder = path.join(mangaLibDir, capName);
      const cbzFileName = `cap-${formattedNum}.cbz`;
      const cbzDestPath = path.join(capitulosDestDir, cbzFileName);

      let info;

      // Se o .cbz já existe com hash válido, não recompila (rápido!)
      if (fsSync.existsSync(cbzDestPath)) {
        const stat = await fs.stat(cbzDestPath);
        if (stat.size > 1024) {
          const hash = await sha256File(cbzDestPath);
          const pgs = fsSync.readdirSync(capSourceFolder).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));
          info = {
            pageCount: pgs.length,
            extractedSize: stat.size * 1.5, // estimativa
            compressedSize: stat.size,
            sha256: hash,
          };
        }
      }

      if (!info) {
        process.stdout.write(`  📦 Compactando ${capName}...`);
        info = await zipFolderToCbz(capSourceFolder, cbzDestPath);
        console.log(` ${(info.compressedSize / (1024 * 1024)).toFixed(1)}MB (SHA: ${info.sha256.substring(0, 8)}...)`);
      }

      totalChaptersPackaged++;
      totalBytesCompressed += info.compressedSize;

      packagedChapters.push({
        id: `${cleanSlug}-cap-${formattedNum}`,
        number: num,
        title: `Capítulo ${formattedNum}`,
        format: 'cbz',
        downloadUrl: `obras/${cleanSlug}/capitulos/${cbzFileName}`,
        sizeBytes: info.compressedSize,
        extractedSizeBytes: Math.round(info.extractedSize),
        sha256: info.sha256,
        pageCount: info.pageCount,
        updatedAt: new Date().toISOString(),
      });
    }

    const mangaMetadata = {
      id: cleanSlug,
      title,
      synopsis: metaMatch?.synopsis || `Leitura offline de ${title}.`,
      coverUrl: coverRelativeUrl,
      genres: metaMatch?.genres || ['Ação', 'Aventura'],
      type: metaMatch?.type || 'manhwa',
      status: metaMatch?.status || 'ongoing',
      totalChapters: packagedChapters.length,
      updatedAt: new Date().toISOString(),
      chapters: packagedChapters,
    };

    // Salvar metadata.json individual dentro da pasta da obra
    await fs.writeFile(path.join(obraDestDir, 'metadata.json'), JSON.stringify(mangaMetadata, null, 2), 'utf-8');

    remoteCatalog.mangas.push(mangaMetadata);
  }

  // Salvar catalog.json nos dois locais (app/ e public/catalog/)
  const catalogPayload = JSON.stringify(remoteCatalog, null, 2);
  await fs.writeFile(path.join(APP_DIR, 'catalog.json'), catalogPayload, 'utf-8');
  await fs.writeFile(path.join(PUBLIC_CATALOG_DIR, 'catalog.json'), catalogPayload, 'utf-8');

  console.log(`\n══════════════════════════════════════════════════════════`);
  console.log(`🎉 EMPACOTAMENTO PARA O GITHUB CONCLUÍDO!`);
  console.log(`📚 Obras processadas: ${remoteCatalog.mangas.length}`);
  console.log(`📦 Capítulos compactados (.cbz): ${totalChaptersPackaged}`);
  console.log(`💾 Volume total compactado: ${(totalBytesCompressed / (1024 * 1024)).toFixed(1)} MB`);
  console.log(`📄 Catálogo gerado em:`);
  console.log(`   - app/catalog.json`);
  console.log(`   - public/catalog/catalog.json`);
  console.log(`📁 Estrutura de obras gerada em: obras/`);
  console.log(`══════════════════════════════════════════════════════════\n`);
}

main().catch((err) => {
  console.error('\n❌ Erro:', err.message);
  process.exit(1);
});
