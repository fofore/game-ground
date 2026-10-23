import type { RoomView } from '../../shared/protocol';
import { Avatar, EndActions, useAction, usePlayers } from './common';

interface View {
  level: number; levels: number; lives: number;
  phase: 'play' | 'clear' | 'won' | 'lost';
  myHand: number[];
  counts: Record<string, number>;
  top: { card: number; by: string } | null;
  played: number;
  lastMistake: { card: number; by: string; discarded: { card: number; by: string }[] } | null;
}

export function SecretNumberView({ room, onLeave }: { room: RoomView; onLeave: () => void }) {
  const v = room.game as View;
  const { name, me } = usePlayers(room);
  const { act, error } = useAction();

  if (v.phase === 'won' || v.phase === 'lost') {
    return (
      <div className="result">
        <h2>{v.phase === 'won' ? '작전 성공! 5단계를 모두 깼어요' : `${v.level}단계에서 작전 실패`}</h2>
        <p className="muted center">{v.phase === 'won' ? `남은 생명 ${v.lives}개로 끝냈어요.` : '생명을 모두 잃었어요. 다시 도전해 보세요.'}</p>
        <EndActions isHost={me.isHost} onLeave={onLeave} />
      </div>
    );
  }

  return (
    <div className="sn">
      <div className="lu-top">
        <span className="round">{v.level} / {v.levels} 단계</span>
        <span className="lives" aria-label={`생명 ${v.lives}개`}>
          {Array.from({ length: 3 }, (_, i) => <Heart key={i} on={i < v.lives} />)}
        </span>
      </div>

      <section className="pile" aria-live="polite">
        {v.phase === 'clear' ? (
          <p className="pile-msg">{v.level}단계 성공! 다음 단계에서는 {v.level + 1}장씩 받아요.</p>
        ) : v.top ? (
          <>
            <span className={`tile big ${v.lastMistake ? 'bad' : ''}`}>{v.top.card}</span>
            <p className="pile-msg">{name(v.top.by)} 님이 냈어요</p>
          </>
        ) : (
          <p className="pile-msg">말하지 말고, 때가 됐다고 느끼면 내세요.</p>
        )}
        {v.lastMistake && (
          <p className="mistake">
            앗! 더 작은 카드가 남아 있었어요. 생명 1개를 잃었어요.<br />
            버린 카드: {v.lastMistake.discarded.map((d) => `${d.card} (${name(d.by)})`).join(', ')}
          </p>
        )}
      </section>

      <ul className="hands" aria-label="남은 카드 수">
        {room.players.map((p) => (
          <li key={p.id}>
            <Avatar room={room} id={p.id} size="sm" />
            <span className="seat-name">{p.nickname}{p.id === room.you ? ' (나)' : ''}</span>
            <span className="backs">{Array.from({ length: v.counts[p.id] ?? 0 }, (_, i) => <i key={i} />)}</span>
          </li>
        ))}
      </ul>

      <section className="my-hand">
        <h2>내 카드</h2>
        {v.myHand.length ? (
          <>
            <div className="hand">{v.myHand.map((c, i) => <span key={c} className={`tile ${i === 0 ? 'filled next' : 'filled'}`}>{c}</span>)}</div>
            <button className="btn btn-primary btn-block btn-big" disabled={v.phase !== 'play'} onClick={() => act({ type: 'play' })}>
              {v.myHand[0]} 내기
            </button>
          </>
        ) : <p className="muted center">카드를 다 냈어요. 친구들을 믿고 기다려요.</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>
    </div>
  );
}

function Heart({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 22" className={`heart ${on ? '' : 'off'}`} aria-hidden="true">
      <path d="M12 21l-1.4-1.3C5.4 15 2 11.9 2 8.1 2 5 4.4 2.6 7.5 2.6c1.7 0 3.4.8 4.5 2.1 1.1-1.3 2.8-2.1 4.5-2.1C19.6 2.6 22 5 22 8.1c0 3.8-3.4 6.9-8.6 11.6z" />
    </svg>
  );
}
