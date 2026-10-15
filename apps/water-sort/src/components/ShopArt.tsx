import coins from '../assets/shop-coins.webp';
import chest from '../assets/shop-chest.webp';
import vip from '../assets/shop-vip.webp';
import gift from '../assets/shop-gift.webp';

const art = { coins, chest, vip, gift };
export type ShopArtKind = keyof typeof art;

export function ShopArt({ kind, className = '' }: { kind: ShopArtKind; className?: string }) {
  return <img className={`shop-art ${className}`} src={art[kind]} alt="" aria-hidden="true" width="80" height="80" draggable={false} />;
}

/** Crisp currency marks for small labels; product illustrations use generated art. */
export function CurrencyIcon({ stars = false }: { stars?: boolean }) {
  return <svg className={`currency-icon ${stars ? 'currency-icon--star' : ''}`} viewBox="0 0 24 24" aria-hidden="true">
    {stars ? <path fill="currentColor" d="m12 2 3.05 6.18 6.82 1-4.94 4.81 1.17 6.8L12 17.58l-6.1 3.2 1.17-6.79L2.13 9.18l6.82-1Z" /> : <>
      <circle cx="12" cy="12" r="10" fill="#e7bb62" stroke="#ffdfa0" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="7.3" fill="none" stroke="#a57631" />
      <path d="M14.4 6.7a5.5 5.5 0 1 0 2.9 7.7 5 5 0 0 1-2.9-7.7Z" fill="#fff0b8" />
    </>}
  </svg>;
}
