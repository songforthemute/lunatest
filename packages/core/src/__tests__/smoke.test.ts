import { describe, expect, it } from "vitest";

import { sdkName } from "../index";

describe("core smoke", () => {
  it("exports sdk name", () => {
    expect(sdkName).toBe("@lunatest/core");
  });
});
