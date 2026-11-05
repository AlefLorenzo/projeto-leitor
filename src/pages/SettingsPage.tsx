import { useState, useEffect } from 'react';
import { AppSettings, OnlineReadingNetworkPreference } from '../types';
import { getSettings, saveSettings } from '../services/settings';
import { getStorageStats, getAllMangas, deleteManga } from '../services/database';
import { formatFileSize } from '../services/import';
import { clearAllData, seedDemoData } from '../services/seed';
import { useToast } from '../components/Toast';
import { checkRemoteUpdate, applyOtaUpdate, CURRENT_APP_VERSION, UpdateCheckResult } from '../services/otaUpdate';

export default function SettingsPage() {
  const { addToast } = useToast();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [storageInfo, setStorageInfo] = useState<{ total: number; byManga: { id: string; title: string; size: number }[] }>({ total: 0, byManga: [] });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const res = await checkRemoteUpdate();
      setUpdateInfo(res);
      if (res.hasUpdate) {
        addToast(`Nova versão ${res.remoteVersion} encontrada!`, 'success');
      } else {
        addToast('Você já está na versão mais recente', 'info');
      }
    } catch {
      addToast('Erro ao consultar atualizações no GitHub', 'error');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (!updateInfo?.bundleUrl) return;
    setIsApplyingUpdate(true);
    try {
      addToast('Baixando pacote web do GitHub...', 'info');
      await applyOtaUpdate(updateInfo.bundleUrl, updateInfo.remoteVersion || '1.2.0', (pct) => {
        setUpdateProgress(pct);
      }, updateInfo.checksum);
      addToast('Atualização aplicada com sucesso! Reiniciando...', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Falha ao aplicar atualização OTA', 'error');
      setIsApplyingUpdate(false);
    }
  };

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
    addToast('Todos os dados foram removidos', 'success');
    window.location.reload();
  };

  const handleReloadDemo = async () => {
    if (!confirm('Isso irá limpar todos os dados e carregar a demonstração novamente. Continuar?')) return;
    
    setReloading(true);
    try {
      await clearAllData();
      await seedDemoData();
      addToast('Demonstração recarregada com sucesso!', 'success');
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Error reloading demo:', error);
      addToast('Erro ao recarregar demonstração', 'error');
      setReloading(false);
    }
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

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleReloadDemo}
            disabled={reloading}
            className="flex-1 py-2 text-xs text-violet-light border border-violet-accent/20 rounded-lg hover:bg-violet-accent/10 disabled:opacity-50"
          >
            {reloading ? 'Recarregando...' : '🎮 Recarregar Demo'}
          </button>
          <button
            onClick={handleClearAll}
            className="flex-1 py-2 text-xs text-error border border-error/20 rounded-lg hover:bg-error/10"
          >
            🗑️ Limpar tudo
          </button>
        </div>
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

      {/* Leitura Online (Sob Demanda) */}
      <section className="glass-card rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-graphite-100 mb-2 flex items-center gap-2">
          <span>🌐</span> Leitura Online
        </h2>
        <p className="text-xs text-graphite-400 mb-4">
          Escolha quando o aplicativo poderá carregar capítulos pela internet sem baixá-los previamente.
        </p>
        <div className="space-y-2">
          <label
            onClick={() => updateSetting('onlineReadingNetwork', 'wifi_only')}
            className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
              (settings.onlineReadingNetwork || 'wifi_only') === 'wifi_only'
                ? 'bg-violet-accent/15 border-violet-accent/50 text-white'
                : 'bg-graphite-800/40 border-graphite-700/40 text-graphite-300 hover:bg-graphite-800/70'
            }`}
          >
            <input
              type="radio"
              name="onlineReadingNetwork"
              checked={(settings.onlineReadingNetwork || 'wifi_only') === 'wifi_only'}
              onChange={() => {}}
              className="mt-1 text-violet-accent"
            />
            <div className="flex-1 text-xs">
              <p className="font-semibold text-graphite-100 flex items-center gap-1.5">
                <span>📶 Somente Wi-Fi</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-normal">
                  Padrão recomendado
                </span>
              </p>
              <p className="text-graphite-400 mt-0.5">
                Permite leitura online somente quando a conexão Wi-Fi for confirmada. Bloqueia dados móveis e conexões desconhecidas para proteger seu plano de dados.
              </p>
            </div>
          </label>

          <label
            onClick={() => updateSetting('onlineReadingNetwork', 'ask_cellular')}
            className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
              settings.onlineReadingNetwork === 'ask_cellular'
                ? 'bg-violet-accent/15 border-violet-accent/50 text-white'
                : 'bg-graphite-800/40 border-graphite-700/40 text-graphite-300 hover:bg-graphite-800/70'
            }`}
          >
            <input
              type="radio"
              name="onlineReadingNetwork"
              checked={settings.onlineReadingNetwork === 'ask_cellular'}
              onChange={() => {}}
              className="mt-1 text-violet-accent"
            />
            <div className="flex-1 text-xs">
              <p className="font-semibold text-graphite-100">📱 Perguntar antes de usar dados móveis</p>
              <p className="text-graphite-400 mt-0.5">
                Carrega livremente no Wi-Fi e solicita autorização por capítulo caso esteja em rede móvel ou conexão de tipo desconhecido.
              </p>
            </div>
          </label>

          <label
            onClick={() => updateSetting('onlineReadingNetwork', 'disabled')}
            className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
              settings.onlineReadingNetwork === 'disabled'
                ? 'bg-violet-accent/15 border-violet-accent/50 text-white'
                : 'bg-graphite-800/40 border-graphite-700/40 text-graphite-300 hover:bg-graphite-800/70'
            }`}
          >
            <input
              type="radio"
              name="onlineReadingNetwork"
              checked={settings.onlineReadingNetwork === 'disabled'}
              onChange={() => {}}
              className="mt-1 text-violet-accent"
            />
            <div className="flex-1 text-xs">
              <p className="font-semibold text-graphite-100">🚫 Desativada</p>
              <p className="text-graphite-400 mt-0.5">
                Desativa a leitura online. Permite ler somente capítulos que já foram baixados e salvos localmente na biblioteca offline.
              </p>
            </div>
          </label>
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

      {/* OTA Live Update */}
      <section className="glass-card rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-graphite-100 flex items-center gap-2">
            <span>🚀</span> Atualização OTA (Live Update)
          </h2>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-violet-accent/20 text-violet-light border border-violet-accent/30 font-semibold">
            v{CURRENT_APP_VERSION}
          </span>
        </div>
        <p className="text-xs text-graphite-400 mb-4">
          Verifica e aplica atualizações de interface e correções diretamente do GitHub sem precisar reinstalar o APK.
        </p>

        {updateInfo?.hasUpdate ? (
          <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-xl p-3.5 mb-3">
            <p className="text-xs font-semibold text-emerald-400 mb-1">
              ✨ Nova versão disponível: {updateInfo.remoteVersion}
            </p>
            {updateInfo.releaseNotes && (
              <p className="text-[11px] text-graphite-300 mb-3">{updateInfo.releaseNotes}</p>
            )}
            <button
              onClick={handleApplyUpdate}
              disabled={isApplyingUpdate}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 shadow"
            >
              {isApplyingUpdate ? `Instalando atualização (${updateProgress}%)...` : '⚡ Aplicar Atualização Agora'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleCheckUpdate}
            disabled={checkingUpdate}
            className="w-full py-2 bg-graphite-800 hover:bg-graphite-700 text-graphite-200 rounded-lg text-xs font-medium border border-graphite-700/50 transition disabled:opacity-50"
          >
            {checkingUpdate ? 'Verificando no GitHub...' : '🔍 Verificar Atualizações no GitHub'}
          </button>
        )}
      </section>

      {/* About */}
      <section className="glass-card rounded-xl p-5">
        <h2 className="text-sm font-semibold text-graphite-100 mb-4 flex items-center gap-2">
          <span>ℹ️</span> Sobre
        </h2>
        <div className="space-y-2 text-xs text-graphite-400">
          <p><span className="text-graphite-300">Manga Offline</span> — v{CURRENT_APP_VERSION}</p>
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
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0 pr-2">
        <p className="text-xs font-medium text-graphite-200">{label}</p>
        <p className="text-[10px] text-graphite-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${value ? 'bg-violet-accent' : 'bg-graphite-700'}`}
      >
        <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${value ? 'left-5.5' : 'left-0.5'}`}></div>
      </button>
    </div>
  );
}
