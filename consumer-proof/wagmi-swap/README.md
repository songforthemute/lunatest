# LunaTest wagmi consumer proof

This is an isolated, pinned React + `@wagmi/core` + viem application derived
from the official Vite React TypeScript scaffold. It is not part of the LunaTest
pnpm workspace.

Run the clean packed-artifact lane from the repository root:

```sh
pnpm consumer-proof:pack
```

The registry lane uses only the exact LunaTest versions committed to this
fixture and a frozen lockfile:

```sh
pnpm consumer-proof:registry
```

A passing packed lane is pre-release evidence only. It does not certify E2;
that requires the later registry certification task after the proof versions
are published.
