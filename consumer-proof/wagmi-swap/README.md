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
their lock entries have registry integrity, and every proof gate passes. Release
automation may inject the versioned workspace package set into a temporary copy;
it never changes this committed fixture. Until the pending release is published,
use the packed lane for pre-release evidence.

A passing packed lane is pre-release evidence only. It does not certify E2;
that requires the later registry certification task after the proof versions
are published.
