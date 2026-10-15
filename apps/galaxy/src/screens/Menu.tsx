import { useId } from 'react';
import { Button, getUser, haptic, isTelegram, referralLink, shareResult, type Profile } from '@games/shell';
import { Background } from '../components/Background';
import { TIERS } from '../game/tiers';
import type { Tier } from '../game/tiers';
import type { Settings } from '../state/progress';
import './menu.css';

export function Menu({
  best,
  maxTier,
  profile,
  settings,
  onPlay,
  onToggle,
  showToast,
}: {
  best: number;
  maxTier: number;
  profile: Profile | null;
  settings: Settings;
  onPlay: () => void;
  onToggle: (key: keyof Settings) => void;
  showToast: (text: string) => void;
}) {
  const invite = async () => {
    haptic.tap('light');
    const id = profile?.id ?? getUser()?.id ?? 0;
    const text = '🌌 Сливай планеты и собери свою галактику! Сыграем?';
    // вне Телеги кладём реф-ссылку прямо в текст (в Телеге её добавит share url)
    const mode = await shareResult(isTelegram ? text : `${text}\n${referralLink(id)}`, `ref_${id}`);
    if (mode === 'clipboard') showToast('Ссылка скопирована');
    else if (mode === 'none') showToast('Не удалось поделиться');
  };

  return (
    <div className="gxmenu">
      <Background />

      {/* верх: лёгкий чип рекорда, без карточек */}
      <header className="gxmenu__bar">
        <span className="gxmenu__chip">
          <TrophyIcon />
          рекорд {best}
        </span>
      </header>

      <div className="gxmenu__hero">
        <h1 className="gxmenu__title">Галактика</h1>
        <p className="gxmenu__tagline">Роняй тела — сливай до галактики</p>
      </div>

      {/* сцена-герой: небесные тела из игры парят вразнобой над орбитальной дугой */}
      <div className="gxmenu__scene" aria-hidden>
        <svg className="gxmenu__arc" viewBox="0 0 390 240" preserveAspectRatio="xMidYMid meet">
          <ellipse cx="195" cy="128" rx="185" ry="62" transform="rotate(-9 195 128)" />
        </svg>
        <SceneBody tier={5} size={116} className="gxmenu__body--giant" />
        <SceneBody tier={4} size={62} className="gxmenu__body--planet" />
        <SceneBody tier={8} size={44} className="gxmenu__body--neutron" />
        <SceneBody tier={2} size={28} className="gxmenu__body--comet" />
      </div>

      <Button className="gxmenu__play" onClick={onPlay}>
        Играть
      </Button>

      {/* коллекция-«созвездие»: 11 тел, соединённых тонкой линией звёздной карты */}
      <div className="gxmenu__coll">
        <span className="gxmenu__coll-label">
          Коллекция {maxTier + 1} / {TIERS.length}
        </span>
        <Constellation maxTier={maxTier} />
      </div>

      <button className="gxmenu__invite" onClick={invite}>
        <InviteIcon />
        Пригласить друга
      </button>

      {/* звук — круглая кнопка у правого края; селектор именно .gxmenu > .gxmenu__corner */}
      <div className="gxmenu__corner">
        <button
          className={`gxmenu__round ${settings.sound ? '' : 'gxmenu__round--off'}`}
          onClick={() => onToggle('sound')}
          aria-label={settings.sound ? 'выключить звук' : 'включить звук'}
        >
          <SoundIcon muted={!settings.sound} />
        </button>
      </div>
    </div>
  );
}

function SceneBody({ tier, size, className }: { tier: number; size: number; className: string }) {
  const T: Tier = TIERS[tier];
  return (
    <span className={`gxmenu__body ${className}`} style={{ width: size, height: size }}>
      <img
        src={`/assets/planets/tier-${tier}.png`}
        alt={T.name}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
    </span>
  );
}

/** Лента-созвездие: открытые тела — цветные точки со свечением, закрытые — тусклые. */
function Constellation({ maxTier }: { maxTier: number }) {
  const uid = useId();
  // зигзаг высот — как ломаная на звёздной карте
  const ys = [40, 18, 34, 12, 42, 24, 46, 16, 36, 22, 40];
  const pts = TIERS.map((_, i) => ({ x: 14 + i * 31.2, y: ys[i] }));
  return (
    <svg className="gxmenu__coll-map" viewBox="0 0 340 58" aria-hidden>
      <defs>
        {TIERS.map((t, i) =>
          i <= maxTier ? (
            <radialGradient key={t.name} id={`${uid}-g${i}`} cx="0.35" cy="0.3" r="0.8">
              <stop offset="0%" stopColor={t.c1} />
              <stop offset="100%" stopColor={t.c2} />
            </radialGradient>
          ) : null,
        )}
      </defs>
      <polyline className="gxmenu__coll-line" points={pts.map((p) => `${p.x},${p.y}`).join(' ')} />
      {TIERS.map((t, i) => {
        const p = pts[i];
        const r = 3.6 + i * 0.34; // тела растут вдоль ленты, как в игре
        return i <= maxTier ? (
          <g key={t.name}>
            <circle cx={p.x} cy={p.y} r={r * 2} fill={t.glow} opacity="0.2" />
            <circle cx={p.x} cy={p.y} r={r} fill={`url(#${uid}-g${i})`} />
          </g>
        ) : (
          <circle key={t.name} cx={p.x} cy={p.y} r="2.4" fill="rgba(226, 232, 255, 0.22)" />
        );
      })}
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4.5v1.5A3.5 3.5 0 0 0 8 11M17 6h2.5v1.5A3.5 3.5 0 0 1 16 11" />
      <path d="M12 14v3.5M8.5 20.5h7M10 20.5v-3h4v3" />
    </svg>
  );
}

function InviteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="8" r="3.6" />
      <path d="M3.8 20c.7-3.3 3.2-5 6.2-5s5.5 1.7 6.2 5" />
      <path d="M18.5 8v6M15.5 11h6" />
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
