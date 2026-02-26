import { createInterface } from "node:readline";

import type { createMcpServer } from "../server.js";

type McpServer = ReturnType<typeof createMcpServer>;

type JsonRpcLikeRequest = {
  id: string;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcLikeResponse = {
  id: string;
  result?: unknown;
  error?: {
    message: string;
  };
};

export type StdioServerOptions = {
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
  error?: NodeJS.WritableStream;
  server: McpServer;
};

function invalidRequestResponse(message: string): JsonRpcLikeResponse {
  return {
    id: "unknown",
    error: {
      message,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isJsonRpcLikeRequest(
  value: JsonRpcLikeRequest | JsonRpcLikeResponse,
): value is JsonRpcLikeRequest {
  return "method" in value;
}

export function parseJsonRpcLine(rawLine: string): JsonRpcLikeRequest | JsonRpcLikeResponse {
  const trimmed = rawLine.trim();
  if (!trimmed) {
    return invalidRequestResponse("Empty JSON-RPC line");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return invalidRequestResponse("Malformed JSON line");
  }

  if (!isRecord(parsed)) {
    return invalidRequestResponse("Invalid JSON-RPC payload");
  }

  const id = parsed.id;
  const method = parsed.method;

  if (typeof id !== "string" || typeof method !== "string") {
    return invalidRequestResponse("JSON-RPC request requires string id and method");
  }

  const params =
    parsed.params !== undefined && isRecord(parsed.params)
      ? (parsed.params as Record<string, unknown>)
      : undefined;

  return {
    id,
    method,
    params,
  };
}

export async function processJsonRpcLine(
  line: string,
  server: McpServer,
): Promise<JsonRpcLikeResponse | null> {
  const parsed = parseJsonRpcLine(line);
  if (!isJsonRpcLikeRequest(parsed)) {
    return parsed;
  }

  return server.handleRequest(parsed);
}

export async function runStdioServer(options: StdioServerOptions): Promise<void> {
  const rl = createInterface({
    input: options.input,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const response = await processJsonRpcLine(line, options.server);
    if (!response) {
      continue;
    }

    options.output.write(`${JSON.stringify(response)}\n`);
  }

  rl.close();
}
