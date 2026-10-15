// Рекорды: локальный best (мгновенно, офлайн) + отправка на бэкенд, когда он есть.
// Лидерборд друзей: реальный с API, иначе — мок для дизайна/дев-режима.
import { apiEnabled, fetchLeaderboard, submitScoreRemote } from './api';
import { getJSON, setJSON } from './storage';

export interface ScoreEntry {
  userId: number;
  name: string;
  score: number;
  me?: boolean;
}

const bestKey = (game: string) => `best:${game}`;

export async function getBest(game: string): Promise<number> {
  return getJSON<number>(bestKey(game), 0);
}

/**
 * Сохраняет рекорд локально и (fire-and-forget) на сервере.
 * Возвращает true, если это новый личный рекорд.
 */
export async function submitScore(game: string, score: number): Promise<boolean> {
  void submitScoreRemote(game, score); // сервер сам решит, рекорд ли, и разошлёт пуши
  const best = await getBest(game);
  if (score > best) {
    await setJSON(bestKey(game), score);
    return true;
  }
  return false;
}

/**
 * Лидерборд друзей (я + приглашённые/пригласивший). С бэкендом — реальный,
 * без него — мок, чтобы экраны жили и в браузере.
 */
export async function getFriendsBoard(game: string, myScore: number): Promise<ScoreEntry[]> {
  if (apiEnabled()) {
    const lb = await fetchLeaderboard(game);
    if (lb) {
      const entries = lb.friends.map((e) => (e.me ? { ...e, score: Math.max(e.score, myScore) } : e));
      return entries.sort((a, b) => b.score - a.score);
    }
  }
  const mock: ScoreEntry[] = [
    { userId: 1, name: 'Аня', score: Math.round(myScore * 1.3) + 40 },
    { userId: 2, name: 'Ты', score: myScore, me: true },
    { userId: 3, name: 'Марк', score: Math.round(myScore * 0.7) },
  ];
  return mock.sort((a, b) => b.score - a.score);
}
