// 그림 릴레이: 문장 → 그림 → 문장 … 을 옆 사람에게 넘기고, 마지막에 모두 공개
import type { GameModule, GamePlayer, GameContext } from './types';
import { cleanDrawing, type Drawing } from '../../shared/drawing';

export const WRITE_MS = 60_000;
export const DRAW_MS = 90_000;
export const GUESS_MS = 45_000;

type Entry = { kind: 'text'; by: string; text: string } | { kind: 'draw'; by: string; drawing: Drawing };

export interface DrawRelayState {
  players: GamePlayer[];
  step: number; // 0 = 첫 문장, 홀수 = 그림, 짝수 = 문장
  steps: number;
  phase: 'work' | 'reveal' | 'end';
  deadline: number;
  books: Entry[][]; // books[i] = i번째 사람이 시작한 책
  revealBook: number;
}

/** 이번 단계에서 플레이어가 맡는 책 번호 */
export const bookFor = (s: DrawRelayState, playerIndex: number) =>
  (playerIndex - s.step + s.players.length * 10) % s.players.length;
const kindAt = (step: number): 'text' | 'draw' => (step % 2 === 0 ? 'text' : 'draw');

function startStep(s: DrawRelayState, ctx: GameContext) {
  const ms = s.step === 0 ? WRITE_MS : kindAt(s.step) === 'draw' ? DRAW_MS : GUESS_MS;
  s.deadline = ctx.now() + ms;
  // 화면이 마감 1초 전 자동 제출하고, 그래도 안 들어온 칸은 서버가 채움
  ctx.setTimer(ms + 1_500, () => {
    if (s.phase !== 'work') return;
    s.players.forEach((p, i) => {
      const book = s.books[bookFor(s, i)];
      if (book.length <= s.step) {
        book.push(kindAt(s.step) === 'draw'
          ? { kind: 'draw', by: p.id, drawing: [] }
          : { kind: 'text', by: p.id, text: '(시간 안에 못 적었어요)' });
      }
    });
    advance(s, ctx);
    ctx.update();
  });
}

function advance(s: DrawRelayState, ctx: GameContext) {
  ctx.clearTimers();
  s.step += 1;
  if (s.step >= s.steps) { s.phase = 'reveal'; s.revealBook = 0; return; }
  startStep(s, ctx);
}

export const drawRelay: GameModule<DrawRelayState> = {
  id: 'draw-relay',
  create(players, ctx) {
    const s: DrawRelayState = {
      players, step: 0, steps: players.length, phase: 'work', deadline: 0,
      books: players.map(() => []), revealBook: 0,
    };
    startStep(s, ctx);
    return s;
  },
  onAction(s, playerId, action, ctx) {
    const idx = s.players.findIndex((p) => p.id === playerId);
    if (idx < 0) return '이 게임의 참가자가 아니에요.';
    if (action?.type === 'submit') {
      if (s.phase !== 'work') return '지금은 제출할 수 없어요.';
      const book = s.books[bookFor(s, idx)];
      if (book.length > s.step) return '이미 제출했어요.';
      if (kindAt(s.step) === 'draw') {
        book.push({ kind: 'draw', by: playerId, drawing: cleanDrawing(action.drawing) });
      } else {
        const text = String(action.text ?? '').trim().slice(0, 60);
        if (!text) return '문장을 적어주세요.';
        book.push({ kind: 'text', by: playerId, text });
      }
      if (s.books.every((b) => b.length > s.step)) advance(s, ctx);
      return;
    }
    if (action?.type === 'next') {
      // 누구나 다음 책으로 넘길 수 있음. 여럿이 동시에 눌러도 한 번만 넘어가도록 책 번호 확인
      if (s.phase !== 'reveal') return '지금은 넘길 수 없어요.';
      if (Number(action.book) !== s.revealBook) return;
      if (s.revealBook >= s.books.length - 1) { s.phase = 'end'; ctx.finish(); }
      else s.revealBook += 1;
      return;
    }
    return '알 수 없는 행동이에요.';
  },
  view(s, playerId) {
    const idx = s.players.findIndex((p) => p.id === playerId);
    const book = idx >= 0 ? s.books[bookFor(s, idx)] : [];
    const done = s.players.map((p, i) => [p.id, s.books[bookFor(s, i)].length > s.step]);
    return {
      step: s.step, steps: s.steps, phase: s.phase, deadline: s.deadline,
      task: s.phase === 'work' ? (s.step === 0 ? 'start' : kindAt(s.step)) : null,
      prompt: s.phase === 'work' && s.step > 0 ? book[s.step - 1] : null,
      submitted: s.phase === 'work' && book.length > s.step,
      done: Object.fromEntries(done),
      revealBook: s.revealBook,
      books: s.phase === 'work' ? [] : s.books.map((b, i) => ({ owner: s.players[i].id, entries: b })),
    };
  },
};
