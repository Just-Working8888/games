// Инбокс наград. Сервер помечает грант выданным в момент /api/claim, поэтому
// клиент СНАЧАЛА фиксирует всё пришедшее в локальном инбоксе и только потом
// раздаёт по играм — так награда для Сортировки, полученная во время игры в
// Галактику, не потеряется даже при закрытии вкладки.
// Все операции сериализованы промис-мьютексом: параллельные takeGrants/stashGrants
// не затирают друг друга (read-modify-write на общем ключе).
import { claimGrants, type ClaimedGrant } from './api';
import { getJSON, setJSON } from './storage';

const INBOX_KEY = 'grants:inbox';

let lock: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const p = lock.then(fn);
  lock = p.catch(() => {});
  return p;
}

/** Положить гранты в инбокс (используется платёжным флоу). */
export function stashGrants(grants: ClaimedGrant[]): Promise<void> {
  if (!grants.length) return Promise.resolve();
  return withLock(async () => {
    const inbox = await getJSON<ClaimedGrant[]>(INBOX_KEY, []);
    await setJSON(INBOX_KEY, [...inbox, ...grants]);
  });
}

/**
 * Забрать все гранты для конкретной игры: свежие с сервера + отложенные из инбокса.
 * Гранты других игр остаются ждать. Вызывать на старте игры и после покупки.
 */
export function takeGrants(game: string): Promise<ClaimedGrant[]> {
  return withLock(async () => {
    const fresh = await claimGrants();
    const inbox = await getJSON<ClaimedGrant[]>(INBOX_KEY, []);
    const all = [...inbox, ...fresh];
    // сначала фиксируем ВСЁ на диске — окно потери сужается до сетевого ответа
    if (fresh.length) await setJSON(INBOX_KEY, all);
    const mine: ClaimedGrant[] = [];
    const rest: ClaimedGrant[] = [];
    for (const g of all) {
      const forThisGame = g.grant.type === 'vip' || g.grant.game === game;
      (forThisGame ? mine : rest).push(g);
    }
    if (mine.length) await setJSON(INBOX_KEY, rest);
    return mine;
  });
}
