import { describe, expect, it } from "vitest";

import { createRuntime } from "../engine";

describe("sandbox", () => {
  it("uses deterministic random sequence", async () => {
    const runtime = await createRuntime({ seed: 7, now: 1700000000 });
    await runtime.eval("a=math.random(); b=math.random()");

    await expect(runtime.getState(["a", "b"])).resolves.toEqual({
      a: 0.865987,
      b: 0.582466,
    });
  });

  it("freezes time and blocks io", async () => {
    const runtime = await createRuntime({ seed: 1, now: 1700000000 });

    await runtime.eval("t=os.time()");
    await expect(runtime.getState(["t"])).resolves.toEqual({ t: 1700000000 });
    await expect(runtime.eval("x=io.open('tmp.txt')")).rejects.toThrow(
      /io\.open is blocked/,
    );
  });

  it("rejects invalid runtime options with zod", async () => {
    await expect(() => createRuntime({ seed: Number.NaN })).rejects.toThrow();
  });
});
