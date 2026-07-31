import {
  createDeterministicScenarioAdapter,
  type ExecuteLuaScenarioAdapter,
  type LuaConfig,
  type ScenarioRuntime,
} from "@lunatest/core";

type MaybePromise<T> = T | Promise<T>;

export type LunaPageScenarioContext<Page> = {
  page: Page;
  config: LuaConfig;
  runtime: ScenarioRuntime;
};

export type LunaPageAdapterOptions<Page> = {
  page: Page;
  runWhen?: (context: LunaPageScenarioContext<Page>) => MaybePromise<void>;
  resolveUi: (
    context: LunaPageScenarioContext<Page>,
  ) => MaybePromise<Record<string, unknown>>;
  resolveState?: (
    context: LunaPageScenarioContext<Page>,
  ) => MaybePromise<Record<string, unknown>>;
  resolveTransitions?: (context: LunaPageScenarioContext<Page>) => MaybePromise<string[]>;
  resolveElapsedMs?: (context: LunaPageScenarioContext<Page>) => MaybePromise<number>;
};

function withPage<Page>(
  page: Page,
  context: { config: LuaConfig; runtime: ScenarioRuntime },
): LunaPageScenarioContext<Page> {
  return {
    page,
    config: context.config,
    runtime: context.runtime,
  };
}

export function createLunaPageAdapter<Page>(
  options: LunaPageAdapterOptions<Page>,
): ExecuteLuaScenarioAdapter {
  const deterministic = createDeterministicScenarioAdapter();
  const resolveState = options.resolveState;
  const resolveTransitions = options.resolveTransitions;
  const resolveElapsedMs = options.resolveElapsedMs;

  return {
    async runWhen(context) {
      await deterministic.runWhen?.(context);
      await options.runWhen?.(withPage(options.page, context));
    },
    resolveUi(context) {
      return options.resolveUi(withPage(options.page, context));
    },
    resolveState: resolveState
      ? (context) => resolveState(withPage(options.page, context))
      : undefined,
    resolveTransitions: resolveTransitions
      ? (context) => resolveTransitions(withPage(options.page, context))
      : undefined,
    resolveElapsedMs: resolveElapsedMs
      ? (context) => resolveElapsedMs(withPage(options.page, context))
      : undefined,
  };
}
