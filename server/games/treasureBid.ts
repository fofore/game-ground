// 보물 눈치싸움: 1~15 카드를 한 번씩, 겹치면 무효, 보물은 큰 수 / 함정은 작은 수가 가져감
import type { GameModule, GamePlayer, GameContext } from './types';

export const PICK_MS = 20_000;
export const REVEAL_MS = 4_500;
export const SET_BONUS = 5;

export type Gem = 'ruby' | 'sapphire' | 'emerald';
export interface Prize { value: number; gem: Gem | null } // value < 0 = 함정

/** 보물 1~10 (보석 종류 순환), 함정 -1~-5 */
export function makePrizes(): Prize[] {
  const gems: Gem[] = ['ruby', 'sapphire', 'emerald'];
  const list: Prize[] = [
    ...Array.from({ length: 10 }, (_, i) => ({ value: i + 1, gem: gems[i % 3] })),
    ...Array.from({ length: 5 }, (_, i) => ({ value: -(i + 1), gem: null })),
  ];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export interface TreasureState {
  players: GamePlayer[];
  deck: Prize[];
  pot: Prize[];
  round: number;
  rounds: number;
  phase: 'pick' | 'reveal' | 'end';
  deadline: number;
  hands: Record<string, number[]>;
  picks: Record<string, number | null>;
  won: Record<string, Prize[]>;
  last: { picks: Record<string, number>; pot: Prize[]; winner: string | null; carried: boolean } | null;
}

export function scoreOf(prizes: Prize[]) {
  const sum = prizes.reduce((a, p) => a + p.value, 0);
  const count = (g: Gem) => prizes.filter((p) => p.gem === g).length;
  const sets = Math.min(count('ruby'), count('sapphire'), count('emerald'));
  return { sum, sets, total: sum + sets * SET_BONUS };
}

/** 이번 라운드 판정 (테스트용으로 분리) */
export function resolvePicks(picks: Record<string, number>, pot: Prize[]) {
  const counts = new Map<number, number>();
  for (const n of Object.values(picks)) counts.set(n, (counts.get(n) ?? 0) + 1);
  const uniques = [...counts].filter(([, c]) => c === 1).map(([n]) => n);
  if (!uniques.length) return null;
  const potValue = pot.reduce((a, p) => a + p.value, 0);
  const target = potValue >= 0 ? Math.max(...uniques) : Math.min(...uniques);
  return Object.keys(picks).find((id) => picks[id] === target) ?? null;
}

function botPick(s: TreasureState, id: string) {
  const hand = s.hands[id];
  const potValue = s.pot.reduce((a, p) => a + p.value, 0);
  // 보물이 클수록 큰 카드, 함정이 클수록 작은 카드를 내는 경향 + 무작위
  const want = potValue >= 0 ? Math.min(1, potValue / 10) : Math.min(1, -potValue / 8);
  const sorted = [...hand].sort((a, b) => a - b);
  const pos = potValue >= 0
    ? Math.round((want * 0.8 + Math.random() * 0.3) * (sorted.length - 1))
    : Math.round(((1 - want) * 0.5 + Math.random() * 0.3) * (sorted.length - 1));
  return sorted[Math.max(0, Math.min(sorted.length - 1, pos))];
}

function startRound(s: TreasureState, ctx: GameContext) {
  s.round += 1;
  s.pot.push(s.deck.shift()!);
  s.phase = 'pick';
  s.picks = Object.fromEntries(s.players.map((p) => [p.id, null]));
  s.deadline = ctx.now() + PICK_MS;
  for (const p of s.players.filter((x) => x.isBot)) {
    ctx.setTimer(1000 + Math.random() * 6000, () => {
      if (s.phase === 'pick' && s.picks[p.id] == null) { s.picks[p.id] = botPick(s, p.id); maybeReveal(s, ctx); ctx.update(); }
    });
  }
  ctx.setTimer(PICK_MS, () => {
    if (s.phase !== 'pick') return;
    // 시간 초과: 남은 카드 중 가장 작은 카드
    for (const p of s.players) if (s.picks[p.id] == null) s.picks[p.id] = Math.min(...s.hands[p.id]);
    reveal(s, ctx);
    ctx.update();
  });
}

function maybeReveal(s: TreasureState, ctx: GameContext) {
  if (Object.values(s.picks).every((n) => n != null)) reveal(s, ctx);
}

function reveal(s: TreasureState, ctx: GameContext) {
  ctx.clearTimers();
  const picks = s.picks as Record<string, number>;
  for (const [id, n] of Object.entries(picks)) s.hands[id] = s.hands[id].filter((c) => c !== n);
  const winner = resolvePicks(picks, s.pot);
  const pot = [...s.pot];
  if (winner) { s.won[winner].push(...s.pot); s.pot = []; }
  s.last = { picks: { ...picks }, pot, winner, carried: !winner };
  s.phase = 'reveal';
  s.deadline = ctx.now() + REVEAL_MS;
  ctx.setTimer(REVEAL_MS, () => {
    if (s.round >= s.rounds) { s.pot = []; s.phase = 'end'; ctx.finish(); }
    else startRound(s, ctx);
    ctx.update();
  });
}

export const treasureBid: GameModule<TreasureState> = {
  id: 'treasure-bid',
  create(players, ctx) {
    const deck = makePrizes();
    const s: TreasureState = {
      players, deck, pot: [], round: 0, rounds: deck.length, phase: 'pick', deadline: 0,
      hands: Object.fromEntries(players.map((p) => [p.id, Array.from({ length: 15 }, (_, i) => i + 1)])),
      picks: {}, won: Object.fromEntries(players.map((p) => [p.id, []])), last: null,
    };
    startRound(s, ctx);
    return s;
  },
  onAction(s, playerId, action, ctx) {
    if (action?.type !== 'pick') return '알 수 없는 행동이에요.';
    if (s.phase !== 'pick') return '지금은 카드를 낼 수 없어요.';
    if (!(playerId in s.picks)) return '이 게임의 참가자가 아니에요.';
    if (s.picks[playerId] != null) return '이미 냈어요.';
    const n = Number(action.number);
    if (!s.hands[playerId].includes(n)) return '이미 쓴 카드예요.';
    s.picks[playerId] = n;
    maybeReveal(s, ctx);
  },
  view(s, playerId) {
    return {
      round: s.round, rounds: s.rounds, phase: s.phase, deadline: s.deadline,
      pot: s.pot, myHand: s.hands[playerId] ?? [], myPick: s.picks[playerId] ?? null,
      picked: Object.fromEntries(Object.entries(s.picks).map(([id, n]) => [id, n != null])),
      won: s.won,
      scores: Object.fromEntries(Object.entries(s.won).map(([id, w]) => [id, scoreOf(w).total])),
      last: s.phase === 'pick' ? null : s.last,
      left: s.deck.length,
    };
  },
};
