import { useEffect, useState } from 'react';
import type { RoomView } from '../../shared/protocol';
import { serverNow } from '../net';
import { Ranking, ScoreStrip, useAction, usePlayers } from './common';

type Kind = 'win' | 'top3' | 'h2h';
interface Bet { by: string; chip: number; kind: Kind; runner: number; rival?: number; early: boolean; result?: 'won' | 'lost'; points?: number }
interface View {
  race: number; races: number; phase: 'ready' | 'run' | 'result' | 'end';
  startAt: number; raceMs: number; closeMs: number; earlyMs: number;
  pos: number[]; finished: number[];
  myBets: Bet[]; betCounts: Record<string, number>; allBets: Bet[];
  scores: Record<string, number>; order: number[] | null;
}

const RUNNER_COLORS = ['#FF5A7A', '#FFC93C', '#3D6CF0', '#22A57A', '#C3A6FF', '#FF7A59'];
const KIND_LABEL: Record<Kind, string> = { win: '우승', top3: '3위 안', h2h: '맞대결' };

function useNow() {
  const [now, setNow] = useState(serverNow());
  useEffect(() => { const t = setInterval(() => setNow(serverNow()), 250); return () => clearInterval(t); }, []);
  return now;
}

const describe = (b: Bet) => b.kind === 'h2h' ? `${b.runner + 1}번이 ${b.rival! + 1}번보다 앞` : `${b.runner + 1}번 ${KIND_LABEL[b.kind]}`;

export function RaceBetView({ room, onLeave }: { room: RoomView; onLeave: () => void }) {
  const v = room.game as View;
  const { name } = usePlayers(room);
  const { act, error } = useAction();
  const now = useNow();
  const [chip, setChip] = useState<number | null>(null);
  const [kind, setKind] = useState<Kind>('win');
  const [runner, setRunner] = useState<number | null>(null);
  const [rival, setRival] = useState<number | null>(null);

  useEffect(() => { setChip(null); setRunner(null); setRival(null); }, [v.race]);

  if (v.phase === 'end') return <Ranking room={room} scores={v.scores} onLeave={onLeave} />;

  const t = now - v.startAt;
  const closed = t > v.closeMs || v.phase === 'result';
  const early = t < v.earlyMs;
  const used = new Set(v.myBets.map((b) => b.chip));
  const odds = kind === 'win' ? (early ? 5 : 3) : early ? 2 : 1;
  const ready = chip != null && runner != null && (kind !== 'h2h' || (rival != null && rival !== runner));

  async function bet() {
    if (!ready) return;
    if (await act({ type: 'bet', chip, kind, runner, rival })) { setChip(null); setRunner(null); setRival(null); }
  }

  function pickRunner(i: number) {
    if (kind === 'h2h' && runner != null && runner !== i && rival == null) setRival(i);
    else { setRunner(i); setRival(null); }
  }

  const status = v.phase === 'ready'
    ? `출발까지 ${Math.max(0, Math.ceil(-t / 1000))}초`
    : v.phase === 'run'
      ? (closed ? `베팅 마감 · 결승까지 ${Math.max(0, Math.ceil((v.raceMs - t) / 1000))}초` : `${early ? '지금 걸면 높은 배당' : '배당 낮아짐'} · 마감까지 ${Math.ceil((v.closeMs - t) / 1000)}초`)
      : '경주 끝!';

  return (
    <div className="rb">
      <div className="lu-top">
        <span className="round">{v.race} / {v.races} 경기</span>
        <span className="timer small-t">{status}</span>
      </div>

      <section className="track" aria-label="경주">
        {v.pos.map((d, i) => {
          const place = v.order ? v.order.indexOf(i) : v.finished.indexOf(i);
          return (
            <div key={i} className={`lane ${runner === i || rival === i ? 'picked' : ''}`}>
              <button className="lane-no" style={{ background: RUNNER_COLORS[i] }} onClick={() => !closed && pickRunner(i)} aria-label={`${i + 1}번 선수 고르기`}>{i + 1}</button>
              <div className="lane-run">
                <span className="runner" style={{ left: `calc(${Math.min(d, 100)}% - ${Math.min(d, 100) * 0.3}px)`, background: RUNNER_COLORS[i] }}>
                  <i className="eye" />
                </span>
                <span className="goal" />
              </div>
              {place >= 0 && <span className="place">{place + 1}위</span>}
            </div>
          );
        })}
      </section>

      {v.phase === 'result' && v.order ? (
        <section className="race-result">
          <h2 className="sub-h">결과: {v.order.slice(0, 3).map((r) => `${r + 1}번`).join(', ')} 순</h2>
          <ul className="bet-list">
            {v.allBets.length === 0 && <li className="muted">아무도 걸지 않았어요.</li>}
            {v.allBets.map((b, i) => (
              <li key={i} className={b.result}>
                <span>{name(b.by)}</span><span>{describe(b)} · 칩 {b.chip}</span>
                <b>{b.points! > 0 ? `+${b.points}` : b.points}</b>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="bet-panel">
          <div className="seg-tabs" role="tablist">
            {(['win', 'top3', 'h2h'] as Kind[]).map((k) => (
              <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => { setKind(k); setRival(null); }}>{KIND_LABEL[k]}</button>
            ))}
          </div>
          <p className="muted small">
            {kind === 'h2h' ? '앞설 선수를 누르고, 이어서 상대 선수를 누르세요.' : '위 경주에서 번호를 눌러 선수를 고르세요.'} 지금 배당 {odds}배
          </p>
          <div className="chips-row" role="radiogroup" aria-label="칩">
            {[1, 2, 3, 4, 5].map((c) => (
              <button key={c} role="radio" aria-checked={chip === c} className={`bet-chip ${chip === c ? 'on' : ''}`} disabled={used.has(c) || closed} onClick={() => setChip(c)}>{c}</button>
            ))}
          </div>
          <button className="btn btn-primary btn-block" disabled={!ready || closed} onClick={bet}>
            {ready ? `${describe({ by: '', chip: chip!, kind, runner: runner!, rival: rival ?? undefined, early })}에 ${chip}칩 걸기` : closed ? '베팅 마감' : '칩과 선수를 고르세요'}
          </button>
          {v.myBets.length > 0 && (
            <ul className="bet-list mine">
              {v.myBets.map((b, i) => <li key={i}><span>{describe(b)}</span><span>칩 {b.chip} · {b.kind === 'win' ? (b.early ? 5 : 3) : b.early ? 2 : 1}배</span></li>)}
            </ul>
          )}
        </section>
      )}
      {error && <p className="error center" role="alert">{error}</p>}

      <ScoreStrip room={room} scores={v.scores} status={(id) => v.phase !== 'result' ? { text: `${v.betCounts[id] ?? 0}개 걸음` } : null} />
    </div>
  );
}
