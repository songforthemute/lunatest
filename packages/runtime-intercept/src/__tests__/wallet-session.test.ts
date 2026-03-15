import { afterEach, describe, expect, it } from "vitest";

import {
  connectWalletSession,
  disableLunaRuntimeIntercept,
  enableLunaRuntimeIntercept,
  getWalletSession,
  setWalletSession,
} from "../runtime";

afterEach(() => {
  disableLunaRuntimeIntercept();
});

describe("runtime wallet session", () => {
  it("stores and returns wallet session state", () => {
    enableLunaRuntimeIntercept({ enable: true }, "development");

    expect(
      setWalletSession({
        enabled: true,
        connected: false,
        chainId: "0xaa36a7",
        accounts: ["0x1111111111111111111111111111111111111111"],
        permissions: [],
      }),
    ).toMatchObject({
      enabled: true,
      connected: false,
      chainId: "0xaa36a7",
    });

    expect(getWalletSession()).toMatchObject({
      enabled: true,
      connected: false,
      chainId: "0xaa36a7",
    });
  });

  it("connects wallet session through exported helper", () => {
    enableLunaRuntimeIntercept({ enable: true }, "development");

    setWalletSession({
      enabled: true,
      connected: false,
      chainId: "0x1",
      accounts: ["0x1111111111111111111111111111111111111111"],
      permissions: [],
    });

    const next = connectWalletSession();

    expect(next.connected).toBe(true);
    expect(next.permissions).toEqual([{ parentCapability: "eth_accounts" }]);
  });
});
