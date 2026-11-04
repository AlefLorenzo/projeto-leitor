import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Converte qualquer título ou slug para sua forma canônica única.
 * Remove emojis, pontuação, acentos e sufixos repetitivos como
 * "-manhwa", "-manga", "-qg-baltigo", "(Manhwa)", etc.
 */
export function canonicalSlug(input) {
  if (!input) return '';

  let s = String(input)
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') // remove emojis
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');

  const redundantSuffixes = [
    '-manhwa',
    '-manga',
    '-manhua',
    '-qg-baltigo',
    '-baltigo',
    '-brasil',
    '-oficial',
    '-official',
    '-colorido',
    '-edicao-colorida',
    '-promo',
    '-webtoon',
    '-end-line',
    '-raw',
    '-scan',
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of redundantSuffixes) {
      if (s.endsWith(suf)) {
        s = s.slice(0, -suf.length).replace(/^[-_]+|[-_]+$/g, '');
        changed = true;
      }
    }
  }

  return s;
}

export function padNum(n, d = 3) {
  return String(Math.round(n)).padStart(d, '0');
}

/**
 * Encontra a pasta existente no disco que corresponde à obra,
 * mesmo se estiver com sufixo antigo (-manhwa, -qg-baltigo, etc.)
 */
export function findExistingMangaDir(libraryDir, titleOrSlug) {
  if (!fs.existsSync(libraryDir)) return null;

  const canon = canonicalSlug(titleOrSlug);
  const directPath = path.join(libraryDir, canon);

  // 1. Caminho exato canônico
  if (fs.existsSync(directPath)) {
    return directPath;
  }

  // 2. Busca entre as pastas existentes que coincidam canonicamente
  const dirs = fs.readdirSync(libraryDir, { withFileTypes: true }).filter((d) => d.isDirectory());

  let bestCandidate = null;
  let maxChapters = -1;

  for (const dir of dirs) {
    if (canonicalSlug(dir.name) === canon) {
      const fullPath = path.join(libraryDir, dir.name);
      const caps = fs
        .readdirSync(fullPath, { withFileTypes: true })
        .filter((x) => x.isDirectory() && x.name.toLowerCase().startsWith('capitulo')).length;
      if (caps > maxChapters) {
        maxChapters = caps;
        bestCandidate = fullPath;
      }
    }
  }

  return bestCandidate || directPath;
}

/**
 * Verifica se um capítulo já está baixado e possui imagens válidas (não corrompidas)
 */
export function isChapterAlreadyDownloaded(mangaDir, chapterNum) {
  if (!fs.existsSync(mangaDir)) return false;

  const num = typeof chapterNum === 'number' ? chapterNum : parseFloat(chapterNum);
  if (isNaN(num)) return false;

  const padded = padNum(num);

  const candidates = [
    `Capitulo ${padded}`,
    `Capítulo ${padded}`,
    `Capitulo ${num}`,
    `Capítulo ${num}`,
    `Cap ${padded}`,
    `Cap ${num}`,
  ];

  for (const name of candidates) {
    const chapterFolder = path.join(mangaDir, name);
    if (fs.existsSync(chapterFolder)) {
      try {
        const files = fs.readdirSync(chapterFolder);
        const validPages = files.filter((f) => {
          if (!/\.(jpg|jpeg|png|webp)$/i.test(f)) return false;
          try {
            const stat = fs.statSync(path.join(chapterFolder, f));
            return stat.size > 1024; // Pelo menos 1KB
          } catch {
            return false;
          }
        });

        if (validPages.length > 0) {
          return true;
        }
      } catch {}
    }
  }

  return false;
}

/**
 * Varre a pasta library/ e mescla pastas duplicadas da mesma obra
 */
