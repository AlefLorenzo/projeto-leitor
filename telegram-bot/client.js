import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import input from 'input';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import JSZip from 'jszip';
import { execSync } from 'child_process';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ⚠️ IMPORTANTE: Credenciais devem estar APENAS no .env, NUNCA no código!
const API_ID = parseInt(process.env.TELEGRAM_API_ID || '0');
const API_HASH = process.env.TELEGRAM_API_HASH || '';
const SESSION_STRING = process.env.TELEGRAM_SESSION || '';
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
const CATALOG_DIR = path.join(__dirname, '..', 'public', 'catalog');

if (!API_ID || !API_HASH) {
  console.error('❌ ERRO: TELEGRAM_API_ID e TELEGRAM_API_HASH não configurados!');
  console.error('📝 Crie um arquivo .env com suas credenciais');
  console.error('⚠️  NUNCA coloque credenciais diretamente no código!');
  process.exit(1);
}

console.log('🚀 Iniciando Cliente Telegram...');

const client = new TelegramClient(
  new StringSession(SESSION_STRING),
  API_ID,
  API_HASH,
  { connectionRetries: 5 }
);

// Estado
const catalog = { mangas: [], lastUpdated: new Date().toISOString() };

async function main() {
  try {
    // Conectar ao Telegram
    await client.start({
      phoneNumber: async () => await input.text('📱 Digite seu número (com código do país, ex: +5511999999999): '),
      password: async () => await input.text('🔐 Digite sua senha (se tiver 2FA): '),
      phoneCode: async () => await input.text('📲 Digite o código recebido no Telegram: '),
      onError: (err) => console.error('❌ Erro:', err.message),
    });

    console.log('✅ Conectado ao Telegram!');
    console.log('💾 Session string (guarde com segurança):');
    console.log(client.session.save());
    console.log('\n⚠️  Adicione esta session string ao seu .env como TELEGRAM_SESSION');
    console.log('   Isso evita precisar fazer login novamente.\n');

    // Criar diretórios
    await fs.mkdir(DOWNLOAD_DIR, { recursive: true });
    await fs.mkdir(CATALOG_DIR, { recursive: true });

    // Carregar catálogo existente
    try {
      const existing = JSON.parse(await fs.readFile(path.join(CATALOG_DIR, 'catalog.json'), 'utf-8'));
      catalog.mangas = existing.mangas || [];
    } catch (error) {
      console.log('📝 Catálogo novo será criado');
    }

    // Menu principal
    await showMenu();

  } catch (error) {
    console.error('❌ Erro fatal:', error.message);
    process.exit(1);
  }
}

async function showMenu() {
  while (true) {
    console.log('\n📋 MENU PRINCIPAL');
    console.log('1. Listar meus chats (canais/grupos)');
    console.log('2. Baixar de um chat específico');
    console.log('3. Ver catálogo atual');
    console.log('4. Sair');
    
    const choice = await input.text('\nEscolha uma opção (1-4): ');
    
    switch (choice) {
      case '1':
        await listChats();
        break;
      case '2':
        await downloadFromChat();
        break;
      case '3':
        await showCatalog();
        break;
      case '4':
        console.log('👋 Até logo!');
        await client.disconnect();
        process.exit(0);
        break;
      default:
        console.log('❌ Opção inválida');
    }
  }
}

async function listChats() {
  console.log('\n📋 Buscando seus chats...');
  
  const dialogs = await client.getDialogs({});
  
  console.log('\n📱 Seus chats:');
  dialogs.forEach((dialog, index) => {
    const type = dialog.isChannel ? '📢 Canal' : dialog.isGroup ? '👥 Grupo' : '💬 Chat';
    console.log(`${index + 1}. ${type}: ${dialog.title} (ID: ${dialog.id})`);
  });
}

