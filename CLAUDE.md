# 게임그라운드 작업 안내

로그인 없이 닉네임만으로 친구들과 같은 방에 모여 즐기는 온라인 파티 보드게임 카페.
운영 주소: https://game-ground.onrender.com (main 브랜치에 푸시하면 Render가 자동 배포)

## 소유자와 소통

- 소유자는 개발자가 아니에요. 설명은 한국어로, 기술 용어 없이 쉽게 해주세요.
- 목표: 계속 운영하면서 게임을 늘리고, 나중에는 수익화(광고, 결제, 도메인 등).
- 기획서(Claude 문서): https://claude.ai/artifact/98e8ZUvbGzNp6qqXituDSX

## 명령어

```bash
npm install
npm run dev                  # 화면 http://localhost:5173 + 서버 3001
npm run build && npm start   # 배포와 같은 방식, http://localhost:3001
npx tsc --noEmit             # 타입 검사
npx tsx test/games.test.ts   # 게임 규칙 테스트 (서버 필요 없음)
npx tsx test/flow.test.ts    # 방·재접속 흐름 테스트 (서버를 켠 상태에서)
```

## 푸시 전 규칙

- 타입 검사, 게임 규칙 테스트, 흐름 테스트가 **모두 통과할 때만** 커밋하고 푸시하세요.
  (`set -e` 등으로 실패하면 멈추게. 파이프 뒤에 `tail` 등을 붙여 실패를 가리지 않기)
- 게임 규칙 테스트는 무작위 요소가 있으니 여러 번 반복 실행해서 확인하세요.
- 화면을 바꾸면 휴대폰 크기(390px)에서 스크린샷으로 확인하세요. 칸이 화면 밖으로 넘치는 문제가 자주 생겼어요
  (`grid-template-columns: minmax(0, 1fr)`, 입력창 `min-width: 0`으로 해결).

## 구조

```
shared/games.ts          게임 카탈로그(이름, 원작, 규칙 문장, 색, playable) + 검색
shared/protocol.ts       화면 ↔ 서버 데이터 모양
shared/drawing.ts        그림 데이터(획, 0~1000 좌표) 검사
server/index.ts          Express + Socket.IO. 플레이어 id = 비밀 토큰의 해시
server/rooms.ts          방 생성·참가·준비·시작·재접속·방장 넘김
server/games/*.ts        게임 엔진 (게임마다 파일 하나), registry.ts에 등록
src/pages/               메인(Home), 방(RoomPage: 대기실 + 게임 화면 연결)
src/games/*.tsx          게임별 화면, common.tsx = 점수판·순위·시간 막대
src/components/          GameArt(상자 그림 SVG), Sketch(그림판), ui(팝업·방 만들기 등)
test/                    games.test.ts(규칙, 가짜 시계), flow.test.ts(소켓 흐름)
```

## 게임 엔진 규칙

- `GameModule`: `create` / `onAction`(잘못된 행동이면 오류 문장 반환) / `view(state, playerId)`.
- **비밀 정보는 서버에만.** `view`는 그 플레이어가 봐도 되는 것만 돌려줘요 (남의 손패, 가짜 화가 정체 등).
- 타이머는 `ctx.setTimer`만 사용 (방이 닫히면 자동 취소). 시간 초과 시 게임이 멈추지 않게 자동 진행.
- AI 상대(`isBot`)는 혼자 하기를 지원하는 게임에만 (`solo: true`).
- 화면의 남은 시간은 `useCountdown(deadline)` (서버 시간 기준).

### 새 게임 추가

1. `server/games/새게임.ts` 작성 → `registry.ts`에 등록
2. `src/games/새게임.tsx` 작성 → `RoomPage.tsx`에 연결
3. `shared/games.ts`에 정보 추가, `playable: true`, 상자 그림은 `GameArt.tsx`
4. `test/games.test.ts`에 규칙 테스트 추가

## 디자인

- 코발트 게임 테이블(#2B3FB8) + 크림색 글자 타일 + 두꺼운 남색 테두리와 아래 그림자.
- 글꼴: Jua(제목·숫자), IBM Plex Sans KR(본문). 직접 포함(@fontsource), 외부 글꼴 서버 사용 안 함.
- 그림은 모두 직접 그린 SVG. 원작 게임의 이름·그림·로고는 쓰지 않아요.
- 문구: 짧고 쉬운 존댓말, 버튼은 하는 일 그대로 ("방 만들기", "준비 완료").

## 원작과 출처

- 규칙 팝업 아래에 "보드게임 「원작」에서 영감을 받아 만든 게임이에요." 표기. 검색은 원작 이름(한글·영문)으로도 됨.
- 원작: 보물 눈치싸움=독수리 눈치싸움, 우당탕 레이스=레디 셋 벳, 몬스터 하우스=페이퍼 사파리,
  폭풍의 선장=스컬킹, 비밀 숫자 작전=더 마인드, 마음 일치=너도나도 파티, 폭탄 단어=패스 더 밤,
  그림 릴레이=텔레스트레이션, 가짜 화가=가짜 예술가 뉴욕에 가다, 눈치 숫자=원작 없음.
- 직접 정한 규칙(README 참고): 몬스터 하우스 카드 56장 구성, 버리면 숨은 카드 뒤집기,
  흉내쟁이는 숫자 카드만 따라 함. 폭풍의 선장은 확장 카드 제외.

## 남은 결정·할 일

- 호스팅: 지금 Render 무료(한동안 접속이 없으면 잠들어 첫 접속이 느림). 유료 전환은 소유자 결정.
- 도메인: 아직 없음.
- 아이디어: 홍보용 대표 이미지(링크 미리보기), 누적 전적, 수익화 방법.
