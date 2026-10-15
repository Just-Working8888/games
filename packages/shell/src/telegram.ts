// Тонкая типизированная обёртка над Telegram WebApp.
// Работает и в браузере (dev): если Telegram нет — отдаёт заглушки,
// чтобы игру можно было разрабатывать без Телеги.

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type NotificationType = 'error' | 'success' | 'warning';

export interface TgUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  isPremium?: boolean;
  photoUrl?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: any; start_param?: string };
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  ready(): void;
  expand(): void;
  close(): void;
  HapticFeedback: {
    impactOccurred(style: HapticStyle): void;
    notificationOccurred(type: NotificationType): void;
    selectionChanged(): void;
  };
  BackButton: {
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
  CloudStorage?: {
    getItem(key: string, cb: (err: Error | null, value: string) => void): void;
    setItem(key: string, value: string, cb?: (err: Error | null, ok: boolean) => void): void;
  };
  openTelegramLink(url: string): void;
  openInvoice?(url: string, cb?: (status: InvoiceStatus) => void): void;
  isVersionAtLeast?(version: string): boolean;
}

export type InvoiceStatus = 'paid' | 'cancelled' | 'failed' | 'pending';

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export const webApp: TelegramWebApp | undefined = window.Telegram?.WebApp;
export const isTelegram = Boolean(webApp?.initData);

/** Вызвать один раз на старте приложения. */
export function initTelegram(): void {
  if (!webApp) return;
  webApp.ready();
  webApp.expand();
}

export function getUser(): TgUser | null {
  const u = webApp?.initDataUnsafe?.user;
  if (!u) {
    // dev-заглушка
    return isTelegram ? null : { id: 0, firstName: 'Dev', username: 'dev' };
  }
  return {
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    username: u.username,
    languageCode: u.language_code,
    isPremium: u.is_premium,
    photoUrl: u.photo_url,
  };
}

/** start_param из deep-link (для рефералок: t.me/bot/app?startapp=ref_123). */
export function getStartParam(): string | undefined {
  return webApp?.initDataUnsafe?.start_param;
}

export function colorScheme(): 'light' | 'dark' {
  return webApp?.colorScheme ?? 'dark';
}

export const haptic = {
  tap(style: HapticStyle = 'light') {
    webApp?.HapticFeedback.impactOccurred(style);
  },
  notify(type: NotificationType) {
    webApp?.HapticFeedback.notificationOccurred(type);
  },
  select() {
    webApp?.HapticFeedback.selectionChanged();
  },
};

/**
 * Открывает нативный инвойс Stars. Резолвится финальным статусом оплаты.
 * Вне Телеги (или на старом клиенте) — 'unavailable'.
 */
export function openInvoice(url: string): Promise<InvoiceStatus | 'unavailable'> {
  if (!webApp?.openInvoice) return Promise.resolve('unavailable');
  return new Promise((resolve) => webApp!.openInvoice!(url, (status) => resolve(status)));
}

/**
 * Показывает нативную кнопку «Назад» Телеги и вешает обработчик.
 * Возвращает функцию очистки (скрыть + снять обработчик).
 * В браузере (без Телеги) — no-op, возвращает пустую очистку.
 */
export function setupBackButton(onClick: () => void): () => void {
  const bb = webApp?.BackButton;
  if (!bb) return () => {};
  bb.onClick(onClick);
  bb.show();
  return () => {
    bb.offClick(onClick);
    bb.hide();
  };
}
