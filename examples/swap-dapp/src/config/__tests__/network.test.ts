import { describe, expect, it } from "vitest";

import { isPlaceholderRpcUrl } from "../../lib/wallet";
import {
  DETERMINISTIC_SWAP_CONFIG,
  isDeterministicDemoMode,
  loadSwapEnvConfig,
} from "../network";

describe("loadSwapEnvConfig", () => {
  it("returns a deterministic config without Sepolia env when demo mode is enabled", () => {
    const result = loadSwapEnvConfig({
      VITE_LUNATEST_DEMO_MODE: "deterministic",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.value.mode).toBe("deterministic");
    expect(result.value).toEqual(DETERMINISTIC_SWAP_CONFIG);
    expect(isPlaceholderRpcUrl(result.value.sepoliaRpcUrl)).toBe(true);
  });

  it("still reports missing env in real mode", () => {
    const result = loadSwapEnvConfig({});

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected missing env to fail");
    }

    expect(result.missing).toContain("VITE_SEPOLIA_RPC_URL");
  });
});

describe("isDeterministicDemoMode", () => {
  it("only accepts the explicit deterministic marker", () => {
    expect(isDeterministicDemoMode({ VITE_LUNATEST_DEMO_MODE: "deterministic" })).toBe(true);
    expect(isDeterministicDemoMode({ VITE_LUNATEST_DEMO_MODE: "real" })).toBe(false);
    expect(isDeterministicDemoMode({})).toBe(false);
  });
});
