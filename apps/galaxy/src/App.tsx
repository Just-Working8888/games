import { useCallback, useEffect, useRef, useState } from 'react';
import { getBest, setJSON, submitScore, syncUser, takeGrants, type Profile } from '@games/shell';
import { Menu } from './screens/Menu';
import { Game } from './screens/Game';
import {
  loadLegacyBest,
  loadMaxTier,
  loadRevives,
  loadSettings,
  saveMaxTier,
  saveRevives,
  saveSettings,
  settleReviveDebt,
  type Settings,
} from './state/progress';
import { setSoundEnabled } from './sfx';
import './app.css';

type Screen = 'menu' | 'game';

export function App() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>('menu');
  const [best, setBest] = useState(0);
  const [revives, setRevives] = useState(0);
  const [maxTier, setMaxTier] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<Settings>({ sound: true });
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  /** Изменить запас возрождений (+гранты / −трата) с сохранением. */
  const changeRevives = useCallback((delta: number) => {
    setRevives((prev) => {
      const next = Math.max(0, prev + delta);
      void saveRevives(next);
      return next;
    });
  }, []);

  useEffect(() => {
    (async () => {
      const [shellBest, legacyBest, s, r, mt] = await Promise.all([
        getBest('galaxy'),
        loadLegacyBest(),
        loadSettings(),
        loadRevives(),
        loadMaxTier(),
      ]);
      // единый источник рекорда — шелловский 'best:galaxy'; старый ключ мигрируем один раз
      const b = Math.max(shellBest, legacyBest);
      if (b > shellBest) void setJSON('best:galaxy', b);
      setBest(b);
      setSettings(s);
      setSoundEnabled(s.sound);
      setRevives(r);
      setMaxTier(mt);
      setReady(true);

      // бэкенд: профиль (рефералка) + отложенные награды; null = браузер, живём локально
      const p = await syncUser();
      if (p) setProfile(p);
      const grants = await takeGrants('galaxy');
      let gained = 0;
      for (const g of grants) {
        if (g.grant.type === 'consumable' && g.grant.item === 'revive') gained += g.grant.amount;
      }
      // сначала гасим долг авансовых revive (покупка применена до прихода гранта)
      const rest = await settleReviveDebt(gained);
      if (rest > 0) {
        changeRevives(rest);
        showToast(`⭐ Возрождений в запасе: +${rest}`);
      }
    })();
  }, [changeRevives, showToast]);

  // каждый game over (в т.ч. повторный после revive): рекорд + отправка на сервер
  const onGameOver = useCallback((score: number) => {
    void submitScore('galaxy', score); // сам сохраняет 'best:galaxy' и шлёт на бэкенд
    setBest((prev) => Math.max(prev, score));
  }, []);

  // новый максимальный тир — прогресс «Коллекции»
  const onNewTier = useCallback((tier: number) => {
    setMaxTier((prev) => {
      if (tier <= prev) return prev;
      void saveMaxTier(tier);
      return tier;
    });
  }, []);

  const onToggle = useCallback((key: keyof Settings) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (key === 'sound') setSoundEnabled(next.sound);
      void saveSettings(next);
      return next;
    });
  }, []);

  if (!ready) return null;

  return (
    <>
      {screen === 'game' ? (
        <Game
          best={best}
          revives={revives}
          maxTier={maxTier}
          onGameOver={onGameOver}
          onNewTier={onNewTier}
          onRevivesDelta={changeRevives}
          onBack={() => setScreen('menu')}
        />
      ) : (
        <Menu
          best={best}
          maxTier={maxTier}
          profile={profile}
          settings={settings}
          onPlay={() => setScreen('game')}
          onToggle={onToggle}
          showToast={showToast}
        />
      )}
      <div className={`app-toast ${toast ? 'app-toast--show' : ''}`}>{toast}</div>
    </>
  );
}
