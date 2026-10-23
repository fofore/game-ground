import { useEffect, useState } from 'react';
import type { RoomView } from '../../shared/protocol';
import { useCountdown } from '../net';
import { Avatar, Ranking, TimeBar, useAction, usePlayers } from './common';

type Kind = 'num' | 'spin' | 'eye' | 'copy';
interface MCard { id: number; kind: Kind; n: number; up?: boolean; peeked?: boolean }
interface View {
  round: number; phase: 'flip' | 'turn' | 'peek' | 'roundEnd' | 'end'; deadline: number; winsToWin: number;
  turn: string | null; myTurn: boolean;
  grids: Record<string, (MCard | null)[]>;
  discardTop: MCard | null; deckLeft: number;
  drawn: { card: MCard | null; from: 'deck' | 'discard' } | null;
  flipped: Record<string, boolean>;
  wins: Record<string, number>;
  lastRound: { scores: Record<string, number>; values: Record<string, number[]>; winners: string[]; closer: string } | null;
  log: string[];
}

const KIND_NAME: Record<Kind, string> = { num: '', spin: '빙글이', eye: '눈큰이', copy: '흉내쟁이' };
const NUM_COLOR = (n: number) => (n < 0 ? '#7FD1C7' : n <= 3 ? '#9BD35A' : n <= 6 ? '#FFC93C' : '#FF8FB1');

/** 몬스터 카드 한 장 */
export function MonsterCard({ card, onClick, small, highlight, label }: { card: MCard | null; onClick?: () => void; small?: boolean; highlight?: boolean; label?: string }) {
  const cls = `mcard ${small ? 'small' : ''} ${highlight ? 'hl' : ''} ${card ? card.kind : 'back'} ${card?.peeked ? 'peeked' : ''}`;
  const content = !card ? (
    <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="14" cy="18" r="5" fill="#fff" /><circle cx="26" cy="18" r="5" fill="#fff" /><circle cx="15" cy="19" r="2.2" fill="#1D2142" /><circle cx="27" cy="19" r="2.2" fill="#1D2142" /></svg>
  ) : card.kind === 'num' ? (
    <b>{card.n}</b>
  ) : (
    <><b>{card.kind === 'copy' ? '?' : 10}</b><small>{KIND_NAME[card.kind]}</small></>
  );
  const style = card?.kind === 'num' ? { background: NUM_COLOR(card.n) } : undefined;
  const aria = label ?? (card ? (card.kind === 'num' ? `${card.n}` : KIND_NAME[card.kind]) : '숨은 카드');
  return onClick
    ? <button className={cls} style={style} onClick={onClick} aria-label={aria}>{content}</button>
    : <span className={cls} style={style} aria-label={aria}>{content}</span>;
}

