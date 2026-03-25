import type { ScenarioDescriptor } from "../tools/scenario.js";

export function scenariosResource(scenarios: ScenarioDescriptor[]) {
  return {
    uri: "lunatest://scenarios",
    content: scenarios,
  };
}
