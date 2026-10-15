import { useEffect, useRef } from 'react';
import { PALETTE } from '../theme';

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
}

/** Лёгкое конфетти на canvas, живёт ~2.6s. */
export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const w = (canvas.width = canvas.clientWidth * dpr);
    const h = (canvas.height = canvas.clientHeight * dpr);

    const parts: P[] = Array.from({ length: 120 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.4,
      y: h * 0.35 + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 14 * dpr,
      vy: (Math.random() * -10 - 4) * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      size: (5 + Math.random() * 6) * dpr,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    }));

    const gravity = 0.35 * dpr;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = now - start;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.vy += gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, 1 - t / 2600);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (t < 2600) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={ref}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}
