// 마음 일치: 같은 답을 쓴 사람 수만큼 점수
import type { GameModule, GamePlayer, GameContext } from './types';
import { MIND_TOPICS, pick } from './topics';

export const TOPIC_MS = 45_000;
export const ANSWER_MS = 20_000;
export const REVIEW_MS = 40_000;
export const VOTE_MS = 12_000;
const MAX_LEN = 20;

type Phase = 'topic' | 'answer' | 'review' | 'end';

export interface SameMindState {
  players: GamePlayer[];
  round: number; // 0부터, 출제자 순서
  rounds: number;
  phase: Phase;
  deadline: number;
  topic: string;
  answers: Record<string, string>;
  /** 묶음: 대표 키 -> 같은 답으로 치는 원래 키들 */
  merges: Record<string, string>;
  proposal: { by: string; from: string; into: string; votes: Record<string, boolean>; deadline: number } | null;
  scores: Record<string, number>;
  lastRoundPoints: Record<string, number> | null;
  pickedTopics: string[];
}

export const normalizeAnswer = (s: string) => s.replace(/\s+/g, '').toLowerCase();

const asker = (s: SameMindState) => s.players[s.round % s.players.length];

/** 대표 키 찾기 (묶음을 따라감) */
function root(s: SameMindState, key: string): string {
  let k = key;
  for (let i = 0; i < 20 && s.merges[k]; i++) k = s.merges[k];
  return k;
}

/** 답 묶음: 대표 키 -> 플레이어 id 목록 */
export function groupsOf(s: SameMindState) {
  const groups: Record<string, string[]> = {};
  for (const [id, a] of Object.entries(s.answers)) {
    const n = normalizeAnswer(a);
    if (!n) continue;
    const r = root(s, n);
    (groups[r] ??= []).push(id);
  }
  return groups;
}

export function roundPoints(s: SameMindState) {
  const pts: Record<string, number> = Object.fromEntries(s.players.map((p) => [p.id, 0]));
  for (const ids of Object.values(groupsOf(s))) for (const id of ids) pts[id] = ids.length - 1;
  return pts;
}

function startTopic(s: SameMindState, ctx: GameContext) {
  s.phase = 'topic';
  s.topic = '';
  s.answers = {};
  s.merges = {};
  s.proposal = null;
  s.deadline = ctx.now() + TOPIC_MS;
  ctx.setTimer(TOPIC_MS, () => {
    if (s.phase === 'topic') { setTopic(s, randomTopic(s), ctx); ctx.update(); }
  });
}

function randomTopic(s: SameMindState) {
  const left = MIND_TOPICS.filter((t) => !s.pickedTopics.includes(t));
  return pick(left.length ? left : MIND_TOPICS);
}

function setTopic(s: SameMindState, topic: string, ctx: GameContext) {
  ctx.clearTimers();
  s.topic = topic;
  s.pickedTopics.push(topic);
  s.phase = 'answer';
  s.deadline = ctx.now() + ANSWER_MS;
  ctx.setTimer(ANSWER_MS, () => { if (s.phase === 'answer') { toReview(s, ctx); ctx.update(); } });
}

function toReview(s: SameMindState, ctx: GameContext) {
  ctx.clearTimers();
  s.phase = 'review';
  s.deadline = ctx.now() + REVIEW_MS;
  ctx.setTimer(REVIEW_MS, () => { if (s.phase === 'review') { endRound(s, ctx); ctx.update(); } });
}

function endRound(s: SameMindState, ctx: GameContext) {
  ctx.clearTimers();
  const pts = roundPoints(s);
  for (const [id, n] of Object.entries(pts)) s.scores[id] += n;
  s.lastRoundPoints = pts;
  s.proposal = null;
  s.round += 1;
  if (s.round >= s.rounds) { s.phase = 'end'; ctx.finish(); return; }
  startTopic(s, ctx);
}

function resolveVote(s: SameMindState, ctx: GameContext) {
  const p = s.proposal;
  if (!p) return;
  const yes = Object.values(p.votes).filter(Boolean).length;
  if (yes * 2 > s.players.length) s.merges[p.from] = p.into;
  s.proposal = null;
  // 리뷰 시간 다시 걸기
  ctx.clearTimers();
  s.deadline = Math.max(s.deadline, ctx.now() + 10_000);
  ctx.setTimer(s.deadline - ctx.now(), () => { if (s.phase === 'review') { endRound(s, ctx); ctx.update(); } });
}

