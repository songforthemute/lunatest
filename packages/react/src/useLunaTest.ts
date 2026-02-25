import { useContext } from "react";

import { LunaTestContext } from "./LunaTestProvider";

export function useLunaTest() {
  const context = useContext(LunaTestContext);
  if (!context) {
    throw new Error("useLunaTest must be used within LunaTestProvider");
  }
  return context;
}
