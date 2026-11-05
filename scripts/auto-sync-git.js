/**
 * Auto Sync Git - Sincronizador Automático com o GitHub
 * Monitora o repositório a cada X segundos e envia commits/push automaticamente.
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Configurações
const CHECK_INTERVAL_MS = 15000; // Checa alterações a cada 15 segundos
const DEBOUNCE_WAIT_MS = 5000;   // Aguarda 5s após detectar alteração antes de commitar (evita salvar no meio de edição)

function runCommand(cmd, options = {}) {
  try {
    return execSync(cmd, { cwd: ROOT_DIR, encoding: 'utf-8', stdio: options.silent ? 'pipe' : 'inherit', ...options });
  } catch (err) {
    if (!options.allowFail) {
      throw err;
    }
    return null;
  }
}

function getGitOutput(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT_DIR, encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

function getFormattedDate() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const d = pad(now.getDate());
  const m = pad(now.getMonth() + 1);
  const y = now.getFullYear();
  const h = pad(now.getHours());
  const min = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  return `${d}/${m}/${y} ${h}:${min}:${s}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startAutoSync() {
  console.clear();
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  🔄 AUTO-SYNC GIT: MONITORAMENTO ATIVO                   ║');
  console.log('║  Envia alterações para o GitHub automaticamente          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`📁 Repositório: ${ROOT_DIR}`);
  console.log(`⏱️  Intervalo de verificação: ${CHECK_INTERVAL_MS / 1000}s`);
  console.log(`Pressione Ctrl + C para encerrar o monitoramento a qualquer momento.\n`);

  let currentBranch = getGitOutput('git rev-parse --abbrev-ref HEAD') || 'main';
  console.log(`🌿 Branch ativa: ${currentBranch}\n`);

  while (true) {
    try {
      // Verifica arquivos alterados, novos ou deletados
      const statusOutput = getGitOutput('git status --porcelain');

      if (statusOutput) {
        const lines = statusOutput.split('\n').filter(Boolean);
        console.log(`[${getFormattedDate()}] ⚡ ${lines.length} arquivo(s) com alterações detectadas.`);
        console.log(`⏳ Aguardando ${DEBOUNCE_WAIT_MS / 1000}s para estabilização dos arquivos...`);
        await sleep(DEBOUNCE_WAIT_MS);

        // Atualiza status caso novos arquivos tenham sido gravados durante o debounce
        const finalStatus = getGitOutput('git status --porcelain');
        if (!finalStatus) {
          console.log(`ℹ️ Nenhuma alteração pendente após a espera.\n`);
          await sleep(CHECK_INTERVAL_MS);
          continue;
        }

        console.log(`📦 Adicionando arquivos (git add -A)...`);
        runCommand('git add -A');

        const commitMessage = `auto: sincronização automática [${getFormattedDate()}]`;
        console.log(`💾 Criando commit: "${commitMessage}"...`);
        const commitResult = runCommand(`git commit -m "${commitMessage}"`, { allowFail: true });

        if (commitResult !== null) {
          console.log(`🚀 Enviando para o GitHub (git push origin ${currentBranch})...`);
          try {
            runCommand(`git push origin ${currentBranch}`);
            console.log(`✅ [${getFormattedDate()}] Alterações sincronizadas com sucesso no GitHub!\n`);
          } catch (pushErr) {
            console.error(`⚠️  Falha no envio (push). Verifique sua conexão de rede ou permissões.\n`);
          }
        }
      }
    } catch (err) {
      console.error(`⚠️ Erro durante o ciclo de verificação: ${err.message}`);
    }

    await sleep(CHECK_INTERVAL_MS);
  }
}

startAutoSync();

