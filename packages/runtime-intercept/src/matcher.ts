import type {
  EndpointPattern,
  InterceptResolverContext,
  MockResponseInput,
} from "./types.js";
export { isRecord } from "@lunatest/contracts";

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const wildcard = escaped.replace(/\*\*/g, ".*").replace(/\*/g, ".*");
  return new RegExp(`^${wildcard}$`);
}

export function matchesPattern(value: string, pattern: EndpointPattern): boolean {
  if (pattern instanceof RegExp) {
    return pattern.test(value);
  }

  if (pattern.includes("*")) {
    return patternToRegExp(pattern).test(value);
  }

  return value === pattern || value.includes(pattern);
}

export function readBodyPayload(body: BodyInit | null | undefined): unknown {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    return body.toString();
  }

  return undefined;
}

export function readWsPayload(data: unknown): unknown {
  if (typeof data !== "string") {
    return data;
  }

  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

export function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value ?? null);
  } catch {
    return String(value);
  }
}

export async function resolveMock(
  source: MockResponseInput | undefined,
  context: InterceptResolverContext,
): Promise<unknown> {
  if (typeof source === "function") {
    return await (source as (ctx: InterceptResolverContext) => unknown | Promise<unknown>)(context);
  }

  return source;
}

export function getGlobalNodeEnv(): string | undefined {
  const maybeGlobal = globalThis as {
    process?: {
      env?: {
        NODE_ENV?: string;
      };
    };
  };

  return maybeGlobal.process?.env?.NODE_ENV;
}

export function createJsonResponse(body: string, init: ResponseInit): Response {
  if (typeof Response !== "undefined") {
    return new Response(body, init);
  }

  const headers = new Headers(init.headers);
  return {
    ok: (init.status ?? 200) >= 200 && (init.status ?? 200) < 300,
    status: init.status ?? 200,
    statusText: "",
    headers,
    redirected: false,
    type: "basic",
    url: "",
    clone() {
      return createJsonResponse(body, init);
    },
    body: null,
    bodyUsed: true,
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
    blob: async () => new Blob([body], { type: headers.get("content-type") ?? "application/json" }),
    formData: async () => {
      throw new Error("formData is not supported by fallback response");
    },
    json: async () => JSON.parse(body),
    text: async () => body,
  } as unknown as Response;
}

export type RuntimeEvent = Event & {
  type: string;
  data?: unknown;
  target?: unknown;
  currentTarget?: unknown;
};

function attachEventTarget(event: RuntimeEvent, target?: unknown): RuntimeEvent {
  if (target === undefined) {
    return event;
  }

  try {
    Object.defineProperty(event, "target", { configurable: true, value: target });
    Object.defineProperty(event, "currentTarget", { configurable: true, value: target });
  } catch {
    return event;
  }

  return event;
}

export function createRuntimeEvent(type: string, target?: unknown): RuntimeEvent {
  if (typeof Event !== "undefined") {
    const event = new Event(type) as RuntimeEvent;
    return attachEventTarget(event, target);
  }

  return {
    type,
    target,
    currentTarget: target,
    bubbles: false,
    cancelBubble: false,
    cancelable: false,
    composed: false,
    defaultPrevented: false,
    eventPhase: 0,
    isTrusted: false,
    returnValue: true,
    srcElement: target as EventTarget,
    timeStamp: Date.now(),
    composedPath: () => [],
    initEvent: () => undefined,
    preventDefault: () => undefined,
    stopImmediatePropagation: () => undefined,
    stopPropagation: () => undefined,
    NONE: 0,
    CAPTURING_PHASE: 1,
    AT_TARGET: 2,
    BUBBLING_PHASE: 3,
  } as RuntimeEvent;
}

export function createRuntimeMessageEvent(data: unknown, target?: unknown): RuntimeEvent {
  if (typeof MessageEvent !== "undefined") {
    const event = new MessageEvent("message", { data }) as RuntimeEvent;
    return attachEventTarget(event, target);
  }

  const base = createRuntimeEvent("message", target);
  base.data = data;
  return base;
}

export function createRuntimeErrorEvent(target?: unknown): RuntimeEvent {
  return createRuntimeEvent("error", target);
}
