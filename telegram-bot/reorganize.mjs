import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIBRARY = path.join(__dirname, '..', 'library');

function padNum(n, d = 3) { return String(Math.round(n)).padStart(d, '0'); }

async function extractCbz(cbzPath, destFolder) {
  try {
    const buf = await fs.readFile(cbzPath);
    const zip = await JSZip.loadAsync(buf);
    await fs.mkdir(destFolder, { recursive: true });
    const imgs = Object.keys(zip.files)
      .filter(n => !zip.files[n].dir && /\.(jpg|jpeg|png|webp|gif)$/i.test(n))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (imgs.length === 0) {
      console.log(`     ⚠️  Sem imagens em ${path.basename(cbzPath)}, mantendo arquivo.`);
      return 0;
    }
    for (let i = 0; i < imgs.length; i++) {
      const ext = path.extname(imgs[i]) || '.jpg';
      const data = await zip.files[imgs[i]].async('nodebuffer');
      await fs.writeFile(path.join(destFolder, padNum(i + 1) + ext), data);
    }
    await fs.unlink(cbzPath);
    return imgs.length;
  } catch (err) {
    console.error(`     ❌ Corrompido/erro — mantendo: ${path.basename(cbzPath)} (${err.message})`);
    return -1; // indica falha, não deleta
  }
}

const mangaDirs = await fs.readdir(LIBRARY);
for (const mangaSlug of mangaDirs) {
  const mangaDir = path.join(LIBRARY, mangaSlug);
  if (!(await fs.stat(mangaDir)).isDirectory()) continue;

  console.log(`\n📁 ${mangaSlug}`);

  // Processar cbz na raiz da obra
  const entries = await fs.readdir(mangaDir);
  const cbzRoot = entries
    .filter(f => /\.(cbz|zip)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  for (const cbz of cbzRoot) {
    const cbzPath = path.join(mangaDir, cbz);
    const numMatch = cbz.match(/(\d+(?:\.\d+)?)/);
    const num = numMatch ? parseFloat(numMatch[1]) : 0;
    const folderName = `Capitulo ${padNum(num)}`;
    const dest = path.join(mangaDir, folderName);
    process.stdout.write(`  → ${folderName} `);
    const count = await extractCbz(cbzPath, dest);
    if (count > 0) console.log(`(${count} páginas)`);
  }

  // Processar cbz dentro de subpastas (já criadas pelo script anterior)
  const subEntries = await fs.readdir(mangaDir, { withFileTypes: true });
  for (const dirent of subEntries) {
    if (!dirent.isDirectory()) continue;
    const subPath = path.join(mangaDir, dirent.name);
    const subItems = await fs.readdir(subPath);
    const cbzSub = subItems.filter(f => /\.(cbz|zip)$/i.test(f));

    for (const cbz of cbzSub) {
      const cbzPath = path.join(subPath, cbz);
      const numMatch = cbz.match(/(\d+(?:\.\d+)?)/);
      const num = numMatch ? parseFloat(numMatch[1]) : 0;
      const folderName = `Capitulo ${padNum(num)}`;
      const dest = path.join(mangaDir, folderName);
      process.stdout.write(`  → ${dirent.name}/${cbz} → ${folderName} `);
      const count = await extractCbz(cbzPath, dest);
      if (count > 0) {
        console.log(`(${count} páginas)`);
        // Remover subpasta antiga se ficou vazia
        const remaining = await fs.readdir(subPath);
        if (remaining.length === 0) await fs.rmdir(subPath).catch(() => {});
      }
    }
  }
}

// Resumo final
console.log('\n\n📊 Estrutura final:');
const finalDirs = await fs.readdir(LIBRARY);
for (const slug of finalDirs) {
  const mangaDir = path.join(LIBRARY, slug);
  if (!(await fs.stat(mangaDir)).isDirectory()) continue;
  const sub = await fs.readdir(mangaDir, { withFileTypes: true });
  const capFolders = sub.filter(d => d.isDirectory() && d.name.startsWith('Capitulo'));
  const coverExists = sub.some(f => f.name === 'cover.jpg');
  console.log(`  📂 ${slug}/`);
  console.log(`     🖼️  cover.jpg: ${coverExists ? '✅' : '❌'}`);
  console.log(`     📖 ${capFolders.length} capítulos extraídos`);
}
console.log('\n✅ Reorganização completa!');
