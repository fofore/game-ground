// 공용 그림판: 보기 전용 / 자유 그리기 / 한 획만 그리기
import { useEffect, useRef, useState } from 'react';
import { PALETTE, WIDTHS, type Drawing, type Stroke } from '../../shared/drawing';

function paint(ctx: CanvasRenderingContext2D, size: number, strokes: Drawing, faded?: (i: number) => boolean) {
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);
  const k = size / 1000;
  strokes.forEach((s, i) => {
    ctx.globalAlpha = faded?.(i) ? 0.35 : 1;
    ctx.strokeStyle = PALETTE[s.c];
    ctx.fillStyle = PALETTE[s.c];
    ctx.lineWidth = WIDTHS[s.w] * k * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (s.p.length === 2) {
      ctx.beginPath(); ctx.arc(s.p[0] * k, s.p[1] * k, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(s.p[0] * k, s.p[1] * k);
    for (let j = 2; j < s.p.length; j += 2) ctx.lineTo(s.p[j] * k, s.p[j + 1] * k);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

/** 획 목록을 그리는 캔버스. onStroke가 있으면 손가락/마우스로 그릴 수 있음 */
export function Sketch({ strokes, onStroke, color = 0, width = 1, faded, label }: {
  strokes: Drawing;
  onStroke?: (s: Stroke) => void;
  color?: number;
  width?: number;
  faded?: (i: number) => boolean;
  label?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef<number[] | null>(null);
  const [px, setPx] = useState(600);

  // 화면 크기에 맞춰 선명하게
  useEffect(() => {
    const c = ref.current!;
    const ro = new ResizeObserver(() => setPx(Math.round(c.clientWidth * (window.devicePixelRatio || 1))));
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = ref.current!;
    c.width = px; c.height = px;
    const extra = live.current ? [{ c: color, w: width, p: live.current }] : [];
    paint(c.getContext('2d')!, px, [...strokes, ...extra], faded);
  }, [strokes, px, faded]);

  function point(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * 1000), Math.round(((e.clientY - r.top) / r.height) * 1000)];
  }
  function redrawLive() {
    const c = ref.current!;
    paint(c.getContext('2d')!, c.width, [...strokes, { c: color, w: width, p: live.current! }], faded);
  }

  return (
    <canvas
      ref={ref}
      className={`sketch ${onStroke ? 'drawable' : ''}`}
      role="img"
      aria-label={label ?? '그림'}
      onPointerDown={onStroke ? (e) => { e.currentTarget.setPointerCapture(e.pointerId); live.current = point(e); redrawLive(); } : undefined}
      onPointerMove={onStroke ? (e) => {
        if (!live.current) return;
        const [x, y] = point(e);
        const n = live.current.length;
        if (Math.hypot(x - live.current[n - 2], y - live.current[n - 1]) < 6 || n >= 1200) return;
        live.current.push(x, y);
        redrawLive();
      } : undefined}
      onPointerUp={onStroke ? () => {
        const p = live.current; live.current = null;
        if (p) onStroke({ c: color, w: width, p: p.map((v) => Math.max(0, Math.min(1000, v))) });
      } : undefined}
      onPointerCancel={() => { live.current = null; }}
    />
  );
}

/** 색·굵기 고르기 */
export function SketchTools({ color, width, onColor, onWidth, children, showColors = true }: {
  color: number; width: number; onColor: (c: number) => void; onWidth: (w: number) => void; children?: React.ReactNode; showColors?: boolean;
}) {
  return (
    <div className="sketch-tools">
      {showColors && <div className="swatches" role="radiogroup" aria-label="색">
        {PALETTE.map((c, i) => (
          <button key={c} role="radio" aria-checked={color === i} aria-label={`색 ${i + 1}`} className={`swatch ${color === i ? 'on' : ''}`} style={{ background: c }} onClick={() => onColor(i)} />
        ))}
      </div>}
      <div className="widths" role="radiogroup" aria-label="굵기">
        {WIDTHS.map((w, i) => (
          <button key={w} role="radio" aria-checked={width === i} aria-label={['가늘게', '보통', '굵게'][i]} className={`wbtn ${width === i ? 'on' : ''}`} onClick={() => onWidth(i)}>
            <i style={{ width: w * 0.9 + 4, height: w * 0.9 + 4 }} />
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
