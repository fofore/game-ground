import { useEffect, useState } from 'react';
import { useConnection, useRoom } from './net';
import { Home } from './pages/Home';
import { RoomPage } from './pages/RoomPage';
import { JoinModal } from './components/ui';

const codeFromUrl = () => new URLSearchParams(location.search).get('room')?.toUpperCase().slice(0, 6) ?? '';

export function App() {
  const { room, connected, clear } = useRoom();
  const online = useConnection();
  const [joinCode, setJoinCode] = useState(codeFromUrl);

  // 주소창에 방 코드를 반영해서 새로고침해도 같은 방으로
  useEffect(() => {
    const url = room ? `/?room=${room.code}` : joinCode ? `/?room=${joinCode}` : '/';
    if (location.pathname + location.search !== url) history.replaceState(null, '', url);
  }, [room?.code, joinCode]);

  useEffect(() => { if (room) setJoinCode(''); }, [room?.code]);

  return (
    <>
      {!online && connected && <div className="offline" role="status">연결이 끊겼어요. 다시 연결하는 중…</div>}
      {room ? (
        <RoomPage room={room} onLeave={() => { clear(); setJoinCode(''); }} />
      ) : (
        <Home onEnter={() => setJoinCode('')} onJoinCode={setJoinCode} />
      )}
      {!room && joinCode && connected && (
        <JoinModal code={joinCode} onClose={() => setJoinCode('')} onJoined={() => setJoinCode('')} />
      )}
    </>
  );
}
