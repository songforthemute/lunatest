import { useMemo } from "react";

import { type LunaProviderOptions } from "@lunatest/core";

import { createLunaProvider } from "../luna-provider.js";

export function useLunaProvider(options: LunaProviderOptions) {
  return useMemo(() => createLunaProvider(options), [options]);
}
