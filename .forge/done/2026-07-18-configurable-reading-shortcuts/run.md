<!-- forge-slug: configurable-reading-shortcuts -->
# RUN — 설정 가능한 읽기 단축키 + 단축키 설정 모달 (configurable-reading-shortcuts)

## 계획대로 된 것
- **S1 키맵 순수 로직(TDD)**: `src/lib/keymap.ts` — 6개 동작(Action), 표준 키(고정)·기본 커스텀 키(`.`/`,`), `resolve(key, custom, mode)`(모드별 유효 동작 반영), `findConflict`, `isAssignableKey`. Vitest 12개 그린.
- **S2 Rust 키바인딩 영속(TDD)**: `state.rs` PersistedState에 `keybindings`(동작→키) 맵 추가(serde default). `save_keybindings` 커맨드. cargo 테스트 5개 그린(왕복 + 필드 없는 구버전 JSON→빈 맵 마이그레이션).
- **S3 커스텀 키 배선**: App이 시작 시 저장된 키바인딩을 기본값과 병합해 보유. 파일 이동 키는 Viewer의 window keydown에서(한장·연속 두 모드) `resolve`로 판별해 `onPrevFile`/`onNextFile` 호출. 페이지 이동 키는 PageView에서 `resolve(…, "page")`로 표준+커스텀 처리(기존 하드코딩 switch를 resolve 기반으로 교체). 모달 열림 중엔 `shortcutsEnabled=false`로 미발동.
- **S4 설정 모달**: `SettingsModal.tsx` — 파일 패널 하단 "⌨︎ 단축키 설정" 버튼으로 열림. 6개 동작의 표준 키 + 편집 가능한 커스텀 키(행 클릭→키 캡처), 충돌 시 거부+안내("그 키는 X에 사용 중"), 커스텀 키 지우기(✕), "기본값 복원", Esc로 닫기. 변경 시 `save_keybindings`로 영속.

## 계획과 달라진 점 / 현장 결정 (낮음)
- **표준 키 처리 통합**: PageView의 하드코딩 키 switch를 `resolve()` 기반 디스패치로 교체(표준 키가 `STANDARD_KEYS`에 정의됨). 파일 이동은 Viewer, 페이지 이동은 PageView가 담당해 이중 처리 없음(resolve의 모드 필터로 분리).
- **UI 편의 추가**: `ACTION_LABELS`(한글 라벨)와 `keyLabel`(Space/→ 등 표기) 헬퍼, 커스텀 키 지우기 버튼 — 플랜엔 명시 안 됐으나 모달 사용성에 필요.
- **모달 키 캡처는 capture phase**(`addEventListener(…, true)`)로 가로채 다른 핸들러보다 먼저 처리.
- **설정 버튼 위치**: 파일 패널 하단 푸터(`.panel-foot`) 신설.

## 검증 범위
- **기계 검증됨**: cargo test 14(keymap 관련 state 5 포함) · vitest 15(nav 3 + keymap 12) · `tsc && vite build` · `cargo build` 모두 그린. **키보드 파일 이동은 런타임 확인**: 연속 모드에서 `.`→다음 파일, `,`→이전 파일 정확히 동작(003→004→003), 핑퐁 없음.
- **사용자 수동 확인 필요(플랜 S4 기준)**: 설정 모달 실제 열기·행 클릭 캡처·충돌 거부 메시지·기본값 복원의 화면 동작, 재시작 후 커스텀 키 유지, 한장 모드에서의 키 동작. (모달 로직 자체인 resolve/findConflict/isAssignableKey와 영속 왕복은 단위 테스트로 커버됨.)

## 코드 리뷰
- 위험 영역(인증/DB/공개 API/마이그레이션) 아님. 상태 필드 추가는 하위호환(serde default + 구버전 JSON 로드 테스트로 검증). 별도 적대적 리뷰 페이즈 생략.
