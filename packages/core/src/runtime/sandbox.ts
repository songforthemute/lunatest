import type { RuntimeOptions } from "./types";

type SandboxShape = {
  math: {
    random: () => number;
  };
  os: {
    time: () => number;
    execute: () => never;
  };
  io: {
    open: () => never;
  };
};

function createDeterministicRandom(seed: number): () => number {
  let cursor = seed;

  return () => {
    const nextValue = Math.sin(cursor++) * 10000;
    const fractional = nextValue - Math.floor(nextValue);
    return Number(fractional.toFixed(6));
  };
}

export function createSandbox(options: RuntimeOptions = {}): SandboxShape {
  const seed = options.seed ?? 1;
  const now = options.now ?? 0;

  return {
    math: {
      random: createDeterministicRandom(seed),
    },
    os: {
      time: () => now,
      execute: () => {
        throw new Error("os.execute is blocked in sandbox");
      },
    },
    io: {
      open: () => {
        throw new Error("io.open is blocked in sandbox");
      },
    },
  };
}
