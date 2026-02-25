import { describe, expect, it } from "vitest";

import { createRuntime } from "../engine";

describe("runtime engine", () => {
  it("calls function and returns value", async () => {
    const runtime = await createRuntime();

    await runtime.eval("function add(a,b) return a+b end");

    await expect(runtime.call("add", { a: 2, b: 3 })).resolves.toBe(5);
  });
});
