import React from "react";
import ReactDOM from "react-dom/client";
import { bootstrapLunaRuntime } from "@lunatest/react/browser";
import teamSwapPresetSource from "../lunatest/presets/protocol/team_swap.lua?raw";
import teamWalletPresetSource from "../lunatest/presets/wallet/team_wallet.lua?raw";

import { App } from "./app";
import "./styles.css";

const nodeEnv =
  typeof import.meta !== "undefined"
    ? import.meta.env?.MODE
    : typeof process !== "undefined"
      ? process.env.NODE_ENV
      : undefined;

void bootstrapLunaRuntime({
  source: "./lunatest.lua",
  nodeEnv,
  mountDevtools: true,
  projectPresetSources: {
    protocol: {
      team_swap: teamSwapPresetSource,
    },
    wallet: {
      team_wallet: teamWalletPresetSource,
    },
  },
  protocolPresetId: "project/team_swap",
  walletFallbackMode: "manual-toggle",
  walletPresetId: "project/team_wallet",
  walletPresetParams: {
    address: "0x1111111111111111111111111111111111111111",
    chainId: 11155111,
  },
}).catch((error: unknown) => {
  console.error("[lunatest] bootstrap failed", error);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
