import type {
  EndpointPattern,
  EthereumMethodRoute,
  HttpEndpointRoute,
  RouteMock,
  RoutingConfig,
  RoutingMode,
  RpcEndpointRoute,
  WsEndpointRoute,
} from "@lunatest/contracts";

export type {
  EndpointPattern,
  EthereumMethodRoute,
  HttpEndpointRoute,
  RouteMock,
  RoutingConfig,
  RoutingMode,
  RpcEndpointRoute,
  WsEndpointRoute,
};

export type InterceptEndpointType = "ethereum" | "rpc" | "http" | "ws";

export type InterceptResolverContext = {
  url: string;
  method: string;
  payload?: unknown;
  endpointType: InterceptEndpointType;
};

export type MockResponseInput =
  | unknown
  | ((context: InterceptResolverContext) => unknown | Promise<unknown>);

export type MockResponseMap = Record<string, MockResponseInput>;

export type LunaRuntimeInterceptConfig = {
  enable?: boolean;
  debug?: boolean;
  intercept?: {
    mode?: RoutingMode;
    routes?: RouteMock[];
    routing?: RoutingConfig;
    mockResponses?: MockResponseMap;
  };
};

export type NormalizedRuntimeInterceptConfig = {
  enable?: boolean;
  debug: boolean;
  intercept: {
    mode: RoutingMode;
    routing: {
      ethereumMethods: EthereumMethodRoute[];
      rpcEndpoints: RpcEndpointRoute[];
      httpEndpoints: HttpEndpointRoute[];
      wsEndpoints: WsEndpointRoute[];
      bypassWsPatterns: EndpointPattern[];
    };
    mockResponses: MockResponseMap;
  };
};

export type RuntimeInterceptHandle = {
  enable: (nodeEnv?: string) => boolean;
  disable: () => void;
  isEnabled: () => boolean;
  setRouteMocks?: (routes: RouteMock[]) => RouteMock[];
  appendRouteMocks?: (routes: RouteMock[]) => RouteMock[];
  applyInterceptState?: (partialState: Record<string, unknown>) => Record<string, unknown>;
  getInterceptState?: () => Record<string, unknown>;
};
