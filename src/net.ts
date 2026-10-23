// 서버 연결과 내 정보(닉네임, 비밀 토큰) 보관
import { io, type Socket } from 'socket.io-client';
import { useEffect, useState } from 'react';
import type { Ack, RoomView } from '../shared/protocol';

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* 저장 불가 환경 */ } },
};

function getToken() {
  let t = store.get('gg:token');
  if (!t) {
    t = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
    store.set('gg:token', t);
  }
  return t;
}

export const socket: Socket = io({ auth: { token: getToken() }, transports: ['websocket', 'polling'] });

export const nickname = {
  get: () => store.get('gg:nick') ?? '',
  set: (n: string) => store.set('gg:nick', n.trim().slice(0, 12)),
};

export const rulesSeen = {
  has: (id: string) => store.get(`gg:rules:${id}`) === '1',
  mark: (id: string) => store.set(`gg:rules:${id}`, '1'),
};

export function call<T = {}>(event: string, data?: unknown): Promise<Ack<T>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: '서버 응답이 없어요. 인터넷 연결을 확인해주세요.' }), 8000);
    socket.emit(event, data, (res: Ack<T>) => { clearTimeout(timer); resolve(res); });
  });
}

/** 내가 들어가 있는 방 상태 (없으면 null) */
export function useRoom() {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const onHello = (d: { room: RoomView | null }) => { setRoom(d.room); setReady(true); };
    const onState = (v: RoomView) => setRoom(v);
    const onClosed = () => setRoom(null);
    socket.on('hello', onHello);
    socket.on('room:state', onState);
    socket.on('room:closed', onClosed);
    return () => { socket.off('hello', onHello); socket.off('room:state', onState); socket.off('room:closed', onClosed); };
  }, []);
  return { room, connected: ready, clear: () => setRoom(null) };
}

export function useConnection() {
  const [online, setOnline] = useState(socket.connected);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    socket.on('connect', on); socket.on('disconnect', off);
    return () => { socket.off('connect', on); socket.off('disconnect', off); };
  }, []);
  return online;
}

/** 서버 기준 남은 시간(초) */
export function useCountdown(deadline: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [deadline]);
  return Math.max(0, (deadline - now) / 1000);
}
