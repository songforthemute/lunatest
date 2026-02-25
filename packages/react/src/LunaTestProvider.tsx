import React, { createContext, useMemo, useState } from "react";

import { LunaProvider, type LunaProviderOptions } from "@lunatest/core";

import { createLunaProvider } from "./luna-provider";

export type LunaTestContextValue = {
  provider: LunaProvider;
  scenarioId?: string;
  setScenarioId: (value?: string) => void;
};

export const LunaTestContext = createContext<LunaTestContextValue | null>(null);

export type LunaTestProviderProps = {
  provider?: LunaProvider;
  options?: LunaProviderOptions;
  initialScenarioId?: string;
  children?: React.ReactNode;
};

export function LunaTestProvider(props: LunaTestProviderProps) {
  const [scenarioId, setScenarioId] = useState<string | undefined>(
    props.initialScenarioId,
  );

  const provider = useMemo(() => {
    if (props.provider) {
      return props.provider;
    }
    return createLunaProvider(props.options ?? {});
  }, [props.provider, props.options]);

  const value = useMemo<LunaTestContextValue>(
    () => ({
      provider,
      scenarioId,
      setScenarioId,
    }),
    [provider, scenarioId],
  );

  return React.createElement(LunaTestContext.Provider, { value }, props.children);
}
