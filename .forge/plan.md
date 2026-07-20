<!-- forge-slug: archive-prefetch-cache -->
<!-- task: 14 -->
<!-- tdd: off -->
# 아카이브 페이지 백그라운드 프리페치 + 인메모리 캐시

## Goal / Non-goals
- Goal: 아카이브를 열면 현재 페이지는 즉시 표시하고, 백그라운드 스레드가 전체 페이지를 순차로 추출해 인메모리 바이트 캐시에 채운다. 이후 스크롤·페이지 이동 시 페이지 바이트를 RAM에서 즉시 서빙해, 네트워크 드라이브에서도(특히 RAR) 끊김을 없앤다.
- Non-goals: 이웃 코믹 아카이브 예열(현재 폴더의 다음/이전 파일 미리 읽기). 프런트 변경 — 연속 뷰 `loading="lazy"`, PageView의 ±1 `new Image()` 프리페치, `Cache-Control: no-cache`는 모두 불변. 메모리 상한(cap)·디스크 임시 캐시·웹뷰 캐싱은 이번 범위 밖.

## Source of truth
- Glossary terms: 페이지(Page), 코믹 아카이브(Comic archive), 읽던 위치(Reading position) in `.forge/CONTEXT.md`
- Related ADRs: `.forge/adr/260721-003136-open-prefetch-all-pages-cache.md` (이 결정), `.forge/adr/260718-15a-cbr-unrar-crate.md` (RAR = unrar, 순차 처리)
- Definition of Done: 네트워크 드라이브(또는 대용량 로컬 cbr)의 아카이브를 연속 모드로 열어 스크롤할 때, 첫 페이지가 즉시 뜨고 백그라운드 채움이 끝난 뒤 후속 페이지가 끊김 없이 표시된다. 순차 추출한 바이트가 온디맨드(`read_page`)와 동일하고, 파일을 빠르게 전환해도 이전 아카이브의 페이지가 새 아카이브에 섞이지 않는다.

## Work slices
- [ ] S1. 세션에 페이지 바이트 캐시(`index → bytes`) + 세대(generation) id 도입, `pvpage://` 프로토콜 핸들러를 **캐시 우선 조회 → 미스 시 온디맨드 `read_page` 폴백**으로 변경. 캐시는 백그라운드 스레드와 공유되므로 락 임계구역은 짧게. — completion: 캐시에 있는 index 요청 시 `read_page`를 호출하지 않고 캐시 바이트를 반환하고, 없는 index는 기존과 동일한 바이트를 반환한다(단위 테스트).
- [ ] S2. `open_archive`에서 백그라운드 스레드로 **전체 순차 추출**(ZIP: 아카이브 핸들 1개로 페이지 순서대로 읽기 / RAR: `open_for_processing` 1패스로 헤더를 돌며 이미지 항목을 추출, 항목명→index 매핑으로 캐시에 저장). 각 삽입 전에 세대 id가 최신인지 확인. — completion: 아카이브를 연 뒤 잠시 후 모든 page index가 캐시에 존재하고, 순차 추출 바이트가 온디맨드 `read_page`와 바이트 단위로 동일하다(단위 테스트, ZIP·RAR 픽스처 모두). (depends: S1)
- [ ] S3. 파일 전환 무효화 — `open_archive`마다 세대 id 증가 + 캐시 클리어, 진행 중이던 옛 백그라운드 스레드는 stale 세대를 감지하면 중단해 삽입하지 않는다. — completion: 세대 증가 후 옛 세대로 시도된 캐시 삽입이 무시된다(단위 테스트). (depends: S1)
- [ ] S4. 수동 검증 — `task dev`로 네트워크 드라이브(또는 대용량 로컬 cbr)를 연속 모드로 열어 스크롤. — completion: 첫 페이지 즉시 표시, 백그라운드 채움 후 스크롤 끊김 없음(육안 확인, 기계 검증 불가). (depends: S2)
