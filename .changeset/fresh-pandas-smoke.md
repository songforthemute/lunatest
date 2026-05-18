---
"@lunatest/contracts": patch
"@lunatest/core": patch
"@lunatest/runtime-intercept": patch
"@lunatest/cli": patch
"@lunatest/react": patch
"@lunatest/mcp": patch
"@lunatest/playwright-plugin": patch
---

Fix CI, release, package smoke, and usability audit drift.

- Prevent CI workspace wrappers from re-entering root recursive scripts.
- Run npm registry consumer smoke after release publish workflow success.
- Prevent `gen --ai` from overwriting existing scenario files.
- Publish a consistent contracts/core/runtime package set so npm consumers receive the wallet helper exports required by the current runtime packages.
- Clarify MCP `component.states` state coverage versus component coverage semantics.
