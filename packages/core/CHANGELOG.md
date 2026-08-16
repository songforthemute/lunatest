# @lunatest/core

## 0.2.1

### Patch Changes

### Summary

- [`bf98a40`](https://github.com/songforthemute/lunatest/commit/bf98a4046029a921d8c7e1d4e895e349605d2faa) Report the first nested UI, state, or transition mismatch with a structured
- [`bf98a40`](https://github.com/songforthemute/lunatest/commit/bf98a4046029a921d8c7e1d4e895e349605d2faa) path and leaf-level expected and actual values.

### Breaking

- None

### Summary

- [`c29aee9`](https://github.com/songforthemute/lunatest/commit/c29aee95bc49116d348bda73e6c0d1c854e99ced) Preserve documented `stages`, `not_present`, and `timing_ms` assertions when
- [`c29aee9`](https://github.com/songforthemute/lunatest/commit/c29aee95bc49116d348bda73e6c0d1c854e99ced) executing Lua scenarios through `executeLuaScenario`. Ship the Lua WASM binary
- [`c29aee9`](https://github.com/songforthemute/lunatest/commit/c29aee95bc49116d348bda73e6c0d1c854e99ced) with the browser package so deterministic runtimes do not fetch it from a CDN.

### Breaking

- None

### Summary

- [`fe233ac`](https://github.com/songforthemute/lunatest/commit/fe233acabc427d207e3587a1ad9843e0d55e291a) Expose a stable SHA-256 source digest on project scenarios so multiple runners
- [`fe233ac`](https://github.com/songforthemute/lunatest/commit/fe233acabc427d207e3587a1ad9843e0d55e291a) can prove they executed the same Lua source.

### Breaking

- None

## 0.2.0

### Minor Changes

### Summary

- [`d9420ee`](https://github.com/songforthemute/lunatest/commit/d9420ee8bb490cc2377019898d2c9cbd03efb74b) 프로젝트 시나리오 러너와 Vitest/Playwright 실행 어댑터를 추가합니다.

### Breaking

- None

## 0.1.4

### Patch Changes

### Summary

- [`7c8721c`](https://github.com/songforthemute/lunatest/commit/7c8721c8329e6fbc2789947d0908899a6b32f621) 프로젝트 설정과 Lua 시나리오를 공통 로더로 제공하고, `lunatest-mcp`가 기본적으로 consumer 프로젝트의 config, scenario, coverage를 읽도록 개선했습니다. packed tarball 환경에서 CLI의 validate/run/coverage/gen/watch와 MCP JSON-RPC 워크플로를 검증합니다.

### Breaking

- None

## 0.1.3

### Patch Changes

### Summary

- [`8641a37`](https://github.com/songforthemute/lunatest/commit/8641a37d49cfc89eaccd769a58b806db247d9485) Refresh vetted runtime dependency ranges and lockfile security overrides for the safe dependency remediation pass.

### Breaking

- None

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

### Summary

- [`0451e54`](https://github.com/songforthemute/lunatest/commit/0451e540bfde13d3a579d516afe68016e3b289e9) Complete deterministic protocol preset and wallet interceptor support.
- [`0451e54`](https://github.com/songforthemute/lunatest/commit/0451e540bfde13d3a579d516afe68016e3b289e9) - Add wallet metadata for known chains, watched assets, and deterministic rejection behavior.
- [`0451e54`](https://github.com/songforthemute/lunatest/commit/0451e540bfde13d3a579d516afe68016e3b289e9) - Materialize built-in protocol runtime state and protocol routes for Uniswap V2, Uniswap V3, Curve, and Aave.
- [`0451e54`](https://github.com/songforthemute/lunatest/commit/0451e540bfde13d3a579d516afe68016e3b289e9) - Resolve supported ERC-20 and protocol RPC calls through the browser runtime for `window.ethereum`, fetch, and XHR.
- [`0451e54`](https://github.com/songforthemute/lunatest/commit/0451e540bfde13d3a579d516afe68016e3b289e9) - Surface protocol runtime ordering and preview support through React bootstrap/devtools.

### Breaking

- None

### Packages

- `@lunatest/contracts@0.1.1`: dependency range update

## 0.1.1

### Patch Changes

### Summary

- [`25be1b7`](https://github.com/songforthemute/lunatest/commit/25be1b746abc906485c7934646d650217f53ddd5) 릴리스 채널 정책을 적용했습니다.
- [`25be1b7`](https://github.com/songforthemute/lunatest/commit/25be1b746abc906485c7934646d650217f53ddd5) - stable 패키지(`core`, `cli`, `react`, `mcp`)는 `latest` 채널로 배포됩니다.
- [`25be1b7`](https://github.com/songforthemute/lunatest/commit/25be1b746abc906485c7934646d650217f53ddd5) - 플러그인 패키지(`vitest-plugin`, `playwright-plugin`)는 `next` 채널로 배포됩니다.
- [`25be1b7`](https://github.com/songforthemute/lunatest/commit/25be1b746abc906485c7934646d650217f53ddd5) - release workflow에 lint 게이트와 npm provenance 설정을 추가했습니다.

### Breaking

- None
