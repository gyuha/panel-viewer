---
author: gyuha
decided: 2026-07-18
---
# CBR 압축 해제는 unrar 크레이트를 사용한다

CBR(RAR) 지원에 순수 Rust 크레이트 대신 공식 unrar 라이브러리 래퍼인 `unrar` 크레이트를 쓴다. 순수 Rust 구현들은 RAR5 지원이 불완전해 최신 CBR 파일 상당수를 열지 못하는 반면, unrar는 RAR4/RAR5를 모두 안정적으로 지원한다.

## Consequences

- unrar 라이선스는 freeware(재배포 가능, RAR 압축기 제작만 금지)라 뷰어 용도로는 문제없으나, 이 앱을 MIT/GPL 등 순수 오픈소스 라이선스로 배포하려면 unrar 부분의 라이선스 고지가 필요하다.
- 순수 Rust가 아니므로 C++ 코드가 빌드에 포함된다(크레이트가 소스를 번들하므로 별도 시스템 의존성은 없음).
