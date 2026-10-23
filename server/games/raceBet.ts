// 우당탕 레이스: 자동으로 달리는 경주에 칩을 거는 실시간 베팅 게임
import type { GameModule, GamePlayer, GameContext } from './types';

export const RUNNERS = 6;
export const RACES = 3;
export const READY_MS = 5_000;
export const RACE_MS = 60_000;
export const BET_CLOSE_MS = 40_000;
export const EARLY_MS = 20_000;
export const RESULT_MS = 8_000;
const TICK_MS = 500;
const TRACK = 100;
export const CHIPS = [1, 2, 3, 4, 5];

export type BetKind = 'win' | 'top3' | 'h2h';
export interface Bet {
  by: string; chip: number; kind: BetKind; runner: number; rival?: number; early: boolean;
  result?: 'won' | 'lost'; points?: number;
}

export interface RaceState {
  players: GamePlayer[];
  race: number;
  phase: 'ready' | 'run' | 'result' | 'end';
  startAt: number; // 경주 시작 시각
  pos: number[];
  finished: number[];
  speed: number[]; // 경주마다 다른 기본 속도
  bets: Bet[];
  scores: Record<string, number>;
  order: number[] | null; // 결과 순위 (선수 번호)
}

export const odds = (kind: BetKind, early: boolean) => (kind === 'win' ? (early ? 5 : 3) : early ? 2 : 1);

/** 순위: 결승선 통과 순서 먼저, 나머지는 거리 내림차순, 같으면 번호가 작은 쪽이 앞 */
export function ranking(pos: number[], finished: number[] = []) {
  const rest = pos.map((d, i) => ({ d, i })).filter((x) => !finished.includes(x.i))
    .sort((a, b) => b.d - a.d || a.i - b.i).map((x) => x.i);
  return [...finished, ...rest];
}

export function settle(bet: Bet, order: number[]) {
  const place = (r: number) => order.indexOf(r);
  const ok = bet.kind === 'win' ? place(bet.runner) === 0
    : bet.kind === 'top3' ? place(bet.runner) < 3
    : place(bet.runner) < place(bet.rival!);
  bet.result = ok ? 'won' : 'lost';
  bet.points = ok ? bet.chip * odds(bet.kind, bet.early) : -bet.chip;
  return bet.points;
}

function startRace(s: RaceState, ctx: GameContext) {
  s.race += 1;
  s.phase = 'ready';
  s.pos = Array(RUNNERS).fill(0);
  s.finished = [];
  // 평균적으로 60초에 결승선 근처에 닿도록, 선수마다 조금씩 다른 속도
  s.speed = Array.from({ length: RUNNERS }, () => 0.62 + Math.random() * 0.22);
  s.bets = [];
  s.order = null;
  s.startAt = ctx.now() + READY_MS;
  ctx.setTimer(READY_MS, () => { s.phase = 'run'; tick(s, ctx); scheduleBots(s, ctx); ctx.update(); });
}

function tick(s: RaceState, ctx: GameContext) {
  if (s.phase !== 'run') return;
  const t = ctx.now() - s.startAt;
  if (t >= RACE_MS) return finishRace(s, ctx);
  for (let i = 0; i < RUNNERS; i++) {
    // 가끔 넘어지거나(정지) 치고 나감(가속): 우당탕!
    const r = Math.random();
    const burst = r < 0.06 ? 0 : r > 0.94 ? 2.4 : 1;
    if (s.finished.includes(i)) continue;
    s.pos[i] = Math.min(TRACK, s.pos[i] + s.speed[i] * burst * (0.6 + Math.random() * 0.8));
    if (s.pos[i] >= TRACK) s.finished.push(i);
  }
  ctx.setTimer(TICK_MS, () => { tick(s, ctx); ctx.update(); });
}

function finishRace(s: RaceState, ctx: GameContext) {
  ctx.clearTimers();
  s.order = ranking(s.pos, s.finished);
  for (const b of s.bets) s.scores[b.by] += settle(b, s.order);
  s.phase = 'result';
  ctx.setTimer(RESULT_MS, () => {
    if (s.race >= RACES) { s.phase = 'end'; ctx.finish(); } else startRace(s, ctx);
    ctx.update();
  });
}

function placeBet(s: RaceState, ctx: GameContext, by: string, a: any): string | void {
  if (s.phase !== 'run' && s.phase !== 'ready') return '지금은 걸 수 없어요.';
  const t = ctx.now() - s.startAt;
  if (t > BET_CLOSE_MS) return '베팅이 마감됐어요.';
  const chip = Number(a.chip);
  if (!CHIPS.includes(chip)) return '칩을 골라주세요.';
  if (s.bets.some((b) => b.by === by && b.chip === chip)) return '이미 쓴 칩이에요.';
  const kind = a.kind as BetKind;
  if (!['win', 'top3', 'h2h'].includes(kind)) return '베팅 종류를 골라주세요.';
  const runner = Number(a.runner), rival = Number(a.rival);
  const valid = (n: number) => Number.isInteger(n) && n >= 0 && n < RUNNERS;
  if (!valid(runner)) return '선수를 골라주세요.';
  if (kind === 'h2h' && (!valid(rival) || rival === runner)) return '맞대결할 두 선수를 골라주세요.';
  s.bets.push({ by, chip, kind, runner, rival: kind === 'h2h' ? rival : undefined, early: t < EARLY_MS });
}

function scheduleBots(s: RaceState, ctx: GameContext) {
  for (const p of s.players.filter((x) => x.isBot)) {
    const chips = [...CHIPS].sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 3));
    for (const chip of chips) {
      ctx.setTimer(2000 + Math.random() * (BET_CLOSE_MS - 4000), () => {
        if (s.phase !== 'run') return;
        const order = ranking(s.pos, s.finished);
        const kind: BetKind = Math.random() < 0.4 ? 'win' : Math.random() < 0.6 ? 'top3' : 'h2h';
        const runner = order[Math.floor(Math.random() * (kind === 'win' ? 2 : 3))];
        const rival = order[3 + Math.floor(Math.random() * (RUNNERS - 3))];
        placeBet(s, ctx, p.id, { chip, kind, runner, rival });
        ctx.update();
      });
    }
  }
}

export const raceBet: GameModule<RaceState> = {
  id: 'race-bet',
  create(players, ctx) {
    const s: RaceState = {
      players, race: 0, phase: 'ready', startAt: 0, pos: [], finished: [], speed: [], bets: [],
      scores: Object.fromEntries(players.map((p) => [p.id, 0])), order: null,
    };
    startRace(s, ctx);
    return s;
  },
  onAction(s, playerId, action, ctx) {
    if (action?.type !== 'bet') return '알 수 없는 행동이에요.';
    return placeBet(s, ctx, playerId, action);
  },
  view(s, playerId) {
    return {
      race: s.race, races: RACES, phase: s.phase, startAt: s.startAt,
      raceMs: RACE_MS, closeMs: BET_CLOSE_MS, earlyMs: EARLY_MS,
      pos: s.pos.map((d) => Math.round(d * 10) / 10),
      finished: s.finished,
      myBets: s.bets.filter((b) => b.by === playerId),
      betCounts: Object.fromEntries(s.players.map((p) => [p.id, s.bets.filter((b) => b.by === p.id).length])),
      allBets: s.phase === 'result' || s.phase === 'end' ? s.bets : [],
      scores: s.scores,
      order: s.order,
    };
  },
};
