// 게임 규칙 단위 테스트 (서버 없이 실행): npx tsx test/games.test.ts
import assert from 'node:assert/strict';
import type { GameContext, GamePlayer } from '../server/games/types';
import { secretNumber, playCard, type SecretNumberState } from '../server/games/secretNumber';
import { sameMind, roundPoints, type SameMindState } from '../server/games/sameMind';
import { wordBomb, type WordBombState } from '../server/games/wordBomb';

/** 시간을 직접 돌릴 수 있는 가짜 게임 환경 */
function fakeCtx() {
  let now = 0, finished = false;
  let timers: { at: number; fn: () => void }[] = [];
  const ctx: GameContext = {
    update() {},
    setTimer(ms, fn) { timers.push({ at: now + ms, fn }); },
    clearTimers() { timers = []; },
    finish() { finished = true; },
    now: () => now,
  };
  return {
    ctx,
    get finished() { return finished; },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const t = timers[0];
        if (!t || t.at > end) break;
        timers.shift();
        now = t.at;
        t.fn();
      }
      now = end;
    },
  };
}
const players = (n: number): GamePlayer[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, nickname: `P${i}`, isBot: false }));

// ---------- 비밀 숫자 작전 ----------
{
  const f = fakeCtx();
  const s = secretNumber.create(players(3), f.ctx) as SecretNumberState;
  assert.equal(s.level, 1);
  assert.ok(Object.values(s.hands).every((h) => h.length === 1));
  // 실수: 더 큰 카드를 먼저 내면 생명 감소 + 작은 카드 버림
  s.hands = { p0: [50], p1: [10], p2: [70] };
  playCard(s, 'p0');
  assert.equal(s.lives, 2);
  assert.deepEqual(s.hands.p1, []);
  assert.equal(s.lastMistake?.discarded[0].card, 10);
  // 단계 클리어 → 다음 단계에 2장씩
  assert.equal(secretNumber.onAction(s, 'p2', { type: 'play' }, f.ctx), undefined);
  assert.equal(s.phase, 'clear');
  f.advance(3000);
  assert.equal(s.level, 2);
  assert.ok(Object.values(s.hands).every((h) => h.length === 2));
  // 다른 사람 카드는 화면에 보이지 않음
  const view = secretNumber.view(s, 'p0') as any;
  assert.equal(view.myHand.length, 2);
  assert.ok(!('hands' in view));
  // 생명이 0이 되면 실패
  s.lives = 1; s.hands = { p0: [90], p1: [5], p2: [] };
  secretNumber.onAction(s, 'p0', { type: 'play' }, f.ctx);
  assert.equal(s.phase, 'lost');
  assert.ok(f.finished);
  console.log('✓ 비밀 숫자 작전');
}

// ---------- 마음 일치 ----------
{
  const f = fakeCtx();
  const s = sameMind.create(players(4), f.ctx) as SameMindState;
  assert.equal(s.phase, 'topic');
  assert.ok(sameMind.onAction(s, 'p1', { type: 'topic', topic: 'x' }, f.ctx)); // 출제자 아님
  sameMind.onAction(s, 'p0', { type: 'topic', topic: '라면 재료' }, f.ctx);
  assert.equal(s.phase, 'answer');
  // 답 공개 전에는 남의 답이 안 보임
  sameMind.onAction(s, 'p0', { type: 'answer', answer: '계란' }, f.ctx);
  assert.equal((sameMind.view(s, 'p1') as any).groups.length, 0);
  sameMind.onAction(s, 'p1', { type: 'answer', answer: ' 계 란 ' }, f.ctx);
  sameMind.onAction(s, 'p2', { type: 'answer', answer: '달걀' }, f.ctx);
  sameMind.onAction(s, 'p3', { type: 'answer', answer: '파' }, f.ctx);
  assert.equal(s.phase, 'review');
  assert.deepEqual(roundPoints(s), { p0: 1, p1: 1, p2: 0, p3: 0 });
  // 달걀을 계란으로 묶기: 과반(3/4) 찬성
  sameMind.onAction(s, 'p2', { type: 'propose', from: '달걀', into: '계란' }, f.ctx);
  sameMind.onAction(s, 'p0', { type: 'vote', yes: true }, f.ctx);
  assert.ok(s.proposal); // 2/4는 과반 아님
  sameMind.onAction(s, 'p3', { type: 'vote', yes: true }, f.ctx);
  assert.equal(s.proposal, null);
  assert.deepEqual(roundPoints(s), { p0: 2, p1: 2, p2: 2, p3: 0 });
  sameMind.onAction(s, 'p0', { type: 'confirm' }, f.ctx);
  assert.equal(s.scores.p2, 2);
  assert.equal(s.phase, 'topic');
  assert.equal((sameMind.view(s, 'p1') as any).asker, 'p1');
  // 출제 시간 초과 → 주제 자동, 답 시간 초과 → 공개, 리뷰 시간 초과 → 다음 라운드
  f.advance(45_000); assert.equal(s.phase, 'answer'); assert.ok(s.topic);
  f.advance(20_000); assert.equal(s.phase, 'review');
  f.advance(40_000); assert.equal(s.round, 2);
  f.advance(45_000 + 20_000 + 40_000); f.advance(45_000 + 20_000 + 40_000);
  assert.equal(s.phase, 'end');
  assert.ok(f.finished);
  console.log('✓ 마음 일치');
}

