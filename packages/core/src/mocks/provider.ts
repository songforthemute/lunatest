type ProviderRequest = {
  method: string;
  params?: unknown[];
};

type TxStatus = "0x0" | "0x1";

type MockEvent = {
  atMs: number;
  type: "tx_submitted" | "tx_confirmed" | "tx_failed";
  txHash: string;
  error?: string;
};

type MockProviderInput = {
  chain?: {
    id?: string;
    blockNumber?: number;
  };
  wallet: {
    address: string;
    connected?: boolean;
    chainId?: string;
    balances: Record<string, string>;
    allowances?: Record<string, string>;
  };
  events?: MockEvent[];
};

type MockProviderState = {
  timeMs: number;
  chain: {
    id: string;
    blockNumber: number;
  };
  wallet: {
    address: string;
    connected: boolean;
    chainId: string;
    balances: Record<string, string>;
    allowances: Record<string, string>;
  };
  queue: MockEvent[];
  receipts: Record<string, { status: TxStatus; transactionHash: string } | null>;
};

export type MockProvider = {
  request: (payload: ProviderRequest) => Promise<unknown>;
  given: MockProviderInput;
  getState: () => MockProviderState;
  advanceTime: (deltaMs: number) => void;
  connect: (address?: string) => void;
  disconnect: () => void;
  approve: (token: string, amount: string) => void;
  queueEvent: (event: MockEvent) => void;
};

function parseTokenAmountToWeiHex(value: string): string {
  const [integerPartRaw, fractionalPartRaw = ""] = value.split(".");

  const integerPart = integerPartRaw === "" ? "0" : integerPartRaw;
  const fractionalPart = fractionalPartRaw.padEnd(18, "0").slice(0, 18);

  const integerWei = BigInt(integerPart) * 10n ** 18n;
  const fractionalWei = BigInt(fractionalPart || "0");

  return `0x${(integerWei + fractionalWei).toString(16)}`;
}

function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

function cloneState(state: MockProviderState): MockProviderState {
  return {
    timeMs: state.timeMs,
    chain: { ...state.chain },
    wallet: {
      ...state.wallet,
      balances: { ...state.wallet.balances },
      allowances: { ...state.wallet.allowances },
    },
    queue: state.queue.map((event) => ({ ...event })),
    receipts: Object.fromEntries(
      Object.entries(state.receipts).map(([key, value]) => [
        key,
        value ? { ...value } : null,
      ]),
    ),
  };
}

function sortQueue(queue: MockEvent[]): void {
  queue.sort((left, right) => {
    if (left.atMs === right.atMs) {
      return left.type.localeCompare(right.type);
    }
    return left.atMs - right.atMs;
  });
}

export async function createMockProvider(given: MockProviderInput): Promise<MockProvider> {
  const state: MockProviderState = {
    timeMs: 0,
    chain: {
      id: given.chain?.id ?? given.wallet.chainId ?? "0x1",
      blockNumber: given.chain?.blockNumber ?? 0,
    },
    wallet: {
      address: given.wallet.address,
      connected: given.wallet.connected ?? true,
      chainId: given.wallet.chainId ?? given.chain?.id ?? "0x1",
      balances: { ...given.wallet.balances },
      allowances: { ...(given.wallet.allowances ?? {}) },
    },
    queue: [...(given.events ?? [])],
    receipts: {},
  };

  sortQueue(state.queue);

  let txCounter = 1n;

  const applyEvent = (event: MockEvent): void => {
    if (event.type === "tx_submitted") {
      state.receipts[event.txHash] = null;
      return;
    }

    if (event.type === "tx_confirmed") {
      state.receipts[event.txHash] = {
        transactionHash: event.txHash,
        status: "0x1",
      };
      return;
    }

    state.receipts[event.txHash] = {
      transactionHash: event.txHash,
      status: "0x0",
    };
  };

  const consumeDueEvents = (): void => {
    const remaining: MockEvent[] = [];
    for (const event of state.queue) {
      if (event.atMs <= state.timeMs) {
        applyEvent(event);
      } else {
        remaining.push(event);
      }
    }
    state.queue = remaining;
  };

  const queueEvent = (event: MockEvent): void => {
    state.queue.push({ ...event });
    sortQueue(state.queue);
  };

  return {
    given,

    getState(): MockProviderState {
      return cloneState(state);
    },

    advanceTime(deltaMs: number): void {
      state.timeMs += Math.max(0, Math.trunc(deltaMs));
      consumeDueEvents();
    },

    connect(address?: string): void {
      state.wallet.connected = true;
      if (address) {
        state.wallet.address = address;
      }
    },

    disconnect(): void {
      state.wallet.connected = false;
    },

    approve(token: string, amount: string): void {
      state.wallet.allowances[token] = amount;
    },

    queueEvent,

    async request(payload: ProviderRequest): Promise<unknown> {
      const method = payload.method;

      if (method === "eth_chainId") {
        return state.chain.id;
      }

      if (method === "eth_accounts") {
        return state.wallet.connected ? [state.wallet.address] : [];
      }

      if (method === "eth_getBalance") {
        const [requestedAddress] = payload.params ?? [];
        const addressMatches =
          typeof requestedAddress === "string" &&
          normalizeAddress(requestedAddress) === normalizeAddress(state.wallet.address);

        if (!addressMatches) {
          return "0x0";
        }

        const amount = state.wallet.balances.ETH ?? "0";
        return parseTokenAmountToWeiHex(amount);
      }

      if (method === "eth_sendTransaction") {
        const txHash = `0x${txCounter.toString(16).padStart(64, "0")}`;
        txCounter += 1n;

        queueEvent({
          atMs: state.timeMs,
          type: "tx_submitted",
          txHash,
        });
        queueEvent({
          atMs: state.timeMs + 3000,
          type: "tx_confirmed",
          txHash,
        });
        consumeDueEvents();

        return txHash;
      }

      if (method === "eth_getTransactionReceipt") {
        const [txHash] = payload.params ?? [];
        if (typeof txHash !== "string") {
          return null;
        }

        return state.receipts[txHash] ?? null;
      }

      if (method === "wallet_switchEthereumChain") {
        const [target] = payload.params ?? [];
        const chainId =
          target && typeof target === "object"
            ? (target as { chainId?: unknown }).chainId
            : undefined;

        if (typeof chainId !== "string") {
          throw new Error("wallet_switchEthereumChain requires chainId");
        }

        state.chain.id = chainId;
        state.wallet.chainId = chainId;
        return null;
      }

      throw new Error(`Unsupported method: ${method}`);
    },
  };
}
