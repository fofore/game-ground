import { useState } from 'react';
import type { RoomView } from '../../shared/protocol';
import { useCountdown } from '../net';
import { Ranking, ScoreStrip, TimeBar, useAction, usePlayers } from './common';

type Suit = 'green' | 'yellow' | 'purple' | 'black';
type Kind = 'num' | 'escape' | 'knight' | 'captain' | 'dancer' | 'tigress';
interface Card { id: number; kind: Kind; suit?: Suit; n?: number }
interface Played { by: string; card: Card; as?: 'knight' | 'escape' }
interface View {
  round: number; rounds: number; phase: 'bid' | 'play' | 'trickEnd' | 'roundEnd' | 'end'; deadline: number;
  hand: Card[]; playable: number[]; myTurn: boolean; turn: string | null; leader: string | null;
  myBid: number | null; bids: Record<string, number | null>; won: Record<string, number>;
  trick: Played[]; lastTrick: { cards: Played[]; winner: string; bonus: number } | null;
  led: Suit | null; scores: Record<string, number>;
  last: { round: number; bids: Record<string, number>; won: Record<string, number>; points: Record<string, number> } | null;
}

const SUIT_NAME: Record<Suit, string> = { green: '바람', yellow: '태양', purple: '달', black: '폭풍' };
const SPECIAL: Record<Exclude<Kind, 'num'>, { name: string; glyph: string }> = {
  escape: { name: '도망', glyph: 'M6 20V4l12 5-12 5' },
  knight: { name: '기사', glyph: 'M12 2l2 3v9h3v2h-4v4h-2v-4H7v-2h3V5z' },
  captain: { name: '선장', glyph: 'M3 8l4 4 5-7 5 7 4-4-2 11H5z' },
  dancer: { name: '무희', glyph: 'M3 14c3-4 6 4 9 0s6 4 9 0M3 19c3-4 6 4 9 0s6 4 9 0M12 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6z' },
  tigress: { name: '변신', glyph: 'M12 2l2 3v9h3v2h-4v4h-2v-4H7v-2h3V5zM18 4v8l5-2z' },
};

export function StormCard({ card, as, onClick, disabled, small }: { card: Card; as?: 'knight' | 'escape'; onClick?: () => void; disabled?: boolean; small?: boolean }) {
  const label = card.kind === 'num' ? `${SUIT_NAME[card.suit!]} ${card.n}` : SPECIAL[card.kind].name + (as ? `(${as === 'knight' ? '기사' : '도망'})` : '');
  const body = card.kind === 'num' ? (
    <><b>{card.n}</b><small>{SUIT_NAME[card.suit!]}</small></>
  ) : (
    <><svg viewBox="0 0 24 24" aria-hidden="true"><path d={SPECIAL[card.kind].glyph} /></svg><small>{label}</small></>
  );
  const cls = `scard ${card.kind === 'num' ? card.suit : card.kind} ${small ? 'small' : ''}`;
  return onClick
    ? <button className={cls} onClick={onClick} disabled={disabled} aria-label={label}>{body}</button>
    : <span className={cls} aria-label={label}>{body}</span>;
}

