# LunaTest — Implementation PRD

> **C Lua WASM 기반 Web3 프론트엔드 결정론적 E2E 테스트 SDK**
>
> Version 0.1.0 | February 2026 | For Coding Agent Sessions

---

## 1. 개요

### 1.1 한 줄 요약

체인·컨트랙트·인덱서 없이, Lua 시나리오 선언만으로 Web3 프론트엔드 로직을 밀리초 단위에서 결정론적으로 테스트할 수 있는 SDK.

### 1.2 핵심 가치

```
┌─────────────────────────────────────────────────────────────────┐
│                    Core Value Proposition                        │
│                                                                 │
│  ✦ 완전 결정론 — 동일 시나리오 = 항상 동일 결과 (flaky 0%)     │
│  ✦ 밀리초 실행 — 1 scenario < 1ms, 1000 scenarios < 1s         │
│  ✦ 제로 인프라 — Anvil/Hardhat fork 불필요, CI 비용 최소        │
│  ✦ AI 자동생성 — MCP 서버로 무한 시나리오 생성 가능             │
│  ✦ 제로 코드변경 — EIP-1193 Provider 교체만으로 통합            │
│  ✦ 누구나 읽는 테스트 — Lua 테이블 = 비즈니스 스펙 문서         │
│  ✦ 첨예한 엣지 케이스 — flaky 0%라 깨지면 100% 버그             │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 왜 Lua인가

| 후보                     | 번들 사이즈 | 결정론      | 비고                       |
| ------------------------ | ----------- | ----------- | -------------------------- |
| **C Lua WASM (Wasmoon)** | **~200KB**  | **✅ 완전** | **채택**                   |
| Pyodide (Python)         | 30MB+       | ❌          | 비현실적 번들              |
| QuickJS (JS-in-JS)       | ~500KB      | △           | 구조적 모순 (JS 안에서 JS) |

### 1.4 테스트 피라미드에서의 포지셔닝

```
                          /\
                         /  \          Anvil / Hardhat E2E
                        / ❸  \         Full stack, Slow, Expensive
                       /──────\        몇 개 작성
                      /        \
                     /    ❷     \      MSW / API Integration
                    /            \      ABI encode/decode 검증
                   /──────────────\     중간 개수
                  /                \
                 /       ❶         \   ★ LunaTest ← THE GAP
                /    (Lua SDK)      \   Fast, Cheap, Infinite
               /────────────────────\   수천~수만 개
```

---

## 2. 아키텍처

### 2.1 시스템 레이어 구조

```
┌─────────────────────────────────────────────────────────────────────┐
│                     External Interfaces                              │
│                                                                     │
│  ┌─ MCP Server ──────────────┐   ┌─ CLI ─────────────────────────┐  │
│  │ scenario.create(desc)     │   │ $ lunatest run                │  │
│  │ scenario.run(id)          │   │ $ lunatest gen --ai           │  │
│  │ scenario.mutate(id, vars) │   │ $ lunatest coverage           │  │
│  │ coverage.report()         │   │ $ lunatest watch              │  │
│  │ mock.setPool(params)      │   │                               │  │
│  │ ui.assert(selector, exp)  │   │                               │  │
│  └───────────┬───────────────┘   └───────────────┬───────────────┘  │
└──────────────┼───────────────────────────────────┼──────────────────┘
               │                                   │
               ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 4: Test Runner                                               │
│                                                                     │
│  ┌─ Scenario Registry ─┐  ┌─ Assertion Engine ─┐  ┌─ Reporter ───┐ │
│  │ load / validate      │  │ ui.assert()        │  │ console/JSON │ │
│  │ dependency resolve   │  │ state.assert()     │  │ JUnit XML    │ │
│  │ tag & filter         │  │ diff generation    │  │ HTML         │ │
│  └──────────────────────┘  └────────────────────┘  └──────────────┘ │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 3: Scenario Engine                                           │
│                                                                     │
│  ┌─ Scenario DSL (Given / When / Then) ──────────────────────────┐  │
│  │  scenario {                                                    │  │
│  │    name  = "high_slippage_warning",                            │  │
│  │    given = { pool = {...}, wallet = {...} },                   │  │
│  │    when  = { action = "swap", input = {...} },                 │  │
│  │    then_ui = { warning = true, severity = "high" },           │  │
│  │  }                                                             │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─ Stage Machine ───┐  ┌─ State Snapshot ─┐  ┌─ Virtual Clock ──┐ │
│  │ multi-step flow    │  │ capture/compare  │  │ no real I/O      │ │
│  │ approve -> swap    │  │ deterministic    │  │ ms-level control │ │
│  └────────────────────┘  └──────────────────┘  └──────────────────┘ │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 2: Mock Provider                                             │
│                                                                     │
│  ┌─ ChainMock ────────┐  ┌─ WalletMock ──────┐  ┌─ EventQueue ──┐ │
│  │ pools, tokens       │  │ connect/disconnect │  │ tx_submitted  │ │
│  │ balances, prices    │  │ balances, approve  │  │ tx_confirmed  │ │
│  │ block height, gas   │  │ chain switching    │  │ tx_failed     │ │
│  │ (all Lua tables)    │  │ sign / reject      │  │ price_feed    │ │
│  └─────────────────────┘  └────────────────────┘  └───────────────┘ │
│                                                                     │
│  ┌─ Protocol Presets (Optional) ─────────────────────────────────┐  │
│  │ uniswap_v2 | uniswap_v3 | curve | aave | compound | ...      │  │
│  │ (NOT real math — just state shape templates for frontends)    │  │
│  └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1: Lua WASM Runtime                                          │
│                                                                     │
│  ┌─ Wasmoon (C Lua 5.4 → WASM) ─────────────────────────────────┐  │
│  │                                                                │  │
│  │  ┌─ Lua VM ────┐   ┌─ Host Bindings ─────────────────────┐   │  │
│  │  │ scenario     │   │ lua <-> JS bridge                   │   │  │
│  │  │ execution    │   │ callLua(fn, args) -> result         │   │  │
│  │  │ sandboxed    │   │ registerHost(name, jsFn)            │   │  │
│  │  │ isolated     │   │ getState() -> snapshot              │   │  │
│  │  └──────────────┘   │ instruction limit (∞ loop block)    │   │  │
│  │                      └────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 데이터 흐름 (Single Scenario Execution)

```
  scenario.lua              LunaTest SDK                   React App
  ──────────────            ──────────────                 ──────────
       │
       │  given = {
       │    pool = { ETH/USDC,
       │      tvl = 500000 },
       │    wallet = {
       │      ETH = 10 }
       │  }
       │ ──────────────────►  Inject into
       │                      Mock Provider
       │                           │
       │                           │  LunaProvider (EIP-1193)
       │                           │ ──────────────────────►  App calls
       │                           │                          useBalance()
       │                           │                          useSwapQuote()
       │                           │                              │
       │                           │    eth_getBalance request    │
       │                           │  ◄────────────────────────── │
       │                           │                              │
       │               Lua VM      │    "10 ETH" response         │
       │             mock query    │ ─────────────────────────►   │
       │                           │                              │
       │  when = {                 │                              │
       │    action = "swap",       │  Simulate user action        │
       │    amount = 5.0           │ ─────────────────────────►   │
       │  }                        │                          [click]
       │ ──────────────────►       │                              │
       │                           │    eth_sendTransaction       │
       │                           │  ◄────────────────────────── │
       │                           │                              │
       │             EventQueue    │    tx_submitted → pending    │
       │              advance      │ ─────────────────────────►   │
       │                           │                          [spinner]
       │                           │                              │
       │             Virtual time  │    tx_confirmed              │
       │              +3000ms      │ ─────────────────────────►   │
       │                           │                          [success]
       │                           │                              │
       │  then_ui = {              │    Capture UI state          │
       │    success = true         │  ◄────────────────────────── │
       │  }                        │                              │
       │ ──────────────────►       │                              │
       │                     Assert: success == true              │
       │                           │                              │
       │                     ✅ PASS (0.8ms)                     │
```

