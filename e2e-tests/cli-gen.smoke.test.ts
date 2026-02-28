import { describe, expect, it } from "vitest";

import { genCommand } from "../packages/cli/src/commands/gen";

describe("e2e smoke: cli gen", () => {
  it("runs ai generation command output contract", () => {
    const output = genCommand({ ai: true });
    expect(output).toContain("AI generation complete");
    expect(output).toContain("created=");
    expect(output).toContain("executed=");
  });
});
