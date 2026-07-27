# LunaTest 문서

LunaTest는 Web3 프론트엔드의 지갑, 네트워크 라우트, 시나리오 상태를 결정론적으로 검증하는 SDK입니다. 테스트 더블을 완전한 EVM 시뮬레이터로 표현하지 않고, 재현 가능한 프론트엔드 동작에 집중합니다.

## 먼저 읽기

- [빠른 시작](./getting-started.md)에서 LunaTest 프로젝트를 준비합니다.
- [시나리오 작성](./guides/writing-scenarios.md)에서 Lua 시나리오와 coverage metadata를 확인합니다.
- [React 통합](./guides/react-integration.md)에서 React 트리를 `LunaProvider`에 연결합니다.
- [Playwright 라우팅](./guides/playwright-routing.md)에서 브라우저 테스트의 HTTP/JSON-RPC route를 제어합니다.
- [CLI 워크플로](./guides/cli-workflow.md)에서 validate, 실행, coverage, 생성, 진단 명령을 확인합니다.

## 제품 가이드

- [Runtime Intercept 0→1](./guides/e2e-0to1.md)
- [시나리오 예제](./guides/scenario-examples.md)
- [프로토콜/지갑 지원 범위](./guides/protocol-support.md)
- [라이브러리 소비자 가이드](./guides/library-consumption.md)
- [MCP stdio](./guides/mcp-stdio.md)
- [라이브 데모](./guides/live-demo.md)
- [DeFi Dashboard Dogfood](./guides/defi-dashboard-dogfood.md)
- [Sepolia 스왑 데모](./guides/swap-demo-sepolia-uniswapv3.md)
- [Local Preset 작성](./guides/local-preset-authoring.md)

## 레퍼런스

- [아키텍처](../concepts/architecture.md)
- [Core API](./api/core.md)
- [Runtime Intercept API](./api/runtime-intercept.md)
- [React API](./api/react.md)
- [CLI API](./api/cli.md)
- [MCP API](./api/mcp.md)

영문 문서는 [English documentation index](../index.md)에서 볼 수 있습니다.
