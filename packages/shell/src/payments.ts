// Покупки за ⭐ Stars: инвойс у бэкенда → нативное окно оплаты → гранты в инбокс.
// После 'paid' игра должна вызвать takeGrants(<game>) и применить награды.
import { apiEnabled, claimGrants, createInvoice, type ClaimedGrant } from './api';
import { stashGrants } from './grants';
import { haptic, openInvoice } from './telegram';

/**
 * paid        — оплачено, гранты (если уже долетели) лежат в инбоксе
 * pending     — платёж ещё обрабатывается: НЕ выдавать повторно, награда придёт сама
 * cancelled   — игрок закрыл окно оплаты
 * failed      — ошибка (в т.ч. сервер отказал в инвойсе)
 * unavailable — бэкенда/Телеги нет вообще (локальная разработка, браузер)
 * unsupported — бэкенд есть, но клиент Telegram слишком старый для платежей
 */
export type BuyStatus = 'paid' | 'pending' | 'cancelled' | 'failed' | 'unavailable' | 'unsupported';

/**
 * Полный цикл покупки SKU из каталога сервера.
 * Бесплатный dev-фолбэк в играх допустим ТОЛЬКО при 'unavailable' + import.meta.env.DEV —
 * 'unsupported' значит реального игрока со старым клиентом, ему говорим «обнови Telegram».
 */
export async function buySku(sku: string): Promise<BuyStatus> {
  if (!apiEnabled()) return 'unavailable';

  const invoice = await createInvoice(sku);
  if (!invoice) return 'failed';

  const status = await openInvoice(invoice.url);
  switch (status) {
    case 'paid': {
      haptic.notify('success');
      // вебхук successful_payment долетает до сервера асинхронно — забираем с ретраями
      await stashGrants(await claimWithRetry());
      return 'paid';
    }
    case 'pending':
      return 'pending';
    case 'cancelled':
      return 'cancelled';
    case 'unavailable':
      return 'unsupported'; // API есть, а платить клиент не умеет — это не dev-режим
    default:
      return 'failed';
  }
}

async function claimWithRetry(attempts = 4, delayMs = 700): Promise<ClaimedGrant[]> {
  for (let i = 0; i < attempts; i++) {
    const grants = await claimGrants();
    if (grants.length) return grants;
    await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
  }
  return [];
}