---

## 3. 상세 스펙

### 3.1 Layer 1: Lua WASM Runtime — 결정론 보장

| 비결정론 소스         | 기본 Lua 동작      | LunaTest 대체               |
| --------------------- | ------------------ | --------------------------- |
| `math.random()`       | 시스템 시드        | 시나리오별 고정 시드 PRNG   |
| `os.time()`           | 시스템 시간        | 가상 시계 (시나리오 정의)   |
| `os.date()`           | 시스템 시간대      | UTC 고정                    |
| `io.*` / `os.execute` | 파일/프로세스 접근 | 완전 차단 (샌드박스)        |
| table iteration order | 비보장 (Lua 스펙)  | 삽입순 보장 래퍼            |
| GC timing             | 비결정론적         | 시나리오 경계에서만 수동 GC |

**Runtime Interface (TypeScript):**

```typescript
interface LunaRuntime {
    call(fn: string, args: Record<string, unknown>): Promise<unknown>;
    register(name: string, hostFn: (...args: unknown[]) => unknown): void;
    getState(): Promise<LuaStateSnapshot>;
    setInstructionLimit(n: number): void;
    setMemoryLimit(bytes: number): void; // default 16MB
    reset(): Promise<void>;
}
```

### 3.2 Layer 2: Mock Provider — 관심사 분리

**핵심 원칙: 컨트랙트 수학은 관심사 밖이다.**

| 구분      | In Scope (프론트 테스트)           | Out of Scope (컨트랙트 영역) |
| --------- | ---------------------------------- | ---------------------------- |
| 풀 상태   | 프론트에 전달되는 데이터 형태      | 실제 AMM 수학의 정확성       |
| 스왑 결과 | 주어진 output에 대한 UI 반응       | output의 계산 방법           |
| 트랜잭션  | pending/confirmed/failed 상태 전이 | 실제 EVM 실행 로직           |
| 가격      | 특정 가격값에 대한 UI 렌더링       | 오라클 피드의 정확성         |
| 가스      | 가스 비용 표시 & 부족 시 에러      | 실제 가스 추정 알고리즘      |

### 3.3 Layer 3: Scenario Engine — DSL 설계

**Scenario Anatomy:**

```
┌─ scenario ──────────────────────────────────────────────────────┐
│                                                                 │
│  ┌─ given ────────────────────────────────────────────────────┐ │
│  │ Initial state (chain, wallet, pool, token, config)         │ │
│  │ → Injected into Mock Provider (Layer 2)                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ when ─────────────────────────────────────────────────────┐ │
│  │ User action or external event trigger                      │ │
│  │ → action: "swap" | "approve" | "connect" | "disconnect"   │ │
│  │ → or stages[] array for multi-step flows                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ then_ui ──────────────────────────────────────────────────┐ │
│  │ Expected UI state (assertions)                             │ │
│  │ → component visibility, text, color, enabled state         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─ then_state (optional) ────────────────────────────────────┐ │
│  │ Expected internal state (React state, Lua state)           │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Multi-Stage Flow Example (Token Approve → Swap):**

```
  Stage 1: "need_approval"
  ┌──────────────────────────────────────────┐
  │  assert: { button_text = "Approve USDC" }│
  └──────────────────┬───────────────────────┘
                     │  trigger: user_clicks_approve
                     ▼
  Stage 2: "approve_pending"
  ┌──────────────────────────────────────────┐
  │  assert: { spinner = true,               │
  │            button_disabled = true }       │
  └──────────────────┬───────────────────────┘
                     │  event: tx_confirmed (approve)
                     ▼
  Stage 3: "ready_to_swap"
  ┌──────────────────────────────────────────┐
  │  assert: { button_text = "Swap",         │
  │            button_enabled = true }        │
  └──────────────────┬───────────────────────┘
                     │  trigger: user_clicks_swap
                     ▼
  Stage 4: "swap_pending"
  ┌──────────────────────────────────────────┐
  │  assert: { spinner = true,               │
  │            status = "Swapping..." }       │
  └──────────────────┬───────────────────────┘
                     │  event: tx_confirmed (swap)
                     ▼
  Stage 5: "complete"
  ┌──────────────────────────────────────────┐
  │  assert: { success = true,               │
  │            receipt_link = true }          │
  └──────────────────────────────────────────┘
```

### 3.4 Layer 4: Test Runner — 실행 파이프라인

```
  ┌─ 1. Load ───────────────┐
  │  Lua scenario files      │
  │  dependency resolve      │──┐
  │  tag filtering           │  │
  └──────────────────────────┘  │
                                │
  ┌─ 2. Initialize ─────────┐  │
  │  Fresh Lua VM instance   │  │  ← Isolated per scenario
  │  Inject Mock Provider    │◄─┘
  │  Set given state         │
  └───────────┬──────────────┘
              │
  ┌─ 3. Execute ────────────┐
  │  Run when actions        │
  │  Progress stages         │  ← Virtual time control
  │  Replay event queue      │
  └───────────┬──────────────┘
              │
  ┌─ 4. Assert ─────────────┐
  │  Verify then_ui          │
  │  Verify then_state       │  ← Deterministic diff
  │  Generate diff on fail   │
  └───────────┬──────────────┘
              │
  ┌─ 5. Report ─────────────┐
  │  PASS / FAIL             │
  │  Coverage aggregation    │  → Console / JSON / JUnit / HTML
  │  Execution time log      │
  └──────────────────────────┘
```

### 3.5 Assertion Types

| 유형                 | 대상        | 예시                                      |
| -------------------- | ----------- | ----------------------------------------- |
| UI Assertion         | 렌더링 결과 | `button.disabled == true`                 |
| State Assertion      | 내부 상태   | `luaState.routes.length == 3`             |
| Transition Assertion | 상태 전이   | `stage[2] → stage[3]` transition occurred |
| Negative Assertion   | 부재 확인   | `error_modal` must NOT appear             |
| Timing Assertion     | 가상 시간   | timeout after 3000ms (virtual)            |

### 3.6 EIP-1193 Provider 통합

```
┌─ App Code (any framework) ────────────────────────────────────┐
│                                                                │
│  React / Vue / Svelte / Vanilla JS                             │
│         │                                                      │
│         ▼                                                      │
│  ┌─ Web3 Abstraction Layer ────────────────────────────────┐   │
│  │  wagmi / @web3-react / ethers / viem / web3.js          │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                             │                                  │
└─────────────────────────────┼──────────────────────────────────┘
                              │
                  ┌───────────┴───────────┐
                  │                       │
           Production Mode          Test Mode
                  │                       │
                  ▼                       ▼
       ┌─ Real Provider ──┐   ┌─ LunaProvider (EIP-1193) ──────┐
       │ Alchemy / Infura  │   │                                │
       │ MetaMask / WC     │   │ eth_call     → Lua mock data   │
       │ On-chain data     │   │ eth_send     → Lua event queue │
       └───────────────────┘   │ eth_chainId  → mock chain      │
                               │                                │
                               │ ★ Zero code change in app.     │
                               │   Swap provider = swap reality │
                               └────────────────────────────────┘
