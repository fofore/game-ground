// 비밀 숫자 작전: 말하지 않고 작은 카드부터 함께 내는 협력 게임
import type { GameModule, GamePlayer, GameContext } from './types';

export const LEVELS = 5;
export const START_LIVES = 3;
const CLEAR_PAUSE_MS = 3_000;

export interface SecretNumberState {
  players: GamePlayer[];
  level: number;
  lives: number;
  phase: 'play' | 'clear' | 'won' | 'lost';
  hands: Record<string, number[]>;
  pile: { card: number; by: string }[];
  lastMistake: { card: number; by: string; discarded: { card: number; by: string }[] } | null;
}

function deal(s: SecretNumberState) {
  const deck = Array.from({ length: 100 }, (_, i) => i + 1);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  s.hands = Object.fromEntries(
    s.players.map((p) => [p.id, deck.splice(0, s.level).sort((a, b) => a - b)]),
  );
  s.pile = [];
  s.lastMistake = null;
  s.phase = 'play';
}

/** 카드를 냈을 때의 결과 (테스트용으로 분리) */
export function playCard(s: SecretNumberState, playerId: string) {
  const hand = s.hands[playerId];
  const card = hand.shift()!;
  s.pile.push({ card, by: playerId });
  const lower: { card: number; by: string }[] = [];
  for (const [id, h] of Object.entries(s.hands)) {
    while (h.length && h[0] < card) lower.push({ card: h.shift()!, by: id });
  }
  if (lower.length) {
    s.lives -= 1;
    s.lastMistake = { card, by: playerId, discarded: lower.sort((a, b) => a.card - b.card) };
  } else {
    s.lastMistake = null;
  }
  return { card, mistake: lower.length > 0 };
}

export const secretNumber: GameModule<SecretNumberState> = {
  id: 'secret-number',
  create(players, _ctx) {
    const s: SecretNumberState = {
      players, level: 1, lives: START_LIVES, phase: 'play', hands: {}, pile: [], lastMistake: null,
    };
    deal(s);
    return s;
  },
  onAction(s, playerId, action, ctx: GameContext) {
    if (action?.type !== 'play') return '알 수 없는 행동이에요.';
    if (s.phase !== 'play') return '지금은 카드를 낼 수 없어요.';
    if (!s.hands[playerId]?.length) return '낼 카드가 없어요.';
    playCard(s, playerId);

    if (s.lives <= 0) {
      s.phase = 'lost';
      ctx.finish();
      return;
    }
    if (Object.values(s.hands).every((h) => h.length === 0)) {
      if (s.level >= LEVELS) {
        s.phase = 'won';
        ctx.finish();
        return;
      }
      s.phase = 'clear';
      ctx.setTimer(CLEAR_PAUSE_MS, () => {
        s.level += 1;
        deal(s);
        ctx.update();
      });
    }
  },
  view(s, playerId) {
    return {
      level: s.level,
      levels: LEVELS,
      lives: s.lives,
      phase: s.phase,
      myHand: s.hands[playerId] ?? [],
      counts: Object.fromEntries(Object.entries(s.hands).map(([id, h]) => [id, h.length])),
      top: s.pile.at(-1) ?? null,
      played: s.pile.length,
      lastMistake: s.lastMistake,
    };
  },
};
