# 퀵 레인 로그

## 2026-07-19 — 한글 IME에서 'x'(앱 종료) 단축키 미동작 수정
- 요청: 단축키 x로 닫히게 되어 있는데 한글 자판이면 닫히기가 동작하지 않음.
- 결정: 단축키 매칭을 `event.key`(입력 문자) 대신 물리 키 폴백(`event.code` KeyA~KeyZ)으로 정규화. 헬퍼 `eventKey()` 추가 후 전역 핸들러/뷰어/페이지뷰/설정 캡처 4곳에 일괄 적용(저장 포맷 변경 없음).
- 결과: done — keymap.ts에 eventKey() 추가, App/Viewer/PageView/SettingsModal 4곳 적용, 단위 테스트 2개 추가. tsc + vitest(20/20) 통과.
