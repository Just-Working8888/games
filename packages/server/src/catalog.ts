// Каталог покупок за ⭐ Stars. Единственный источник правды о ценах и наградах.
// Клиент получает грант после оплаты через /api/claim — не доверяем клиенту.

export type Grant =
  | { type: 'coins'; game: string; amount: number }
  | { type: 'consumable'; game: string; item: 'revive' | 'extra_time'; amount: number }
  | { type: 'vip' };

export interface Sku {
  id: string;
  title: string;
  description: string;
  stars: number;
  grant: Grant;
}

export const CATALOG: Record<string, Sku> = {
  'watersort.coins.pouch': {
    id: 'watersort.coins.pouch',
    title: 'Мешочек монет',
    description: '200 монет для подсказок и пробирок',
    stars: 10,
    grant: { type: 'coins', game: 'water-sort', amount: 200 },
  },
  'watersort.coins.chest': {
    id: 'watersort.coins.chest',
    title: 'Сундук монет',
    description: '900 монет — хватит надолго',
    stars: 35,
    grant: { type: 'coins', game: 'water-sort', amount: 900 },
  },
  'galaxy.revive': {
    id: 'galaxy.revive',
    title: 'Второй шанс',
    description: 'Продолжить забег после коллапса',
    stars: 15,
    grant: { type: 'consumable', game: 'galaxy', item: 'revive', amount: 1 },
  },
  'snowball.extra15': {
    id: 'snowball.extra15',
    title: '+15 секунд',
    description: 'Продлить текущий забег',
    stars: 10,
    grant: { type: 'consumable', game: 'snowball', item: 'extra_time', amount: 1 },
  },
  vip: {
    id: 'vip',
    title: 'VIP навсегда',
    description: '×2 монеты и эксклюзивные темы во всех играх',
    stars: 150,
    grant: { type: 'vip' },
  },
};

/** Грант за рефералку (обоим участникам) — оформляется как «покупка» за 0 звёзд. */
export const REFERRAL_SKU: Sku = {
  id: 'referral.bonus',
  title: 'Бонус за друга',
  description: '100 монет в Сортировке',
  stars: 0,
  grant: { type: 'coins', game: 'water-sort', amount: 100 },
};