export function StormCaptainView({ room, onLeave }: { room: RoomView; onLeave: () => void }) {
  const v = room.game as View;
  const { name } = usePlayers(room);
  const { act, error } = useAction();
  const left = useCountdown(v.deadline);
  const [tigress, setTigress] = useState<Card | null>(null);

  if (v.phase === 'end') return <Ranking room={room} scores={v.scores} onLeave={onLeave} />;

  function playCard(c: Card) {
    if (c.kind === 'tigress') setTigress(c);
    else act({ type: 'play', card: c.id });
  }

  const shown = v.phase === 'trickEnd' && v.lastTrick ? v.lastTrick.cards : v.trick;
  const allBid = Object.values(v.bids).every((b) => b != null && b >= 0);

  return (
    <div className="sc">
      <div className="lu-top">
        <span className="round">{v.round} / {v.rounds} 라운드</span>
        <span className="timer">{v.phase === 'trickEnd' || v.phase === 'roundEnd' ? '' : `${Math.ceil(left)}초`}</span>
      </div>
      {(v.phase === 'bid' || v.phase === 'play') && <TimeBar left={left} total={30} />}

      <section className="sea" aria-live="polite">
        {v.phase === 'bid' ? (
          <p className="sea-msg">손패를 보고 이번 라운드에 몇 번 이길지 예측하세요</p>
        ) : v.phase === 'roundEnd' && v.last ? (
          <div className="round-points">
            <p className="sea-msg">{v.last.round}라운드 결과</p>
            <ul>
              {room.players.map((p) => (
                <li key={p.id}><span>{p.nickname}</span><span>예측 {v.last!.bids[p.id]} · 이김 {v.last!.won[p.id]}</span>
                  <b className={v.last!.points[p.id] >= 0 ? 'plus' : 'minus'}>{v.last!.points[p.id] > 0 ? '+' : ''}{v.last!.points[p.id]}</b></li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className="trick">
              {shown.map((p, i) => (
                <div key={i} className={`trick-card ${v.phase === 'trickEnd' && v.lastTrick?.winner === p.by ? 'win' : ''}`}>
                  <StormCard card={p.card} as={p.as} />
                  <span>{name(p.by)}</span>
                </div>
              ))}
              {shown.length === 0 && <p className="sea-msg">{name(v.turn)} 님이 먼저 내요</p>}
            </div>
            <p className="sea-msg">
              {v.phase === 'trickEnd' && v.lastTrick
                ? `${name(v.lastTrick.winner)} 님이 가져가요${v.lastTrick.bonus ? ` (보너스 ${v.lastTrick.bonus})` : ''}`
                : v.myTurn ? `내 차례!${v.led ? ` ${SUIT_NAME[v.led]} 색을 따라야 해요` : ''}` : `${name(v.turn)} 님 차례`}
            </p>
          </>
        )}
      </section>

      {v.phase === 'bid' && (
        v.myBid == null ? (
          <div className="bid-pad" role="group" aria-label="예측">
            {Array.from({ length: v.hand.length + 1 }, (_, n) => (
              <button key={n} className="num" onClick={() => act({ type: 'bid', bid: n })}>{n}</button>
            ))}
          </div>
        ) : <p className="center sm-wait">{v.myBid}번 이긴다고 예측했어요. 다른 사람을 기다리는 중…</p>
      )}

      <section className="my-hand">
        <h2 className="sub-h">내 손패</h2>
        <div className="shand">
          {v.hand.map((c) => (
            <StormCard key={c.id} card={c} onClick={v.myTurn && v.phase === 'play' ? () => playCard(c) : undefined}
              disabled={v.myTurn && !v.playable.includes(c.id)} />
          ))}
          {v.hand.length === 0 && <p className="muted">이번 라운드 카드를 다 냈어요.</p>}
        </div>
      </section>
      {error && <p className="error center" role="alert">{error}</p>}

      {tigress && (
        <div className="vote-box" role="dialog" aria-label="변신 카드">
          <p>변신 카드를 무엇으로 낼까요?</p>
          <div className="vote-actions">
            <button className="btn btn-primary" onClick={() => { act({ type: 'play', card: tigress.id, as: 'knight' }); setTigress(null); }}>기사로</button>
            <button className="btn btn-quiet" onClick={() => { act({ type: 'play', card: tigress.id, as: 'escape' }); setTigress(null); }}>도망으로</button>
          </div>
        </div>
      )}

      <ScoreStrip room={room} scores={v.scores} status={(id) => {
        const b = v.bids[id];
        const bidText = b == null ? '예측 중' : !allBid ? '예측 완료' : `${v.won[id] ?? 0} / ${b}`;
        return { text: bidText, done: allBid && b === v.won[id], hot: v.turn === id && v.phase === 'play' };
      }} />
      <p className="muted small center">오른쪽 숫자: 이긴 횟수 / 예측</p>
    </div>
  );
}
