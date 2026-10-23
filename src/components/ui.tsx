import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GAMES, gameById, type GameId, type GameInfo } from '../../shared/games';
import { call, nickname as nick, rulesSeen } from '../net';

// ---------- 팝업 ----------
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    const onCancel = (e: Event) => { e.preventDefault(); onClose(); };
    d.addEventListener('cancel', onCancel);
    return () => d.removeEventListener('cancel', onCancel);
  }, [onClose]);
  return (
    <dialog ref={ref} className="modal" onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="modal-body">
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">✕</button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

// ---------- 글자 타일 (방 코드) ----------
export function CodeTiles({ value, onChange, onEnter, size = 'lg', readOnly }: {
  value: string; onChange?: (v: string) => void; onEnter?: () => void; size?: 'lg' | 'md'; readOnly?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const chars = value.padEnd(6, ' ').slice(0, 6).split('');
  return (
    <div className={`tiles tiles-${size}`} onClick={() => inputRef.current?.focus()}>
      {chars.map((c, i) => (
        <span key={i} className={`tile ${c.trim() ? 'filled' : ''} ${!readOnly && i === value.length ? 'cursor' : ''}`}>{c}</span>
      ))}
      {!readOnly && (
        <input
          ref={inputRef}
          className="tiles-input"
          value={value}
          aria-label="방 코드 6자리"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={6}
          onChange={(e) => onChange?.(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.(); }}
        />
      )}
    </div>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className="pill">{children}</span>;
}

export const playersLabel = (g: GameInfo) => g.minPlayers === g.maxPlayers ? `${g.minPlayers}명` : `${g.minPlayers}–${g.maxPlayers}명`;
export const minutesLabel = (g: GameInfo) => `${g.minutes[0]}–${g.minutes[1]}분`;

// ---------- 규칙 ----------
export function RulesModal({ gameId, onClose }: { gameId: GameId; onClose: () => void }) {
  const g = gameById(gameId)!;
  return (
    <Modal title={`${g.name} 규칙`} onClose={() => { rulesSeen.mark(g.id); onClose(); }}>
      <ol className="rules">
        {g.rules.map((r, i) => <li key={i}>{r}</li>)}
      </ol>
      {g.inspiration && (
        <p className="credit">
          보드게임 「{g.inspiration.ko}」{g.inspiration.en ? ` (${g.inspiration.en})` : ''}에서 영감을 받아 만든 게임이에요.
        </p>
      )}
      <button className="btn btn-primary btn-block" onClick={() => { rulesSeen.mark(g.id); onClose(); }}>알겠어요</button>
    </Modal>
  );
}

// ---------- 닉네임 입력 ----------
export function NicknameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span>닉네임</span>
      <input value={value} maxLength={12} placeholder="친구들이 알아볼 이름" onChange={(e) => onChange(e.target.value)} required />
    </label>
  );
}

// ---------- 방 만들기 ----------
export function CreateRoomModal({ initialGame, onClose, onCreated }: {
  initialGame?: GameId; onClose: () => void; onCreated: (code: string) => void;
}) {
  const playable = GAMES.filter((g) => g.playable);
  const [gameId, setGameId] = useState<GameId>(initialGame && gameById(initialGame)?.playable ? initialGame : playable[0].id);
  const g = gameById(gameId)!;
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [max, setMax] = useState(g.maxPlayers);
  const [name, setName] = useState(nick.get());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setMax(g.maxPlayers); }, [gameId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    nick.set(name);
    const res = await call<{ code: string }>('room:create', {
      gameId, visibility, title, password: visibility === 'private' ? password : '', maxPlayers: max, nickname: name,
    });
    setBusy(false);
    if (res.ok) onCreated(res.code); else setError(res.error);
  }

  return (
    <Modal title="방 만들기" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>게임</span>
          <select value={gameId} onChange={(e) => setGameId(e.target.value as GameId)}>
            {GAMES.map((x) => (
              <option key={x.id} value={x.id} disabled={!x.playable}>
                {x.name} ({playersLabel(x)}){x.playable ? '' : ' · 준비 중'}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="seg">
          <legend>누가 들어올 수 있나요?</legend>
          <label className={visibility === 'private' ? 'on' : ''}>
            <input type="radio" name="vis" checked={visibility === 'private'} onChange={() => setVisibility('private')} />
            <b>친구만</b><small>코드나 링크를 받은 사람</small>
          </label>
          <label className={visibility === 'public' ? 'on' : ''}>
            <input type="radio" name="vis" checked={visibility === 'public'} onChange={() => setVisibility('public')} />
            <b>누구나</b><small>공개 방 목록에 보여요</small>
          </label>
        </fieldset>
        {visibility === 'public' ? (
          <label className="field">
            <span>방 제목</span>
            <input value={title} maxLength={30} placeholder={`${g.name} 같이 해요`} onChange={(e) => setTitle(e.target.value)} />
          </label>
        ) : (
          <label className="field">
            <span>비밀번호 <em>선택</em></span>
            <input value={password} maxLength={20} placeholder="없으면 코드만으로 들어와요" onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}
        <div className="row-2">
          <NicknameField value={name} onChange={setName} />
          <label className="field">
            <span>최대 인원</span>
            <select value={max} onChange={(e) => setMax(Number(e.target.value))}>
              {Array.from({ length: g.maxPlayers - g.minPlayers + 1 }, (_, i) => g.minPlayers + i).map((n) => (
                <option key={n} value={n}>{n}명</option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy || !name.trim()}>{busy ? '만드는 중…' : '방 만들기'}</button>
      </form>
    </Modal>
  );
}

// ---------- 방 들어가기 (닉네임/비밀번호) ----------
export function JoinModal({ code, onClose, onJoined }: { code: string; onClose: () => void; onJoined: (code: string) => void }) {
  const [info, setInfo] = useState<{ gameId: GameId; title: string; hasPassword: boolean; players: number; maxPlayers: number; status: string } | null>(null);
  const [name, setName] = useState(nick.get());
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    call<any>('room:peek', code).then((r) => {
      if (!r.ok) return setError(r.error);
      if (r.member) return onJoined(code); // 이미 들어가 있는 방
      setInfo(r);
    });
  }, [code]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    nick.set(name);
    const r = await call<{ code: string }>('room:join', { code, nickname: name, password });
    setBusy(false);
    if (r.ok) onJoined(r.code); else setError(r.error);
  }

  const g = info ? gameById(info.gameId) : null;
  return (
    <Modal title="방에 들어가기" onClose={onClose}>
      <CodeTiles value={code} readOnly size="md" />
      {g && info && (
        <p className="join-meta"><b>{info.title}</b><br />{g.name}, 지금 {info.players}/{info.maxPlayers}명</p>
      )}
      {info && info.status !== 'lobby' ? (
        <p className="error">이미 게임이 시작된 방이에요. 끝나면 다시 들어와 주세요.</p>
      ) : info ? (
        <form className="form" onSubmit={submit}>
          <NicknameField value={name} onChange={setName} />
          {info.hasPassword && (
            <label className="field">
              <span>비밀번호</span>
              <input value={password} maxLength={20} onChange={(e) => setPassword(e.target.value)} required />
            </label>
          )}
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy || !name.trim()}>{busy ? '들어가는 중…' : '들어가기'}</button>
        </form>
      ) : error ? <p className="error" role="alert">{error}</p> : <p className="muted">방을 찾는 중…</p>}
    </Modal>
  );
}

// ---------- 혼자 하기 ----------
export function SoloModal({ gameId, onClose, onCreated }: { gameId: GameId; onClose: () => void; onCreated: (code: string) => void }) {
  const g = gameById(gameId)!;
  const [name, setName] = useState(nick.get());
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    nick.set(name);
    const r = await call<{ code: string }>('room:create', { gameId, solo: true, nickname: name, visibility: 'private', title: '', maxPlayers: 4 });
    if (r.ok) onCreated(r.code); else setError(r.error);
  }
  return (
    <Modal title={`${g.name} 혼자 하기`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="muted">AI 상대 3명과 바로 시작해요.</p>
        <NicknameField value={name} onChange={setName} />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={!name.trim()}>시작하기</button>
      </form>
    </Modal>
  );
}

export const AVATAR_COLORS = ['#FFC93C', '#FF8FB1', '#7FD1C7', '#C3A6FF', '#9BD35A', '#FF7A59', '#5B8DEF', '#F2B5D4'];
