import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, setupBackButton, shareResult } from '@games/shell';
import { useGame, type BuildLevel, type Economy } from '../hooks/useGame';
import { Board } from '../components/Board';
import { Background } from '../components/Background';
import { Confetti } from '../components/Confetti';
import { FriendsBoard } from '../components/FriendsBoard';
import { StarRow } from '../components/StarRow';
import { Toast } from '../components/Toast';
import './game.css';
import { worldFor } from '../worlds';
import { isTubeComplete } from '../state/engine';
import { CurrencyIcon } from '../components/ShopArt';

export interface GameResult {
  level: number;
  moves: number;
  stars: number;
  par: number;
}

export function Game({
  initialLevel,
  build,
  showSymbols,
  economy,
  headerLabel,
  allowNext,
  computeReward,
  onSolved,
  onBack,
  shareText,
  shareParam,
  rewardClaimed = false,
  showFriends = true,
  onCalendar,
}: {
  initialLevel: number;
  build: BuildLevel;
  showSymbols: boolean;
  economy: Economy;
  headerLabel: (level: number) => string;
  allowNext: boolean;
  computeReward: (stars: number) => number;
  onSolved: (r: GameResult) => void;
  onBack: () => void;
  shareText: (r: GameResult) => string;
  shareParam?: string; // start_param для реф-ссылки в шеринге
  rewardClaimed?: boolean; // награда уже была (повтор ежедневки) — не обещаем монеты
  showFriends?: boolean; // лидерборд друзей на win-карточке (в daily неуместен)
  onCalendar?: () => void; // кнопка-календарь под шапкой (переход в ежедневку)
}) {
  const api = useGame(initialLevel, build, economy);
  const world = worldFor(api.level);
  const colorCount = new Set(api.board.flat()).size;
  const completedCount = api.board.filter(isTubeComplete).length;
  const solvedOnce = useRef(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  useEffect(() => setupBackButton(onBack), [onBack]);

  useEffect(() => {
    if (api.won && !solvedOnce.current) {
      solvedOnce.current = true;
      onSolved({ level: api.level, moves: api.moves, stars: api.stars, par: api.par });
    }
    if (!api.won) solvedOnce.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.won, api.level]);

  const share = () =>
    shareResult(
      shareText({ level: api.level, moves: api.moves, stars: api.stars, par: api.par }),
      shareParam,
    ).then(
      (mode) => {
        const msg =
          mode === 'clipboard'
            ? 'Результат скопирован в буфер'
            : mode === 'none'
              ? 'Не удалось поделиться'
              : null;
        if (msg) {
          setShareMsg(msg);
          window.setTimeout(() => setShareMsg(null), 2200);
        }
      },
    );

  return (
    <div className="game">
      <Background world={allowNext ? world.id : 'dawn'} playing />
      <header className="game__top">
        <button className="game__icon" onClick={onBack} aria-label="назад">
          ‹
        </button>
        <div className="game__meta">
          <div className="game__eyebrow">{allowNext ? world.name : 'Ритуал дня'}</div>
          <div className="game__level">{headerLabel(api.level)}</div>
          <div className="game__moves">
            {api.moves} ходов · ориентир {api.par}
          </div>
        </div>
        <button className="game__coins" onClick={economy.onOpenShop} aria-label="магазин">
          <CurrencyIcon /> {economy.balance}
          <span className="game__coins-plus">＋</span>
        </button>
      </header>
      <div className="game__progress" role="progressbar" aria-label="Собрано цветов" aria-valuenow={completedCount} aria-valuemin={0} aria-valuemax={colorCount}>
        {Array.from({ length: colorCount }, (_, i) => <i key={i} className={i < completedCount ? 'is-complete' : ''} />)}
      </div>

      {onCalendar && (
        <div className="game__row2">
          <button className="game__cal" onClick={onCalendar} aria-label="ежедневный челлендж">
            <CalendarIcon />
          </button>
        </div>
      )}

      <Board api={api} showSymbols={showSymbols} />
      <p className="game__instruction">{api.selected !== null ? 'Теперь выбери, куда перелить' : 'Собери каждый цвет в своей бутылке'}</p>

      {api.stuck && !api.won && (
        <div className="game__hintbar">Нет ходов — отмени или начни заново</div>
      )}

      <div className="game__controls">
        <ControlBtn
          label="Подсказка"
          icon={<BulbIcon />}
          onClick={api.useHint}
          badge={<>{economy.hintCost}<CurrencyIcon /></>}
        />
        <ControlBtn label="Заново" icon={<RestartIcon />} onClick={api.restart} />
        <ControlBtn
          label="Отмена"
          icon={<UndoIcon />}
          onClick={api.undo}
          disabled={!api.canUndo}
          badge={api.freeUndosLeft > 0 ? `${api.freeUndosLeft} бесплатно` : <>{economy.undoCost}<CurrencyIcon /></>}
        />
        <ControlBtn
          label="Пробирка"
          icon={<BottleIcon />}
          onClick={api.addTube}
          badge={<>{economy.tubeCost}<CurrencyIcon /></>}
        />
      </div>

      {api.won && (
        <div className="game__win">
          <Confetti />
          <div className="game__win-card">
            <div className="game__win-title">{headerLabel(api.level)} пройден!</div>
            <p className="game__win-message">Каждая капля на своём месте</p>
            <StarRow count={api.stars} />
            <div className="game__win-sub">
              {api.moves} ходов ·{' '}
              {rewardClaimed ? (
                <span>Уже пройдено сегодня ✓</span>
              ) : (
                <span className="game__reward">+{computeReward(api.stars)} <CurrencyIcon /></span>
              )}
            </div>
            {showFriends && <FriendsBoard score={api.level} />}
            <div className="game__win-actions">
              {allowNext ? (
                <>
                  <Button onClick={api.nextLevel}>Дальше →</Button>
                  <Button variant="ghost" onClick={share}>
                    Поделиться
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={share}>Поделиться</Button>
                  <Button variant="ghost" onClick={onBack}>
                    В меню
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <Toast message={api.toast ?? shareMsg} />
    </div>
  );
}

function ControlBtn({
  label,
  icon,
  onClick,
  disabled,
  badge,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  badge?: ReactNode;
}) {
  return (
    <button className="ctl" onClick={onClick} disabled={disabled} aria-label={label}>
      <span className="ctl__icon">{icon}</span>
      <span className="ctl__label">{label}</span>
      {badge !== undefined && <span className="ctl__badge">{badge}</span>}
    </button>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10.5h17" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" strokeWidth="2.6" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 3.5V8h-4.5" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  );
}

function BulbIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M9.5 18h5M10.5 21h3" />
      <path d="M12 3a6 6 0 0 0-3.9 10.55c.75.66 1.2 1.45 1.4 2.45h5c.2-1 .65-1.79 1.4-2.45A6 6 0 0 0 12 3Z" />
    </svg>
  );
}

function BottleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2.5h4M10.5 2.5v3.2c0 1.5-2.5 2-2.5 4.3v8c0 1.7 1 3 2.6 3h2.8c1.6 0 2.6-1.3 2.6-3v-8c0-2.3-2.5-2.8-2.5-4.3V2.5" />
      <path d="M18.5 6.5h3M20 5v3" strokeWidth="2.4" />
    </svg>
  );
}
