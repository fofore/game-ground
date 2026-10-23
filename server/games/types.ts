// 모든 게임이 따르는 공통 틀
export interface GamePlayer {
  id: string;
  nickname: string;
  isBot: boolean;
}

export interface GameContext {
  /** 상태가 바뀌었으니 모두에게 다시 보내기 */
  update(): void;
  /** ms 후에 fn 실행 (방이 끝나면 자동 취소) */
  setTimer(ms: number, fn: () => void): void;
  clearTimers(): void;
  /** 게임 종료 */
  finish(): void;
  now(): number;
}

export interface GameModule<S = any> {
  id: string;
  create(players: GamePlayer[], ctx: GameContext): S;
  /** 플레이어 행동 처리. 잘못된 행동이면 오류 문장을 돌려줌 */
  onAction(state: S, playerId: string, action: any, ctx: GameContext): string | void;
  /** 이 플레이어에게 보여줄 상태 (남의 비밀은 숨김) */
  view(state: S, playerId: string): unknown;
}
