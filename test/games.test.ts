// 게임 규칙 단위 테스트 (서버 없이 실행): npx tsx test/games.test.ts
import assert from 'node:assert/strict';
import type { GameContext, GamePlayer } from '../server/games/types';
import { secretNumber, playCard, type SecretNumberState } from '../server/games/secretNumber';
import { sameMind, roundPoints, type SameMindState } from '../server/games/sameMind';
import { wordBomb, type WordBombState } from '../server/games/wordBomb';
import { treasureBid, resolvePicks, scoreOf, type TreasureState } from '../server/games/treasureBid';
import { raceBet, ranking, settle, type RaceState, type Bet } from '../server/games/raceBet';
import { drawRelay, bookFor, type DrawRelayState } from '../server/games/drawRelay';
import { fakeArtist, mostVoted, type FakeArtistState } from '../server/games/fakeArtist';

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


// ---------- 보물 눈치싸움 ----------
{
  const gem = (value: number, g: any = null) => ({ value, gem: g });
  // 보물: 겹치지 않은 가장 큰 수 / 함정: 겹치지 않은 가장 작은 수
  assert.equal(resolvePicks({ a: 15, b: 15, c: 3 }, [gem(5)]), 'c');
  assert.equal(resolvePicks({ a: 15, b: 2, c: 9 }, [gem(-3)]), 'b');
  assert.equal(resolvePicks({ a: 4, b: 4 }, [gem(2)]), null);
  assert.deepEqual(scoreOf([gem(1, 'ruby'), gem(2, 'sapphire'), gem(3, 'emerald'), gem(-2)]), { sum: 4, sets: 1, total: 9 });
  const f = fakeCtx();
  const s = treasureBid.create([...players(2), { id: 'bot_x', nickname: 'B', isBot: true }], f.ctx) as TreasureState;
  assert.equal(s.pot.length, 1);
  assert.ok(treasureBid.onAction(s, 'p0', { type: 'pick', number: 16 }, f.ctx));
  treasureBid.onAction(s, 'p0', { type: 'pick', number: 7 }, f.ctx);
  treasureBid.onAction(s, 'p1', { type: 'pick', number: 7 }, f.ctx);
  f.advance(8000); // AI 선택 → 공개
  assert.equal(s.phase, 'reveal');
  assert.ok(!s.hands.p0.includes(7));
  // 다 겹친 경우 보물이 쌓임
  f.advance(4500);
  s.picks = { p0: null, p1: null, bot_x: 1 } as any;
  treasureBid.onAction(s, 'p0', { type: 'pick', number: 1 }, f.ctx);
  treasureBid.onAction(s, 'p1', { type: 'pick', number: 1 }, f.ctx);
  assert.equal(s.last?.carried, true);
  f.advance(4500);
  assert.equal(s.pot.length, 2);
  // 시간 초과: 가장 작은 카드 자동 제출, 15라운드 후 끝
  for (let i = 0; i < 20; i++) f.advance(25_000);
  assert.equal(s.phase, 'end');
  assert.ok(Object.values(s.hands).every((h) => h.length === 0));
  console.log('✓ 보물 눈치싸움');
}

// ---------- 우당탕 레이스 ----------
{
  assert.deepEqual(ranking([10, 30, 30, 5]), [1, 2, 0, 3]);
  assert.deepEqual(ranking([100, 100, 50], [1, 0]), [1, 0, 2]);
  const order = [2, 0, 1, 3, 4, 5];
  const b = (x: Partial<Bet>): Bet => ({ by: 'p0', chip: 3, kind: 'win', runner: 2, early: true, ...x });
  assert.equal(settle(b({}), order), 15);
  assert.equal(settle(b({ early: false }), order), 9);
  assert.equal(settle(b({ runner: 0 }), order), -3);
  assert.equal(settle(b({ kind: 'top3', runner: 1 }), order), 6);
  assert.equal(settle(b({ kind: 'h2h', runner: 0, rival: 1, early: false }), order), 3);
  assert.equal(settle(b({ kind: 'h2h', runner: 3, rival: 1 }), order), -3);
  const f = fakeCtx();
  const s = raceBet.create([...players(2), { id: 'bot_y', nickname: 'B', isBot: true }], f.ctx) as RaceState;
  assert.equal(s.phase, 'ready');
  assert.equal(raceBet.onAction(s, 'p0', { type: 'bet', chip: 5, kind: 'win', runner: 0 }, f.ctx), undefined); // 준비 중 베팅 가능 (일찍 = 5배)
  assert.ok(raceBet.onAction(s, 'p0', { type: 'bet', chip: 5, kind: 'top3', runner: 1 }, f.ctx)); // 같은 칩 두 번 불가
  assert.ok(raceBet.onAction(s, 'p0', { type: 'bet', chip: 4, kind: 'h2h', runner: 1, rival: 1 }, f.ctx));
  f.advance(5000 + 41_000);
  assert.ok(raceBet.onAction(s, 'p1', { type: 'bet', chip: 1, kind: 'win', runner: 0 }, f.ctx)); // 마감
  f.advance(20_000);
  assert.equal(s.phase, 'result');
  assert.ok(s.pos.some((d) => d > 50));
  assert.equal(s.bets.find((x) => x.by === 'p0')?.early, true);
  assert.ok(s.bets.some((x) => x.by === 'bot_y'));
  for (let i = 0; i < 4; i++) f.advance(80_000);
  assert.equal(s.phase, 'end');
  console.log('✓ 우당탕 레이스');
}

