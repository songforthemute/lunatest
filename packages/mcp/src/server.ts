import { createPromptCatalog } from "./prompts/index.js";
import { createResourceCatalog } from "./resources/index.js";
import { createComponentTools } from "./tools/component.js";
import { createCoverageTools } from "./tools/coverage.js";
import { createMockTools } from "./tools/mock.js";
import {
  createScenarioTools,
  type ScenarioDescriptor,
} from "./tools/scenario.js";
import {
  createPresetRegistry,
  loadProjectPresetSources,
  type ExecuteLuaScenarioInput,
  type PresetRegistry,
  type ProjectPresetSources,
} from "@lunatest/core";
import type { CoverageCatalog } from "@lunatest/contracts";
import { isRecord } from "@lunatest/contracts";

type JsonRpcRequest = {
  id: string;
  method: string;
  params?: unknown;
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
  coverageCatalog?: Partial<CoverageCatalog>;
  mockState?: Record<string, unknown>;
  componentTree?: Array<{ name: string; children?: Array<{ name: string }> }>;
  componentStates?: Record<string, string[]>;
  protocols?: string[];
  scenarioAdapter?: ExecuteLuaScenarioInput["adapter"];
  presetRegistry?: PresetRegistry;
  projectPresetSources?: ProjectPresetSources;
  projectRoot?: string;
};

export function createMcpServer(options: McpServerOptions) {
  let coverageTools: ReturnType<typeof createCoverageTools>;
  const scenarioTools = createScenarioTools(options.scenarios ?? [], {
    adapter: options.scenarioAdapter,
    getCoverageSnapshot: async () => coverageTools.report(),
  });
  coverageTools = createCoverageTools({
    seed: options.coverage,
    getScenarios: scenarioTools.list,
    coverageCatalog: options.coverageCatalog,
  });
  let registryPromise: Promise<PresetRegistry> | null = options.presetRegistry
    ? Promise.resolve(options.presetRegistry)
    : null;

  const resolveRegistry = async (): Promise<PresetRegistry> => {
    if (registryPromise) {
      return registryPromise;
    }

    registryPromise = (async () => {
      if (options.projectPresetSources) {
        return createPresetRegistry({
          projectSources: options.projectPresetSources,
        });
      }

      if (options.projectRoot) {
        const projectSources = await loadProjectPresetSources(options.projectRoot);
        return createPresetRegistry({
          projectSources,
        });
      }

      return createPresetRegistry();
    })();

    return registryPromise;
  };

  const mockTools = createMockTools(options.mockState, {
    getRegistry: resolveRegistry,
  });
  const componentTools = createComponentTools(
    options.componentTree ?? [],
    options.componentStates ?? {},
    {
      getScenarios: scenarioTools.list,
      coverageCatalog: options.coverageCatalog,
    },
  );
  const prompts = createPromptCatalog();

  const getResources = async () => {
    const scenarios = await scenarioTools.list();
    const coverage = await coverageTools.report();
    const components = await componentTools.tree();
    const protocols = await mockTools.listProtocolPresets();
    return createResourceCatalog({
      scenarios,
      coverage,
      components,
      protocols:
        options.protocols?.map((id) => ({
          id,
          label: id,
          source: "custom",
          kind: "custom",
          supportedChains: [],
        })) ??
        protocols.map((preset) => ({
          id: preset.qualifiedId,
          label: preset.label,
          source: preset.source,
          kind: preset.kind,
          supportedChains: preset.supportedChains,
        })),
    });
  };

  return {
    async handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
      const params = isRecord(request.params)
        ? (request.params as Record<string, unknown>)
        : undefined;

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
            result: await scenarioTools.get(String(params?.id ?? "")),
          };
        }

        if (request.method === "scenario.create") {
          return {
            id: request.id,
            result: await scenarioTools.create({
              id:
                params?.id === undefined
                  ? undefined
                  : String(params.id),
              name:
                params?.name === undefined
                  ? undefined
                  : String(params.name),
              lua:
                params?.lua === undefined
                  ? undefined
                  : String(params.lua),
            }),
          };
        }

        if (request.method === "scenario.run") {
          return {
            id: request.id,
            result: await scenarioTools.run({
              id:
                params?.id === undefined
                  ? undefined
                  : String(params.id),
              lua:
                params?.lua === undefined
                  ? undefined
                  : String(params.lua),
            }),
          };
        }

        if (request.method === "scenario.runAll") {
          return {
            id: request.id,
            result: await scenarioTools.runAll(
              params?.filter === undefined
                ? undefined
                : String(params.filter),
            ),
          };
        }

        if (request.method === "scenario.mutate") {
          return {
            id: request.id,
            result: await scenarioTools.mutate({
              id: String(params?.id ?? ""),
              count:
                params?.count === undefined
                  ? undefined
                  : Number(params.count),
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
              (params?.state as Record<string, unknown>) ?? {},
            ),
          };
        }

        if (request.method === "state.patch") {
          return {
            id: request.id,
            result: await mockTools.patchState(
              (params?.state as Record<string, unknown>) ?? {},
            ),
          };
        }

        if (request.method === "mock.routes.set") {
          return {
            id: request.id,
            result: await mockTools.setRoutes(
              (params?.routes as Array<Record<string, unknown>>) ?? [],
            ),
          };
        }

        if (request.method === "mock.routes.get") {
          return {
            id: request.id,
            result: await mockTools.getRoutes(),
          };
        }

        if (request.method === "mock.listPresets") {
          return {
            id: request.id,
            result: await mockTools.listPresets(),
          };
        }

        if (request.method === "mock.listProtocolPresets") {
          return {
            id: request.id,
            result: await mockTools.listProtocolPresets(),
          };
        }

        if (request.method === "mock.listPresetDiagnostics") {
          return {
            id: request.id,
            result: await mockTools.listPresetDiagnostics(),
          };
        }

        if (request.method === "mock.getPresetDiagnostic") {
          return {
            id: request.id,
            result: await mockTools.getPresetDiagnostic(String(params?.code ?? "")),
          };
        }

        if (request.method === "mock.getProtocolPreset") {
          return {
            id: request.id,
            result: await mockTools.getProtocolPreset(String(params?.id ?? "")),
          };
        }

        if (request.method === "mock.applyProtocolPreset") {
          return {
            id: request.id,
            result: await mockTools.applyProtocolPreset(
              String(params?.id ?? ""),
              (params?.params as Record<string, unknown>) ?? {},
            ),
          };
        }

        if (request.method === "mock.listWalletPresets") {
          return {
            id: request.id,
            result: await mockTools.listWalletPresets(),
          };
        }

        if (request.method === "mock.getWalletPreset") {
          return {
            id: request.id,
            result: await mockTools.getWalletPreset(String(params?.id ?? "")),
          };
        }

        if (request.method === "mock.applyWalletPreset") {
          return {
            id: request.id,
            result: await mockTools.applyWalletPreset(
              String(params?.id ?? ""),
              (params?.params as Record<string, unknown>) ?? {},
            ),
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
            result: await componentTools.states(String(params?.name ?? "")),
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
          const target = String(params?.uri ?? "");
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
          const target = String(params?.id ?? "");
          const prompt = prompts.find((item) => item.id === target);
          if (!prompt) {
            throw new Error(`Prompt not found: ${target}`);
          }

          const input = params?.input;
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
