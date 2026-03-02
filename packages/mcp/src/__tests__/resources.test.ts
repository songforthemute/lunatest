import { describe, expect, it } from "vitest";

import { createPromptCatalog } from "../prompts";
import { createResourceCatalog } from "../resources";

describe("mcp resources and prompts", () => {
  it("builds full resource catalog", () => {
    const resources = createResourceCatalog({
      scenarios: [{ id: "swap-1", name: "swap happy path" }],
      coverage: { total: 1, covered: 1, ratio: 1 },
      components: [{ name: "SwapForm" }],
      protocols: ["uniswap_v2", "curve"],
    });

    expect(resources.map((resource) => resource.uri)).toEqual([
      "lunatest://scenarios",
      "lunatest://coverage",
      "lunatest://components",
      "lunatest://mocks",
      "lunatest://protocols",
      "lunatest://guide",
    ]);
  });

  it("builds prompt catalog", () => {
    const prompts = createPromptCatalog();
    const ids = prompts.map((prompt) => prompt.id);

    expect(ids).toEqual([
      "generate-edge-cases",
      "analyze-failure",
      "improve-coverage",
      "regression-from-diff",
    ]);

    expect(prompts[0]?.render("SwapForm")).toContain("SwapForm");
  });
});
