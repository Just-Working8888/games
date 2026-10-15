import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buySku,
  getUser,
  submitScore,
  syncUser,
  takeGrants,
  type ClaimedGrant,
  type Profile,
} from '@games/shell';
import { Menu } from './screens/Menu';
import { Game, type GameResult } from './screens/Game';
import type { BuildLevel, Economy } from './hooks/useGame';
import { ShopModal, type ShopSku } from './components/ShopModal';
import { Toast } from './components/Toast';
import {
  loadProgress,
  loadSettings,
  saveProgress,
  saveSettings,
  type Progress,
  type Settings,
} from './state/progress';
import { generateWithPar, levelConfig, mulberry32, dailySeed } from './state/generator';
import {
  FREE_UNDOS,
  HINT_COST,
  SKUS,
  TUBE_COST,
  UNDO_COST,
  dailyReward,
  normalReward,
  vipMultiplier,
} from './state/economy';
import { setSoundEnabled } from './sfx';

type Screen = 'menu' | 'game' | 'daily';

const DAILY_COLORS = 7;
const TOAST_MS = 3200;
/** Тайлы Wordle-шеринга по звёздам дня: 0 (нет) → ⬜. */
const DAY_TILES = ['⬜', '🟧', '🟨', '🟩'];

function dateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function pretty(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}`;
}

interface AppToast {
  text: string;
  topUp?: boolean; // показать кнопку «Пополнить» (открывает магазин)
}

export function App() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>('menu');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [toast, setToast] = useState<AppToast | null>(null);
  const [progress, setProgress] = useState<Progress>({
    level: 1,
    best: 0,
    wins: 0,
    coins: 0,
    vip: false,
    stars: {},
    daily: { date: '', streak: 0, bestStars: 0, history: [] },
  });
  const [settings, setSettings] = useState<Settings>({ sound: true, symbols: false });

  const booted = useRef(false);
  const toastTimer = useRef<number>();
  const dailyDoneOnEntry = useRef(false); // ежедневка уже была засчитана на момент входа

  // «сегодня» — состояние: после полуночи пересчитываем (вход в ежедневку, возврат в приложение)
  const [today, setToday] = useState(() => new Date());
  const todayStr = useMemo(() => dateStr(today), [today]);
  const yesterdayStr = useMemo(() => {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return dateStr(y);
  }, [today]);
  const dailyTitle = useMemo(() => `Ежедневный · ${pretty(today)}`, [today]);

  /** Актуализирует «сегодня» (ссылка меняется только при смене даты). Возвращает текущий момент. */
  const refreshToday = useCallback(() => {
    const now = new Date();
    setToday((d) => (dateStr(d) === dateStr(now) ? d : now));
    return now;
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) refreshToday();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refreshToday]);

  /** Чистый апдейтер прогресса — сохранение делает эффект ниже (не из апдейтера). */
  const patchProgress = setProgress;

  // Сохранение прогресса: очередь-цепочка, чтобы параллельные записи не обгоняли друг друга
  const loaded = useRef(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (!loaded.current) return;
    const snapshot = progress;
    saveQueue.current = saveQueue.current.then(() => saveProgress(snapshot)).catch(() => {});
  }, [progress]);

  const showToast = useCallback((text: string, topUp = false) => {
    setToast({ text, topUp });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), topUp ? TOAST_MS + 1200 : TOAST_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  // ── гранты (покупки, реф-бонусы) ─────────────────────────────────────────
  const applyGrants = useCallback(
    (grants: ClaimedGrant[]) => {
      let refCoins = 0;
      let buyCoins = 0;
      let gotVip = false;
      for (const g of grants) {
        if (g.grant.type === 'coins') {
          if (g.sku === 'referral.bonus') refCoins += g.grant.amount;
          else buyCoins += g.grant.amount;
        } else if (g.grant.type === 'vip') {
          gotVip = true;
        }
      }
      const coins = refCoins + buyCoins;
      if (coins || gotVip) {
        patchProgress((p) => ({ ...p, coins: p.coins + coins, vip: p.vip || gotVip }));
      }
      const msgs: string[] = [];
      if (refCoins) msgs.push(`🎁 +${refCoins} монет за друга!`);
      if (buyCoins) msgs.push(`🎁 +${buyCoins} монет`);
      if (gotVip) msgs.push('👑 VIP: монеты ×2 навсегда');
      if (msgs.length) showToast(msgs.join(' · '));
    },
    [patchProgress, showToast],
  );

  // ── старт: локальный прогресс → sync с бэкендом → инбокс наград ──────────
  useEffect(() => {
    if (booted.current) return; // StrictMode: не дублируем sync/claim
    booted.current = true;
    void (async () => {
      const [p, s] = await Promise.all([loadProgress(), loadSettings()]);
      loaded.current = true; // с этого момента изменения прогресса пишутся в хранилище
      setProgress(p);
      setSettings(s);
      setSoundEnabled(s.sound);
      setReady(true);

      const prof = await syncUser();
      if (prof) {
        setProfile(prof);
        if (prof.vip) patchProgress((pp) => (pp.vip ? pp : { ...pp, vip: true }));
      }
      applyGrants(await takeGrants('water-sort'));
    })();
  }, [applyGrants, patchProgress]);

  // ── экономика ────────────────────────────────────────────────────────────
  const onSpend = useCallback(
    (n: number) => patchProgress((p) => ({ ...p, coins: Math.max(0, p.coins - n) })),
    [patchProgress],
  );

  const economy: Economy = {
    balance: progress.coins,
    hintCost: HINT_COST,
    tubeCost: TUBE_COST,
    undoCost: UNDO_COST,
    freeUndos: FREE_UNDOS,
    onSpend,
    onShortage: (msg) => showToast(msg, true),
    onOpenShop: () => setShopOpen(true),
  };

  // ── покупки за ⭐ Stars ───────────────────────────────────────────────────
  const onBuy = useCallback(
    async (sku: ShopSku) => {
      const status = await buySku(sku);
      switch (status) {
        case 'paid':
          applyGrants(await takeGrants('water-sort'));
          break;
        case 'pending':
          showToast('Платёж обрабатывается — награда придёт автоматически');
          break;
        case 'unavailable':
          if (import.meta.env.DEV) {
            // локальная разработка без Телеги: выдаём бесплатно, чтобы проверять игру
            if (sku === SKUS.vip.id) patchProgress((p) => ({ ...p, vip: true }));
            else if (sku === SKUS.pouch.id)
              patchProgress((p) => ({ ...p, coins: p.coins + SKUS.pouch.coins }));
            else patchProgress((p) => ({ ...p, coins: p.coins + SKUS.chest.coins }));
            showToast('dev-режим: выдано бесплатно');
          } else {
            showToast('Покупки доступны в Telegram');
          }
          break;
        case 'unsupported':
          showToast('Обнови Telegram, чтобы покупать');
          break;
        case 'failed':
          showToast('Не получилось — попробуй ещё раз');
          break;
        // 'cancelled' — молча
      }
    },
    [applyGrants, patchProgress, showToast],
  );

  // ── сборка уровней ────────────────────────────────────────────────────────
  const normalBuild: BuildLevel = useCallback((level) => {
    const { colors, empties } = levelConfig(level);
    return generateWithPar(colors, empties);
  }, []);

  const dailyBuild: BuildLevel = useCallback(
    () => generateWithPar(DAILY_COLORS, 2, mulberry32(dailySeed(today))),
    [today],
  );

  // ── победы ────────────────────────────────────────────────────────────────
  const rewardNormal = useCallback(
    (stars: number) => normalReward(stars) * vipMultiplier(progress.vip),
    [progress.vip],
  );
  const rewardDaily = useCallback(
    (stars: number) => dailyReward(stars) * vipMultiplier(progress.vip),
    [progress.vip],
  );

  const onSolvedNormal = useCallback(
    (r: GameResult) => {
      const isNewBest = r.level > progress.best;
      patchProgress((p) => ({
        ...p,
        level: Math.max(p.level, r.level + 1),
        best: Math.max(p.best, r.level),
        wins: p.wins + 1,
        coins: p.coins + normalReward(r.stars) * vipMultiplier(p.vip),
        stars: { ...p.stars, [r.level]: Math.max(p.stars[r.level] || 0, r.stars) },
      }));
      if (isNewBest) void submitScore('water-sort', r.level); // сервер разошлёт пуши друзьям
    },
    [patchProgress, progress.best],
  );

  const onSolvedDaily = useCallback(
    (r: GameResult) => {
      patchProgress((p) => {
        if (p.daily.date === todayStr) return p; // уже засчитан сегодня
        const streak = p.daily.date === yesterdayStr ? p.daily.streak + 1 : 1;
        const history = [...p.daily.history, { date: todayStr, stars: r.stars }].slice(-7);
        return {
          ...p,
          coins: p.coins + dailyReward(r.stars) * vipMultiplier(p.vip),
          daily: {
            date: todayStr,
            streak,
            bestStars: Math.max(p.daily.bestStars, r.stars),
            history,
          },
        };
      });
    },
    [patchProgress, todayStr, yesterdayStr],
  );

  // ── шеринг ────────────────────────────────────────────────────────────────
  const userId = profile?.id ?? getUser()?.id ?? 0;

  /** Спойлер-фри Wordle-результат ежедневки: звёзды, стрик, тайлы последних дней. */
  const dailyShareText = useCallback(
    (r: GameResult) => {
      const streak = progress.daily.date === todayStr ? progress.daily.streak : 1;
      // тайлы по реальным последним 5 датам (⬜ — пропущенный день)
      const byDate = new Map(progress.daily.history.map((d) => [d.date, d.stars]));
      if (!byDate.has(todayStr)) byDate.set(todayStr, r.stars); // сегодняшний результат ещё мог не попасть в history
      const tiles = Array.from({ length: 5 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (4 - i));
        const stars = byDate.get(dateStr(d)) ?? 0;
        return DAY_TILES[Math.min(3, Math.max(0, stars))];
      }).join('');
      return [
        `💧 Сортировка · ежедневка ${pretty(today)}`,
        `${'⭐'.repeat(r.stars)} за ${r.moves} ходов`,
        `🔥 стрик ${streak}`,
        tiles,
      ].join('\n');
    },
    [progress.daily, todayStr, today],
  );

  const onToggle = useCallback((key: keyof Settings) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (key === 'sound') setSoundEnabled(next.sound);
      void saveSettings(next);
      return next;
    });
  }, []);

  if (!ready) return null;

  let content;
  if (screen === 'game') {
    content = (
      <Game
        initialLevel={progress.level}
        key="normal"
        build={normalBuild}
        showSymbols={settings.symbols}
        economy={economy}
        headerLabel={(lvl) => `Уровень ${lvl}`}
        allowNext
        computeReward={rewardNormal}
        onSolved={onSolvedNormal}
        onBack={() => setScreen('menu')}
        shareText={(r) =>
          `🧪 Сортировка — уровень ${r.level} на ${'★'.repeat(r.stars)} за ${r.moves} ходов. Обгонишь?`
        }
        shareParam={`ref_${userId}`}
        onCalendar={() => {
          // тот же вход в ежедневку, что и из меню (пересчёт даты + признак повтора)
          const now = refreshToday();
          dailyDoneOnEntry.current = progress.daily.date === dateStr(now);
          setScreen('daily');
        }}
      />
    );
  } else if (screen === 'daily') {
    content = (
      <Game
        initialLevel={1}
        key={`daily-${todayStr}`}
        build={dailyBuild}
        showSymbols={settings.symbols}
        economy={economy}
        headerLabel={() => dailyTitle}
        allowNext={false}
        computeReward={rewardDaily}
        onSolved={onSolvedDaily}
        onBack={() => setScreen('menu')}
        shareText={dailyShareText}
        shareParam={`ref_${userId}`}
        rewardClaimed={dailyDoneOnEntry.current}
        showFriends={false}
      />
    );
  } else {
    content = (
      <Menu
        progress={progress}
        settings={settings}
        daily={{
          // стрик показываем, только если он «живой» (последняя ежедневка — сегодня или вчера)
          streak:
            progress.daily.date === todayStr || progress.daily.date === yesterdayStr
              ? progress.daily.streak
              : 0,
          doneToday: progress.daily.date === todayStr,
        }}
        onPlay={() => setScreen('game')}
        onDaily={() => {
          // пересчитываем «сегодня» на входе (сессия могла пережить полночь)
          const now = refreshToday();
          dailyDoneOnEntry.current = progress.daily.date === dateStr(now);
          setScreen('daily');
        }}
        onShop={() => setShopOpen(true)}
        onToggle={onToggle}
      />
    );
  }

  return (
    <>
      {content}
      <ShopModal
        open={shopOpen}
        balance={progress.coins}
        vip={progress.vip}
        userId={userId}
        onBuy={onBuy}
        onClose={() => setShopOpen(false)}
      />
      <Toast
        message={toast?.text ?? null}
        actionLabel={toast?.topUp ? 'Пополнить' : undefined}
        onAction={
          toast?.topUp
            ? () => {
                setToast(null);
                setShopOpen(true);
              }
            : undefined
        }
      />
    </>
  );
}
