<!-- forge-slug: open-syncs-current-folder -->
<!-- task: 6 -->
<!-- tdd: on -->
# 파일 열기 시 현재 폴더 동기화 + 이전/다음 파일 이동 (파일 연결 포함)

## Goal / Non-goals
- Goal: 파일을 어떤 경로로 열든(파일 연결 더블클릭·다이얼로그·드래그·패널 클릭) **현재 폴더를 그 파일의 폴더로 바꾸고**, 그 폴더 안에서 **이전/다음 파일 이동이 동작**하게 한다. 특히 파일 연결로 연 경우에도 패널이 해당 폴더를 보여주고 prev/next가 되도록 고친다.
- Non-goals:
  - 폴더 트리/재귀 탐색, 여러 폴더 동시 표시
  - read_dir 정렬 규칙 변경
  - 파일 연결 자체(이미 동작 확인됨) 재구현

## Source of truth
- Glossary terms: 현재 폴더(Current folder), 파일 패널, 파일 연결 — `.forge/CONTEXT.md`
- Related ADRs: none
- 결정 사항(그릴링 확정):
  - **아키텍처: "현재 폴더" 단일 소스로 통합.** 지금은 패널이 자기 `listing`을, App이 별도 `siblings`를 각각 가져 이원화돼 있음. App이 현재 폴더 + 그 폴더의 목록(하위 폴더 + 아카이브)을 단일 소유하고, **FilePanel은 제어 컴포넌트**로 바꿔 props로 렌더하고 폴더 클릭은 `onNavigate`로 위로 올린다. prev/next도 같은 목록을 쓴다(App.siblings 중복 제거).
  - **prev/next 매칭 견고화(근본 원인 수정).** 현재 `siblings.indexOf(openedPath)`는 파일 연결로 온 경로(Opened 이벤트/시작 인자, macOS에서 한글 파일명 NFC)와 read_dir 경로(NFD)가 문자열로 안 맞아 `-1`이 되어 prev/next가 죽는다. **NFC 정규화한 파일명(basename)으로 현재 폴더 아카이브 목록에서 매칭**해 인덱스를 찾고, 열린 경로(openedPath)를 매칭된 목록상의 정규 경로로 맞춘다(강조 표시·읽던 위치 키 일관성).
  - **동기화 범위: 모든 열기.** association/다이얼로그/드래그/패널 클릭 모두 현재 폴더를 파일 폴더로 설정(패널 클릭은 이미 같은 폴더라 사실상 no-op).
- Definition of Done: (1) 파일 연결(더블클릭)로 연 파일의 폴더가 패널의 현재 폴더로 바뀌고 그 파일이 목록에서 강조된다. (2) 이전/다음 파일 이동(툴바 버튼 + `,`/`.`)이 파일 연결로 연 경우에도 동작한다(**한글 파일명 포함**). (3) 다이얼로그·드래그로 연 경우도 동일하게 폴더 동기화 + prev/next. (4) 패널 폴더 클릭 탐색·파일 클릭 열기 등 기존 동작 유지.

## Work slices
- [ ] S1. 폴더 내 파일 매칭 순수 로직(TDD) — `src/lib/folder.ts`: `basename(path)`, `indexInFolder(archivePaths, target)` — NFC 정규화한 basename으로 비교해 인덱스(없으면 -1) 반환. — 완료 기준: Vitest로 정상 매칭 + **NFD/NFC 불일치(한글) 매칭** + 없음→-1 케이스가 그린
- [ ] S2. 현재 폴더를 App 단일 소스로 승격 — App이 현재 폴더 + 목록(하위 폴더/아카이브)을 소유하고 read_dir로 로드. FilePanel을 제어 컴포넌트로 전환(목록·현재파일 강조는 props, 폴더 클릭은 `onNavigate`로 위임). 기존 App.siblings 및 FilePanel 자체 listing 소유 제거. — 완료 기준: 패널 폴더 탐색·파일 열기·현재 파일 강조가 기존대로 동작(수동) + `tsc`/빌드 통과 (depends: S1)
- [ ] S3. 파일 열기 시 현재 폴더 동기화 + prev/next 배선 — `openPath`(모든 소스)가 현재 폴더=`dirname(path)`로 설정하고 목록 로드, S1으로 열린 파일을 현재 폴더 아카이브에서 매칭해 openedPath를 정규 경로로 맞춤. prev/next는 현재 폴더 아카이브 목록 + 매칭 인덱스로 계산. — 완료 기준: 파일 연결로 연 파일이 패널 현재 폴더로 반영되고 prev/next(버튼·`,`/`.`)가 동작 — **한글 파일명 포함 런타임 확인**(직전 회고 교훈: GUI/파일연결 배선은 런타임 dispatch/실경로 스모크로 검증) (depends: S1, S2)
