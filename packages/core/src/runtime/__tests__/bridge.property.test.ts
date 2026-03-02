import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { fromLuaValue, toLuaArgs } from "../bridge";

describe("bridge property", () => {
  it("keeps json-compatible values stable after round-trip", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        const roundTrip = fromLuaValue(toLuaArgs(value));
        expect(roundTrip).toEqual(value);
      }),
      { numRuns: 300 },
    );
  });
});
