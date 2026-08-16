# LunaTest wagmi consumer proof

This is an isolated, pinned React + `@wagmi/core` + viem application derived
from the official Vite React TypeScript scaffold. It is not part of the LunaTest
pnpm workspace.

Run the clean packed-artifact lane from the repository root:

```sh
pnpm consumer-proof:pack
```

The registry lane uses only the exact LunaTest versions committed to this fixture
and its frozen lockfile, then runs the same Vitest and Playwright proof:

```sh
pnpm consumer-proof:registry
```

It is certifying only when all eight exact LunaTest versions equal npm `latest`,
their lock entries have registry integrity, and every proof gate passes. The
committed manifest and lockfile now record the package set certified by Release
run `31935453165` on 2026-08-16. Release automation may inject a future versioned
workspace package set into a temporary copy; it never changes this committed
fixture.

A passing packed lane is pre-release evidence only. It does not certify E2;
only a passing registry lane with `certificationEligible: true` does.
