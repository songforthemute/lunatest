---
"@lunatest/contracts": patch
"@lunatest/core": patch
"@lunatest/runtime-intercept": patch
"@lunatest/react": patch
---

Complete deterministic protocol preset and wallet interceptor support.

- Add wallet metadata for known chains, watched assets, and deterministic rejection behavior.
- Materialize built-in protocol runtime state and protocol routes for Uniswap V2, Uniswap V3, Curve, and Aave.
- Resolve supported ERC-20 and protocol RPC calls through the browser runtime for `window.ethereum`, fetch, and XHR.
- Surface protocol runtime ordering and preview support through React bootstrap/devtools.
