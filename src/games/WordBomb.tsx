import { useEffect, useRef, useState } from 'react';
import type { RoomView } from '../../shared/protocol';
import { useCountdown } from '../net';
import { Avatar, Ranking, ScoreStrip, useAction, usePlayers } from './common';

interface View {
  round: number; rounds: number;
  phase: 'play' | 'judge' | 'boom' | 'end';
  topic: string;
  holder: string;
  words: { word: string; by: string; status: 'open' | 'ok' | 'rejected' }[];
  challengeUntil: number;
  lastBy: string | null;
  judge: { word: string; wordBy: string; by: string; votes: Record<string, boolean>; deadline: number } | null;
  twoPlayers: boolean;
  scores: Record<string, number>;
  exploded: { holder: string; round: number } | null;
}

export function WordBombView({ room, onLeave }: { room: RoomView; onLeave: () => void }) {
  const v = room.game as View;
  const { name } = usePlayers(room);
  const { act, error } = useAction();
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const challengeLeft = useCountdown(v.challengeUntil);
  const judgeLeft = useCountdown(v.judge?.deadline ?? 0);
  const mine = v.holder === room.you;

  useEffect(() => { if (mine && v.phase === 'play') inputRef.current?.focus(); }, [mine, v.phase]);

  if (v.phase === 'end') return <Ranking room={room} scores={v.scores} onLeave={onLeave} />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (await act({ type: 'word', word: text })) setText('');
  }

  const canChallenge = v.phase === 'play' && challengeLeft > 0 && v.lastBy && v.lastBy !== room.you;
  const judge = v.judge;
  const iVoted = judge && room.you in judge.votes;

  return (
    <div className="wb">
      <div className="lu-top">
        <span className="round">{v.round} / {v.rounds} 라운드</span>
        <span className="topic-pill">주제: {v.topic}</span>
      </div>

      <section className={`bomb-stage ${v.phase === 'boom' ? 'boom' : ''} ${mine ? 'mine' : ''}`} aria-live="polite">
        <Bomb exploded={v.phase === 'boom'} paused={v.phase === 'judge'} />
        {v.phase === 'boom' && v.exploded ? (
          <p className="bomb-msg">펑! {name(v.exploded.holder)} 님 -1점</p>
        ) : v.phase === 'judge' ? (
          <p className="bomb-msg">판정 중이라 폭탄이 잠시 멈췄어요</p>
        ) : (
          <p className="bomb-msg">{mine ? '내 차례! 빨리 단어를 대세요' : <>{name(v.holder)} 님이 폭탄을 들고 있어요</>}</p>
        )}
      </section>

      {judge && (
        <div className="vote-box" role="dialog" aria-label="이의 제기 판정">
          <p><b>{name(judge.by)}</b> 님이 「{judge.word}」에 이의를 제기했어요.</p>
          {v.twoPlayers ? (
            judge.wordBy === room.you ? (
              <div className="vote-actions">
                <button className="btn btn-primary" onClick={() => act({ type: 'vote', ok: true })}>유지하기</button>
                <button className="btn btn-quiet" onClick={() => act({ type: 'vote', ok: false })}>인정하고 -1점</button>
              </div>
            ) : <p className="muted">{name(judge.wordBy)} 님이 유지할지 정하고 있어요.</p>
          ) : judge.wordBy === room.you ? (
            <p className="muted">다른 사람들이 투표 중이에요. {Math.ceil(judgeLeft)}초</p>
          ) : iVoted ? (
            <p className="muted">투표했어요. {Math.ceil(judgeLeft)}초</p>
          ) : (
            <div className="vote-actions">
              <button className="btn btn-primary" onClick={() => act({ type: 'vote', ok: true })}>인정</button>
              <button className="btn btn-quiet" onClick={() => act({ type: 'vote', ok: false })}>불인정</button>
            </div>
          )}
        </div>
      )}

      {mine && v.phase === 'play' && (
        <form className="inline-form" onSubmit={submit}>
          <input ref={inputRef} value={text} maxLength={20} placeholder={`${v.topic}에 맞는 단어`} onChange={(e) => setText(e.target.value)} aria-label="단어" />
          <button className="btn btn-primary" disabled={!text.trim()}>넘기기</button>
        </form>
      )}
      {canChallenge && (
        <button className="btn btn-quiet btn-block" onClick={() => act({ type: 'challenge' })}>
          「{v.words.at(-1)?.word}」 이의 제기 ({Math.ceil(challengeLeft)}초)
        </button>
      )}
      {error && <p className="error center" role="alert">{error}</p>}

      <ul className="word-log" aria-label="나온 단어">
        {[...v.words].reverse().map((w, i) => (
          <li key={`${w.word}-${i}`} className={w.status}>
            <Avatar room={room} id={w.by} size="sm" />
            <span>{w.word}</span>
            {w.status === 'rejected' && <em>불인정</em>}
          </li>
        ))}
      </ul>

      <ScoreStrip room={room} scores={v.scores} status={(id) => id === v.holder && v.phase !== 'boom' ? { text: '폭탄', hot: true } : null} />
    </div>
  );
}

function Bomb({ exploded, paused }: { exploded: boolean; paused: boolean }) {
  return (
    <svg viewBox="0 0 120 110" className={`bomb ${paused ? 'paused' : ''}`} aria-hidden="true">
      {exploded ? (
        <path d="M60 8l10 26 26-12-12 26 28 6-28 10 14 26-26-12-10 28-10-28-26 12 14-26-28-10 28-6-12-26 26 12z" fill="#FFC93C" stroke="#1D2142" strokeWidth="3" strokeLinejoin="round" />
      ) : (
        <g stroke="#1D2142" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
          <circle cx="54" cy="68" r="34" fill="#1D2142" />
          <circle cx="42" cy="56" r="7" fill="#5A6190" stroke="none" />
          <rect x="70" y="26" width="18" height="14" rx="3" fill="#5A6190" transform="rotate(35 79 33)" />
          <path d="M86 26c6-10 16-12 22-6" fill="none" />
          <g className="spark"><path d="M108 12l3 7 7-1-5 5 4 6-7-2-3 7-2-7-7 1 5-5-3-6 6 2z" fill="#FF5A7A" strokeWidth="2" /></g>
        </g>
      )}
    </svg>
  );
}
