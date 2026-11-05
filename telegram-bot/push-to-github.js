import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const OBRAS_DIR = path.join(ROOT_DIR, 'obras');

function run(cmd, allowFail = false) {
  try {
    console.log(`  $ ${cmd}`);
    execSync(cmd, { cwd: ROOT_DIR, stdio: 'inherit' });
    return true;
  } catch (err) {
    if (!allowFail) {
      console.error(`  ⚠️ Falha: ${cmd}`);
    }
    return false;
  }
}

function runOutput(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT_DIR, encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  🚀 PUBLICADOR AUTOMÁTICO DE OBRAS NO GITHUB             ║');
  console.log('║  Envia capítulos compactados em lotes seguros e resilientes ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (!fs.existsSync(OBRAS_DIR)) {
    console.log('❌ Pasta obras/ não encontrada. Execute package-to-github.js primeiro.');
    return;
  }

  // Lista arquivos já rastreados pelo Git para não reprocessar
  const trackedFiles = new Set(runOutput('git ls-files obras/').split('\n').map(f => f.trim().replace(/\\/g, '/')));

  const obras = fs.readdirSync(OBRAS_DIR).filter(d => fs.statSync(path.join(OBRAS_DIR, d)).isDirectory());
  console.log(`📚 Obras detectadas (${obras.length}):\n${obras.map(o => `   - ${o}`).join('\n')}\n`);

  for (let i = 0; i < obras.length; i++) {
    const obra = obras[i];
    const obraDir = path.join(OBRAS_DIR, obra);
    console.log(`────────────────────────────────────────────────────────────`);
    console.log(`📖 [${i + 1}/${obras.length}] Sincronizando obra: ${obra}`);
    console.log(`────────────────────────────────────────────────────────────`);

    // Adiciona metadados e capa se ainda não estiverem rastreados
    const metaPath = `obras/${obra}/metadata.json`;
    const coverPath = `obras/${obra}/cover.jpg`;
    if (!trackedFiles.has(metaPath) && fs.existsSync(path.join(ROOT_DIR, metaPath))) {
      run(`git add "${metaPath}"`, true);
    }
    if (!trackedFiles.has(coverPath) && fs.existsSync(path.join(ROOT_DIR, coverPath))) {
      run(`git add "${coverPath}"`, true);
    }

    const capDir = path.join(obraDir, 'capitulos');
    if (!fs.existsSync(capDir)) {
      console.log(`  ℹ️  Sem capítulos nesta obra.`);
      continue;
    }

    const allCaps = fs.readdirSync(capDir).filter(f => f.endsWith('.cbz'));
    const pendingCaps = allCaps.filter(f => !trackedFiles.has(`obras/${obra}/capitulos/${f}`));

    console.log(`  📦 Total de capítulos: ${allCaps.length} | ✅ Já enviados: ${allCaps.length - pendingCaps.length} | ⬆️  Pendentes: ${pendingCaps.length}`);

    if (pendingCaps.length === 0) {
      console.log(`  ✓ Todos os capítulos de ${obra} já estão sincronizados no GitHub!\n`);
      continue;
    }

    // Lotes de 20 capítulos por push para total estabilidade e evitar limites de buffer HTTP
    const BATCH_SIZE = 20;
    for (let b = 0; b < pendingCaps.length; b += BATCH_SIZE) {
      const batch = pendingCaps.slice(b, b + BATCH_SIZE);
      const batchFiles = batch.map(c => `"obras/${obra}/capitulos/${c}"`).join(' ');

      const loteNum = Math.floor(b / BATCH_SIZE) + 1;
      const totalLotes = Math.ceil(pendingCaps.length / BATCH_SIZE);
      console.log(`\n  📦 [${loteNum}/${totalLotes}] Empacotando lote de ${batch.length} capítulos...`);

      run(`git add ${batchFiles}`);
      const commitMsg = `feat(${obra}): add chapters batch ${b + 1} to ${b + batch.length}`;
      run(`git commit -m "${commitMsg}"`, true);

      // Push com retry
      let pushSuccess = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`  ⬆️  Enviando lote ${loteNum}/${totalLotes} para o GitHub (tentativa ${attempt}/3)...`);
        pushSuccess = run('git push origin main', true);
        if (pushSuccess) break;
        console.log(`  ⚠️  Tentativa falhou. Aguardando 5s antes de retentar...`);
        await sleep(5000);
      }

      if (pushSuccess) {
        batch.forEach(c => trackedFiles.add(`obras/${obra}/capitulos/${c}`));
        console.log(`  ✅ Lote ${loteNum}/${totalLotes} enviado com sucesso!`);
      } else {
        console.error(`  ❌ Falha persistente ao enviar lote ${loteNum}. Interrompendo para evitar inconsistência.`);
        return;
      }

      await sleep(1000);
    }

    console.log(`  🎉 Obra ${obra} 100% sincronizada no GitHub!\n`);
  }

  console.log('══════════════════════════════════════════════════════════');
  console.log('🎉 TODAS AS OBRAS E CAPÍTULOS COMPACTADOS ESTÃO NO GITHUB!');
  console.log('📱 O catálogo do app Manga Offline está 100% pronto para leitura e download offline.');
  console.log('══════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message);
});
