import {
  ChainNotConfiguredError,
  ConnectorNotConnectedError,
  createConnector,
  type CreateConnectorFn,
} from "@wagmi/core";
import {
  getAddress,
  isAddress,
  numberToHex,
  SwitchChainError,
  type Address,
} from "viem";

import type { LunaWagmiProvider } from "./wagmi.js";

type ProviderListener = (...args: unknown[]) => void;
type ConnectorAccounts<withCapabilities extends boolean> =
  withCapabilities extends true
    ? readonly {
        address: Address;
        capabilities: Record<string, unknown>;
      }[]
    : readonly Address[];

function normalizeAccounts(input: unknown): readonly Address[] {
  if (!Array.isArray(input)) {
    throw new TypeError("LunaTest provider returned a non-array account list");
  }

  return input.map((account) => {
    if (typeof account !== "string" || !isAddress(account)) {
      throw new TypeError("LunaTest provider returned an invalid account address");
    }

    return getAddress(account);
  });
}

function normalizeChainId(input: unknown): number {
  if (typeof input !== "string" || !/^0x[0-9a-f]+$/i.test(input)) {
    throw new TypeError("LunaTest provider returned a non-hex chain id");
  }

  const chainId = Number.parseInt(input.slice(2), 16);
  if (!Number.isSafeInteger(chainId) || chainId < 0) {
    throw new TypeError("LunaTest provider returned an invalid chain id");
  }

  return chainId;
}

/**
 * Creates a wagmi connector backed by a deterministic LunaTest provider.
 */
export function createLunaWagmiConnector(
  provider: LunaWagmiProvider,
): CreateConnectorFn<LunaWagmiProvider> {
  const connector: CreateConnectorFn<LunaWagmiProvider> = (config) => {
    let accountsChanged: ProviderListener | undefined;
    let chainChanged: ProviderListener | undefined;
    let disconnected: ProviderListener | undefined;
    let message: ProviderListener | undefined;
    let actionDisconnecting = false;

    function getConfiguredChain(chainId: number) {
      const chain = config.chains.find((candidate) => candidate.id === chainId);
      if (!chain) {
        throw new SwitchChainError(new ChainNotConfiguredError());
      }
      return chain;
    }

    async function switchToConfiguredChain(chainId: number) {
      const chain = getConfiguredChain(chainId);
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: numberToHex(chainId) }],
      });
      return chain;
    }

    function detachListeners(): void {
      if (accountsChanged) {
        provider.removeListener("accountsChanged", accountsChanged);
        accountsChanged = undefined;
      }
      if (chainChanged) {
        provider.removeListener("chainChanged", chainChanged);
        chainChanged = undefined;
      }
      if (disconnected) {
        provider.removeListener("disconnect", disconnected);
        disconnected = undefined;
      }
      if (message) {
        provider.removeListener("message", message);
        message = undefined;
      }
    }

    function emitError(cause: unknown): void {
      config.emitter.emit("error", {
        error: cause instanceof Error ? cause : new Error(String(cause)),
      });
    }

    function handleAccountsChanged(input: unknown): void {
      try {
        const accounts = normalizeAccounts(input);
        if (accounts.length === 0) {
          if (actionDisconnecting) {
            return;
          }
          detachListeners();
          config.emitter.emit("disconnect");
          return;
        }
        config.emitter.emit("change", { accounts });
      } catch (cause) {
        emitError(cause);
      }
    }

    function handleChainChanged(input: unknown): void {
      try {
        config.emitter.emit("change", { chainId: normalizeChainId(input) });
      } catch (cause) {
        emitError(cause);
      }
    }

    function attachListeners(): void {
      if (!accountsChanged) {
        accountsChanged = (input) => handleAccountsChanged(input);
        provider.on("accountsChanged", accountsChanged);
      }
      if (!chainChanged) {
        chainChanged = (input) => handleChainChanged(input);
        provider.on("chainChanged", chainChanged);
      }
      if (!disconnected) {
        disconnected = () => {
          if (actionDisconnecting) {
            return;
          }
          detachListeners();
          config.emitter.emit("disconnect");
        };
        provider.on("disconnect", disconnected);
      }
      if (!message) {
        message = (input) => {
          if (input && typeof input === "object" && "type" in input) {
            const type = input.type;
            if (typeof type === "string") {
              config.emitter.emit("message", {
                type,
                data: "data" in input ? input.data : undefined,
              });
            }
          }
        };
        provider.on("message", message);
      }
    }

    return {
      id: "lunatest",
      name: "LunaTest",
      type: "lunatest",
      async connect<withCapabilities extends boolean = false>({
        chainId,
        isReconnecting,
        withCapabilities,
      }: {
        chainId?: number;
        isReconnecting?: boolean;
        withCapabilities?: withCapabilities | boolean;
      } = {}): Promise<{
        accounts: ConnectorAccounts<withCapabilities>;
        chainId: number;
      }> {
        if (chainId !== undefined) {
          getConfiguredChain(chainId);
        }
        const accounts = isReconnecting
          ? await this.getAccounts()
          : normalizeAccounts(
              await provider.request({ method: "eth_requestAccounts" }),
            );
        if (accounts.length === 0) {
          throw new ConnectorNotConnectedError();
        }

        let currentChainId = await this.getChainId();
        if (chainId !== undefined && chainId !== currentChainId) {
          const chain = await switchToConfiguredChain(chainId);
          currentChainId = chain.id;
        }
        attachListeners();

        return {
          accounts: (withCapabilities
            ? accounts.map((address) => ({ address, capabilities: {} }))
            : accounts) as ConnectorAccounts<withCapabilities>,
          chainId: currentChainId,
        };
      },
      async disconnect() {
        actionDisconnecting = true;
        try {
          await provider.request({
            method: "wallet_revokePermissions",
            params: [{ eth_accounts: {} }],
          });
          detachListeners();
        } finally {
          actionDisconnecting = false;
        }
      },
      async getAccounts() {
        return normalizeAccounts(
          await provider.request({ method: "eth_accounts" }),
        );
      },
      async getChainId() {
        return normalizeChainId(
          await provider.request({ method: "eth_chainId" }),
        );
      },
      async getProvider() {
        return provider;
      },
      async isAuthorized() {
        return (await this.getAccounts()).length > 0;
      },
      async switchChain({ chainId }) {
        return switchToConfiguredChain(chainId);
      },
      onAccountsChanged(accounts) {
        handleAccountsChanged(accounts);
      },
      onChainChanged(chainId) {
        handleChainChanged(chainId);
      },
      onDisconnect() {
        if (actionDisconnecting) {
          return;
        }
        detachListeners();
        config.emitter.emit("disconnect");
      },
      onMessage(message) {
        config.emitter.emit("message", message);
      },
    };
  };

  return createConnector(connector);
}
