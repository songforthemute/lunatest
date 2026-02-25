import assert from "node:assert/strict";
import test from "node:test";

import { createRuntime } from "../engine.js";

test("runtime engine calls function and returns value", async () => {
  const runtime = await createRuntime();
  await runtime.eval("function add(a,b) return a+b end");
  const result = await runtime.call("add", { a: 2, b: 3 });
  assert.equal(result, 5);
});
