import { describe, expect, it } from "vitest";

import { matchesPattern } from "../matcher";

describe("matcher", () => {
  it("resets RegExp lastIndex before matching", () => {
    const pattern = /foo/g;

    expect(matchesPattern("foo", pattern)).toBe(true);
    expect(matchesPattern("foo", pattern)).toBe(true);
  });
});
