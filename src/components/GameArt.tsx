// 게임 상자 뚜껑 그림 (전부 직접 그린 SVG)
import type { ReactNode } from 'react';
import type { GameId } from '../../shared/games';

const INK = '#1D2142';
const TILE = '#FFF4DA';
const W = '#FFFFFF';
const s = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

const Eye = ({ x, y, r = 5 }: { x: number; y: number; r?: number }) => (
  <g><circle cx={x} cy={y} r={r} fill={W} {...s} strokeWidth={2.5} /><circle cx={x + 1} cy={y + 1} r={r / 2.2} fill={INK} /></g>
);

const ART: Record<GameId, () => ReactNode> = {
  'lowest-unique': () => (
    <g>
      {[['1', 44, 52, -8], ['?', 100, 40, 0], ['7', 156, 56, 9]].map(([n, x, y, rot]) => (
        <g key={String(n)} transform={`rotate(${rot} ${x} ${y})`}>
          <rect x={Number(x) - 26} y={Number(y) - 8} width={52} height={60} rx={10} fill={INK} />
          <rect x={Number(x) - 26} y={Number(y) - 14} width={52} height={60} rx={10} fill={n === '?' ? '#FF5A7A' : TILE} {...s} />
          <text x={Number(x)} y={Number(y) + 30} textAnchor="middle" fontFamily="Jua" fontSize={36} fill={n === '?' ? W : INK}>{n}</text>
        </g>
      ))}
    </g>
  ),
  'secret-number': () => (
    <g>
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`rotate(${-18 + i * 12} 100 150)`}>
          <rect x={78} y={36} width={44} height={64} rx={8} fill={i === 3 ? TILE : W} {...s} />
          <text x={100} y={78} textAnchor="middle" fontFamily="Jua" fontSize={22} fill={INK}>{[12, 38, 61, 97][i]}</text>
        </g>
      ))}
      {[40, 58, 76].map((x) => (
        <path key={x} d={`M${x} 30c-6-9-18-3-12 6l12 11 12-11c6-9-6-15-12-6z`} fill="#FF5A7A" {...s} strokeWidth={2.5} />
      ))}
    </g>
  ),
  'same-mind': () => (
    <g>
      <path d="M28 40h70a12 12 0 0 1 12 12v26a12 12 0 0 1-12 12H56l-16 14v-14H28a12 12 0 0 1-12-12V52a12 12 0 0 1 12-12z" fill={W} {...s} />
      <path d="M172 52h-70a12 12 0 0 0-12 12v26a12 12 0 0 0 12 12h42l16 14v-14h12a12 12 0 0 0 12-12V64a12 12 0 0 0-12-12z" fill={TILE} {...s} />
      <text x={63} y={72} textAnchor="middle" fontFamily="Jua" fontSize={20} fill={INK}>떡볶이</text>
      <text x={137} y={84} textAnchor="middle" fontFamily="Jua" fontSize={20} fill={INK}>떡볶이</text>
      <path d="M96 22l4 8 8 1-6 6 2 8-8-4-8 4 2-8-6-6 8-1z" fill="#FFC93C" {...s} strokeWidth={2.5} />
    </g>
  ),
  'word-bomb': () => (
    <g>
      <circle cx={92} cy={82} r={36} fill={INK} />
      <circle cx={80} cy={70} r={8} fill="#5A6190" />
      <rect x={108} y={38} width={18} height={14} rx={3} transform="rotate(35 117 45)" fill="#5A6190" {...s} />
      <path d="M124 38c8-12 22-12 30-4" fill="none" {...s} />
      <path d="M158 30l4-10 3 9 10-1-8 6 6 8-9-4-5 8-1-9-9-2z" fill="#FFC93C" {...s} strokeWidth={2} />
      {[['가', 26, 40], ['방', 162, 92], ['다', 34, 118]].map(([t, x, y]) => (
        <g key={String(t)}>
          <rect x={Number(x) - 15} y={Number(y) - 22} width={30} height={30} rx={6} fill={TILE} {...s} strokeWidth={2.5} />
          <text x={Number(x)} y={Number(y)} textAnchor="middle" fontFamily="Jua" fontSize={19} fill={INK}>{t}</text>
        </g>
      ))}
    </g>
  ),
  'treasure-bid': () => (
    <g>
      <path d="M50 68h100v44a8 8 0 0 1-8 8H58a8 8 0 0 1-8-8z" fill="#B5733F" {...s} />
      <path d="M50 68c0-26 100-26 100 0z" fill="#D18E52" {...s} />
      <rect x={92} y={70} width={16} height={18} rx={3} fill="#FFC93C" {...s} strokeWidth={2.5} />
      <path d="M62 52l10-14 10 14-10 10z" fill="#FF5A7A" {...s} strokeWidth={2.5} />
      <path d="M94 44l8-12 8 12-8 9z" fill="#35C2A0" {...s} strokeWidth={2.5} />
      <path d="M120 50l10-13 10 13-10 10z" fill="#3D6CF0" {...s} strokeWidth={2.5} />
      <rect x={16} y={18} width={30} height={42} rx={6} fill={W} {...s} transform="rotate(-12 31 39)" />
      <text x={31} y={46} textAnchor="middle" fontFamily="Jua" fontSize={20} fill={INK} transform="rotate(-12 31 39)">15</text>
    </g>
  ),
  'race-bet': () => (
    <g>
      {[44, 76, 108].map((y) => <line key={y} x1={12} y1={y + 16} x2={188} y2={y + 16} stroke={INK} strokeWidth={2} strokeDasharray="6 8" opacity={0.5} />)}
      <line x1={170} y1={30} x2={170} y2={130} stroke={INK} strokeWidth={4} />
      {[[60, 44, '#FF5A7A'], [118, 76, '#FFC93C'], [86, 108, W]].map(([x, y, c], i) => (
        <g key={i}>
          <path d={`M${Number(x) - 34} ${Number(y) + 4}h-14M${Number(x) - 32} ${Number(y) + 12}h-20`} stroke={INK} strokeWidth={3} strokeLinecap="round" />
          <ellipse cx={Number(x)} cy={Number(y) + 6} rx={22} ry={16} fill={String(c)} {...s} />
          <Eye x={Number(x) + 8} y={Number(y) + 2} r={4.5} />
          <text x={Number(x) - 8} y={Number(y) + 13} textAnchor="middle" fontFamily="Jua" fontSize={14} fill={INK}>{i + 1}</text>
        </g>
      ))}
      <circle cx={34} cy={24} r={12} fill="#35C2A0" {...s} /><text x={34} y={30} textAnchor="middle" fontFamily="Jua" fontSize={15} fill={W}>5</text>
    </g>
  ),
  'draw-relay': () => (
    <g>
      <rect x={18} y={34} width={64} height={52} rx={6} fill={W} {...s} />
      <path d="M30 70c8-18 18 8 26-6s12 4 16-2" fill="none" {...s} />
      <rect x={118} y={54} width={64} height={52} rx={6} fill={W} {...s} />
      <circle cx={150} cy={78} r={12} fill="#FFC93C" {...s} />
      <path d="M134 98c10-6 22-6 32 0" fill="none" {...s} />
      <path d="M86 60c12-6 20-2 28 6" fill="none" {...s} strokeDasharray="5 6" />
      <path d="M108 60l6 6-8 2" fill="none" {...s} />
      <g transform="rotate(35 100 110)">
        <rect x={60} y={104} width={64} height={14} rx={3} fill="#FF5A7A" {...s} />
        <path d="M124 104l16 7-16 7z" fill={TILE} {...s} />
      </g>
    </g>
  ),
  'fake-artist': () => (
    <g>
      <path d="M100 26c40 0 66 22 66 48 0 18-16 22-28 18-10-3-16 6-12 16 4 12-12 18-28 18-40 0-64-24-64-52s30-48 66-48z" fill={TILE} {...s} />
      {[[66, 54, '#FF5A7A'], [96, 44, '#3D6CF0'], [128, 54, '#35C2A0'], [68, 86, '#FFC93C']].map(([x, y, c]) => (
        <circle key={String(c)} cx={Number(x)} cy={Number(y)} r={10} fill={String(c)} {...s} strokeWidth={2.5} />
      ))}
      <circle cx={136} cy={92} r={9} fill={W} {...s} strokeWidth={2.5} />
      <path d="M86 98c6-8 14-8 18-2 4-6 12-6 18 2-6 4-12 4-18-2-6 6-12 6-18 2z" fill={INK} />
      <Eye x={98} y={80} r={5} /><Eye x={116} y={80} r={5} />
    </g>
  ),
  'monster-house': () => (
    <g>
      <path d="M40 62l60-38 60 38" fill="#FF5A7A" {...s} />
      <rect x={46} y={60} width={108} height={66} fill={TILE} {...s} />
      {[0, 1, 2].map((c) => [0, 1].map((r) => {
        const x = 54 + c * 34, y = 66 + r * 30;
        return (
          <g key={`${c}${r}`}>
            <rect x={x} y={y} width={26} height={24} rx={4} fill={INK} />
            {(c + r) % 2 === 0 ? <><Eye x={x + 8} y={y + 12} r={4} /><Eye x={x + 18} y={y + 12} r={4} /></> : <Eye x={x + 13} y={y + 12} r={6} />}
          </g>
        );
      }))}
      <path d="M150 34v-14h10v20" fill="#B5733F" {...s} />
    </g>
  ),
  'storm-captain': () => (
    <g>
      <path d="M48 26l8 16-6 2 10 18" fill="none" stroke="#FFC93C" strokeWidth={5} strokeLinejoin="round" />
      <path d="M104 30v52" {...s} />
      <path d="M106 34c22 6 34 20 36 40h-36z" fill={W} {...s} />
      <path d="M102 40c-16 6-24 18-26 34h26z" fill={TILE} {...s} />
      <path d="M58 84h96l-14 22H72z" fill="#B5733F" {...s} />
      <path d="M8 112c16-10 28 10 44 0s28 10 44 0 28 10 44 0 28 10 52 0v28H8z" fill="#1F2F94" {...s} />
      <circle cx={104} cy={24} r={6} fill="#FF5A7A" {...s} strokeWidth={2.5} />
    </g>
  ),
};

export function GameArt({ id, color, className }: { id: GameId; color: string; className?: string }) {
  const Art = ART[id];
  return (
    <svg className={className} viewBox="0 0 200 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="200" height="140" fill={color} />
      <Art />
    </svg>
  );
}
