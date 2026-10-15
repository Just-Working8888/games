// Чистая логика water-sort. Пробирка — массив цветов снизу вверх, вместимость CAPACITY.
export const CAPACITY = 4;

export type Tube = number[]; // индексы цветов, [0] — дно
export type Board = Tube[];

export type Move = [from: number, to: number];

export const topColor = (t: Tube): number => (t.length ? t[t.length - 1] : -1);

/** Размер верхнего однотонного столбика. */
export function topRunSize(t: Tube): number {
  if (!t.length) return 0;
  const c = topColor(t);
  let n = 0;
  for (let i = t.length - 1; i >= 0 && t[i] === c; i--) n++;
  return n;
}

export const isUniform = (t: Tube): boolean => t.length > 0 && t.every((c) => c === t[0]);
export const isTubeComplete = (t: Tube): boolean => t.length === CAPACITY && isUniform(t);
/** Пустая или полностью заполнена одним цветом — «завершённая». */
export const isTubeDone = (t: Tube): boolean => t.length === 0 || isTubeComplete(t);

export const cloneBoard = (b: Board): Board => b.map((t) => t.slice());

/** Сколько единиц перельётся при ходе from→to (0 — ход невозможен). */
export function pourAmount(board: Board, from: number, to: number): number {
  if (from === to) return 0;
  const src = board[from];
  const dst = board[to];
  if (src.length === 0) return 0;
  if (dst.length >= CAPACITY) return 0;
  if (dst.length > 0 && topColor(dst) !== topColor(src)) return 0;
  return Math.min(topRunSize(src), CAPACITY - dst.length);
}

export const canPour = (board: Board, from: number, to: number): boolean =>
  pourAmount(board, from, to) > 0;

/** Возвращает новую доску после переливания (immutable). */
export function pour(board: Board, from: number, to: number): Board {
  const amount = pourAmount(board, from, to);
  if (amount === 0) return board;
  const next = cloneBoard(board);
  const color = topColor(next[from]);
  for (let i = 0; i < amount; i++) next[to].push(color);
  next[from].length -= amount;
  return next;
}

export const isSolved = (board: Board): boolean => board.every(isTubeDone);

export function hasMoves(board: Board): boolean {
  for (let i = 0; i < board.length; i++)
    for (let j = 0; j < board.length; j++) if (canPour(board, i, j)) return true;
  return false;
}

/**
 * Легальные ходы с отсечениями для солвера:
 *  — не льём однотонную пробирку в пустую (бессмысленная перестановка);
 *  — не льём в саму себя.
 * Порядок: сначала ходы, которые консолидируют цвет (dst не пуст), потом в пустые.
 */
export function legalMoves(board: Board): Move[] {
  const consolidating: Move[] = [];
  const toEmpty: Move[] = [];
  for (let from = 0; from < board.length; from++) {
    const src = board[from];
    if (src.length === 0) continue;
    const srcUniform = isUniform(src);
    for (let to = 0; to < board.length; to++) {
      if (from === to) continue;
      if (pourAmount(board, from, to) === 0) continue;
      if (board[to].length === 0) {
        if (srcUniform) continue; // перестановка целого столбика в пустую — бесполезно
        toEmpty.push([from, to]);
      } else {
        consolidating.push([from, to]);
      }
    }
  }
  return [...consolidating, ...toEmpty];
}

/** Каноническая сериализация (пробирки отсортированы — симметричные состояния схлопываются). */
export function serialize(board: Board): string {
  return board
    .map((t) => t.join(','))
    .sort()
    .join('|');
}
