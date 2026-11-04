import { useState, useRef } from 'react';
import { ImportOptions, ChapterImport, MangaType, ReadingDirection } from '../types';
import { importManga, importFromArchive, detectChaptersFromFiles, getDefaultReadingDirection, formatFileSize } from '../services/import';

interface ImportPageProps {
  onComplete: (mangaId: string) => void;
  onCancel: () => void;
}

type ImportStep = 'type' | 'files' | 'info' | 'chapters' | 'review' | 'processing' | 'done';

export default function ImportPage({ onComplete, onCancel }: ImportPageProps) {
  const [step, setStep] = useState<ImportStep>('type');
  const [importType, setImportType] = useState<'single' | 'multi'>('single');
  const [files, setFiles] = useState<File[]>([]);
  const [options, setOptions] = useState<ImportOptions>({
    title: '',
    genres: [],
    type: 'manga',
    readingDirection: 'rtl',
  });
  const [chapters, setChapters] = useState<ChapterImport[]>([]);
  const [genreInput, setGenreInput] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<{ success: boolean; mangaId?: string; chaptersCreated: number; pagesCreated: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const fileArray = Array.from(selectedFiles).filter(f =>
      f.type.startsWith('image/') || f.name.match(/\.(jpg|jpeg|png|webp|gif|bmp)$/i)
    );
    setFiles(fileArray);
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const fileArray = Array.from(e.target.files).filter(f =>
      f.type.startsWith('image/') || f.name.match(/\.(jpg|jpeg|png|webp|gif|bmp)$/i)
    );
    setFiles(fileArray);

    // Auto-detect chapters from folder structure
    const detected = detectChaptersFromFiles(fileArray);
    const detectedChapters: ChapterImport[] = [];
    let chapterNum = 1;

    detected.forEach((chapterFiles, folderName) => {
      detectedChapters.push({
        title: `Capítulo ${String(chapterNum).padStart(2, '0')}`,
        number: chapterNum,
        files: chapterFiles,
      });
      chapterNum++;
    });

    if (detectedChapters.length > 1) {
      setChapters(detectedChapters);
      setImportType('multi');
    }

    // Try to extract title from folder name
    if (fileArray[0]?.webkitRelativePath) {
      const parts = fileArray[0].webkitRelativePath.split('/');
      if (parts[0] && !options.title) {
        setOptions(prev => ({ ...prev, title: parts[0] }));
      }
    }
  };

  const proceedToInfo = () => {
    if (files.length === 0) {
      setErrors(['Selecione pelo menos uma imagem']);
      return;
    }

    if (importType === 'single') {
      setChapters([{
        title: 'Capítulo 01',
        number: 1,
        files: files,
      }]);
    }

    setStep('info');
  };

  const proceedToChapters = () => {
    if (!options.title.trim()) {
      setErrors(['Informe o título da obra']);
      return;
    }
    setErrors([]);
    setStep('chapters');
  };

  const addChapter = () => {
    const newNum = chapters.length > 0 ? Math.max(...chapters.map(c => c.number)) + 1 : 1;
    setChapters([...chapters, {
      title: `Capítulo ${String(newNum).padStart(2, '0')}`,
      number: newNum,
      files: [],
    }]);
  };

  const updateChapter = (index: number, updates: Partial<ChapterImport>) => {
    setChapters(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c));
  };

  const removeChapter = (index: number) => {
    setChapters(prev => prev.filter((_, i) => i !== index));
  };

  const assignFilesToChapter = (chapterIndex: number, newFiles: FileList | null) => {
    if (!newFiles) return;
    const fileArray = Array.from(newFiles);
    updateChapter(chapterIndex, { files: [...chapters[chapterIndex].files, ...fileArray] });
  };

  const handleImport = async () => {
    setStep('processing');
    setErrors([]);

    // Check if files are archives (CBZ/ZIP)
    const isArchive = files.length > 0 && files.every(f => f.name.match(/\.(cbz|zip)$/i));

    if (isArchive) {
      const res = await importFromArchive(options, files);
      setResult(res);
      if (res.success || res.mangaId) {
        setStep('done');
      } else {
        setErrors(res.errors);
        setStep('chapters');
      }
      return;
    }

    const validChapters = chapters.filter(c => c.files.length > 0);
    if (validChapters.length === 0) {
      setErrors(['Adicione pelo menos um capítulo com páginas']);
      setStep('chapters');
      return;
    }

    const res = await importManga(options, validChapters);
    setResult(res);

    if (res.success || res.mangaId) {
      setStep('done');
    } else {
      setErrors(res.errors);
      setStep('chapters');
    }
  };

  const handleTypeChange = (type: MangaType) => {
    setOptions(prev => ({
      ...prev,
      type,
      readingDirection: getDefaultReadingDirection(type),
    }));
  };

  return (
    <div className="slide-up max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-graphite-100">Importar Obra</h1>
          <p className="text-sm text-graphite-400">Adicione mangás, manhwas ou manhuas à sua biblioteca</p>
        </div>
        <button onClick={onCancel} className="text-graphite-400 hover:text-graphite-200 text-sm">
          ✕ Cancelar
        </button>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8">
        {['type', 'files', 'info', 'chapters', 'review'].map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              step === s ? 'bg-violet-accent text-white' :
              ['type', 'files', 'info', 'chapters', 'review'].indexOf(step) > i ? 'bg-success text-white' :
              'bg-graphite-700 text-graphite-400'
            }`}>
              {['type', 'files', 'info', 'chapters', 'review'].indexOf(step) > i ? '✓' : i + 1}
            </div>
            {i < 4 && <div className="flex-1 h-px bg-graphite-700"></div>}
          </div>
        ))}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="glass-card rounded-lg p-3 mb-4 border border-error/30 bg-error/5">
          {errors.map((err, i) => (
            <p key={i} className="text-xs text-error">{err}</p>
          ))}
        </div>
      )}

      {/* Step: Type Selection */}
      {step === 'type' && (
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-graphite-100 mb-4">Tipo de Importação</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => { setImportType('single'); setStep('files'); }}
              className="p-6 rounded-xl border border-graphite-700/30 hover:border-violet-accent/40 transition-all text-left bg-graphite-800/30 hover:bg-graphite-800/50"
            >
              <span className="text-3xl mb-3 block">📄</span>
              <h3 className="text-sm font-semibold text-graphite-100 mb-1">Imagens Avulsas</h3>
              <p className="text-xs text-graphite-400">Selecionar imagens que formarão um único capítulo</p>
            </button>
            <button
              onClick={() => { setImportType('multi'); setStep('files'); }}
              className="p-6 rounded-xl border border-graphite-700/30 hover:border-violet-accent/40 transition-all text-left bg-graphite-800/30 hover:bg-graphite-800/50"
            >
              <span className="text-3xl mb-3 block">📁</span>
              <h3 className="text-sm font-semibold text-graphite-100 mb-1">Pasta com Capítulos</h3>
              <p className="text-xs text-graphite-400">Selecionar uma pasta com subpastas por capítulo</p>
            </button>
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.accept = '.cbz,.zip';
                input.onchange = async (e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.files && target.files.length > 0) {
                    const archiveFiles = Array.from(target.files);
                    setFiles(archiveFiles);
                    setImportType('multi');
                    // Auto-set title from first file
                    const firstName = archiveFiles[0].name.replace(/\.(cbz|zip)$/i, '');
                    setOptions(prev => ({ ...prev, title: firstName || 'Obra Importada' }));
                    setStep('info');
                  }
                };
                input.click();
              }}
              className="p-6 rounded-xl border border-graphite-700/30 hover:border-violet-accent/40 transition-all text-left bg-graphite-800/30 hover:bg-graphite-800/50"
            >
              <span className="text-3xl mb-3 block">📦</span>
              <h3 className="text-sm font-semibold text-graphite-100 mb-1">Arquivos CBZ/ZIP</h3>
              <p className="text-xs text-graphite-400">Cada arquivo será um capítulo</p>
            </button>
          </div>
        </div>
      )}

      {/* Step: File Selection */}
      {step === 'files' && (
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-graphite-100 mb-4">Selecionar Arquivos</h2>
          
          <div className="space-y-4">
            <div className="flex gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 p-4 rounded-lg border border-dashed border-graphite-600 hover:border-violet-accent/50 transition-all text-center bg-graphite-800/20"
              >
                <span className="text-2xl mb-2 block">🖼️</span>
                <p className="text-sm text-graphite-200">Selecionar Imagens</p>
                <p className="text-xs text-graphite-500 mt-1">JPG, PNG, WEBP</p>
              </button>
              <button
                onClick={() => folderInputRef.current?.click()}
                className="flex-1 p-4 rounded-lg border border-dashed border-graphite-600 hover:border-violet-accent/50 transition-all text-center bg-graphite-800/20"
              >
                <span className="text-2xl mb-2 block">📁</span>
                <p className="text-sm text-graphite-200">Selecionar Pasta</p>
                <p className="text-xs text-graphite-500 mt-1">Detectar capítulos automaticamente</p>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              onChange={handleFolderSelect}
              className="hidden"
              {...({ webkitdirectory: '', directory: '' } as any)}
            />

            {files.length > 0 && (
              <div className="bg-graphite-800/40 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-graphite-200">{files.length} arquivos selecionados</span>
                  <span className="text-xs text-graphite-400">{formatFileSize(files.reduce((s, f) => s + f.size, 0))}</span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {files.slice(0, 20).map((f, i) => (
                    <span key={i} className="text-[10px] bg-graphite-700/50 text-graphite-400 px-1.5 py-0.5 rounded">
                      {f.name}
                    </span>
                  ))}
                  {files.length > 20 && (
                    <span className="text-[10px] text-graphite-500">+{files.length - 20} mais</span>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => setStep('type')} className="px-4 py-2 text-sm text-graphite-400 hover:text-graphite-200">
                ← Voltar
              </button>
              <button
                onClick={proceedToInfo}
                disabled={files.length === 0}
                className="px-4 py-2 bg-violet-accent hover:bg-violet-dark disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium"
              >
                Próximo →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step: Manga Info */}
      {step === 'info' && (
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-graphite-100 mb-4">Informações da Obra</h2>
          
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="text-xs text-graphite-400 mb-1 block">Título *</label>
              <input
                type="text"
                value={options.title}
                onChange={(e) => setOptions(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 bg-graphite-800/60 border border-graphite-700/30 rounded-lg text-sm text-graphite-200 focus:outline-none focus:border-violet-accent/50"
                placeholder="Nome da obra"
              />
            </div>

            {/* Type */}
            <div>
              <label className="text-xs text-graphite-400 mb-1 block">Tipo</label>
              <div className="grid grid-cols-3 gap-2">
                {(['manga', 'manhwa', 'manhua'] as MangaType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => handleTypeChange(type)}
                    className={`p-2 rounded-lg border text-sm transition-all ${
                      options.type === type
                        ? 'border-violet-accent/50 bg-violet-accent/10 text-violet-light'
                        : 'border-graphite-700/30 text-graphite-400 hover:border-graphite-600'
                    }`}
                  >
                    {type === 'manga' ? '🇯🇵 Mangá' : type === 'manhwa' ? '🇰🇷 Manhwa' : '🇨🇳 Manhua'}
                  </button>
                ))}
              </div>
            </div>

            {/* Author & Artist */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-graphite-400 mb-1 block">Autor</label>
                <input
                  type="text"
                  value={options.author || ''}
                  onChange={(e) => setOptions(prev => ({ ...prev, author: e.target.value }))}
                  className="w-full px-3 py-2 bg-graphite-800/60 border border-graphite-700/30 rounded-lg text-sm text-graphite-200 focus:outline-none focus:border-violet-accent/50"
                  placeholder="Nome do autor"
                />
              </div>
              <div>
                <label className="text-xs text-graphite-400 mb-1 block">Artista</label>
                <input
                  type="text"
                  value={options.artist || ''}
                  onChange={(e) => setOptions(prev => ({ ...prev, artist: e.target.value }))}
                  className="w-full px-3 py-2 bg-graphite-800/60 border border-graphite-700/30 rounded-lg text-sm text-graphite-200 focus:outline-none focus:border-violet-accent/50"
                  placeholder="Nome do artista"
                />
              </div>
            </div>

            {/* Synopsis */}
            <div>
              <label className="text-xs text-graphite-400 mb-1 block">Sinopse</label>
              <textarea
                value={options.synopsis || ''}
                onChange={(e) => setOptions(prev => ({ ...prev, synopsis: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 bg-graphite-800/60 border border-graphite-700/30 rounded-lg text-sm text-graphite-200 focus:outline-none focus:border-violet-accent/50 resize-none"
                placeholder="Descrição da obra"
              />
            </div>

            {/* Genres */}
            <div>
              <label className="text-xs text-graphite-400 mb-1 block">Gêneros</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={genreInput}
                  onChange={(e) => setGenreInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && genreInput.trim()) {
                      setOptions(prev => ({ ...prev, genres: [...prev.genres, genreInput.trim()] }));
                      setGenreInput('');
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-graphite-800/60 border border-graphite-700/30 rounded-lg text-sm text-graphite-200 focus:outline-none focus:border-violet-accent/50"
                  placeholder="Adicionar gênero e pressionar Enter"
                />
              </div>
              {options.genres.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {options.genres.map((g, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 bg-violet-accent/10 text-violet-light rounded-full flex items-center gap-1">
                      {g}
                      <button onClick={() => setOptions(prev => ({ ...prev, genres: prev.genres.filter((_, j) => j !== i) }))} className="text-violet-light/60 hover:text-violet-light">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Cover */}
            <div>
              <label className="text-xs text-graphite-400 mb-1 block">Capa (opcional)</label>
              <button
                onClick={() => coverInputRef.current?.click()}
                className="px-3 py-2 bg-graphite-800/60 border border-graphite-700/30 rounded-lg text-sm text-graphite-300 hover:border-violet-accent/30"
              >
                {options.coverFile ? `✓ ${options.coverFile.name}` : '📷 Selecionar imagem de capa'}
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setOptions(prev => ({ ...prev, coverFile: e.target.files![0] }));
                  }
                }}
                className="hidden"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setStep('files')} className="px-4 py-2 text-sm text-graphite-400 hover:text-graphite-200">
                ← Voltar
              </button>
              <button
                onClick={proceedToChapters}
                className="px-4 py-2 bg-violet-accent hover:bg-violet-dark text-white rounded-lg text-sm font-medium"
              >
                Próximo →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step: Chapters */}
      {step === 'chapters' && (
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-graphite-100 mb-4">Organizar Capítulos</h2>
          
          <div className="space-y-3 mb-4">
            {chapters.map((chapter, index) => (
              <div key={index} className="bg-graphite-800/40 rounded-lg p-3 border border-graphite-700/20">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={chapter.title}
                    onChange={(e) => updateChapter(index, { title: e.target.value })}
                    className="flex-1 px-2 py-1 bg-graphite-900/60 border border-graphite-700/30 rounded text-sm text-graphite-200 focus:outline-none focus:border-violet-accent/50"
                  />
                  <span className="text-xs text-graphite-500">{chapter.files.length} págs.</span>
                  {chapters.length > 1 && (
                    <button onClick={() => removeChapter(index)} className="text-error/60 hover:text-error text-sm">🗑️</button>
                  )}
                </div>
                {chapter.files.length === 0 && (
                  <button
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.multiple = true;
                      input.accept = 'image/*';
                      input.onchange = (e) => assignFilesToChapter(index, (e.target as HTMLInputElement).files);
                      input.click();
                    }}
                    className="w-full py-2 text-xs text-violet-light border border-dashed border-violet-accent/30 rounded hover:bg-violet-accent/5"
                  >
                    + Adicionar páginas a este capítulo
                  </button>
                )}
                {chapter.files.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {chapter.files.slice(0, 10).map((f, i) => (
                      <span key={i} className="text-[9px] bg-graphite-700/50 text-graphite-400 px-1 py-0.5 rounded">{f.name}</span>
                    ))}
                    {chapter.files.length > 10 && (
                      <span className="text-[9px] text-graphite-500">+{chapter.files.length - 10}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={addChapter}
            className="w-full py-2 text-sm text-violet-light border border-dashed border-violet-accent/30 rounded-lg hover:bg-violet-accent/5 mb-4"
          >
            + Adicionar capítulo
          </button>

          <div className="flex justify-end gap-3">
            <button onClick={() => setStep('info')} className="px-4 py-2 text-sm text-graphite-400 hover:text-graphite-200">
              ← Voltar
            </button>
            <button
              onClick={handleImport}
              className="px-6 py-2 bg-violet-accent hover:bg-violet-dark text-white rounded-lg text-sm font-medium"
            >
              ✓ Importar Obra
            </button>
          </div>
        </div>
      )}

      {/* Step: Processing */}
      {step === 'processing' && (
        <div className="glass-card rounded-xl p-12 text-center">
          <div className="animate-pulse mb-4">
            <span className="text-5xl">📦</span>
          </div>
          <h3 className="text-lg font-semibold text-graphite-100 mb-2">Importando obra...</h3>
          <p className="text-sm text-graphite-400">Processando imagens e organizando capítulos</p>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && result && (
        <div className="glass-card rounded-xl p-8 text-center">
          <span className="text-5xl mb-4 block">✅</span>
          <h3 className="text-lg font-semibold text-graphite-100 mb-2">Importação concluída!</h3>
          <p className="text-sm text-graphite-400 mb-4">
            {result.chaptersCreated} capítulo(s) • {result.pagesCreated} página(s) importada(s)
          </p>
          {result.errors.length > 0 && (
            <div className="bg-warning/5 border border-warning/20 rounded-lg p-3 mb-4">
              <p className="text-xs text-warning mb-1">Avisos:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-graphite-400">{e}</p>
              ))}
            </div>
          )}
          <div className="flex justify-center gap-3">
            <button onClick={onCancel} className="px-4 py-2 text-sm text-graphite-400 hover:text-graphite-200">
              Voltar à biblioteca
            </button>
            {result.mangaId && (
              <button
                onClick={() => onComplete(result.mangaId!)}
                className="px-6 py-2 bg-violet-accent hover:bg-violet-dark text-white rounded-lg text-sm font-medium"
              >
                📖 Abrir Obra
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
