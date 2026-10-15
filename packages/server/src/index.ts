// Точка входа: SQLite + бот (long polling) + HTTP API в одном процессе.
import { serve } from '@hono/node-server';
import { createApi } from './api.js';
import { createBot } from './bot.js';
import { config } from './config.js';
import { Db } from './db.js';

// Без токена невозможна валидация initData: работать можно только в dev-режиме.
if (!config.botToken && !config.devAuth) {
  console.error('❌ Нет BOT_TOKEN и не включён DEV_AUTH — авторизовать некого. Заполни .env.');
  process.exit(1);
}

const db = new Db(config.dbPath);
const bot = config.noBot ? null : createBot(config.botToken, db);

if (bot) {
  // pending updates НЕ сбрасываем: в очереди может лежать successful_payment
  bot.start({ onStart: (me) => console.log(`🤖 бот @${me.username} запущен`) });
} else {
  console.log('⚠️ бот выключен (нет BOT_TOKEN или NO_BOT=1) — платежи и пуши недоступны');
}

const app = createApi(db, bot);
serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`🚀 API на http://localhost:${info.port} (dev-auth: ${config.devAuth ? 'вкл' : 'выкл'})`);
});
