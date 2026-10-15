import { describe, expect, it } from 'vitest';
import { belowSurface, polygonArea, surfaceForArea } from './pourGeometry';

describe('liquid surface geometry', () => {
  const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  it('clips the vessel without changing the requested liquid volume', () => {
    expect(polygonArea(belowSurface(square, 6))).toBe(40);
    expect(surfaceForArea(square, 40)).toBeCloseTo(6, 5);
  });
  it.each([0, 30, 90, 105, 123, -123])('preserves volume at %s degrees', degrees => {
    const angle = degrees * Math.PI / 180;
    const rotated = square.map(p => ({ x: p.x * Math.cos(angle) - p.y * Math.sin(angle), y: p.x * Math.sin(angle) + p.y * Math.cos(angle) }));
    for (const amount of [0, 10, 25, 70, 100]) {
      const surface = surfaceForArea(rotated, amount);
      expect(polygonArea(belowSurface(rotated, surface))).toBeCloseTo(amount, 4);
    }
  });
});