```

**EIP-1193 메서드 매핑:**

| EIP-1193 Method             | LunaProvider Response Source            |
| --------------------------- | --------------------------------------- |
| `eth_chainId`               | `scenario.given.chain.id`               |
| `eth_accounts`              | `scenario.given.wallet.address`         |
| `eth_getBalance`            | `scenario.given.wallet.balances[token]` |
| `eth_call` (read)           | Lua function registered per contract    |
| `eth_sendTransaction`       | EventQueue에 `tx_submitted` 삽입        |
| `eth_getTransactionReceipt` | EventQueue 현재 stage에 따라            |
| `wallet_switchEthChain`     | `WalletMock.chain` 변경                 |
| `eth_subscribe`             | EventQueue에서 push                     |

### 3.7 MCP Server — AI Agent Interface

**MCP 도구 목록:**

```
┌─ Tools ──────────────────────────────────────────────────────┐
│  scenario.list()           → registered scenarios            │
│  scenario.get(id)          → scenario detail (Lua src)       │
│  scenario.create(lua)      → register new scenario           │
│  scenario.run(id)          → execute & return results        │
│  scenario.runAll(filter)   → batch execution                 │
│  scenario.mutate(id, opts) → generate variations             │
│  mock.getState()           → current mock state              │
│  mock.setState(lua)        → modify mock state               │
│  mock.listPresets()        → protocol preset catalog         │
│  coverage.report()         → test coverage report            │
│  coverage.gaps()           → uncovered area analysis         │
│  coverage.suggest()        → gap-based scenario suggestion   │
│  component.tree()          → UI component tree               │
│  component.states(name)    → possible component states       │
└──────────────────────────────────────────────────────────────┘

┌─ Resources ──────────────────────────────────────────────────┐
│  lunatest://scenarios      → scenario catalog                │
│  lunatest://coverage       → coverage status                 │
│  lunatest://components     → component map                   │
│  lunatest://mocks          → mock data schema                │
│  lunatest://protocols      → supported protocols             │
│  lunatest://guide          → scenario writing guide          │
└──────────────────────────────────────────────────────────────┘

┌─ Prompts ────────────────────────────────────────────────────┐
│  generate-edge-cases       → auto edge case exploration      │
│  analyze-failure           → failure root cause analysis     │
│  improve-coverage          → coverage improvement plan       │
│  regression-from-diff      → git diff based regression       │
└──────────────────────────────────────────────────────────────┘
```

**AI Agent Workflow:**

```
  ┌──────────────────────────────────────────┐
  │                                          │
  ▼                                          │
  ┌─ 1. Analyze ──────────────┐              │
  │  coverage.gaps()           │              │
  │  component.tree()          │              │
  │  → identify uncovered      │              │
  └───────────┬────────────────┘              │
              │                               │
              ▼                               │
  ┌─ 2. Generate ─────────────┐              │
  │  AI writes Lua scenarios   │              │
  │  scenario.create(lua)      │              │
  │  → combinatorial edge      │              │
  │    case exploration        │              │
  └───────────┬────────────────┘              │
              │                               │
              ▼                               │
  ┌─ 3. Execute ──────────────┐              │
  │  scenario.runAll()         │              │
  │  → 1000 scenarios < 1 sec │              │
  └───────────┬────────────────┘              │
              │                               │
              ▼                               │
  ┌─ 4. Analyze Results ──────┐              │
  │  failed → bug report       │              │
  │  coverage.report()         ├─ gaps? ──────┘
  └───────────┬────────────────┘
              │ no gaps
              ▼
  ┌─ 5. Complete ─────────────┐
  │  Full report generated     │
  │  CI/CD results returned    │
  └────────────────────────────┘
```

---

## 4. 패키지 구조

```
@lunatest/core
├── runtime/                # Layer 1: Lua WASM Runtime
│   ├── engine.ts           #   Wasmoon wrapper, sandbox, determinism
│   └── bridge.ts           #   JS <-> Lua data marshaling
│
├── mocks/                  # Layer 2: Mock Provider
│   ├── chain.lua           #   ChainMock
│   ├── wallet.lua          #   WalletMock
│   ├── events.lua          #   EventQueue
│   └── presets/            #   Protocol presets (optional)
│       ├── uniswap_v2.lua
│       ├── uniswap_v3.lua
│       ├── curve.lua
│       └── aave.lua
│
├── scenario/               # Layer 3: Scenario Engine
│   ├── dsl.lua             #   Given-When-Then DSL
│   ├── stages.lua          #   Multi-stage state machine
│   └── clock.lua           #   Virtual time controller
│
├── runner/                 # Layer 4: Test Runner
│   ├── runner.ts           #   Scenario executor
│   ├── assert.ts           #   Assertion engine
│   └── reporter.ts         #   Output formatters
│
├── provider/               # SDK Integration
│   └── luna-provider.ts    #   EIP-1193 compatible provider
│
└── index.ts                # Public API

@lunatest/cli               # CLI wrapper
@lunatest/react             # React hooks & test utilities
@lunatest/mcp               # MCP Server (AI agent interface)
```

---

## 5. 성능 목표

| 메트릭               | 목표                  | 비교 기준                 |
| -------------------- | --------------------- | ------------------------- |
| 단일 시나리오 실행   | < 1ms                 | MSW: 5-20ms, Anvil: 1-10s |
| 1,000 시나리오 일괄  | < 1초                 | MSW: 5-20초               |
| Lua VM 초기화        | < 10ms                | Wasmoon 콜드 스타트       |
| SDK 번들 사이즈      | < 300KB (gzip)        | 앱 번들에 미미한 영향     |
| 메모리 사용 (per VM) | < 16MB                | 시나리오당 격리           |
| CI 추가 시간         | < 5초 (1000 시나리오) | 기존 빌드에 최소 영향     |

---

## 6. 지원 Web3 라이브러리

| 라이브러리      | 통합 방식                     | 코드 변경            |
| --------------- | ----------------------------- | -------------------- |
| wagmi / viem    | LunaProvider → Transport 주입 | 제로 (config만 변경) |
| ethers.js v5/v6 | LunaProvider → Provider 교체  | 제로 (DI 패턴)       |
| web3.js         | LunaProvider → Provider 교체  | 제로                 |
| @web3-react     | LunaProvider → Connector 주입 | 제로                 |
| RainbowKit      | LunaProvider 커스텀 체인      | 최소 (체인 설정)     |

---

## 7. Future: LBun Migration Path

```
  Phase 1 (Now)                         Phase 2 (Future)
  ─────────────────────                 ─────────────────────
  C Lua 5.4 + Emscripten               LBun (Zig + Lua) WASM
  = Wasmoon (~200KB)                    = lbun.wasm (~200-500KB)

  ┌───────────────────┐                 ┌──────────────────────────┐
  │  Wasmoon           │                │  LBun WASM                │
  │  • C Lua 5.4       │  ──────────►   │  • Zig-optimized Lua 5.4  │
  │  • ~200KB WASM     │                │  • SIMD acceleration      │
  │  • Standard perf   │                │  • Smaller binary         │
  │                    │                │  • Server isomorphic      │
  └────────┬──────────┘                 └───────────┬──────────────┘
           │                                        │
           ▼                                        ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  LunaRuntime Interface (UNCHANGED)                           │
  │  call(fn, args) | register(name, hostFn) | getState()       │
  │  setInstructionLimit(n)                                      │
  └──────────────────────────────────────────────────────────────┘
                              │
                              ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  Rest of SDK (UNCHANGED)                                     │
  │  Mock Provider / Scenario Engine / Test Runner / MCP         │
  └──────────────────────────────────────────────────────────────┘
