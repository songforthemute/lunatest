import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LunaProvider } from "@lunatest/core";

import { useLunaProvider } from "../hooks/useLunaProvider";

describe("useLunaProvider", () => {
  it("creates LunaProvider with chainId", async () => {
    let captured: LunaProvider | undefined;

    function Probe() {
      captured = useLunaProvider({
        chainId: "0x1",
      });

      return React.createElement("div", null, "probe");
    }

    renderToString(React.createElement(Probe));

    expect(captured).toBeInstanceOf(LunaProvider);
    await expect(captured?.request({ method: "eth_chainId" })).resolves.toBe(
      "0x1",
    );
  });
});
