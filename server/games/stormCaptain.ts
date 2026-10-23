// 폭풍의 선장: 이길 횟수를 예측하는 트릭테이킹 (보드게임 「스컬킹」에서 영감)
import type { GameModule, GamePlayer, GameContext } from './types';

export const ROUNDS = 10;
export const BID_MS = 30_000;
export const PLAY_MS = 30_000;
export const TRICK_PAUSE_MS = 2_500;
export const ROUND_PAUSE_MS = 6_000;

export type Suit = 'green' | 'yellow' | 'purple' | 'black'; // black = 폭풍(으뜸)
export type Kind = 'num' | 'escape' | 'knight' | 'captain' | 'dancer' | 'tigress';
export interface Card { id: number; kind: Kind; suit?: Suit; n?: number }
export interface Played { by: string; card: Card; as?: 'knight' | 'escape' } // as = 변신 카드를 무엇으로 냈는지

/** 70장: 숫자 4색×14, 기사 5, 변신 1, 선장 1, 무희 2, 도망 5 */
export function makeDeck(): Card[] {
  const deck: Card[] = [];
  let id = 0;
  for (const suit of ['green', 'yellow', 'purple', 'black'] as Suit[]) {
    for (let n = 1; n <= 14; n++) deck.push({ id: id++, kind: 'num', suit, n });
  }
  const add = (kind: Kind, count: number) => { for (let i = 0; i < count; i++) deck.push({ id: id++, kind }); };
  add('knight', 5); add('tigress', 1); add('captain', 1); add('dancer', 2); add('escape', 5);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** 실제로 작동하는 종류 (변신 카드는 선택한 쪽) */
const eff = (p: Played): Kind => (p.card.kind === 'tigress' ? (p.as === 'escape' ? 'escape' : 'knight') : p.card.kind);

/** 따라야 하는 색: 처음 나온 숫자 카드의 색 (특수 카드가 먼저 나오면 따를 색 없음) */
export function ledSuit(trick: Played[]): Suit | null {
  for (const p of trick) {
    const k = eff(p);
    if (k === 'num') return p.card.suit!;
    if (k !== 'escape') return null; // 기사·선장·무희가 먼저 나오면 아무 카드나
  }
  return null;
}

export function canPlay(hand: Card[], card: Card, trick: Played[]) {
  if (card.kind !== 'num') return true;
  const led = ledSuit(trick);
  if (!led || card.suit === led) return true;
  return !hand.some((c) => c.kind === 'num' && c.suit === led);
}

/** 트릭 판정: 이긴 사람과 보너스 */
export function judgeTrick(trick: Played[]) {
  const first = (k: Kind) => trick.find((p) => eff(p) === k);
  const count = (k: Kind) => trick.filter((p) => eff(p) === k).length;
  const captain = first('captain'), dancer = first('dancer'), knight = first('knight');
  let winner: Played;
  let bonus = 0;
  if (captain && dancer) { winner = dancer; bonus += 40; }
  else if (captain) { winner = captain; bonus += 30 * count('knight'); }
  else if (knight) { winner = knight; bonus += 20 * count('dancer'); }
  else if (dancer) { winner = dancer; }
  else {
    const nums = trick.filter((p) => eff(p) === 'num');
    if (!nums.length) winner = trick[0]; // 모두 도망이면 먼저 낸 사람
    else {
      const blacks = nums.filter((p) => p.card.suit === 'black');
      const led = ledSuit(trick)!;
      const pool = blacks.length ? blacks : nums.filter((p) => p.card.suit === led);
      winner = pool.reduce((a, b) => (b.card.n! > a.card.n! ? b : a));
    }
  }
  for (const p of trick) if (p.card.kind === 'num' && p.card.n === 14) bonus += p.card.suit === 'black' ? 20 : 10;
  return { winner: winner.by, bonus };
}

export function roundScore(round: number, bid: number, won: number, bonus: number) {
  if (bid === 0) return won === 0 ? 10 * round : -10 * round;
  if (bid === won) return 20 * bid + bonus;
  return -10 * Math.abs(bid - won);
}

export interface StormState {
  players: GamePlayer[];
  round: number;
  phase: 'bid' | 'play' | 'trickEnd' | 'roundEnd' | 'end';
  deadline: number;
  hands: Record<string, Card[]>;
  bids: Record<string, number | null>;
  won: Record<string, number>;
  bonus: Record<string, number>;
  trick: Played[];
  leader: number; // 이번 트릭을 시작한 사람 순서
  turn: number;   // 지금 낼 사람 순서
  lastTrick: { cards: Played[]; winner: string; bonus: number } | null;
  scores: Record<string, number>;
  history: { round: number; bids: Record<string, number>; won: Record<string, number>; points: Record<string, number> }[];
}

const cardsFor = (round: number, n: number) => Math.min(round, Math.floor(70 / n));

function startRound(s: StormState, ctx: GameContext) {
  s.round += 1;
  const deck = makeDeck();
  const k = cardsFor(s.round, s.players.length);
  s.hands = Object.fromEntries(s.players.map((p) => [p.id, deck.splice(0, k)]));
  s.bids = Object.fromEntries(s.players.map((p) => [p.id, null]));
  s.won = Object.fromEntries(s.players.map((p) => [p.id, 0]));
  s.bonus = Object.fromEntries(s.players.map((p) => [p.id, 0]));
  s.trick = [];
  s.lastTrick = null;
  s.leader = (s.round - 1) % s.players.length;
  s.turn = s.leader;
  s.phase = 'bid';
  s.deadline = ctx.now() + BID_MS;
  for (const p of s.players.filter((x) => x.isBot)) {
    ctx.setTimer(800 + Math.random() * 3000, () => { if (s.phase === 'bid' && s.bids[p.id] == null) { s.bids[p.id] = botBid(s.hands[p.id]); afterBid(s, ctx); ctx.update(); } });
  }
  ctx.setTimer(BID_MS, () => {
    if (s.phase !== 'bid') return;
    for (const p of s.players) if (s.bids[p.id] == null) s.bids[p.id] = botBid(s.hands[p.id]);
    afterBid(s, ctx); ctx.update();
  });
}

function afterBid(s: StormState, ctx: GameContext) {
  if (s.players.some((p) => s.bids[p.id] == null)) return;
  ctx.clearTimers();
  s.phase = 'play';
  startTurn(s, ctx);
}

function startTurn(s: StormState, ctx: GameContext) {
  const p = s.players[s.turn];
  s.deadline = ctx.now() + PLAY_MS;
  const turnKey = `${s.round}-${s.leader}-${s.trick.length}`;
  const auto = () => {
    if (s.phase !== 'play' || `${s.round}-${s.leader}-${s.trick.length}` !== turnKey) return;
    const choice = botPlay(s, p.id);
    play(s, ctx, p.id, choice.card, choice.as);
    ctx.update();
  };
  ctx.setTimer(p.isBot ? 900 + Math.random() * 900 : PLAY_MS, auto);
}

function play(s: StormState, ctx: GameContext, playerId: string, card: Card, as?: 'knight' | 'escape') {
  ctx.clearTimers();
  s.hands[playerId] = s.hands[playerId].filter((c) => c.id !== card.id);
  s.trick.push({ by: playerId, card, as: card.kind === 'tigress' ? (as === 'escape' ? 'escape' : 'knight') : undefined });
  if (s.trick.length < s.players.length) {
    s.turn = (s.turn + 1) % s.players.length;
    startTurn(s, ctx);
    return;
  }
  const { winner, bonus } = judgeTrick(s.trick);
  s.won[winner] += 1;
  s.bonus[winner] += bonus;
  s.lastTrick = { cards: s.trick, winner, bonus };
  s.phase = 'trickEnd';
  ctx.setTimer(TRICK_PAUSE_MS, () => {
    s.trick = [];
    s.leader = s.players.findIndex((p) => p.id === winner);
    s.turn = s.leader;
    if (Object.values(s.hands).every((h) => h.length === 0)) endRound(s, ctx);
    else { s.phase = 'play'; startTurn(s, ctx); }
    ctx.update();
  });
}

function endRound(s: StormState, ctx: GameContext) {
  const points: Record<string, number> = {};
  for (const p of s.players) {
    points[p.id] = roundScore(s.round, s.bids[p.id]!, s.won[p.id], s.bonus[p.id]);
    s.scores[p.id] += points[p.id];
  }
  s.history.push({ round: s.round, bids: { ...s.bids } as Record<string, number>, won: { ...s.won }, points });
  s.phase = 'roundEnd';
  s.deadline = ctx.now() + ROUND_PAUSE_MS;
  ctx.setTimer(ROUND_PAUSE_MS, () => {
    if (s.round >= ROUNDS) { s.phase = 'end'; ctx.finish(); } else startRound(s, ctx);
    ctx.update();
  });
}

// ---------- AI ----------
const strength = (c: Card) =>
  c.kind === 'captain' ? 0.95 : c.kind === 'knight' || c.kind === 'tigress' ? 0.8 : c.kind === 'dancer' ? 0.7
    : c.kind === 'escape' ? 0 : c.suit === 'black' ? 0.35 + c.n! * 0.045 : Math.max(0, (c.n! - 8) * 0.12);

export function botBid(hand: Card[]) {
  return Math.round(hand.reduce((a, c) => a + strength(c), 0));
}

function wouldWin(s: StormState, playerId: string, card: Card, as?: 'knight' | 'escape') {
  return judgeTrick([...s.trick, { by: playerId, card, as }]).winner === playerId;
}

export function botPlay(s: StormState, playerId: string): { card: Card; as?: 'knight' | 'escape' } {
  const hand = s.hands[playerId];
  const legal = hand.filter((c) => canPlay(hand, c, s.trick));
  const need = (s.bids[playerId] ?? 0) - s.won[playerId];
  const byStrength = [...legal].sort((a, b) => strength(a) - strength(b));
  if (need > 0) {
    const winners = byStrength.filter((c) => wouldWin(s, playerId, c, 'knight'));
    if (winners.length) return { card: winners[0], as: 'knight' };
    return { card: byStrength[0], as: 'escape' };
  }
  const losers = byStrength.filter((c) => !wouldWin(s, playerId, c, 'escape'));
  return { card: (losers.length ? losers[losers.length - 1] : byStrength[0]), as: 'escape' };
}

export const stormCaptain: GameModule<StormState> = {
  id: 'storm-captain',
  create(players, ctx) {
    const s: StormState = {
      players, round: 0, phase: 'bid', deadline: 0, hands: {}, bids: {}, won: {}, bonus: {},
      trick: [], leader: 0, turn: 0, lastTrick: null,
      scores: Object.fromEntries(players.map((p) => [p.id, 0])), history: [],
    };
    startRound(s, ctx);
    return s;
  },
  onAction(s, playerId, action, ctx) {
    if (action?.type === 'bid') {
      if (s.phase !== 'bid') return '지금은 예측할 수 없어요.';
      if (s.bids[playerId] != null) return '이미 예측했어요.';
      const n = Number(action.bid);
      const max = s.hands[playerId]?.length ?? 0;
      if (!Number.isInteger(n) || n < 0 || n > max) return `0부터 ${max} 사이로 예측해주세요.`;
      s.bids[playerId] = n;
      afterBid(s, ctx);
      return;
    }
    if (action?.type === 'play') {
      if (s.phase !== 'play') return '지금은 카드를 낼 수 없어요.';
      if (s.players[s.turn].id !== playerId) return '내 차례가 아니에요.';
      const hand = s.hands[playerId];
      const card = hand.find((c) => c.id === Number(action.card));
      if (!card) return '손에 없는 카드예요.';
      if (!canPlay(hand, card, s.trick)) return '처음 나온 색을 따라야 해요.';
      if (card.kind === 'tigress' && action.as !== 'knight' && action.as !== 'escape') return '변신 카드를 기사로 낼지 도망으로 낼지 골라주세요.';
      play(s, ctx, playerId, card, action.as);
      return;
    }
    return '알 수 없는 행동이에요.';
  },
  view(s, playerId) {
    const hand = s.hands[playerId] ?? [];
    const myTurn = s.phase === 'play' && s.players[s.turn]?.id === playerId;
    const allBid = s.players.every((p) => s.bids[p.id] != null);
    return {
      round: s.round, rounds: ROUNDS, phase: s.phase, deadline: s.deadline,
      hand: [...hand].sort(sortCards),
      playable: myTurn ? hand.filter((c) => canPlay(hand, c, s.trick)).map((c) => c.id) : [],
      myTurn,
      turn: s.players[s.turn]?.id ?? null,
      leader: s.players[s.leader]?.id ?? null,
      myBid: s.bids[playerId] ?? null,
      bids: allBid ? s.bids : Object.fromEntries(s.players.map((p) => [p.id, s.bids[p.id] != null ? -1 : null])),
      won: s.won,
      trick: s.phase === 'trickEnd' ? s.lastTrick?.cards ?? [] : s.trick,
      lastTrick: s.lastTrick,
      led: ledSuit(s.trick),
      scores: s.scores,
      last: s.history.at(-1) ?? null,
    };
  },
};

const ORDER: Record<string, number> = { escape: 0, green: 1, yellow: 2, purple: 3, black: 4, dancer: 5, knight: 6, tigress: 7, captain: 8 };
function sortCards(a: Card, b: Card) {
  const ka = ORDER[a.kind === 'num' ? a.suit! : a.kind], kb = ORDER[b.kind === 'num' ? b.suit! : b.kind];
  return ka - kb || (a.n ?? 0) - (b.n ?? 0);
}
