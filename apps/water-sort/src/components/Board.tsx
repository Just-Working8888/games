import { useLayoutEffect, useRef, useState } from 'react';
import { isTubeComplete } from '../state/engine';
import type { GameApi } from '../hooks/useGame';
import { Tube } from './Tube';
import { PourOverlay, type PourScene } from './PourOverlay';
import './board.css';


export function Board({ api, showSymbols }: { api: GameApi; showSymbols: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tubeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [fx, setFx] = useState<PourScene | null>(null);

  const { board, anim, selected, hint } = api;

  useLayoutEffect(() => {
    if (!anim || !containerRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setFx(null);
      return;
    }
    const src = tubeRefs.current[anim.from];
    const dst = tubeRefs.current[anim.to];
    if (!src || !dst) {
      setFx(null);
      return;
    }
    const base = containerRef.current.getBoundingClientRect();
    const sr = src.getBoundingClientRect();
    const dr = dst.getBoundingClientRect();
    // Measure layout, not the selected bottle's transient translateY animation.
    const sourceTop = src.parentElement!.getBoundingClientRect().top + src.offsetTop;
    setFx({
      from: anim.from,
      to: anim.to,
      x: sr.left + sr.width / 2 - base.left,
      y: sourceTop + sr.width / 10 - base.top,
      targetX: dr.left + dr.width / 2 - base.left,
      targetY: dr.top + dr.width / 10 - base.top,
      scale: sr.width / 60,
      targetScale: dr.width / 60,
      width: base.width,
      height: base.height,
      colors: board[anim.from],
      targetCount: board[anim.to].length,
      count: anim.count,
    });
  }, [anim, board]);

  return (
    <div className={`board ${board.length <= 6 ? 'board--small' : 'board--many'}`} ref={containerRef}>
      {board.map((colors, i) => (
        <Tube
          key={i}
          ref={(el) => (tubeRefs.current[i] = el)}
          colors={colors}
          selected={selected === i && !anim}
          showSymbols={showSymbols}
          hintFrom={hint?.from === i}
          hintTo={hint?.to === i}
          complete={isTubeComplete(colors)}
          leavingCount={anim && anim.from === i ? anim.count : 0}
          enteringColors={anim && anim.to === i ? Array(anim.count).fill(anim.color) : []}
          pouring={!!fx && fx.from === i}
          onClick={() => api.select(i)}
        />
      ))}

      {fx && <PourOverlay scene={fx} />}
    </div>
  );
}
