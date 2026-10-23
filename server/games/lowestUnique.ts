// 눈치 숫자: 1~10 중 겹치지 않은 가장 작은 숫자를 고른 사람이 1점
import type { GameModule, GamePlayer, GameContext } from './types';

export const ROUNDS = 10;
export const PICK_MS = 10_000;
export const REVEAL_MS = 4_000;

interface RoundResult {
  round: number;
  picks: Record<string, number | null>;
  winner: string | null;
  winningNumber: number | null;
}

export interface LowestUniqueState {
  players: GamePlayer[];
  round: number;
  phase: 'pick' | 'reveal' | 'end';
  deadline: number;
  picks: Record<string, number | null>;
  scores: Record<string, number>;
  history: RoundResult[];
}

export function judge(picks: Record<string, number | null>) {
  const counts = new Map<number, number>();
  for (const n of Object.values(picks)) if (n != null) counts.set(n, (counts.get(n) ?? 0) + 1);
  const uniques = [...counts].filter(([, c]) => c === 1).map(([n]) => n);
  if (!uniques.length) return { winner: null, winningNumber: null };
  const winningNumber = Math.min(...uniques);
  const winner = Object.keys(picks).find((id) => picks[id] === winningNumber) ?? null;
  return { winner, winningNumber };
}

function botPick(): number {
  // 작은 숫자를 조금 더 자주 고르는 AI
  const weights = [6, 9, 10, 9, 8, 6, 5, 4, 3, 2];
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) < 0) return i + 1;
  return 1;
}

function startRound(s: LowestUniqueState, ctx: GameContext) {
  s.round += 1;
  s.phase = 'pick';
  s.picks = Object.fromEntries(s.players.map((p) => [p.id, null]));
  s.deadline = ctx.now() + PICK_MS;
  for (const p of s.players.filter((p) => p.isBot)) {
    ctx.setTimer(800 + Math.random() * 5000, () => {
      if (s.phase === 'pick' && s.picks[p.id] == null) {
        s.picks[p.id] = botPick();
        maybeReveal(s, ctx);
        ctx.update();
      }
    });
  }
  ctx.setTimer(PICK_MS, () => {
    if (s.phase === 'pick') reveal(s, ctx);
  });
}

function maybeReveal(s: LowestUniqueState, ctx: GameContext) {
  if (Object.values(s.picks).every((n) => n != null)) reveal(s, ctx);
}

function reveal(s: LowestUniqueState, ctx: GameContext) {
  ctx.clearTimers();
  const { winner, winningNumber } = judge(s.picks);
  if (winner) s.scores[winner] += 1;
  s.history.push({ round: s.round, picks: { ...s.picks }, winner, winningNumber });
  s.phase = 'reveal';
  s.deadline = ctx.now() + REVEAL_MS;
  ctx.setTimer(REVEAL_MS, () => {
    if (s.round >= ROUNDS) {
      s.phase = 'end';
      ctx.finish();
    } else startRound(s, ctx);
    ctx.update();
  });
  ctx.update();
}

export const lowestUnique: GameModule<LowestUniqueState> = {
  id: 'lowest-unique',
  create(players, ctx) {
    const s: LowestUniqueState = {
      players,
      round: 0,
      phase: 'pick',
      deadline: 0,
      picks: {},
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
      history: [],
    };
    startRound(s, ctx);
    return s;
  },
  onAction(s, playerId, action, ctx) {
    if (action?.type !== 'pick') return '알 수 없는 행동이에요.';
    if (s.phase !== 'pick') return '지금은 고를 수 없어요.';
    const n = Number(action.number);
    if (!Number.isInteger(n) || n < 1 || n > 10) return '1부터 10 사이 숫자를 골라주세요.';
    if (!(playerId in s.picks)) return '이 게임의 참가자가 아니에요.';
    if (s.picks[playerId] != null) return '이미 골랐어요.';
    s.picks[playerId] = n;
    maybeReveal(s, ctx);
  },
  view(s, playerId) {
    // 이번 라운드 선택은 공개 전까지 숨기고, 지난 라운드 결과만 보냄
    return {
      round: s.round,
      rounds: ROUNDS,
      phase: s.phase,
      deadline: s.deadline,
      myPick: s.picks[playerId] ?? null,
      picked: Object.fromEntries(Object.entries(s.picks).map(([id, n]) => [id, n != null])),
      scores: s.scores,
      last: s.history.at(-1) ?? null,
    };
  },
};
