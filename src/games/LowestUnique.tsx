import { useState } from 'react';
import type { RoomView } from '../../shared/protocol';
import { call, socket, useCountdown } from '../net';
import { AVATAR_COLORS } from '../components/ui';

interface View {
  round: number;
  rounds: number;
  phase: 'pick' | 'reveal' | 'end';
  deadline: number;
  myPick: number | null;
  picked: Record<string, boolean>;
  scores: Record<string, number>;
  last: { round: number; picks: Record<string, number | null>; winner: string | null; winningNumber: number | null } | null;
}

export function LowestUniqueView({ room, solo, onLeave }: { room: RoomView; solo: boolean; onLeave: () => void }) {
  const v = room.game as View;
  const left = useCountdown(v.deadline);
  const [error, setError] = useState('');
  const name = (id: string) => room.players.find((p) => p.id === id)?.nickname ?? '?';
  const color = (id: string) => AVATAR_COLORS[Math.max(0, room.players.findIndex((p) => p.id === id)) % AVATAR_COLORS.length];
  const me = room.players.find((p) => p.id === room.you)!;

  async function pick(n: number) {
    setError('');
    const r = await call('game:action', { type: 'pick', number: n });
    if (!r.ok) setError(r.error);
  }

  if (v.phase === 'end') {
    const ranking = [...room.players].sort((a, b) => (v.scores[b.id] ?? 0) - (v.scores[a.id] ?? 0));
    const top = v.scores[ranking[0].id] ?? 0;
    return (
      <div className="result">
        <h2>{ranking.filter((p) => (v.scores[p.id] ?? 0) === top).map((p) => p.nickname).join(', ')} 우승!</h2>
        <ol className="ranking">
          {ranking.map((p) => (
            <li key={p.id} className={(v.scores[p.id] ?? 0) === top ? 'winner' : ''}>
              <span className="avatar" style={{ background: color(p.id) }}>{p.nickname.slice(0, 1)}</span>
              <span className="seat-name">{p.nickname}{p.id === room.you ? ' (나)' : ''}</span>
              <b>{v.scores[p.id] ?? 0}점</b>
            </li>
          ))}
        </ol>
        {me.isHost ? (
          <button className="btn btn-primary btn-block btn-big" onClick={() => socket.emit('room:lobby')}>{solo ? '한 번 더' : '대기실로 돌아가기'}</button>
        ) : (
          <p className="muted center">방장이 다음 판을 준비하고 있어요.</p>
        )}
        <button className="btn btn-text btn-block" onClick={onLeave}>나가기</button>
      </div>
    );
  }

  const reveal = v.phase === 'reveal' && v.last;
  const total = v.phase === 'pick' ? 10 : 4;

  return (
    <div className="lu">
      <div className="lu-top">
        <span className="round">{v.round} / {v.rounds} 라운드</span>
        <span className="timer" aria-live="off">{Math.ceil(left)}초</span>
      </div>
      <div className="timebar"><span style={{ width: `${(left / total) * 100}%` }} /></div>

      {reveal ? (
        <section className="lu-reveal" aria-live="polite">
          <h2>
            {v.last!.winner
              ? <>숫자 <em className="big-num">{v.last!.winningNumber}</em> 혼자 고른 {name(v.last!.winner)} 님 1점!</>
              : '모두 겹쳐서 아무도 점수를 못 받았어요'}
          </h2>
          <ul className="picks">
            {room.players.map((p) => {
              const n = v.last!.picks[p.id];
              return (
                <li key={p.id} className={p.id === v.last!.winner ? 'win' : ''}>
                  <span className="tile filled">{n ?? '–'}</span>
                  <span>{p.nickname}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <section className="lu-pick">
          <h2>{v.myPick ? `숫자 ${v.myPick} 선택 완료! 다른 사람을 기다리는 중…` : '겹치지 않을 가장 작은 숫자는?'}</h2>
          <div className="numpad" role="group" aria-label="숫자 고르기">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                className={`num ${v.myPick === n ? 'chosen' : ''}`}
                disabled={v.myPick != null}
                onClick={() => pick(n)}
              >{n}</button>
            ))}
          </div>
          {error && <p className="error" role="alert">{error}</p>}
        </section>
      )}

      <ul className="score-strip" aria-label="점수">
        {room.players.map((p) => (
          <li key={p.id} className={v.phase === 'pick' && v.picked[p.id] ? 'done' : ''}>
            <span className="avatar sm" style={{ background: color(p.id) }}>{p.nickname.slice(0, 1)}</span>
            <span className="seat-name">{p.nickname}</span>
            <b>{v.scores[p.id] ?? 0}</b>
            {v.phase === 'pick' && <span className="check">{v.picked[p.id] ? '골랐음' : '고민 중'}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
