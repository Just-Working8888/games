import { useId } from 'react';
import { Button } from '@games/shell';
import { totalStars, type Progress, type Settings } from '../state/progress';
import { Background } from '../components/Background';
import { PALETTE } from '../theme';
import { worldFor } from '../worlds';
import { CurrencyIcon, ShopArt } from '../components/ShopArt';
import './menu.css';

export function Menu({
  progress,
  settings,
  daily,
  onPlay,
  onDaily,
  onShop,
  onToggle,
}: {
  progress: Progress;
  settings: Settings;
  daily: { streak: number; doneToday: boolean };
  onPlay: () => void;
  onDaily: () => void;
  onShop: () => void;
  onToggle: (key: keyof Settings) => void;
}) {
  const world = worldFor(progress.level);
  return (
    <div className="menu">
      <Background world={world.id} />

      <header className="menu__bar">
        <div className="menu__chips">
          <span className="menu__chip">ур. {progress.level}</span>
          <span className="menu__chip menu__chip--stars">★ {totalStars(progress)}</span>
        </div>
        <button className="menu__coins" onClick={onShop} aria-label="магазин">
          <CurrencyIcon /> {progress.coins}
          {progress.vip && <span className="menu__coins-vip">×2</span>}
          <span className="menu__coins-plus">＋</span>
        </button>
      </header>

      <div className="menu__hero">
        <span className="menu__eyebrow">M O O N W A T E R</span>
        <h1 className="menu__title">Магия<span>цвета</span></h1>
        <p className="menu__tagline">Найди гармонию. Капля за каплей.</p>
      </div>

      {/* сцена: бутылки стоят «на земле», в разнобой, одна наклонена */}
      <div className="menu__scene" aria-hidden>
        <span className="menu__bwrap menu__bwrap--1">
          <MiniBottle colors={[PALETTE[3], PALETTE[0], PALETTE[2], PALETTE[1]]} />
        </span>
        <span className="menu__bwrap menu__bwrap--2">
          <MiniBottle colors={[PALETTE[1], PALETTE[4], PALETTE[0], PALETTE[5]]} />
        </span>
        <span className="menu__bwrap menu__bwrap--3">
          <MiniBottle colors={[PALETTE[2], PALETTE[2], PALETTE[2], PALETTE[2]]} />
        </span>
        <span className="menu__bwrap menu__bwrap--4">
          <MiniBottle colors={[PALETTE[5], PALETTE[1], PALETTE[4], PALETTE[0]]} />
        </span>
      </div>

      <div className="menu__actions">
        <div className="journey">
          <div className="journey__head"><span>ГЛАВА {world.chapter.toString().padStart(2, '0')}</span><span>{world.step} / 10</span></div>
          <div className="journey__name">{world.name}<span>✧</span></div>
          <div className="journey__steps" aria-label={`Уровень ${world.step} из 10 в главе`}>
            {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < world.step ? 'is-active' : ''} />)}
          </div>
        </div>
        <Button className="menu__play" onClick={onPlay}>
          <span>Играть <small>Уровень {progress.level}</small></span><span aria-hidden>→</span>
        </Button>

        <div className="menu__tiles">
          <button className="menu__tile" onClick={onDaily}>
            <CalendarIcon day={new Date().getDate()} />
            <span className="menu__tile-copy"><span className="menu__tile-label">Ритуал дня</span><small>{daily.doneToday ? 'До встречи завтра' : 'Новая загадка каждый день'}</small></span>
            {daily.doneToday && <span className="menu__tile-done">✓</span>}
            {daily.streak > 0 && <span className="menu__tile-badge">🔥{daily.streak}</span>}
          </button>
          <button className="menu__tile" onClick={onShop}>
            <ShopArt kind="chest" className="menu__shop-art" />
            <span className="menu__tile-copy"><span className="menu__tile-label">Лавка чудес</span><small>Немного волшебства</small></span>
          </button>
        </div>
      </div>

      <div className="menu__corner">
        <span className="menu__footer-note">Без спешки. В своём ритме.</span>
        <button
          className={`menu__round ${settings.sound ? '' : 'menu__round--off'}`}
          onClick={() => onToggle('sound')}
          aria-pressed={settings.sound}
          aria-label={settings.sound ? 'выключить звук' : 'включить звук'}
        >
          <SoundIcon muted={!settings.sound} />
        </button>
        <button
          className={`menu__round ${settings.symbols ? '' : 'menu__round--off'}`}
          onClick={() => onToggle('symbols')}
          aria-pressed={settings.symbols}
          aria-label="символы для дальтоников"
        >
          <ShapesIcon />
        </button>
      </div>
    </div>
  );
}

/** Мини-бутылка героя — тот же контур «молочки», что и в игре, слои снизу вверх. */
function MiniBottle({ colors }: { colors: string[] }) {
  const clipId = useId();
  const top = 56;
  const bottom = 159;
  const band = (bottom - top) / 4;
  return (
    <svg className="menu__bottle" viewBox="0 0 60 168" aria-hidden>
      <defs>
        <clipPath id={clipId}>
          <rect x="9" y={top} width="42" height={bottom - top} rx="11" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {colors.map((c, i) => (
          <rect key={i} x="9" y={bottom - band * (i + 1)} width="42" height={band + 0.5} fill={c} />
        ))}
      </g>
      <path d="M 15 62 V 139" stroke="white" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" />
      <rect x="19" y="2" width="22" height="9" rx="4.5" className="menu__bottle-lip" />
      <path
        className="menu__bottle-body"
        d="M 23 11 V 26 C 23 36 7 41 7 56 V 145 Q 7 161 23 161 H 37 Q 53 161 53 145 V 56 C 53 41 37 36 37 26 V 11"
      />
    </svg>
  );
}

function CalendarIcon({ day }: { day: number }) {
  return (
    <svg className="menu__tile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4.5" width="18" height="17" rx="3.5" />
      <path d="M8 2.5v4M16 2.5v4M3 9.5h18" />
      <text
        x="12"
        y="18.6"
        textAnchor="middle"
        stroke="none"
        fill="currentColor"
        fontSize="8.5"
        fontWeight="800"
        fontFamily="inherit"
      >
        {day}
      </text>
    </svg>
  );
}

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
      {muted ? <path d="M16 9.5 21 14.5M21 9.5 16 14.5" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.2 6a9 9 0 0 1 0 12" />}
    </svg>
  );
}

function ShapesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 3.5 15.5 9.5h-7L12 3.5Z" />
      <circle cx="7.5" cy="16.5" r="3.4" />
      <rect x="13.5" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}
