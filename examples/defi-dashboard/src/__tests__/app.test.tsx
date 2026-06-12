import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DefiDashboard } from "../app";
import type { DefiDashboardSnapshot } from "../dogfood";

const snapshot: DefiDashboardSnapshot = {
  generatedAt: "2026-06-08T00:00:00.000Z",
  wallet: {
    account: "0x1111111111111111111111111111111111111111",
    chainId: "0x1",
    nativeBalance: "1.00",
  },
  protocols: [
    {
      id: "aave",
      label: "Aave",
      supportLevel: "L3",
      primaryMetric: "Health factor",
      quoteOut: "900",
      healthFactor: "2.00",
      receiptStatus: "0x1",
      note: "Supply and borrow surfaces are deterministic.",
    },
  ],
};

describe("DefiDashboard", () => {
  it("renders protocol dogfood evidence and wallet context", () => {
    const html = renderToString(<DefiDashboard initialSnapshot={snapshot} />);

    expect(html).toContain("Protocol Risk Terminal");
    expect(html).toContain("0x1111…1111");
    expect(html).toContain("Aave");
    expect(html).toContain("Health factor");
    expect(html).toContain("L3");
  });
});