// ---------- 폭탄 단어 ----------
{
  const f = fakeCtx();
  const s = wordBomb.create(players(3), f.ctx) as WordBombState;
  s.holder = 'p0';
  assert.ok(wordBomb.onAction(s, 'p1', { type: 'word', word: '사과' }, f.ctx)); // 차례 아님
  wordBomb.onAction(s, 'p0', { type: 'word', word: '사과' }, f.ctx);
  assert.equal(s.holder, 'p1');
  assert.ok(wordBomb.onAction(s, 'p1', { type: 'word', word: ' 사 과' }, f.ctx)); // 중복
  // 이의 제기 → 판정 중 폭탄 멈춤 → 불인정 과반이면 -1
  const fuseBefore = s.fuseLeft;
  f.advance(1000);
  assert.ok(wordBomb.onAction(s, 'p0', { type: 'challenge' }, f.ctx)); // 내 단어
  wordBomb.onAction(s, 'p2', { type: 'challenge' }, f.ctx);
  assert.equal(s.phase, 'judge');
  assert.ok(s.fuseLeft <= fuseBefore - 1000);
  const paused = s.fuseLeft;
  f.advance(3000);
  assert.equal(s.fuseLeft, paused); // 판정 중엔 그대로
  wordBomb.onAction(s, 'p1', { type: 'vote', ok: false }, f.ctx);
  assert.equal(s.phase, 'play');
  assert.equal(s.scores.p0, -1);
  assert.equal(s.words[0].status, 'rejected');
  // 5초 지난 단어에는 이의 제기 불가
  wordBomb.onAction(s, 'p1', { type: 'word', word: '바나나' }, f.ctx);
  f.advance(5_500);
  if (s.phase === 'play') assert.ok(wordBomb.onAction(s, 'p0', { type: 'challenge' }, f.ctx));
  // 폭탄이 터지면 든 사람 -1, 5라운드 후 끝
  const holder = s.holder;
  const before = s.scores[holder];
  f.advance(45_000);
  assert.ok(s.round >= 2 || s.phase === 'boom');
  assert.ok(s.scores[holder] <= before - 1 || s.exploded);
  for (let i = 0; i < 6; i++) f.advance(50_000);
  assert.equal(s.phase, 'end');
  assert.ok(f.finished);
  // 2명: 낸 사람이 유지/인정 결정
  const g = fakeCtx();
  const t = wordBomb.create(players(2), g.ctx) as WordBombState;
  t.holder = 'p0';
  wordBomb.onAction(t, 'p0', { type: 'word', word: '고양이' }, g.ctx);
  wordBomb.onAction(t, 'p1', { type: 'challenge' }, g.ctx);
  assert.ok(wordBomb.onAction(t, 'p1', { type: 'vote', ok: false }, g.ctx)); // 상대는 결정 못 함
  wordBomb.onAction(t, 'p0', { type: 'vote', ok: true }, g.ctx);
  assert.equal(t.words[0].status, 'ok');
  assert.equal(t.scores.p0, 0);
  console.log('✓ 폭탄 단어');
}

console.log('\n게임 규칙 테스트 통과');
