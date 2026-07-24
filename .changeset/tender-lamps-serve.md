---
"@lunatest/core": patch
"@lunatest/cli": patch
"@lunatest/mcp": patch
---

프로젝트 설정과 Lua 시나리오를 공통 로더로 제공하고, `lunatest-mcp`가 기본적으로 consumer 프로젝트의 config, scenario, coverage를 읽도록 개선했습니다. packed tarball 환경에서 CLI의 validate/run/coverage/gen/watch와 MCP JSON-RPC 워크플로를 검증합니다.
