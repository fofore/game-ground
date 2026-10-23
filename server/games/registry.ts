import type { GameModule } from './types';
import { lowestUnique } from './lowestUnique';
import { secretNumber } from './secretNumber';
import { sameMind } from './sameMind';
import { wordBomb } from './wordBomb';

// 새 게임은 여기에 등록
export const MODULES: Record<string, GameModule> = {
  [lowestUnique.id]: lowestUnique,
  [secretNumber.id]: secretNumber,
  [sameMind.id]: sameMind,
  [wordBomb.id]: wordBomb,
};
