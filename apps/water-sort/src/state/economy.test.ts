// Тесты экономики: границы звёздного рейтинга и награды.
import { describe, expect, it } from 'vitest';
import { dailyReward, normalReward, starsFor, vipMultiplier } from './economy';

describe('starsFor', () => {
  it('par=10: границы par*1.1=11 и par*1.6=16 (в JS 10*1.1 === 11 ровно)', () => {
    expect(starsFor(10, 10)).toBe(3);
    expect(starsFor(11, 10)).toBe(3); // ровно на границе — ещё 3
    expect(starsFor(12, 10)).toBe(2);
    expect(starsFor(16, 10)).toBe(2); // ровно на границе — ещё 2
    expect(starsFor(17, 10)).toBe(1);
  });

  it('par=5: дробная граница 5.5 округляется вверх до 6', () => {
    expect(starsFor(6, 5)).toBe(3); // ceil(5.5) = 6
    expect(starsFor(7, 5)).toBe(2);
    expect(starsFor(8, 5)).toBe(2); // ceil(8) = 8
    expect(starsFor(9, 5)).toBe(1);
  });

  it('par=3: погрешность float (3*1.1=3.3000...3) поднимает границу до 4', () => {
    expect(starsFor(4, 3)).toBe(3); // ceil(3.3000000000000003) = 4
    expect(starsFor(5, 3)).toBe(2); // ceil(4.800000000000001) = 5
    expect(starsFor(6, 3)).toBe(1);
  });

  it('меньше или равно par — всегда 3 звезды', () => {
    expect(starsFor(1, 20)).toBe(3);
    expect(starsFor(20, 20)).toBe(3);
  });
});

describe('награды', () => {
  it('normalReward: 15 + stars*5', () => {
    expect(normalReward(1)).toBe(20);
    expect(normalReward(2)).toBe(25);
    expect(normalReward(3)).toBe(30);
  });

  it('dailyReward: 50 + stars*20', () => {
    expect(dailyReward(1)).toBe(70);
    expect(dailyReward(2)).toBe(90);
    expect(dailyReward(3)).toBe(110);
  });

  it('vipMultiplier: x2 для VIP, x1 иначе', () => {
    expect(vipMultiplier(true)).toBe(2);
    expect(vipMultiplier(false)).toBe(1);
  });
});
