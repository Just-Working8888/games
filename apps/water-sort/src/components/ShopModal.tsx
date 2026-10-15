import { useState } from 'react';
import { haptic, shareResult } from '@games/shell';
import { SKUS } from '../state/economy';
import './shop.css';
import { ShopArt, CurrencyIcon, type ShopArtKind } from './ShopArt';

export type ShopSku = (typeof SKUS)[keyof typeof SKUS]['id'];

/**
 * Магазин монет: паки за ⭐ Stars, VIP и реф-блок «пригласи друга».
 * Флоу покупки живёт в App (onBuy), модалка только рисует состояния.
 */
export function ShopModal({
  open,
  balance,
  vip,
  userId,
  onBuy,
  onClose,
}: {
  open: boolean;
  balance: number;
  vip: boolean;
  userId: number;
  onBuy: (sku: ShopSku) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<ShopSku | null>(null);

  if (!open) return null;

  const buy = (sku: ShopSku) => {
    if (busy) return;
    haptic.tap('light');
    setBusy(sku);
    void onBuy(sku).finally(() => setBusy(null));
  };

  const invite = () => {
    haptic.tap('light');
    void shareResult('Залипательная Сортировка — играем?', `ref_${userId}`);
  };

  return (
    <div className="shop" onClick={onClose}>
      <div className="shop__card" role="dialog" aria-modal="true" aria-labelledby="shop-title" onClick={(e) => e.stopPropagation()}>
        <header className="shop__head">
          <h2 className="shop__title" id="shop-title">Лавка чудес</h2>
          <span className="shop__balance"><CurrencyIcon /> {balance}</span>
          <button className="shop__close" onClick={onClose} aria-label="закрыть">
            ✕
          </button>
        </header>
        <p className="shop__intro">Маленькие сокровища для большой магии</p>

        <div className="shop__packs">
          <PackRow
            icon="coins"
            title={`${SKUS.pouch.coins} монет`}
            sub="Мешочек лунных монет"
            price={`${SKUS.pouch.stars}`}
            busy={busy === SKUS.pouch.id}
            disabled={busy !== null}
            onClick={() => buy(SKUS.pouch.id)}
          />
          <PackRow
            icon="chest"
            title={`${SKUS.chest.coins} монет`}
            sub="Сокровища лагуны"
            price={`${SKUS.chest.stars}`}
            tag="выгодно"
            busy={busy === SKUS.chest.id}
            disabled={busy !== null}
            onClick={() => buy(SKUS.chest.id)}
          />
          {vip ? (
            <div className="shop__row shop__row--owned">
              <ShopArt kind="vip" />
              <span className="shop__info">
                <span className="shop__name">VIP активен</span>
                <span className="shop__sub">×2 монеты навсегда</span>
              </span>
              <span className="shop__owned">✓</span>
            </div>
          ) : (
            <PackRow
              icon="vip"
              title="VIP"
              sub="×2 монеты навсегда"
              price={`${SKUS.vip.stars}`}
              busy={busy === SKUS.vip.id}
              disabled={busy !== null}
              onClick={() => buy(SKUS.vip.id)}
            />
          )}
        </div>

        <button className="shop__invite" onClick={invite}>
          <ShopArt kind="gift" />
          <span className="shop__info">
            <span className="shop__name">Пригласи друга</span>
            <span className="shop__sub">по 100 монет вам обоим</span>
          </span>
          <span className="shop__invite-cta">Позвать</span>
        </button>
      </div>
    </div>
  );
}

function PackRow({
  icon,
  title,
  sub,
  price,
  tag,
  busy,
  disabled,
  onClick,
}: {
  icon: ShopArtKind;
  title: string;
  sub: string;
  price: string;
  tag?: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`shop__row shop__row--${icon}`} onClick={onClick} disabled={disabled} aria-label={`${title}, ${sub}, ${price} Telegram Stars`}>
      <ShopArt kind={icon} />
      <span className="shop__info">
        <span className="shop__name">
          {title}
          {tag && <span className="shop__tag">{tag}</span>}
        </span>
        <span className="shop__sub">{sub}</span>
      </span>
      <span className={`shop__price ${busy ? 'shop__price--busy' : ''}`}>
        {busy ? '…' : <>{price}<CurrencyIcon stars /></>}
      </span>
    </button>
  );
}
