export type Eip1193Request = {
  method: string;
  params?: unknown[];
};

export type LunaProviderOptions = {
  chainId?: string;
  accounts?: string[];
  balances?: Record<string, string>;
  callHandler?: (input: Record<string, unknown>) => Promise<string> | string;
};

type Receipt = {
  transactionHash: string;
  status: "0x1" | "0x0";
  blockNumber: string;
};

type ProviderListener = (...args: unknown[]) => void;

function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

export class LunaProvider {
  private chainId: string;
  private accounts: string[];
  private balances: Record<string, string>;
  private callHandler?: (input: Record<string, unknown>) => Promise<string> | string;
  private txCounter: bigint;
  private subCounter: number;
  private receipts: Map<string, Receipt>;
  private listeners: Map<string, Set<ProviderListener>>;

  constructor(options: LunaProviderOptions) {
    this.chainId = options.chainId ?? "0x1";
    this.accounts = options.accounts ?? [];
    this.balances = Object.fromEntries(
      Object.entries(options.balances ?? {}).map(([key, value]) => [
        normalizeAddress(key),
        value,
      ]),
    );
    this.callHandler = options.callHandler;
    this.txCounter = 1n;
    this.subCounter = 1;
    this.receipts = new Map();
    this.listeners = new Map();
  }

  on(event: string, listener: ProviderListener): this {
    const bucket = this.listeners.get(event) ?? new Set<ProviderListener>();
    bucket.add(listener);
    this.listeners.set(event, bucket);
    return this;
  }

  removeListener(event: string, listener: ProviderListener): this {
    const bucket = this.listeners.get(event);
    if (!bucket) {
      return this;
    }

    bucket.delete(listener);
    if (bucket.size === 0) {
      this.listeners.delete(event);
    }

    return this;
  }

  private emit(event: string, ...args: unknown[]): void {
    const bucket = this.listeners.get(event);
    if (!bucket) {
      return;
    }

    for (const listener of bucket) {
      listener(...args);
    }
  }

  async request(payload: Eip1193Request): Promise<unknown> {
    const method = payload.method;

    if (method === "eth_chainId") {
      return this.chainId;
    }

    if (method === "eth_accounts") {
      return this.accounts;
    }

    if (method === "eth_getBalance") {
      const [address] = payload.params ?? [];
      if (typeof address !== "string") {
        return "0x0";
      }

      return this.balances[normalizeAddress(address)] ?? "0x0";
    }

    if (method === "eth_call") {
      const [callInput] = payload.params ?? [];
      const normalized =
        callInput && typeof callInput === "object"
          ? (callInput as Record<string, unknown>)
          : {};

      if (!this.callHandler) {
        return "0x";
      }

      return this.callHandler(normalized);
    }

    if (method === "eth_sendTransaction") {
      const txHash = `0x${this.txCounter.toString(16).padStart(64, "0")}`;
      this.txCounter += 1n;

      this.receipts.set(txHash, {
        transactionHash: txHash,
        status: "0x1",
        blockNumber: "0x1",
      });

      this.emit("message", {
        type: "tx_submitted",
        data: { transactionHash: txHash },
      });

      return txHash;
    }

    if (method === "eth_getTransactionReceipt") {
      const [txHash] = payload.params ?? [];
      if (typeof txHash !== "string") {
        return null;
      }

      return this.receipts.get(txHash) ?? null;
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

      this.chainId = chainId;
      this.emit("chainChanged", chainId);
      return null;
    }

    if (method === "eth_subscribe") {
      const id = `0xsub${this.subCounter.toString(16).padStart(4, "0")}`;
      this.subCounter += 1;
      return id;
    }

    throw new Error(`Unsupported method: ${method}`);
  }
}
