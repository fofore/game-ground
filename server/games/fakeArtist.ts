// 가짜 화가: 주제를 모르는 가짜 한 명을 그림으로 찾아내기
import type { GameModule, GamePlayer, GameContext } from './types';
import { cleanStroke, PALETTE, type Stroke } from '../../shared/drawing';

export const TOPIC_MS = 60_000;
export const STROKE_MS = 30_000;
export const VOTE_MS = 60_000;
export const GUESS_MS = 30_000;
export const LAPS = 2;

export const FAKE_TOPICS: { category: string; word: string }[] = [
  { category: '동물', word: '기린' }, { category: '음식', word: '김밥' }, { category: '탈것', word: '자전거' },
  { category: '과일', word: '수박' }, { category: '날씨', word: '무지개' }, { category: '직업', word: '소방관' },
  { category: '장소', word: '놀이공원' }, { category: '물건', word: '우산' }, { category: '스포츠', word: '농구' },
];

type Phase = 'topic' | 'draw' | 'vote' | 'guess' | 'end';

export interface FakeArtistState {
  players: GamePlayer[];
  phase: Phase;
  deadline: number;
  asker: string;
  fake: string;
  category: string;
  word: string;
  order: string[];
  turn: number; // 지금까지 그린 획 수
  strokes: { by: string; stroke: Stroke | null }[];
  votes: Record<string, string>;
  accused: string | null;
  guess: string | null;
  winner: 'artists' | 'fake' | null;
  reason: string;
}

export const normalizeGuess = (s: string) => s.replace(/\s+/g, '').toLowerCase();

const current = (s: FakeArtistState) => s.order[s.turn % s.order.length];

function setTopic(s: FakeArtistState, ctx: GameContext, category: string, word: string) {
  ctx.clearTimers();
  s.category = category;
  s.word = word;
  s.phase = 'draw';
  s.turn = 0;
  nextStroke(s, ctx);
}

function nextStroke(s: FakeArtistState, ctx: GameContext) {
  ctx.clearTimers();
  if (s.turn >= s.order.length * LAPS) return startVote(s, ctx);
  s.deadline = ctx.now() + STROKE_MS;
  const turn = s.turn;
  ctx.setTimer(STROKE_MS, () => {
    if (s.phase === 'draw' && s.turn === turn) { s.strokes.push({ by: current(s), stroke: null }); s.turn += 1; nextStroke(s, ctx); ctx.update(); }
  });
}

function startVote(s: FakeArtistState, ctx: GameContext) {
  s.phase = 'vote';
  s.deadline = ctx.now() + VOTE_MS;
  ctx.setTimer(VOTE_MS, () => { if (s.phase === 'vote') { tally(s, ctx); ctx.update(); } });
}

/** 가장 많이 지목된 사람 (동점이면 null = 가짜 도망) */
export function mostVoted(votes: Record<string, string>) {
  const count: Record<string, number> = {};
  for (const t of Object.values(votes)) count[t] = (count[t] ?? 0) + 1;
  const max = Math.max(0, ...Object.values(count));
  const top = Object.keys(count).filter((k) => count[k] === max);
  return max > 0 && top.length === 1 ? top[0] : null;
}

function tally(s: FakeArtistState, ctx: GameContext) {
  ctx.clearTimers();
  s.accused = mostVoted(s.votes);
  if (s.accused !== s.fake) {
    return end(s, ctx, 'fake', s.accused ? '엉뚱한 사람을 지목했어요. 가짜 화가의 승리!' : '표가 갈렸어요. 가짜 화가가 무사히 빠져나갔어요!');
  }
  s.phase = 'guess';
  s.deadline = ctx.now() + GUESS_MS;
  ctx.setTimer(GUESS_MS, () => { if (s.phase === 'guess') { end(s, ctx, 'artists', '가짜 화가를 잡았고, 주제도 못 맞혔어요. 화가들의 승리!'); ctx.update(); } });
}

function end(s: FakeArtistState, ctx: GameContext, winner: 'artists' | 'fake', reason: string) {
  ctx.clearTimers();
  s.winner = winner;
  s.reason = reason;
  s.phase = 'end';
  ctx.finish();
}

