import { getJSON, setJSON } from '@games/shell';

const LEGACY_BEST_KEY = 'galaxy:best'; // старый ключ; актуальный — шелловский 'best:galaxy'
const SETTINGS_KEY = 'galaxy:settings';
const REVIVES_KEY = 'galaxy:revives';
const MAX_TIER_KEY = 'galaxy:maxTier';
const REVIVE_DEBT_KEY = 'galaxy:reviveDebt';

export interface Settings {
  sound: boolean;
}
const DEFAULT_SETTINGS: Settings = { sound: true };

// только для миграции старых сейвов — рекорд теперь читаем через shell getBest('galaxy')
export const loadLegacyBest = (): Promise<number> => getJSON<number>(LEGACY_BEST_KEY, 0);

export const loadSettings = (): Promise<Settings> => getJSON(SETTINGS_KEY, DEFAULT_SETTINGS);
export const saveSettings = (s: Settings): Promise<void> => setJSON(SETTINGS_KEY, s);

// запас неиспользованных возрождений (из грантов ⭐ Stars)
export const loadRevives = (): Promise<number> => getJSON<number>(REVIVES_KEY, 0);
export const saveRevives = (v: number): Promise<void> => setJSON(REVIVES_KEY, v);

// максимальный достигнутый тир за всё время (для «Коллекции»)
export const loadMaxTier = (): Promise<number> => getJSON<number>(MAX_TIER_KEY, 0);
export const saveMaxTier = (v: number): Promise<void> => setJSON(MAX_TIER_KEY, v);

// долг авансовых revive: покупка применена до прихода гранта (вебхук ещё в пути),
// пришедшие гранты сначала гасят долг и только остаток идёт в запас — иначе двойное начисление
export const addReviveDebt = async (n = 1): Promise<void> =>
  setJSON(REVIVE_DEBT_KEY, (await getJSON<number>(REVIVE_DEBT_KEY, 0)) + n);

/** Погасить долг пришедшими revive-грантами; возвращает остаток для запаса. */
export async function settleReviveDebt(gained: number): Promise<number> {
  if (gained <= 0) return 0;
  const debt = await getJSON<number>(REVIVE_DEBT_KEY, 0);
  const pay = Math.min(debt, gained);
  if (pay > 0) await setJSON(REVIVE_DEBT_KEY, debt - pay);
  return gained - pay;
}
