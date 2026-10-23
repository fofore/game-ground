// 그림 데이터: 획 목록. 좌표는 0~1000 정수 (화면 크기와 무관)
export const PALETTE = ['#1D2142', '#FF5A7A', '#2B3FB8', '#22A57A', '#FFC93C', '#8C5A3C'];
export const WIDTHS = [4, 10, 22];

export interface Stroke { c: number; w: number; p: number[] } // p = [x1, y1, x2, y2, ...]
export type Drawing = Stroke[];

const MAX_STROKES = 400;
const MAX_POINTS = 600;

/** 받은 그림을 검사하고 안전한 값으로 정리 (잘못된 값이면 null) */
export function cleanStroke(raw: any): Stroke | null {
  if (!raw || !Array.isArray(raw.p)) return null;
  const c = Number(raw.c), w = Number(raw.w);
  if (!Number.isInteger(c) || c < 0 || c >= PALETTE.length) return null;
  if (!Number.isInteger(w) || w < 0 || w >= WIDTHS.length) return null;
  const p = raw.p.slice(0, MAX_POINTS * 2).map((n: unknown) => Math.max(0, Math.min(1000, Math.round(Number(n)) || 0)));
  if (p.length < 2 || p.length % 2) return null;
  return { c, w, p };
}

export function cleanDrawing(raw: any): Drawing {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_STROKES).map(cleanStroke).filter((s): s is Stroke => !!s);
}
