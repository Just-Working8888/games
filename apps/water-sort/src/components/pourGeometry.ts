export type Point = { x: number; y: number };
export const POUR_TIMING = { approach: 320, flow: 850, return: 330 };
export const POUR_MS = POUR_TIMING.approach + POUR_TIMING.flow + POUR_TIMING.return;

export function polygonArea(points: Point[]): number {
  return Math.abs(points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p.x * q.y - q.x * p.y;
  }, 0)) / 2;
}

/** Clip a rotated vessel against a horizontal liquid surface. */
export function belowSurface(points: Point[], y: number): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (a.y >= y) result.push(a);
    if ((a.y >= y) !== (b.y >= y)) {
      const t = (y - a.y) / (b.y - a.y);
      result.push({ x: a.x + t * (b.x - a.x), y });
    }
  }
  return result;
}

/** Find the waterline by volume, so tilting never scales or stretches the liquid. */
export function surfaceForArea(points: Point[], area: number): number {
  let lo = Math.min(...points.map(p => p.y));
  let hi = Math.max(...points.map(p => p.y));
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (polygonArea(belowSurface(points, mid)) > area) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
