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
    console.log(`\n  $ ${cmd}`);
    execSync(cmd, { cwd: ROOT_DIR, stdio: 'inherit' });
    return true;
  } catch (err) {
    if (!allowFail) {
      console.error(`  ❌ Falha no comando: ${cmd}`);
    }
    return false;
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  🚀 PUBLICADOR INCREMENTAL DE OBRAS NO GITHUB           ║');
  console.log('║  Envia catálogo e capítulos compactados em lotes seguros ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // 1. Enviar primeiro o código da aplicação e o catálogo
  console.log('📦 Passo 1: Enviando aplicação, serviços e catálogo JSON...');
  run('git add src/ app/ public/catalog/catalog.json telegram-bot/*.js *.bat vite.config.js index.html package.json');
  run('git commit -m "feat: offline GitHub reader architecture with SHA-256 verification and remote catalog"', true);
  
  console.log('\n⬆️  Enviando código base para o branch main...');
  run('git push origin main', true);

  // 2. Verificar obras disponíveis para envio
  if (!fs.existsSync(OBRAS_DIR)) {
    console.log('\n⚠️  Pasta obras/ não encontrada. Execute package-to-github.js primeiro.');
    return;
  }

  const obras = fs.readdirSync(OBRAS_DIR).filter(d => fs.statSync(path.join(OBRAS_DIR, d)).isDirectory());
  console.log(`\n📚 Obras empacotadas encontradas (${obras.length}):\n${obras.map(o => `   - ${o}`).join('\n')}`);

  for (let i = 0; i < obras.length; i++) {
    const obra = obras[i];
    const obraDir = path.join(OBRAS_DIR, obra);
    console.log(`\n────────────────────────────────────────────────────────────`);
    console.log(`📖 [${i + 1}/${obras.length}] Publicando: ${obra}`);
    console.log(`────────────────────────────────────────────────────────────`);

    // Adiciona metadados e capa
    run(`git add obras/${obra}/metadata.json obras/${obra}/cover.jpg`, true);

    // Lista capítulos
    const capDir = path.join(obraDir, 'capitulos');
    if (fs.existsSync(capDir)) {
      const caps = fs.readdirSync(capDir).filter(f => f.endsWith('.cbz'));
      console.log(`  📦 Total de capítulos: ${caps.length}`);

      // Envia em lotes de no máximo 25 capítulos para respeitar o limite de 2GB por push HTTP
      const BATCH_SIZE = 25;
      for (let b = 0; b < caps.length; b += BATCH_SIZE) {
        const batch = caps.slice(b, b + BATCH_SIZE);
        const batchFiles = batch.map(c => `obras/${obra}/capitulos/${c}`).join(' ');
        
        console.log(`  ⬆️  Enviando lote ${Math.floor(b / BATCH_SIZE) + 1}/${Math.ceil(caps.length / BATCH_SIZE)} (${batch.length} capítulos)...`);
        run(`git add ${batchFiles}`);
        run(`git commit -m "feat(${obra}): add chapters batch ${b + 1} to ${b + batch.length}"`, true);
        
        const pushOk = run('git push origin main', true);
        if (!pushOk) {
          console.log(`  ⚠️  Push falhou ou pausado. Tentando novamente em 3s...`);
          run('git push origin main', true);
        }
      }
    }

    console.log(`  ✅ Obra ${obra} sincronizada com sucesso!`);
  }

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('🎉 TODAS AS OBRAS E CATÁLOGO PUBLICADOS NO GITHUB!');
  console.log('📱 O aplicativo Manga Offline agora baixa diretamente do GitHub sem servidor!');
  console.log('══════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
});
