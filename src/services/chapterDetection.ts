/**
 * Natural sorting and chapter detection utilities
 */

// Extract number from string (supports integers and decimals)
export function extractNumber(str: string): number | null {
  // Match patterns like "001", "1", "1.5", "01", etc.
  const match = str.match(/(\d+(?:\.\d+)?)/);
  if (match) {
    return parseFloat(match[1]);
  }
  return null;
}

// Natural sort comparator
export function naturalSort(a: string, b: string): number {
  const numA = extractNumber(a);
  const numB = extractNumber(b);

  if (numA !== null && numB !== null) {
    return numA - numB;
  }

  // If both are non-numeric, sort alphabetically
  return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

// Detect chapter number from folder/file name
export function detectChapterNumber(name: string): number | null {
  // Remove common prefixes
  const cleaned = name
    .replace(/^(cap[íi]tulo|chapter|cap|ch)\s*/i, '')
    .replace(/^#/, '')
    .trim();

  return extractNumber(cleaned);
}

// Detect if name indicates a special chapter
export function isSpecialChapter(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('especial') ||
    lower.includes('special') ||
    lower.includes('prólogo') ||
    lower.includes('prologo') ||
    lower.includes('prologue') ||
    lower.includes('prefácio') ||
    lower.includes('preface') ||
    lower.includes('extra') ||
    lower.includes('one-shot') ||
    lower.includes('oneshot') ||
    lower.includes('final') ||
    lower.includes('bônus') ||
    lower.includes('bonus')
  );
}

// Generate chapter title from folder/file name
export function generateChapterTitle(name: string, number: number | null): string {
  if (number !== null) {
    // Format: "Capítulo 001" or "Capítulo 1.5"
    if (Number.isInteger(number)) {
      return `Capítulo ${String(number).padStart(3, '0')}`;
    } else {
      return `Capítulo ${number}`;
    }
  }

  // For special chapters, use the original name
  if (isSpecialChapter(name)) {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  return name;
}

// Sort chapters by number, with special chapters at the end
export function sortChapters<T extends { folderName: string; chapterNumber: number | null }>(chapters: T[]): T[] {
  return [...chapters].sort((a, b) => {
    // Both have numbers
    if (a.chapterNumber !== null && b.chapterNumber !== null) {
      return a.chapterNumber - b.chapterNumber;
    }

    // Only A has number
    if (a.chapterNumber !== null) {
      return -1;
    }

    // Only B has number
    if (b.chapterNumber !== null) {
      return 1;
    }

    // Neither has number, sort alphabetically
    return a.folderName.localeCompare(b.folderName, 'pt-BR');
  });
}

// Sort pages naturally
export function sortPages(pages: string[]): string[] {
  return [...pages].sort(naturalSort);
}

// Detect chapter structure from files
export interface DetectedChapter {
  folderName: string;
  chapterNumber: number | null;
  chapterTitle: string;
  isSpecial: boolean;
  files: string[];
}

export function detectChaptersFromFolders(folders: { name: string; files: string[] }[]): DetectedChapter[] {
  const chapters: DetectedChapter[] = [];

  for (const folder of folders) {
    const chapterNumber = detectChapterNumber(folder.name);
    const isSpecial = isSpecialChapter(folder.name);
    const chapterTitle = generateChapterTitle(folder.name, chapterNumber);

    chapters.push({
      folderName: folder.name,
      chapterNumber,
      chapterTitle,
      isSpecial,
      files: sortPages(folder.files),
    });
  }

  return sortChapters(chapters);
}

// Detect chapters from archive files
export function detectChaptersFromArchives(archives: string[]): DetectedChapter[] {
  const chapters: DetectedChapter[] = [];

  for (const archive of archives) {
    // Remove extension
    const name = archive.replace(/\.(cbz|zip|cbr)$/i, '');
    const chapterNumber = detectChapterNumber(name);
    const isSpecial = isSpecialChapter(name);
    const chapterTitle = generateChapterTitle(name, chapterNumber);

    chapters.push({
      folderName: name,
      chapterNumber,
      chapterTitle,
      isSpecial,
      files: [archive],
    });
  }

  return sortChapters(chapters);
}

// Validate chapter structure
export function validateChapterStructure(chapter: DetectedChapter): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (chapter.files.length === 0) {
    errors.push('Capítulo não contém arquivos');
  }

  // Check for supported image formats
  const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];
  const nonImageFiles = chapter.files.filter(f => {
    const ext = f.split('.').pop()?.toLowerCase() || '';
    return !imageExtensions.includes(ext);
  });

  if (nonImageFiles.length > 0) {
    warnings.push(`${nonImageFiles.length} arquivo(s) não são imagens e serão ignorados`);
  }

  // Check for reasonable page count
  if (chapter.files.length > 100) {
    warnings.push('Capítulo com mais de 100 páginas - verifique se está correto');
  }

  if (chapter.files.length < 1) {
    errors.push('Capítulo deve ter pelo menos 1 página');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// Reorder chapters manually
export function reorderChapters(
  chapters: DetectedChapter[],
  newOrder: number[]
): DetectedChapter[] {
  const reordered: DetectedChapter[] = [];

  for (const index of newOrder) {
    if (index >= 0 && index < chapters.length) {
      reordered.push(chapters[index]);
    }
  }

  // Add any chapters not in newOrder
  for (let i = 0; i < chapters.length; i++) {
    if (!newOrder.includes(i)) {
      reordered.push(chapters[i]);
    }
  }

  return reordered;
}

// Assign sequential numbers to chapters
export function assignSequentialNumbers(
  chapters: DetectedChapter[],
  startFrom: number = 1
): DetectedChapter[] {
  return chapters.map((ch, index) => ({
    ...ch,
    chapterNumber: startFrom + index,
    chapterTitle: `Capítulo ${String(startFrom + index).padStart(3, '0')}`,
  }));
}

// Parse chapter range (e.g., "1-10" or "1,2,3,5-8")
export function parseChapterRange(range: string): number[] {
  const numbers: number[] = [];
  const parts = range.split(',').map(p => p.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(s => parseInt(s.trim()));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          numbers.push(i);
        }
      }
    } else {
      const num = parseInt(part);
      if (!isNaN(num)) {
        numbers.push(num);
      }
    }
  }

  return [...new Set(numbers)].sort((a, b) => a - b);
}
