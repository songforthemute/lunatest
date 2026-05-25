# @lunatest/core

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
