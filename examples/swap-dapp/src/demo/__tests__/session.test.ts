import { describe, expect, it } from "vitest";

import { DETERMINISTIC_SWAP_CONFIG } from "../../config/network";
import { createDeterministicWalletSession } from "../session";

describe("createDeterministicWalletSession", () => {
  it("creates an enabled Sepolia Luna wallet session with demo assets", () => {
    const session = createDeterministicWalletSession(DETERMINISTIC_SWAP_CONFIG);

    expect(session.enabled).toBe(true);
    expect(session.connected).toBe(true);
    expect(session.chainId).toBe("0xaa36a7");
    expect(session.accounts).toEqual(["0x1111111111111111111111111111111111111111"]);
    expect(session.permissions).toEqual([{ parentCapability: "eth_accounts" }]);

    const tokenIn = session.assets.tokens[DETERMINISTIC_SWAP_CONFIG.tokenIn.toLowerCase()];
    const tokenOut = session.assets.tokens[DETERMINISTIC_SWAP_CONFIG.tokenOut.toLowerCase()];

    expect(tokenIn).toMatchObject({
      symbol: "WETH",
      decimals: 18,
      allowance: "0",
    });
    expect(BigInt(tokenIn.balance)).toBe(25n * 10n ** 18n);
    expect(tokenOut).toMatchObject({
      symbol: "USDC",
      decimals: 6,
      balance: "0",
      allowance: "0",
    });
  });
});
