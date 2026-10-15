// Экономика: звёзды, монеты, награды и цены. Баланс «зарабатываешь меньше, чем тратишь»,
// чтобы паки за ⭐ Stars имели смысл (см. SKUS ниже).
export const HINT_COST = 30;
export const TUBE_COST = 60;
export const UNDO_COST = 10; // цена отмены после исчерпания бесплатных
export const FREE_UNDOS = 3; // бесплатных отмен на уровень
export const START_COINS = 120;

/** Каталог покупок за ⭐ Stars (id должны совпадать с каталогом сервера). */
export const SKUS = {
  pouch: { id: 'watersort.coins.pouch', stars: 10, coins: 200 },
  chest: { id: 'watersort.coins.chest', stars: 35, coins: 900 },
  vip: { id: 'vip', stars: 150 },
} as const;

/** 1–3 звезды по эффективности: сравниваем ходы игрока с «паром» (решением солвера). */
export function starsFor(moves: number, par: number): 1 | 2 | 3 {
  if (moves <= Math.ceil(par * 1.1)) return 3;
  if (moves <= Math.ceil(par * 1.6)) return 2;
  return 1;
}

export const normalReward = (stars: number): number => 15 + stars * 5;
export const dailyReward = (stars: number): number => 50 + stars * 20;

/** VIP удваивает любые награды монетами. */
export const vipMultiplier = (vip: boolean): number => (vip ? 2 : 1);
