import {
  createLunaWalletSession,
  extractPermissionKeys,
  normalizeAddress,
  normalizeWalletPermissions,
  type LunaWalletPermission,
  type LunaWalletSession,
} from "@lunatest/contracts";

export type Eip1193Request = {
  method: string;
  params?: unknown[];
};

export type LunaProviderOptions = {
  chainId?: string;
  accounts?: string[];
  balances?: Record<string, string>;
  wallet?: Partial<LunaWalletSession>;
  callHandler?: (input: Record<string, unknown>) => Promise<string> | string;
};

type Receipt = {
  transactionHash: string;
  status: "0x1" | "0x0";
  blockNumber: string;
};

type ProviderListener = (...args: unknown[]) => void;

export class LunaProvider {
  private chainId: string;
  private accounts: string[];
  private balances: Record<string, string>;
  private wallet: LunaWalletSession;
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
    this.wallet = createLunaWalletSession({
      chainId: options.wallet?.chainId ?? this.chainId,
      accounts: options.wallet?.accounts ?? this.accounts,
      connected:
        options.wallet?.connected ??
        (options.wallet ? false : this.accounts.length > 0),
      enabled: options.wallet?.enabled ?? true,
      permissions: options.wallet?.permissions,
    });
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
      return this.wallet.enabled ? this.wallet.chainId : this.chainId;
    }

    if (method === "eth_accounts") {
      if (!this.wallet.enabled) {
        return this.accounts;
      }

      const hasAccountsPermission = this.wallet.permissions.some(
        (permission) => permission.parentCapability === "eth_accounts",
      );

      if (!this.wallet.connected || !hasAccountsPermission) {
        return [];
      }

      return [...this.wallet.accounts];
    }

    if (method === "eth_requestAccounts") {
      const previousAccounts =
        this.wallet.connected
          ? [...this.wallet.accounts]
          : [];
      this.wallet.connected = true;
      this.wallet.permissions = normalizeWalletPermissions([
        ...this.wallet.permissions,
        "eth_accounts",
      ]);
      this.accounts = [...this.wallet.accounts];
      this.emit("accountsChanged", [...this.wallet.accounts]);

      if (previousAccounts.length === 0 && this.wallet.accounts.length > 0) {
        this.emit("connect", {
          chainId: this.wallet.chainId,
        });
      }

      return [...this.wallet.accounts];
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
      this.wallet.chainId = chainId;
      this.emit("chainChanged", chainId);
      return null;
    }

    if (method === "wallet_requestPermissions") {
      const keys = extractPermissionKeys(payload.params);
      this.wallet.permissions = normalizeWalletPermissions([
        ...this.wallet.permissions,
        ...keys,
      ]);

      if (keys.includes("eth_accounts")) {
        this.wallet.connected = true;
        this.accounts = [...this.wallet.accounts];
        this.emit("accountsChanged", [...this.wallet.accounts]);
      }

      return [...this.wallet.permissions];
    }

    if (method === "wallet_getPermissions") {
      return [...this.wallet.permissions];
    }

    if (method === "wallet_revokePermissions") {
      const keys = new Set(extractPermissionKeys(payload.params));
      const revoked = this.wallet.permissions.filter((permission) =>
        keys.has(permission.parentCapability),
      );
      this.wallet.permissions = this.wallet.permissions.filter(
        (permission) => !keys.has(permission.parentCapability),
      );

      if (keys.has("eth_accounts")) {
        this.wallet.connected = false;
        this.emit("accountsChanged", []);
      }

      return revoked.map((permission: LunaWalletPermission) => ({
        parentCapability: permission.parentCapability,
      }));
    }

    if (method === "eth_subscribe") {
      const id = `0xsub${this.subCounter.toString(16).padStart(4, "0")}`;
      this.subCounter += 1;
      return id;
    }

    throw new Error(`Unsupported method: ${method}`);
  }
}
