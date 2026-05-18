# Architecture

LunaTest is organized into four layers:

1. Lua WASM Runtime (Wasmoon)
2. Mock Provider (chain, wallet, and event state)
3. Scenario Engine (Given-When-Then + multi-stage flows)
4. Runner/Reporter (assertions and output)

The core design principle is that the same input always produces the same result.
