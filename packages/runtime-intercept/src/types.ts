export type RoutingMode = "strict" | "permissive";

export type EndpointPattern = string | RegExp;

export type EthereumMethodRoute = {
  method: string;
  responseKey: string;
};

export type RpcEndpointRoute = {
  urlPattern: EndpointPattern;
  methods?: string[];
  responseKey: string;
};

export type HttpEndpointRoute = {
  urlPattern: EndpointPattern;
  method?: string;
  responseKey: string;
};

export type WsEndpointRoute = {
  urlPattern: EndpointPattern;
  responseKey: string;
  match?: EndpointPattern;
};

export type RoutingConfig = {
  ethereumMethods?: EthereumMethodRoute[];
  rpcEndpoints?: RpcEndpointRoute[];
  httpEndpoints?: HttpEndpointRoute[];
  wsEndpoints?: WsEndpointRoute[];
  bypassWsPatterns?: EndpointPattern[];
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
};
