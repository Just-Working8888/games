import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, buySku, haptic, setupBackButton, shareResult, takeGrants } from '@games/shell';
import { GalaxyGame } from '../game/GalaxyGame';
import { TIERS } from '../game/tiers';
import { addReviveDebt } from '../state/progress';
import { Background } from '../components/Background';
import { Confetti } from '../components/Confetti';
import { FriendsBoard } from '../components/FriendsBoard';
import { TierChip } from '../components/TierChip';
import { sfx } from '../sfx';
import './game.css';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Game({
  best,
  revives,
  maxTier,
  onGameOver,
  onNewTier,
  onRevivesDelta,
  onBack,
}: {
  best: number;
  revives: number;
  maxTier: number;
  onGameOver: (score: number) => void;
  onNewTier: (tier: number) => void;
  onRevivesDelta: (delta: number) => void;
  onBack: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GalaxyGame | null>(null);
  const maxTierRef = useRef(maxTier);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [next, setNext] = useState(1);
  const [over, setOver] = useState(false);
  const [usedRevive, setUsedRevive] = useState(false); // максимум один revive за забег
  const [buying, setBuying] = useState(false);
  const [newTier, setNewTier] = useState<number | null>(null); // празднование открытия
  const [toast, setToast] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const toastTimer = useRef(0);
  const newTierTimer = useRef(0);

  useEffect(() => setupBackButton(onBack), [onBack]);
  useEffect(() => {
    maxTierRef.current = Math.max(maxTierRef.current, maxTier);
  }, [maxTier]);
  // сброс таймеров при размонтировании — иначе setState по мёртвому экрану
  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current);
      window.clearTimeout(newTierTimer.current);
    },
    [],
  );

  const showToast = useCallback((text: string) => {
    setToast(text);
    // старый таймер не должен прятать новый тост
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const gameWidth = wrap.clientWidth;
    const game = new GalaxyGame(canvas, gameWidth, wrap.clientHeight);
    gameRef.current = game;

    game.onScore = (s, c) => {
      setScore(s);
      setCombo(c);
    };
    game.onMerge = (t) => {
      sfx.merge(t);
      haptic.tap('light');
      // впервые достигнутый тир — празднуем
      if (t > maxTierRef.current) {
        maxTierRef.current = t;
        onNewTier(t);
        setNewTier(t);
        haptic.notify('success');
        // старый таймер не должен гасить баннер нового открытия
        window.clearTimeout(newTierTimer.current);
        newTierTimer.current = window.setTimeout(() => setNewTier(null), 2200);
      }
    };
    game.onDrop = () => sfx.drop();
    game.onPreview = (_cur, nx) => setNext(nx);
    game.onGameOver = (s) => {
      setOver(true);
      sfx.over();
      haptic.notify('error');
      onGameOver(s);
    };
    game.emitPreview();

    // переводим экранные координаты в игровые с учётом CSS-масштаба канваса
    const toX = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return (e.clientX - rect.left) * (gameWidth / rect.width);
    };
    // pointerdown обязателен: тап без движения тоже должен целиться в точку тапа
    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId); // палец уехал за канвас — move/up всё равно наши
      game.aim(toX(e));
    };
    const onMove = (e: PointerEvent) => game.aim(toX(e));
    const onUp = (e: PointerEvent) => {
      game.aim(toX(e));
      game.drop();
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      gameRef.current = null;
      game.destroy();
    };
  }, [nonce, onGameOver, onNewTier]);

  const restart = () => {
    setScore(0);
    setCombo(1);
    setOver(false);
    setUsedRevive(false);
    setNewTier(null);
    setNonce((n) => n + 1);
  };

  const share = () =>
    shareResult(`🌌 Галактика — собрал ${score} очков. Побьёшь?`).then((mode) => {
      if (mode === 'clipboard' || mode === 'none') {
        showToast(mode === 'clipboard' ? 'Результат скопирован' : 'Не удалось поделиться');
      }
    });

  /** Применить revive: очистить верх поля и продолжить (один раз за забег). */
  const applyRevive = () => {
    gameRef.current?.revive();
    setUsedRevive(true);
    setOver(false);
    haptic.notify('success');
  };

  const revive = async () => {
    if (buying || usedRevive) return;
    // есть запасённое возрождение — тратим его без покупки
    if (revives > 0) {
      onRevivesDelta(-1);
      applyRevive();
      return;
    }
    setBuying(true);
    const status = await buySku('galaxy.revive');
    if (status === 'paid') {
      // забираем грант; одно возрождение тратим сразу, излишек — в запас
      const grants = await takeGrants('galaxy');
      let gained = 0;
      for (const g of grants) {
        if (g.grant.type === 'consumable' && g.grant.item === 'revive') gained += g.grant.amount;
      }
      if (gained === 0) {
        // оплачено, но вебхук ещё не долетел — применяем авансом и пишем долг,
        // будущие гранты сначала погасят его (см. settleReviveDebt в App)
        void addReviveDebt(1);
      } else if (gained > 1) {
        onRevivesDelta(gained - 1);
      }
      applyRevive();
    } else if (status === 'unavailable') {
      // бэкенда/Телеги нет: бесплатная выдача — только в dev-сборке
      if (import.meta.env.DEV) {
        showToast('dev-режим: выдано бесплатно');
        applyRevive();
      } else {
        showToast('Покупки доступны в Telegram');
      }
    } else if (status === 'unsupported') {
      showToast('Обнови Telegram, чтобы покупать');
    } else if (status === 'pending') {
      showToast('Платёж обрабатывается — награда придёт автоматически');
    } else if (status === 'failed') {
      showToast('Не получилось — попробуй ещё раз');
    }
    // 'cancelled' — игрок сам закрыл окно, молчим
    setBuying(false);
  };

  const isNewBest = over && score > best;
  const shownBest = Math.max(best, score);

  return (
    <div className="gx">
      <Background />
      <header className="gx__top">
        <button className="gx__icon" onClick={onBack} aria-label="назад">
          ‹
        </button>
        <div className="gx__score">
          <div className="gx__score-val">
            {score}
            {combo > 1 && <span className="gx__combo">x{combo}</span>}
          </div>
          <div className="gx__best">рекорд {shownBest}</div>
        </div>
        <div className="gx__next">
          <span className="gx__next-label">next</span>
          <TierChip tier={next} />
        </div>
      </header>

      <div className="gx__field" ref={wrapRef}>
        <canvas ref={canvasRef} className="gx__canvas" />

        {newTier !== null && (
          <>
            <div className="gx__flash" key={`f${newTier}`} />
            <div className="gx__newtier" key={`t${newTier}`}>
              <TierChip tier={newTier} size={40} />
              <span>Новое тело: {cap(TIERS[newTier].name)}!</span>
            </div>
          </>
        )}

        {over && (
          <div className="gx__over">
            <Confetti />
            <div className="gx__over-card">
              {isNewBest && <div className="gx__record">🏆 Новый рекорд!</div>}
              <div className="gx__over-title">Коллапс!</div>
              <div className="gx__over-score">{score}</div>
              {!usedRevive && (
                <>
                  <button className="gx__revive" onClick={revive} disabled={buying}>
                    {buying ? 'Покупаем…' : revives > 0 ? '⭐ Продолжить' : 'Продолжить · 15⭐'}
                  </button>
                  {revives > 0 && <div className="gx__stock">у тебя {revives} в запасе</div>}
                </>
              )}
              <FriendsBoard score={score} />
              <div className="gx__over-actions">
                <Button variant="ghost" onClick={restart}>
                  Ещё раз
                </Button>
                <Button variant="ghost" onClick={share}>
                  Поделиться
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="gx__hint">Веди пальцем и отпусти. Одинаковые сливаются в следующее тело.</div>
      <div className={`gx__toast ${toast ? 'gx__toast--show' : ''}`}>{toast}</div>
    </div>
  );
}
