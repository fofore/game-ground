// 폭탄 단어: 주제에 맞는 단어를 대고 폭탄을 넘기기
import type { GameModule, GamePlayer, GameContext } from './types';
import { BOMB_TOPICS, pick } from './topics';

export const ROUNDS = 5;
export const FUSE_MIN_MS = 20_000;
export const FUSE_MAX_MS = 40_000;
export const CHALLENGE_MS = 5_000;
export const VOTE_MS = 5_000;
const BOOM_PAUSE_MS = 4_000;

interface Word { word: string; by: string; at: number; status: 'open' | 'ok' | 'rejected' }

export interface WordBombState {
  players: GamePlayer[];
  round: number;
  phase: 'play' | 'judge' | 'boom' | 'end';
  topic: string;
  holder: string;
  fuseLeft: number; // 남은 폭탄 시간 (판정 중엔 멈춤)
  fuseStartedAt: number;
  words: Word[];
  judge: { index: number; by: string; votes: Record<string, boolean>; deadline: number } | null;
  scores: Record<string, number>;
  exploded: { holder: string; round: number } | null;
  usedTopics: string[];
}

export const normalizeWord = (w: string) => w.replace(/\s+/g, '').toLowerCase();

const order = (s: WordBombState) => s.players.map((p) => p.id);
function nextAfter(s: WordBombState, id: string) {
  const ids = order(s);
  return ids[(ids.indexOf(id) + 1) % ids.length];
}

function armFuse(s: WordBombState, ctx: GameContext) {
  s.fuseStartedAt = ctx.now();
  ctx.setTimer(s.fuseLeft, () => { if (s.phase === 'play') { boom(s, ctx); ctx.update(); } });
}

function pauseFuse(s: WordBombState, ctx: GameContext) {
  s.fuseLeft = Math.max(0, s.fuseLeft - (ctx.now() - s.fuseStartedAt));
  ctx.clearTimers();
}

function startRound(s: WordBombState, ctx: GameContext, starter: string) {
  s.round += 1;
  s.phase = 'play';
  const left = BOMB_TOPICS.filter((t) => !s.usedTopics.includes(t));
  s.topic = pick(left.length ? left : BOMB_TOPICS);
  s.usedTopics.push(s.topic);
  s.holder = starter;
  s.words = [];
  s.judge = null;
  s.exploded = null;
  s.fuseLeft = FUSE_MIN_MS + Math.random() * (FUSE_MAX_MS - FUSE_MIN_MS);
  armFuse(s, ctx);
}

function boom(s: WordBombState, ctx: GameContext) {
  ctx.clearTimers();
  s.scores[s.holder] -= 1;
  s.exploded = { holder: s.holder, round: s.round };
  s.phase = 'boom';
  s.judge = null;
  const starter = s.holder;
  ctx.setTimer(BOOM_PAUSE_MS, () => {
    if (s.round >= ROUNDS) { s.phase = 'end'; ctx.finish(); }
    else startRound(s, ctx, starter);
    ctx.update();
  });
}

function finishJudge(s: WordBombState, ctx: GameContext, rejected: boolean) {
  const j = s.judge!;
  const w = s.words[j.index];
  w.status = rejected ? 'rejected' : 'ok';
  if (rejected) s.scores[w.by] -= 1;
  s.judge = null;
  s.phase = 'play';
  armFuse(s, ctx);
}

