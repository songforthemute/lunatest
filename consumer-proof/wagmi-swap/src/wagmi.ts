import { createConfig } from "@wagmi/core";
import { http } from "viem";
import { sepolia } from "viem/chains";

export const wagmiConfig = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
});
