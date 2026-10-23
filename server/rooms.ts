// 방 관리: 생성, 참가, 나가기, 준비, 시작, 재접속
import { customAlphabet } from 'nanoid';
import { gameById, type GameId } from '../shared/games';
import type {
  CreateRoomInput, JoinRoomInput, PublicRoomSummary, RoomView, Visibility,
} from '../shared/protocol';
import { MODULES } from './games/registry';
import type { GameContext } from './games/types';

const makeCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);
const makeBotId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);

const LOBBY_GRACE_MS = 30_000; // 대기실에서 끊긴 사람을 빼기까지
const EMPTY_ROOM_MS = 5 * 60_000; // 사람이 모두 끊긴 방을 지우기까지
const BOT_NAMES = ['주사위봇', '말판봇', '카드봇', '토큰봇', '타일봇', '모래시계봇', '미플봇'];

export interface Player {
  id: string;
  nickname: string;
  isBot: boolean;
  ready: boolean;
  connected: boolean;
  leaveTimer?: NodeJS.Timeout;
}

export interface Room {
  code: string;
  gameId: GameId;
  title: string;
  visibility: Visibility;
  password?: string;
  maxPlayers: number;
  hostId: string;
  players: Player[];
  status: 'lobby' | 'playing' | 'finished';
  game?: { state: any; timers: Set<NodeJS.Timeout> };
  emptyTimer?: NodeJS.Timeout;
  createdAt: number;
}

type Notify = { room(room: Room): void; lobby(): void; closed(code: string, playerIds: string[]): void };

export class RoomManager {
  rooms = new Map<string, Room>();
  playerRoom = new Map<string, string>(); // playerId -> code

  constructor(private notify: Notify) {}

  // ---------- 입력 검사 ----------
  private cleanNickname(n: unknown) {
    const s = String(n ?? '').trim().slice(0, 12);
    return s || null;
  }

  // ---------- 조회 ----------
  roomOf(playerId: string) {
    const code = this.playerRoom.get(playerId);
    return code ? this.rooms.get(code) : undefined;
  }

  publicList(): PublicRoomSummary[] {
    return [...this.rooms.values()]
      .filter((r) => r.visibility === 'public' && r.status === 'lobby')
      .map((r) => ({
        code: r.code, gameId: r.gameId, title: r.title, players: r.players.length,
        maxPlayers: r.maxPlayers, hasPassword: !!r.password, status: r.status,
      }))
      .sort((a, b) => b.players - a.players);
  }

  viewFor(room: Room, playerId: string): RoomView {
    const mod = MODULES[room.gameId];
    return {
      code: room.code, gameId: room.gameId, title: room.title, visibility: room.visibility,
      hasPassword: !!room.password, maxPlayers: room.maxPlayers, status: room.status,
      players: room.players.map((p) => ({
        id: p.id, nickname: p.nickname, isHost: p.id === room.hostId, isBot: p.isBot,
        ready: p.ready, connected: p.connected,
      })),
      you: playerId,
      game: room.game && mod ? mod.view(room.game.state, playerId) : null,
    };
  }

  // ---------- 방 만들기 / 참가 ----------
  create(playerId: string, input: CreateRoomInput) {
    const info = gameById(input?.gameId);
    if (!info) return { error: '없는 게임이에요.' };
    const nickname = this.cleanNickname(input.nickname);
    if (!nickname) return { error: '닉네임을 입력해주세요.' };
    if (input.solo && !info.solo) return { error: '이 게임은 혼자 하기를 지원하지 않아요.' };
    const max = Math.min(Math.max(Number(input.maxPlayers) || info.maxPlayers, info.minPlayers), info.maxPlayers);

    this.leave(playerId); // 다른 방에 있었다면 나가기
    let code = makeCode();
    while (this.rooms.has(code)) code = makeCode();

    const room: Room = {
      code, gameId: info.id,
      title: String(input.title ?? '').trim().slice(0, 30) || `${info.name} 같이 해요`,
      visibility: input.solo ? 'private' : input.visibility === 'public' ? 'public' : 'private',
      password: input.password ? String(input.password).slice(0, 20) : undefined,
      maxPlayers: input.solo ? Math.min(4, info.maxPlayers) : max,
      hostId: playerId,
      players: [{ id: playerId, nickname, isBot: false, ready: true, connected: true }],
      status: 'lobby',
      createdAt: Date.now(),
    };
    this.rooms.set(code, room);
    this.playerRoom.set(playerId, code);

    if (input.solo) {
      // AI 상대를 채우고 바로 시작
      const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
      while (room.players.length < room.maxPlayers) {
        room.players.push({ id: `bot_${makeBotId()}`, nickname: names.pop()!, isBot: true, ready: true, connected: true });
      }
      const err = this.start(playerId);
      if (err) return { error: err };
    }
    this.notify.room(room);
    this.notify.lobby();
    return { code };
  }

