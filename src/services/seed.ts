import { Manga, Chapter, Page, ReadingProgress } from '../types';
import { getDB, generateId, saveManga, saveChapter, savePages, saveProgress } from './database';

// Generate placeholder cover images with gradients
function generateCoverImage(title: string, colors: [string, string]): string {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 600;
  const ctx = canvas.getContext('2d')!;

  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, 400, 600);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 400, 600);

  // Add some decorative elements
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.arc(300, 100, 150, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(100, 500, 200, 0, Math.PI * 2);
  ctx.fill();

  // Add title text
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = 'bold 32px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Word wrap title
  const words = title.split(' ');
  let lines: string[] = [];
  let currentLine = '';
  
  words.forEach(word => {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > 350) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });
  lines.push(currentLine);
  
  const lineHeight = 40;
  const startY = 300 - (lines.length * lineHeight) / 2;
  
  lines.forEach((line, i) => {
    ctx.fillText(line, 200, startY + i * lineHeight);
  });

  return canvas.toDataURL('image/jpeg', 0.8);
}

// Generate placeholder page images
function generatePageImage(pageNumber: number, chapterTitle: string, colors: [string, string]): string {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 1200;
  const ctx = canvas.getContext('2d')!;

  // Background
  const gradient = ctx.createLinearGradient(0, 0, 0, 1200);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 800, 1200);

  // Add manga-style panels
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 3;
  
  // Panel 1
  ctx.strokeRect(50, 50, 340, 400);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(50, 50, 340, 400);
  
  // Panel 2
  ctx.strokeRect(410, 50, 340, 250);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(410, 50, 340, 250);
  
  // Panel 3
  ctx.strokeRect(410, 320, 340, 130);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(410, 320, 340, 130);
  
  // Panel 4
  ctx.strokeRect(50, 470, 700, 300);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(50, 470, 700, 300);
  
  // Panel 5
  ctx.strokeRect(50, 790, 340, 360);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(50, 790, 340, 360);
  
  // Panel 6
  ctx.strokeRect(410, 790, 340, 360);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(410, 790, 340, 360);

  // Add page number
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '24px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Página ${pageNumber}`, 400, 1170);

  // Add chapter title
  ctx.font = '18px Inter, sans-serif';
  ctx.fillText(chapterTitle, 400, 30);

  return canvas.toDataURL('image/jpeg', 0.7);
}

// Demo data
const DEMO_MANGAS = [
  {
    title: 'Solo Leveling',
    author: 'Chugong',
    synopsis: 'Em um mundo onde caçadores devem enfrentar monstros mortais, Sung Jin-Woo, o caçador mais fraco, encontra um dungeon secreto que mudará sua vida para sempre.',
    genres: ['Ação', 'Aventura', 'Fantasia'],
    type: 'manhwa' as const,
    colors: ['#4c1d95', '#7c3aed'] as [string, string],
    chapters: 3,
    pagesPerChapter: 5,
  },
  {
    title: 'Tower of God',
    author: 'SIU',
    synopsis: 'O que você deseja? Dinheiro e riqueza? Honra e orgulho? Autoridade e poder? Tudo que você deseja está no topo da Torre.',
    genres: ['Ação', 'Aventura', 'Fantasia', 'Mistério'],
    type: 'manhwa' as const,
    colors: ['#1e40af', '#3b82f6'] as [string, string],
    chapters: 3,
    pagesPerChapter: 5,
  },
  {
    title: 'One Punch Man',
    author: 'ONE',
    synopsis: 'A história de Saitama, um herói que pode derrotar qualquer inimigo com um único soco, mas que perdeu a emoção de lutar.',
    genres: ['Ação', 'Comédia', 'Superpoderes'],
    type: 'manga' as const,
    colors: ['#dc2626', '#f59e0b'] as [string, string],
    chapters: 3,
    pagesPerChapter: 5,
  },
  {
    title: 'The Beginning After The End',
    author: 'TurtleMe',
    synopsis: 'Rei Grey tem poder inigualável, mas a solidão permeia aqueles com grande poder. Reencarnado em um novo mundo cheio de magia.',
    genres: ['Ação', 'Fantasia', 'Reencarnação'],
    type: 'manhwa' as const,
    colors: ['#059669', '#10b981'] as [string, string],
    chapters: 3,
    pagesPerChapter: 5,
  },
];

