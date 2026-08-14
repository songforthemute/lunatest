---
"@lunatest/react": minor
---

Add the `@lunatest/react/wagmi` entrypoint with a real viem transport for
wagmi `createConfig`, contract-tested against `@wagmi/core@3.6.4` and
`viem@2.55.11`. Add the isolated `@lunatest/react/wagmi/connector` entrypoint
for real wagmi connection state and wallet actions. Deprecate the structural
`withLunaWagmiConfig` helper without removing it.
