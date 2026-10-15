// Конфигурация из окружения. Единственный обязательный секрет — BOT_TOKEN.
// .env рядом с пакетом подхватывается автоматически (уже заданные переменные не трогаем).
import { existsSync, readFileSync } from 'node:fs';

for (const path of ['.env', 'packages/server/.env']) {
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=(.*)$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
  break;
}
export interface GameDef {
  key: string; // ключ в API и БД
  title: string; // человекочитаемое имя (для пушей)
  appShortName: string; // short name мини-аппа из BotFather (/newapp)
  scoreLabel: string; // как называть результат в сообщениях
  maxScore: number; // потолок правдоподобного результата (анти-накрутка)
}

export const GAMES: GameDef[] = [
  { key: 'water-sort', title: 'Сортировка', appShortName: process.env.APP_WATERSORT || 'watersort', scoreLabel: 'уровень', maxScore: 10_000 },
  { key: 'galaxy', title: 'Галактика', appShortName: process.env.APP_GALAXY || 'galaxy', scoreLabel: 'очков', maxScore: 5_000_000 },
  { key: 'snowball', title: 'Снежный ком', appShortName: process.env.APP_SNOWBALL || 'snowball', scoreLabel: 'очков', maxScore: 5_000_000 },
];

export const gameByKey = (key: string): GameDef | undefined => GAMES.find((g) => g.key === key);

export const config = {
  botToken: process.env.BOT_TOKEN || '',
  botUsername: process.env.BOT_USERNAME || 'your_bot',
  port: Number(process.env.PORT || 8787),
  dbPath: process.env.DB_PATH || 'data/games.db',
  /** true — API принимает заголовок `Authorization: dev <id> <name>` без подписи (только локально!) */
  devAuth: process.env.DEV_AUTH === '1',
  /** true — не запускать long polling бота (например, локально без токена) */
  noBot: process.env.NO_BOT === '1' || !process.env.BOT_TOKEN,
};

export function appLink(shortName: string, startParam?: string): string {
  const base = `https://t.me/${config.botUsername}/${shortName}`;
  return startParam ? `${base}?startapp=${encodeURIComponent(startParam)}` : base;
}
