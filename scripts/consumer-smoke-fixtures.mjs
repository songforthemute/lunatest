export const reactPeerMatrix = [
  { label: "react18", dependencies: ["react@18.3.1", "react-dom@18.3.1"] },
  { label: "react19", dependencies: ["react@19.2.6", "react-dom@19.2.6"] },
];

export function createConsumerSmokeScript({ includeNextPackages = false } = {}) {
  const nextImports = includeNextPackages
    ? `
import { toLunaPass, createLunaVitestPlugin } from "@lunatest/vitest-plugin";
import { createLunaFixture } from "@lunatest/playwright-plugin";
`
    : "";

  const nextChecks = includeNextPackages
    ? `
if (typeof toLunaPass !== "function") throw new Error("toLunaPass export missing");
if (typeof createLunaVitestPlugin !== "function") throw new Error("createLunaVitestPlugin export missing");
if (typeof createLunaFixture !== "function") throw new Error("createLunaFixture export missing");
`
    : "";

  return `
import React from "react";
import { renderToString } from "react-dom/server";
import { loadLunaConfig as loadLunaConfigNode, executeLuaScenario } from "@lunatest/core";
import { loadLunaConfig as loadLunaConfigBrowser } from "@lunatest/core/browser";
import { bootstrapLunaRuntime, LunaTestProvider } from "@lunatest/react";
import { bootstrapLunaRuntime as bootstrapLunaRuntimeBrowser } from "@lunatest/react/browser";
import { setRouteMocks } from "@lunatest/runtime-intercept";
import { createMcpServer } from "@lunatest/mcp";
${nextImports}

if (typeof React.createElement !== "function") throw new Error("react createElement export missing");
if (typeof renderToString !== "function") throw new Error("react-dom/server renderToString export missing");
if (typeof loadLunaConfigNode !== "function") throw new Error("loadLunaConfig export missing");
if (typeof loadLunaConfigBrowser !== "function") throw new Error("browser loadLunaConfig export missing");
if (typeof executeLuaScenario !== "function") throw new Error("executeLuaScenario export missing");
if (typeof bootstrapLunaRuntime !== "function") throw new Error("bootstrapLunaRuntime export missing");
if (typeof bootstrapLunaRuntimeBrowser !== "function") throw new Error("browser bootstrapLunaRuntime export missing");
if (typeof LunaTestProvider !== "function") throw new Error("LunaTestProvider export missing");
if (typeof setRouteMocks !== "function") throw new Error("setRouteMocks export missing");
if (typeof createMcpServer !== "function") throw new Error("createMcpServer export missing");
renderToString(React.createElement(LunaTestProvider, { options: {} }, React.createElement("div", null, "ok")));
${nextChecks}
`;
}
