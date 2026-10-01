# 실행 기록 — 상위 폴더로 이동하면 방금 떠난 폴더로 파일 패널 스크롤 복원

## 슬라이스 결과
- S1 `leftFolderPath` 순수 함수 + 테스트(red 확인 후 green) — ✅ as planned
- S2 App/FilePanel 연결(`returnFolder` 상태, `scrollIntoView({block:"center"})`, `.dir-row.return` CSS) — ✅ as planned
- S3 `task dev` 수동 확인 — ⏳ 미실시(GUI는 자동화 불가, 사용자 확인 대기)

## DoD baseline → after
- DoD1 `vitest folder.test.ts`: 4 passed → 7 passed (새 테스트 3개는 구현 전 red 확인)
- DoD2 `task check`: 통과 → 통과 (회귀 방지)
- DoD3 `task test`: Vitest 73 · cargo 29 통과 → 통과 (회귀 방지)
- DoD4 수동: 미확인

## 차이/결정
- 워크플로우 없이 직접 실행(소규모). `navigate`에 `{ up?: boolean }` 옵션을 추가하고 `listingRef`로 떠나기 전 현재 폴더를 읽음. `openPath`의 폴더 동기화는 표시를 지움.
- `leftFolderPath`는 `indexInFolder` 위의 얇은 래퍼(경로 반환) — 계획된 순수 함수.
