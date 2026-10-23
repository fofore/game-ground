// 게임 화면들이 같이 쓰는 부품
import { useState } from 'react';
import type { RoomView } from '../../shared/protocol';
import { call, socket } from '../net';
import { AVATAR_COLORS } from '../components/ui';

export function usePlayers(room: RoomView) {
  const name = (id: string | null | undefined) => room.players.find((p) => p.id === id)?.nickname ?? '?';
  const color = (id: string) => AVATAR_COLORS[Math.max(0, room.players.findIndex((p) => p.id === id)) % AVATAR_COLORS.length];
  const me = room.players.find((p) => p.id === room.you)!;
  return { name, color, me };
}

/** 행동 보내기 + 오류 표시 */
export function useAction() {
  const [error, setError] = useState('');
  async function act(action: Record<string, unknown>) {
    setError('');
    const r = await call('game:action', action);
    if (!r.ok) setError(r.error);
    return r.ok;
  }
  return { act, error };
}

export function Avatar({ room, id, size }: { room: RoomView; id: string; size?: 'sm' }) {
  const { name, color } = usePlayers(room);
  return <span className={`avatar ${size ?? ''}`} style={{ background: color(id) }}>{name(id).slice(0, 1)}</span>;
}

export function TimeBar({ left, total }: { left: number; total: number }) {
  return <div className="timebar"><span style={{ width: `${Math.min(100, (left / total) * 100)}%` }} /></div>;
}

/** 점수 순위 결과 화면 */
export function Ranking({ room, scores, headline, onLeave, unit = '점' }: {
  room: RoomView; scores: Record<string, number>; headline?: string; onLeave: () => void; unit?: string;
}) {
  const { me } = usePlayers(room);
  const ranking = [...room.players].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
  const top = scores[ranking[0].id] ?? 0;
  const winners = ranking.filter((p) => (scores[p.id] ?? 0) === top);
  return (
    <div className="result">
      <h2>{headline ?? `${winners.map((p) => p.nickname).join(', ')} 우승!`}</h2>
      <ol className="ranking">
        {ranking.map((p) => (
          <li key={p.id} className={(scores[p.id] ?? 0) === top ? 'winner' : ''}>
            <Avatar room={room} id={p.id} />
            <span className="seat-name">{p.nickname}{p.id === room.you ? ' (나)' : ''}</span>
            <b>{scores[p.id] ?? 0}{unit}</b>
          </li>
        ))}
      </ol>
      <EndActions isHost={me.isHost} onLeave={onLeave} />
    </div>
  );
}

export function EndActions({ isHost, onLeave, solo }: { isHost: boolean; onLeave: () => void; solo?: boolean }) {
  return (
    <>
      {isHost ? (
        <button className="btn btn-primary btn-block btn-big" onClick={() => socket.emit('room:lobby')}>{solo ? '한 번 더' : '대기실로 돌아가기'}</button>
      ) : (
        <p className="muted center">방장이 다음 판을 준비하고 있어요.</p>
      )}
      <button className="btn btn-text btn-block" onClick={onLeave}>나가기</button>
    </>
  );
}

/** 아래쪽 점수판 */
export function ScoreStrip({ room, scores, status, hideScore }: {
  room: RoomView; scores: Record<string, number>; status?: (id: string) => { text: string; done?: boolean; hot?: boolean } | null; hideScore?: boolean;
}) {
  return (
    <ul className="score-strip" aria-label="점수">
      {room.players.map((p) => {
        const st = status?.(p.id);
        return (
          <li key={p.id} className={`${st?.done ? 'done' : ''} ${st?.hot ? 'hot' : ''}`}>
            <Avatar room={room} id={p.id} size="sm" />
            <span className="seat-name">{p.nickname}{p.id === room.you ? ' (나)' : ''}</span>
            {hideScore ? <span /> : <b>{scores[p.id] ?? 0}</b>}
            {st && <span className="check">{st.text}</span>}
          </li>
        );
      })}
    </ul>
  );
}
