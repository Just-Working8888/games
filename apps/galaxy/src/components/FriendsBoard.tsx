import { useEffect, useState } from 'react';
import { getFriendsBoard, type ScoreEntry } from '@games/shell';
import './friends.css';

export function FriendsBoard({ score }: { score: number }) {
  const [rows, setRows] = useState<ScoreEntry[] | null>(null);

  useEffect(() => {
    let alive = true;
    getFriendsBoard('galaxy', score).then((r) => alive && setRows(r));
    return () => {
      alive = false;
    };
  }, [score]);

  if (!rows) return null;

  return (
    <div className="friends">
      <div className="friends__title">Друзья</div>
      {rows.map((r, i) => (
        <div key={r.userId} className={`friends__row ${r.me ? 'friends__row--me' : ''}`}>
          <span className="friends__rank">{i + 1}</span>
          <span className="friends__name">{r.name}</span>
          <span className="friends__score">{r.score}</span>
        </div>
      ))}
    </div>
  );
}
