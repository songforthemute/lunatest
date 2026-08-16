# Scaffold provenance

This fixture is derived from the official Vite React TypeScript template.

- Repository: <https://github.com/vitejs/vite>
- Template path: `packages/create-vite/template-react-ts`
- Immutable revision: `14454fd8c9a399bc3fdc193e28465b6fcf001e4d`
- Source: <https://github.com/vitejs/vite/tree/14454fd8c9a399bc3fdc193e28465b6fcf001e4d/packages/create-vite/template-react-ts>
- Retrieved: 2026-08-16
- Upstream license: MIT; preserved in `LICENSE.vite`

## Copied template files

- `index.html`
- `package.json`
- `src/App.tsx`
- `src/index.css`
- `src/main.tsx`
- `src/vite-env.d.ts`
- `tsconfig.app.json`
- `tsconfig.json`
- `tsconfig.node.json`
- `vite.config.ts`

## Local modifications

- Renamed the private application to `lunatest-wagmi-swap-proof`.
- Replaced version ranges with exact pins for reproducible installs.
- Replaced the starter counter and image assets with a small reference-consumer shell.
- Reworked the upstream TypeScript configs for an isolated proof fixture: ES2022
  application target, explicit strict/no-emit checks, bundler resolution, and a
  separate ES2023 Vite config project. These settings replace the upstream
  template's newer syntax flags while preserving project references.
- Added a real `@wagmi/core@3.6.4` and `viem@2.55.11` `createConfig` boundary.
- Added exact published LunaTest package versions for the registry lane. The pack
  lane replaces only those packages with staged tarballs in a temporary copy.
- Added an isolated pnpm workspace policy and committed lockfile.
- Reserved `scenarios/` and `tests/` for later proof tasks without adding journey logic.

The application intentionally has no LunaTest runtime bootstrap, deterministic
wallet, protocol journey, Lua scenario, Vitest test, or Playwright test yet. Those
belong to later implementation tasks so this commit remains the clean baseline.
