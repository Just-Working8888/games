import { useEffect, useRef } from 'react';
import { PALETTE } from '../theme';
import { POUR_MS, POUR_TIMING, surfaceForArea, belowSurface, polygonArea, type Point } from './pourGeometry';

export interface PourScene {
  from: number;
  to: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  scale: number;
  targetScale: number;
  width: number;
  height: number;
  colors: number[];
  targetCount: number;
  count: number;
}

const vessel: Point[] = [
  { x: 23, y: 6 }, { x: 37, y: 6 }, { x: 37, y: 26 },
  { x: 44, y: 42 }, { x: 51, y: 56 }, { x: 51, y: 145 },
  { x: 48, y: 154 }, { x: 39, y: 159 }, { x: 21, y: 159 },
  { x: 12, y: 154 }, { x: 9, y: 145 }, { x: 9, y: 56 },
  { x: 16, y: 42 }, { x: 23, y: 26 },
];
const outline = 'M23 11V26C23 36 7 41 7 56V145Q7 161 23 161H37Q53 161 53 145V56C53 41 37 36 37 26V11';
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ease = (v: number) => v * v * (3 - 2 * v);

export function PourOverlay({ scene }: { scene: PourScene }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = (scene.width + 320) * dpr;
    canvas.height = (scene.height + 360) * dpr;
    ctx.scale(dpr, dpr);
    ctx.translate(160, 180);
    const shape = new Path2D(outline);
    let raf = 0;
    const started = performance.now();
    const direction = scene.targetX >= scene.width / 2 ? 1 : -1;
    const color = PALETTE[scene.colors[scene.colors.length - 1]];
    const draw = (now: number) => {
      const elapsed = now - started;
      const flow = clamp((elapsed - POUR_TIMING.approach) / POUR_TIMING.flow);
      const returning = clamp((elapsed - POUR_TIMING.approach - POUR_TIMING.flow) / POUR_TIMING.return);
      const travel = elapsed < POUR_TIMING.approach ? ease(clamp(elapsed / POUR_TIMING.approach)) : 1 - ease(returning);
      // Tilt just enough to keep the remaining liquid at the mouth as it empties.
      const remainingArea = (scene.colors.length - scene.count * flow) * 1050;
      let lowAngle = 0, highAngle = Math.PI;
      for (let i = 0; i < 14; i++) {
        const a = (lowAngle + highAngle) / 2;
        const rotated = vessel.map(p => ({ x: (p.x - 30) * Math.cos(a) - (p.y - 6) * Math.sin(a), y: (p.x - 30) * Math.sin(a) + (p.y - 6) * Math.cos(a) }));
        if (polygonArea(belowSurface(rotated, 0)) > remainingArea) lowAngle = a;
        else highAngle = a;
      }
      const angle = direction * Math.min(2.8, (lowAngle + highAngle) / 2) * travel;
      const mouthX = scene.x + (scene.targetX - scene.x) * travel;
      const mouthY = scene.y + (scene.targetY - 20 - scene.y) * travel - Math.sin(travel * Math.PI) * 32;
      const cos = Math.cos(angle), sin = Math.sin(angle), s = scene.scale;
      const world = (p: Point): Point => ({ x: mouthX + ((p.x - 30) * cos - (p.y - 6) * sin) * s, y: mouthY + ((p.x - 30) * sin + (p.y - 6) * cos) * s });
      const points = vessel.map(world);
      ctx.clearRect(-160, -180, scene.width + 320, scene.height + 360);
      ctx.save();
      ctx.beginPath();
      points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = '#defbef12';
      ctx.fill();
      ctx.clip();
      let area = 0;
      let bottom = Math.max(...points.map(p => p.y));
      const left = Math.min(...points.map(p => p.x)) - 2;
      const right = Math.max(...points.map(p => p.x)) + 2;
      for (let i = 0; i < scene.colors.length; i++) {
        const remaining = clamp(scene.colors.length - scene.count * flow - i);
        if (!remaining) continue;
        area += remaining * 1050 * s * s;
        const top = surfaceForArea(points, area);
        ctx.fillStyle = PALETTE[scene.colors[i]];
        ctx.fillRect(left, top, right - left, bottom - top + .5);
        ctx.fillStyle = '#ffffff24';
        ctx.fillRect(left, top, right - left, 1);
        bottom = top;
      }
      const shine = ctx.createLinearGradient(left, 0, right, 0);
      shine.addColorStop(0, '#ffffff05'); shine.addColorStop(.3, '#ffffff30'); shine.addColorStop(1, '#001b2820');
      ctx.fillStyle = shine; ctx.fillRect(left, -180, right - left, scene.height + 360);
      ctx.restore();
      ctx.save();
      ctx.translate(mouthX, mouthY); ctx.rotate(angle); ctx.scale(s, s); ctx.translate(-30, -6);
      ctx.strokeStyle = '#c3e4e1cc'; ctx.lineWidth = 1.5;
      ctx.stroke(shape);
      ctx.fillStyle = '#82b7b340'; ctx.beginPath(); ctx.roundRect(19, 2, 22, 9, 4.5); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(14, 64); ctx.lineTo(14, 136); ctx.stroke();
      ctx.restore();

      if (flow > 0 && flow < 1) {
        const strength = Math.min(1, flow * 14, (1 - flow) * 14);
        const surface = scene.targetY + (153 - (scene.targetCount + scene.count * flow) * 25.75) * scene.targetScale;
        const ripple = Math.sin(elapsed / 38) * 1.1;
        ctx.lineCap = 'round'; ctx.strokeStyle = color; ctx.lineWidth = 5 * s * strength;
        ctx.beginPath(); ctx.moveTo(mouthX, mouthY + 2);
        ctx.bezierCurveTo(mouthX + ripple, mouthY + 12, scene.targetX - ripple, scene.targetY + 8, scene.targetX, surface);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 1.3 * strength;
        ctx.beginPath(); ctx.moveTo(mouthX - 1, mouthY + 3); ctx.lineTo(scene.targetX - 1, surface); ctx.stroke();
        ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.globalAlpha = .8;
        ctx.beginPath(); ctx.ellipse(scene.targetX, surface, 8 + Math.sin(elapsed / 52) * 2, 2.4, 0, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const phase = ((elapsed / 240 + i / 4) % 1);
          ctx.globalAlpha = (1 - phase) * .8;
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(scene.targetX + (i % 2 ? 1 : -1) * phase * 10, surface - Math.sin(phase * Math.PI) * 10, 1.3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      if (elapsed < POUR_MS) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [scene]);
  return <canvas ref={ref} className="pour-overlay" aria-hidden style={{ width: scene.width + 320, height: scene.height + 360 }} />;
}
