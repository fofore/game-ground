// 게임 카탈로그: 화면과 서버가 함께 쓰는 게임 정보
export type GameId =
  | 'lowest-unique'
  | 'treasure-bid'
  | 'race-bet'
  | 'monster-house'
  | 'storm-captain'
  | 'secret-number'
  | 'same-mind'
  | 'word-bomb'
  | 'draw-relay'
  | 'fake-artist';

export interface GameInfo {
  id: GameId;
  name: string;
  tagline: string;
  genres: string[];
  minPlayers: number;
  maxPlayers: number;
  minutes: [number, number];
  solo: boolean;
  /** 지금 플레이할 수 있는지 (단계별로 열림) */
  playable: boolean;
  inspiration: { ko: string; en?: string } | null;
  rules: string[];
  color: string; // 게임 상자 색
}

export const GAMES: GameInfo[] = [
  {
    id: 'lowest-unique',
    name: '눈치 숫자',
    tagline: '작게 고르고, 겹치지 마세요.',
    genres: ['심리전'],
    minPlayers: 2,
    maxPlayers: 8,
    minutes: [3, 5],
    solo: true,
    playable: true,
    inspiration: null,
    rules: [
      '10초 안에 1부터 10 중 숫자 하나를 몰래 고릅니다.',
      '아무도 겹치지 않은 숫자 중 가장 작은 숫자를 고른 사람이 1점을 얻습니다.',
      '10라운드 점수를 합쳐 우승자를 정합니다.',
    ],
    color: '#FFC93C',
  },
  {
    id: 'secret-number',
    name: '비밀 숫자 작전',
    tagline: '말하지 않아도, 우리 순서는 통한다.',
    genres: ['협력'],
    minPlayers: 2,
    maxPlayers: 8,
    minutes: [5, 8],
    solo: false,
    playable: false,
    inspiration: { ko: '더 마인드', en: 'The Mind' },
    rules: [
      '모두에게 서로 다른 1~100 카드가 몰래 배정됩니다.',
      '숫자를 말하지 않고, 작은 카드부터 함께 내야 합니다.',
      '더 작은 카드가 남아 있었다면 생명 1개를 잃고 그 카드들은 버립니다.',
      '생명 3개로 5단계에 도전합니다. 단계마다 손패가 늘어납니다.',
    ],
    color: '#7FD1C7',
  },
  {
    id: 'same-mind',
    name: '마음 일치',
    tagline: '내 생각, 너도 했을까?',
    genres: ['공감', '대화'],
    minPlayers: 3,
    maxPlayers: 8,
    minutes: [5, 8],
    solo: false,
    playable: false,
    inspiration: { ko: '너도나도 파티' },
    rules: [
      '돌아가며 주제를 내고, 출제자도 함께 답합니다.',
      '20초 안에 답을 몰래 적고 동시에 공개합니다.',
      '나와 같은 답을 쓴 사람 수만큼 점수를 얻습니다.',
      '비슷한 표현은 묶기를 요청해 과반이 동의하면 같은 답으로 칩니다.',
    ],
    color: '#FF8FB1',
  },
  {
    id: 'word-bomb',
    name: '폭탄 단어',
    tagline: '단어를 잇고, 폭탄을 넘기세요.',
    genres: ['순발력', '단어'],
    minPlayers: 2,
    maxPlayers: 8,
    minutes: [3, 5],
    solo: false,
    playable: false,
    inspiration: { ko: '패스 더 밤', en: 'Pass the Bomb' },
    rules: [
      '주제에 맞는 단어를 차례로 입력합니다. 이미 나온 단어는 쓸 수 없어요.',
      '단어가 나오면 5초 동안 이의를 제기할 수 있고, 투표로 불인정이 과반이면 -1점.',
      '폭탄이 터질 때 들고 있던 사람은 -1점. 5라운드를 진행합니다.',
    ],
    color: '#FF7A59',
  },
  {
    id: 'treasure-bid',
    name: '보물 눈치싸움',
    tagline: '카드는 한 번, 보물은 세트로!',
    genres: ['카드', '심리전'],
    minPlayers: 2,
    maxPlayers: 8,
    minutes: [8, 12],
    solo: true,
    playable: false,
    inspiration: { ko: '독수리 눈치싸움', en: "Hol's der Geier" },
    rules: [
      '모두 1~15 카드를 들고, 매 라운드 한 장씩 동시에 냅니다. 낸 카드는 다시 못 써요.',
      '같은 숫자를 낸 사람끼리는 무효. 보물이면 가장 큰 숫자, 함정이면 가장 작은 숫자가 가져갑니다.',
      '모두 겹치면 보물이 다음 라운드로 쌓입니다.',
      '루비·사파이어·에메랄드를 한 세트 모을 때마다 +5점. 15라운드 후 합산합니다.',
    ],
    color: '#5B8DEF',
  },
  {
    id: 'race-bet',
    name: '우당탕 레이스',
    tagline: '달리는 경주를 보고, 칩을 걸어요!',
    genres: ['실시간', '베팅'],
    minPlayers: 2,
    maxPlayers: 8,
    minutes: [5, 8],
    solo: true,
    playable: false,
    inspiration: { ko: '레디 셋 벳', en: 'Ready Set Bet' },
    rules: [
      '60초 동안 자동으로 진행되는 경주를 모두 같이 봅니다.',
      '1~5 칩을 우승, 3위 안, 맞대결에 자유롭게 겁니다. 일찍 걸수록 배당이 높아요.',
      '맞히면 칩×배당만큼 얻고, 틀리면 칩만큼 잃습니다. 3경기 합산.',
    ],
    color: '#9BD35A',
  },
  {
    id: 'draw-relay',
    name: '그림 릴레이',
    tagline: '분명 처음엔 그런 뜻이 아니었는데!',
    genres: ['그림', '창작'],
    minPlayers: 3,
    maxPlayers: 8,
    minutes: [5, 10],
    solo: false,
    playable: false,
    inspiration: { ko: '텔레스트레이션', en: 'Telestrations' },
    rules: [
      '시작 문장을 적어 옆 사람에게 넘깁니다.',
      '받은 문장은 그림으로, 받은 그림은 문장으로 바꿔 계속 넘깁니다.',
      '한 바퀴가 돌면 처음부터 끝까지 함께 봅니다.',
    ],
    color: '#C3A6FF',
  },
  {
    id: 'fake-artist',
    name: '가짜 화가',
    tagline: '같이 그리는 너, 주제는 알고 있니?',
    genres: ['추리', '그림'],
    minPlayers: 4,
    maxPlayers: 8,
    minutes: [5, 10],
    solo: false,
    playable: false,
    inspiration: { ko: '가짜 예술가 뉴욕에 가다', en: 'A Fake Artist Goes to New York' },
    rules: [
      '출제자가 주제를 정하면, 출제자를 뺀 한 명이 몰래 가짜 화가가 됩니다.',
      '한 사람씩 한 획씩, 두 바퀴 그립니다.',
      '토론 후 가짜를 투표로 찾습니다. 잡혀도 가짜가 주제를 맞히면 가짜의 역전승!',
    ],
    color: '#F2B5D4',
  },
  {
    id: 'monster-house',
    name: '몬스터 하우스',
    tagline: '여섯 방의 소란을 줄여요.',
    genres: ['카드', '짝 맞추기'],
    minPlayers: 2,
    maxPlayers: 5,
    minutes: [15, 25],
    solo: true,
    playable: false,
    inspiration: { ko: '페이퍼 사파리' },
    rules: [
      '카드 6장을 3열 2줄로 놓습니다. 점수가 낮을수록 좋아요.',
      '내 차례에 새 카드나 버린 카드를 가져와 내 카드 하나와 바꿉니다.',
      '같은 세로줄의 두 카드가 같은 숫자면 0점이 됩니다.',
      '누군가 6장을 모두 펼치면 라운드 종료. 먼저 3승하면 우승!',
    ],
    color: '#8C6CF0',
  },
  {
    id: 'storm-captain',
    name: '폭풍의 선장',
    tagline: '이길 횟수를 예측하고, 정확히 맞히세요.',
    genres: ['카드', '트릭테이킹'],
    minPlayers: 3,
    maxPlayers: 8,
    minutes: [25, 40],
    solo: true,
    playable: false,
    inspiration: { ko: '스컬킹', en: 'Skull King' },
    rules: [
      '매 라운드 손패를 보고 몇 번 이길지 몰래 예측합니다.',
      '한 장씩 내며, 처음 나온 색을 따라야 합니다. 특수 카드는 언제든 낼 수 있어요.',
      '예측을 맞히면 큰 점수, 틀리면 차이만큼 감점. 10라운드 합산.',
    ],
    color: '#3FA7D6',
  },
];

export const gameById = (id: string) => GAMES.find((g) => g.id === id);

/** 검색용 정규화: 공백 제거, 소문자 */
export const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();

export function searchGames(query: string, list: GameInfo[] = GAMES) {
  const q = normalize(query);
  if (!q) return list;
  return list.filter((g) =>
    [g.name, g.tagline, ...g.genres, g.inspiration?.ko ?? '', g.inspiration?.en ?? '']
      .some((field) => normalize(field).includes(q)),
  );
}
