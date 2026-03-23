import { useMemo } from "react";

import { type LunaProviderOptions } from "@lunatest/core";

import { createLunaProvider } from "../luna-provider.js";
import { createProviderOptionsKey } from "../provider-options.js";

export function useLunaProvider(options: LunaProviderOptions) {
  const optionsKey = createProviderOptionsKey(options);
  return useMemo(() => createLunaProvider(options), [optionsKey, options.callHandler]);
}