```

| 항목            | Wasmoon (Phase 1)  | LBun WASM (Phase 2)      |
| --------------- | ------------------ | ------------------------ |
| 바이너리 사이즈 | ~200KB             | ~200-500KB (추가 기능)   |
| JSON 파싱       | 표준 Lua           | SIMD 가속 (2-5x)         |
| 문자열 처리     | 표준 Lua           | SIMD 가속 (2-4x)         |
| 서버 동형성     | ❌ (브라우저 전용) | ✅                       |
| HMR             | ❌                 | ✅ (시나리오 핫 리로드)  |
| 내장 HTTP       | ❌                 | ✅ (Mock 서버 내장 가능) |

---

## 8. 스코프 바운더리

### 8.1 v1 스코프 (In Scope)

| 영역            | 범위                              | 비고                     |
| --------------- | --------------------------------- | ------------------------ |
| 런타임          | JS/TS 환경 (Node.js + Browser)    | Wasmoon 기반             |
| 통합 방식       | EIP-1193 Provider in-process 주입 | 제로 코드변경의 전제조건 |
| 프론트엔드      | React (+ Next.js SSR)             | `@lunatest/react` 제공   |
| 테스트 러너     | Vitest 플러그인                   | Playwright 플러그인 포함 |
| AI 인터페이스   | MCP Server                        | AI 에이전트 전용         |
| 프로토콜 프리셋 | Uniswap V2/V3, Curve              | 상태 형태 템플릿         |

### 8.2 v1 스코프 외 (Out of Scope)

| 영역                      | 이유                                                    |
| ------------------------- | ------------------------------------------------------- |
| Vue/Nuxt, Svelte 어댑터   | core로 동작은 하지만 convenience layer는 Next1          |
| Nest.js 등 백엔드 모드    | `then_state` only 모드 설계 필요, Next2                 |
| React Native              | JS/TS 런타임이라 가능하나, 모바일 특화 검증 필요, Next2 |
| Go/Rust/Python 등 타 언어 | in-process provider 주입 불가, 언어별 포팅 영역         |
| 컨트랙트 수학 검증        | 프로젝트 철학 상 관심사 밖 (영구 제외)                  |
| 실제 EVM 실행             | Anvil/Hardhat 영역 (영구 제외)                          |

### 8.3 로드맵 요약

```
  v1 (현재 PRD)
  ├── JS/TS 생태계, React 중심
  ├── EIP-1193 in-process 주입
  └── MCP = AI 에이전트 인터페이스

  Next1: 타 프레임워크 호환성
  ├── @lunatest/vue  (Vue/Nuxt 어댑터)
  ├── @lunatest/svelte (Svelte/SvelteKit 어댑터)
  └── 프레임워크 공통 테스트 유틸 추출

  Next2: 프론트엔드 외부 확장
  ├── 백엔드 모드 (then_state only, Nest.js 등)
  ├── React Native 모바일
  └── LBun 마이그레이션 (Phase 2 → 서버 동형성)
```

---

## 9. Moat & Positioning

### 9.1 해자 구조

```
  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │  Layer 3 (가장 깊음)                                        │
  │  ┌───────────────────────────────────────────────────────┐  │
  │  │ 조직 수준 lock-in                                     │  │
  │  │                                                       │  │
  │  │ QA가 시나리오를 직접 작성/검토                          │  │
  │  │ PM이 given/then으로 스펙 검증                          │  │
  │  │ 디자이너가 then_ui로 UI 스펙 확인                      │  │
  │  │ git log = 비즈니스 로직 변경 히스토리                   │  │
  │  │                                                       │  │
  │  │ → 도구를 바꾸면 팀 워크플로우가 깨짐                    │  │
  │  │                                                       │  │
  │  │  Layer 2                                              │  │
  │  │  ┌─────────────────────────────────────────────────┐  │  │
  │  │  │ 에코시스템 lock-in                              │  │  │
  │  │  │                                                 │  │  │
  │  │  │ Protocol Preset 축적                            │  │  │
  │  │  │ (오픈소스 컨트랙트 → AI 자동 생성 파이프라인)     │  │  │
  │  │  │ AI 시나리오 데이터셋 축적                        │  │  │
  │  │  │ "Web3 프론트 테스트 = LunaTest" 카테고리 선점    │  │  │
  │  │  │                                                 │  │  │
  │  │  │  Layer 1 (가장 얕음)                            │  │  │
  │  │  │  ┌───────────────────────────────────────────┐  │  │  │
  │  │  │  │ 기술적 차별점 (복제 가능)                  │  │  │  │
  │  │  │  │                                           │  │  │  │
  │  │  │  │ Lua VM 결정론적 격리 실행                  │  │  │  │
  │  │  │  │ EIP-1193 in-process 주입                  │  │  │  │
  │  │  │  └───────────────────────────────────────────┘  │  │  │
  │  │  └─────────────────────────────────────────────────┘  │  │
  │  └───────────────────────────────────────────────────────┘  │
  └─────────────────────────────────────────────────────────────┘
```

### 9.2 누구나 읽는 테스트 — 비개발 직군의 참여

Lua 시나리오는 사실상 **실행 가능한 비즈니스 스펙 문서**다.

**직군별 참여 범위:**

| 역할            | 기존 Web3 테스트         | LunaTest                  |
| --------------- | ------------------------ | ------------------------- |
| 프론트 개발자   | hex fixture 작성         | 시나리오 작성             |
| QA              | "개발자한테 물어봐야..." | 시나리오 직접 작성/검토   |
| PM              | 테스트 결과만 봄         | given/then 읽고 스펙 검증 |
| 디자이너        | 관여 불가                | then_ui로 UI 스펙 확인    |
| 컨트랙트 개발자 | "프론트 테스트는 몰라"   | given에 상태 정의 기여    |

**실패 리포트 비교:**

```
  기존:
  ──────────────────────────────────────────────────────────
  FAIL: expected 0x00000000000000000000000000000000000000
  00000000000000000f4240 but got 0x000000000000000000000
  00000000000000000000000000000186a0

  → 이걸 보고 뭘 알 수 있음?


  LunaTest:
  ──────────────────────────────────────────────────────────
  FAIL: 잔고_부족시_스왑버튼_비활성화

    ✗ swap_button.enabled
      expected: false
      actual:   true

    ✗ error_msg.text
      expected: "Insufficient ETH balance"
      actual:   (not rendered)

    given:
      wallet.ETH = 0.001
      swap input = 10 ETH

  → QA가 바로 버그 리포트 쓸 수 있음
```

**히스토리 = 비즈니스 스펙 변경 이력:**

```
  git log --oneline scenarios/

  a3f2b1c  feat: 멀티홉 스왑 슬리피지 경고 시나리오 추가
  8d1e4a7  fix: 잔고 부족 시 에러 메시지 스펙 변경
  2c9f0b3  feat: 브릿지 pending 상태 타임아웃 시나리오
  f1a8c2d  fix: approve 플로우 5단계 → 4단계로 단순화

  → hex fixture git log는 아무도 안 읽지만
    Lua 시나리오 git log는 PM도 읽을 수 있음
```

### 9.3 Flaky 0% → 첨예한 엣지 케이스

flaky가 0%라는 건 단순히 "안정적이다"가 아님. **테스트가 깨지면 100% 버그**라는 뜻.

```
  기존 도구에서 경계값 테스트:
  ──────────────────────────────────────────────────────────
  테스트 실패 → "이거 진짜 버그야? flaky야?"
             → 재실행해봄 → 통과
             → "flaky였네" → 넘어감
             → 실은 진짜 버그였는데 묻힘     ← 이게 위험

  LunaTest에서 경계값 테스트:
  ──────────────────────────────────────────────────────────
  테스트 실패 → 100% 버그. 논쟁 없음.
             → 즉시 수정
             → 다시 돌려서 통과 확인
             → 신뢰                          ← 엣지 케이스에 강함
