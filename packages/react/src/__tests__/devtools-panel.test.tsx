import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LunaDevtoolsPanel } from "../devtools/LunaDevtoolsPanel";
import { mountLunaDevtools } from "../devtools/mount";

describe("LunaDevtoolsPanel", () => {
  it("renders panel title and controls", () => {
    const html = renderToString(
      React.createElement(LunaDevtoolsPanel, {
        title: "Runtime QA",
      }),
    );

    expect(html).toContain("Runtime QA");
    expect(html).toContain("Run Scenario");
    expect(html).toContain("Apply Routes");
    expect(html).toContain("Patch State");
  });

  it("skips mount outside development DOM context", () => {
    expect(mountLunaDevtools({ nodeEnv: "production" })).toBeNull();
  });
});
