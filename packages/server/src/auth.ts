// Валидация Telegram WebApp initData (HMAC-подпись, см. core.telegram.org/bots/webapps).
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface AuthUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  isPremium?: boolean;
}

const MAX_AGE_SEC = 24 * 60 * 60;

export interface AuthResult {
  user: AuthUser;
  /** start_param из ПОДПИСАННЫХ данных — единственный доверенный источник рефералки. */
  startParam?: string;
}

/** Возвращает пользователя, если подпись initData валидна и не протухла, иначе null. */
export function validateInitData(initData: string, botToken: string): AuthResult | null {
  // без токена секрет вычислим кем угодно — валидация невозможна в принципе
  if (!botToken) return null;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }
  const hash = params.get('hash');
  if (!hash) return null;

  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key !== 'hash') pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SEC) return null;

  try {
    const u = JSON.parse(params.get('user') || '');
    if (typeof u?.id !== 'number') return null;
    return {
      user: {
        id: u.id,
        firstName: u.first_name || 'Игрок',
        lastName: u.last_name,
        username: u.username,
        photoUrl: u.photo_url,
        isPremium: u.is_premium,
      },
      startParam: params.get('start_param') || undefined,
    };
  } catch {
    return null;
  }
}

/** Dev-режим: `Authorization: dev <id> <имя...>` — без подписи, только за флагом DEV_AUTH. */
export function parseDevAuth(header: string): AuthUser | null {
  const m = header.match(/^dev (\d+) (.+)$/);
  if (!m) return null;
  return { id: Number(m[1]), firstName: m[2] };
}
