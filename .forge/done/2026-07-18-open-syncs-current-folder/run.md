<!-- forge-slug: open-syncs-current-folder -->
# RUN — 파일 열기 시 현재 폴더 동기화 + 이전/다음 파일 이동 (open-syncs-current-folder)

## 계획대로 된 것
- **S1 폴더 내 파일 매칭 순수 로직(TDD)**: `src/lib/folder.ts` — `basename`(/, \ 처리), `indexInFolder`(NFC 정규화 basename 비교로 인덱스, 없으면 -1). Vitest 4개 그린(정상·없음·**한글 NFD/NFC 불일치 매칭**).
- **S2 현재 폴더를 App 단일 소스로 승격**: App이 `listing`(현재 폴더 목록) + `folderError`를 소유하고 `navigate`로 read_dir. FilePanel을 **제어 컴포넌트**로 전환(listing/openedPath/error는 props, 폴더 클릭은 `onNavigate`). 기존 App.siblings·siblingsDir·initialFolder·FilePanel 자체 listing/navigate 제거(이원화·중복 read_dir 해소).
- **S3 파일 열기 시 현재 폴더 동기화 + prev/next**: `openPath`(모든 소스)가 현재 폴더=`dirname(path)`로 read_dir해 listing 설정 + `saveLastFolder`, `indexInFolder`로 열린 파일을 현재 폴더 아카이브에서 매칭해 openedPath를 정규 경로로 맞춤(강조·읽던 위치 키 일관). prev/next는 현재 폴더 아카이브(`folderArchives`) + 매칭 인덱스로 계산.

## 계획과 달라진 점 / 현장 결정 (낮음)
- **prev/next 범위 = 현재 폴더(통합 모델의 귀결)**: 파일을 열면 현재 폴더=그 파일 폴더가 되어 prev/next 동작. 사용자가 패널에서 다른 폴더로 이동하면 현재 폴더가 바뀌어 열린 파일이 그 목록에 없으면 prev/next는 비활성(단일 소스 통합의 자연스러운 귀결, 읽기 흐름엔 영향 없음).
- `dirname` 헬퍼(App)와 `basename`(folder.ts)로 경로 조각 처리 분리.

## 검증 범위
- **기계 검증됨**: vitest 22(nav 3 + keymap 15 + folder 4) · cargo test 14 · `tsc && vite build` · `cargo build` 그린. **런타임 확인(핵심)**: 한글 파일을 **NFC 경로(파일 연결 형태)로 openPath** 하니 현재 폴더가 동기화되고, `.` 키로 다음 파일(003→004)이 열림 — NFC↔NFD 매칭으로 currentIndex가 잡혀 prev/next 동작 확인.
- **사용자 수동 확인 필요**: 실제 Finder 더블클릭(association) 시 패널이 그 폴더를 보여주고 파일이 강조되는 화면, 다이얼로그·드래그 열기의 폴더 동기화. (매칭·인덱스 로직과 NFC/NFD 케이스는 단위 테스트 + NFC openPath 런타임으로 커버.)

## 코드 리뷰
- 위험 영역 아님(로컬 폴더 읽기·프론트 상태). FilePanel 제어화는 구조 변경이나 동작 보존(빌드/타입 통과). 별도 적대적 리뷰 생략.