```

이 신뢰 덕분에 다른 도구에서는 시도하기 어려운 **경계값 시나리오를 공격적으로 작성** 가능:

```lua
-- 이런 테스트를 flaky 걱정 없이 수백 개 만들 수 있음
scenarios = {
  -- 잔고 경계
  { name = "정확히_0_ETH",       wallet = { ETH = 0 } },
  { name = "가스비만큼만_보유",   wallet = { ETH = 0.0021 } },
  { name = "1wei_부족",          wallet = { ETH = 9.999999999999999999 } },

  -- 슬리피지 경계
  { name = "슬리피지_4.99%",     slippage = 0.0499 },  -- 경고 안 뜸
  { name = "슬리피지_5.00%",     slippage = 0.0500 },  -- 경고 뜸
  { name = "슬리피지_5.01%",     slippage = 0.0501 },  -- 경고 뜸

  -- approve 경계
  { name = "allowance_정확히_일치", allowance = 1000, amount = 1000 },
  { name = "allowance_1wei_부족",  allowance = 999.999999, amount = 1000 },

  -- 가격 영향 경계
  { name = "priceImpact_0.99%",  priceImpact = 0.0099 },  -- 안내 없음
  { name = "priceImpact_1.00%",  priceImpact = 0.0100 },  -- 주의 안내
  { name = "priceImpact_5.00%",  priceImpact = 0.0500 },  -- 강한 경고
}
-- 이 12개 시나리오 전체 실행: < 5ms
-- flaky 확률: 0%
-- 다른 도구에서 이걸 신뢰할 수 있게 만들기: 사실상 불가능
```

---

## 10. 개발 방법론 — TDD Strategy

> 모든 Phase는 TDD(Test-Driven Development)로 진행한다.
> LunaTest의 본질이 "input → process → output" 순수 함수 체인이므로,
> 테스트를 먼저 작성하고 구현하는 사이클이 자연스럽게 적용된다.

### 8.1 TDD가 적합한 구조적 이유

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Why TDD Fits LunaTest                            │
│                                                                     │
│  LunaTest = Mock을 만드는 SDK                                       │
│           = 외부 의존성(체인, 지갑, 네트워크)이 전부 Lua 테이블      │
│           = 테스트 환경 세팅 비용 ≈ 0                               │
│           = 자기 자신을 테스트하기 가장 쉬운 구조                    │
│                                                                     │
│  given(Lua table) ──► when(action) ──► then(assertion)              │
│       ↑                                     ↑                       │
│   테스트 fixture가                    expected가                    │
│   곧 제품 코드의 input               곧 제품 코드의 output          │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 레이어별 TDD 전략

```
  Layer 1: Lua Runtime          ──► Classic TDD (Bottom-Up)
  ─────────────────────────────────────────────────────────
  │  모든 결정론 패치가 단위 테스트 대상
  │
  │  Red:   math.random() 호출 → 고정 시드 시퀀스 기대
  │  Green: sandbox.ts에서 PRNG 패치 구현
  │  Refactor: 시드 주입 인터페이스 정리
  │
  │  Red:   io.open() 호출 → 에러 기대
  │  Green: blockIO() 구현
  │  Refactor: 에러 메시지 표준화
  │
  │  사이클: ~5분 단위. input → output 명확.

  Layer 2: Mock Provider        ──► Classic TDD (Bottom-Up)
  ─────────────────────────────────────────────────────────
  │  상태 머신 전이 케이스를 먼저 정의하고 구현
  │
  │  Red:   EventQueue.advance(3000) → tx_confirmed 이벤트 기대
  │  Green: events.lua 시간 전진 로직 구현
  │  Refactor: 이벤트 정렬 최적화
  │
  │  Red:   WalletMock.approve("USDC", 1000) → allowance 업데이트 기대
  │  Green: wallet.lua approve 로직 구현
  │  Refactor: allowance 조회 API 정리

  Layer 3: Scenario Engine      ──► BDD-style TDD
  ─────────────────────────────────────────────────────────
  │  DSL 자체가 Given-When-Then이라 BDD 스타일이 자연스러움
  │
  │  Red:   invalid scenario (missing 'given') → 검증 에러 기대
  │  Green: validate() 구현
  │  Refactor: 에러 메시지에 missing field 힌트 추가
  │
  │  Red:   5-stage scenario → stage[3] 전이 시 assert 통과 기대
  │  Green: stages.lua 상태 머신 구현
  │  Refactor: 전이 조건 DSL 단순화

  Layer 4: Test Runner          ──► Classic TDD
  ─────────────────────────────────────────────────────────
  │  "테스트 프레임워크를 테스트하는" 메타 구조
  │
  │  Red:   assertUI({ button: true }) + actual { button: false } → FAIL 기대
  │  Green: assert.ts 비교 로직 구현
  │  Refactor: diff 출력 포맷 개선
  │
  │  Red:   100 scenarios 로드 + 실행 → < 1초 기대
  │  Green: runner.ts 병렬 실행 구현
  │  Refactor: VM 풀링 최적화

  EIP-1193 Provider             ──► Outside-In TDD
  ─────────────────────────────────────────────────────────
  │  인터페이스 계약부터 테스트 작성 → 내부 구현
  │
  │  Red:   request({ method: 'eth_chainId' }) → '0x1' 기대
  │  Green: luna-provider.ts 메서드 라우팅 구현
  │  Refactor: 메서드 디스패처 패턴 적용
  │
  │  메서드 하나씩 Red → Green 반복 (8개 메서드)

  MCP Server                    ──► Outside-In TDD
  ─────────────────────────────────────────────────────────
  │  tool 핸들러 = 단위 테스트, transport = 통합 테스트
  │
  │  Red:   scenario.list() 호출 → 등록된 시나리오 목록 기대
  │  Green: tools/scenario.ts 핸들러 구현
  │  Refactor: 응답 스키마 표준화
  │
  │  transport 레이어는 통합 테스트로 커버
```

### 8.3 테스트 유형 분배

```
  ┌─────────────────────────────────────────────────────────────┐
  │                   Test Distribution                         │
  │                                                             │
  │   Unit Tests (70%)                                          │
  │   ├── 결정론 패치 (sandbox.ts)                              │
  │   ├── 타입 변환 (bridge.ts)                                 │
  │   ├── Mock 상태 관리 (chain/wallet/events.lua)              │
  │   ├── DSL 파싱 + 검증 (dsl.lua)                            │
  │   ├── Assertion 엔진 (assert.ts)                            │
  │   └── EIP-1193 메서드 매핑 (luna-provider.ts)               │
  │                                                             │
  │   Integration Tests (20%)                                   │
  │   ├── JS ↔ Lua 브릿지 왕복 (Wasmoon 경계)                  │
  │   ├── Scenario 전체 실행 (Load → Execute → Assert)          │
  │   ├── LunaProvider + wagmi/ethers 어댑터                    │
  │   └── MCP stdio transport 요청-응답                         │
  │                                                             │
  │   Property-Based Tests (10%)                                │
  │   ├── 결정론 검증: N회 반복 → 항상 동일 결과                │
  │   ├── 시나리오 변이: 랜덤 input → 크래시 없음 확인          │
  │   └── 브릿지 퍼징: 임의 JS object → Lua 왕복 무손실         │
  │                                                             │
  │   도구: Vitest + fast-check (property-based)                │
  └─────────────────────────────────────────────────────────────┘
```

### 8.4 주의 지점

**Wasmoon 브릿지 경계** — JS ↔ Lua 타입 변환(`bridge.ts`)은 Wasmoon 내부 동작에 의존하는 엣지가 있음. 순수 단위 테스트만으로 커버 불가. Outside-In TDD로 통합 테스트를 먼저 작성하고 브릿지를 구현할 것.

**MCP transport** — stdio 기반 JSON-RPC의 요청-응답 테스트가 약간 번거로움. tool 핸들러 각각은 단위 테스트, transport 레이어만 통합 테스트로 분리.

### 8.5 세션별 TDD 사이클 가이드

> 코딩 에이전트 세션 진행 시, 각 파일의 구현 순서.

```
  모든 세션 공통:

  1. 테스트 파일 먼저 생성     __tests__/foo.test.ts
  2. 실패하는 테스트 작성       Red ❌
  3. 최소 구현                  Green ✅
  4. 리팩터                     Refactor ♻️
  5. 다음 테스트 케이스로       → 2번 반복
  6. 세션 종료 전               Phase Gate 체크리스트 전수 검증
