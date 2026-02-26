import { z } from "zod";
import { deepClone, deepMerge, type RouteMock } from "@lunatest/contracts";
export type { RouteMock } from "@lunatest/contracts";

const StringRecordSchema = z.record(z.string(), z.unknown());

const EthereumRouteSchema = z.object({
  endpointType: z.literal("ethereum"),
  method: z.string().min(1),
  responseKey: z.string().min(1),
});

const RpcRouteSchema = z.object({
  endpointType: z.literal("rpc"),
  urlPattern: z.union([z.string().min(1), z.instanceof(RegExp)]),
  methods: z.array(z.string().min(1)).optional(),
  responseKey: z.string().min(1),
});

const HttpRouteSchema = z.object({
  endpointType: z.literal("http"),
  urlPattern: z.union([z.string().min(1), z.instanceof(RegExp)]),
  method: z.string().min(1).optional(),
  responseKey: z.string().min(1),
});

const WsRouteSchema = z.object({
  endpointType: z.literal("ws"),
  urlPattern: z.union([z.string().min(1), z.instanceof(RegExp)]),
  responseKey: z.string().min(1),
  match: z.union([z.string().min(1), z.instanceof(RegExp)]).optional(),
});

const RouteMockSchema = z.discriminatedUnion("endpointType", [
  EthereumRouteSchema,
  RpcRouteSchema,
  HttpRouteSchema,
  WsRouteSchema,
]);

const LegacyRoutingSchema = z
  .object({
    ethereumMethods: z
      .array(
        z.object({
          method: z.string().min(1),
          responseKey: z.string().min(1),
        }),
      )
      .optional(),
    rpcEndpoints: z
      .array(
        z.object({
          urlPattern: z.string().min(1),
          methods: z.array(z.string().min(1)).optional(),
          responseKey: z.string().min(1),
        }),
      )
      .optional(),
    httpEndpoints: z
      .array(
        z.object({
          urlPattern: z.string().min(1),
          method: z.string().min(1).optional(),
          responseKey: z.string().min(1),
        }),
      )
      .optional(),
    wsEndpoints: z
      .array(
        z.object({
          urlPattern: z.string().min(1),
          responseKey: z.string().min(1),
          match: z.string().min(1).optional(),
        }),
      )
      .optional(),
  })
  .partial();

type LegacyRouting = z.infer<typeof LegacyRoutingSchema>;

export const LuaConfigSchema = z
  .object({
    name: z.string().min(1).optional(),
    mode: z.enum(["strict", "permissive"]).default("strict"),
    given: StringRecordSchema.default({}),
    when: StringRecordSchema.optional(),
    then_ui: StringRecordSchema.optional(),
    then_state: StringRecordSchema.optional(),
    intercept: z
      .object({
        routes: z.array(RouteMockSchema).optional(),
        routing: LegacyRoutingSchema.optional(),
        mockResponses: StringRecordSchema.optional(),
        state: StringRecordSchema.optional(),
      })
      .optional(),
  })
  .passthrough();

export type LuaConfig = z.infer<typeof LuaConfigSchema>;

export type ScenarioRuntime = {
  getConfig: () => LuaConfig;
  getRouteMocks: () => RouteMock[];
  setRouteMocks: (routes: RouteMock[]) => RouteMock[];
  getInterceptState: () => Record<string, unknown>;
  applyInterceptState: (partialState: Record<string, unknown>) => Record<string, unknown>;
};

function normalizeLegacyRoutes(routing?: LegacyRouting): RouteMock[] {
  if (!routing) {
    return [];
  }

  const routes: RouteMock[] = [];

  for (const route of routing.ethereumMethods ?? []) {
    routes.push({
      endpointType: "ethereum",
      method: route.method,
      responseKey: route.responseKey,
    });
  }

  for (const route of routing.rpcEndpoints ?? []) {
    routes.push({
      endpointType: "rpc",
      urlPattern: route.urlPattern,
      methods: route.methods,
      responseKey: route.responseKey,
    });
  }

  for (const route of routing.httpEndpoints ?? []) {
    routes.push({
      endpointType: "http",
      urlPattern: route.urlPattern,
      method: route.method,
      responseKey: route.responseKey,
    });
  }

  for (const route of routing.wsEndpoints ?? []) {
    routes.push({
      endpointType: "ws",
      urlPattern: route.urlPattern,
      responseKey: route.responseKey,
      match: route.match,
    });
  }

  return routes;
}

export function createScenarioRuntime(input: LuaConfig): ScenarioRuntime {
  const parsed = LuaConfigSchema.parse(input);
  let routeMocks = parsed.intercept?.routes
    ? parsed.intercept.routes.map((route) => ({ ...route }) as RouteMock)
    : normalizeLegacyRoutes(parsed.intercept?.routing);
  let interceptState = deepClone(parsed.intercept?.state ?? {});

  return {
    getConfig() {
      const cloned = deepClone(parsed) as LuaConfig;
      cloned.intercept = cloned.intercept ?? {};
      cloned.intercept.routes = routeMocks.map((route) => ({ ...route }));
      cloned.intercept.state = deepClone(interceptState);
      return cloned;
    },

    getRouteMocks() {
      return routeMocks.map((route) => ({ ...route }));
    },

    setRouteMocks(routes) {
      routeMocks = z.array(RouteMockSchema).parse(routes).map((route) => ({ ...route }));
      return routeMocks.map((route) => ({ ...route }));
    },

    getInterceptState() {
      return deepClone(interceptState);
    },

    applyInterceptState(partialState) {
      const normalized = StringRecordSchema.parse(partialState);
      interceptState = deepMerge(interceptState, normalized);
      return deepClone(interceptState);
    },
  };
}

export function applyInterceptState(
  runtime: ScenarioRuntime,
  partialState: Record<string, unknown>,
): Record<string, unknown> {
  return runtime.applyInterceptState(partialState);
}

export function setRouteMocks(
  runtime: ScenarioRuntime,
  routes: RouteMock[],
): RouteMock[] {
  return runtime.setRouteMocks(routes);
}
