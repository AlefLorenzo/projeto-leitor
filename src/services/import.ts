import { Manga, Chapter, Page, ImportOptions, ChapterImport, ImportResult, ReadingDirection, MangaType } from '../types';
import { generateId, saveManga, saveChapter, savePages, saveProgress } from './database';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];
const ARCHIVE_EXTENSIONS = ['cbz', 'zip'];

// Natural sort for filenames like "1.jpg", "2.jpg", "10.jpg"
function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

function isImageFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return IMAGE_EXTENSIONS.includes(ext) || file.type.startsWith('image/');
}

function isArchiveFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return ARCHIVE_EXTENSIONS.includes(ext);
}

// Convert File to base64 data URL
async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Create thumbnail from image
async function createThumbnail(file: File, maxSize: number = 300): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      const ratio = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } else {
        reject(new Error('Could not create canvas context'));
      }
    };
    
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Import a single manga with chapters
export async function importManga(
  options: ImportOptions,
  chapters: ChapterImport[]
): Promise<ImportResult> {
  const errors: string[] = [];
  let totalPages = 0;
  let totalSize = 0;
  
  try {
    const mangaId = generateId();
    const now = Date.now();
    
    // Process cover
    let coverUrl: string | undefined;
    if (options.coverFile) {
      try {
        coverUrl = await createThumbnail(options.coverFile, 400);
      } catch {
        errors.push('Não foi possível processar a capa');
      }
    }
    
    // Create manga
    const manga: Manga = {
      id: mangaId,
      title: options.title,
      author: options.author,
      artist: options.artist,
      synopsis: options.synopsis,
      coverUrl,
      genres: options.genres,
      type: options.type,
      readingDirection: options.readingDirection,
      status: 'reading',
      language: options.language,
      source: 'local',
      createdAt: now,
      updatedAt: now,
      isFavorite: false,
      totalChapters: chapters.length,
      totalPages: 0,
      storageSize: 0,
    };
    
    // Process chapters
    for (const chapterImport of chapters) {
      const chapterId = generateId();
      const chapterPages: Page[] = [];
      let chapterSize = 0;
      
      // Sort files naturally
      const sortedFiles = [...chapterImport.files].sort((a, b) => naturalSort(a.name, b.name));
      
      // Process each page
      for (let i = 0; i < sortedFiles.length; i++) {
        const file = sortedFiles[i];
        
        if (!isImageFile(file)) {
          errors.push(`Arquivo ignorado (não é imagem): ${file.name}`);
          continue;
        }
        
        try {
          const imageUrl = await fileToDataURL(file);
          chapterSize += file.size;
          
          chapterPages.push({
            id: generateId(),
            chapterId,
            mangaId,
            pageNumber: i + 1,
            imageUrl,
            createdAt: now,
          });
        } catch {
          errors.push(`Erro ao processar: ${file.name}`);
        }
      }
      
      if (chapterPages.length === 0) {
        errors.push(`Capítulo "${chapterImport.title}" não contém imagens válidas`);
        continue;
      }
      
      // Create chapter
      const chapter: Chapter = {
        id: chapterId,
        mangaId,
        number: chapterImport.number,
        title: chapterImport.title,
        pagesCount: chapterPages.length,
        createdAt: now,
        storageSize: chapterSize,
      };
      
      await saveChapter(chapter);
      await savePages(chapterPages);
      
      totalPages += chapterPages.length;
      totalSize += chapterSize;
    }
    
    // Update manga with totals
    manga.totalPages = totalPages;
    manga.storageSize = totalSize;
    await saveManga(manga);
    
    // Initialize progress
    if (totalPages > 0) {
      await saveProgress({
        id: generateId(),
        mangaId,
        chapterId: '',
        pageNumber: 0,
        totalPages: 0,
        lastReadAt: now,
        completed: false,
      });
    }
    
    return {
      success: errors.length === 0,
      mangaId,
      chaptersCreated: chapters.length,
      pagesCreated: totalPages,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      chaptersCreated: 0,
      pagesCreated: 0,
      errors: [`Erro na importação: ${error instanceof Error ? error.message : 'Desconhecido'}`],
    };
  }
}

// Import images directly as a single chapter
export async function importImagesAsChapter(
  mangaId: string,
  chapterNumber: number,
  chapterTitle: string,
  files: File[]
): Promise<{ success: boolean; pagesCreated: number; errors: string[] }> {
  const errors: string[] = [];
  const chapterId = generateId();
  const now = Date.now();
  const pages: Page[] = [];
  let totalSize = 0;
  
  const sortedFiles = [...files].sort((a, b) => naturalSort(a.name, b.name));
  
  for (let i = 0; i < sortedFiles.length; i++) {
    const file = sortedFiles[i];
    
    if (!isImageFile(file)) {
      errors.push(`Arquivo ignorado: ${file.name}`);
      continue;
    }
    
    try {
      const imageUrl = await fileToDataURL(file);
      totalSize += file.size;
      
      pages.push({
        id: generateId(),
        chapterId,
        mangaId,
        pageNumber: i + 1,
        imageUrl,
        createdAt: now,
      });
    } catch {
      errors.push(`Erro ao processar: ${file.name}`);
    }
  }
  
  if (pages.length === 0) {
    return { success: false, pagesCreated: 0, errors: ['Nenhuma imagem válida encontrada'] };
  }
  
  const chapter: Chapter = {
    id: chapterId,
    mangaId,
    number: chapterNumber,
    title: chapterTitle,
    pagesCount: pages.length,
    createdAt: now,
    storageSize: totalSize,
  };
  
  await saveChapter(chapter);
  await savePages(pages);
  
  return { success: true, pagesCreated: pages.length, errors };
}

// Auto-detect chapters from folder structure
export function detectChaptersFromFiles(files: File[]): Map<string, File[]> {
  const chapters = new Map<string, File[]>();
  
  for (const file of files) {
    // Try to detect chapter from path
    const path = file.webkitRelativePath || file.name;
    const parts = path.split('/');
    
    let chapterKey: string;
    if (parts.length > 1) {
      // File is in a subfolder - use folder name as chapter
      chapterKey = parts[parts.length - 2];
    } else {
      // All files in root - single chapter
      chapterKey = 'Capítulo 01';
    }
    
    if (!chapters.has(chapterKey)) {
      chapters.set(chapterKey, []);
    }
    chapters.get(chapterKey)!.push(file);
  }
  
  return chapters;
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Get reading direction label
export function getReadingDirectionLabel(direction: ReadingDirection): string {
  switch (direction) {
    case 'rtl': return 'Mangá (Direita → Esquerda)';
    case 'ltr': return 'Manhua (Esquerda → Direita)';
    case 'vertical': return 'Manhwa (Vertical)';
  }
}

// Get manga type label
export function getMangaTypeLabel(type: MangaType): string {
  switch (type) {
    case 'manga': return 'Mangá';
    case 'manhwa': return 'Manhwa';
    case 'manhua': return 'Manhua';
  }
}

// Get default reading direction for type
export function getDefaultReadingDirection(type: MangaType): ReadingDirection {
  switch (type) {
    case 'manga': return 'rtl';
    case 'manhwa': return 'vertical';
    case 'manhua': return 'ltr';
  }
}