// ---------- 그림 릴레이 ----------
{
  const f = fakeCtx();
  const s = drawRelay.create(players(3), f.ctx) as DrawRelayState;
  assert.deepEqual([0, 1, 2].map((i) => bookFor(s, i)), [0, 1, 2]);
  for (const id of ['p0', 'p1', 'p2']) drawRelay.onAction(s, id, { type: 'submit', text: `${id}의 문장` }, f.ctx);
  assert.equal(s.step, 1);
  assert.deepEqual([0, 1, 2].map((i) => bookFor(s, i)), [2, 0, 1]); // 옆 사람 책을 받음
  const v1 = drawRelay.view(s, 'p1') as any;
  assert.equal(v1.task, 'draw');
  assert.equal(v1.prompt.text, 'p0의 문장');
  assert.equal(v1.books.length, 0); // 공개 전엔 책 안 보임
  drawRelay.onAction(s, 'p1', { type: 'submit', drawing: [{ c: 0, w: 1, p: [0, 0, 500, 500, 9999, -5] }, { c: 99, w: 0, p: [1, 2] }] }, f.ctx);
  assert.deepEqual((s.books[0][1] as any).drawing, [{ c: 0, w: 1, p: [0, 0, 500, 500, 1000, 0] }]); // 잘못된 값 정리
  f.advance(95_000); // 나머지 시간 초과 → 빈 그림
  assert.equal(s.step, 2);
  f.advance(50_000);
  assert.equal(s.phase, 'reveal');
  assert.ok(s.books.every((b) => b.length === 3));
  drawRelay.onAction(s, 'p2', { type: 'next', book: 0 }, f.ctx);
  drawRelay.onAction(s, 'p0', { type: 'next', book: 0 }, f.ctx); // 중복 눌림 무시
  assert.equal(s.revealBook, 1);
  drawRelay.onAction(s, 'p0', { type: 'next', book: 1 }, f.ctx);
  drawRelay.onAction(s, 'p0', { type: 'next', book: 2 }, f.ctx);
  assert.equal(s.phase, 'end');
  console.log('✓ 그림 릴레이');
}

// ---------- 가짜 화가 ----------
{
  assert.equal(mostVoted({ a: 'x', b: 'x', c: 'y' }), 'x');
  assert.equal(mostVoted({ a: 'x', b: 'y' }), null);
  const f = fakeCtx();
  const s = fakeArtist.create(players(4), f.ctx) as FakeArtistState;
  assert.notEqual(s.asker, s.fake);
  const fakeView = fakeArtist.view(s, s.fake) as any;
  assert.equal(fakeView.role, 'fake');
  fakeArtist.onAction(s, s.asker, { type: 'topic', category: '동물', word: '기린' }, f.ctx);
  assert.equal((fakeArtist.view(s, s.fake) as any).word, null); // 가짜는 제시어 모름
  assert.equal((fakeArtist.view(s, s.asker) as any).word, '기린');
  assert.equal((fakeArtist.view(s, s.fake) as any).category, '동물');
  // 차례가 아니면 못 그림, 시간 초과면 건너뜀
  const notTurn = s.order.find((id) => id !== s.order[0])!;
  assert.ok(fakeArtist.onAction(s, notTurn, { type: 'stroke', stroke: { c: 0, w: 1, p: [1, 1, 2, 2] } }, f.ctx));
  fakeArtist.onAction(s, s.order[0], { type: 'stroke', stroke: { c: 0, w: 1, p: [1, 1, 2, 2] } }, f.ctx);
  f.advance(30_000);
  assert.equal(s.turn, 2);
  for (let i = 2; i < 8; i++) fakeArtist.onAction(s, s.order[i % 4], { type: 'stroke', stroke: { c: 1, w: 0, p: [5, 5, 9, 9] } }, f.ctx);
  assert.equal(s.phase, 'vote');
  assert.ok(fakeArtist.onAction(s, s.fake, { type: 'vote', target: s.asker }, f.ctx));
  const innocent = s.players.find((p) => p.id !== s.fake && p.id !== s.asker)!.id;
  for (const p of s.players) fakeArtist.onAction(s, p.id, { type: 'vote', target: p.id === s.fake ? innocent : s.fake }, f.ctx);
  assert.equal(s.phase, 'guess');
  fakeArtist.onAction(s, s.fake, { type: 'guess', guess: ' 기 린' }, f.ctx);
  assert.equal(s.winner, 'fake');
  // 엉뚱한 사람 지목 → 가짜 승리
  const g = fakeCtx();
  const t = fakeArtist.create(players(4), g.ctx) as FakeArtistState;
  g.advance(60_000); // 출제 시간 초과 → 자동 주제
  assert.equal(t.phase, 'draw');
  for (let i = 0; i < 8; i++) g.advance(30_000);
  assert.equal(t.phase, 'vote');
  const wrong = t.players.find((p) => p.id !== t.fake && p.id !== t.asker)!.id;
  for (const p of t.players) fakeArtist.onAction(t, p.id, { type: 'vote', target: p.id === wrong ? t.fake : wrong }, g.ctx);
  assert.equal(t.winner, 'fake');
  console.log('✓ 가짜 화가');
}

console.log('\n게임 규칙 테스트 통과');
