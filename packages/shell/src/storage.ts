// Хранилище с приоритетом Telegram CloudStorage и фолбэком на localStorage.
// ВАЖНО: telegram-web-app.js создаёт объект CloudStorage даже там, где он не
// работает (обычный браузер, Telegram < 6.9) — методы кидают/не зовут колбэк.
// Поэтому облако используем только внутри Телеги нужной версии, оборачиваем в
// try/catch и страхуем таймаутом, иначе приложение зависнет на загрузке.
import { isTelegram, webApp } from './telegram';

const CLOUD_TIMEOUT_MS = 2000;

function cloudAvailable(): boolean {
  return Boolean(isTelegram && webApp?.CloudStorage && webApp.isVersionAtLeast?.('6.9'));
}

function withTimeout<T>(run: (resolve: (v: T) => void) => void, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const t = setTimeout(() => resolve(fallback), CLOUD_TIMEOUT_MS);
    const done = (v: T) => {
      clearTimeout(t);
      resolve(v);
    };
    try {
      run(done);
    } catch {
      done(fallback);
    }
  });
}

export async function getItem(key: string): Promise<string | null> {
  if (cloudAvailable()) {
    const v = await withTimeout<string | null>(
      (resolve) => webApp!.CloudStorage!.getItem(key, (err, value) => resolve(err ? null : value || null)),
      null,
    );
    if (v !== null) return v;
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  if (cloudAvailable()) {
    await withTimeout<void>((resolve) => webApp!.CloudStorage!.setItem(key, value, () => resolve()), undefined);
  }
  // localStorage — всегда, как локальная копия/фолбэк
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function setJSON<T>(key: string, value: T): Promise<void> {
  await setItem(key, JSON.stringify(value));
}
