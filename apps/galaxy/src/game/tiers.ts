// Небесные тела: прогрессия слияния астероид → ... → галактика.
export interface Tier {
  name: string;
  radius: number;
  c1: string; // центр радиального градиента (светлее)
  c2: string; // край (темнее)
  glow: string;
  ring?: boolean; // кольцо (газовый гигант)
}

export const TIERS: Tier[] = [
  { name: 'астероид', radius: 14, c1: '#c7cdd6', c2: '#6b7280', glow: '#9aa4b2' },
  { name: 'метеор', radius: 18, c1: '#e6d4a8', c2: '#9c7b3f', glow: '#c8a35a' },
  { name: 'комета', radius: 23, c1: '#a8f0ea', c2: '#2aa79c', glow: '#4ce0d5' },
  { name: 'луна', radius: 29, c1: '#eef1f5', c2: '#9aa4b2', glow: '#c9d1d9' },
  { name: 'планета', radius: 36, c1: '#8fb8ff', c2: '#2b5fbf', glow: '#4c8dff' },
  { name: 'газовый гигант', radius: 45, c1: '#ffcf9a', c2: '#c86a2a', glow: '#ff9f4c', ring: true },
  { name: 'звезда', radius: 55, c1: '#fff1c4', c2: '#f2b21e', glow: '#ffce4c' },
  { name: 'красный гигант', radius: 66, c1: '#ffb0b0', c2: '#c22e46', glow: '#ff5c7c' },
  { name: 'нейтронная', radius: 78, c1: '#d8c8ff', c2: '#6a3fd0', glow: '#a06bff' },
  { name: 'квазар', radius: 90, c1: '#bfe8ff', c2: '#2b8fd0', glow: '#5cc8ff' },
  { name: 'галактика', radius: 104, c1: '#ffc4f2', c2: '#c23aa0', glow: '#ff7cf0', ring: true },
];

export const MAX_TIER = TIERS.length - 1;
export const SPAWNABLE = 5; // новые тела — из первых 5 тиров

/** Вес выпадения: мелкие чаще. */
export function randomSpawnTier(rng: () => number): number {
  const weights = [5, 4, 3, 2, 1];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < SPAWNABLE; i++) {
    if (r < weights[i]) return i;
    r -= weights[i];
  }
  return 0;
}
