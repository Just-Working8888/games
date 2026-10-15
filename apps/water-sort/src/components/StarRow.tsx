import './stars.css';

/** Ряд из трёх звёзд; заполненные до `count` появляются с задержкой. */
export function StarRow({ count, size = 44 }: { count: number; size?: number }) {
  return (
    <div className="stars" style={{ fontSize: size }}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`star ${n <= count ? 'star--on' : 'star--off'}`}
          style={{ animationDelay: `${n * 0.18}s` }}
        >
          ★
        </span>
      ))}
    </div>
  );
}