export function MonsterHouseView({ room, onLeave }: { room: RoomView; onLeave: () => void }) {
  const v = room.game as View;
  const { name } = usePlayers(room);
  const { act, error } = useAction();
  const left = useCountdown(v.deadline);
  const [mode, setMode] = useState<'place' | 'discard'>('place');
  const mine = v.grids[room.you] ?? [];
  const others = room.players.filter((p) => p.id !== room.you);

  useEffect(() => { setMode('place'); }, [v.drawn?.from, v.turn]);

  if (v.phase === 'end') {
    return <Ranking room={room} scores={v.wins} unit="승" headline={`${room.players.filter((p) => v.wins[p.id] >= v.winsToWin).map((p) => p.nickname).join(', ')} 우승!`} onLeave={onLeave} />;
  }

  const drawn = v.myTurn ? v.drawn : null;
  function tapSlot(i: number) {
    const c = mine[i];
    if (v.phase === 'flip' && !v.flipped[room.you]) return act({ type: 'flip', pos: i });
    if (v.phase === 'peek' && v.myTurn && !c?.up) return act({ type: 'peek', pos: i });
    if (v.phase === 'turn' && drawn) {
      if (mode === 'discard') { if (!c?.up) act({ type: 'discard', pos: i }); return; }
      act({ type: 'place', pos: i });
    }
  }

  const hint = v.phase === 'flip' ? (v.flipped[room.you] ? '다른 사람이 뒤집기를 기다리는 중…' : '내 카드 한 장을 골라 뒤집으세요')
    : v.phase === 'peek' ? (v.myTurn ? '눈큰이 효과! 몰래 볼 숨은 카드를 고르세요' : `${name(v.turn)} 님이 카드를 몰래 보는 중`)
    : v.phase === 'roundEnd' ? '' : !v.myTurn ? `${name(v.turn)} 님 차례`
    : !drawn ? '새 카드를 뽑거나 버린 카드를 가져오세요'
    : mode === 'discard' ? '버리는 대신 뒤집을 숨은 카드를 고르세요'
    : drawn.card?.kind === 'spin' ? '빙글이는 꼭 놓아야 해요. 바꿀 자리를 고르세요'
    : drawn.from === 'discard' ? '가져온 카드는 꼭 바꿔야 해요. 바꿀 자리를 고르세요' : '바꿀 자리를 고르거나, 버리세요';

  return (
    <div className="mh">
      <div className="lu-top">
        <span className="round">{v.round}라운드 · 먼저 {v.winsToWin}승</span>
        <span className="timer">{v.phase === 'roundEnd' ? '' : `${Math.ceil(left)}초`}</span>
      </div>
      {v.phase !== 'roundEnd' && <TimeBar left={left} total={v.phase === 'flip' ? 25 : v.phase === 'peek' ? 20 : 45} />}

      <ul className="others">
        {others.map((p) => (
          <li key={p.id} className={v.turn === p.id && v.phase === 'turn' ? 'now' : ''}>
            <span className="other-name"><Avatar room={room} id={p.id} size="sm" /> {p.nickname} <em>{'●'.repeat(v.wins[p.id] ?? 0)}</em>
              {v.lastRound && <b className="other-score">{v.lastRound.scores[p.id]}점</b>}</span>
            <div className="mgrid small">{(v.grids[p.id] ?? []).map((c, i) => <MonsterCard key={i} card={c} small />)}</div>
          </li>
        ))}
      </ul>

      <section className="table-mid">
        <div className="pile-box">
          <button className="mcard back deck" disabled={!v.myTurn || v.phase !== 'turn' || !!drawn} onClick={() => act({ type: 'draw', from: 'deck' })} aria-label="새 카드 뽑기">
            <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="14" cy="18" r="5" fill="#fff" /><circle cx="26" cy="18" r="5" fill="#fff" /><circle cx="15" cy="19" r="2.2" fill="#1D2142" /><circle cx="27" cy="19" r="2.2" fill="#1D2142" /></svg>
          </button>
          <span>새 카드 {v.deckLeft}</span>
        </div>
        <div className="pile-box">
          {v.discardTop
            ? <MonsterCard card={v.discardTop} onClick={v.myTurn && v.phase === 'turn' && !drawn ? () => act({ type: 'draw', from: 'discard' }) : undefined} label={`버린 카드 가져오기`} />
            : <span className="mcard empty" />}
          <span>버린 카드</span>
        </div>
        {v.drawn && (
          <div className="pile-box drawn">
            <MonsterCard card={v.drawn.card} highlight />
            <span>{v.myTurn ? '가져온 카드' : `${name(v.turn)} 님이 들고 있음`}</span>
          </div>
        )}
      </section>

      <p className="center hint" aria-live="polite">{hint}</p>
      {v.phase === 'roundEnd' && v.lastRound && (
        <p className="center round-win">
          {name(v.lastRound.closer)} 님이 모두 펼쳤어요! 이번 판 승리: <b>{v.lastRound.winners.map(name).join(', ')}</b>
        </p>
      )}

      <section className="my-house">
        <div className="mgrid">
          {mine.map((c, i) => <MonsterCard key={i} card={c} onClick={() => tapSlot(i)} label={c ? undefined : `${i + 1}번 방 숨은 카드`} />)}
        </div>
        <p className="muted small center">
          내 집 {'●'.repeat(v.wins[room.you] ?? 0)}{v.lastRound ? ` · 이번 판 ${v.lastRound.scores[room.you]}점` : ''} · 같은 세로줄 숫자가 같으면 0점
        </p>
      </section>

      {drawn && drawn.from === 'deck' && drawn.card?.kind !== 'spin' && (
        <button className={`btn btn-block ${mode === 'discard' ? 'btn-primary' : 'btn-quiet'}`} onClick={() => {
          if (mine.every((c) => c?.up)) act({ type: 'discard' });
          else setMode(mode === 'discard' ? 'place' : 'discard');
        }}>{mode === 'discard' ? '버리기 취소' : '이 카드 버리기'}</button>
      )}
      {error && <p className="error center" role="alert">{error}</p>}
      {v.log.length > 0 && <ul className="mh-log">{[...v.log].reverse().slice(0, 3).map((l, i) => <li key={i}>{l}</li>)}</ul>}
    </div>
  );
}
