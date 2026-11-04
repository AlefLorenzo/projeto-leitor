import { OnlineSourceAdapter, SourceAvailability } from './types';
import { MangaDexAdapter } from './MangaDexAdapter';
import { LycantoonsAdapter } from './LycantoonsAdapter';

class SourceManager {
  private sources: Map<string, OnlineSourceAdapter> = new Map();
  private activeSourceId: string = 'mangadex';
  private STORAGE_KEY = 'manga_offline_active_source';

  constructor() {
    this.registerSource(new MangaDexAdapter());
    this.registerSource(new LycantoonsAdapter());

    // Carregar fonte preferida
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved && this.sources.has(saved)) {
      this.activeSourceId = saved;
    }
  }

  registerSource(adapter: OnlineSourceAdapter) {
    this.sources.set(adapter.id, adapter);
  }

  getAllSources(): OnlineSourceAdapter[] {
    return Array.from(this.sources.values());
  }

  getSource(id: string): OnlineSourceAdapter | undefined {
    return this.sources.get(id);
  }

  getActiveSource(): OnlineSourceAdapter {
    return this.sources.get(this.activeSourceId) || this.sources.get('mangadex')!;
  }

  setActiveSource(sourceId: string): void {
    if (this.sources.has(sourceId)) {
      this.activeSourceId = sourceId;
      localStorage.setItem(this.STORAGE_KEY, sourceId);
    }
  }

  async checkAvailability(sourceId?: string): Promise<SourceAvailability> {
    const target = sourceId ? this.sources.get(sourceId) : this.getActiveSource();
    if (!target) return { available: false, reason: 'Fonte não encontrada' };
    return target.isAvailable();
  }
}

export const onlineSourceManager = new SourceManager();
