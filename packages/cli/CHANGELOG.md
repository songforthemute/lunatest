# @lunatest/cli

## 0.1.6

### Patch Changes

### Packages

- `@lunatest/core@0.2.1`: dependency range update
- `@lunatest/mcp@0.1.6`: dependency range update

## 0.1.5

### Patch Changes

### Packages

- `@lunatest/core@0.2.0`: dependency range update
- `@lunatest/mcp@0.1.5`: dependency range update

## 0.1.4

### Patch Changes

### Summary

- [`7c8721c`](https://github.com/songforthemute/lunatest/commit/7c8721c8329e6fbc2789947d0908899a6b32f621) 프로젝트 설정과 Lua 시나리오를 공통 로더로 제공하고, `lunatest-mcp`가 기본적으로 consumer 프로젝트의 config, scenario, coverage를 읽도록 개선했습니다. packed tarball 환경에서 CLI의 validate/run/coverage/gen/watch와 MCP JSON-RPC 워크플로를 검증합니다.

### Breaking

- None

### Summary

- [`42ace16`](https://github.com/songforthemute/lunatest/commit/42ace16aa877b6042f08e3d68d05264b5c2fe9b1) Windows short-path 프로젝트에서 `lunatest watch`가 파일 감시를 중단하지 않도록 감시 대상을 canonical path로 정규화합니다.

### Breaking

- None

### Packages

- `@lunatest/core@0.1.4`: dependency range update
- `@lunatest/mcp@0.1.4`: dependency range update

## 0.1.3

### Patch Changes

### Summary

- [`8641a37`](https://github.com/songforthemute/lunatest/commit/8641a37d49cfc89eaccd769a58b806db247d9485) Refresh vetted runtime dependency ranges and lockfile security overrides for the safe dependency remediation pass.

### Breaking

- None

### Packages

- `@lunatest/core@0.1.3`: dependency range update
- `@lunatest/mcp@0.1.3`: dependency range update

## 0.1.2

### Patch Changes

### Summary

- [`b122163`](https://github.com/songforthemute/lunatest/commit/b1221634ade0c0bc1e2bf90648982a3b5a100f1c) Fix CI, release, package smoke, and usability audit drift.
- [`b122163`](https://github.com/songforthemute/lunatest/commit/b1221634ade0c0bc1e2bf90648982a3b5a100f1c) - Prevent CI workspace wrappers from re-entering root recursive scripts.
- [`b122163`](https://github.com/songforthemute/lunatest/commit/b1221634ade0c0bc1e2bf90648982a3b5a100f1c) - Run npm registry consumer smoke after release publish workflow success.
- [`b122163`](https://github.com/songforthemute/lunatest/commit/b1221634ade0c0bc1e2bf90648982a3b5a100f1c) - Prevent `gen --ai` from overwriting existing scenario files.
- [`b122163`](https://github.com/songforthemute/lunatest/commit/b1221634ade0c0bc1e2bf90648982a3b5a100f1c) - Publish a consistent contracts/core/runtime package set so npm consumers receive the wallet helper exports required by the current runtime packages.
- [`b122163`](https://github.com/songforthemute/lunatest/commit/b1221634ade0c0bc1e2bf90648982a3b5a100f1c) - Clarify MCP `component.states` state coverage versus component coverage semantics.

### Breaking

- None

### Packages

- `@lunatest/contracts@0.1.1`: dependency range update
- `@lunatest/core@0.1.2`: dependency range update
- `@lunatest/runtime-intercept@0.1.1`: dependency range update
- `@lunatest/mcp@0.1.2`: dependency range update

## 0.1.1

### Patch Changes

### Summary

- [`25be1b7`](https://github.com/songforthemute/lunatest/commit/25be1b746abc906485c7934646d650217f53ddd5) 릴리스 채널 정책을 적용했습니다.
- [`25be1b7`](https://github.com/songforthemute/lunatest/commit/25be1b746abc906485c7934646d650217f53ddd5) - stable 패키지(`core`, `cli`, `react`, `mcp`)는 `latest` 채널로 배포됩니다.
- [`25be1b7`](https://github.com/songforthemute/lunatest/commit/25be1b746abc906485c7934646d650217f53ddd5) - 플러그인 패키지(`vitest-plugin`, `playwright-plugin`)는 `next` 채널로 배포됩니다.
- [`25be1b7`](https://github.com/songforthemute/lunatest/commit/25be1b746abc906485c7934646d650217f53ddd5) - release workflow에 lint 게이트와 npm provenance 설정을 추가했습니다.

### Breaking

- None

### Packages

- `@lunatest/core@0.1.1`: dependency range update
- `@lunatest/mcp@0.1.1`: dependency range update
