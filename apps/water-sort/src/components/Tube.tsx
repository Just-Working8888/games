import { forwardRef, type CSSProperties } from 'react';
import { CAPACITY, topRunSize } from '../state/engine';
import { PALETTE, SYMBOLS } from '../theme';
import './tube.css';
import { POUR_TIMING } from './pourGeometry';

interface Cell {
  color: number;
  entering: boolean;
  leaving: boolean;
  lifted: boolean;
  surface: boolean;
  bottom: boolean;
}

export interface TubeProps {
  colors: number[]; // committed, снизу вверх
  selected: boolean;
  showSymbols: boolean;
  hintFrom: boolean;
  hintTo: boolean;
  complete: boolean;
  leavingCount?: number; // верхние N сливаются (источник)
  enteringColors?: number[]; // цвета, входящие сверху (приёмник)
  tilt?: 'left' | 'right' | null; // наклон-перелив (источник во время анимации)
  pouring?: boolean;
  onClick: () => void;
}

/** Бутылка-«молочка»: SVG-контур (горлышко, плечи, тело) + плоские слои жидкости. */
export const Tube = forwardRef<HTMLDivElement, TubeProps>(function Tube(
  {
    colors,
    selected,
    showSymbols,
    hintFrom,
    hintTo,
    complete,
    leavingCount = 0,
    enteringColors = [],
    tilt = null,
    pouring = false,
    onClick,
  },
  ref,
) {
  const combined = enteringColors.length ? [...colors, ...enteringColors] : colors;
  const runSize = selected ? topRunSize(colors) : 0;
  const topLevel = combined.length - 1;

  const cells: Cell[] = [];
  for (let level = 0; level < CAPACITY; level++) {
    const color = combined[level] ?? -1;
    const entering = color !== -1 && enteringColors.length > 0 && level >= colors.length;
    const leaving = color !== -1 && leavingCount > 0 && level >= colors.length - leavingCount;
    const lifted = color !== -1 && runSize > 0 && level >= colors.length - runSize;
    cells.push({
      color,
      entering,
      leaving,
      lifted,
      surface: color !== -1 && level === topLevel,
      bottom: color !== -1 && level === 0,
    });
  }

  const cls = [
    'tube',
    selected && 'tube--selected',
    complete && 'tube--complete',
    pouring && 'tube--pouring',
    hintFrom && 'tube--hint-from',
    hintTo && 'tube--hint-to',
    tilt === 'left' && 'tube--tilt-left',
    tilt === 'right' && 'tube--tilt-right',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={cls} onClick={onClick} aria-label="бутылка">
      <div className="tube__glass" ref={ref}>
        <svg className="tube__outline" viewBox="0 0 60 168" aria-hidden>
          {/* горлышко-ободок */}
          <rect className="tube__lip" x="19" y="2" width="22" height="9" rx="4.5" />
          {/* горло → плечи → тело со скруглённым дном */}
          <path
            className="tube__body"
            d="M 23 11 V 26 C 23 36 7 41 7 56 V 145 Q 7 161 23 161 H 37 Q 53 161 53 145 V 56 C 53 41 37 36 37 26 V 11"
          />
        </svg>
        {complete && <span className="tube__cap">✓</span>}
        <div className="tube__liquid">
          {cells
            .map((cell, level) => ({ cell, level }))
            .reverse()
            .map(({ cell, level }) => (
              <div
                key={level}
                className={[
                  'cell',
                  cell.color === -1 && 'cell--empty',
                  cell.surface && 'cell--surface',
                  cell.bottom && 'cell--bottom',
                  cell.entering && 'cell--entering',
                  cell.leaving && 'cell--leaving',
                  cell.lifted && 'cell--lifted',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={
                  cell.color === -1 ? undefined : ({
                    '--c': PALETTE[cell.color],
                    ...(cell.entering ? {
                      animationDelay: `${POUR_TIMING.approach + (level - colors.length) * POUR_TIMING.flow / enteringColors.length}ms`,
                      animationDuration: `${POUR_TIMING.flow / enteringColors.length}ms`,
                    } : {}),
                  } as CSSProperties)
                }
              >
                {showSymbols && cell.color !== -1 && (
                  <span className="cell__sym">{SYMBOLS[cell.color]}</span>
                )}
              </div>
            ))}
        </div>
      </div>
    </button>
  );
});
