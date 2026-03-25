# Architecture

LunaTest는 크게 네 레이어로 구성됩니다.

1. Lua WASM Runtime (Wasmoon)
2. Mock Provider (체인/지갑/이벤트)
3. Scenario Engine (Given-When-Then + Multi-stage)
4. Runner/Reporter (assertion + 결과 출력)

핵심 설계 원칙은 "같은 입력이면 항상 같은 결과"입니다.
