import { MaxUint256 } from "ethers";
import { describe, expect, it } from "vitest";

import { encodeApproveCalldata } from "../erc20Approve";

describe("encodeApproveCalldata", () => {
  it("encodes ERC-20 approve calldata for the runtime protocol resolver", () => {
    const spender = "0x3bFA4769FB09eefC5a80d6E87Ff9426bB5c3f8f4";

    expect(encodeApproveCalldata(spender, MaxUint256)).toBe(
      "0x095ea7b3" +
        "0000000000000000000000003bfa4769fb09eefc5a80d6e87ff9426bb5c3f8f4" +
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    );
  });
});
