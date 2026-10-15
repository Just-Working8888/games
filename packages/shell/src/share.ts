// Шеринг результата в чат (эффект Wordle) + реф-ссылка.
import { isTelegram, webApp } from './telegram';

// Имя бота и short name мини-аппа берутся из env сборки (vite):
// VITE_BOT_USERNAME / VITE_APP_SHORT_NAME — задать в .env каждого приложения.
const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
export const BOT_USERNAME = env.VITE_BOT_USERNAME || 'your_bot';
export const APP_SHORT_NAME = env.VITE_APP_SHORT_NAME || 'app';

export function appLink(startParam?: string): string {
  const base = `https://t.me/${BOT_USERNAME}/${APP_SHORT_NAME}`;
  return startParam ? `${base}?startapp=${encodeURIComponent(startParam)}` : base;
}

/** Реф-ссылка вида ...?startapp=ref_<userId>. */
export function referralLink(userId: number): string {
  return appLink(`ref_${userId}`);
}

/**
 * Шеринг результата.
 *  — В Телеге: нативный пост в чат с текстом и ссылкой на мини-апп.
 *  — В обычном браузере (standalone): navigator.share, а если недоступен —
 *    копирование текста+ссылки в буфер обмена. Возвращает способ, которым поделились.
 */
export function shareResult(text: string, startParam?: string): Promise<'telegram' | 'native' | 'clipboard' | 'none'> {
  if (isTelegram && webApp) {
    const url = appLink(startParam);
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    webApp.openTelegramLink(shareUrl);
    return Promise.resolve('telegram');
  }

  const url = window.location.href;
  const payload = `${text}\n${url}`;

  if (navigator.share) {
    return navigator
      .share({ text, url })
      .then(() => 'native' as const)
      .catch(() => 'none' as const);
  }
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard
      .writeText(payload)
      .then(() => 'clipboard' as const)
      .catch(() => 'none' as const);
  }
  return Promise.resolve('none');
}
