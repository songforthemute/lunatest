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
};

export function createMcpServer(options: McpServerOptions) {
  const scenarioTools = createScenarioTools(options.scenarios ?? []);
  const coverageTools = createCoverageTools(options.coverage);
  const mockTools = createMockTools(options.mockState);

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

        if (request.method === "coverage.report") {
          return {
            id: request.id,
            result: await coverageTools.report(),
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
