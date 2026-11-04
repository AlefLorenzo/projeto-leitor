import { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { getSettings, saveSettings } from '../services/settings';
import { getStorageStats, getAllMangas, deleteManga } from '../services/database';
import { formatFileSize } from '../services/import';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [storageInfo, setStorageInfo] = useState<{ total: number; byManga: { id: string; title: string; size: number }[] }>({ total: 0, byManga: [] });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [s, stats, mangas] = await Promise.all([
        getSettings(),
        getStorageStats(),
        getAllMangas(),
      ]);
      setSettings(s);
      setStorageInfo({
        total: stats.totalSize,
        byManga: mangas.map(m => ({ id: m.id, title: m.title, size: m.storageSize })).sort((a, b) => b.size - a.size),
      });
      setLoading(false);
    };
    load();
  }, []);

  const updateSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (!settings) return;
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await saveSettings({ [key]: value });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearAll = async () => {
    if (!confirm('Tem certeza que deseja excluir TODAS as obras? Esta ação não pode ser desfeita.')) return;
    if (!confirm('CONFIRMAÇÃO FINAL: Todos os dados serão perdidos permanentemente.')) return;
    
    const mangas = await getAllMangas();
    for (const manga of mangas) {
      await deleteManga(manga.id);
    }
    window.location.reload();
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-violet-accent animate-pulse">Carregando configurações...</div>
      </div>
    );
  }

  return (
    <div className="slide-up max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-graphite-100">Configurações</h1>
          <p className="text-sm text-graphite-400">Personalize sua experiência</p>
        </div>
        {saved && (
          <span className="text-xs text-success bg-success/10 px-2 py-1 rounded">✓ Salvo</span>
        )}
      </div>

      {/* Storage Section */}
      <section className="glass-card rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-graphite-100 mb-4 flex items-center gap-2">
          <span>💾</span> Armazenamento
        </h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-graphite-800/40 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-violet-light">{formatFileSize(storageInfo.total)}</p>
            <p className="text-[10px] text-graphite-500">Total utilizado</p>
          </div>
          <div className="bg-graphite-800/40 rounded-lg p-3 text-center">
            <p className="text-lg font-bold text-graphite-100">{storageInfo.byManga.length}</p>
            <p className="text-[10px] text-graphite-500">Obras armazenadas</p>
          </div>
        </div>

        {/* Storage by manga */}
        {storageInfo.byManga.length > 0 && (
          <div className="space-y-2 mb-4">
            {storageInfo.byManga.slice(0, 5).map(m => (
              <div key={m.id} className="flex items-center justify-between bg-graphite-800/30 rounded-lg px-3 py-2">
                <span className="text-xs text-graphite-300 truncate flex-1">{m.title}</span>
                <span className="text-xs text-graphite-500 ml-2">{formatFileSize(m.size)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Storage limit */}
        <div className="mb-4">
          <label className="text-xs text-graphite-400 mb-1 block">Limite de armazenamento: {settings.maxStorageMB} MB</label>
          <input
            type="range"
            min="1000"
            max="20000"
            step="500"
            value={settings.maxStorageMB}
            onChange={(e) => updateSetting('maxStorageMB', parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        <button
          onClick={handleClearAll}
          className="w-full py-2 text-xs text-error border border-error/20 rounded-lg hover:bg-error/10"
        >
          🗑️ Limpar todos os dados
        </button>
      </section>

      {/* Reader Settings */}
      <section className="glass-card rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-graphite-100 mb-4 flex items-center gap-2">
          <span>📖</span> Leitor
        </h2>
        <div className="space-y-4">
          <ToggleSetting
            label="Salvar progresso automaticamente"
            description="Salva a página atual ao mudar de capítulo"
            value={settings.autoSaveProgress}
            onChange={(v) => updateSetting('autoSaveProgress', v)}
          />
          <ToggleSetting
            label="Mostrar número da página"
            description="Exibe o indicador de página no leitor"
            value={settings.showPageNumber}
            onChange={(v) => updateSetting('showPageNumber', v)}
          />
          <ToggleSetting
            label="Modo imersivo"
            description="Oculta automaticamente os controles"
            value={settings.immersiveMode}
            onChange={(v) => updateSetting('immersiveMode', v)}
          />
          <div>
            <label className="text-xs text-graphite-400 mb-1 block">Brilho: {settings.brightness}%</label>
            <input
              type="range"
              min="20"
              max="100"
              value={settings.brightness}
              onChange={(e) => updateSetting('brightness', parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* Download Settings */}
      <section className="glass-card rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-graphite-100 mb-4 flex items-center gap-2">
          <span>📥</span> Downloads
        </h2>
        <div className="space-y-4">
          <ToggleSetting
            label="Apenas Wi-Fi"
            description="Baixar apenas quando conectado ao Wi-Fi"
            value={settings.downloadWifiOnly}
            onChange={(v) => updateSetting('downloadWifiOnly', v)}
          />
          <div>
            <label className="text-xs text-graphite-400 mb-1 block">Downloads simultâneos: {settings.maxConcurrentDownloads}</label>
            <input
              type="range"
              min="1"
              max="5"
              value={settings.maxConcurrentDownloads}
              onChange={(e) => updateSetting('maxConcurrentDownloads', parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* Update Settings */}
      <section className="glass-card rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-graphite-100 mb-4 flex items-center gap-2">
          <span>🔄</span> Atualizações
        </h2>
        <div className="space-y-4">
          <ToggleSetting
            label="Atualização automática"
            description="Verificar novos capítulos periodicamente"
            value={settings.autoUpdate}
            onChange={(v) => updateSetting('autoUpdate', v)}
          />
          <div>
            <label className="text-xs text-graphite-400 mb-1 block">Intervalo: {settings.updateIntervalHours}h</label>
            <input
              type="range"
              min="6"
              max="48"
              step="6"
              value={settings.updateIntervalHours}
              onChange={(e) => updateSetting('updateIntervalHours', parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="glass-card rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-graphite-100 mb-4 flex items-center gap-2">
          <span>🔔</span> Notificações
        </h2>
        <ToggleSetting
          label="Notificações habilitadas"
          description="Receber alertas de novos capítulos"
          value={settings.notificationsEnabled}
          onChange={(v) => updateSetting('notificationsEnabled', v)}
        />
      </section>

      {/* About */}
      <section className="glass-card rounded-xl p-5">
        <h2 className="text-sm font-semibold text-graphite-100 mb-4 flex items-center gap-2">
          <span>ℹ️</span> Sobre
        </h2>
        <div className="space-y-2 text-xs text-graphite-400">
          <p><span className="text-graphite-300">Manga Offline</span> — v1.0.0</p>
          <p>Aplicativo de leitura offline com biblioteca pessoal</p>
          <p>Desenvolvido com React + TypeScript + IndexedDB</p>
          <p className="text-graphite-500 mt-2">Design: Dark Premium (Grafite + Violeta)</p>
        </div>
      </section>
    </div>
  );
}

function ToggleSetting({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-graphite-200">{label}</p>
        <p className="text-[10px] text-graphite-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition-colors relative ${value ? 'bg-violet-accent' : 'bg-graphite-700'}`}
      >
        <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${value ? 'left-5.5' : 'left-0.5'}`}></div>
      </button>
    </div>
  );
}
