import { TIERS } from '../game/tiers';

export function TierChip({ tier, size = 34 }: { tier: number; size?: number }) {
  const T = TIERS[tier];
  return (
    <img
      src={`/assets/planets/tier-${tier}.png`}
      alt={T.name}
      width={size}
      height={size}
      style={{ borderRadius: '50%', display: 'block', objectFit: 'cover' }}
    />
  );
}
