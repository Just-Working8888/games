import type { CSSProperties } from 'react';
import './splash.css';

const DROPS = [
  [-22, -14], [-13, -22], [-4, -25], [6, -24], [15, -20], [23, -12], [-30, -6], [30, -4],
];

/** Брызги в точке падения струи. Ремоунтить по key при каждом переливании. */
export function Splash({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <div className="splash" style={{ left: x, top: y }}>
      {DROPS.map(([dx, dy], i) => (
        <span
          key={i}
          className="splash__drop"
          style={
            {
              background: color,
              '--dx': `${dx}px`,
              '--dy': `${dy}px`,
              animationDelay: `${0.16 + (i % 3) * 0.02}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
