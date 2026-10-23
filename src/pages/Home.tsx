import { useEffect, useMemo, useState } from 'react';
import { GAMES, gameById, searchGames, type GameId } from '../../shared/games';
import type { PublicRoomSummary } from '../../shared/protocol';
import { socket } from '../net';
import { GameArt } from '../components/GameArt';
import { CodeTiles, CreateRoomModal, Pill, RulesModal, SoloModal, minutesLabel, playersLabel } from '../components/ui';

type Dialog =
  | { kind: 'create'; gameId?: GameId }
  | { kind: 'solo'; gameId: GameId }
  | { kind: 'rules'; gameId: GameId }
  | null;

const FILTERS = ['전체', '혼자 가능', '심리전', '카드', '그림', '협력', '대화'];

export function Home({ onEnter, onJoinCode }: { onEnter: (code: string) => void; onJoinCode: (code: string) => void }) {
  const [code, setCode] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('전체');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [rooms, setRooms] = useState<PublicRoomSummary[]>([]);

  useEffect(() => {
    const onList = (l: PublicRoomSummary[]) => setRooms(l);
    socket.on('rooms:list', onList);
    socket.emit('rooms:watch', true);
    const onConnect = () => socket.emit('rooms:watch', true);
    socket.on('connect', onConnect);
    return () => { socket.off('rooms:list', onList); socket.off('connect', onConnect); socket.emit('rooms:watch', false); };
  }, []);

  const games = useMemo(() => {
    const found = searchGames(query);
    const filtered = filter === '전체' ? found
      : filter === '혼자 가능' ? found.filter((g) => g.solo)
      : found.filter((g) => g.genres.includes(filter));
    // 지금 할 수 있는 게임을 앞에
    return [...filtered].sort((a, b) => Number(b.playable) - Number(a.playable));
  }, [query, filter]);

  const joinCode = () => { if (code.length === 6) onJoinCode(code); };

  return (
    <div className="home">
      <section className="table-hero">
        <Scatter />
        <div className="hero-inner">
          <p className="brand">게임그라운드</p>
          <h1>오늘 밤,<br />누구랑 한판?</h1>
          <p className="hero-sub">로그인 없이 닉네임만 있으면 돼요. 각자 휴대폰으로 같은 방에 모여요.</p>

          <div className="join-box">
            <p className="join-label">친구에게 받은 방 코드</p>
            <CodeTiles value={code} onChange={setCode} onEnter={joinCode} />
            <div className="hero-actions">
              <button className="btn btn-sun" disabled={code.length !== 6} onClick={joinCode}>들어가기</button>
              <button className="btn btn-ghost-light" onClick={() => setDialog({ kind: 'create' })}>새 방 만들기</button>
            </div>
          </div>
        </div>
      </section>

      <main className="shelf">
        <div className="shelf-head">
          <h2>게임 고르기</h2>
          <div className="search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M16 16l5 5" /></svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="게임 이름이나 원작 이름으로 찾기"
              aria-label="게임 검색"
            />
          </div>
          <div className="chips" role="tablist" aria-label="게임 종류">
            {FILTERS.map((f) => (
              <button key={f} role="tab" aria-selected={filter === f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
        </div>

        {games.length === 0 ? (
          <div className="empty">
            <p>「{query}」에 맞는 게임이 없어요.</p>
            <button className="btn btn-quiet" onClick={() => { setQuery(''); setFilter('전체'); }}>전체 게임 보기</button>
          </div>
        ) : (
          <ul className="boxes">
            {games.map((g) => (
              <li key={g.id} className={`box ${g.playable ? '' : 'soon'}`}>
                <div className="lid">
                  <GameArt id={g.id} color={g.color} />
                  {!g.playable && <span className="soon-badge">곧 열려요</span>}
                </div>
                <div className="box-body">
                  <h3>{g.name}</h3>
                  <p className="tagline">{g.tagline}</p>
                  <div className="pills">
                    <Pill>{playersLabel(g)}</Pill>
                    <Pill>{minutesLabel(g)}</Pill>
                    {g.genres.map((x) => <Pill key={x}>{x}</Pill>)}
                  </div>
                  {g.inspiration && <p className="inspired">「{g.inspiration.ko}」에서 영감</p>}
                  <div className="box-actions">
                    <button className="btn btn-primary" disabled={!g.playable} onClick={() => setDialog({ kind: 'create', gameId: g.id })}>같이 하기</button>
                    {g.solo && <button className="btn btn-quiet" disabled={!g.playable} onClick={() => setDialog({ kind: 'solo', gameId: g.id })}>혼자 하기</button>}
                    <button className="btn btn-text" onClick={() => setDialog({ kind: 'rules', gameId: g.id })}>규칙</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <section className="open-rooms" aria-labelledby="open-rooms-title">
          <h2 id="open-rooms-title">지금 열린 방</h2>
          {rooms.length === 0 ? (
            <div className="empty">
              <p>열린 공개 방이 없어요. 먼저 방을 열어 친구를 기다려 보세요.</p>
              <button className="btn btn-quiet" onClick={() => setDialog({ kind: 'create' })}>새 방 만들기</button>
            </div>
          ) : (
            <ul className="room-list">
              {rooms.map((r) => {
                const g = gameById(r.gameId)!;
                const full = r.players >= r.maxPlayers;
                return (
                  <li key={r.code}>
                    <GameArt id={g.id} color={g.color} className="room-thumb" />
                    <div className="room-text">
                      <b>{r.title}</b>
                      <span>{g.name}{r.hasPassword ? ', 비밀번호 있음' : ''}</span>
                    </div>
                    <span className="count">{r.players}/{r.maxPlayers}</span>
                    <button className="btn btn-quiet" disabled={full} onClick={() => onJoinCode(r.code)}>{full ? '가득 참' : '참가'}</button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <footer className="foot">
        <p>게임그라운드는 모든 기기가 인터넷에 연결되어 있어야 해요.</p>
      </footer>

      {dialog?.kind === 'create' && <CreateRoomModal initialGame={dialog.gameId} onClose={() => setDialog(null)} onCreated={onEnter} />}
      {dialog?.kind === 'solo' && <SoloModal gameId={dialog.gameId} onClose={() => setDialog(null)} onCreated={onEnter} />}
      {dialog?.kind === 'rules' && <RulesModal gameId={dialog.gameId} onClose={() => setDialog(null)} />}
    </div>
  );
}

/** 테이블 위에 흩어진 게임 말들 */
function Scatter() {
  return (
    <svg className="scatter" viewBox="0 0 400 300" aria-hidden="true" preserveAspectRatio="xMaxYMid slice">
      <g stroke="#1D2142" strokeWidth="3" strokeLinejoin="round">
        <g transform="rotate(14 300 70)">
          <rect x="270" y="40" width="60" height="60" rx="12" fill="#FFF4DA" />
          <circle cx="287" cy="57" r="5" fill="#1D2142" stroke="none" /><circle cx="313" cy="83" r="5" fill="#1D2142" stroke="none" /><circle cx="300" cy="70" r="5" fill="#FF5A7A" stroke="none" />
        </g>
        <path d="M340 190c0-12 8-20 18-20s18 8 18 20c8 2 14 8 14 16v6h-20l4 34h-32l4-34h-20v-6c0-8 6-14 14-16z" fill="#FFC93C" transform="rotate(-8 358 210)" />
        <g transform="rotate(-16 250 210)">
          <rect x="222" y="168" width="56" height="80" rx="8" fill="#fff" />
          <text x="250" y="218" textAnchor="middle" fontFamily="Jua" fontSize="30" fill="#1D2142" stroke="none">7</text>
        </g>
        <circle cx="200" cy="60" r="12" fill="#35C2A0" />
        <circle cx="380" cy="120" r="10" fill="#FF5A7A" />
      </g>
    </svg>
  );
}
