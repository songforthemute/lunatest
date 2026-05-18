import React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LunaDevtoolsPanel } from "../devtools/LunaDevtoolsPanel";
import { mountLunaDevtools } from "../devtools/mount";

const mocks = vi.hoisted(() => ({
  createRootMock: vi.fn(() => ({
    render: vi.fn(),
    unmount: vi.fn(),
  })),
}));

vi.mock("react-dom/client", () => ({
  createRoot: mocks.createRootMock,
}));

afterEach(() => {
  mocks.createRootMock.mockClear();
  delete (globalThis as { document?: unknown }).document;
});

describe("LunaDevtoolsPanel", () => {
  it("renders panel title and controls", () => {
    const html = renderToString(
      React.createElement(LunaDevtoolsPanel, {
        title: "Runtime QA",
        walletFallbackMode: "manual-toggle",
        initialRoutes: [
          { endpointType: "ethereum", method: "eth_call", responseKey: "protocol.runtime" },
          { endpointType: "ethereum", method: "eth_sendTransaction", responseKey: "protocol.runtime" },
        ],
        initialState: {
          protocolRuntime: {
            activeProtocol: "uniswap_v3",
            chainId: 11155111,
            tokens: {
              "0x1111111111111111111111111111111111111111": { symbol: "MOCK", decimals: 18 },
            },
          },
        },
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
    expect(html).toContain("Protocol Runtime Preview");
    expect(html).toContain("active: ");
    expect(html).toContain("uniswap_v3");
    expect(html).toContain("methods: ");
    expect(html).toContain("Wallet Preset");
    expect(html).toContain("Apply Routes");
    expect(html).toContain("Patch State");
    expect(html).toContain("Luna Wallet");
  });

  it("skips mount outside development DOM context", () => {
    expect(mountLunaDevtools({ nodeEnv: "production" })).toBeNull();
  });

  it("keeps host-owned default container on cleanup", () => {
    const target = {
      id: "lunatest-devtools-root",
      remove: vi.fn(),
    };
    const body = {
      appendChild: vi.fn(),
    };

    (globalThis as { document?: unknown }).document = {
      getElementById: vi.fn(() => target),
      createElement: vi.fn(),
      body,
    };

    const unmount = mountLunaDevtools({
      nodeEnv: "development",
    });

    expect(typeof unmount).toBe("function");
    unmount?.();
    expect(target.remove).not.toHaveBeenCalled();
  });
});
