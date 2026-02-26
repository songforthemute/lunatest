import type { RunScenarioResult } from "./runner.js";
import { runScenario } from "./runner.js";
import { loadLunaConfig } from "../config/lua-config.js";
import {
  createScenarioRuntime,
  LuaConfigSchema,
  type LuaConfig,
  type ScenarioRuntime,
} from "../runtime/scenario-runtime.js";

type LuaScenarioSource = string | URL | LuaConfig;

type ExecuteAdapter = {
  runWhen?: (context: {
    config: LuaConfig;
    runtime: ScenarioRuntime;
  }) => Promise<void> | void;
  resolveUi?: (context: {
    config: LuaConfig;
    runtime: ScenarioRuntime;
  }) => Promise<Record<string, unknown>> | Record<string, unknown>;
  resolveState?: (context: {
    config: LuaConfig;
    runtime: ScenarioRuntime;
  }) => Promise<Record<string, unknown>> | Record<string, unknown>;
  resolveTransitions?: (context: {
    config: LuaConfig;
    runtime: ScenarioRuntime;
  }) => Promise<string[]> | string[];
  resolveElapsedMs?: (context: {
    config: LuaConfig;
    runtime: ScenarioRuntime;
  }) => Promise<number> | number;
};

export type ExecuteLuaScenarioInput = {
  source: LuaScenarioSource;
  adapter?: ExecuteAdapter;
};

export type ExecuteLuaScenarioResult = {
  scenarioName: string;
  pass: boolean;
  error?: string;
  result?: RunScenarioResult;
  config: LuaConfig;
};

async function resolveConfig(source: LuaScenarioSource): Promise<LuaConfig> {
  if (typeof source === "string" || source instanceof URL) {
    return loadLunaConfig(source);
  }

  return LuaConfigSchema.parse(source);
}

function normalizeScenario(config: LuaConfig): {
  name: string;
  given?: Record<string, unknown>;
  when: {
    action: string;
    [key: string]: unknown;
  };
  then_ui: Record<string, unknown>;
  then_state?: Record<string, unknown>;
} {
  const whenAction =
    config.when && typeof config.when.action === "string" ? config.when.action : "run";

  return {
    name: config.name ?? "unnamed",
    given: config.given,
    when: {
      action: whenAction,
      ...(config.when ?? {}),
    },
    then_ui: config.then_ui ?? {},
    then_state: config.then_state,
  };
}

export async function executeLuaScenario(
  input: ExecuteLuaScenarioInput,
): Promise<ExecuteLuaScenarioResult> {
  const config = await resolveConfig(input.source);
  const runtime = createScenarioRuntime(config);
  const scenario = normalizeScenario(config);

  if (!input.adapter?.resolveUi) {
    return {
      scenarioName: scenario.name,
      pass: false,
      error: "executor_not_configured",
      config,
    };
  }

  try {
    if (input.adapter.runWhen) {
      await input.adapter.runWhen({
        config,
        runtime,
      });
    }

    const result = await runScenario({
      scenario,
      resolveUi: () => input.adapter!.resolveUi!({ config, runtime }),
      resolveState: input.adapter.resolveState
        ? () => input.adapter!.resolveState!({ config, runtime })
        : undefined,
      resolveTransitions: input.adapter.resolveTransitions
        ? () => input.adapter!.resolveTransitions!({ config, runtime })
        : undefined,
      resolveElapsedMs: input.adapter.resolveElapsedMs
        ? () => input.adapter!.resolveElapsedMs!({ config, runtime })
        : undefined,
    });

    return {
      scenarioName: scenario.name,
      pass: result.pass,
      result,
      config,
    };
  } catch (cause) {
    return {
      scenarioName: scenario.name,
      pass: false,
      error: cause instanceof Error ? cause.message : String(cause),
      config,
    };
  }
}