export async function seedDemoData(): Promise<boolean> {
  const db = await getDB();
  
  // Check if already seeded
  const existingMangas = await db.getAll('mangas');
  if (existingMangas.length > 0) {
    console.log('Database already has data, skipping seed');
    return false;
  }

  console.log('Seeding demo data...');
  const now = Date.now();

  for (let mangaIndex = 0; mangaIndex < DEMO_MANGAS.length; mangaIndex++) {
    const demoManga = DEMO_MANGAS[mangaIndex];
    const mangaId = generateId();

    // Generate cover
    const coverUrl = generateCoverImage(demoManga.title, demoManga.colors);

    // Create manga
    const manga: Manga = {
      id: mangaId,
      title: demoManga.title,
      author: demoManga.author,
      synopsis: demoManga.synopsis,
      coverUrl,
      genres: demoManga.genres,
      type: demoManga.type,
      readingDirection: demoManga.type === 'manga' ? 'rtl' : demoManga.type === 'manhwa' ? 'vertical' : 'ltr',
      status: 'reading',
      source: 'local',
      createdAt: now - (mangaIndex * 86400000), // Spread over days
      updatedAt: now - (mangaIndex * 3600000),
      lastReadAt: mangaIndex === 0 ? now - 3600000 : undefined, // First one was read recently
      isFavorite: mangaIndex < 2, // First two are favorites
      totalChapters: demoManga.chapters,
      totalPages: demoManga.chapters * demoManga.pagesPerChapter,
      storageSize: demoManga.chapters * demoManga.pagesPerChapter * 50000, // ~50KB per page
    };

    await saveManga(manga);

    // Create chapters and pages
    for (let chapterNum = 1; chapterNum <= demoManga.chapters; chapterNum++) {
      const chapterId = generateId();
      const chapterTitle = `Capítulo ${String(chapterNum).padStart(2, '0')}`;

      const chapter: Chapter = {
        id: chapterId,
        mangaId,
        number: chapterNum,
        title: chapterTitle,
        pagesCount: demoManga.pagesPerChapter,
        createdAt: now - ((demoManga.chapters - chapterNum) * 86400000),
        storageSize: demoManga.pagesPerChapter * 50000,
        isDownloaded: true,
      };

      await saveChapter(chapter);

      // Create pages
      const pages: Page[] = [];
      for (let pageNum = 1; pageNum <= demoManga.pagesPerChapter; pageNum++) {
        const imageUrl = generatePageImage(pageNum, chapterTitle, demoManga.colors);
        
        pages.push({
          id: generateId(),
          chapterId,
          mangaId,
          pageNumber: pageNum,
          imageUrl,
          createdAt: now,
        });
      }

      await savePages(pages);
    }

    // Create reading progress for first manga
    if (mangaIndex === 0) {
      const firstChapter = await db.getAllFromIndex('chapters', 'mangaId', mangaId);
      if (firstChapter.length > 0) {
        await saveProgress({
          id: generateId(),
          mangaId,
          chapterId: firstChapter[0].id,
          pageNumber: 3,
          totalPages: demoManga.pagesPerChapter,
          lastReadAt: now - 3600000,
          completed: false,
        });
      }
    }
  }

  console.log('Demo data seeded successfully!');
  return true;
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const stores = ['mangas', 'chapters', 'pages', 'progress', 'downloads', 'notifications', 'settings'];
  
  for (const store of stores) {
    if (db.objectStoreNames.contains(store)) {
      await db.clear(store);
    }
  }
}
