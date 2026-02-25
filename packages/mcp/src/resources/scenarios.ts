import type { ScenarioDescriptor } from "../tools/scenario";

export function scenariosResource(scenarios: ScenarioDescriptor[]) {
  return {
    uri: "lunatest://scenarios",
    content: scenarios,
  };
}
