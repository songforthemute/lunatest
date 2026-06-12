# DeFi Dashboard Dogfood Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Promote `examples/defi-dashboard` from placeholder to a runnable React example that dogfoods built-in protocol presets through public LunaTest APIs.

**Architecture:** Keep the example as a lightweight Vite React app inside the existing `examples/*` workspace. Protocol flows must use `@lunatest/core` preset materialization plus public `@lunatest/runtime-intercept` APIs and `window.ethereum.request`, not runtime internals. The dashboard presents deterministic frontend-flow evidence for Uniswap V2, Uniswap V3, Curve, and Aave without claiming exact EVM simulation.

**Tech Stack:** React 18, Vite 6, Vitest, TypeScript, LunaTest core/react/runtime-intercept, VitePress docs.

---

## Scope

- Convert `examples/defi-dashboard` into a private runnable workspace package.
- Add pure helper tests that execute public preset/runtime paths for built-in protocols.
- Render a distinctive risk-console dashboard from the dogfood snapshot.
- Document local usage and link it from onboarding/docs.

## Non-Goals

- Do not add exact protocol math or forked chain behavior.
- Do not expose runtime protocol internals as public API.
- Do not replace the existing swap live demo in docs; this PR adds a second runnable example path.

## Acceptance Criteria

- `pnpm --filter @lunatest/example-defi-dashboard test` passes.
- `pnpm --filter @lunatest/example-defi-dashboard build` passes.
- Workspace build/lint/test wrappers include the example without special casing.
- Docs clearly state the dashboard uses deterministic L3 frontend support.
