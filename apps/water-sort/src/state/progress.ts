// Прогресс и настройки — через хранилище шелла (Telegram CloudStorage / localStorage).
import { getJSON, setJSON } from '@games/shell';
import { START_COINS } from './economy';

const PROGRESS_KEY = 'water-sort:progress';
const SETTINGS_KEY = 'water-sort:settings';

/** Результат одного дня ежедневки (для Wordle-шеринга последних дней). */
export interface DailyResult {
  date: string; // YYYY-MM-DD
  stars: number;
}

export interface DailyState {
  date: string; // YYYY-MM-DD последнего пройденного дня
  streak: number;
  bestStars: number;
  history: DailyResult[]; // последние результаты (хвост — самый свежий)
}

export interface Progress {
  level: number; // текущий (следующий непройденный) уровень
  best: number; // максимальный пройденный уровень
  wins: number; // всего решено уровней
  coins: number;
  vip: boolean; // куплен VIP (награды ×2, навсегда)
  stars: Record<number, number>; // уровень -> лучший результат в звёздах
  daily: DailyState;
}

export interface Settings {
  sound: boolean;
  symbols: boolean; // символы-формы для дальтоников
}

const DEFAULT_PROGRESS: Progress = {
  level: 1,
  best: 0,
  wins: 0,
  coins: START_COINS,
  vip: false,
  stars: {},
  daily: { date: '', streak: 0, bestStars: 0, history: [] },
};
const DEFAULT_SETTINGS: Settings = { sound: true, symbols: false };

/** Старые сборки писали даты без нулей («2026-9-4») — приводим к YYYY-MM-DD. */
const normDate = (s: string): string => s.replace(/-(\d)(?=-|$)/g, '-0$1');

export async function loadProgress(): Promise<Progress> {
  const p = await getJSON<Partial<Progress>>(PROGRESS_KEY, {});
  const daily = { ...DEFAULT_PROGRESS.daily, ...(p.daily || {}) };
  daily.date = normDate(daily.date);
  daily.history = daily.history.map((d) => ({ ...d, date: normDate(d.date) }));
  return {
    ...DEFAULT_PROGRESS,
    ...p,
    stars: { ...(p.stars || {}) },
    daily,
  };
}
export const saveProgress = (p: Progress): Promise<void> => setJSON(PROGRESS_KEY, p);

export const loadSettings = (): Promise<Settings> => getJSON(SETTINGS_KEY, DEFAULT_SETTINGS);
export const saveSettings = (s: Settings): Promise<void> => setJSON(SETTINGS_KEY, s);

export const totalStars = (p: Progress): number =>
  Object.values(p.stars).reduce((a, b) => a + b, 0);