async function downloadFromChat() {
  const chatId = await input.text('\n📥 Digite o ID ou username do chat (ex: @canal ou 123456789): ');
  
  console.log(`\n🔍 Buscando mensagens em: ${chatId}`);
  
  try {
    const entity = await client.getEntity(chatId);
    console.log(`✅ Chat encontrado: ${entity.title || entity.username}`);
    
    const messages = await client.getMessages(entity, { limit: 100 });
    
    console.log(`\n📬 ${messages.total} mensagens encontradas`);
    console.log('🔎 Procurando arquivos de mangá...\n');
    
    const mangaFiles = [];
    
    for (const message of messages) {
      if (message.media && (message.media.document || message.media.photo)) {
        const fileName = message.media.document?.attributes?.find(a => a.fileName)?.fileName || 
                        `file_${message.id}.jpg`;
        
        if (fileName.match(/\.(cbz|zip|jpg|jpeg|png|webp)$/i)) {
          mangaFiles.push({
            id: message.id,
            fileName: fileName,
            date: message.date,
            media: message.media
          });
          
          console.log(`📄 ${fileName} (${new Date(message.date * 1000).toLocaleDateString('pt-BR')})`);
        }
      }
    }
    
    if (mangaFiles.length === 0) {
      console.log('❌ Nenhum arquivo de mangá encontrado neste chat');
      return;
    }
    
    console.log(`\n✅ ${mangaFiles.length} arquivos encontrados`);
    
    const mangaName = await input.text('\n📝 Nome da obra: ');
    const mangaDir = path.join(DOWNLOAD_DIR, sanitizeFilename(mangaName));
    await fs.mkdir(mangaDir, { recursive: true });
    
    console.log(`\n⬇️  Baixando ${mangaFiles.length} arquivos...`);
    
    for (let i = 0; i < mangaFiles.length; i++) {
      const file = mangaFiles[i];
      const filePath = path.join(mangaDir, file.fileName);
      
      console.log(`[${i + 1}/${mangaFiles.length}] ${file.fileName}`);
      
      await client.downloadMedia(file.media, {
        outputFile: filePath
      });
    }
    
    console.log('\n✅ Download concluído!');
    
    // Atualizar catálogo
    await updateCatalog(mangaName, mangaDir, mangaFiles.length);
    
    // Commit para Git
    await commitToGit(mangaName);
    
    console.log('\n🎉 Obra adicionada com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

async function showCatalog() {
  if (catalog.mangas.length === 0) {
    console.log('\n📭 Catálogo vazio');
    return;
  }
  
  console.log('\n📚 Catálogo atual:');
  catalog.mangas.forEach((manga, index) => {
    console.log(`${index + 1}. ${manga.title} (${manga.chapters.length} capítulos)`);
  });
  
  console.log(`\n📊 Total: ${catalog.mangas.length} obras`);
}

async function updateCatalog(title, mangaDir, fileCount) {
  const mangaId = sanitizeFilename(title);
  
  const existingIndex = catalog.mangas.findIndex(m => m.id === mangaId);
  
  const mangaData = {
    id: mangaId,
    title: title,
    type: 'manga',
    genres: [],
    status: 'reading',
    coverUrl: `/catalog/${mangaId}/cover.jpg`,
    chapters: [{
      id: 'chapter-1',
      title: 'Capítulo 1',
      pageCount: fileCount,
      files: []
    }],
    addedAt: new Date().toISOString(),
    source: 'telegram-client'
  };
  
  if (existingIndex >= 0) {
    catalog.mangas[existingIndex] = { ...catalog.mangas[existingIndex], ...mangaData };
  } else {
    catalog.mangas.push(mangaData);
  }
  
  catalog.lastUpdated = new Date().toISOString();
  
  await fs.writeFile(
    path.join(CATALOG_DIR, 'catalog.json'),
    JSON.stringify(catalog, null, 2)
  );
  
  console.log('✅ Catálogo atualizado');
}

async function commitToGit(title) {
  try {
    const repoPath = path.resolve('..');
    
    execSync('git add public/catalog/', { cwd: repoPath });
    execSync('git add telegram-bot/downloads/', { cwd: repoPath });
    
    const message = `📚 Adiciona obra: ${title}\n\nBaixado via Telegram Client`;
    execSync(`git commit -m "${message}"`, { cwd: repoPath });
    execSync('git push', { cwd: repoPath });
    
    console.log('✅ Enviado para o Git!');
  } catch (error) {
    console.error('⚠️  Erro no Git:', error.message);
  }
}

function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Iniciar
main().catch(console.error);

