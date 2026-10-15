import './background.css';

/** Generated chapter artwork with a darker veil behind the puzzle. */
export function Background({ world = 'moon', playing = false }: { world?: string; playing?: boolean }) {
  return (
    <div className={`bg bg--${world} ${playing ? 'bg--playing' : ''}`} aria-hidden>
      <div className="bg__art" />
      <div className="bg__veil" />
      <div className="bg__fireflies"><i /><i /><i /><i /><i /><i /></div>
    </div>
  );
}
