import { useMemo, useState } from 'react';
import type { RoomView } from '../../shared/protocol';
import { PALETTE, type Stroke } from '../../shared/drawing';
import { useCountdown } from '../net';
import { Sketch, SketchTools } from '../components/Sketch';
import { Avatar, EndActions, TimeBar, useAction, usePlayers } from './common';

interface View {
  phase: 'topic' | 'draw' | 'vote' | 'guess' | 'end'; deadline: number;
  asker: string; role: 'asker' | 'fake' | 'artist';
  category: string; word: string | null; fake: string | null;
  order: string[]; turn: number; laps: number; current: string | null;
  strokes: { by: string; stroke: Stroke | null }[];
  voted: Record<string, boolean>; myVote: string | null; votes: Record<string, string> | null;
  accused: string | null; guess: string | null;
  winner: 'artists' | 'fake' | null; reason: string;
  suggestions: { category: string; word: string }[];
}

const TOTAL = { topic: 60, draw: 30, vote: 60, guess: 30, end: 1 };

export function FakeArtistView({ room, onLeave }: { room: RoomView; onLeave: () => void }) {
  const v = room.game as View;
  const { name, color: avatarColor, me } = usePlayers(room);
  const { act, error } = useAction();
  const left = useCountdown(v.deadline);
  const [cat, setCat] = useState('');
  const [word, setWord] = useState('');
  const [guess, setGuess] = useState('');
  const myIndex = v.order.indexOf(room.you);
  // 각자 정해진 색으로 그림 (누가 그렸는지 보이도록)
  const [width, setWidth] = useState(1);
  const myColor = Math.max(0, myIndex) % PALETTE.length;
  const strokes = useMemo(() => v.strokes.filter((s) => s.stroke).map((s) => s.stroke!), [v.strokes]);

  const roleBox = (
    <section className={`role-card ${v.role}`}>
      {v.role === 'fake' ? (
        <><p className="role-name">나는 가짜 화가</p><p>분류는 <b>{v.category || '?'}</b>. 제시어는 몰라요. 들키지 않게 그려보세요!</p></>
      ) : (
        <><p className="role-name">{v.role === 'asker' ? '나는 출제 화가' : '나는 진짜 화가'}</p>
          <p>분류 <b>{v.category || '?'}</b>, 제시어 <b>{v.word ?? '?'}</b>. 가짜에게 너무 티 나지 않게!</p></>
      )}
    </section>
  );

  if (v.phase === 'end') {
    return (
      <div className="fa">
        <div className="result">
          <h2>{v.winner === 'fake' ? '가짜 화가의 승리!' : '화가들의 승리!'}</h2>
          <p className="center">{v.reason}</p>
          <p className="center fa-reveal">가짜 화가는 <b>{name(v.fake)}</b>, 제시어는 <b>{v.word}</b>{v.guess ? ` (가짜의 답: ${v.guess})` : ''}</p>
          <Sketch strokes={strokes} label="모두의 그림" />
          <EndActions isHost={me.isHost} onLeave={onLeave} />
        </div>
      </div>
    );
  }

  return (
    <div className="fa">
      <div className="lu-top">
        <span className="round">{{ topic: '출제', draw: `그리기 ${Math.min(v.laps, Math.floor(v.turn / v.order.length) + 1)}/${v.laps}바퀴`, vote: '가짜 찾기', guess: '가짜의 마지막 기회' }[v.phase]}</span>
        <span className="timer">{Math.ceil(left)}초</span>
      </div>
      <TimeBar left={left} total={TOTAL[v.phase]} />

      {v.phase === 'topic' ? (
        v.role === 'asker' ? (
          <section className="sm-card">
            <h2>이번엔 내가 출제 화가</h2>
            <p className="muted center">분류는 모두에게, 제시어는 가짜를 뺀 모두에게 보여요. 나도 함께 그려요.</p>
            <form className="form" onSubmit={(e) => { e.preventDefault(); act({ type: 'topic', category: cat, word }); }}>
              <div className="row-2 even">
                <label className="field"><span>분류</span><input value={cat} maxLength={12} placeholder="예: 동물" onChange={(e) => setCat(e.target.value)} /></label>
                <label className="field"><span>제시어</span><input value={word} maxLength={20} placeholder="예: 기린" onChange={(e) => setWord(e.target.value)} /></label>
              </div>
              <button className="btn btn-primary btn-block" disabled={!cat.trim() || !word.trim()}>이걸로 시작</button>
            </form>
            <div className="suggest">
              {v.suggestions.map((s) => <button key={s.word} className="chip" onClick={() => act({ type: 'topic', category: s.category, word: s.word })}>{s.category}: {s.word}</button>)}
            </div>
          </section>
        ) : (
          <section className="sm-card">
            <h2>{name(v.asker)} 님이 주제를 정하는 중…</h2>
            {roleBox}
          </section>
        )
      ) : (
        <>
          {roleBox}
          {v.phase === 'draw' && (
            <p className="center turn-line">
              {v.current === room.you ? '내 차례! 딱 한 획만 그어주세요' : <><Avatar room={room} id={v.current!} size="sm" /> {name(v.current)} 님이 그리는 중</>}
            </p>
          )}
          <Sketch
            strokes={strokes}
            onStroke={v.phase === 'draw' && v.current === room.you ? (s) => act({ type: 'stroke', stroke: s }) : undefined}
            color={myColor}
            width={width}
            label="모두의 그림"
          />
          {v.phase === 'draw' && v.current === room.you && (
            <SketchTools color={myColor} width={width} onColor={() => {}} onWidth={setWidth} showColors={false} />
          )}
          <ul className="painters">
            {v.order.map((id, i) => (
              <li key={id} className={v.current === id ? 'now' : ''}>
                <i style={{ background: PALETTE[i % PALETTE.length] }} />{name(id)}{id === v.asker ? ' (출제)' : ''}
              </li>
            ))}
          </ul>

          {v.phase === 'vote' && (
            <section className="vote-box">
              <p><b>누가 가짜 화가일까요?</b> 이야기를 나눈 뒤 지목하세요. 출제 화가는 지목할 수 없어요.</p>
              <div className="vote-grid">
                {room.players.filter((p) => p.id !== v.asker && p.id !== room.you).map((p) => (
                  <button key={p.id} className={`btn ${v.myVote === p.id ? 'btn-primary' : 'btn-quiet'}`} onClick={() => act({ type: 'vote', target: p.id })}>
                    <span className="avatar sm" style={{ background: avatarColor(p.id) }}>{p.nickname.slice(0, 1)}</span>{p.nickname}
                  </button>
                ))}
              </div>
              <p className="muted small">투표 {Object.values(v.voted).filter(Boolean).length}/{room.players.length} · 다시 누르면 바꿀 수 있어요</p>
            </section>
          )}

          {v.phase === 'guess' && (
            <section className="vote-box">
              <p><b>{name(v.fake)}</b> 님이 가짜 화가로 지목됐어요!</p>
              {v.role === 'fake' ? (
                <form className="inline-form" onSubmit={(e) => { e.preventDefault(); act({ type: 'guess', guess }); }}>
                  <input value={guess} maxLength={20} placeholder="제시어는 무엇일까?" onChange={(e) => setGuess(e.target.value)} aria-label="제시어 맞히기" />
                  <button className="btn btn-primary" disabled={!guess.trim()}>맞히기</button>
                </form>
              ) : <p className="muted">가짜 화가가 제시어를 맞히면 역전이에요. 두근두근…</p>}
            </section>
          )}
        </>
      )}
      {error && <p className="error center" role="alert">{error}</p>}
    </div>
  );
}
