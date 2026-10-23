# 게임그라운드

로그인 없이 닉네임만으로 친구들과 같은 방에 모여 즐기는 온라인 파티 보드게임 카페.

## 지금 되는 것 (1단계 + 첫 게임)

- 메인 화면: 게임 10종 목록, 게임 이름·원작 이름·장르 검색, 종류별 필터
- 방 만들기: 친구만(코드·링크, 비밀번호 선택) / 누구나(공개 방 목록)
- 방 코드 6자리 입력, `?room=코드` 링크로 바로 참가
- 대기실: 자리 현황, 준비, 방장 시작, 내보내기, 친구 초대(공유·링크 복사)
- 재접속: 새로고침하거나 끊겨도 같은 방, 같은 자리로 복귀
- 규칙 팝업: 첫 플레이 때 자동 표시, 원작 출처 표기
- **눈치 숫자**: 여럿이 하기 + AI 상대 혼자 하기 완성
- 나머지 9종은 "곧 열려요" 상태 (규칙 보기만 가능)

## 실행

```bash
npm install
npm run dev        # 개발: 화면 http://localhost:5173, 서버 3001
npm run build && npm start   # 배포용: http://localhost:3001 하나로 실행
npm test           # 서버를 켠 상태에서 흐름 테스트
```

## 구조

```
shared/games.ts         게임 카탈로그(이름, 원작, 규칙, 색) + 검색
shared/protocol.ts      화면 ↔ 서버 데이터 모양
server/index.ts         Express + Socket.IO 서버
server/rooms.ts         방 생성·참가·준비·시작·재접속
server/games/           게임 엔진 (게임마다 파일 하나, registry.ts에 등록)
src/pages/              메인, 방(대기실·게임)
src/games/              게임별 화면
src/components/GameArt  게임 상자 그림 (직접 그린 SVG)
```

### 새 게임 추가하는 법

1. `server/games/새게임.ts`에 `GameModule`(create / onAction / view) 작성
2. `server/games/registry.ts`에 등록
3. `src/games/새게임.tsx` 화면 작성 후 `RoomPage.tsx`에 연결
4. `shared/games.ts`에서 `playable: true`

## 배포 (Render)

저장소의 `render.yaml`로 설정이 들어 있습니다. Render에서 이 GitHub 저장소를 연결하면 푸시할 때마다 자동 배포됩니다.
