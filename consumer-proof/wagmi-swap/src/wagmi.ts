import { createConfig } from "@wagmi/core";
import { bootstrapLunaRuntime } from "@lunatest/react/browser";
import {
  createLunaWagmiTransport,
  type LunaWagmiProvider,
} from "@lunatest/react/wagmi";
import { createLunaWagmiConnector } from "@lunatest/react/wagmi/connector";
import { setWalletSession } from "@lunatest/runtime-intercept";
import { sepolia } from "viem/chains";

const runtimeConfig = `
lunatest {
  mode = "strict",
}
`;

function isLunaWagmiProvider(value: unknown): value is LunaWagmiProvider {
  if (!value || typeof value !== "object") {
    return false;
  }

  return ["request", "on", "removeListener"].every(
    (key) => typeof Reflect.get(value, key) === "function",
  );
}

function getRuntimeProvider(): LunaWagmiProvider {
  const provider = Reflect.get(window, "ethereum");
  if (!isLunaWagmiProvider(provider)) {
    throw new Error("LunaTest did not install an EIP-1193 provider");
  }
  return provider;
}

export async function createJourneyConfig() {
  const bootstrap = await bootstrapLunaRuntime({
    enable: true,
    mountDevtools: false,
    nodeEnv: "development",
    source: runtimeConfig,
    protocolPresetId: "builtin/uniswap_v3",
    protocolPresetParams: { quoter: "v1" },
    configOverride: {
      intercept: { mode: "strict" },
    },
  });
  if (!bootstrap.enabled) {
    throw new Error("LunaTest runtime intercept did not start");
  }

  setWalletSession({
    enabled: true,
    connected: false,
    permissions: [],
  });

  const provider = getRuntimeProvider();
  const transport = createLunaWagmiTransport(provider);
  return createConfig({
    batch: { multicall: false },
    chains: [sepolia],
    connectors: [createLunaWagmiConnector(provider)],
    multiInjectedProviderDiscovery: false,
    pollingInterval: 10,
    storage: null,
    transports: {
      [sepolia.id]: transport,
    },
  });
}

export type JourneyConfig = Awaited<ReturnType<typeof createJourneyConfig>>;
