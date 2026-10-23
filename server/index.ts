// 게임그라운드 서버: 웹소켓으로 방과 게임을 실시간 동기화
import express from 'express';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { Server, type Socket } from 'socket.io';
import { RoomManager, type Room } from './rooms';

const PORT = Number(process.env.PORT) || 3001;
const app = express();
const http = createServer(app);
const io = new Server(http, { cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? false } });

app.get('/healthz', (_req, res) => res.send('ok'));

// 화면 파일(빌드 결과) 제공
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '../dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!socket\.io).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const sockets = new Map<string, Set<Socket>>(); // playerId -> sockets

const rooms = new RoomManager({
  room(room: Room) {
    for (const p of room.players) {
      for (const s of sockets.get(p.id) ?? []) s.emit('room:state', rooms.viewFor(room, p.id));
    }
  },
  lobby() {
    io.to('lobby').emit('rooms:list', rooms.publicList());
  },
  closed(code, playerIds) {
    for (const id of playerIds) for (const s of sockets.get(id) ?? []) s.emit('room:closed', { code });
  },
});

/** 비밀 토큰에서 공개용 플레이어 id를 만듦 (토큰은 남에게 보이지 않음) */
const publicId = (token: string) => createHash('sha256').update(token).digest('hex').slice(0, 16);

io.on('connection', (socket) => {
  const token = String(socket.handshake.auth?.token ?? '');
  if (token.length < 16 || token.length > 128) return socket.disconnect(true);
  const playerId = publicId(token);

  if (!sockets.has(playerId)) sockets.set(playerId, new Set());
  sockets.get(playerId)!.add(socket);

  // 재접속: 원래 있던 방이 있으면 상태를 바로 보냄
  const room = rooms.reconnect(playerId);
  socket.emit('hello', { playerId, room: room ? rooms.viewFor(room, playerId) : null });

  socket.on('rooms:watch', (on: boolean) => {
    if (on) { socket.join('lobby'); socket.emit('rooms:list', rooms.publicList()); }
    else socket.leave('lobby');
  });

  socket.on('room:create', (input, ack) => {
    const r = rooms.create(playerId, input);
    reply(ack, r.error ? { ok: false, error: r.error } : { ok: true, code: r.code });
  });

  socket.on('room:join', (input, ack) => {
    const r = rooms.join(playerId, input);
    reply(ack, 'error' in r && r.error
      ? { ok: false, error: r.error, needPassword: (r as any).needPassword }
      : { ok: true, code: (r as any).code });
  });

  socket.on('room:peek', (code: string, ack) => {
    // 링크로 들어왔을 때 방 정보 미리보기
    const r = rooms.rooms.get(String(code ?? '').toUpperCase());
    reply(ack, r
      ? { ok: true, gameId: r.gameId, title: r.title, hasPassword: !!r.password, players: r.players.length, maxPlayers: r.maxPlayers, status: r.status, member: r.players.some((p) => p.id === playerId) }
      : { ok: false, error: '방을 찾을 수 없어요. 코드를 다시 확인해주세요.' });
  });

  socket.on('room:leave', (_: unknown, ack) => { rooms.leave(playerId); reply(ack, { ok: true }); });
  socket.on('room:ready', (ready: boolean) => rooms.setReady(playerId, ready));
  socket.on('room:kick', (target: string) => rooms.kick(playerId, String(target)));
  socket.on('room:start', (_: unknown, ack) => {
    const err = rooms.start(playerId);
    reply(ack, err ? { ok: false, error: err } : { ok: true });
  });
  socket.on('room:lobby', () => rooms.backToLobby(playerId));
  socket.on('game:action', (action, ack) => {
    const err = rooms.action(playerId, action);
    reply(ack, err ? { ok: false, error: err } : { ok: true });
  });

  socket.on('disconnect', () => {
    const set = sockets.get(playerId);
    set?.delete(socket);
    if (set && set.size === 0) {
      sockets.delete(playerId);
      rooms.disconnect(playerId);
    }
  });
});

function reply(ack: unknown, data: unknown) {
  if (typeof ack === 'function') ack(data);
}

http.listen(PORT, () => console.log(`게임그라운드 서버: http://localhost:${PORT}`));
