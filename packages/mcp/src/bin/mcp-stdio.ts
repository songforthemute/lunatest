#!/usr/bin/env node

import { createMcpStdioApp, formatMcpStdioError } from "./mcp-stdio-app.js";
import { runStdioServer } from "../transport/stdio.js";

async function main(): Promise<void> {
  const app = await createMcpStdioApp(process.argv.slice(2));

  if (app.kind === "help") {
    process.stdout.write(`${app.usage}\n`);
    return;
  }

  await runStdioServer({
    input: process.stdin,
    output: process.stdout,
    error: process.stderr,
    server: app.server,
  });
}

main().catch((error) => {
  process.stderr.write(`${formatMcpStdioError(error)}\n`);
  process.exitCode = 1;
});
