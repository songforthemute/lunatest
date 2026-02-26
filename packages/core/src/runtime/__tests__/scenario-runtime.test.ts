import { describe, expect, it } from "vitest";

import {
  applyInterceptState,
  createScenarioRuntime,
  setRouteMocks,
} from "../scenario-runtime";

describe("scenario runtime", () => {
  it("applies intercept state with deep merge", () => {
    const runtime = createScenarioRuntime({
      name: "runtime-state",
      mode: "strict",
      given: {},
      intercept: {
        state: {
          chain: {
            blockNumber: 100,
          },
        },
      },
    });

    const updated = applyInterceptState(runtime, {
      chain: {
        gasPrice: 30,
      },
    });

    expect(updated).toEqual({
      chain: {
        blockNumber: 100,
        gasPrice: 30,
      },
    });
  });

  it("replaces route mocks using array input", () => {
    const runtime = createScenarioRuntime({
      mode: "strict",
      given: {},
    });

    const routes = setRouteMocks(runtime, [
      {
        endpointType: "rpc",
        urlPattern: "https://rpc.example",
        methods: ["eth_call"],
        responseKey: "rpc-call",
      },
      {
        endpointType: "http",
        urlPattern: "https://api.example/quote",
        method: "GET",
        responseKey: "quote",
      },
    ]);

    expect(routes).toHaveLength(2);
    expect(runtime.getRouteMocks()).toEqual(routes);
    expect(runtime.getConfig().intercept?.routes).toEqual(routes);
  });
});
