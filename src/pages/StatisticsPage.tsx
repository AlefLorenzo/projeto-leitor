import { useState, useEffect } from 'react';
import { ReadingStats } from '../types';
import { calculateStats, formatReadTime } from '../services/statistics';
import { formatFileSize } from '../services/import';

export default function StatisticsPage() {
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const s = await calculateStats();
      setStats(s);
      setLoading(false);
    };
    load();
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-violet-accent animate-pulse">Calculando estatísticas...</div>
      </div>
    );
  }

  const maxDayCount = Math.max(...stats.readingByDay.map(d => d.count), 1);
  const maxMonthPages = Math.max(...stats.monthlyActivity.map(m => m.pages), 1);

  return (
    <div className="slide-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-graphite-100 mb-1">Estatísticas</h1>
        <p className="text-sm text-graphite-400">Acompanhe seu progresso de leitura</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon="📚" value={stats.totalMangas} label="Obras na biblioteca" />
        <StatCard icon="📖" value={stats.totalChapters} label="Capítulos" />
        <StatCard icon="🖼️" value={stats.totalPages} label="Páginas totais" />
        <StatCard icon="⏱️" value={formatReadTime(stats.totalReadTime)} label="Tempo de leitura" />
      </div>

      {/* Reading Progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-xs text-graphite-400 uppercase tracking-wider mb-2">Páginas Lidas</h3>
          <p className="text-3xl font-bold text-violet-light">{stats.totalPagesRead}</p>
          <p className="text-xs text-graphite-500 mt-1">de {stats.totalPages} disponíveis</p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-xs text-graphite-400 uppercase tracking-wider mb-2">Sequência Atual</h3>
          <p className="text-3xl font-bold text-success">{stats.currentStreak} <span className="text-lg">dias</span></p>
          <p className="text-xs text-graphite-500 mt-1">Recorde: {stats.longestStreak} dias</p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-xs text-graphite-400 uppercase tracking-wider mb-2">Média por Obra</h3>
          <p className="text-3xl font-bold text-graphite-100">{stats.averagePerPage}</p>
          <p className="text-xs text-graphite-500 mt-1">páginas por obra</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Reading by Day */}
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold text-graphite-100 mb-4">📊 Leitura por Dia da Semana</h3>
          <div className="flex items-end gap-2 h-32">
            {stats.readingByDay.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-graphite-800 rounded-t relative" style={{ height: '100%' }}>
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-violet-accent to-violet-light rounded-t transition-all"
                    style={{ height: `${(d.count / maxDayCount) * 100}%`, minHeight: d.count > 0 ? '4px' : '0' }}
                  ></div>
                </div>
                <span className="text-[10px] text-graphite-500">{d.day}</span>
                <span className="text-[10px] text-graphite-400">{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Activity */}
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold text-graphite-100 mb-4">📈 Atividade Mensal</h3>
          <div className="flex items-end gap-2 h-32">
            {stats.monthlyActivity.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-graphite-800 rounded-t relative" style={{ height: '100%' }}>
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-violet-dark to-violet-accent rounded-t transition-all"
                    style={{ height: `${(m.pages / maxMonthPages) * 100}%`, minHeight: m.pages > 0 ? '4px' : '0' }}
                  ></div>
                </div>
                <span className="text-[10px] text-graphite-500">{m.month}</span>
                <span className="text-[10px] text-graphite-400">{m.pages}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Favorite Genres */}
      {stats.favoriteGenres.length > 0 && (
        <div className="glass-card rounded-xl p-5 mb-8">
          <h3 className="text-sm font-semibold text-graphite-100 mb-4">⭐ Gêneros Favoritos</h3>
          <div className="space-y-2">
            {stats.favoriteGenres.map((g, i) => {
              const maxCount = stats.favoriteGenres[0]?.count || 1;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-graphite-300 w-24 truncate">{g.genre}</span>
                  <div className="flex-1 h-2 bg-graphite-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-accent to-violet-light rounded-full"
                      style={{ width: `${(g.count / maxCount) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-graphite-400 w-8 text-right">{g.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {stats.totalMangas === 0 && (
        <div className="glass-card rounded-xl p-8 text-center">
          <span className="text-4xl mb-3 block">📊</span>
          <p className="text-sm text-graphite-400">Importe obras para ver suas estatísticas de leitura</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <div className="glass-card rounded-xl p-4 text-center">
      <span className="text-2xl mb-2 block">{icon}</span>
      <p className="text-xl font-bold text-graphite-100">{value}</p>
      <p className="text-xs text-graphite-500">{label}</p>
    </div>
  );
}
