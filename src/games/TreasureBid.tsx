import type { RoomView } from '../../shared/protocol';
import { useCountdown } from '../net';
import { Ranking, ScoreStrip, TimeBar, useAction, usePlayers } from './common';

type Gem = 'ruby' | 'sapphire' | 'emerald';
interface Prize { value: number; gem: Gem | null }
interface View {
  round: number; rounds: number; phase: 'pick' | 'reveal' | 'end'; deadline: number;
  pot: Prize[]; myHand: number[]; myPick: number | null;
  picked: Record<string, boolean>;
  won: Record<string, Prize[]>;
  scores: Record<string, number>;
  last: { picks: Record<string, number>; pot: Prize[]; winner: string | null; carried: boolean } | null;
}

const GEM_NAME: Record<Gem, string> = { ruby: '루비', sapphire: '사파이어', emerald: '에메랄드' };
const GEM_COLOR: Record<Gem, string> = { ruby: '#FF5A7A', sapphire: '#3D6CF0', emerald: '#22A57A' };

export function PrizeCard({ p, small }: { p: Prize; small?: boolean }) {
  const trap = p.value < 0;
  return (
    <span className={`prize ${trap ? 'trap' : ''} ${small ? 'small' : ''}`} aria-label={trap ? `함정 ${p.value}` : `${GEM_NAME[p.gem!]} ${p.value}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {trap
          ? <path d="M12 3c-5 0-8 3-8 7 0 3 2 4 3 5v3h10v-3c1-1 3-2 3-5 0-4-3-7-8-7zM9 10a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM9 19h2v2H9zm4 0h2v2h-2z" fill="#1D2142" />
          : <path d="M6 4h12l4 6-10 11L2 10z" fill={GEM_COLOR[p.gem!]} stroke="#1D2142" strokeWidth="1.6" strokeLinejoin="round" />}
      </svg>
      <b>{p.value > 0 ? `+${p.value}` : p.value}</b>
    </span>
  );
}

export function TreasureBidView({ room, onLeave }: { room: RoomView; onLeave: () => void }) {
  const v = room.game as View;
  const { name } = usePlayers(room);
  const { act, error } = useAction();
  const left = useCountdown(v.deadline);
  const mine = v.won[room.you] ?? [];

  if (v.phase === 'end') return <Ranking room={room} scores={v.scores} onLeave={onLeave} />;

  const potSum = v.pot.reduce((a, p) => a + p.value, 0);
  const reveal = v.phase === 'reveal' && v.last;

  return (
    <div className="tb">
      <div className="lu-top">
        <span className="round">{v.round} / {v.rounds} 라운드</span>
        <span className="timer">{Math.ceil(left)}초</span>
      </div>
      <TimeBar left={left} total={v.phase === 'pick' ? 20 : 4.5} />

      <section className="pot" aria-live="polite">
        <div className="pot-cards">{(reveal ? v.last!.pot : v.pot).map((p, i) => <PrizeCard key={i} p={p} />)}</div>
        {reveal ? (
          <p className="pot-msg">
            {v.last!.winner ? `${name(v.last!.winner)} 님이 가져갔어요!` : '모두 겹쳤어요. 다음 라운드로 쌓여요.'}
          </p>
        ) : (
          <p className="pot-msg">{potSum >= 0 ? '보물이에요. 겹치지 않은 가장 큰 숫자가 가져가요.' : '함정이에요. 겹치지 않은 가장 작은 숫자가 떠안아요.'}</p>
        )}
      </section>

      {reveal ? (
        <ul className="picks">
          {room.players.map((p) => (
            <li key={p.id} className={p.id === v.last!.winner ? 'win' : ''}>
              <span className="tile filled">{v.last!.picks[p.id]}</span>
              <span>{p.nickname}</span>
            </li>
          ))}
        </ul>
      ) : (
        <section>
          <h2 className="sub-h">{v.myPick ? `${v.myPick} 제출 완료` : '낼 카드를 고르세요'}</h2>
          <div className="numpad fifteen" role="group" aria-label="내 카드">
            {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
              <button key={n} className={`num ${v.myPick === n ? 'chosen' : ''}`} disabled={!v.myHand.includes(n) || v.myPick != null}
                onClick={() => act({ type: 'pick', number: n })}>{n}</button>
            ))}
          </div>
        </section>
      )}
      {error && <p className="error center" role="alert">{error}</p>}

      <section className="my-loot">
        <h2 className="sub-h">내 보물</h2>
        {mine.length ? <div className="loot">{mine.map((p, i) => <PrizeCard key={i} p={p} small />)}</div> : <p className="muted">아직 없어요.</p>}
        <p className="muted small">루비·사파이어·에메랄드를 한 세트 모으면 +5점</p>
      </section>

      <ScoreStrip room={room} scores={v.scores} status={(id) => v.phase === 'pick' ? { text: v.picked[id] ? '냈음' : '고민 중', done: v.picked[id] } : null} />
    </div>
  );
}
