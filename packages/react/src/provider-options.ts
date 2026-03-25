import type { LunaProviderOptions } from "@lunatest/core";

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter((entry) => entry[1] !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
    .join(",")}}`;
}

export function createProviderOptionsKey(options: LunaProviderOptions | undefined): string {
  if (!options) {
    return "undefined";
  }

  const serializable = {
    chainId: options.chainId,
    accounts: options.accounts,
    balances: options.balances,
    wallet: options.wallet,
  };

  return stableStringify(serializable);
}
