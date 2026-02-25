import { createPromptCatalog } from "./prompts";
import { createResourceCatalog } from "./resources";
import { createComponentTools } from "./tools/component";
import { createCoverageTools } from "./tools/coverage";
import { createMockTools } from "./tools/mock";
import {
  createScenarioTools,
  type ScenarioDescriptor,
} from "./tools/scenario";

type JsonRpcRequest = {
  id: string;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  id: string;
  result?: unknown;
  error?: {
    message: string;
  };
};

type McpServerOptions = {
  scenarios?: ScenarioDescriptor[];
  coverage?: {
    total?: number;
    covered?: number;
    ratio?: number;
  };
  mockState?: Record<string, unknown>;
  componentTree?: Array<{ name: string; children?: Array<{ name: string }> }>;
  componentStates?: Record<string, string[]>;
  protocols?: string[];
};

export function createMcpServer(options: McpServerOptions) {
  const scenarioTools = createScenarioTools(options.scenarios ?? []);
  const coverageTools = createCoverageTools(options.coverage);
  const mockTools = createMockTools(options.mockState);
  const componentTools = createComponentTools(
    options.componentTree ?? [],
    options.componentStates ?? {},
  );
  const prompts = createPromptCatalog();

  const getResources = async () => {
    const scenarios = await scenarioTools.list();
    const coverage = await coverageTools.report();
    const components = await componentTools.tree();
    return createResourceCatalog({
      scenarios,
      coverage,
      components,
      protocols: options.protocols ?? ["uniswap_v2", "uniswap_v3", "curve"],
    });
  };

  return {
    async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
      try {
        if (request.method === "scenario.list") {
          return {
            id: request.id,
            result: await scenarioTools.list(),
          };
        }

        if (request.method === "scenario.get") {
          return {
            id: request.id,
            result: await scenarioTools.get(String(request.params?.id ?? "")),
          };
        }

        if (request.method === "scenario.create") {
          return {
            id: request.id,
            result: await scenarioTools.create({
              id: String(request.params?.id ?? ""),
              name: String(request.params?.name ?? ""),
              lua:
                request.params?.lua === undefined
                  ? undefined
                  : String(request.params.lua),
            }),
          };
        }

        if (request.method === "scenario.run") {
          return {
            id: request.id,
            result: await scenarioTools.run(String(request.params?.id ?? "")),
          };
        }

        if (request.method === "scenario.runAll") {
          return {
            id: request.id,
            result: await scenarioTools.runAll(
              request.params?.filter === undefined
                ? undefined
                : String(request.params.filter),
            ),
          };
        }

        if (request.method === "scenario.mutate") {
          return {
            id: request.id,
            result: await scenarioTools.mutate({
              id: String(request.params?.id ?? ""),
              count:
                request.params?.count === undefined
                  ? undefined
                  : Number(request.params.count),
            }),
          };
        }

        if (request.method === "coverage.report") {
          return {
            id: request.id,
            result: await coverageTools.report(),
          };
        }

        if (request.method === "coverage.gaps") {
          return {
            id: request.id,
            result: await coverageTools.gaps(),
          };
        }

        if (request.method === "coverage.suggest") {
          return {
            id: request.id,
            result: await coverageTools.suggest(),
          };
        }

        if (request.method === "mock.getState") {
          return {
            id: request.id,
            result: await mockTools.getState(),
          };
        }

        if (request.method === "mock.setState") {
          return {
            id: request.id,
            result: await mockTools.setState(
              (request.params?.state as Record<string, unknown>) ?? {},
            ),
          };
        }

        if (request.method === "mock.listPresets") {
          return {
            id: request.id,
            result: await mockTools.listPresets(),
          };
        }

        if (request.method === "component.tree") {
          return {
            id: request.id,
            result: await componentTools.tree(),
          };
        }

        if (request.method === "component.states") {
          return {
            id: request.id,
            result: await componentTools.states(String(request.params?.name ?? "")),
          };
        }

        if (request.method === "resource.list") {
          const resources = await getResources();
          return {
            id: request.id,
            result: resources.map((resource) => resource.uri),
          };
        }

        if (request.method === "resource.get") {
          const target = String(request.params?.uri ?? "");
          const resources = await getResources();
          return {
            id: request.id,
            result: resources.find((resource) => resource.uri === target) ?? null,
          };
        }

        if (request.method === "prompt.list") {
          return {
            id: request.id,
            result: prompts.map((prompt) => prompt.id),
          };
        }

        if (request.method === "prompt.get") {
          const target = String(request.params?.id ?? "");
          const prompt = prompts.find((item) => item.id === target);
          if (!prompt) {
            throw new Error(`Prompt not found: ${target}`);
          }

          const input = request.params?.input;
          const normalizedInput =
            input === undefined || input === null ? "" : (input as string | string[]);

          return {
            id: request.id,
            result: {
              id: prompt.id,
              text: prompt.render(normalizedInput),
            },
          };
        }

        throw new Error(`Unsupported method: ${request.method}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        return {
          id: request.id,
          error: {
            message,
          },
        };
      }
    },
  };
}
