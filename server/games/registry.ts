import type { GameModule } from './types';
import { lowestUnique } from './lowestUnique';

// 새 게임은 여기에 등록
export const MODULES: Record<string, GameModule> = {
  [lowestUnique.id]: lowestUnique,
};
