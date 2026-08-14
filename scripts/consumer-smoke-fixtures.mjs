export const reactPeerMatrix = [
  {
    label: "react18",
    dependencies: [
      "react@18.3.1",
      "react-dom@18.3.1",
      "viem@2.55.11",
    ],
  },
  {
    label: "react19",
    dependencies: [
      "react@19.2.6",
      "react-dom@19.2.6",
      "@wagmi/core@3.6.4",
      "viem@2.55.11",
    ],
  },
];

export function createConsumerSmokeScript({
  includeRunnerPackages = false,
  includeWagmiConnector = false,
} = {}) {
  const runnerImports = includeRunnerPackages
    ? `
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { toLunaPass, createLunaVitestPlugin } from "@lunatest/vitest-plugin";
import { createLunaCommands, createLunaFixture, createLunaPageAdapter } from "@lunatest/playwright-plugin";
`
    : "";

  const connectorImports = includeWagmiConnector
    ? `
import { connect, createConfig, disconnect, getConnection } from "@wagmi/core";
import { createLunaWagmiConnector } from "@lunatest/react/wagmi/connector";
`
    : "";

  const connectorChecks = includeWagmiConnector
    ? `
const connectorProvider = new LunaProvider({
  chainId: "0x1",
  wallet: { accounts: [wagmiAccount], connected: false },
});
const connectorTransport = createLunaWagmiTransport(connectorProvider);
const connectorConfig = createConfig({
  chains: [mainnet],
  connectors: [createLunaWagmiConnector(connectorProvider)],
  multiInjectedProviderDiscovery: false,
  storage: null,
  transports: { [mainnet.id]: connectorTransport },
});
const connector = connectorConfig.connectors[0];
await connect(connectorConfig, { connector });
if (!getConnection(connectorConfig).isConnected) {
  throw new Error("packed wagmi connector did not establish connection state");
}
await disconnect(connectorConfig);
if (!getConnection(connectorConfig).isDisconnected) {
  throw new Error("packed wagmi connector did not clear connection state");
}
`
    : "";

  const runnerChecks = includeRunnerPackages
    ? `
if (typeof toLunaPass !== "function") throw new Error("toLunaPass export missing");
if (typeof createLunaVitestPlugin !== "function") throw new Error("createLunaVitestPlugin export missing");
if (typeof createLunaFixture !== "function") throw new Error("createLunaFixture export missing");
if (typeof createLunaCommands !== "function") throw new Error("createLunaCommands export missing");
if (typeof createLunaPageAdapter !== "function") throw new Error("createLunaPageAdapter export missing");

const runnerRoot = await mkdtemp(join(tmpdir(), "lunatest-packed-runner-"));
try {
  await mkdir(join(runnerRoot, "scenarios"), { recursive: true });
  await writeFile(
    join(runnerRoot, "lunatest.config.json"),
    JSON.stringify({ scenarioDir: "scenarios", luaConfigPath: "missing-root.lua" }),
    "utf8",
  );
  await writeFile(
    join(runnerRoot, "scenarios", "quote-ready.lua"),
    [
      "scenario {",
      '  name = "quote-ready",',
      '  given = { quote = { status = "idle" } },',
      '  when = { action = "loadQuote" },',
      '  then_ui = { quote = { status = "ready" } }',
      "}",
    ].join("\\n"),
    "utf8",
  );

  const vitestRunner = createLunaVitestPlugin({ cwd: runnerRoot });
  const catalog = await vitestRunner.listScenarios();
  if (catalog.length !== 1 || catalog[0].id !== "scenarios/quote-ready") {
    throw new Error("packed Vitest runner did not load the scenario catalog");
  }
  const vitestExecution = await vitestRunner.assertScenario("scenarios/quote-ready", {
    resolveUi: () => ({ quote: { status: "ready" } }),
  });
  if (!vitestExecution.execution.pass) {
    throw new Error("packed Vitest runner did not execute the scenario");
  }

  const page = { actions: [], quoteStatus: "idle" };
  const pageExecution = await createLunaCommands({ cwd: runnerRoot }).assertScenario(
    "scenarios/quote-ready",
    createLunaPageAdapter({
      page,
      runWhen: ({ page: target }) => {
        target.actions.push("loadQuote");
        target.quoteStatus = "ready";
      },
      resolveUi: ({ page: target }) => ({ quote: { status: target.quoteStatus } }),
    }),
  );
  if (!pageExecution.execution.pass || page.actions.join(",") !== "loadQuote") {
    throw new Error("packed page adapter did not execute the scenario action");
  }
} finally {
  await rm(runnerRoot, { recursive: true, force: true });
}
`
    : "";

  return `
import React from "react";
import { renderToString } from "react-dom/server";
import { LunaProvider, loadLunaConfig as loadLunaConfigNode, executeLuaScenario } from "@lunatest/core";
import { loadLunaConfig as loadLunaConfigBrowser } from "@lunatest/core/browser";
import { bootstrapLunaRuntime, LunaTestProvider } from "@lunatest/react";
import { bootstrapLunaRuntime as bootstrapLunaRuntimeBrowser } from "@lunatest/react/browser";
import { createLunaWagmiTransport } from "@lunatest/react/wagmi";
import { setRouteMocks } from "@lunatest/runtime-intercept";
import { createMcpServer } from "@lunatest/mcp";
import { createPublicClient } from "viem";
import { mainnet } from "viem/chains";
${connectorImports}
${runnerImports}

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

const wagmiAccount = "0x1111111111111111111111111111111111111111";
const wagmiProvider = new LunaProvider({
  chainId: "0x1",
  accounts: [wagmiAccount],
  balances: { [wagmiAccount]: "0xde0b6b3a7640000" },
});
const wagmiClient = createPublicClient({
  batch: { multicall: false },
  chain: mainnet,
  transport: createLunaWagmiTransport(wagmiProvider),
});
const wagmiBalance = await wagmiClient.getBalance({
  address: wagmiAccount,
});
if (wagmiBalance !== 1_000_000_000_000_000_000n) {
  throw new Error("packed wagmi transport did not reach LunaProvider");
}
${connectorChecks}
${runnerChecks}
`;
}
