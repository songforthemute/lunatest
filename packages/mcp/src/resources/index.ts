import type { ScenarioDescriptor } from "../tools/scenario.js";

import { componentsResource } from "./components.js";
import { coverageResource } from "./coverage.js";
import { guideResource } from "./guide.js";
import { mocksResource } from "./mocks.js";
import { protocolsResource } from "./protocols.js";
import { scenariosResource } from "./scenarios.js";

export type McpResource = {
  uri: string;
  content: unknown;
};

export function createResourceCatalog(options: {
  scenarios: ScenarioDescriptor[];
  coverage: Record<string, unknown>;
  components: unknown;
  protocols: string[];
}): McpResource[] {
  return [
    scenariosResource(options.scenarios),
    coverageResource(options.coverage),
    componentsResource(options.components),
    mocksResource(),
    protocolsResource(options.protocols),
    guideResource(),
  ];
}
