import { useCallback, useEffect, useRef, useState } from 'react';
import { haptic } from '@games/shell';
import {
  Board,
  canPour,
  cloneBoard,
  hasMoves,
  isSolved,
  isTubeComplete,
  pourAmount,
  pour,
  topColor,
} from '../state/engine';
import { findHint } from '../state/generator';
import { starsFor } from '../state/economy';
import { sfx } from '../sfx';

import { POUR_MS } from '../components/pourGeometry';
export const ANIM_MS = POUR_MS;
const HINT_SHOW_MS = 2400;
const TOAST_MS = 2400;

export interface Anim {
  from: number;
  to: number;
  count: number;
  color: number;
}
export interface Hint {
  from: number;
  to: number;
}

export interface Economy {
  balance: number;
  hintCost: number;
  tubeCost: number;
  undoCost: number; // цена отмены после исчерпания бесплатных
  freeUndos: number; // бесплатных отмен на уровень
  onSpend: (n: number) => void;
  /** Не хватает монет: App показывает тост с кнопкой «Пополнить». */
  onShortage: (msg: string) => void;
  /** Тап по балансу в хедере — открыть магазин. */
  onOpenShop: () => void;
}

/** Фабрика уровня: по номеру возвращает раскладку и «пар». */
export type BuildLevel = (level: number) => { board: Board; par: number };

export interface GameApi {
  level: number;
  board: Board;
  selected: number | null;
  anim: Anim | null;
  hint: Hint | null;
  moves: number;
  par: number;
  won: boolean;
  stars: number;
  stuck: boolean;
  canUndo: boolean;
  freeUndosLeft: number; // сколько бесплатных отмен осталось (0 — дальше платно)
  toast: string | null;
  select: (i: number) => void;
  undo: () => void;
  restart: () => void;
  useHint: () => void;
  addTube: () => void;
  nextLevel: () => void;
  clearToast: () => void;
}

export function useGame(initialLevel: number, build: BuildLevel, economy: Economy): GameApi {
  const [level, setLevel] = useState(initialLevel);
  const initial = useRef<{ board: Board; par: number } | null>(null);
  if (!initial.current) initial.current = build(initialLevel); // один раз

  const [board, setBoard] = useState<Board>(() => cloneBoard(initial.current!.board));
  const [par, setPar] = useState(() => initial.current!.par);
  const [history, setHistory] = useState<{ board: Board; moves: number }[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  const [moves, setMoves] = useState(0);
  const [undosUsed, setUndosUsed] = useState(0);
  const [won, setWon] = useState(false);
  const [stars, setStars] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const pourTimer = useRef<number>();
  const hintTimer = useRef<number>();
  const toastTimer = useRef<number>();

  useEffect(
    () => () => {
      window.clearTimeout(pourTimer.current);
      window.clearTimeout(hintTimer.current);
      window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const setupLevel = useCallback(
    (lvl: number) => {
      const built = build(lvl);
      initial.current = built;
      setLevel(lvl);
      setBoard(cloneBoard(built.board));
      setPar(built.par);
      setHistory([]);
      setSelected(null);
      setAnim(null);
      setHint(null);
      setMoves(0);
      setUndosUsed(0);
      setWon(false);
      setStars(0);
    },
    [build],
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  const doPour = useCallback(
    (from: number, to: number) => {
      const count = pourAmount(board, from, to);
      const color = topColor(board[from]);
      setHistory((h) => [...h, { board: cloneBoard(board), moves }]);
      setSelected(null);
      setHint(null);
      setAnim({ from, to, count, color });
      haptic.tap('medium');
      sfx.pour();

      pourTimer.current = window.setTimeout(() => {
        const next = pour(board, from, to);
        const finalMoves = moves + 1;
        setAnim(null);
        setBoard(next);
        setMoves(finalMoves);
        if (isSolved(next)) {
          setWon(true);
          setStars(starsFor(finalMoves, par));
          haptic.notify('success');
          sfx.win();
        } else if (isTubeComplete(next[to])) {
          haptic.notify('success');
          sfx.complete();
        }
      }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : ANIM_MS);
    },
    [board, moves, par],
  );

  const select = useCallback(
    (i: number) => {
      if (anim || won) return;
      if (selected === null) {
        if (board[i].length === 0) return;
        setSelected(i);
        setHint(null);
        haptic.select();
        sfx.select();
        return;
      }
      if (i === selected) {
        setSelected(null);
        return;
      }
      if (canPour(board, selected, i)) {
        doPour(selected, i);
      } else if (board[i].length > 0) {
        setSelected(i);
        haptic.select();
        sfx.select();
      } else {
        setSelected(null);
        haptic.notify('warning');
        sfx.error();
      }
    },
    [anim, won, selected, board, doPour],
  );

  const undo = useCallback(() => {
    if (anim || won || !history.length) return;
    // первые freeUndos отмен бесплатны, дальше — за монеты
    if (undosUsed >= economy.freeUndos) {
      if (economy.balance < economy.undoCost) {
        economy.onShortage(`Не хватает монет · отмена ${economy.undoCost}🪙`);
        haptic.notify('warning');
        return;
      }
      economy.onSpend(economy.undoCost);
    }
    setUndosUsed((u) => u + 1);
    setHistory((h) => {
      if (!h.length) return h;
      const last = h[h.length - 1];
      setBoard(last.board);
      setMoves(last.moves);
      setSelected(null);
      setHint(null);
      haptic.tap('light');
      return h.slice(0, -1);
    });
  }, [anim, won, history.length, undosUsed, economy]);

  const restart = useCallback(() => {
    if (anim) return;
    setBoard(cloneBoard(initial.current!.board));
    setHistory([]);
    setSelected(null);
    setHint(null);
    setMoves(0);
    // undosUsed НЕ сбрасываем: бесплатные отмены выдаются на уровень, а не на попытку
    setWon(false);
    setStars(0);
    haptic.tap('medium');
  }, [anim]);

  const useHint = useCallback(() => {
    if (anim || won) return;
    if (economy.balance < economy.hintCost) {
      economy.onShortage(`Не хватает монет · подсказка ${economy.hintCost}🪙`);
      haptic.notify('warning');
      return;
    }
    const h = findHint(board);
    if (!h) {
      showToast('Похоже, тупик — отмени ход или начни заново');
      haptic.notify('error');
      return;
    }
    economy.onSpend(economy.hintCost);
    setSelected(null);
    setHint({ from: h[0], to: h[1] });
    haptic.tap('light');
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setHint(null), HINT_SHOW_MS);
  }, [anim, won, board, economy, showToast]);

  const addTube = useCallback(() => {
    if (anim || won) return;
    if (economy.balance < economy.tubeCost) {
      economy.onShortage(`Не хватает монет · пробирка ${economy.tubeCost}🪙`);
      haptic.notify('warning');
      return;
    }
    economy.onSpend(economy.tubeCost);
    setBoard((b) => [...b, []]);
    haptic.tap('light');
    sfx.select();
  }, [anim, won, economy, showToast]);

  const nextLevel = useCallback(() => setupLevel(level + 1), [level, setupLevel]);

  const stuck = !won && !anim && !hasMoves(board);
  const canUndo = history.length > 0 && !anim && !won;
  const freeUndosLeft = Math.max(0, economy.freeUndos - undosUsed);

  return {
    level,
    board,
    selected,
    anim,
    hint,
    moves,
    par,
    won,
    stars,
    stuck,
    canUndo,
    freeUndosLeft,
    toast,
    select,
    undo,
    restart,
    useHint,
    addTube,
    nextLevel,
    clearToast: () => setToast(null),
  };
}
