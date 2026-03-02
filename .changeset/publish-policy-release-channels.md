---
"@lunatest/core": patch
"@lunatest/cli": patch
"@lunatest/react": patch
"@lunatest/mcp": patch
"@lunatest/vitest-plugin": patch
"@lunatest/playwright-plugin": patch
---

릴리스 채널 정책을 적용했습니다.

- stable 패키지(`core`, `cli`, `react`, `mcp`)는 `latest` 채널로 배포됩니다.
- 플러그인 패키지(`vitest-plugin`, `playwright-plugin`)는 `next` 채널로 배포됩니다.
- release workflow에 lint 게이트와 npm provenance 설정을 추가했습니다.
