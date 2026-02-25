import assert from "node:assert/strict";
import test from "node:test";

import { sdkName } from "../index.js";

test("core smoke exports sdk name", () => {
  assert.equal(sdkName, "@lunatest/core");
});