  join(playerId: string, input: JoinRoomInput) {
    const code = String(input?.code ?? '').trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return { error: '방을 찾을 수 없어요. 코드를 다시 확인해주세요.' };

    // 이미 이 방에 있으면 재접속으로 처리
    const existing = room.players.find((p) => p.id === playerId);
    if (existing) {
      this.reconnect(playerId);
      return { code };
    }
    const nickname = this.cleanNickname(input.nickname);
    if (!nickname) return { error: '닉네임을 입력해주세요.' };
    if (room.password && room.password !== String(input.password ?? '')) {
      return { error: input.password ? '비밀번호가 맞지 않아요.' : '비밀번호가 필요한 방이에요.', needPassword: true };
    }
    if (room.status !== 'lobby') return { error: '이미 게임이 시작된 방이에요.' };
    if (room.players.length >= room.maxPlayers) return { error: '방이 가득 찼어요.' };
    if (room.players.some((p) => p.nickname === nickname)) return { error: '이 방에 같은 닉네임이 있어요. 다른 닉네임을 써주세요.' };

    this.leave(playerId);
    room.players.push({ id: playerId, nickname, isBot: false, ready: false, connected: true });
    this.playerRoom.set(playerId, code);
    this.clearEmptyTimer(room);
    this.notify.room(room);
    this.notify.lobby();
    return { code };
  }

  // ---------- 나가기 / 접속 상태 ----------
  leave(playerId: string) {
    const room = this.roomOf(playerId);
    if (!room) return;
    this.playerRoom.delete(playerId);
    const p = room.players.find((x) => x.id === playerId);
    if (p?.leaveTimer) clearTimeout(p.leaveTimer);

    if (room.status === 'playing') {
      // 게임 중에는 자리를 비워두고(자동 진행) 접속만 끊긴 것으로 표시
      if (p) p.connected = false;
    } else {
      room.players = room.players.filter((x) => x.id !== playerId);
    }
    this.afterPeopleChange(room);
  }

  disconnect(playerId: string) {
    const room = this.roomOf(playerId);
    if (!room) return;
    const p = room.players.find((x) => x.id === playerId);
    if (!p) return;
    p.connected = false;
    if (room.status !== 'playing') {
      p.leaveTimer = setTimeout(() => this.leave(playerId), LOBBY_GRACE_MS);
    }
    this.afterPeopleChange(room);
  }

  reconnect(playerId: string) {
    const room = this.roomOf(playerId);
    if (!room) return undefined;
    const p = room.players.find((x) => x.id === playerId);
    if (!p) return undefined;
    if (p.leaveTimer) clearTimeout(p.leaveTimer);
    p.leaveTimer = undefined;
    p.connected = true;
    this.clearEmptyTimer(room);
    this.notify.room(room);
    return room;
  }

  private afterPeopleChange(room: Room) {
    const humans = room.players.filter((p) => !p.isBot);
    if (!humans.length) return this.close(room);
    // 방장이 나갔거나 끊겼으면 접속 중인 다음 사람에게 넘김
    const host = room.players.find((p) => p.id === room.hostId);
    if (!host || !host.connected) {
      const next = humans.find((p) => p.connected);
      if (next) { room.hostId = next.id; next.ready = true; }
    }
    if (!humans.some((p) => p.connected) && !room.emptyTimer) {
      room.emptyTimer = setTimeout(() => this.close(room), EMPTY_ROOM_MS);
    }
    this.notify.room(room);
    this.notify.lobby();
  }

