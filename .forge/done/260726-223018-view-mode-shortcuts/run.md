# RUN — 보기 모드 전환 단축키 (view-mode-shortcuts)

실행 방식: **Dynamic Workflow 미사용, 직접 실행**. 변경 5파일 · 약 100줄로 서브에이전트 병렬화 이득이 오케스트레이션 비용보다 작다고 판단. `eco` off, `tdd: on`(테스트 우선 준수).

## 계획대로 된 것
- **S1 (TDD)** — `keymap.test.ts`에 `보기 모드 전환 동작` describe 블록(6 it) 먼저 추가 → 6개 실패(red) 확인 → `keymap.ts` 구현 → 26개 그린(기존 20 + 신규 6, 회귀 0). `Action` 유니온·`ACTIONS`·`ACTION_LABELS`·`STANDARD_KEYS`·`DEFAULT_CUSTOM` 확장 + `MODE_ACTIONS` 상수 + `actionsFor()`가 두 모드 모두에 포함.
- **S2** — `Viewer.tsx`의 기존 window keydown `resolve` 분기에 `modePage`→`onModeChange("page")`, `modeContinuous`→`onModeChange("continuous")` 추가(`preventDefault` + deps에 `onModeChange`). 플랜대로 App 전역이 아니라 Viewer 범위.
- **S3** — 툴팁에 지정 키 동적 노출. `한장`/`연속` 버튼은 `MODES` 항목에 `action`을 실어 `customKeys[m.action]`으로 해결.
- **S4(코드 부분)** — 예상대로 `SettingsModal`은 **코드 변경 0**. `ACTIONS` 순회만으로 2행이 붙는다(플랜의 전제가 맞았음).
- Rust는 손댈 것 없음(플랜 예측대로). `task check`(tsc + cargo check) 통과, `task test` 프론트 43 / Rust 27 전부 그린.

## Divergences
1. **`(/)` 하드코딩이 1곳이 아니라 3곳이었다.** 그릴링에서 `Viewer.tsx:88`만 보고했으나 실제로는 `FilePanel.tsx:63`("파일 목록 숨기기 (/)"), `App.tsx:384`("파일 목록 (/)")도 같은 거짓 툴팁. 사용자 승인은 이 결함의 클래스에 대한 것이라 판단해 **3곳 모두 수정**. 2곳만 고치면 그릴링에서 스스로 반대했던 "일부는 정직, 일부는 거짓" 상태가 되므로 부분 수정은 선택지가 아니었음. → **그릴링 시 결함 보고는 grep으로 전수 조사 후 개수를 말해야 한다**(회고 후보).
2. **`FilePanel`에 prop 1개 추가** — `customKeys` 전체를 내리지 않고 필요한 `togglePanelKey: string` 하나만. FilePanel은 키맵을 몰라도 되게 유지.
3. **`keyLabel`을 `SettingsModal` 모듈 로컬 → `keymap.ts` export로 이동**(플랜에 없던 이동). 툴팁이 두 번째 소비자가 되면서 복제하면 갱신 지점이 둘로 갈리기 때문. 동작 변경 없는 이동이라 별도 테스트 미추가.
4. **`withKey` 헬퍼도 `keymap.ts`로** — 처음엔 `Viewer` 로컬에 뒀다가 소비자가 3곳(Viewer·FilePanel·App)이 되어 이동. 결과적으로 키 표시 포맷팅이 `keymap.ts` 한 곳에 모임.
5. **S4의 모달 높이는 코드로 못 끝냈다 — UAT로 이월.** `.modal { min-height: min(660px, 86vh) }`는 "단축키 탭 8행 ~653px" 실측 기준값이고, 행당 ~43px(td padding 16 + 버튼 26 + border 1) × 2행 = **+86px → ~739px 추정**이므로 긴 창에서는 탭 전환 시 79px 점프가 예상된다. 다만 픽셀 실측 없이 magic number를 새로 박는 것은 무검증 변경이라(추정이 틀리면 네 탭 전부에 죽은 여백이 생김) **CSS는 손대지 않고** 육안 확인 후 판단하도록 남김.
6. **런타임 스모크 미실행.** GUI가 필요해(`task dev`) 이 세션에서 실행하지 못했고, 직전 동일 영역 회고의 최우선 교훈("GUI 배선은 빌드·단위테스트로 안 잡힌다")이 정확히 걸리는 지점이라 **UAT의 필수 항목으로 넘김**. 컴파일·단위테스트 통과는 배선 정상의 증거가 아니다.

## 코드 리뷰
위험 영역(인증·데이터 변경·공개 API·마이그레이션)에 해당하지 않고 규모도 작아 별도 리뷰 페이즈 미실행(§3의 trivial 예외). 자체 diff 확인에서 발견된 문제는 위 Divergence 1(전수 조사 누락)뿐.

## 변경 파일
- `src/lib/keymap.ts` — 동작 2종 추가, `MODE_ACTIONS`, `keyLabel`/`withKey` export
- `src/lib/keymap.test.ts` — describe 1개(6 it) 추가
- `src/components/Viewer.tsx` — keydown 분기 2개, `MODES.action`, 툴팁 3→2곳 동적화
- `src/components/FilePanel.tsx` — `togglePanelKey` prop + 툴팁 동적화
- `src/App.tsx` — `togglePanelKey` 전달, 빈 화면 툴팁 동적화
- `src/components/SettingsModal.tsx` — `keyLabel` 로컬 정의 제거 → import
