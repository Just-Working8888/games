// Бот: /start с deep-link, платежи Stars (pre_checkout → successful_payment), пуши.
import { Bot, InlineKeyboard } from 'grammy';
import { CATALOG } from './catalog.js';
import { appLink, GAMES, gameByKey, type GameDef } from './config.js';
import type { Db } from './db.js';

export function createBot(token: string, db: Db): Bot {
  const bot = new Bot(token);

  bot.command('start', async (ctx) => {
    const payload = ctx.match?.trim();
    const from = ctx.from;
    if (from) {
      db.upsertUser({ id: from.id, firstName: from.first_name, username: from.username });
      const ref = payload?.match(/^ref_(\d+)$/);
      if (ref) db.setReferrer(from.id, Number(ref[1]));
    }

    const kb = new InlineKeyboard();
    for (const g of GAMES) kb.url(`🎮 ${g.title}`, appLink(g.appShortName)).row();

    await ctx.reply(
      '🎯 <b>TG Games</b> — залипательные мини-игры прямо в Телеге.\n\n' +
        'Выбирай игру, соревнуйся с друзьями, зови их по своей ссылке — получишь бонус за каждого!',
      { parse_mode: 'HTML', reply_markup: kb },
    );
  });

  bot.command('paysupport', (ctx) =>
    ctx.reply('По вопросам покупок пишите сюда — разберёмся и вернём звёзды, если что-то пошло не так.'),
  );

  // Платежи Stars: подтверждаем чекаут, если SKU знаком.
  bot.on('pre_checkout_query', async (ctx) => {
    const sku = CATALOG[parsePayload(ctx.preCheckoutQuery.invoice_payload)?.sku ?? ''];
    await ctx.answerPreCheckoutQuery(Boolean(sku), sku ? undefined : { error_message: 'Товар не найден' });
  });

  bot.on('message:successful_payment', async (ctx) => {
    const p = ctx.message.successful_payment;
    const payload = parsePayload(p.invoice_payload);
    const sku = payload ? CATALOG[payload.sku] : undefined;
    const userId = ctx.from?.id;
    if (!sku || !userId) return;

    db.upsertUser({ id: userId, firstName: ctx.from.first_name, username: ctx.from.username });
    db.addPurchase(userId, sku.id, p.total_amount, sku.grant, p.telegram_payment_charge_id);
    if (sku.grant.type === 'vip') db.setVip(userId);

    await ctx.reply(`✅ ${sku.title} — покупка прошла! Награда уже ждёт в игре.`);
  });

  return bot;
}

function parsePayload(raw: string): { sku: string } | null {
  try {
    const p = JSON.parse(raw);
    return typeof p?.sku === 'string' ? p : null;
  } catch {
    return null;
  }
}

/** Пуш «друг побил твой рекорд» с кнопкой реванша. Молча глотает ошибки (бот может быть заблокирован). */
export async function notifyOvertaken(
  bot: Bot | null,
  toUserId: number,
  byName: string,
  gameKey: string,
  score: number,
): Promise<void> {
  if (!bot) return;
  const game = gameByKey(gameKey) as GameDef;
  const kb = new InlineKeyboard().url('⚔️ Отыграться', appLink(game.appShortName));
  try {
    await bot.api.sendMessage(
      toUserId,
      `😤 <b>${escapeHtml(byName)}</b> обошёл тебя в «${game.title}» — ${score} ${game.scoreLabel}!`,
      { parse_mode: 'HTML', reply_markup: kb },
    );
  } catch {
    /* пользователь не начинал чат с ботом или заблокировал его */
  }
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
