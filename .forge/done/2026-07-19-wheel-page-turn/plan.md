<!-- forge-slug: wheel-page-turn -->
<!-- task: 7 -->
<!-- retro-hint: optional -->
<!-- tdd: on -->
# 한장 모드에서 마우스 휠로 페이지 넘김

## Goal / Non-goals
- Goal: 한장(page) 보기 모드에서 마우스 휠로 아카이브 안의 페이지를 넘긴다 — 휠 아래=다음 페이지, 휠 위=이전 페이지. 쿨다운으로 한 제스처에 과도하게 넘어가지 않게 한다.
- Non-goals:
  - 연속(continuous) 모드 휠 동작 변경 — 기존 네이티브 스크롤 유지
  - 경계(첫/마지막 페이지)에서 다음/이전 **파일**로 체이닝 — 그냥 멈춤(클램프)
  - 휠로 아카이브(파일) 이동 — 휠은 페이지 전용
  - 트랙패드 관성의 정밀한 1제스처=1페이지 — 쿨다운 근사로 충분

## Source of truth
- Glossary terms: 보기 모드, 페이지 — `.forge/CONTEXT.md`
- Related ADRs: none
- 결정 사항(그릴링 확정):
  - **대상**: 아카이브 안의 페이지(cbz/cbr 이미지 항목). 휠 아래=다음 페이지, 위=이전.
  - **한장 모드 전용.** 연속 모드는 미변경(휠=네이티브 스크롤).
  - **쿨다운 방식.** 휠 이벤트 1회 → 1페이지, 이후 ~200ms 동안 추가 휠 무시(마우스 노치 1=1페이지, 트랙패드 관성은 쿨다운으로 제한).
  - **경계 클램프.** 첫 페이지에서 위/마지막 페이지에서 아래는 멈춤(파일로 안 넘어감).
  - **설정 모달 열림 중엔 미발동**(기존 shortcutsEnabled 재사용).
- Definition of Done: 한장 모드에서 휠 아래로 굴리면 다음 페이지, 위로 굴리면 이전 페이지로 전환되고, 빠르게 굴려도 쿨다운으로 한 번에 여러 장 튀지 않는다. 첫/마지막 페이지에서 멈춘다. 연속 모드 스크롤은 그대로다.

## Work slices
- [ ] S1. 휠 쿨다운 게이팅 순수 로직(TDD) — `src/lib/nav.ts`에 `wheelTurn(deltaY, now, lastTurnAt, cooldownMs)` 추가: 쿨다운(now-lastTurnAt < cooldownMs) 내면 `{turn:false}`, 지났고 deltaY≠0이면 `{turn:true, dir: deltaY>0?1:-1}`(1=다음,-1=이전), deltaY=0이면 turn:false. — 완료 기준: Vitest로 쿨다운 게이팅·방향(±)·0 케이스가 그린
- [ ] S2. PageView 휠 배선 — `viewer-stage`에 `onWheel`: `shortcutsEnabled`일 때만, `wheelTurn`으로 판단해 `goNext`/`goPrev` 호출하고 `lastTurnAt` ref 갱신, `e.preventDefault()`. 경계는 기존 `nextPage`/`prevPage` 클램프로 처리. ContinuousView·기타 미변경. — 완료 기준: 한장 모드에서 휠 아래=다음/위=이전 페이지 동작 + 빠른 휠이 쿨다운으로 억제됨(런타임 확인), 연속 모드 스크롤 정상(수동) (depends: S1)
