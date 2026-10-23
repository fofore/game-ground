// 서버 흐름 테스트: 방 만들기 → 참가 → 준비 → 시작 → 눈치 숫자 1라운드 → 재접속 → 혼자 하기
// 실행: 서버를 켠 뒤 `npm test` (기본 http://localhost:3001)
import { io, type Socket } from 'socket.io-client';
import assert from 'node:assert/strict';
import { judge } from '../server/games/lowestUnique';
import { searchGames } from '../shared/games';

const URL = process.env.TEST_URL ?? 'http://localhost:3001';
const token = () => crypto.randomUUID().replace(/-/g, '');
const connect = (t: string) => io(URL, { auth: { token: t }, transports: ['websocket'], forceNew: true });
const call = <T = any>(s: Socket, ev: string, data?: unknown) =>
  new Promise<T>((res) => s.emit(ev, data, res));
const next = <T = any>(s: Socket, ev: string, pred: (d: T) => boolean = () => true, ms = 15000) =>
  new Promise<T>((res, rej) => {
    const timer = setTimeout(() => rej(new Error(`timeout: ${ev}`)), ms);
    const h = (d: T) => { if (pred(d)) { clearTimeout(timer); s.off(ev, h); res(d); } };
    s.on(ev, h);
  });

async function main() {
  // 판정 규칙
  assert.deepEqual(judge({ a: 1, b: 1, c: 2 }), { winner: 'c', winningNumber: 2 });
  assert.deepEqual(judge({ a: 3, b: 3 }), { winner: null, winningNumber: null });
  assert.deepEqual(judge({ a: null, b: 5 }), { winner: 'b', winningNumber: 5 });
  // 원작 이름 검색
  assert.equal(searchGames('스컬킹')[0].id, 'storm-captain');
  assert.equal(searchGames('skull king')[0].id, 'storm-captain');
  assert.equal(searchGames('너도 나도')[0].id, 'same-mind');
  assert.ok(searchGames('그림').length >= 2);
  console.log('✓ 판정·검색');

  const hostToken = token(), guestToken = token();
  const host = connect(hostToken), guest = connect(guestToken);
  await Promise.all([next(host, 'hello'), next(guest, 'hello')]);

  // 비밀번호 방 만들기
  const created = await call(host, 'room:create', {
    gameId: 'lowest-unique', visibility: 'public', title: '테스트 방', password: '1234', maxPlayers: 4, nickname: '방장',
  });
  assert.ok(created.ok, created.error);
  const code = created.code;

  // 공개 방 목록에 보임
  const list = await new Promise<any[]>((res) => { guest.once('rooms:list', res); guest.emit('rooms:watch', true); });
  assert.ok(list.some((r) => r.code === code && r.hasPassword));
  console.log('✓ 방 만들기·공개 목록');

  // 비밀번호 확인
  let j = await call(guest, 'room:join', { code, nickname: '손님' });
  assert.equal(j.ok, false); assert.ok(j.needPassword);
  j = await call(guest, 'room:join', { code, nickname: '손님', password: '0000' });
  assert.equal(j.ok, false);
  j = await call(guest, 'room:join', { code: code.toLowerCase(), nickname: '손님', password: '1234' });
  assert.ok(j.ok, j.error);
  console.log('✓ 비밀번호 참가');

  // 준비 전에는 시작 불가
  let st = await call(host, 'room:start');
  assert.equal(st.ok, false);
  guest.emit('room:ready', true);
  await next(host, 'room:state', (v: any) => v.players.every((p: any) => p.ready));
  const playing = next(guest, 'room:state', (v: any) => v.status === 'playing');
  st = await call(host, 'room:start');
  assert.ok(st.ok, st.error);
  const v = await playing;
  assert.equal(v.game.round, 1);
  console.log('✓ 준비·시작');

  // 1라운드: 둘 다 3 → 승자 없음
  const revealed = next(host, 'room:state', (v: any) => v.game?.phase === 'reveal');
  assert.ok((await call(host, 'game:action', { type: 'pick', number: 3 })).ok);
  assert.equal((await call(host, 'game:action', { type: 'pick', number: 4 })).ok, false); // 두 번 못 고름
  assert.ok((await call(guest, 'game:action', { type: 'pick', number: 3 })).ok);
  const r1 = await revealed;
  assert.equal(r1.game.last.winner, null);
  console.log('✓ 1라운드 공개');

  // 재접속: 손님이 끊었다 다시 들어오면 같은 방 상태를 받음
  guest.disconnect();
  await next(host, 'room:state', (v: any) => v.players.some((p: any) => !p.connected));
  const guest2 = connect(guestToken);
  const hello = await next<any>(guest2, 'hello');
  assert.equal(hello.room?.code, code);
  console.log('✓ 재접속');

  // 게임 중 나가기: 자리는 남지만 나간 사람에게는 방 화면이 다시 오지 않음
  let leaked = false;
  guest2.on('room:state', () => { leaked = true; });
  const hostSawLeave = next(host, 'room:state', (v: any) => v.players.some((p: any) => !p.connected));
  assert.ok((await call(guest2, 'room:leave')).ok);
  await hostSawLeave;
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(leaked, false, '나간 사람에게 방 화면이 다시 옴');
  const guest3 = connect(guestToken);
  assert.equal((await next<any>(guest3, 'hello')).room, null);
  guest3.disconnect();
  console.log('✓ 게임 중 나가기');

  // 혼자 하기: AI가 채워지고 바로 시작
  const solo = connect(token());
  await next(solo, 'hello');
  const soloState = next(solo, 'room:state', (v: any) => v.status === 'playing');
  const sc = await call(solo, 'room:create', { gameId: 'lowest-unique', solo: true, nickname: '혼자', visibility: 'private', title: '', maxPlayers: 4 });
  assert.ok(sc.ok, sc.error);
  const sv = await soloState;
  assert.equal(sv.players.filter((p: any) => p.isBot).length, 3);
  const botPicked = await next(solo, 'room:state', (v: any) => Object.entries(v.game.picked).some(([id, done]) => id.startsWith('bot_') && done));
  assert.ok(botPicked);
  console.log('✓ 혼자 하기 (AI 상대)');

  // 준비 중인 게임은 시작 불가
  const x = connect(token());
  await next(x, 'hello');
  const c2 = await call(x, 'room:create', { gameId: 'storm-captain', visibility: 'private', title: '', maxPlayers: 3, nickname: 'x' });
  assert.ok(c2.ok);
  assert.equal((await call(x, 'room:start')).ok, false);
  console.log('✓ 준비 중 게임 처리');

  for (const s of [host, guest2, solo, x]) s.disconnect();
  console.log('\n모든 테스트 통과');
  process.exit(0);
}

main().catch((e) => { console.error('✗', e); process.exit(1); });
