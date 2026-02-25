import assert from "node:assert/strict";
import test from "node:test";

import { createRuntime } from "../engine.js";

test("sandbox uses deterministic random sequence", async () => {
  const runtime = await createRuntime({ seed: 7, now: 1700000000 });
  await runtime.eval("a=math.random(); b=math.random()");
  const state = await runtime.getState(["a", "b"]);
  assert.deepEqual(state, { a: 0.865987, b: 0.582466 });
});

test("sandbox freezes time and blocks io", async () => {
  const runtime = await createRuntime({ seed: 1, now: 1700000000 });
  await runtime.eval("t=os.time()");
  const state = await runtime.getState(["t"]);
  assert.equal(state.t, 1700000000);

  await assert.rejects(
    () => runtime.eval("x=io.open('tmp.txt')"),
    /io\.open is blocked/,
  );
});
