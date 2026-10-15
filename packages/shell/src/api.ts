// Клиент API бэкенда (@games/server). Все запросы авторизуются initData из Телеги.
// Если API не сконфигурирован (нет VITE_API_URL) или мы вне Телеги — функции
// тихо возвращают null, а игры живут на локальных данных/моках.
import { getStartParam, isTelegram, webApp } from './telegram';

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
export const API_URL: string | undefined = env.VITE_API_URL;
/** Dev-обход подписи: VITE_DEV_AUTH="<id> <имя>" при DEV_AUTH=1 на сервере. */
const DEV_AUTH: string | undefined = env.VITE_DEV_AUTH;

export function apiEnabled(): boolean {
  return Boolean(API_URL && (isTelegram || DEV_AUTH));
}

function authHeader(): string {
  if (isTelegram && webApp) return `tma ${webApp.initData}`;
  return `dev ${DEV_AUTH}`;
}

async function request<T>(path: string, body?: unknown): Promise<T | null> {
  if (!apiEnabled()) return null;
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: authHeader(),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── типы ответов ────────────────────────────────────────────────────────────
export interface Profile {
  id: number;
  name: string;
  vip: boolean;
  invited: number;
  unclaimed: number;
}

export type Grant =
  | { type: 'coins'; game: string; amount: number }
  | { type: 'consumable'; game: string; item: 'revive' | 'extra_time'; amount: number }
  | { type: 'vip' };

export interface ClaimedGrant {
  sku: string;
  grant: Grant;
}

export interface LeaderboardEntry {
  userId: number;
  name: string;
  score: number;
  me?: boolean;
}

export interface Leaderboard {
  top: LeaderboardEntry[];
  friends: LeaderboardEntry[];
  me: { best: number; rank: number };
}

export interface ScoreResult {
  best: number;
  isRecord: boolean;
  rank: number;
}

// ── вызовы ──────────────────────────────────────────────────────────────────
/** Дёрнуть один раз на старте: профиль + зачёт рефералки из start_param. */
export const syncUser = (): Promise<Profile | null> =>
  request<Profile>('/api/sync', { startParam: getStartParam() });

export const getProfile = (): Promise<Profile | null> => request<Profile>('/api/me');

export const submitScoreRemote = (game: string, score: number): Promise<ScoreResult | null> =>
  request<ScoreResult>('/api/scores', { game, score });

export const fetchLeaderboard = (game: string): Promise<Leaderboard | null> =>
  request<Leaderboard>(`/api/leaderboard/${game}`);

export const createInvoice = (sku: string): Promise<{ url: string } | null> =>
  request<{ url: string }>('/api/invoice', { sku });

/** Забрать непогашенные награды (после покупки или рефералки). */
export const claimGrants = async (): Promise<ClaimedGrant[]> =>
  (await request<{ grants: ClaimedGrant[] }>('/api/claim', {}))?.grants ?? [];