export const fakeArtist: GameModule<FakeArtistState> = {
  id: 'fake-artist',
  create(players, ctx) {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const asker = shuffled[0].id;
    const others = shuffled.filter((p) => p.id !== asker);
    const fake = others[Math.floor(Math.random() * others.length)].id;
    const s: FakeArtistState = {
      players, phase: 'topic', deadline: ctx.now() + TOPIC_MS, asker, fake, category: '', word: '',
      order: shuffled.map((p) => p.id), turn: 0, strokes: [], votes: {}, accused: null, guess: null,
      winner: null, reason: '',
    };
    ctx.setTimer(TOPIC_MS, () => {
      if (s.phase === 'topic') { const t = FAKE_TOPICS[Math.floor(Math.random() * FAKE_TOPICS.length)]; setTopic(s, ctx, t.category, t.word); ctx.update(); }
    });
    return s;
  },
  onAction(s, playerId, action, ctx) {
    switch (action?.type) {
      case 'topic': {
        if (s.phase !== 'topic') return '지금은 주제를 정할 수 없어요.';
        if (playerId !== s.asker) return '출제 화가만 주제를 정할 수 있어요.';
        const category = String(action.category ?? '').trim().slice(0, 12);
        const word = String(action.word ?? '').trim().slice(0, 20);
        if (!category || !word) return '분류와 제시어를 모두 적어주세요.';
        setTopic(s, ctx, category, word);
        return;
      }
      case 'stroke': {
        if (s.phase !== 'draw') return '지금은 그릴 수 없어요.';
        if (current(s) !== playerId) return '내 차례가 아니에요.';
        const stroke = cleanStroke(action.stroke);
        if (!stroke) return '선을 그어주세요.';
        stroke.c = s.order.indexOf(playerId) % PALETTE.length; // 누가 그렸는지 색으로 구분
        s.strokes.push({ by: playerId, stroke });
        s.turn += 1;
        nextStroke(s, ctx);
        return;
      }
      case 'vote': {
        if (s.phase !== 'vote') return '지금은 투표할 수 없어요.';
        const target = String(action.target ?? '');
        if (target === s.asker) return '출제 화가는 지목할 수 없어요.';
        if (target === playerId) return '나 자신은 지목할 수 없어요.';
        if (!s.players.some((p) => p.id === target)) return '지목할 사람을 골라주세요.';
        s.votes[playerId] = target;
        if (s.players.every((p) => s.votes[p.id])) tally(s, ctx);
        return;
      }
      case 'guess': {
        if (s.phase !== 'guess') return '지금은 맞힐 수 없어요.';
        if (playerId !== s.fake) return '가짜 화가만 맞힐 수 있어요.';
        const g = String(action.guess ?? '').trim().slice(0, 20);
        if (!g) return '제시어를 적어주세요.';
        s.guess = g;
        if (normalizeGuess(g) === normalizeGuess(s.word)) end(s, ctx, 'fake', '잡혔지만 제시어를 맞혔어요. 가짜 화가의 역전승!');
        else end(s, ctx, 'artists', '가짜 화가를 잡았고, 제시어도 틀렸어요. 화가들의 승리!');
        return;
      }
    }
    return '알 수 없는 행동이에요.';
  },
  view(s, playerId) {
    const over = s.phase === 'end';
    const isFake = playerId === s.fake;
    return {
      phase: s.phase, deadline: s.deadline, asker: s.asker,
      role: playerId === s.asker ? 'asker' : isFake ? 'fake' : 'artist',
      category: s.category,
      word: over || !isFake ? s.word : null,
      fake: over || (s.phase === 'guess') ? s.fake : null,
      order: s.order, turn: s.turn, laps: LAPS,
      current: s.phase === 'draw' ? current(s) : null,
      strokes: s.strokes,
      voted: Object.fromEntries(s.players.map((p) => [p.id, !!s.votes[p.id]])),
      myVote: s.votes[playerId] ?? null,
      votes: over || s.phase === 'guess' ? s.votes : null,
      accused: s.accused,
      guess: over ? s.guess : null,
      winner: s.winner, reason: s.reason,
      suggestions: s.phase === 'topic' && playerId === s.asker ? [...FAKE_TOPICS].sort(() => Math.random() - 0.5).slice(0, 3) : [],
    };
  },
};
