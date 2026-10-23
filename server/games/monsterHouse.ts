// 몬스터 하우스: 여섯 방(3열 2줄)의 소란을 줄이는 카드 게임 (보드게임 「페이퍼 사파리」에서 영감)
import type { GameModule, GamePlayer, GameContext } from './types';

export const WINS_TO_WIN = 3;
export const FLIP_MS = 25_000;
export const TURN_MS = 45_000;
export const ROUND_PAUSE_MS = 7_000;

/** 일반 카드는 숫자, 특수 카드: spin = 빙글이(10), eye = 눈큰이(10), copy = 흉내쟁이 */
export type Kind = 'num' | 'spin' | 'eye' | 'copy';
export interface MCard { id: number; kind: Kind; n: number } // copy의 n은 계산 때 정해짐
interface Slot { card: MCard; up: boolean }

/** 56장: -2×2, -1×4, 0~9×4, 빙글이×3, 눈큰이×3, 흉내쟁이×4 */
export function makeDeck(): MCard[] {
  const deck: MCard[] = [];
  let id = 0;
  const add = (kind: Kind, n: number, count: number) => { for (let i = 0; i < count; i++) deck.push({ id: id++, kind, n }); };
  add('num', -2, 2); add('num', -1, 4);
  for (let n = 0; n <= 9; n++) add('num', n, 4);
  add('spin', 10, 3); add('eye', 10, 3); add('copy', 0, 4);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// 자리 번호: 0 1 2 (윗줄) / 3 4 5 (아랫줄). 세로 짝 = (0,3) (1,4) (2,5), 가로 옆 = 같은 줄 양옆
const COLS = [[0, 3], [1, 4], [2, 5]];
const NEIGHBORS: Record<number, number[]> = { 0: [1], 1: [0, 2], 2: [1], 3: [4], 4: [3, 5], 5: [4] };

/** 6장의 소란 점수: 세로 짝이 같은 숫자면 그 줄은 0점. 흉내쟁이는 가장 유리한 옆 숫자를 복사 */
export function scoreGrid(cards: MCard[]) {
  const base = cards.map((c) => (c.kind === 'copy' ? null : c.n));
  const copies = cards.map((c, i) => (c.kind === 'copy' ? i : -1)).filter((i) => i >= 0);
  const optionsFor = (i: number) => {
    const opts = NEIGHBORS[i].map((j) => base[j]).filter((v): v is number => v != null);
    return opts.length ? opts : [0];
  };
  let best = { total: Infinity, values: [] as number[] };
  const tryAll = (k: number, vals: (number | null)[]) => {
    if (k === copies.length) {
      const v = vals as number[];
      let total = 0;
      for (const [a, b] of COLS) total += v[a] === v[b] ? 0 : v[a] + v[b];
      if (total < best.total) best = { total, values: [...v] };
      return;
    }
    for (const o of optionsFor(copies[k])) { const next = [...vals]; next[copies[k]] = o; tryAll(k + 1, next); }
  };
  tryAll(0, base);
  return best;
}

/** 동점 비교: 큰 숫자부터 비교해서 더 높은 카드를 가진 쪽이 앞 (기존 규칙) */
export function tieBreak(a: number[], b: number[]) {
  const sa = [...a].sort((x, y) => y - x), sb = [...b].sort((x, y) => y - x);
  for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sb[i] - sa[i]; // 음수면 a가 앞
  return 0;
}

export interface MonsterState {
  players: GamePlayer[];
  round: number;
  phase: 'flip' | 'turn' | 'peek' | 'roundEnd' | 'end';
  deadline: number;
  deck: MCard[];
  discard: MCard[];
  grids: Record<string, Slot[]>;
  known: Record<string, number[]>; // 눈큰이로 몰래 본 내 자리
  turn: number;
  turnNo: number;
  drawn: { card: MCard; from: 'deck' | 'discard' } | null;
  wins: Record<string, number>;
  lastRound: { scores: Record<string, number>; values: Record<string, number[]>; winners: string[]; closer: string } | null;
  log: string[];
  closer: string | null;
}

const name = (s: MonsterState, id: string) => s.players.find((p) => p.id === id)?.nickname ?? '?';
const say = (s: MonsterState, text: string) => { s.log.push(text); if (s.log.length > 6) s.log.shift(); };

function drawFromDeck(s: MonsterState) {
  if (!s.deck.length) {
    const top = s.discard.pop()!;
    s.deck = s.discard.sort(() => Math.random() - 0.5);
    s.discard = top ? [top] : [];
  }
  return s.deck.shift()!;
}

function startRound(s: MonsterState, ctx: GameContext) {
  s.round += 1;
  s.deck = makeDeck();
  s.grids = Object.fromEntries(s.players.map((p) => [p.id, s.deck.splice(0, 6).map((card) => ({ card, up: false }))]));
  s.known = Object.fromEntries(s.players.map((p) => [p.id, []]));
  s.discard = [s.deck.shift()!];
  s.drawn = null;
  s.closer = null;
  s.log = [];
  s.phase = 'flip';
  s.deadline = ctx.now() + FLIP_MS;
  for (const p of s.players.filter((x) => x.isBot)) ctx.setTimer(600 + Math.random() * 2000, () => { if (s.phase === 'flip') { flip(s, p.id, Math.floor(Math.random() * 6)); afterFlip(s, ctx); ctx.update(); } });
  ctx.setTimer(FLIP_MS, () => {
    if (s.phase !== 'flip') return;
    for (const p of s.players) if (!s.grids[p.id].some((x) => x.up)) flip(s, p.id, Math.floor(Math.random() * 6));
    afterFlip(s, ctx); ctx.update();
  });
}

function flip(s: MonsterState, id: string, pos: number) {
  if (s.grids[id].some((x) => x.up)) return;
  s.grids[id][pos].up = true;
}

function afterFlip(s: MonsterState, ctx: GameContext) {
  if (s.players.some((p) => !s.grids[p.id].some((x) => x.up))) return;
  ctx.clearTimers();
  s.turn = (s.round - 1) % s.players.length;
  s.phase = 'turn';
  startTurn(s, ctx);
}

function startTurn(s: MonsterState, ctx: GameContext) {
  s.drawn = null;
  s.phase = 'turn';
  s.deadline = ctx.now() + TURN_MS;
  s.turnNo += 1;
  const p = s.players[s.turn];
  const turnNo = s.turnNo;
  ctx.setTimer(p.isBot ? 1200 + Math.random() * 1200 : TURN_MS, () => {
    if (s.phase !== 'turn' || s.turnNo !== turnNo) return;
    // 시간 초과(또는 AI 차례): 가져온 카드를 되돌리고 자동으로 진행
    if (s.drawn) {
      if (s.drawn.from === 'discard') s.discard.push(s.drawn.card); else s.deck.unshift(s.drawn.card);
      s.drawn = null;
    }
    botTurn(s, ctx, p.id);
    ctx.update();
  });
}

/** 카드를 자리에 놓고, 원래 카드는 버림. 특수 효과 처리 */
function place(s: MonsterState, ctx: GameContext, id: string, card: MCard, pos: number) {
  const grid = s.grids[id];
  const old = grid[pos].card;
  grid[pos] = { card, up: true };
  s.known[id] = s.known[id].filter((k) => k !== pos);
  if (card.kind === 'spin') {
    // 빙글이: 같은 자리 카드를 다음 사람에게 차례로 넘기고, 마지막 카드는 버린 더미 맨 아래로
    let carry = old;
    const n = s.players.length;
    for (let step = 1; step < n; step++) {
      const target = s.players[(s.players.findIndex((p) => p.id === id) + step) % n].id;
      const prev = s.grids[target][pos].card;
      s.grids[target][pos] = { card: carry, up: true };
      s.known[target] = s.known[target].filter((k) => k !== pos);
      carry = prev;
    }
    s.discard.unshift(carry);
    say(s, `${name(s, id)} 님이 빙글이를 놓아 ${pos + 1}번 방 카드들이 옆으로 돌았어요`);
  } else {
    s.discard.push(old);
    say(s, `${name(s, id)} 님이 ${pos + 1}번 방을 바꿨어요`);
  }
  if (card.kind === 'eye' && grid.some((x) => !x.up)) {
    s.phase = 'peek';
    s.deadline = ctx.now() + 20_000;
    ctx.clearTimers();
    const p = s.players[s.turn];
    ctx.setTimer(p.isBot ? 800 : 20_000, () => { if (s.phase === 'peek') { const hid = grid.findIndex((x) => !x.up); if (hid >= 0) s.known[id].push(hid); endTurn(s, ctx); ctx.update(); } });
    return;
  }
  endTurn(s, ctx);
}

function endTurn(s: MonsterState, ctx: GameContext) {
  ctx.clearTimers();
  s.drawn = null;
  const closer = s.players.find((p) => s.grids[p.id].every((x) => x.up));
  if (closer) return endRound(s, ctx, closer.id);
  s.turn = (s.turn + 1) % s.players.length;
  startTurn(s, ctx);
}

function endRound(s: MonsterState, ctx: GameContext, closer: string) {
  s.closer = closer;
  for (const p of s.players) for (const x of s.grids[p.id]) x.up = true;
  const scores: Record<string, number> = {}, values: Record<string, number[]> = {};
  for (const p of s.players) { const r = scoreGrid(s.grids[p.id].map((x) => x.card)); scores[p.id] = r.total; values[p.id] = r.values; }
  const ranked = [...s.players].sort((a, b) => scores[a.id] - scores[b.id] || tieBreak(values[a.id], values[b.id]));
  const top = ranked[0];
  const winners = ranked.filter((p) => scores[p.id] === scores[top.id] && tieBreak(values[p.id], values[top.id]) === 0).map((p) => p.id);
  for (const w of winners) s.wins[w] += 1;
  s.lastRound = { scores, values, winners, closer };
  s.phase = 'roundEnd';
  s.deadline = ctx.now() + ROUND_PAUSE_MS;
  ctx.setTimer(ROUND_PAUSE_MS, () => {
    if (s.players.some((p) => s.wins[p.id] >= WINS_TO_WIN)) { s.phase = 'end'; ctx.finish(); }
    else startRound(s, ctx);
    ctx.update();
  });
}

// ---------- AI ----------
function visibleValue(slot: Slot) { return slot.card.kind === 'copy' ? 3 : slot.card.n; }

export function botTurn(s: MonsterState, ctx: GameContext, id: string) {
  const grid = s.grids[id];
  const top = s.discard[s.discard.length - 1];
  const worstUp = grid.map((x, i) => ({ x, i })).filter(({ x }) => x.up).sort((a, b) => visibleValue(b.x) - visibleValue(a.x))[0];
  const hidden = grid.map((x, i) => ({ x, i })).filter(({ x }) => !x.up);
  // 버린 카드가 작으면 가져와서 가장 큰 공개 카드나 숨은 카드와 교체
  if (top && top.kind === 'num' && top.n <= 2) {
    const pos = worstUp && visibleValue(worstUp.x) > top.n ? worstUp.i : hidden[0]?.i ?? worstUp.i;
    s.discard.pop();
    return place(s, ctx, id, top, pos);
  }
  const card = drawFromDeck(s);
  if (card.kind === 'spin') return place(s, ctx, id, card, worstUp?.i ?? 0);
  const val = card.kind === 'copy' ? 3 : card.n;
  if (worstUp && visibleValue(worstUp.x) > val + 1) return place(s, ctx, id, card, worstUp.i);
  if (hidden.length && val <= 4) return place(s, ctx, id, card, hidden[0].i);
  // 버리고 숨은 카드 하나 뒤집기
  s.discard.push(card);
  if (hidden.length) grid[hidden[0].i].up = true;
  say(s, `${name(s, id)} 님이 카드를 버렸어요`);
  endTurn(s, ctx);
}

export const monsterHouse: GameModule<MonsterState> = {
  id: 'monster-house',
  create(players, ctx) {
    const s: MonsterState = {
      players, round: 0, phase: 'flip', deadline: 0, deck: [], discard: [], grids: {}, known: {},
      turn: 0, turnNo: 0, drawn: null, wins: Object.fromEntries(players.map((p) => [p.id, 0])), lastRound: null, log: [], closer: null,
    };
    startRound(s, ctx);
    return s;
  },
  onAction(s, playerId, a, ctx) {
    const grid = s.grids[playerId];
    if (!grid) return '이 게임의 참가자가 아니에요.';
    const pos = Number(a?.pos);
    const validPos = Number.isInteger(pos) && pos >= 0 && pos < 6;
    switch (a?.type) {
      case 'flip':
        if (s.phase !== 'flip') return '지금은 뒤집을 수 없어요.';
        if (!validPos) return '뒤집을 카드를 골라주세요.';
        if (grid.some((x) => x.up)) return '이미 한 장 뒤집었어요.';
        flip(s, playerId, pos); afterFlip(s, ctx); return;
      case 'peek':
        if (s.phase !== 'peek' || s.players[s.turn].id !== playerId) return '지금은 엿볼 수 없어요.';
        if (!validPos || grid[pos].up) return '숨은 카드를 골라주세요.';
        s.known[playerId].push(pos); endTurn(s, ctx); return;
    }
    if (s.phase !== 'turn' || s.players[s.turn].id !== playerId) return '내 차례가 아니에요.';
    switch (a?.type) {
      case 'draw': {
        if (s.drawn) return '이미 카드를 가져왔어요.';
        if (a.from === 'discard') {
          if (!s.discard.length) return '버린 카드가 없어요.';
          s.drawn = { card: s.discard.pop()!, from: 'discard' };
        } else s.drawn = { card: drawFromDeck(s), from: 'deck' };
        return;
      }
      case 'place': {
        if (!s.drawn) return '먼저 카드를 가져오세요.';
        if (!validPos) return '바꿀 자리를 골라주세요.';
        const card = s.drawn.card; s.drawn = null;
        place(s, ctx, playerId, card, pos); return;
      }
      case 'discard': {
        if (!s.drawn) return '먼저 카드를 가져오세요.';
        if (s.drawn.from === 'discard') return '버린 더미에서 가져온 카드는 꼭 교체해야 해요.';
        if (s.drawn.card.kind === 'spin') return '빙글이는 반드시 놓아야 해요.';
        const hiddenLeft = grid.some((x) => !x.up);
        if (hiddenLeft && (!validPos || grid[pos].up)) return '버리는 대신 숨은 카드 하나를 뒤집어 주세요.';
        s.discard.push(s.drawn.card); s.drawn = null;
        if (hiddenLeft) grid[pos].up = true;
        say(s, `${name(s, playerId)} 님이 카드를 버리고 한 장을 뒤집었어요`);
        endTurn(s, ctx); return;
      }
    }
    return '알 수 없는 행동이에요.';
  },
  view(s, playerId) {
    const show = (owner: string) => s.grids[owner]?.map((x, i) => (
      x.up || s.phase === 'roundEnd' || s.phase === 'end' || (owner === playerId && s.known[owner].includes(i)) ? { ...x.card, up: x.up, peeked: !x.up } : null
    ));
    const me = s.players[s.turn]?.id === playerId;
    return {
      round: s.round, phase: s.phase, deadline: s.deadline, winsToWin: WINS_TO_WIN,
      turn: s.players[s.turn]?.id ?? null, myTurn: me && (s.phase === 'turn' || s.phase === 'peek'),
      grids: Object.fromEntries(s.players.map((p) => [p.id, show(p.id)])),
      discardTop: s.discard[s.discard.length - 1] ?? null,
      deckLeft: s.deck.length,
      drawn: me ? s.drawn : s.drawn ? { from: s.drawn.from, card: s.drawn.from === 'discard' ? s.drawn.card : null } : null,
      flipped: Object.fromEntries(s.players.map((p) => [p.id, s.grids[p.id]?.some((x) => x.up) ?? false])),
      wins: s.wins,
      lastRound: s.phase === 'roundEnd' || s.phase === 'end' ? s.lastRound : null,
      log: s.log,
    };
  },
};