```

| Session | TDD 접근    | 핵심 테스트 우선 작성 대상                                      |
| ------- | ----------- | --------------------------------------------------------------- |
| Phase 0 | Classic     | `call()` 왕복, 결정론 100회 반복                                |
| 1-1     | Classic     | sandbox 패치 6종 (random, time, io, table, instruction, memory) |
| 1-2     | Classic     | EventQueue 시간 전진, WalletMock 상태 전이                      |
| 1-3     | BDD-style   | DSL 검증 실패 케이스, 5-stage 전이 시나리오                     |
| 1-4     | Classic     | 5종 assertion 통과/실패 쌍, 리포터 출력 포맷                    |
| 1-5     | Integration | CLI 커맨드 E2E, 1000회 결정론 property test                     |
| 2-1     | Outside-In  | EIP-1193 메서드 8개 계약 테스트                                 |
| 2-2     | Outside-In  | wagmi config 주입 → hook 호출 → mock 응답                       |
| 2-3     | E2E         | 실제 dApp approve→swap 전체 플로우                              |
| 3-1     | Outside-In  | MCP tool 14개 핸들러 단위 테스트                                |
| 3-2     | Property    | 시나리오 변이 생성 → 크래시 없음                                |
| 3-3     | Integration | MCP 전체 워크플로우 (analyze→generate→execute)                  |
| 4-1~4   | Mixed       | 프리셋 스키마 검증, 플러그인 통합, CI 파이프라인                |

---

## 11. 구현 페이즈 — Coding Agent Session Guide

> 각 Phase는 **코딩 에이전트(Claude Code / Codex)의 1개 세션**으로 완수 가능한 단위.
> 의존성 순서대로 진행하며, 각 Phase 완료 시 검증 기준을 반드시 통과해야 다음으로 넘어간다.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Implementation Phase Map                         │
│                                                                     │
│  Phase 0       Phase 1       Phase 2       Phase 3       Phase 4   │
│  ┌──────┐     ┌──────┐     ┌──────┐     ┌──────┐     ┌──────┐    │
│  │Spike │────►│ Core │────►│Provdr│────►│ MCP  │────►│ Eco  │    │
│  │ PoC  │     │  SDK │     │Integr│     │Server│     │System│    │
│  └──────┘     └──────┘     └──────┘     └──────┘     └──────┘    │
│   2 weeks      6 weeks      4 weeks      4 weeks      6 weeks     │
│                                                                     │
│  ■ = 1 coding agent session                                        │
│                                                                     │
│  Phase 0: ■                                                        │
│  Phase 1: ■ ■ ■ ■ ■                                               │
│  Phase 2: ■ ■ ■                                                    │
│  Phase 3: ■ ■ ■                                                    │
│  Phase 4: ■ ■ ■ ■                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Phase 0: Spike PoC (1 session, ~2 weeks)

**Goal:** Wasmoon + React 연동 검증, 1개 시나리오 E2E 실행

**Session Scope:**

```
이 세션에서 만들 것:
├── packages/spike/
│   ├── package.json              # wasmoon, react 의존성
│   ├── src/
│   │   ├── runtime.ts            # Wasmoon 초기화 + 기본 bridge
│   │   ├── scenario.lua          # 1개 swap 시나리오 (하드코딩)
│   │   └── spike.test.ts         # Vitest: scenario 실행 → assert
│   └── tsconfig.json
└── README.md
```

**구현 태스크:**

1. monorepo 초기화 (pnpm workspace + turborepo)
2. `wasmoon` 패키지 설치, Lua VM 인스턴스 생성 래퍼
3. JS → Lua 함수 호출 (`call`) 구현
4. Lua → JS 호스트 함수 등록 (`register`) 구현
5. 하드코딩된 swap 시나리오 Lua 파일 작성
6. Vitest에서 시나리오 로드 → 실행 → 결과 비교 테스트
7. 실행 시간 측정 (< 1ms 목표 확인)

**검증 기준 (Phase Gate):**

```
✅ Lua VM이 Node.js 환경에서 정상 초기화
✅ JS → Lua 함수 호출 왕복 동작
✅ 1개 swap scenario가 < 1ms에 실행
✅ 동일 scenario 100회 반복 시 100% 동일 결과 (결정론 검증)
```

---

### Phase 1: Core SDK (5 sessions, ~6 weeks)

**Goal:** `@lunatest/core` (Layer 1-4) + CLI 기본 기능

#### Session 1-1: Layer 1 — Lua Runtime Engine

```
구현 범위:
├── packages/core/src/runtime/
│   ├── engine.ts           # LunaRuntime class
│   │   ├── constructor()   #   Wasmoon 초기화 + 샌드박스 설정
│   │   ├── call()          #   Lua 함수 호출 (타입 안전)
│   │   ├── register()      #   호스트 함수 등록
│   │   ├── getState()      #   스냅샷 추출
│   │   ├── reset()         #   VM 리셋
│   │   └── destroy()       #   메모리 해제
│   │
│   ├── bridge.ts           # JS <-> Lua 타입 변환
│   │   ├── toLua()         #   JS object → Lua table
│   │   ├── fromLua()       #   Lua table → JS object
│   │   └── marshalFn()     #   함수 래핑 (에러 핸들링 포함)
│   │
│   ├── sandbox.ts          # 결정론 보장 설정
│   │   ├── patchRandom()   #   고정 시드 PRNG 주입
│   │   ├── patchTime()     #   가상 시계 주입
│   │   ├── blockIO()       #   io.*, os.execute 차단
│   │   └── patchTable()    #   삽입순 보장 래퍼
│   │
│   └── __tests__/
│       ├── engine.test.ts
│       ├── bridge.test.ts
│       └── sandbox.test.ts
```

**검증 기준:**

```
✅ math.random() → 시드 고정, 동일 시퀀스 출력
✅ os.time() → 가상 시간 반환 (시스템 시간 독립)
✅ io.open() → 에러 발생 (차단 확인)
✅ table iteration → 삽입 순서 보장 확인
✅ instruction limit 초과 시 graceful 종료
✅ 메모리 16MB 초과 시 에러
```

#### Session 1-2: Layer 2 — Mock Provider

```
구현 범위:
├── packages/core/src/mocks/
│   ├── chain.lua           # ChainMock
│   │   ├── chain.new()     #   체인 상태 초기화 (id, name, block, gas)
│   │   ├── chain.pools     #   풀 상태 테이블
│   │   └── chain.tokens    #   토큰 상태 테이블
│   │
│   ├── wallet.lua          # WalletMock
│   │   ├── wallet.new()    #   지갑 상태 (connected, address, balances)
│   │   ├── wallet.approve()#   allowance 업데이트
│   │   └── wallet.sign()   #   서명 시뮬레이션 / reject
│   │
│   ├── events.lua          # EventQueue
│   │   ├── queue.new()     #   이벤트 큐 초기화
│   │   ├── queue.push()    #   이벤트 삽입 (at, type, payload)
│   │   ├── queue.advance() #   가상 시간 전진
│   │   └── queue.peek()    #   현재 이벤트 조회
│   │
│   ├── provider.ts         # MockProvider 오케스트레이터
│   │   └── inject()        #   given → Lua state 주입
│   │
│   └── __tests__/
│       ├── chain.test.ts
│       ├── wallet.test.ts
│       └── events.test.ts
```

**검증 기준:**

```
✅ ChainMock → pool/token 데이터 쿼리 정상
✅ WalletMock → connect/disconnect/approve 상태 전이
✅ EventQueue → 가상 시간 전진 시 올바른 이벤트 방출
✅ 동일 given 상태에서 항상 동일한 mock 응답 (결정론)
```

#### Session 1-3: Layer 3 — Scenario Engine

```
구현 범위:
├── packages/core/src/scenario/
│   ├── dsl.lua             # Scenario DSL
│   │   ├── scenario()      #   시나리오 정의 함수
│   │   ├── validate()      #   스키마 검증
│   │   └── normalize()     #   given/when/then 정규화
│   │
│   ├── stages.lua          # Stage Machine
│   │   ├── machine.new()   #   스테이지 머신 초기화
│   │   ├── machine.next()  #   다음 스테이지 전이
│   │   ├── machine.current()#  현재 스테이지 조회
│   │   └── machine.done()  #   완료 여부 확인
│   │
│   ├── clock.lua           # Virtual Clock
│   │   ├── clock.new()     #   가상 시계 초기화
│   │   ├── clock.advance() #   시간 전진 (ms 단위)
│   │   └── clock.now()     #   현재 가상 시간
│   │
│   └── __tests__/
│       ├── dsl.test.ts
│       ├── stages.test.ts
│       └── clock.test.ts
```

**검증 기준:**

```
✅ scenario() DSL로 정의한 시나리오 파싱 성공
✅ multi-stage: 5단계 approve→swap 흐름 상태 전이 정상
✅ virtual clock: advance(3000) 후 이벤트 큐 연동 확인
✅ invalid scenario → 명확한 에러 메시지 (validation)
```

#### Session 1-4: Layer 4 — Test Runner + Assertion

```
구현 범위:
├── packages/core/src/runner/
│   ├── runner.ts           # Scenario Executor
│   │   ├── load()          #   .lua 파일 로드 + 의존성 해소
│   │   ├── run()           #   단일 시나리오 실행
│   │   ├── runAll()        #   필터 기반 일괄 실행
│   │   └── watch()         #   파일 변경 감지 재실행
│   │
│   ├── assert.ts           # Assertion Engine
│   │   ├── assertUI()      #   UI 상태 비교
│   │   ├── assertState()   #   내부 상태 비교
│   │   ├── assertTransition()#  상태 전이 비교
│   │   ├── assertNot()     #   부재 확인
│   │   └── diff()          #   실패 시 diff 생성
│   │
│   ├── reporter.ts         # Output Formatters
│   │   ├── console()       #   터미널 출력
│   │   ├── json()          #   JSON 파일 출력
│   │   ├── junit()         #   JUnit XML (CI 호환)
│   │   └── html()          #   HTML 리포트
│   │
│   └── __tests__/
│       ├── runner.test.ts
│       ├── assert.test.ts
│       └── reporter.test.ts
```

**검증 기준:**

```
✅ 100개 시나리오 로드 + 실행 < 1초
✅ PASS/FAIL 판정 정확 (5개 assertion type 모두)
✅ 실패 시 expected vs actual diff 출력
✅ JUnit XML 출력 → CI 파서 호환 검증
```

#### Session 1-5: CLI + Integration Test

```
구현 범위:
├── packages/cli/
│   ├── src/
│   │   ├── index.ts        # CLI entry point
│   │   ├── commands/
│   │   │   ├── run.ts      #   $ lunatest run [filter]
│   │   │   ├── watch.ts    #   $ lunatest watch
│   │   │   └── coverage.ts #   $ lunatest coverage
│   │   └── config.ts       #   lunatest.config.ts 로딩
│   │
│   └── __tests__/
│       └── cli.test.ts
│
├── packages/core/
│   └── __tests__/
│       └── integration/
│           ├── full-swap.test.ts       # 전체 스왑 플로우
│           ├── multi-stage.test.ts     # 5단계 시나리오
│           └── determinism.test.ts     # 1000회 반복 결정론
│
└── npm publish 준비
    ├── @lunatest/core package.json (exports 설정)
    └── @lunatest/cli package.json (bin 설정)
