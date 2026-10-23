import { useEffect, useState } from 'react';
import { gameById } from '../../shared/games';
import type { RoomView } from '../../shared/protocol';
import { call, rulesSeen, socket } from '../net';
import { AVATAR_COLORS, CodeTiles, RulesModal } from '../components/ui';
import { GameArt } from '../components/GameArt';
import { LowestUniqueView } from '../games/LowestUnique';

export function RoomPage({ room, onLeave }: { room: RoomView; onLeave: () => void }) {
  const g = gameById(room.gameId)!;
  const me = room.players.find((p) => p.id === room.you)!;
  const [showRules, setShowRules] = useState(() => !rulesSeen.has(g.id));
  const solo = room.players.every((p) => p.isBot || p.id === room.you) && room.players.some((p) => p.isBot);

  async function leave() {
    await call('room:leave');
    onLeave();
  }

  return (
    <div className="room">
      <header className="room-bar">
        <button className="btn btn-text" onClick={leave}>나가기</button>
        <div className="room-title">
          <GameArt id={g.id} color={g.color} className="room-bar-art" />
          <div><b>{g.name}</b><span>{solo ? '혼자 하기' : room.title}</span></div>
        </div>
        <button className="btn btn-text" onClick={() => setShowRules(true)}>규칙</button>
      </header>

      {room.status === 'lobby' ? (
        <Lobby room={room} meIsHost={me.isHost} />
      ) : room.gameId === 'lowest-unique' ? (
        <LowestUniqueView room={room} solo={solo} onLeave={leave} />
      ) : (
        <p className="empty">이 게임은 준비 중이에요.</p>
      )}

      {showRules && <RulesModal gameId={g.id} onClose={() => setShowRules(false)} />}
    </div>
  );
}

function Lobby({ room, meIsHost }: { room: RoomView; meIsHost: boolean }) {
  const g = gameById(room.gameId)!;
  const me = room.players.find((p) => p.id === room.you)!;
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const link = `${location.origin}/?room=${room.code}`;
  const others = room.players.filter((p) => !p.isHost);
  const allReady = others.every((p) => p.ready);
  const enough = room.players.length >= g.minPlayers;

  useEffect(() => { setError(''); }, [room.players.length]);

  async function share() {
    const text = `게임그라운드에서 ${g.name} 같이 해요! 방 코드 ${room.code}`;
    try {
      if (navigator.share) await navigator.share({ title: '게임그라운드', text, url: link });
      else { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* 공유 취소 */ }
  }

  async function start() {
    const r = await call('room:start');
    if (!r.ok) setError(r.error);
  }

  const seats = Array.from({ length: room.maxPlayers }, (_, i) => room.players[i] ?? null);

  return (
    <div className="lobby">
      <section className="invite">
        <p className="invite-label">방 코드</p>
        <CodeTiles value={room.code} readOnly />
        <button className="btn btn-sun" onClick={share}>{copied ? '링크를 복사했어요' : '친구 초대하기'}</button>
        <p className="invite-note">{room.hasPassword ? '비밀번호를 아는 친구만 들어올 수 있어요.' : room.visibility === 'public' ? '공개 방 목록에도 보여요.' : '코드나 링크를 받은 친구만 들어올 수 있어요.'}</p>
      </section>

      <section className="seats" aria-label="참가자">
        <h2>자리 {room.players.length}/{room.maxPlayers}</h2>
        <ul>
          {seats.map((p, i) => p ? (
            <li key={p.id} className={`seat taken ${p.ready ? 'ready' : ''} ${p.connected ? '' : 'away'}`}>
              <span className="avatar" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>{p.nickname.slice(0, 1)}</span>
              <span className="seat-name">{p.nickname}{p.id === room.you ? ' (나)' : ''}</span>
              <span className="seat-state">{p.isHost ? '방장' : !p.connected ? '연결 끊김' : p.ready ? '준비 완료' : '기다리는 중'}</span>
              {meIsHost && !p.isHost && (
                <button className="icon-btn" aria-label={`${p.nickname} 내보내기`} onClick={() => socket.emit('room:kick', p.id)}>✕</button>
              )}
            </li>
          ) : (
            <li key={`empty-${i}`} className="seat empty-seat"><span className="avatar" />빈 자리</li>
          ))}
        </ul>
      </section>

      <div className="lobby-actions">
        {error && <p className="error" role="alert">{error}</p>}
        {meIsHost ? (
          <>
            <button className="btn btn-primary btn-block btn-big" disabled={!enough || !allReady} onClick={start}>게임 시작</button>
            <p className="muted center">
              {!enough ? `${g.minPlayers}명 이상 모이면 시작할 수 있어요.` : !allReady ? '모두 준비하면 시작할 수 있어요.' : '모두 준비됐어요!'}
            </p>
          </>
        ) : (
          <button
            className={`btn btn-block btn-big ${me.ready ? 'btn-quiet' : 'btn-primary'}`}
            onClick={() => socket.emit('room:ready', !me.ready)}
          >{me.ready ? '준비 취소' : '준비 완료'}</button>
        )}
      </div>
    </div>
  );
}