export function mergeLibraryDuplicates(libraryDir, fix = true) {
  if (!fs.existsSync(libraryDir)) return { merged: 0, removed: 0 };

  const dirs = fs.readdirSync(libraryDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  const groups = new Map();

  for (const dir of dirs) {
    const canon = canonicalSlug(dir.name);
    if (!canon) continue;
    if (!groups.has(canon)) groups.set(canon, []);
    groups.get(canon).push(dir.name);
  }

  let mergedCount = 0;
  let removedCount = 0;

  for (const [canon, list] of groups) {
    if (list.length <= 1) continue;

    console.log(`\n🔍 Obra com duplicatas encontradas: "${canon}"`);
    for (const name of list) {
      const fullPath = path.join(libraryDir, name);
      const caps = fs
        .readdirSync(fullPath, { withFileTypes: true })
        .filter((x) => x.isDirectory() && x.name.toLowerCase().startsWith('capitulo')).length;
      console.log(`   📂 ${name} (${caps} capítulos)`);
    }

    if (!fix) continue;

    const targetDir = path.join(libraryDir, canon);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    for (const name of list) {
      const sourceDir = path.join(libraryDir, name);
      if (sourceDir === targetDir) continue;

      const subDirs = fs.readdirSync(sourceDir, { withFileTypes: true }).filter((x) => x.isDirectory());
      for (const sub of subDirs) {
        const srcCap = path.join(sourceDir, sub.name);
        const destCap = path.join(targetDir, sub.name);

        if (!fs.existsSync(destCap)) {
          fs.renameSync(srcCap, destCap);
          mergedCount++;
        } else {
          const srcFiles = fs.readdirSync(srcCap);
          for (const f of srcFiles) {
            const sFile = path.join(srcCap, f);
            const dFile = path.join(destCap, f);
            if (!fs.existsSync(dFile)) {
              fs.copyFileSync(sFile, dFile);
            }
          }
        }
      }

      try {
        const remaining = fs.readdirSync(sourceDir);
        if (remaining.length === 0 || remaining.every((r) => r.startsWith('temp_'))) {
          for (const r of remaining) {
            try {
              fs.unlinkSync(path.join(sourceDir, r));
            } catch {}
          }
          fs.rmdirSync(sourceDir);
          removedCount++;
          console.log(`   🗑️ Pasta redundante removida: ${name}`);
        }
      } catch (err) {
        console.error(`   ⚠️ Erro ao remover pasta ${name}:`, err.message);
      }
    }
  }

  return { merged: mergedCount, removed: removedCount };
}

/**
 * Remove duplicatas de obras e capítulos em catalog.json
 */
export function cleanCatalogDuplicates(catalogPath, fix = true) {
  if (!fs.existsSync(catalogPath)) return { duplicatesRemoved: 0 };

  const raw = fs.readFileSync(catalogPath, 'utf-8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { duplicatesRemoved: 0 };
  }

  if (!data.mangas || !Array.isArray(data.mangas)) return { duplicatesRemoved: 0 };

  const groups = new Map();

  for (const manga of data.mangas) {
    const canon = canonicalSlug(manga.id || manga.title);
    if (!groups.has(canon)) groups.set(canon, []);
    groups.get(canon).push(manga);
  }

  const cleanedMangas = [];
  let duplicatesRemoved = 0;

  for (const [canon, list] of groups) {
    if (list.length === 1) {
      list[0].id = canon;
      cleanedMangas.push(list[0]);
      continue;
    }

    duplicatesRemoved += list.length - 1;

    list.sort((a, b) => {
      const capsA = a.chapters?.length || 0;
      const capsB = b.chapters?.length || 0;
      return capsB - capsA;
    });

    const primary = list[0];
    primary.id = canon;
    primary.title = primary.title.replace(/^📚\s*/, '').trim();

    const chaptersMap = new Map();
    for (const m of list) {
      if (m.chapters && Array.isArray(m.chapters)) {
        for (const ch of m.chapters) {
          const num = typeof ch.number === 'number' ? ch.number : parseFloat(ch.number) || 0;
          if (!chaptersMap.has(num)) {
            chaptersMap.set(num, ch);
          } else {
            const existing = chaptersMap.get(num);
            if ((ch.pageCount || 0) > (existing.pageCount || 0)) {
              chaptersMap.set(num, ch);
            }
          }
        }
      }
    }

    primary.chapters = Array.from(chaptersMap.values()).sort((a, b) => a.number - b.number);
    cleanedMangas.push(primary);
  }

  if (fix && duplicatesRemoved > 0) {
    data.mangas = cleanedMangas;
    fs.writeFileSync(catalogPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✅ Catálogo limpo: ${duplicatesRemoved} entradas duplicadas mescladas e removidas.`);
  }

  return { duplicatesRemoved, total: cleanedMangas.length };
}
