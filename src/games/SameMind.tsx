import { useEffect, useState } from 'react';
import type { RoomView } from '../../shared/protocol';
import { useCountdown } from '../net';
import { Avatar, Ranking, ScoreStrip, TimeBar, useAction, usePlayers } from './common';

interface Group { key: string; label: string; ids: string[]; labels: string[] }
interface View {
  round: number; rounds: number;
  phase: 'topic' | 'answer' | 'review' | 'end';
  deadline: number;
  asker: string;
  topic: string;
  suggestions: string[];
  myAnswer: string;
  answered: Record<string, boolean>;
  groups: Group[];
  blank: string[];
  proposal: { by: string; from: string; into: string; votes: Record<string, boolean>; deadline: number; myVote?: boolean } | null;
  scores: Record<string, number>;
}

const TOTAL = { topic: 45, answer: 20, review: 40, end: 1 };

export function SameMindView({ room, onLeave }: { room: RoomView; onLeave: () => void }) {
  const v = room.game as View;
  const { name } = usePlayers(room);
  const { act, error } = useAction();
  const left = useCountdown(v.deadline);
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const isAsker = v.asker === room.you;

  useEffect(() => { setText(''); setSelected(null); }, [v.phase, v.round]);

  if (v.phase === 'end') return <Ranking room={room} scores={v.scores} onLeave={onLeave} />;

  const groupLabel = (key: string) => v.groups.find((g) => g.key === key)?.label ?? key;

  function tapGroup(key: string) {
    if (v.proposal) return;
    if (!selected) return setSelected(key);
    if (selected === key) return setSelected(null);
    act({ type: 'propose', from: selected, into: key });
    setSelected(null);
  }

  return (
    <div className="mind">
      <div className="lu-top">
        <span className="round">{v.round} / {v.rounds} 라운드</span>
        <span className="timer">{Math.ceil(left)}초</span>
      </div>
      <TimeBar left={left} total={TOTAL[v.phase]} />

      {v.phase === 'topic' && (
        isAsker ? (
          <section className="sm-card">
            <h2>이번엔 내가 출제자예요</h2>
            <p className="muted center">모두가 답할 주제를 정해주세요. 나도 함께 답해요.</p>
            <form className="inline-form" onSubmit={(e) => { e.preventDefault(); act({ type: 'topic', topic: text }); }}>
              <input value={text} maxLength={40} placeholder="예: 라면에 넣는 재료 하나" onChange={(e) => setText(e.target.value)} aria-label="주제" />
              <button className="btn btn-primary" disabled={!text.trim()}>내기</button>
            </form>
            <div className="suggest">
              {v.suggestions.map((s) => <button key={s} className="chip" onClick={() => act({ type: 'topic', topic: s })}>{s}</button>)}
            </div>
          </section>
        ) : (
          <section className="sm-card">
            <h2>{name(v.asker)} 님이 주제를 고르는 중…</h2>
            <p className="muted center">시간 안에 정하지 않으면 주제가 자동으로 정해져요.</p>
          </section>
        )
      )}

      {v.phase !== 'topic' && (
        <section className="topic-card">
          <span className="topic-by"><Avatar room={room} id={v.asker} size="sm" /> {name(v.asker)} 님의 주제</span>
          <h2>{v.topic}</h2>
        </section>
      )}

      {v.phase === 'answer' && (
        v.myAnswer ? (
          <p className="center sm-wait">「{v.myAnswer}」 제출 완료! 다른 사람을 기다리는 중…</p>
        ) : (
          <form className="inline-form" onSubmit={(e) => { e.preventDefault(); act({ type: 'answer', answer: text }); }}>
            <input value={text} maxLength={20} autoFocus placeholder="남들도 쓸 것 같은 답" onChange={(e) => setText(e.target.value)} aria-label="내 답" />
            <button className="btn btn-primary" disabled={!text.trim()}>제출</button>
          </form>
        )
      )}

      {v.phase === 'review' && (
        <section className="answers">
          <p className="muted center">
            {v.proposal ? '묶기 투표 중이에요.' : selected ? `「${groupLabel(selected)}」 선택됨. 함께 묶을 답을 하나 더 눌러주세요.` : '같은 뜻인데 표현이 다르면, 두 답을 차례로 눌러 묶기를 요청하세요.'}
          </p>
          <ul>
            {v.groups.map((g) => (
              <li key={g.key}>
                <button className={`answer-group ${selected === g.key ? 'sel' : ''}`} onClick={() => tapGroup(g.key)} disabled={!!v.proposal}>
                  <span className="answer-label">{[...new Set(g.labels)].join(' / ')}</span>
                  <span className="answer-who">{g.ids.map((id) => <Avatar key={id} room={room} id={id} size="sm" />)}</span>
                  <b className="answer-pts">+{g.ids.length - 1}</b>
                </button>
              </li>
            ))}
            {v.blank.length > 0 && (
              <li className="answer-blank">답을 못 낸 사람: {v.blank.map(name).join(', ')}</li>
            )}
          </ul>

          {v.proposal && (
            <div className="vote-box" role="dialog" aria-label="묶기 투표">
              <p><b>{name(v.proposal.by)}</b> 님의 묶기 요청<br />「{groupLabel(v.proposal.from)}」 + 「{groupLabel(v.proposal.into)}」 같은 답으로 칠까요?</p>
              {v.proposal.myVote === undefined ? (
                <div className="vote-actions">
                  <button className="btn btn-primary" onClick={() => act({ type: 'vote', yes: true })}>묶기 찬성</button>
                  <button className="btn btn-quiet" onClick={() => act({ type: 'vote', yes: false })}>반대</button>
                </div>
              ) : <p className="muted">투표했어요. 과반이 찬성하면 묶여요.</p>}
            </div>
          )}

          {isAsker && (
            <button className="btn btn-primary btn-block" disabled={!!v.proposal} onClick={() => act({ type: 'confirm' })}>점수 확정하고 다음으로</button>
          )}
        </section>
      )}

      {error && <p className="error center" role="alert">{error}</p>}

      <ScoreStrip
        room={room}
        scores={v.scores}
        status={(id) => v.phase === 'answer' ? { text: v.answered[id] ? '제출' : '생각 중', done: v.answered[id] } : id === v.asker ? { text: '출제자', hot: true } : null}
      />
    </div>
  );
}
