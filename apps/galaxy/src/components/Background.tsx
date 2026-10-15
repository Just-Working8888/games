import './background.css';

/** Глубокий космос: почти чёрный индиго, статичное звёздное поле в три слоя
    (часть звёзд медленно мерцает), две туманности, виньетка и редкая
    падающая звезда. Всё — чистый CSS, без канваса. */
export function Background() {
  return (
    <div className="bg" aria-hidden>
      <span className="bg__nebula bg__nebula--violet" />
      <span className="bg__nebula bg__nebula--cyan" />
      <span className="bg__stars bg__stars--far" />
      <span className="bg__stars bg__stars--mid" />
      <span className="bg__stars bg__stars--near" />
      <span className="bg__shooting" />
    </div>
  );
}
