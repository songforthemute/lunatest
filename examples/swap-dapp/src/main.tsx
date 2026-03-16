import React from "react";
import ReactDOM from "react-dom/client";
import { bootstrapLunaRuntime } from "@lunatest/react";

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
  protocolPresetId: "uniswap_v3",
  walletFallbackMode: "manual-toggle",
  walletPresetId: "demo_sepolia",
  walletPresetParams: {
    address: "0x1111111111111111111111111111111111111111",
    chainId: 11155111,
  },
}).catch((error) => {
  console.error("[lunatest] bootstrap failed", error);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