```

**검증 기준:**

```
✅ $ lunatest run → 시나리오 탐색 + 실행 + 결과 출력
✅ $ lunatest watch → 파일 변경 시 자동 재실행
✅ $ lunatest coverage → 커버리지 리포트 생성
✅ E2E: approve → swap 5단계 full flow 통과
✅ 1000개 동일 시나리오 반복 → 100% 동일 결과
✅ npm pack → 정상 패키징
```

---

### Phase 2: EIP-1193 Provider Integration (3 sessions, ~4 weeks)

#### Session 2-1: LunaProvider Core

```
구현 범위:
├── packages/core/src/provider/
│   ├── luna-provider.ts    # EIP-1193 호환 Provider
│   │   ├── request()       #   EIP-1193 request 메서드
│   │   ├── on()            #   이벤트 구독
│   │   ├── removeListener()
│   │   └── 메서드 라우팅:
│   │       ├── eth_chainId      → scenario.given.chain.id
│   │       ├── eth_accounts     → scenario.given.wallet.address
│   │       ├── eth_getBalance   → scenario.given.wallet.balances
│   │       ├── eth_call         → Lua function dispatch
│   │       ├── eth_sendTransaction → EventQueue.push
│   │       ├── eth_getTransactionReceipt → EventQueue.current
│   │       ├── wallet_switchEthChain → WalletMock.chain
│   │       └── eth_subscribe    → EventQueue listener
│   │
│   └── __tests__/
│       └── luna-provider.test.ts
```

#### Session 2-2: Framework Adapters (wagmi / ethers)

```
구현 범위:
├── packages/react/
│   ├── src/
│   │   ├── LunaTestProvider.tsx   # React context provider
│   │   ├── useLunaTest.ts         # 테스트 제어 hook
│   │   ├── adapters/
│   │   │   ├── wagmi.ts           # wagmi config 주입
│   │   │   ├── ethers.ts          # ethers provider 교체
│   │   │   └── web3js.ts          # web3.js provider 교체
│   │   └── index.ts
│   │
│   └── __tests__/
│       ├── wagmi-adapter.test.tsx
│       └── ethers-adapter.test.tsx
```

#### Session 2-3: Real dApp Integration Test

```
구현 범위:
├── examples/
│   ├── swap-dapp/                  # 샘플 Swap dApp
│   │   ├── src/                    #   wagmi + React
│   │   └── __tests__/
│   │       └── swap.luna.ts        #   LunaTest 시나리오
│   │
│   └── defi-dashboard/             # 샘플 DeFi 대시보드
│       ├── src/                    #   ethers + React
│       └── __tests__/
│           └── dashboard.luna.ts
│
└── docs/
    ├── getting-started.md
    └── wagmi-integration.md
```

**Phase 2 검증 기준:**

```
✅ LunaProvider가 EIP-1193 spec 준수 (모든 메서드)
✅ wagmi 기반 dApp에서 코드 변경 없이 테스트 실행
✅ ethers 기반 dApp에서 코드 변경 없이 테스트 실행
✅ 실제 swap UI 시나리오 — approve → swap → success 통과
✅ 에러 시나리오 — insufficient balance, reverted tx 등 통과
```

---

### Phase 3: MCP Server (3 sessions, ~4 weeks)

#### Session 3-1: MCP Server Core

```
구현 범위:
├── packages/mcp/
│   ├── src/
│   │   ├── server.ts           # MCP Server entry
│   │   ├── tools/
│   │   │   ├── scenario.ts     #   scenario.* tools
│   │   │   ├── mock.ts         #   mock.* tools
│   │   │   ├── coverage.ts     #   coverage.* tools
│   │   │   └── component.ts    #   component.* tools
│   │   ├── resources/
│   │   │   ├── scenarios.ts    #   lunatest://scenarios
│   │   │   ├── coverage.ts     #   lunatest://coverage
│   │   │   ├── components.ts   #   lunatest://components
│   │   │   └── guide.ts        #   lunatest://guide
│   │   └── index.ts
│   │
│   └── __tests__/
│       └── mcp-server.test.ts
```

#### Session 3-2: AI Prompts + Scenario Generation

```
구현 범위:
├── packages/mcp/src/
│   ├── prompts/
│   │   ├── generate-edge-cases.ts
│   │   ├── analyze-failure.ts
│   │   ├── improve-coverage.ts
│   │   └── regression-from-diff.ts
│   │
│   └── generation/
│       ├── mutator.ts          # 시나리오 변이 생성기
│       │   ├── mutateValues()  #   숫자 경계값 변이
│       │   ├── mutateStages()  #   스테이지 순서 변이
│       │   └── mutateMocks()   #   mock 상태 변이
│       │
│       └── combinatorial.ts    # 조합 폭발 생성기
│           └── generate()      #   N개 파라미터 × M개 값
```

#### Session 3-3: Integration + CLI `gen` Command

```
구현 범위:
├── packages/cli/src/commands/
│   └── gen.ts              # $ lunatest gen --ai
│       ├── analyzeGaps()   #   coverage gaps 분석
│       ├── generate()      #   AI 시나리오 생성 호출
│       └── runGenerated()  #   생성된 시나리오 즉시 실행
│
└── e2e-tests/
    └── mcp-flow.test.ts    # MCP 전체 워크플로우 검증
