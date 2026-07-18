# run — 한장 모드에서 마우스 휠로 페이지 넘김

## 계획 대비 실제

### S1. 휠 쿨다운 게이팅 순수 로직 (TDD) — 계획대로
- `src/lib/nav.ts`에 `wheelTurn(deltaY, now, lastTurnAt, cooldownMs): WheelTurn` 추가.
  - `deltaY === 0` 또는 `now - lastTurnAt < cooldownMs` → `{ turn: false, dir: 1 }`.
  - 그 외 → `{ turn: true, dir: deltaY > 0 ? 1 : -1 }` (1=다음, -1=이전).
- 테스트 우선: `src/lib/nav.test.ts`에 5개 케이스 추가 후 red 확인 → 구현 → green.
  - 쿨다운 내 무시 / 아래=다음 / 위=이전 / 경계(now-last==cooldown)에서 전환 / deltaY=0 무시.
- 완료 기준(Vitest 그린) 충족: `nav.test.ts` 8 tests 통과(기존 3 + 신규 5).

### S2. PageView 휠 배선 — 계획대로 (구현 방식 1건 결정)
- `src/components/PageView.tsx`:
  - `stageRef`(HTMLDivElement) + `lastWheelAt`(number) ref 추가, `WHEEL_COOLDOWN_MS = 200`.
  - 스테이지에 wheel 리스너 부착 effect: `shortcutsEnabled`일 때만 `wheelTurn`으로 판단 → `turn`이면 `preventDefault` + `lastWheelAt` 갱신 + dir에 따라 `goNext`/`goPrev`.
  - `<div className="viewer-stage" ref={stageRef}>`.
- 경계 멈춤은 `goNext`/`goPrev`가 쓰는 `nextPage`/`prevPage`의 기존 클램프로 처리(추가 코드 없음).
- ContinuousView 등 그 외 미변경 → 연속 모드는 네이티브 스크롤 유지.

## 즉석 결정
- **휠 리스너를 React `onWheel` 대신 네이티브 `addEventListener("wheel", …, { passive: false })`로 부착.**
  이유: React는 wheel을 passive로 등록해 `e.preventDefault()`가 no-op이 되고 콘솔 경고가 난다.
  스테이지에 직접 non-passive로 붙여 preventDefault가 실제로 먹도록 함. 기존 keydown effect 패턴과 일관.
- 반환 타입에서 `turn: false`일 때 `dir`는 무의미하지만 타입 단순화를 위해 `dir: 1`로 고정(-1|1 유니온 유지).

## 검증 상태
- 기계 검증 완료: `tsc --noEmit` 통과, `vitest run` 전체 27 통과(휠 순수 로직 5 포함), 기존 Rust 영향 없음(프론트만 변경).
- GUI 동작(실제 휠로 페이지 전환/쿨다운 체감/연속 모드 스크롤)은 `task dev` 수동 확인 필요 — 이 저장소는 GUI가 기계 테스트 불가(CLAUDE.md "Testing reality").

## 막힌 곳
- 없음.
