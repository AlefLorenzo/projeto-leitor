import { useState, useEffect } from 'react';
import { MangaFileInfo } from '../types';
import { getMangaFileInfo, formatFileSize, exportMangaAsJSON } from '../services/fileManager';
import { useToast } from '../components/Toast';
import { ConfirmModal } from '../components/ConfirmModal';

interface FileManagerPageProps {
  mangaId: string;
  mangaTitle: string;
  onBack: () => void;
}

export default function FileManagerPage({ mangaId, mangaTitle, onBack }: FileManagerPageProps) {
  const { addToast } = useToast();
  const [fileInfo, setFileInfo] = useState<MangaFileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [showExportConfirm, setShowExportConfirm] = useState(false);

  useEffect(() => {
    loadFileInfo();
  }, [mangaId]);

  const loadFileInfo = async () => {
    setLoading(true);
    try {
      const info = await getMangaFileInfo(mangaId);
      setFileInfo(info);
    } catch (error) {
      console.error('Error loading file info:', error);
      addToast('Erro ao carregar informações', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const json = await exportMangaAsJSON(mangaId);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${mangaTitle.replace(/[^a-z0-9]/gi, '_')}_metadata.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Metadados exportados com sucesso!', 'success');
      setShowExportConfirm(false);
    } catch (error) {
      console.error('Error exporting:', error);
      addToast('Erro ao exportar metadados', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-violet-accent animate-pulse">Carregando informações...</div>
      </div>
    );
  }

  if (!fileInfo) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <span className="text-4xl mb-3 block">❌</span>
        <p className="text-sm text-graphite-400">Não foi possível carregar as informações</p>
        <button onClick={onBack} className="mt-4 text-sm text-violet-light hover:underline">Voltar</button>
      </div>
    );
  }

  return (
    <div className="slide-up">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-graphite-400 hover:text-graphite-200 mb-4">
        ← Voltar
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-graphite-100 mb-1">Gerenciar Arquivos</h1>
        <p className="text-sm text-graphite-400">{mangaTitle}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 mb-6">
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-lg font-bold text-violet-light">{fileInfo.chaptersCount}</p>
          <p className="text-xs text-graphite-500">Capítulos</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-lg font-bold text-graphite-100">{fileInfo.pagesCount}</p>
          <p className="text-xs text-graphite-500">Páginas</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-lg font-bold text-graphite-100">{formatFileSize(fileInfo.totalSize)}</p>
          <p className="text-xs text-graphite-500">Tamanho total</p>
        </div>
        <div className="glass-card rounded-xl p-4 text-center">
          <p className="text-lg font-bold text-graphite-100">
            {new Date(fileInfo.lastModified).toLocaleDateString('pt-BR')}
          </p>
          <p className="text-xs text-graphite-500">Última modificação</p>
        </div>
      </div>

      {/* Storage Location */}
      <div className="glass-card rounded-xl p-4 mb-6">
        <h3 className="text-sm font-semibold text-graphite-100 mb-2 flex items-center gap-2">
          <span>📁</span> Localização
        </h3>
        <p className="text-xs text-graphite-400 font-mono bg-graphite-900/50 p-2 rounded break-all">
          {fileInfo.storageLocation}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setShowExportConfirm(true)}
          className="px-4 py-2 bg-violet-accent/10 border border-violet-accent/30 text-violet-light rounded-lg text-xs hover:bg-violet-accent/20 transition-colors"
        >
          📤 Exportar Metadados
        </button>
      </div>

      {/* Chapters List */}
      <div className="glass-card rounded-xl p-4">
        <h3 className="text-sm font-semibold text-graphite-100 mb-4 flex items-center gap-2">
          <span>📚</span> Capítulos e Páginas
        </h3>
        <div className="space-y-2">
          {fileInfo.chapters.map((chapter) => (
            <div key={chapter.chapterId} className="bg-graphite-800/30 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedChapter(expandedChapter === chapter.chapterId ? null : chapter.chapterId)}
                className="w-full flex items-center justify-between p-3 hover:bg-graphite-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{expandedChapter === chapter.chapterId ? '▼' : '▶'}</span>
                  <div className="text-left">
                    <p className="text-sm font-medium text-graphite-200">{chapter.chapterTitle}</p>
                    <p className="text-xs text-graphite-500">
                      {chapter.pagesCount} páginas • {formatFileSize(chapter.size)}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-graphite-400">#{chapter.chapterNumber}</span>
              </button>

              {expandedChapter === chapter.chapterId && (
                <div className="px-3 pb-3 border-t border-graphite-700/30">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                    {chapter.pages.map((page) => (
                      <div key={page.pageId} className="bg-graphite-900/50 rounded p-2 text-center">
                        <p className="text-xs text-graphite-300">Página {page.pageNumber}</p>
                        <p className="text-[10px] text-graphite-500">{formatFileSize(page.size)}</p>
                        <p className="text-[10px] text-graphite-500 uppercase">{page.format}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Export Confirm Modal */}
      <ConfirmModal
        isOpen={showExportConfirm}
        title="Exportar Metadados"
        message="Isso irá exportar os metadados da obra (título, autor, capítulos, etc.) em formato JSON. As imagens não serão incluídas."
        confirmText="Exportar"
        variant="info"
        icon="📤"
        onConfirm={handleExport}
        onCancel={() => setShowExportConfirm(false)}
      />
    </div>
  );
}
