import { LunaProvider, type LunaProviderOptions } from "@lunatest/core";

export function createLunaProvider(options: LunaProviderOptions): LunaProvider {
  return new LunaProvider(options);
}
