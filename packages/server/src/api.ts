// HTTP API для мини-аппов. Авторизация: `Authorization: tma <initData>` (подпись проверяется).
import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import type { Bot } from 'grammy';
import { parseDevAuth, validateInitData, type AuthUser } from './auth.js';
import { CATALOG, REFERRAL_SKU } from './catalog.js';
import { config, gameByKey } from './config.js';
import type { Db } from './db.js';
import { notifyOvertaken } from './bot.js';

type Env = { Variables: { user: AuthUser; signedStartParam?: string; devAuth: boolean } };

// ── rate limiting: простые пер-юзерные вёдра в памяти ───────────────────────
const buckets = new Map<string, { count: number; reset: number }>();

function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 50_000) {
    for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k);
  }
  let b = buckets.get(key);
  if (!b || now > b.reset) {
    b = { count: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  return ++b.count <= limit;
}

const rateLimit = (name: string, limit: number, windowMs = 60_000): MiddlewareHandler<Env> =>
  async (c, next) => {
    if (!allow(`${name}:${c.get('user').id}`, limit, windowMs)) return c.json({ error: 'rate_limited' }, 429);
    await next();
  };

// ── дедуп пушей: не чаще одного «обогнал» на пару игроков и игру в сутки ────
const notifiedAt = new Map<string, string>();

function shouldNotify(fromId: number, toId: number, game: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const key = `${fromId}:${toId}:${game}`;
  if (notifiedAt.get(key) === day) return false;
  if (notifiedAt.size > 50_000) notifiedAt.clear();
  notifiedAt.set(key, day);
  return true;
}

export function createApi(db: Db, bot: Bot | null): Hono<Env> {
  const app = new Hono<Env>();
  const origins = (process.env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim());
  app.use('*', cors({ origin: origins.includes('*') ? '*' : origins }));

  app.get('/health', (c) => c.json({ ok: true }));

  app.use('/api/*', async (c, next) => {
    const header = c.req.header('Authorization') || '';
    if (header.startsWith('tma ')) {
      const res = validateInitData(header.slice(4), config.botToken);
      if (!res) return c.json({ error: 'unauthorized' }, 401);
      c.set('user', res.user);
      c.set('signedStartParam', res.startParam);
      c.set('devAuth', false);
    } else if (config.devAuth) {
      const user = parseDevAuth(header);
      if (!user) return c.json({ error: 'unauthorized' }, 401);
      c.set('user', user);
      c.set('devAuth', true);
    } else {
      return c.json({ error: 'unauthorized' }, 401);
    }
    await next();
  });

  /** Первый вход: апсерт профиля + зачёт рефералки. start_param — только из подписанных данных
      (body-фолбэк работает исключительно под dev-авторизацией, чтобы не дать накрутку в проде). */
  app.post('/api/sync', rateLimit('sync', 10), async (c) => {
    const user = c.get('user');
    db.upsertUser(user);
    let startParam = c.get('signedStartParam');
    if (startParam === undefined && c.get('devAuth')) {
      const body = await c.req.json<{ startParam?: string }>().catch(() => ({ startParam: undefined }));
      startParam = body.startParam;
    }
    const ref = startParam?.match(/^ref_(\d+)$/);
    if (ref && db.setReferrer(user.id, Number(ref[1]))) {
      // бонус обоим: и приглашённому, и пригласившему
      db.addPurchase(user.id, REFERRAL_SKU.id, 0, REFERRAL_SKU.grant, null);
      db.addPurchase(Number(ref[1]), REFERRAL_SKU.id, 0, REFERRAL_SKU.grant, null);
    }
    return c.json(profileOf(db, user.id));
  });

  app.get('/api/me', (c) => c.json(profileOf(db, c.get('user').id)));

  /** Результат забега/уровня. Пушим друзьям, которых обогнали (не чаще 1/сутки на пару). */
  app.post('/api/scores', rateLimit('scores', 30), async (c) => {
    const user = c.get('user');
    const body = await c.req.json<{ game?: string; score?: number }>().catch(() => ({}) as { game?: string; score?: number });
    const game = gameByKey(body.game || '');
    const score = Math.floor(Number(body.score));
    if (!game || !Number.isFinite(score) || score < 0 || score > game.maxScore) {
      return c.json({ error: 'bad_request' }, 400);
    }
    db.upsertUser(user);
    const res = db.submitScore(user.id, game.key, score);
    if (res.isRecord) {
      for (const f of db.overtakenFriends(user.id, game.key, res.prevBest, score)) {
        if (shouldNotify(user.id, f.user_id, game.key)) {
          void notifyOvertaken(bot, f.user_id, user.firstName, game.key, score);
        }
      }
    }
    return c.json({ best: res.best, isRecord: res.isRecord, rank: db.rank(game.key, res.best) });
  });

  app.get('/api/leaderboard/:game', rateLimit('leaderboard', 30), (c) => {
    const user = c.get('user');
    const game = gameByKey(c.req.param('game'));
    if (!game) return c.json({ error: 'unknown_game' }, 400);
    const myBest = db.getBest(user.id, game.key);
    const friends = [
      { userId: user.id, name: 'Ты', score: myBest, me: true },
      ...db.friendScores(user.id, game.key).map((s) => ({ userId: s.user_id, name: s.first_name, score: s.best, me: false })),
    ].sort((a, b) => b.score - a.score);
    return c.json({
      top: db.topScores(game.key).map((s) => ({ userId: s.user_id, name: s.first_name, score: s.best })),
      friends,
      me: { best: myBest, rank: db.rank(game.key, myBest) },
    });
  });

  /** Инвойс Stars по SKU из каталога. */
  app.post('/api/invoice', rateLimit('invoice', 6), async (c) => {
    const user = c.get('user');
    if (!bot) return c.json({ error: 'payments_unavailable' }, 503);
    const { sku: skuId } = await c.req.json<{ sku?: string }>().catch(() => ({ sku: undefined }));
    const sku = CATALOG[skuId || ''];
    if (!sku) return c.json({ error: 'unknown_sku' }, 400);
    if (sku.grant.type === 'vip' && db.getUser(user.id)?.vip) {
      return c.json({ error: 'already_vip' }, 409); // не дать заплатить дважды за то, что уже есть
    }
    const url = await bot.api.createInvoiceLink(
      sku.title,
      sku.description,
      JSON.stringify({ sku: sku.id, uid: user.id }),
      '', // provider_token пуст для Stars
      'XTR',
      [{ label: sku.title, amount: sku.stars }],
    );
    return c.json({ url });
  });

  /** Забрать непогашенные гранты (после оплаты или рефералки). */
  app.post('/api/claim', rateLimit('claim', 20), (c) => c.json({ grants: db.claimGrants(c.get('user').id) }));

  return app;
}

function profileOf(db: Db, id: number) {
  const u = db.getUser(id);
  return {
    id,
    name: u?.first_name ?? 'Игрок',
    vip: Boolean(u?.vip),
    invited: db.invitedCount(id),
    unclaimed: db.unclaimedCount(id),
  };
}
