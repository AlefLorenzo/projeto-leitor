import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import JSZip from 'jszip';
import { execSync } from 'child_process';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurações
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID; // Seu chat ID (opcional, para restringir acesso)
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
const CATALOG_DIR = path.join(__dirname, '..', 'public', 'catalog');
const GIT_REPO = process.env.GIT_REPO || '..'; // Caminho para o repositório principal

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN não configurado!');
  console.error('Crie um arquivo .env com o token do bot');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// Estado do bot
const userState = new Map();

console.log('🤖 Bot do Telegram iniciado!');
console.log('📁 Aguardando arquivos...');

// Comando /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
🎉 Bem-vindo ao Manga Offline Bot!

📚 Como usar:

1️⃣ Envie arquivos CBZ, ZIP ou imagens
2️⃣ O bot vai pedir o nome da obra
3️⃣ Os arquivos serão organizados automaticamente
4️⃣ O catálogo será atualizado no Git

📂 Formatos aceitos:
• CBZ (Comic Book ZIP)
• ZIP com imagens
• Imagens avulsas (JPG, PNG, WEBP)

🔧 Comandos:
/list - Ver obras cadastradas
/status - Ver status do bot
/help - Ajuda
  `);
});

// Comando /list
bot.onText(/\/list/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const catalogPath = path.join(CATALOG_DIR, 'catalog.json');
    const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf-8'));
    
    if (catalog.mangas.length === 0) {
      bot.sendMessage(chatId, '📭 Nenhuma obra cadastrada ainda.');
      return;
    }
    
    let message = '📚 Obras cadastradas:\n\n';
    catalog.mangas.forEach((manga, index) => {
      message += `${index + 1}. ${manga.title}\n`;
      message += `   📖 ${manga.chapters.length} capítulos\n`;
      message += `   🏷️ ${manga.type}\n\n`;
    });
    
    bot.sendMessage(chatId, message);
  } catch (error) {
    bot.sendMessage(chatId, '❌ Erro ao ler catálogo. Envie sua primeira obra!');
  }
});

// Comando /status
bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `
✅ Bot online!

📊 Status:
• Downloads: ${DOWNLOAD_DIR}
• Catálogo: ${CATALOG_DIR}
• Git: ${GIT_REPO}
  `);
});

// Comando /help
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, `
📖 Ajuda do Manga Offline Bot

📥 Enviando obras:
1. Envie um arquivo CBZ, ZIP ou imagens
2. Responda com o nome da obra
3. Pronto! A obra será adicionada ao catálogo

📂 Estrutura de pastas:
Se você enviar múltiplos arquivos, o bot vai perguntar se são capítulos diferentes.

🔧 Comandos:
/start - Iniciar bot
/list - Listar obras
/status - Status do bot
/help - Esta ajuda
  `);
});

// Handler para documentos (arquivos)
bot.on('document', async (msg) => {
  const chatId = msg.chat.id;
  
  // Verificar permissão (se CHAT_ID estiver configurado)
  if (CHAT_ID && msg.chat.id.toString() !== CHAT_ID) {
    bot.sendMessage(chatId, '❌ Acesso negado.');
    return;
  }
  
  const file = msg.document;
  const fileName = file.file_name;
  const fileSize = file.file_size;
  
  console.log(`📥 Recebendo arquivo: ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
  
  // Verificar formato
  const ext = path.extname(fileName).toLowerCase();
  if (!['.cbz', '.zip', '.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    bot.sendMessage(chatId, '❌ Formato não suportado. Envie CBZ, ZIP ou imagens.');
    return;
  }
  
  // Salvar estado do usuário
  userState.set(chatId, {
    step: 'waiting_title',
    file: file,
    fileName: fileName,
    fileType: ext
  });
  
  bot.sendMessage(chatId, `
✅ Arquivo recebido: ${fileName}

📝 Agora, qual o nome da obra?
(Responda com o título)
  `);
});

// Handler para fotos
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  
  if (CHAT_ID && msg.chat.id.toString() !== CHAT_ID) {
    bot.sendMessage(chatId, '❌ Acesso negado.');
    return;
  }
  
  // Pegar a maior resolução
  const photo = msg.photo[msg.photo.length - 1];
  
  console.log(`📷 Recebendo imagem`);
  
  userState.set(chatId, {
    step: 'waiting_title',
    file: photo,
    isPhoto: true
  });
  
  bot.sendMessage(chatId, `
✅ Imagem recebida!

📝 Qual o nome da obra?
(Responda com o título)
  `);
});

// Handler para texto (respostas)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Ignorar comandos
  if (text.startsWith('/')) return;
  
  const state = userState.get(chatId);
  if (!state) return;
  
  if (state.step === 'waiting_title') {
    const title = text.trim();
    
    bot.sendMessage(chatId, `📝 Obra: ${title}\n\n⏳ Processando...`);
    
    try {
      await processFile(chatId, state, title);
      userState.delete(chatId);
    } catch (error) {
      console.error('Erro ao processar:', error);
      bot.sendMessage(chatId, `❌ Erro: ${error.message}`);
      userState.delete(chatId);
    }
  }
});

