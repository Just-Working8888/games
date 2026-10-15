// Генерация ГАРАНТИРОВАННО решаемых уровней + солвер (он же источник подсказок и «пара»).
import { Board, Move, CAPACITY, isSolved, legalMoves, pour, serialize } from './engine';
import { MAX_COLORS } from '../theme';

export type RNG = () => number;

/**
 * DFS-солвер. Возвращает последовательность ходов до решения или null,
 * если решение не найдено в пределах nodeCap (или его нет).
 */
export function solve(start: Board, nodeCap = 120_000): Move[] | null {
  const visited = new Set<string>([serialize(start)]);
  const stack: { board: Board; path: Move[] }[] = [{ board: start, path: [] }];
  let nodes = 0;

  while (stack.length) {
    const { board, path } = stack.pop()!;
    if (isSolved(board)) return path;
    if (++nodes > nodeCap) return null;

    const moves = legalMoves(board);
    for (let i = moves.length - 1; i >= 0; i--) {
      const [from, to] = moves[i];
      const nb = pour(board, from, to);
      const key = serialize(nb);
      if (visited.has(key)) continue;
      visited.add(key);
      stack.push({ board: nb, path: [...path, [from, to]] });
    }
  }
  return null;
}

export const isSolvable = (board: Board): boolean => solve(board) !== null;

/** Первый ход решения из текущей позиции — для подсказки. null, если позиция тупиковая. */
export function findHint(board: Board): Move | null {
  const path = solve(board);
  return path && path.length ? path[0] : null;
}

// ── ГСЧ ───────────────────────────────────────────────────────────────────
export function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Сид ежедневного челленджа из даты (одинаков для всех в этот день). */
export function dailySeed(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function shuffle<T>(arr: T[], rng: RNG): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomFill(colorCount: number, empties: number, rng: RNG): Board {
  const pool: number[] = [];
  for (let c = 0; c < colorCount; c++) for (let k = 0; k < CAPACITY; k++) pool.push(c);
  const mixed = shuffle(pool, rng);
  const board: Board = [];
  for (let c = 0; c < colorCount; c++) board.push(mixed.slice(c * CAPACITY, c * CAPACITY + CAPACITY));
  for (let e = 0; e < empties; e++) board.push([]);
  return board;
}

/** Решаемая нетривиальная раскладка вместе с путём решения (solve вызывается один раз). */
function generateSolvable(
  colorCount: number,
  empties: number,
  rng: RNG,
): { board: Board; path: Move[] } {
  const colors = Math.min(colorCount, MAX_COLORS);
  for (let attempt = 0; attempt < 300; attempt++) {
    const board = randomFill(colors, empties, rng);
    if (isSolved(board)) continue;
    const path = solve(board);
    if (path) return { board, path };
  }
  return generateSolvable(colors, empties + 1, rng);
}

/** Решаемая нетривиальная раскладка. rng позволяет детерминированную генерацию (daily). */
export function generateLevel(colorCount: number, empties = 2, rng: RNG = Math.random): Board {
  return generateSolvable(colorCount, empties, rng).board;
}

/** Уровень вместе с «паром» (длина найденного решения) — для звёздного рейтинга. */
export function generateWithPar(
  colorCount: number,
  empties = 2,
  rng: RNG = Math.random,
): { board: Board; par: number } {
  const { board, path } = generateSolvable(colorCount, empties, rng);
  return { board, par: path.length };
}

/** Параметры сложности по номеру уровня: число цветов растёт, пустых пробирок всегда 2. */
export function levelConfig(level: number): { colors: number; empties: number } {
  const colors = Math.min(3 + Math.floor((level - 1) / 2), 10);
  return { colors, empties: 2 };
}
