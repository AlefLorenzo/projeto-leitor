import { ReadingStats, Manga } from '../types';
import { getAllMangas, getRecentProgress } from './database';

export async function calculateStats(): Promise<ReadingStats> {
  const mangas = await getAllMangas();
  const recentProgress = await getRecentProgress(100);

  const totalMangas = mangas.length;
  const totalChapters = mangas.reduce((sum, m) => sum + m.totalChapters, 0);
  const totalPages = mangas.reduce((sum, m) => sum + m.totalPages, 0);
  
  // Calculate pages read from progress
  const totalPagesRead = recentProgress.reduce((sum, p) => sum + p.pageNumber, 0);
  
  // Estimate reading time (average 30 seconds per page)
  const totalReadTime = Math.round(totalPagesRead * 0.5); // minutes
  
  // Calculate streaks
  const days = new Set(recentProgress.map(p => {
    const d = new Date(p.lastReadAt);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }));
  
  const sortedDays = Array.from(days).sort().reverse();
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let i = 0; i < sortedDays.length; i++) {
    const dayDate = new Date(sortedDays[i]);
    dayDate.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (i === 0 && diff <= 1) {
      currentStreak = 1;
    } else if (i > 0) {
      const prevDate = new Date(sortedDays[i - 1]);
      const dayDiff = Math.round((prevDate.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24));
      if (dayDiff === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }
  
  // Calculate longest streak
  const allDays = Array.from(days).sort();
  tempStreak = 1;
  longestStreak = 1;
  
  for (let i = 1; i < allDays.length; i++) {
    const prev = new Date(allDays[i - 1]);
    const curr = new Date(allDays[i]);
    const diff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diff === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }
  
  // Favorite genres
  const genreCount: Record<string, number> = {};
  mangas.forEach(m => {
    m.genres.forEach(g => {
      genreCount[g] = (genreCount[g] || 0) + 1;
    });
  });
  
  const favoriteGenres = Object.entries(genreCount)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  // Reading by day of week
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const readingByDay = dayNames.map((day, index) => ({
    day,
    count: recentProgress.filter(p => new Date(p.lastReadAt).getDay() === index).length,
  }));
  
  // Monthly activity (last 6 months)
  const monthlyActivity: { month: string; pages: number }[] = [];
  const now = new Date();
  
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = monthDate.toLocaleDateString('pt-BR', { month: 'short' });
    const monthPages = recentProgress.filter(p => {
      const pDate = new Date(p.lastReadAt);
      return pDate.getMonth() === monthDate.getMonth() && pDate.getFullYear() === monthDate.getFullYear();
    }).reduce((sum, p) => sum + p.pageNumber, 0);
    
    monthlyActivity.push({ month: monthName, pages: monthPages });
  }
  
  const averagePerPage = totalMangas > 0 ? Math.round(totalPages / totalMangas) : 0;
  
  return {
    totalMangas,
    totalChapters,
    totalPages,
    totalReadTime,
    totalPagesRead,
    longestStreak,
    currentStreak,
    averagePerPage,
    favoriteGenres,
    readingByDay,
    monthlyActivity,
  };
}

export function formatReadTime(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}min`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

export function getMangaByStatus(mangas: Manga[], status: string): Manga[] {
  if (status === 'all') return mangas;
  if (status === 'favorites') return mangas.filter(m => m.isFavorite);
  return mangas.filter(m => m.status === status);
}