// Processar arquivo
async function processFile(chatId, state, title) {
  // Criar diretório da obra
  const mangaDir = path.join(DOWNLOAD_DIR, sanitizeFilename(title));
  await fs.mkdir(mangaDir, { recursive: true });
  
  let filePath;
  
  if (state.isPhoto) {
    // Download da foto
    const fileLink = await bot.getFileLink(state.file.file_id);
    filePath = path.join(mangaDir, 'cover.jpg');
    
    const response = await fetch(fileLink);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    
    bot.sendMessage(chatId, '✅ Imagem salva como capa!');
  } else {
    // Download do arquivo
    const fileLink = await bot.getFileLink(state.file.file_id);
    filePath = path.join(mangaDir, state.fileName);
    
    const response = await fetch(fileLink);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(filePath, buffer);
    
    bot.sendMessage(chatId, '✅ Arquivo baixado!');
    
    // Se for CBZ/ZIP, extrair informações
    if (['.cbz', '.zip'].includes(state.fileType)) {
      await extractArchiveInfo(filePath, mangaDir);
    }
  }
  
  // Atualizar catálogo
  await updateCatalog(title, mangaDir);
  
  // Commit para Git
  await commitToGit(title);
  
  bot.sendMessage(chatId, `
✅ Obra "${title}" adicionada com sucesso!

📚 O catálogo foi atualizado e enviado para o Git.
🔄 O app será atualizado automaticamente.
  `);
}

// Extrair informações do arquivo
async function extractArchiveInfo(filePath, mangaDir) {
  try {
    const zip = new JSZip();
    const content = await fs.readFile(filePath);
    const archive = await zip.loadAsync(content);
    
    const files = Object.keys(archive.files);
    const imageFiles = files.filter(f => 
      /\.(jpg|jpeg|png|webp)$/i.test(f) && !archive.files[f].dir
    );
    
    console.log(`📊 Arquivo contém ${imageFiles.length} imagens`);
    
    // Salvar metadata
    const metadata = {
      fileName: path.basename(filePath),
      pageCount: imageFiles.length,
      extractedAt: new Date().toISOString()
    };
    
    await fs.writeFile(
      path.join(mangaDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
  } catch (error) {
    console.error('Erro ao extrair:', error);
  }
}

// Atualizar catálogo
async function updateCatalog(title, mangaDir) {
  const catalogPath = path.join(CATALOG_DIR, 'catalog.json');
  
  let catalog = { mangas: [], lastUpdated: new Date().toISOString() };
  
  // Ler catálogo existente
  try {
    catalog = JSON.parse(await fs.readFile(catalogPath, 'utf-8'));
  } catch (error) {
    // Catálogo não existe, criar novo
  }
  
  // Ler metadata da obra
  let metadata = {};
  try {
    metadata = JSON.parse(await fs.readFile(path.join(mangaDir, 'metadata.json'), 'utf-8'));
  } catch (error) {
    // Sem metadata
  }
  
  // Verificar se obra já existe
  const existingIndex = catalog.mangas.findIndex(m => m.title === title);
  
  const mangaData = {
    id: sanitizeFilename(title),
    title: title,
    type: 'manga', // Pode ser detectado depois
    genres: [],
    status: 'reading',
    coverUrl: `/catalog/${sanitizeFilename(title)}/cover.jpg`,
    chapters: [{
      id: 'chapter-1',
      title: 'Capítulo 1',
      pageCount: metadata.pageCount || 0,
      files: metadata.fileName ? [metadata.fileName] : []
    }],
    addedAt: new Date().toISOString(),
    source: 'telegram'
  };
  
  if (existingIndex >= 0) {
    // Atualizar obra existente
    catalog.mangas[existingIndex] = { ...catalog.mangas[existingIndex], ...mangaData };
  } else {
    // Adicionar nova obra
    catalog.mangas.push(mangaData);
  }
  
  catalog.lastUpdated = new Date().toISOString();
  
  // Salvar catálogo
  await fs.mkdir(CATALOG_DIR, { recursive: true });
  await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2));
  
  console.log(`✅ Catálogo atualizado: ${catalog.mangas.length} obras`);
}

// Commit para Git
async function commitToGit(title) {
  try {
    const repoPath = path.resolve(GIT_REPO);
    
    // Adicionar arquivos
    execSync('git add public/catalog/', { cwd: repoPath });
    execSync('git add telegram-bot/downloads/', { cwd: repoPath });
    
    // Commit
    const message = `📚 Adiciona obra: ${title}\n\nEnviado via Telegram Bot`;
    execSync(`git commit -m "${message}"`, { cwd: repoPath });
    
    // Push
    execSync('git push', { cwd: repoPath });
    
    console.log('✅ Enviado para o Git!');
  } catch (error) {
    console.error('Erro no Git:', error.message);
    // Não é fatal, o catálogo local ainda funciona
  }
}

// Sanitizar nome de arquivo
function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Tratamento de erros
process.on('unhandledRejection', (error) => {
  console.error('Erro não tratado:', error);
});

process.on('SIGINT', () => {
  console.log('\n👋 Bot encerrado!');
  process.exit(0);
});
