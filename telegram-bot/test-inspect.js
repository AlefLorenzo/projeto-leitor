import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import dotenv from 'dotenv';

dotenv.config();

const API_ID = parseInt(process.env.TELEGRAM_API_ID || '0');
const API_HASH = process.env.TELEGRAM_API_HASH || '';
const SESSION = process.env.TELEGRAM_SESSION || '';

const client = new TelegramClient(new StringSession(SESSION), API_ID, API_HASH, {
  connectionRetries: 5,
});

const TARGET_CHANNELS = [
  '-1003340387097', // Pick Me Up
  '-1002572469547', // Swordmaster
  '-1003429556677', // Player of a Fallen Noble
  '-1003846994703', // Rogue First Prince
  '-1003589566501', // Unrivaled Spear Demon
  '-1003591071501', // Rengoku no Ashe
  '-1002576448823', // Gigantomachia
  '-1001834602691', // Mangás Brasil
  '-1002333204677', // Bunker Mangás
];

async function inspect() {
  await client.connect();
  console.log('✅ Conectado ao Telegram');

  for (const channelId of TARGET_CHANNELS) {
    try {
      const entity = await client.getEntity(channelId);
      console.log(`\n========================================`);
      console.log(`Channel: ${entity.title} (${channelId})`);
      const messages = await client.getMessages(entity, { limit: 10 });
      console.log(`Total count: ${messages.total || 'N/A'}`);
      
      for (const msg of messages) {
        if (msg.media) {
          const doc = msg.media.document;
          const attr = doc?.attributes?.find(a => a.fileName);
          const fileName = attr?.fileName || (msg.media.photo ? '[Photo]' : '[Outro]');
          const mime = doc?.mimeType || (msg.media.photo ? 'image/jpeg' : 'unknown');
          const size = doc?.size ? (doc.size / (1024 * 1024)).toFixed(2) + 'MB' : '';
          console.log(`  - Msg #${msg.id}: ${fileName} (${mime}, ${size}) | Text: ${msg.message?.slice(0, 50) || ''}`);
        } else if (msg.message) {
          console.log(`  - Msg #${msg.id} [Texto]: ${msg.message.slice(0, 60).replace(/\n/g, ' ')}`);
        }
      }
    } catch (err) {
      console.error(`Erro no canal ${channelId}:`, err.message);
    }
  }

  await client.disconnect();
}

inspect().catch(console.error);
