import type { ScenarioDescriptor } from "../tools/scenario";

import { componentsResource } from "./components";
import { coverageResource } from "./coverage";
import { guideResource } from "./guide";
import { mocksResource } from "./mocks";
import { protocolsResource } from "./protocols";
import { scenariosResource } from "./scenarios";

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