```

**Phase 3 검증 기준:**

```
✅ MCP 서버가 stdio transport로 정상 기동
✅ scenario.list/get/create/run/mutate 모든 tool 동작
✅ coverage.gaps() → 미커버 영역 정확히 식별
✅ AI agent가 coverage gap 기반으로 시나리오 50+ 자동 생성
✅ $ lunatest gen --ai → 시나리오 생성 + 실행 + 리포트 원스텝
```

---

### Phase 4: Ecosystem (4 sessions, ~6 weeks)

#### Session 4-1: Protocol Presets

```
구현 범위:
├── packages/core/src/mocks/presets/
│   ├── uniswap_v2.lua      # Uniswap V2 상태 템플릿
│   ├── uniswap_v3.lua      # Uniswap V3 (concentrated liquidity)
│   ├── curve.lua            # Curve (stable swap)
│   └── aave.lua             # Aave (lending)
│
└── 각 preset:
    ├── pool() / market()    #   상태 초기화 헬퍼
    ├── scenarios/           #   기본 시나리오 번들
    └── __tests__/
```

#### Session 4-2: Vitest / Playwright Plugin

```
구현 범위:
├── packages/vitest-plugin/
│   ├── src/
│   │   ├── plugin.ts        # Vitest plugin
│   │   └── matchers.ts      # Custom matchers (toLunaPass, etc.)
│   └── __tests__/
│
└── packages/playwright-plugin/
    ├── src/
    │   ├── fixture.ts       # Playwright fixture
    │   └── commands.ts      # Custom commands
    └── __tests__/
```

#### Session 4-3: Documentation Site

```
구현 범위:
├── docs/
│   ├── index.md                # Landing
│   ├── getting-started.md      # Quick start (5분 가이드)
│   ├── concepts/
│   │   ├── architecture.md     # 아키텍처 설명
│   │   ├── determinism.md      # 결정론 보장 메커니즘
│   │   └── mock-provider.md    # 관심사 분리 원칙
│   ├── guides/
│   │   ├── writing-scenarios.md
│   │   ├── multi-stage.md
│   │   ├── wagmi-setup.md
│   │   ├── ethers-setup.md
│   │   └── ci-integration.md
│   ├── api/
│   │   ├── core.md
│   │   ├── cli.md
│   │   ├── mcp.md
│   │   └── react.md
│   └── recipes/
│       ├── swap-testing.md
│       ├── approval-flow.md
│       └── error-handling.md
```

#### Session 4-4: CI/CD + Release Pipeline

```
구현 범위:
├── .github/workflows/
│   ├── ci.yml              # PR 검증 (lint + test + build)
│   ├── release.yml         # npm publish (changesets)
│   └── benchmark.yml       # 성능 회귀 감지
│
├── changeset config
├── turbo.json 최적화
└── README.md (badges, quick start)
```

**Phase 4 검증 기준:**

```
✅ 3개 프로토콜 preset (Uniswap V2/V3, Curve) 동작
✅ Vitest plugin → describe/it 스타일로 LunaTest 시나리오 실행
✅ Playwright plugin → E2E 테스트에서 LunaProvider 자동 주입
✅ 문서 사이트 빌드 + 배포
✅ GitHub Actions CI → PR마다 전체 테스트 + 벤치마크
✅ npm publish → @lunatest/* 패키지 퍼블리시
```

---

## 12. 세션별 프롬프트 가이드

> 코딩 에이전트에게 각 세션을 시작할 때 전달할 컨텍스트 요약.

### Session 시작 시 공통 프롬프트

```
프로젝트: LunaTest — C Lua WASM 기반 Web3 프론트엔드 결정론적 테스트 SDK
스택: TypeScript + Lua, Wasmoon, pnpm monorepo, Vitest
개발 방법론: TDD (테스트 먼저 작성 → 최소 구현 → 리팩터)
핵심 원칙:
  1. 완전 결정론 (동일 input → 항상 동일 output)
  2. 컨트랙트 수학은 관심사 밖 (프론트엔드 로직만 테스트)
  3. EIP-1193 호환 (앱 코드 변경 제로)
패키지 구조: @lunatest/core, @lunatest/cli, @lunatest/react, @lunatest/mcp
테스트: 모든 구현은 __tests__/ 먼저 작성. fast-check으로 결정론 property test.
```

### 각 세션별 추가 컨텍스트

| Session | 추가 프롬프트 핵심                                                                      |
| ------- | --------------------------------------------------------------------------------------- |
| Phase 0 | "wasmoon 패키지로 Lua VM 초기화, JS↔Lua 브릿지 구현, 1개 swap 시나리오 PoC"             |
| 1-1     | "LunaRuntime 클래스 구현. 결정론 보장이 최우선 — math.random, os.time, io.\* 모두 패치" |
| 1-2     | "ChainMock, WalletMock, EventQueue를 Lua 테이블로 구현. 가상 시간 기반 이벤트 재생"     |
| 1-3     | "Given-When-Then DSL을 Lua 테이블로 구현. Multi-stage 상태 머신 포함"                   |
| 1-4     | "시나리오 로더 + 5종 assertion + 4종 리포터(console/json/junit/html) 구현"              |
| 1-5     | "CLI (run/watch/coverage) + 통합 테스트. npm publish 준비"                              |
| 2-1     | "EIP-1193 호환 LunaProvider 구현. 8개 메서드 → Lua mock 라우팅"                         |
| 2-2     | "wagmi/ethers 어댑터 + React provider 구현. 코드 변경 제로가 핵심"                      |
| 2-3     | "실제 swap dApp 예제에서 LunaTest 통합 E2E 검증"                                        |
| 3-1     | "MCP 서버: tools 14개, resources 6개 구현. stdio transport"                             |
| 3-2     | "시나리오 변이 생성기 + 조합 폭발 생성기. AI prompt 4종"                                |
| 3-3     | "CLI gen 커맨드 + MCP 전체 워크플로우 E2E 테스트"                                       |
| 4-1     | "프로토콜 프리셋 3종. 상태 형태 템플릿이지 실제 수학 아님"                              |
| 4-2     | "Vitest/Playwright 플러그인. 기존 테스트 러너에 자연스럽게 통합"                        |
| 4-3     | "문서 사이트 (VitePress 추천). 5분 quick start가 핵심"                                  |
| 4-4     | "GitHub Actions CI/CD + changesets + npm publish 파이프라인"                            |

---

## Appendix: 경쟁 비교 요약

```
┌──────────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│                  │ Jest/Vitest  │ MSW / Mock   │ Anvil / Fork │  LunaTest    │
├──────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤
│ 테스트 레이어     │ Unit test    │ HTTP 트랜스포트│ 로컬 체인 포크│ 도메인 로직   │
│ Web3 인식        │ ❌           │ △            │ ✅           │ ✅           │
│ 결정론           │ ✅           │ ✅           │ ❌ 블록 타이밍 │ ✅           │
│ Flaky            │ 낮음         │ 중간          │ 높음         │ 0%           │
│ 테스트 속도       │ ~1-5ms       │ ~5-20ms      │ ~1-10s       │ ~0.1-1ms     │
│ 프론트 버그 격리  │ ✅           │ △ 노이즈      │ △ 체인 에러   │ ✅ 순수 격리  │
│ CI 비용          │ 낮음         │ 낮음          │ 높음         │ 낮음          │
│ Human-friendly   │ △ ABI 노이즈  │ ❌ hex fixture│ ❌ storage op│ ✅ Lua 테이블 │
│ AI-friendly      │ △            │ △            │ ❌ 인프라 의존│ ✅ MCP native │
│ 비개발 직군 참여  │ ❌           │ ❌           │ ❌           │ ✅ QA/PM/디자인│
│ 엣지 케이스 신뢰  │ ✅           │ △ flaky 혼재  │ ❌ flaky 심각│ ✅ 깨지면 버그 │
└──────────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

---

_End of PRD — LunaTest v0.1.0_
