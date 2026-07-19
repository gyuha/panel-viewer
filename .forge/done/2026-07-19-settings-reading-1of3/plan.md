<!-- forge-slug: settings-reading-1of3 -->
<!-- task: 10 -->
<!-- part: 1/3 -->
<!-- tdd: on -->
# 설정 다이얼로그 탭 셸 + ESC 수정 (1/3)

## Goal / Non-goals
- Goal: 설정 다이얼로그를 4개 탭(**일반 | 한장 | 연속 | 단축키**)으로 재구성한다. 기존 단축키 설정 UI는 "단축키" 탭으로 그대로 옮긴다. 설정 다이얼로그에서 **Esc를 누르면 설정만 닫히고, 뒤의 읽던 파일(아카이브)은 닫히지 않는다**.
- Non-goals:
  - 일반/한장/연속 탭의 **실제 옵션 내용** — 이 파트는 탭 셸만. 내용은 파트 2·3에서 채움(지금은 빈/placeholder).
  - 이미지 맞춤, 마지막 파일 열기, 파일 이어보기 동작 — 파트 2·3.

## Source of truth
- Glossary terms: 보기 모드, 단축키 — `.forge/CONTEXT.md`
- Related ADRs: none
- 기존 코드: `src/components/SettingsModal.tsx`(현재 단일 화면: 키맵 표 + 고정 단축키 안내 + 기본값 복원), App의 `settingsOpen`/`shortcutsEnabled={!settingsOpen}` 배선, Viewer/App keydown 가드.
- 결정 사항(그릴링 확정):
  - 탭 4개, 기본 탭 = **일반**. 단축키 탭 = 기존 키맵 표 + 고정 단축키 안내(⌘,·Esc) 이동.
  - **ESC 수정**: SettingsModal의 Esc 처리에서 `stopPropagation()`(+`preventDefault()`) 호출해 뒤 리스너(Viewer/App)로 전파 차단. 현재 `shortcutsEnabled` 가드도 재확인. (실제 이중닫힘 원인은 실행 시 코드로 확정.)
- Definition of Done: 설정 다이얼로그 상단에 일반/한장/연속/단축키 탭이 있고 클릭 전환된다. 단축키 탭에서 기존처럼 커스텀 키 재지정이 동작한다. 파일을 연 상태에서 설정을 열고 **Esc를 누르면 설정만 닫히고 아카이브는 그대로** 남는다.

## Work slices
- [ ] S1. 탭 셸 UI — `SettingsModal.tsx`에 탭 바(일반|한장|연속|단축키) + 활성 탭 로컬 상태(기본 "일반"). "단축키" 탭에 기존 키맵 표 + 고정 단축키 안내 이동. "일반/한장/연속" 탭은 placeholder("이후 추가"). 탭 스타일은 `App.css`에 최소 추가. — 완료 기준: tsc 통과 + 탭 전환·단축키 재지정 런타임 확인
- [ ] S2. ESC 이중닫힘 수정 — 설정 열림 상태 Esc의 실제 전파 경로를 코드로 확인하고, `SettingsModal` Esc 처리에 `stopPropagation()`(+필요 시 `preventDefault()`) 추가. Viewer/App의 `settingsOpen`/`shortcutsEnabled` 가드 재확인. — 완료 기준: 파일 연 상태에서 설정 Esc → 설정만 닫힘(아카이브 유지) 런타임 확인 (depends: S1)
