// 화면 <-> 서버 사이에 오가는 데이터 모양
import type { GameId } from './games';

export type Visibility = 'public' | 'private';

export interface PlayerView {
  id: string;
  nickname: string;
  isHost: boolean;
  isBot: boolean;
  ready: boolean;
  connected: boolean;
}

export interface RoomView {
  code: string;
  gameId: GameId;
  title: string;
  visibility: Visibility;
  hasPassword: boolean;
  maxPlayers: number;
  status: 'lobby' | 'playing' | 'finished';
  players: PlayerView[];
  you: string; // 내 playerId
  game: unknown; // 게임별 화면 상태 (진행 중일 때)
}

export interface PublicRoomSummary {
  code: string;
  gameId: GameId;
  title: string;
  players: number;
  maxPlayers: number;
  hasPassword: boolean;
  status: 'lobby' | 'playing' | 'finished';
}

export interface CreateRoomInput {
  gameId: GameId;
  visibility: Visibility;
  title: string;
  password?: string;
  maxPlayers: number;
  nickname: string;
  solo?: boolean;
}

export interface JoinRoomInput {
  code: string;
  password?: string;
  nickname: string;
}

export type Ack<T = {}> = ({ ok: true } & T) | { ok: false; error: string; needPassword?: boolean };
