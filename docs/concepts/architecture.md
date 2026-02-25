# Architecture

LunaTest는 4개 레이어로 구성됩니다.

1. Lua WASM Runtime (Wasmoon)
2. Mock Provider (체인/지갑/이벤트)
3. Scenario Engine (Given-When-Then + Multi-stage)
4. Runner/Reporter (assertions + outputs)

각 레이어는 결정론 보장을 우선으로 설계됩니다.
