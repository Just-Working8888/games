// SQLite-хранилище (better-sqlite3, синхронный API — идеален для одного процесса).
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AuthUser } from './auth.js';
import type { Grant } from './catalog.js';

export interface UserRow {
  id: number;
  first_name: string;
  username: string | null;
  photo_url: string | null;
  referrer_id: number | null;
  vip: number;
  created_at: number;
  last_seen: number;
}

export interface ScoreRow {
  user_id: number;
  game: string;
  best: number;
  updated_at: number;
}

export interface PurchaseRow {
  id: number;
  user_id: number;
  sku: string;
  stars: number;
  grant_json: string;
  charge_id: string | null;
  created_at: number;
  claimed: number;
}

export class Db {
  private db: Database.Database;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        first_name TEXT NOT NULL,
        username TEXT,
        photo_url TEXT,
        referrer_id INTEGER,
        vip INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_seen INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS scores (
        user_id INTEGER NOT NULL,
        game TEXT NOT NULL,
        best INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, game)
      );
      CREATE INDEX IF NOT EXISTS idx_scores_game_best ON scores(game, best DESC);
      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        sku TEXT NOT NULL,
        stars INTEGER NOT NULL,
        grant_json TEXT NOT NULL,
        charge_id TEXT UNIQUE,
        created_at INTEGER NOT NULL,
        claimed INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_purchases_unclaimed ON purchases(user_id, claimed);
    `);
  }

  upsertUser(u: AuthUser): UserRow {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO users (id, first_name, username, photo_url, created_at, last_seen)
         VALUES (@id, @firstName, @username, @photoUrl, @now, @now)
         ON CONFLICT(id) DO UPDATE SET
           first_name = excluded.first_name,
           username = excluded.username,
           photo_url = excluded.photo_url,
           last_seen = excluded.last_seen`,
      )
      .run({ id: u.id, firstName: u.firstName, username: u.username ?? null, photoUrl: u.photoUrl ?? null, now });
    return this.getUser(u.id)!;
  }

  getUser(id: number): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  }

  /** Привязывает реферера один раз. true — если привязка произошла именно сейчас. */
  setReferrer(userId: number, referrerId: number): boolean {
    if (userId === referrerId) return false;
    if (!this.getUser(referrerId)) return false;
    const res = this.db
      .prepare('UPDATE users SET referrer_id = ? WHERE id = ? AND referrer_id IS NULL')
      .run(referrerId, userId);
    return res.changes > 0;
  }

  setVip(userId: number): void {
    this.db.prepare('UPDATE users SET vip = 1 WHERE id = ?').run(userId);
  }

  /** «Друзья» = кого пригласил я + кто пригласил меня (только прямые связи). */
  friendIds(userId: number): number[] {
    const me = this.getUser(userId);
    const rows = this.db
      .prepare(`SELECT id FROM users WHERE referrer_id = @id OR id = @ref`)
      .all({ id: userId, ref: me?.referrer_id ?? -1 }) as { id: number }[];
    return [...new Set(rows.map((r) => r.id))].filter((id) => id !== userId);
  }

  getBest(userId: number, game: string): number {
    const row = this.db.prepare('SELECT best FROM scores WHERE user_id = ? AND game = ?').get(userId, game) as
      | { best: number }
      | undefined;
    return row?.best ?? 0;
  }

  /** Сохраняет рекорд. Возвращает прежний best (для определения «кого обогнали»). */
  submitScore(userId: number, game: string, score: number): { best: number; isRecord: boolean; prevBest: number } {
    const prev = this.getBest(userId, game);
    if (score <= prev) return { best: prev, isRecord: false, prevBest: prev };
    this.db
      .prepare(
        `INSERT INTO scores (user_id, game, best, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, game) DO UPDATE SET best = excluded.best, updated_at = excluded.updated_at`,
      )
      .run(userId, game, score, Date.now());
    return { best: score, isRecord: true, prevBest: prev };
  }

  topScores(game: string, limit = 20): (ScoreRow & { first_name: string; username: string | null })[] {
    return this.db
      .prepare(
        `SELECT s.*, u.first_name, u.username FROM scores s
         JOIN users u ON u.id = s.user_id
         WHERE s.game = ? ORDER BY s.best DESC, s.updated_at ASC LIMIT ?`,
      )
      .all(game, limit) as (ScoreRow & { first_name: string; username: string | null })[];
  }

  friendScores(userId: number, game: string): (ScoreRow & { first_name: string })[] {
    const ids = this.friendIds(userId);
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    return this.db
      .prepare(
        `SELECT s.*, u.first_name FROM scores s JOIN users u ON u.id = s.user_id
         WHERE s.game = ? AND s.user_id IN (${placeholders}) ORDER BY s.best DESC`,
      )
      .all(game, ...ids) as (ScoreRow & { first_name: string })[];
  }

  rank(game: string, score: number): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM scores WHERE game = ? AND best > ?')
      .get(game, score) as { n: number };
    return row.n + 1;
  }

  /** Друзья, чей рекорд оказался между моим прежним и новым результатом — их мы «обогнали». */
  overtakenFriends(userId: number, game: string, prevBest: number, newBest: number): (ScoreRow & { first_name: string })[] {
    return this.friendScores(userId, game).filter((s) => s.best < newBest && s.best >= prevBest && s.best > 0);
  }

  addPurchase(userId: number, sku: string, stars: number, grant: Grant, chargeId: string | null): void {
    this.db
      .prepare(
        `INSERT INTO purchases (user_id, sku, stars, grant_json, charge_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(charge_id) DO NOTHING`,
      )
      .run(userId, sku, stars, JSON.stringify(grant), chargeId, Date.now());
  }

  /** Атомарно забирает непогашенные гранты (UPDATE..RETURNING — без окна между SELECT и UPDATE). */
  claimGrants(userId: number): { sku: string; grant: Grant }[] {
    const rows = this.db
      .prepare('UPDATE purchases SET claimed = 1 WHERE user_id = ? AND claimed = 0 RETURNING sku, grant_json')
      .all(userId) as { sku: string; grant_json: string }[];
    return rows.map((r) => ({ sku: r.sku, grant: JSON.parse(r.grant_json) as Grant }));
  }

  unclaimedCount(userId: number): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM purchases WHERE user_id = ? AND claimed = 0')
      .get(userId) as { n: number };
    return row.n;
  }

  invitedCount(userId: number): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM users WHERE referrer_id = ?').get(userId) as { n: number };
    return row.n;
  }
}
