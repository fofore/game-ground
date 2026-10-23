import type { GameModule } from './types';
import { lowestUnique } from './lowestUnique';
import { secretNumber } from './secretNumber';
import { sameMind } from './sameMind';
import { wordBomb } from './wordBomb';
import { treasureBid } from './treasureBid';
import { raceBet } from './raceBet';
import { drawRelay } from './drawRelay';
import { fakeArtist } from './fakeArtist';
import { monsterHouse } from './monsterHouse';
import { stormCaptain } from './stormCaptain';

// 새 게임은 여기에 등록
export const MODULES: Record<string, GameModule> = Object.fromEntries(
  [lowestUnique, secretNumber, sameMind, wordBomb, treasureBid, raceBet, drawRelay, fakeArtist, monsterHouse, stormCaptain].map((m) => [m.id, m]),
);
