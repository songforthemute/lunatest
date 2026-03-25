import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import { createMcpServer } from "../server";
import { parseJsonRpcLine, runStdioServer } from "../transport/stdio";

function readOutput(stream: PassThrough): string {
  const chunks: Buffer[] = [];
  let chunk = stream.read() as Buffer | null;
  while (chunk) {
    chunks.push(chunk);
    chunk = stream.read() as Buffer | null;
  }
  return Buffer.concat(chunks).toString("utf8");
}

describe("mcp stdio transport", () => {
  it("writes response for valid json-rpc line", async () => {
    const server = createMcpServer({
      scenarios: [{ id: "swap-1", name: "swap happy path" }],
    });

    const input = new PassThrough();
    const output = new PassThrough();

    input.write(
      `${JSON.stringify({ id: "req-1", method: "scenario.list", params: {} })}\n`,
    );
    input.end();

    await runStdioServer({ input, output, server });

    const raw = readOutput(output).trim();
    expect(raw.length).toBeGreaterThan(0);

    const parsed = JSON.parse(raw);
    expect(parsed).toEqual({
      id: "req-1",
      result: [{ id: "swap-1", name: "swap happy path" }],
    });
  });

  it("returns error envelope for malformed json line", async () => {
    const server = createMcpServer({ scenarios: [] });
    const input = new PassThrough();
    const output = new PassThrough();

    input.write("{bad-json}\n");
    input.end();

    await runStdioServer({ input, output, server });

    const parsed = JSON.parse(readOutput(output).trim());

    expect(parsed.id).toBe("unknown");
    expect(parsed.error?.message).toContain("Malformed JSON");
  });

  it("returns server error envelope for unsupported method", async () => {
    const server = createMcpServer({ scenarios: [] });
    const input = new PassThrough();
    const output = new PassThrough();

    input.write(
      `${JSON.stringify({ id: "req-404", method: "unknown.method", params: {} })}\n`,
    );
    input.end();

    await runStdioServer({ input, output, server });

    const parsed = JSON.parse(readOutput(output).trim());

    expect(parsed.id).toBe("req-404");
    expect(parsed.error?.message).toContain("Unsupported method");
  });

  it("accepts numeric ids and preserves positional params", () => {
    const parsed = parseJsonRpcLine('{"id":1,"method":"scenario.run","params":[1,2]}');

    expect(parsed).toEqual({
      id: 1,
      method: "scenario.run",
      params: [1, 2],
    });
  });

  it("treats notifications as requests without response id", () => {
    const parsed = parseJsonRpcLine('{"method":"scenario.list"}');

    expect(parsed).toEqual({
      id: undefined,
      method: "scenario.list",
      params: undefined,
    });
  });

  it("accepts null ids and echoes them back in responses", async () => {
    const server = createMcpServer({
      scenarios: [{ id: "swap-1", name: "swap happy path" }],
    });

    const parsed = parseJsonRpcLine('{"id":null,"method":"scenario.list"}');
    expect(parsed).toEqual({
      id: null,
      method: "scenario.list",
      params: undefined,
    });

    const input = new PassThrough();
    const output = new PassThrough();

    input.write(`${JSON.stringify({ id: null, method: "scenario.list" })}\n`);
    input.end();

    await runStdioServer({ input, output, server });

    const response = JSON.parse(readOutput(output).trim());
    expect(response.id).toBeNull();
    expect(response.result).toEqual([{ id: "swap-1", name: "swap happy path" }]);
  });
});
