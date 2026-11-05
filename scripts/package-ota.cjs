const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require('jszip');

async function packageDist() {
  const distDir = path.resolve(__dirname, '..', 'dist');
  const zip = new JSZip();

  // Excluir pastas pesadas como catalog/obras que não pertencem ao bundle da aplicação web OTA
  const excludedFolders = new Set(['catalog', 'obras']);

  function addFolder(dir, currentPath = '') {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (!currentPath && excludedFolders.has(file)) {
        continue;
      }
      const fullPath = path.join(dir, file);
      const relPath = currentPath ? currentPath + '/' + file : file;
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        addFolder(fullPath, relPath);
      } else {
        zip.file(relPath, fs.readFileSync(fullPath));
      }
    }
  }

  addFolder(distDir);
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  const zipPath = path.resolve(__dirname, '..', 'app', 'dist.zip');
  fs.writeFileSync(zipPath, buffer);

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  console.log('SHA-256:', hash);
  console.log('Tamanho dist.zip:', buffer.length, 'bytes (' + (buffer.length / 1024).toFixed(1) + ' KB)');

  const versionPath = path.resolve(__dirname, '..', 'app', 'version.json');
  const versionData = {
    bundleUrl: 'https://cdn.jsdelivr.net/gh/AlefLorenzo/projeto-leitor@main/app/dist.zip',
    checksum: hash,
    version: '1.3.1',
    publishedAt: new Date().toISOString(),
    minAppVersion: '1.0.0',
    releaseNotes: 'Correção: Alternância sem erros entre tipos de obra (Mangá, Manhwa, Manhua) diretamente dentro do leitor com persistência imediata.'
  };
  fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2) + '\n');
  console.log('version.json atualizado:', JSON.stringify(versionData, null, 2));
}

packageDist().catch(err => {
  console.error(err);
  process.exit(1);
});