export const sameMind: GameModule<SameMindState> = {
  id: 'same-mind',
  create(players, ctx) {
    const s: SameMindState = {
      players, round: 0, rounds: players.length, phase: 'topic', deadline: 0, topic: '',
      answers: {}, merges: {}, proposal: null,
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
      lastRoundPoints: null, pickedTopics: [],
    };
    startTopic(s, ctx);
    return s;
  },
  onAction(s, playerId, action, ctx) {
    switch (action?.type) {
      case 'topic': {
        if (s.phase !== 'topic') return '지금은 주제를 정할 수 없어요.';
        if (asker(s).id !== playerId) return '이번 출제자만 주제를 정할 수 있어요.';
        const t = String(action.topic ?? '').trim().slice(0, 40) || randomTopic(s);
        setTopic(s, t, ctx);
        return;
      }
      case 'answer': {
        if (s.phase !== 'answer') return '지금은 답을 낼 수 없어요.';
        const a = String(action.answer ?? '').trim().slice(0, MAX_LEN);
        if (!a) return '답을 적어주세요.';
        s.answers[playerId] = a;
        if (s.players.every((p) => s.answers[p.id])) toReview(s, ctx);
        return;
      }
      case 'propose': {
        if (s.phase !== 'review') return '지금은 묶기를 요청할 수 없어요.';
        if (s.proposal) return '다른 묶기 투표가 진행 중이에요.';
        const groups = groupsOf(s);
        const from = root(s, String(action.from ?? '')), into = root(s, String(action.into ?? ''));
        if (!groups[from] || !groups[into] || from === into) return '묶을 두 답을 골라주세요.';
        s.proposal = { by: playerId, from, into, votes: { [playerId]: true }, deadline: ctx.now() + VOTE_MS };
        ctx.setTimer(VOTE_MS, () => { if (s.proposal) { resolveVote(s, ctx); ctx.update(); } });
        return;
      }
      case 'vote': {
        if (!s.proposal) return '진행 중인 투표가 없어요.';
        s.proposal.votes[playerId] = !!action.yes;
        const votes = Object.values(s.proposal.votes);
        const yes = votes.filter(Boolean).length, no = votes.length - yes;
        const half = s.players.length / 2;
        if (yes > half || no >= half || votes.length === s.players.length) resolveVote(s, ctx);
        return;
      }
      case 'confirm': {
        if (s.phase !== 'review') return '지금은 확정할 수 없어요.';
        if (asker(s).id !== playerId) return '출제자만 점수를 확정할 수 있어요.';
        if (s.proposal) return '묶기 투표가 끝난 뒤 확정할 수 있어요.';
        endRound(s, ctx);
        return;
      }
    }
    return '알 수 없는 행동이에요.';
  },
  view(s, playerId) {
    const showAll = s.phase === 'review' || s.phase === 'end';
    const groups = showAll ? groupsOf(s) : {};
    return {
      round: s.round + 1,
      rounds: s.rounds,
      phase: s.phase,
      deadline: s.deadline,
      asker: asker(s)?.id ?? null,
      topic: s.topic,
      suggestions: s.phase === 'topic' && asker(s).id === playerId
        ? [...MIND_TOPICS].sort(() => Math.random() - 0.5).slice(0, 3) : [],
      myAnswer: s.answers[playerId] ?? '',
      answered: Object.fromEntries(s.players.map((p) => [p.id, !!s.answers[p.id]])),
      groups: showAll
        ? Object.entries(groups).map(([key, ids]) => ({ key, label: s.answers[ids[0]], ids, labels: ids.map((id) => s.answers[id]) }))
          .sort((a, b) => b.ids.length - a.ids.length)
        : [],
      blank: showAll ? s.players.filter((p) => !normalizeAnswer(s.answers[p.id] ?? '')).map((p) => p.id) : [],
      proposal: s.proposal && { ...s.proposal, myVote: s.proposal.votes[playerId] },
      scores: s.scores,
      lastRoundPoints: s.lastRoundPoints,
    };
  },
};
