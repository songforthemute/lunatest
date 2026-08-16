---
"@lunatest/core": patch
---

Preserve documented `stages`, `not_present`, and `timing_ms` assertions when
executing Lua scenarios through `executeLuaScenario`. Ship the Lua WASM binary
with the browser package so deterministic runtimes do not fetch it from a CDN.
