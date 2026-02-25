type ProviderRequest = {
  method: string;
  params?: unknown[];
};

type MockProviderInput = {
  wallet: {
    address: string;
    balances: Record<string, string>;
  };
};

export type MockProvider = {
  request: (payload: ProviderRequest) => Promise<unknown>;
  given: MockProviderInput;
};

function parseTokenAmountToWeiHex(value: string): string {
  const [integerPartRaw, fractionalPartRaw = ""] = value.split(".");

  const integerPart = integerPartRaw === "" ? "0" : integerPartRaw;
  const fractionalPart = fractionalPartRaw.padEnd(18, "0").slice(0, 18);

  const integerWei = BigInt(integerPart) * 10n ** 18n;
  const fractionalWei = BigInt(fractionalPart || "0");

  return `0x${(integerWei + fractionalWei).toString(16)}`;
}

export async function createMockProvider(given: MockProviderInput): Promise<MockProvider> {
  return {
    given,
    async request(payload: ProviderRequest): Promise<unknown> {
      const method = payload.method;

      if (method === "eth_getBalance") {
        const [requestedAddress] = payload.params ?? [];
        const addressMatches =
          typeof requestedAddress === "string" &&
          requestedAddress.toLowerCase() === given.wallet.address.toLowerCase();

        if (!addressMatches) {
          return "0x0";
        }

        const amount = given.wallet.balances.ETH ?? "0";
        return parseTokenAmountToWeiHex(amount);
      }

      throw new Error(`Unsupported method: ${method}`);
    },
  };
}
