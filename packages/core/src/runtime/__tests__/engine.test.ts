import { describe, expect, it } from "vitest";

import { createRuntime } from "../engine";

describe("runtime engine", () => {
  it("calls function and returns value through Wasmoon", async () => {
    const runtime = await createRuntime();

    await runtime.eval("function add(input) return input.a + input.b end");

    await expect(runtime.call("add", { a: 2, b: 3 })).resolves.toBe(5);
    await expect(runtime.call("add", { b: 3, a: 2 })).resolves.toBe(5);
  });

  it("registers host functions and calls them from Lua", async () => {
    const runtime = await createRuntime();

    runtime.register("sum", (input: { x: number; y: number }) => input.x + input.y);
    await runtime.eval("function run_sum() return sum({ x = 4, y = 6 }) end");

    await expect(runtime.call("run_sum")).resolves.toBe(10);
  });

  it("resets engine state", async () => {
    const runtime = await createRuntime();

    await runtime.eval("function value() return 7 end");
    await expect(runtime.call("value")).resolves.toBe(7);

    await runtime.reset();

    await expect(runtime.call("value")).rejects.toThrow(/Function not found/);
  });
});