  private clearEmptyTimer(room: Room) {
    if (room.emptyTimer) clearTimeout(room.emptyTimer);
    room.emptyTimer = undefined;
  }

  close(room: Room) {
    this.stopGame(room);
    this.clearEmptyTimer(room);
    const ids = room.players.map((p) => p.id);
    for (const p of room.players) {
      if (p.leaveTimer) clearTimeout(p.leaveTimer);
      if (this.playerRoom.get(p.id) === room.code) this.playerRoom.delete(p.id);
    }
    this.rooms.delete(room.code);
    this.notify.closed(room.code, ids);
    this.notify.lobby();
  }

  // ---------- 대기실 ----------
  setReady(playerId: string, ready: boolean) {
    const room = this.roomOf(playerId);
    if (!room || room.status !== 'lobby') return;
    const p = room.players.find((x) => x.id === playerId);
    if (p && p.id !== room.hostId) p.ready = !!ready;
    this.notify.room(room);
  }

  kick(hostId: string, targetId: string) {
    const room = this.roomOf(hostId);
    if (!room || room.hostId !== hostId || room.status !== 'lobby' || hostId === targetId) return;
    if (!room.players.some((p) => p.id === targetId)) return;
    this.leave(targetId);
    this.notify.closed(room.code, [targetId]);
  }

  start(playerId: string): string | void {
    const room = this.roomOf(playerId);
    if (!room) return '방에 있지 않아요.';
    if (room.hostId !== playerId) return '방장만 시작할 수 있어요.';
    if (room.status !== 'lobby') return '이미 시작했어요.';
    const info = gameById(room.gameId)!;
    const mod = MODULES[room.gameId];
    if (!mod) return '이 게임은 아직 준비 중이에요.';
    if (room.players.length < info.minPlayers) return `${info.minPlayers}명 이상 모여야 시작할 수 있어요.`;
    const notReady = room.players.filter((p) => !p.ready && !p.isBot);
    if (notReady.length) return `${notReady.map((p) => p.nickname).join(', ')} 님이 아직 준비하지 않았어요.`;

    room.status = 'playing';
    room.game = { state: null, timers: new Set() };
    room.game.state = mod.create(
      room.players.map((p) => ({ id: p.id, nickname: p.nickname, isBot: p.isBot })),
      this.ctxFor(room),
    );
    this.notify.room(room);
    this.notify.lobby();
  }

  action(playerId: string, action: unknown): string | void {
    const room = this.roomOf(playerId);
    if (!room || room.status !== 'playing' || !room.game) return '진행 중인 게임이 없어요.';
    const err = MODULES[room.gameId].onAction(room.game.state, playerId, action, this.ctxFor(room));
    this.notify.room(room);
    return err;
  }

  /** 결과 화면에서 대기실로 돌아가기 */
  backToLobby(playerId: string) {
    const room = this.roomOf(playerId);
    if (!room || room.hostId !== playerId || room.status === 'lobby') return;
    this.stopGame(room);
    room.status = 'lobby';
    room.game = undefined;
    // 끊긴 사람은 정리하고, 준비 상태 초기화
    room.players = room.players.filter((p) => p.isBot || p.connected || p.id === room.hostId);
    for (const p of room.players) p.ready = p.isBot || p.id === room.hostId;
    for (const id of [...this.playerRoom.keys()]) {
      if (this.playerRoom.get(id) === room.code && !room.players.some((p) => p.id === id)) this.playerRoom.delete(id);
    }
    this.notify.room(room);
    this.notify.lobby();
  }

  private stopGame(room: Room) {
    if (!room.game) return;
    for (const t of room.game.timers) clearTimeout(t);
    room.game.timers.clear();
  }

  private ctxFor(room: Room): GameContext {
    const game = room.game!;
    return {
      update: () => this.notify.room(room),
      setTimer: (ms, fn) => {
        const t = setTimeout(() => {
          game.timers.delete(t);
          if (this.rooms.get(room.code) === room && room.game === game) fn();
        }, ms);
        game.timers.add(t);
      },
      clearTimers: () => { for (const t of game.timers) clearTimeout(t); game.timers.clear(); },
      finish: () => { room.status = 'finished'; },
      now: () => Date.now(),
    };
  }
}
