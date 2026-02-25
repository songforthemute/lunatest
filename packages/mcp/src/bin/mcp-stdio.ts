#!/usr/bin/env node

import { createMcpServer } from "../server";
import { runStdioServer } from "../transport/stdio";

const server = createMcpServer({
  scenarios: [],
});

runStdioServer({
  input: process.stdin,
  output: process.stdout,
  error: process.stderr,
  server,
}).catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
