import { useEffect, useRef, useState } from 'react';
import type { RoomView } from '../../shared/protocol';
import type { Drawing } from '../../shared/drawing';
import { useCountdown } from '../net';
import { Sketch, SketchTools } from '../components/Sketch';
import { Avatar, EndActions, ScoreStrip, TimeBar, useAction, usePlayers } from './common';

type Entry = { kind: 'text'; by: string; text: string } | { kind: 'draw'; by: string; drawing: Drawing };
interface View {
  step: number; steps: number; phase: 'work' | 'reveal' | 'end'; deadline: number;
  task: 'start' | 'draw' | 'text' | null;
  prompt: Entry | null;
  submitted: boolean;
  done: Record<string, boolean>;
  revealBook: number;
  books: { owner: string; entries: Entry[] }[];
}

export function DrawRelayView({ room, onLeave }: { room: RoomView; onLeave: () => void }) {
  const v = room.game as View;
  const { name, me } = usePlayers(room);
  const { act, error } = useAction();
  const left = useCountdown(v.deadline);
  const [text, setText] = useState('');
  const [drawing, setDrawing] = useState<Drawing>([]);
  const [color, setColor] = useState(0);
  const [width, setWidth] = useState(1);
  const autoSent = useRef(-1);

  useEffect(() => { setText(''); setDrawing([]); }, [v.step]);

  // 마감 직전 자동 제출 (그린 만큼, 적은 만큼)
  useEffect(() => {
    if (v.phase !== 'work' || v.submitted || left > 1.2 || left === 0 || autoSent.current === v.step) return;
    autoSent.current = v.step;
    if (v.task === 'draw') act({ type: 'submit', drawing });
    else if (text.trim()) act({ type: 'submit', text });
  }, [left]);

  if (v.phase === 'reveal' || v.phase === 'end') {
    const book = v.books[Math.min(v.revealBook, v.books.length - 1)];
    const last = v.revealBook >= v.books.length - 1;
    return (
      <div className="dr">
        <div className="lu-top"><span className="round">{name(book.owner)} 님의 책</span><span className="timer">{v.revealBook + 1} / {v.books.length}</span></div>
        <ol className="book">
          {book.entries.map((e, i) => (
            <li key={i} className={`page ${e.kind}`}>
              <span className="page-by"><Avatar room={room} id={e.by} size="sm" /> {name(e.by)}{e.kind === 'draw' ? ' 님의 그림' : i === 0 ? ' 님의 시작 문장' : ' 님의 추측'}</span>
              {e.kind === 'text' ? <p className="page-text">{e.text}</p> : e.drawing.length ? <Sketch strokes={e.drawing} label={`${name(e.by)} 님의 그림`} /> : <p className="muted">빈 그림이에요.</p>}
            </li>
          ))}
        </ol>
        {v.phase === 'end' ? (
          <div className="result"><h2>다 같이 봤어요!</h2><EndActions isHost={me.isHost} onLeave={onLeave} /></div>
        ) : (
          <button className="btn btn-primary btn-block btn-big" onClick={() => act({ type: 'next', book: v.revealBook })}>{last ? '끝내기' : '다음 책 보기'}</button>
        )}
      </div>
    );
  }

  const isDraw = v.task === 'draw';
  return (
    <div className="dr">
      <div className="lu-top">
        <span className="round">{v.step + 1} / {v.steps} 차례</span>
        <span className="timer">{Math.ceil(left)}초</span>
      </div>
      <TimeBar left={left} total={v.step === 0 ? 60 : isDraw ? 90 : 45} />

      {v.submitted ? (
        <p className="center sm-wait">제출 완료! 다른 사람을 기다리는 중…</p>
      ) : v.task === 'start' ? (
        <section className="dr-task">
          <h2>그림으로 그릴 만한 문장을 적어주세요</h2>
          <p className="muted center">예: 우산 쓴 고양이가 버스를 기다린다</p>
          <form className="inline-form" onSubmit={(e) => { e.preventDefault(); act({ type: 'submit', text }); }}>
            <input value={text} maxLength={60} onChange={(e) => setText(e.target.value)} aria-label="시작 문장" placeholder="시작 문장" />
            <button className="btn btn-primary" disabled={!text.trim()}>넘기기</button>
          </form>
        </section>
      ) : isDraw ? (
        <section className="dr-task">
          <p className="prompt-label">이 문장을 그려주세요</p>
          <h2 className="prompt">{v.prompt?.kind === 'text' ? v.prompt.text : ''}</h2>
          <Sketch strokes={drawing} onStroke={(s) => setDrawing((d) => [...d, s])} color={color} width={width} label="내 그림판" />
          <SketchTools color={color} width={width} onColor={setColor} onWidth={setWidth}>
            <button className="btn btn-text" disabled={!drawing.length} onClick={() => setDrawing((d) => d.slice(0, -1))}>되돌리기</button>
          </SketchTools>
          <button className="btn btn-primary btn-block" disabled={!drawing.length} onClick={() => act({ type: 'submit', drawing })}>그림 넘기기</button>
        </section>
      ) : (
        <section className="dr-task">
          <p className="prompt-label">이 그림은 무엇일까요?</p>
          {v.prompt?.kind === 'draw' && (v.prompt.drawing.length ? <Sketch strokes={v.prompt.drawing} label="받은 그림" /> : <p className="muted center">앞사람이 아무것도 못 그렸어요. 마음대로 상상해 보세요!</p>)}
          <form className="inline-form" onSubmit={(e) => { e.preventDefault(); act({ type: 'submit', text }); }}>
            <input value={text} maxLength={60} onChange={(e) => setText(e.target.value)} aria-label="그림 설명" placeholder="그림을 한 문장으로" />
            <button className="btn btn-primary" disabled={!text.trim()}>넘기기</button>
          </form>
        </section>
      )}
      {error && <p className="error center" role="alert">{error}</p>}

      <ScoreStrip room={room} scores={{}} hideScore status={(id) => ({ text: v.done[id] ? '완료' : '작업 중', done: v.done[id] })} />
    </div>
  );
}
