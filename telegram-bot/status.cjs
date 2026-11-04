const fs = require('fs');
const path = require('path');

const lib = path.join(__dirname, '..', 'library');
console.log('📚 Obras com capítulos já baixados na pasta library:');
if (fs.existsSync(lib)) {
  const items = fs.readdirSync(lib, { withFileTypes: true }).filter(d => d.isDirectory());
  let countWithCaps = 0;
  let totalCaps = 0;
  for (const item of items) {
    const p = path.join(lib, item.name);
    const sub = fs.readdirSync(p, { withFileTypes: true }).filter(d => d.isDirectory()).length;
    if (sub > 0) {
      console.log(`  ✅ ${item.name.padEnd(45)} : ${String(sub).padStart(3)} capítulos`);
      countWithCaps++;
      totalCaps += sub;
    }
  }
  console.log(`\n  Total: ${countWithCaps} obras com ${totalCaps} capítulos prontos para leitura offline.`);
}

const progFile = path.join(__dirname, 'download-progress.json');
if (fs.existsSync(progFile)) {
  try {
    const p = JSON.parse(fs.readFileSync(progFile, 'utf-8'));
    console.log('\n────────────────────────────────────────────────────────────');
    console.log('⚡ Progresso Atual da Extração:');
    console.log(`  Obra      : ${p.currentManga || '-'}`);
    console.log(`  Capítulo  : ${p.chapter || '-'} [${p.progress || '-'}]`);
    console.log(`  Baixando  : ${p.chapterProgress || 0}% (${p.downloadedMb || 0}/${p.totalMb || 0} MB)`);
    console.log(`  Obra      : ${p.mangaPercent || 0}% concluído`);
    console.log('────────────────────────────────────────────────────────────');
  } catch (e) {}
}
