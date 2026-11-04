import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import dotenv from 'dotenv';

dotenv.config();

const API_ID = parseInt(process.env.TELEGRAM_API_ID || '0');
const API_HASH = process.env.TELEGRAM_API_HASH || '';
const SESSION = process.env.TELEGRAM_SESSION || '';

const client = new TelegramClient(new StringSession(SESSION), API_ID, API_HASH, { connectionRetries: 5 });

async function inspectBunker() {
  await client.connect();
  
  // Bunker Mangas
  const bunker = await client.getEntity('-1002333204677');
  console.log('--- Bunker Mangas Sample ---');
  const msgs = await client.getMessages(bunker, { limit: 15 });
  for (const m of msgs) {
    console.log(`Msg #${m.id}: text="${m.message?.slice(0, 100).replace(/\n/g, ' ')}" | replyMarkup=${JSON.stringify(m.replyMarkup?.rows?.map(r => r.buttons?.map(b => b.text + ' -> ' + (b.url || b.data))))}`);
  }

  // Mangas Brasil
  const brasil = await client.getEntity('-1001834602691');
  console.log('\n--- Mangas Brasil Sample ---');
  const msgs2 = await client.getMessages(brasil, { limit: 15 });
  for (const m of msgs2) {
    const doc = m.media?.document;
    const attr = doc?.attributes?.find(a => a.fileName);
    console.log(`Msg #${m.id}: fileName=${attr?.fileName} | text="${m.message?.slice(0, 80).replace(/\n/g, ' ')}" | replyMarkup=${JSON.stringify(m.replyMarkup?.rows?.map(r => r.buttons?.map(b => b.text + ' -> ' + (b.url || b.data))))}`);
  }

  await client.disconnect();
}

inspectBunker().catch(console.error);
