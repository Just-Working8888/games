// Тесты генератора уровней, ГСЧ и солвера.
import { describe, expect, it } from 'vitest';
import { CAPACITY, isSolved, pour, pourAmount, type Board } from './engine';
import { dailySeed, findHint, generateLevel, generateWithPar, mulberry32, solve } from './generator';

describe('mulberry32', () => {
  it('детерминизм: одинаковый сид — одинаковая последовательность', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });

  it('разные сиды дают разные последовательности', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('значения в [0, 1)', () => {
    const rng = mulberry32(777);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('dailySeed', () => {
  it('стабильность: YYYYMMDD из даты', () => {
    expect(dailySeed(new Date(2026, 8, 4))).toBe(20260904);
    expect(dailySeed(new Date(2024, 0, 31))).toBe(20240131);
  });

  it('одинаков в течение дня вне зависимости от времени', () => {
    expect(dailySeed(new Date(2026, 8, 4, 0, 0, 1))).toBe(dailySeed(new Date(2026, 8, 4, 23, 59, 59)));
  });
});

describe('generateLevel', () => {
  for (const colors of [3, 4, 5, 6]) {
    it(`${colors} цветов: уровень решаем и не решён изначально`, () => {
      const board = generateLevel(colors, 2, mulberry32(1000 + colors));
      expect(isSolved(board)).toBe(false);
      expect(solve(board)).not.toBeNull();
      // каждый цвет встречается ровно CAPACITY раз
      const counts = new Map<number, number>();
      for (const t of board) for (const c of t) counts.set(c, (counts.get(c) ?? 0) + 1);
      expect(counts.size).toBe(colors);
      for (const n of counts.values()) expect(n).toBe(CAPACITY);
    });
  }

  it('детерминизм с фиксированным rng', () => {
    const a = generateLevel(4, 2, mulberry32(42));
    const b = generateLevel(4, 2, mulberry32(42));
    expect(a).toEqual(b);
  });
});

describe('solve', () => {
  const handMade: Board = [
    [0, 1, 0, 1],
    [1, 0, 1, 0],
    [],
    [],
  ];

  it('находит решение на составленной вручную доске', () => {
    const path = solve(handMade);
    expect(path).not.toBeNull();
    // проигрываем решение: каждый ход легален, финал — решённая доска
    let board = handMade;
    for (const [f, t] of path!) {
      expect(pourAmount(board, f, t)).toBeGreaterThan(0);
      board = pour(board, f, t);
    }
    expect(isSolved(board)).toBe(true);
  });

  it('par разумен: решение не длиннее 30 ходов и не пустое', () => {
    const path = solve(handMade)!;
    expect(path.length).toBeGreaterThan(0);
    expect(path.length).toBeLessThanOrEqual(30);
  });

  it('решённая доска — пустой путь', () => {
    expect(solve([[2, 2, 2, 2], []])).toEqual([]);
  });

  it('нерешаемая доска — null', () => {
    // один цвет размазан, свободного места нет вообще
    const dead: Board = [
      [0, 1, 0, 1],
      [1, 0, 1, 0],
    ];
    expect(solve(dead)).toBeNull();
  });

  it('generateWithPar возвращает согласованный par', () => {
    const { board, par } = generateWithPar(3, 2, mulberry32(7));
    expect(par).toBeGreaterThan(0);
    const path = solve(board);
    expect(path).not.toBeNull();
    expect(par).toBe(path!.length);
  });
});

describe('findHint', () => {
  it('возвращает ход, после которого уровень всё ещё решаем', () => {
    const board = generateLevel(3, 2, mulberry32(99));
    const hint = findHint(board);
    expect(hint).not.toBeNull();
    const [f, t] = hint!;
    expect(pourAmount(board, f, t)).toBeGreaterThan(0);
    expect(solve(pour(board, f, t))).not.toBeNull();
  });

  it('на решённой доске подсказки нет', () => {
    expect(findHint([[3, 3, 3, 3], []])).toBeNull();
  });
});
