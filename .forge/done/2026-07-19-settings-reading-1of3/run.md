# run — 설정 다이얼로그 탭 셸 + ESC 수정 (1/3)

## 계획 대비 실제

### S1. 탭 셸 UI — 계획대로
- `src/components/SettingsModal.tsx` 재구성: 상단 탭 바(일반|한장|연속|단축키) + 활성 탭 로컬 상태(기본 "일반").
- "단축키" 탭에 기존 키맵 표 + 고정 단축키 안내(⌘,·Esc) + 기본값 복원 이동.
- "일반/한장/연속" 탭은 placeholder("이후 추가됩니다") — 파트 2·3에서 채움.
- 모달 제목 "단축키 설정" → "설정".
- `App.css`에 `.tab-bar`/`.tab-btn` 스타일 추가.

### S2. ESC 이중닫힘 수정 — 계획대로 (+캡처 경로 보강)
- `SettingsModal` keydown(capture 단계)의 Esc 처리에 `e.stopPropagation()` + `e.preventDefault()` 추가 → 설정만 닫히고 뒤(Viewer/App 전역)로 Esc 전파 차단.
- **보강**: 키 캡처 중에도 `stopPropagation()` 추가(캡처 중 키가 전역 동작으로 새지 않게). 계획엔 Esc만 명시했으나 일관성 위해.
- Viewer(`shortcutsEnabled={!settingsOpen}`)·App(`if settingsOpen return`) 기존 가드는 그대로 유지.

## 검증 (UAT)
- tsc 통과, vitest 30개(기존 테스트 회귀 없음).
- 런타임 스모크: 픽스처 자동 오픈(한장) → 합성 Cmd+,(설정 열기) → Esc → ArrowRight. `[SMOKE] pvpage idx=2` 관측 →
  체인 확인: Cmd+,가 설정을 열었고, Esc는 **설정만** 닫아 뷰어의 Esc가 억제됐으며(아카이브 생존), 이후 ArrowRight로 page 0→1 전환(idx 2 프리페치)됨. = ESC 이중닫힘 수정 + Cmd+, + 탭 전환 배선 확인.
- 임시 진단 2곳 제거 확인(grep 깨끗).

## 즉석 결정
- 캡처 중 keydown에도 stopPropagation 추가(전역 동작 오발동 방지, 보강).

## 유의(수동 UAT)
- 탭 4개의 시각적 렌더/전환, 단축키 탭에서 재지정 UI는 육안 확인 권장(코드상 기존 로직 그대로 이동).
- 일반/한장/연속 탭은 아직 placeholder(파트 2·3에서 내용 채움).