export const wordBomb: GameModule<WordBombState> = {
  id: 'word-bomb',
  create(players, ctx) {
    const s: WordBombState = {
      players, round: 0, phase: 'play', topic: '', holder: players[0].id, fuseLeft: 0, fuseStartedAt: 0,
      words: [], judge: null, scores: Object.fromEntries(players.map((p) => [p.id, 0])),
      exploded: null, usedTopics: [],
    };
    startRound(s, ctx, players[Math.floor(Math.random() * players.length)].id);
    return s;
  },
  onAction(s, playerId, action, ctx) {
    switch (action?.type) {
      case 'word': {
        if (s.phase !== 'play') return '지금은 단어를 낼 수 없어요.';
        if (s.holder !== playerId) return '폭탄을 든 사람만 단어를 낼 수 있어요.';
        const word = String(action.word ?? '').trim().slice(0, 20);
        if (!word) return '단어를 입력해주세요.';
        const n = normalizeWord(word);
        if (s.words.some((w) => w.status !== 'rejected' && normalizeWord(w.word) === n)) return '이미 나온 단어예요.';
        s.words.push({ word, by: playerId, at: ctx.now(), status: 'open' });
        s.holder = nextAfter(s, playerId);
        return;
      }
      case 'challenge': {
        if (s.phase !== 'play') return '지금은 이의를 제기할 수 없어요.';
        const index = s.words.length - 1;
        const w = s.words[index];
        if (!w || w.status !== 'open' || ctx.now() - w.at > CHALLENGE_MS) return '이의 제기 시간이 지났어요.';
        if (w.by === playerId) return '내 단어에는 이의를 제기할 수 없어요.';
        pauseFuse(s, ctx);
        s.phase = 'judge';
        s.judge = { index, by: playerId, votes: { [playerId]: false }, deadline: ctx.now() + VOTE_MS };
        if (s.players.length > 2) {
          ctx.setTimer(VOTE_MS, () => {
            if (s.phase !== 'judge' || !s.judge) return;
            const voters = s.players.filter((p) => p.id !== w.by).length;
            const rejects = Object.values(s.judge.votes).filter((v) => !v).length;
            finishJudge(s, ctx, rejects * 2 > voters);
            ctx.update();
          });
        } else {
          // 2명: 낸 사람이 10초 안에 정하지 않으면 유지
          ctx.setTimer(10_000, () => {
            if (s.phase === 'judge' && s.judge) { finishJudge(s, ctx, false); ctx.update(); }
          });
        }
        return;
      }
      case 'vote': {
        // ok: true = 인정, false = 불인정
        if (s.phase !== 'judge' || !s.judge) return '진행 중인 판정이 없어요.';
        const w = s.words[s.judge.index];
        if (s.players.length === 2) {
          // 2명일 때는 낸 사람이 유지(인정)하거나 철회(감점)
          if (w.by !== playerId) return '단어를 낸 사람이 결정해요.';
          finishJudge(s, ctx, !action.ok);
          return;
        }
        if (w.by === playerId) return '내 단어에는 투표할 수 없어요.';
        s.judge.votes[playerId] = !!action.ok;
        const voters = s.players.filter((p) => p.id !== w.by).length;
        const votes = Object.values(s.judge.votes);
        const rejects = votes.filter((v) => !v).length, accepts = votes.length - rejects;
        if (rejects * 2 > voters) finishJudge(s, ctx, true);
        else if (accepts * 2 >= voters || votes.length === voters) finishJudge(s, ctx, false);
        return;
      }
    }
    return '알 수 없는 행동이에요.';
  },
  view(s, _playerId) {
    const last = s.words.at(-1);
    return {
      round: s.round,
      rounds: ROUNDS,
      phase: s.phase,
      topic: s.topic,
      holder: s.holder,
      words: s.words.map((w) => ({ word: w.word, by: w.by, status: w.status })).slice(-30),
      challengeUntil: last && last.status === 'open' && s.phase === 'play' ? last.at + CHALLENGE_MS : 0,
      lastBy: last?.by ?? null,
      judge: s.judge && {
        word: s.words[s.judge.index].word, wordBy: s.words[s.judge.index].by,
        by: s.judge.by, votes: s.judge.votes, deadline: s.judge.deadline,
      },
      twoPlayers: s.players.length === 2,
      scores: s.scores,
      exploded: s.exploded,
    };
  },
};
