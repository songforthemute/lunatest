function createDeterministicRandom(seed) {
  let cursor = seed;

  return () => {
    const nextValue = Math.sin(cursor++) * 10000;
    const fractional = nextValue - Math.floor(nextValue);
    return Number(fractional.toFixed(6));
  };
}

export function createSandbox(options = {}) {
  const seed = Number.isFinite(options.seed) ? options.seed : 1;
  const now = Number.isFinite(options.now) ? options.now : 0;

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
