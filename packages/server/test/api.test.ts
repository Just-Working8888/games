// Интеграционные тесты API (createApi + Db в tmpdir, bot=null) + unit-тесты validateInitData.
// DEV_AUTH выставляем ДО импорта модулей: config.ts читает process.env при загрузке.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DEV_AUTH = '1';
process.env.NO_BOT = '1';

const { createApi } = await import('../src/api.js');
const { Db } = await import('../src/db.js');
const { validateInitData, parseDevAuth } = await import('../src/auth.js');

type App = ReturnType<typeof createApi>;

let dir: string;
let db: InstanceType<typeof Db>;
let app: App;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tg-games-test-'));
  db = new Db(join(dir, 'test.db'));
  app = createApi(db, null);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const auth = (id: number, name = `User${id}`) => ({ Authorization: `dev ${id} ${name}` });

function post(path: string, id: number, body?: unknown, name?: string) {
  return app.request(path, {
    method: 'POST',
    headers: { ...auth(id, name), 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const sync = (id: number, startParam?: string, name?: string) =>
  post('/api/sync', id, startParam ? { startParam } : {}, name);

describe('авторизация', () => {
  it('401 без заголовка', async () => {
    const res = await app.request('/api/me');
    expect(res.status).toBe(401);
  });

  it('401 с битым tma-заголовком (dev-режим не спасает)', async () => {
    const res = await app.request('/api/me', { headers: { Authorization: 'tma garbage=1&hash=00' } });
    expect(res.status).toBe(401);
  });

  it('401 с неопознанным форматом заголовка', async () => {
    const res = await app.request('/api/me', { headers: { Authorization: 'Bearer xyz' } });
    expect(res.status).toBe(401);
  });

  it('dev-заголовок пускает (DEV_AUTH=1)', async () => {
    // имя латиницей: HTTP-заголовки — ByteString, кириллица в fetch недопустима
    const res = await sync(1, undefined, 'Alice');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(1);
    expect(body.name).toBe('Alice');
  });
});

describe('/api/sync', () => {
  it('создаёт юзера; повторный sync не дублирует', async () => {
    await sync(1);
    expect(db.getUser(1)).toBeDefined();
    await sync(1);
    // ровно одна строка: первичный ключ id — проверяем через профиль и отсутствие грантов
    const res = await sync(1);
    const body = await res.json();
    expect(body.id).toBe(1);
    expect(body.invited).toBe(0);
    expect(body.unclaimed).toBe(0);
  });
});

describe('рефералка', () => {
  it('ref_<существующий id> даёт непогашенный грант обоим', async () => {
    await sync(100);
    const res = await sync(200, 'ref_100');
    const body = await res.json();
    expect(body.unclaimed).toBe(1); // приглашённый
    expect(db.unclaimedCount(100)).toBe(1); // пригласивший
    expect(db.invitedCount(100)).toBe(1);
  });

  it('повторный sync с тем же ref не плодит гранты', async () => {
    await sync(100);
    await sync(200, 'ref_100');
    await sync(200, 'ref_100');
    expect(db.unclaimedCount(200)).toBe(1);
    expect(db.unclaimedCount(100)).toBe(1);
  });

  it('смена реферера невозможна: второй ref игнорируется', async () => {
    await sync(100);
    await sync(101);
    await sync(200, 'ref_100');
    await sync(200, 'ref_101');
    expect(db.getUser(200)!.referrer_id).toBe(100);
    expect(db.unclaimedCount(101)).toBe(0);
  });

  it('ref на самого себя — ничего', async () => {
    const res = await sync(300, 'ref_300');
    expect((await res.json()).unclaimed).toBe(0);
    expect(db.getUser(300)!.referrer_id).toBeNull();
  });

  it('ref на несуществующего — ничего', async () => {
    const res = await sync(400, 'ref_999999');
    expect((await res.json()).unclaimed).toBe(0);
    expect(db.getUser(400)!.referrer_id).toBeNull();
  });
});

describe('/api/scores', () => {
  it('рекорд: best, isRecord, rank=1', async () => {
    const res = await post('/api/scores', 1, { game: 'water-sort', score: 100 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ best: 100, isRecord: true, rank: 1 });
  });

  it('не рекорд: best остаётся прежним', async () => {
    await post('/api/scores', 1, { game: 'water-sort', score: 100 });
    const res = await post('/api/scores', 1, { game: 'water-sort', score: 50 });
    const body = await res.json();
    expect(body.best).toBe(100);
    expect(body.isRecord).toBe(false);
  });

  it('rank учитывает чужие результаты', async () => {
    await post('/api/scores', 1, { game: 'water-sort', score: 100 });
    const res = await post('/api/scores', 2, { game: 'water-sort', score: 50 });
    expect((await res.json()).rank).toBe(2);
  });

  it('отказ на мусор: нет game, отрицательный, сверх пер-игрового лимита, неизвестная игра, не число', async () => {
    for (const body of [
      { score: 10 },
      { game: 'water-sort', score: -1 },
      { game: 'water-sort', score: 10_001 }, // лимит уровня water-sort — 10 000
      { game: 'galaxy', score: 5_000_001 }, // лимит очков galaxy — 5 000 000
      { game: 'tetris', score: 10 },
      { game: 'water-sort', score: 'abc' },
      {},
    ]) {
      const res = await post('/api/scores', 1, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it('ровно на пер-игровом лимите — допустимо', async () => {
    expect((await post('/api/scores', 1, { game: 'water-sort', score: 10_000 })).status).toBe(200);
    expect((await post('/api/scores', 1, { game: 'galaxy', score: 5_000_000 })).status).toBe(200);
  });
});

describe('/api/leaderboard/:game', () => {
  it('топ отсортирован по убыванию', async () => {
    await sync(1, undefined, 'A');
    await sync(2, undefined, 'B');
    await sync(3, undefined, 'C');
    await post('/api/scores', 1, { game: 'galaxy', score: 10 });
    await post('/api/scores', 2, { game: 'galaxy', score: 30 });
    await post('/api/scores', 3, { game: 'galaxy', score: 20 });
    const res = await app.request('/api/leaderboard/galaxy', { headers: auth(1, 'A') });
    const body = await res.json();
    expect(body.top.map((t: { score: number }) => t.score)).toEqual([30, 20, 10]);
    expect(body.me).toEqual({ best: 10, rank: 3 });
  });

  it('друзья содержат «Ты» и отсортированы по убыванию', async () => {
    await sync(1, undefined, 'Inviter');
    await sync(2, 'ref_1', 'Friend');
    await post('/api/scores', 1, { game: 'snowball', score: 500 });
    await post('/api/scores', 2, { game: 'snowball', score: 200 });
    const res = await app.request('/api/leaderboard/snowball', { headers: auth(2, 'Friend') });
    const body = await res.json();
    const me = body.friends.find((f: { me: boolean }) => f.me);
    expect(me.name).toBe('Ты');
    expect(me.score).toBe(200);
    expect(body.friends.map((f: { score: number }) => f.score)).toEqual([500, 200]);
  });

  it('неизвестная игра — 400', async () => {
    const res = await app.request('/api/leaderboard/doom', { headers: auth(1) });
    expect(res.status).toBe(400);
  });
});

describe('/api/claim', () => {
  it('выдаёт гранты один раз, второй вызов пуст', async () => {
    await sync(100);
    await sync(200, 'ref_100');
    const first = await post('/api/claim', 200);
    const grants = (await first.json()).grants;
    expect(grants).toHaveLength(1);
    expect(grants[0].sku).toBe('referral.bonus');
    expect(grants[0].grant).toEqual({ type: 'coins', game: 'water-sort', amount: 100 });
    const second = await post('/api/claim', 200);
    expect((await second.json()).grants).toEqual([]);
    // грант пригласившего не задет
    expect(db.unclaimedCount(100)).toBe(1);
  });
});

describe('/api/invoice', () => {
  it('без бота — 503', async () => {
    const res = await post('/api/invoice', 1, { sku: 'vip' });
    expect(res.status).toBe(503);
  });
});

// ── validateInitData (unit) ───────────────────────────────────────────────
const TOKEN = '12345:TEST_TOKEN_abc';

function makeInitData(
  token: string,
  opts: {
    user?: unknown;
    authDate?: number;
    overrideHash?: string;
    omitHash?: boolean;
    extra?: Record<string, string>;
  } = {},
): string {
  const params: Record<string, string> = {
    query_id: 'AAHtest',
    user: JSON.stringify(opts.user ?? { id: 42, first_name: 'Тест', username: 'tester' }),
    auth_date: String(opts.authDate ?? Math.floor(Date.now() / 1000)),
    ...(opts.extra ?? {}),
  };
  const dataCheckString = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = opts.overrideHash ?? createHmac('sha256', secret).update(dataCheckString).digest('hex');
  const sp = new URLSearchParams(params);
  if (!opts.omitHash) sp.set('hash', hash);
  return sp.toString();
}

describe('validateInitData', () => {
  it('корректно подписанный initData проходит', () => {
    const res = validateInitData(makeInitData(TOKEN), TOKEN);
    expect(res).not.toBeNull();
    expect(res!.user.id).toBe(42);
    expect(res!.user.firstName).toBe('Тест');
    expect(res!.user.username).toBe('tester');
  });

  it('пустой botToken — null даже при «валидной» подписи пустым секретом', () => {
    expect(validateInitData(makeInitData(''), '')).toBeNull();
  });

  it('start_param достаётся из подписанных данных', () => {
    const res = validateInitData(makeInitData(TOKEN, { extra: { start_param: 'ref_77' } }), TOKEN);
    expect(res!.startParam).toBe('ref_77');
  });

  it('подделанный hash — null', () => {
    const valid = makeInitData(TOKEN);
    const hash = new URLSearchParams(valid).get('hash')!;
    const flipped = (hash[0] === '0' ? '1' : '0') + hash.slice(1);
    expect(validateInitData(valid.replace(hash, flipped), TOKEN)).toBeNull();
  });

  it('подпись чужим токеном — null', () => {
    expect(validateInitData(makeInitData('999:OTHER'), TOKEN)).toBeNull();
  });

  it('протухший auth_date (25 часов) — null', () => {
    const stale = Math.floor(Date.now() / 1000) - 25 * 3600;
    expect(validateInitData(makeInitData(TOKEN, { authDate: stale }), TOKEN)).toBeNull();
  });

  it('битый hex в hash — null', () => {
    expect(validateInitData(makeInitData(TOKEN, { overrideHash: 'zzzz' }), TOKEN)).toBeNull();
    expect(validateInitData(makeInitData(TOKEN, { overrideHash: 'deadbeef' }), TOKEN)).toBeNull();
  });

  it('без hash — null', () => {
    expect(validateInitData(makeInitData(TOKEN, { omitHash: true }), TOKEN)).toBeNull();
  });

  it('user без числового id — null', () => {
    expect(validateInitData(makeInitData(TOKEN, { user: { id: 'not-a-number' } }), TOKEN)).toBeNull();
  });
});

describe('parseDevAuth', () => {
  it('парсит `dev <id> <имя>`', () => {
    expect(parseDevAuth('dev 7 Вася Пупкин')).toEqual({ id: 7, firstName: 'Вася Пупкин' });
  });

  it('мусор — null', () => {
    expect(parseDevAuth('dev abc Вася')).toBeNull();
    expect(parseDevAuth('tma something')).toBeNull();
  });
});
