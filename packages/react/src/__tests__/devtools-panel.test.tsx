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
        walletFallbackMode: "manual-toggle",
        initialPresetDiagnostics: [
          {
            code: "preset_manifest_invalid",
            message: "missing protocol",
            severity: "error",
            phase: "manifest",
            source: "project",
            qualifiedId: "project/bad_swap",
            hint: "check manifest.protocol",
          },
        ],
      }),
    );

    expect(html).toContain("Runtime QA");
    expect(html).toContain("Diagnostics (");
    expect(html).toContain("project/bad_swap");
    expect(html).toContain("Run Scenario");
    expect(html).toContain("Protocol Preset");
    expect(html).toContain("Wallet Preset");
    expect(html).toContain("Apply Routes");
    expect(html).toContain("Patch State");
    expect(html).toContain("Luna Wallet");
  });

  it("skips mount outside development DOM context", () => {
    expect(mountLunaDevtools({ nodeEnv: "production" })).toBeNull();
  });
});
