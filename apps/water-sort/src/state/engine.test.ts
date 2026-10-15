// Тесты чистой логики water-sort: переливания, завершённость, ходы, сериализация.
import { describe, expect, it } from 'vitest';
import {
  CAPACITY,
  isSolved,
  legalMoves,
  pour,
  pourAmount,
  serialize,
  topRunSize,
  type Board,
} from './engine';

describe('topRunSize', () => {
  it('пустая пробирка — 0', () => {
    expect(topRunSize([])).toBe(0);
  });

  it('считает только верхний однотонный столбик', () => {
    expect(topRunSize([0, 1, 1])).toBe(2);
    expect(topRunSize([1, 1, 1, 1])).toBe(4);
    expect(topRunSize([2, 0, 1])).toBe(1);
  });
});

describe('pourAmount / pour', () => {
  it('частичный перелив: льётся min(размер столбика, свободное место)', () => {
    // верхний столбик из 3 единиц цвета 1, в целевой всего 2 места
    const board: Board = [
      [0, 1, 1, 1],
      [1, 1],
    ];
    expect(pourAmount(board, 0, 1)).toBe(2);
    const next = pour(board, 0, 1);
    expect(next[0]).toEqual([0, 1]);
    expect(next[1]).toEqual([1, 1, 1, 1]);
  });

  it('перелив в пустую пробирку переносит весь верхний столбик', () => {
    const board: Board = [[0, 2, 2], []];
    expect(pourAmount(board, 0, 1)).toBe(2);
    const next = pour(board, 0, 1);
    expect(next[0]).toEqual([0]);
    expect(next[1]).toEqual([2, 2]);
  });

  it('несовпадающий цвет — ход невозможен', () => {
    const board: Board = [
      [0, 1],
      [0, 2],
    ];
    expect(pourAmount(board, 0, 1)).toBe(0);
    expect(pour(board, 0, 1)).toBe(board); // возвращает ту же доску
  });

  it('полная цель — ход невозможен', () => {
    const board: Board = [
      [1, 1],
      [1, 1, 1, 1],
    ];
    expect(board[1].length).toBe(CAPACITY);
    expect(pourAmount(board, 0, 1)).toBe(0);
  });

  it('из пустой и в саму себя — 0', () => {
    const board: Board = [[], [1]];
    expect(pourAmount(board, 0, 1)).toBe(0);
    expect(pourAmount(board, 1, 1)).toBe(0);
  });

  it('pour иммутабелен: исходная доска не меняется', () => {
    const board: Board = [[0, 1], []];
    const snapshot = JSON.parse(JSON.stringify(board));
    pour(board, 0, 1);
    expect(board).toEqual(snapshot);
  });
});

describe('isSolved', () => {
  it('true: все пробирки пустые или полные одним цветом', () => {
    const board: Board = [[0, 0, 0, 0], [1, 1, 1, 1], [], []];
    expect(isSolved(board)).toBe(true);
  });

  it('false: есть смешанная или неполная однотонная', () => {
    expect(isSolved([[0, 0, 0, 0], [1, 1, 1], []])).toBe(false);
    expect(isSolved([[0, 1, 0, 1], []])).toBe(false);
  });
});

describe('legalMoves', () => {
  it('не предлагает лить однотонную пробирку в пустую', () => {
    const board: Board = [[3, 3], [], []];
    expect(legalMoves(board)).toEqual([]);
  });

  it('смешанную в пустую лить можно, ход в саму себя исключён', () => {
    const board: Board = [[0, 1], [], []];
    const moves = legalMoves(board);
    expect(moves).toContainEqual([0, 1]);
    expect(moves).toContainEqual([0, 2]);
    expect(moves.some(([f, t]) => f === t)).toBe(false);
  });

  it('консолидирующие ходы идут раньше ходов в пустые', () => {
    const board: Board = [[0, 1], [1], []];
    const moves = legalMoves(board);
    expect(moves[0]).toEqual([0, 1]); // 1 поверх 1 — консолидация
    expect(moves).toContainEqual([0, 2]); // смешанная в пустую — в хвосте
    expect(moves.indexOf(moves.find(([, t]) => board[t].length === 0)!)).toBeGreaterThan(0);
  });

  it('каждый предложенный ход действительно возможен', () => {
    const board: Board = [[0, 1, 2], [2, 1], [0], []];
    for (const [f, t] of legalMoves(board)) {
      expect(pourAmount(board, f, t)).toBeGreaterThan(0);
    }
  });
});

describe('serialize', () => {
  it('канонизация: перестановка пробирок даёт одинаковую строку', () => {
    const a: Board = [[0, 1], [2], []];
    const b: Board = [[], [2], [0, 1]];
    expect(serialize(a)).toBe(serialize(b));
  });

  it('разные состояния — разные строки', () => {
    expect(serialize([[0, 1], []])).not.toBe(serialize([[1, 0], []]));
  });

  it('порядок внутри пробирки значим', () => {
    expect(serialize([[0, 1]])).not.toBe(serialize([[1, 0]]));
  });
});
