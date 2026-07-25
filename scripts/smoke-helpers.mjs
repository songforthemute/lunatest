import { spawn, spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_STOP_TIMEOUT_MS = 2_000;

export function resolveCommandExecutable(command, platform = process.platform) {
  return command === "pnpm" && platform === "win32" ? "pnpm.cmd" : command;
}

function jsonRpcIdKey(id) {
  if (id !== null && typeof id !== "string" && typeof id !== "number") {
    throw new Error(`Invalid JSON-RPC response ID: ${JSON.stringify(id)}`);
  }

  return `${typeof id}:${String(id)}`;
}

function outputMatches(output, pattern) {
  if (typeof pattern === "string") {
    return output.includes(pattern);
  }

  pattern.lastIndex = 0;
  return pattern.test(output);
}

export function formatCommandFailure({ command, args, reason, stdout = "", stderr = "" }) {
  return [
    `Command failed: ${command} ${args.join(" ")}`,
    reason,
    stdout.trim() ? `stdout:\n${stdout.trim()}` : "",
    stderr.trim() ? `stderr:\n${stderr.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function resolveInstalledPackageBin(packageName, binName, cwd) {
  const packageRoot = resolve(cwd, "node_modules", packageName);
  const manifestPath = join(packageRoot, "package.json");
  let manifest;

  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read installed package manifest for ${packageName}: ${message}`);
  }

  const bin = manifest.bin;
  const binEntry = typeof bin === "string" ? bin : bin?.[binName];
  if (typeof binEntry !== "string" || !binEntry.trim()) {
    throw new Error(`Installed package ${packageName} does not declare the ${binName} bin entry`);
  }
  if (isAbsolute(binEntry)) {
    throw new Error(`Installed package ${packageName} bin ${binName} must be a relative file path inside its package`);
  }

  const binPath = resolve(packageRoot, binEntry);
  const packageRelativePath = relative(packageRoot, binPath);
  if (
    !packageRelativePath ||
    packageRelativePath === ".." ||
    packageRelativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
    isAbsolute(packageRelativePath)
  ) {
    throw new Error(`Installed package ${packageName} bin ${binName} must be a relative file path inside its package`);
  }

  try {
    if (!statSync(binPath).isFile()) {
      throw new Error("not a file");
    }
  } catch {
    throw new Error(`Installed package ${packageName} bin ${binName} points to a missing file: ${binEntry}`);
  }

  return {
    command: process.execPath,
    args: [binPath],
    shell: false,
  };
}

export function startCommand(command, args, cwd, options = {}) {
  const child = spawn(resolveCommandExecutable(command), args, {
    cwd,
    env: options.env,
    shell: options.shell ?? false,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  let exitResult;
  let spawnError;
  const outputListeners = new Set();
  const stdoutListeners = new Set();
  const inputErrorListeners = new Set();

  const snapshot = () => ({
    command,
    args,
    stdout,
    stderr,
    exitResult,
  });
  const toFailure = (reason) => new Error(formatCommandFailure({ ...snapshot(), reason }));

  child.stdout.on("data", (chunk) => {
    const text = Buffer.from(chunk).toString("utf8");
    stdout += text;
    options.onStdout?.(text);
    for (const listener of stdoutListeners) {
      listener(text);
    }
    for (const listener of outputListeners) {
      listener();
    }
  });
  child.stderr.on("data", (chunk) => {
    const text = Buffer.from(chunk).toString("utf8");
    stderr += text;
    options.onStderr?.(text);
  });
  child.stdin.on("error", (error) => {
    for (const listener of inputErrorListeners) {
      listener(error);
    }
  });
  child.on("error", (error) => {
    spawnError = error;
    for (const listener of outputListeners) {
      listener();
    }
  });
  child.on("close", (code, signal) => {
    exitResult = { code, signal };
    for (const listener of outputListeners) {
      listener();
    }
  });

  const waitFor = async (predicate, timeoutMs, description) => {
    if (predicate()) {
      return;
    }

    let timeout;
    await new Promise((resolveOutcome, rejectOutcome) => {
      const listener = () => {
        if (spawnError) {
          outputListeners.delete(listener);
          rejectOutcome(toFailure(spawnError.message));
          return;
        }
        if (predicate()) {
          outputListeners.delete(listener);
          resolveOutcome();
          return;
        }
        if (exitResult) {
          outputListeners.delete(listener);
          rejectOutcome(toFailure(`Exited before ${description}`));
        }
      };
      outputListeners.add(listener);
      timeout = setTimeout(() => {
        outputListeners.delete(listener);
        rejectOutcome(toFailure(`Timed out after ${timeoutMs} ms waiting for ${description}`));
      }, timeoutMs);
      listener();
    }).finally(() => {
      clearTimeout(timeout);
    });
  };

  return {
    child,
    snapshot,
    onStdout(listener) {
      stdoutListeners.add(listener);
      return () => stdoutListeners.delete(listener);
    },
    onInputError(listener) {
      inputErrorListeners.add(listener);
      return () => inputErrorListeners.delete(listener);
    },
    write(input) {
      if (!child.stdin.writable) {
        throw toFailure("stdin is not writable");
      }
      child.stdin.write(input);
    },
    closeInput() {
      if (child.stdin.writable) {
        child.stdin.end();
      }
    },
    async waitForOutput(pattern, timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS) {
      await waitFor(() => outputMatches(stdout, pattern), timeoutMs, `output ${String(pattern)}`);
    },
    async waitForExit(timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS) {
      await waitFor(() => Boolean(exitResult), timeoutMs, "process exit");
      if (spawnError) {
        throw toFailure(spawnError.message);
      }
      return exitResult;
    },
    async stop(signal = "SIGTERM", timeoutMs = DEFAULT_STOP_TIMEOUT_MS) {
      if (!exitResult) {
        child.kill(signal);
      }

      try {
        return await this.waitForExit(timeoutMs);
      } catch (error) {
        if (!exitResult) {
          child.kill("SIGKILL");
          return this.waitForExit(timeoutMs);
        }
        throw error;
      }
    },
  };
}

export async function closeInputAndWaitForExit(process, timeoutMs = DEFAULT_STOP_TIMEOUT_MS) {
  process.closeInput();

  try {
    return await process.waitForExit(timeoutMs);
  } catch (error) {
    try {
      await process.stop("SIGKILL", timeoutMs);
    } catch (cleanupError) {
      const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      throw new Error(`${error instanceof Error ? error.message : String(error)}\nCleanup failed: ${cleanupMessage}`);
    }

    throw error;
  }
}

export async function runAsync(command, args, cwd, options = {}) {
  const process = startCommand(command, args, cwd, options);

  try {
    if (options.input !== undefined) {
      process.write(options.input);
      process.closeInput();
    }
    const result = await process.waitForExit(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    if (result.code !== 0) {
      throw new Error(
        formatCommandFailure({
          ...process.snapshot(),
          reason: `Exited with code ${result.code ?? "null"}${
            result.signal ? ` (${result.signal})` : ""
          }`,
        }),
      );
    }
    return process.snapshot();
  } finally {
    await process.stop();
  }
}

export function createJsonRpcClient(process, options = {}) {
  const pending = new Map();
  let remainder = "";
  let protocolError;
  let listenersReleased = false;
  let rejectPending = () => {};
  const createProtocolError = (reason) =>
    new Error(
      formatCommandFailure({
        ...process.snapshot(),
        reason,
      }),
    );
  const unsubscribe = process.onStdout((chunk) => {
    remainder += chunk;
    const lines = remainder.split("\n");
    remainder = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      let response;
      try {
        response = JSON.parse(line);
      } catch {
        protocolError ??= createProtocolError(`Invalid JSON-RPC response: ${line}`);
        rejectPending(protocolError);
        continue;
      }

      let key;
      try {
        key = jsonRpcIdKey(response.id);
      } catch (error) {
        protocolError = error;
        rejectPending(protocolError);
        continue;
      }
      const waiter = pending.get(key);
      if (!waiter) {
        protocolError = new Error(`Unexpected JSON-RPC response ID: ${JSON.stringify(response.id)}`);
        rejectPending(protocolError);
        continue;
      }
      pending.delete(key);
      waiter.resolve(response);
    }
  });

  rejectPending = (error) => {
    for (const waiter of pending.values()) {
      waiter.reject(error);
    }
    pending.clear();
  };
  const releaseListeners = () => {
    if (listenersReleased) {
      return;
    }

    listenersReleased = true;
    unsubscribe();
    unsubscribeInputError();
  };
  const createInputError = (error) => {
    const message = error instanceof Error ? error.message : String(error);
    return createProtocolError(`Unable to write JSON-RPC request: ${message}`);
  };
  const unsubscribeInputError = process.onInputError?.((error) => {
    protocolError ??= createInputError(error);
    rejectPending(protocolError);
  }) ?? (() => {});

  return {
    process,
    pendingRequestCount() {
      return pending.size;
    },
    async request(request, timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS) {
      if (protocolError) {
        throw protocolError;
      }
      const key = jsonRpcIdKey(request.id);
      if (pending.has(key)) {
        throw new Error(`Duplicate JSON-RPC request ID: ${JSON.stringify(request.id)}`);
      }

      const response = new Promise((resolveResponse, rejectResponse) => {
        pending.set(key, { resolve: resolveResponse, reject: rejectResponse });
      });
      response.catch(() => {});
      try {
        process.write(`${JSON.stringify(request)}\n`);
      } catch (error) {
        protocolError ??= createInputError(error);
        rejectPending(protocolError);
        return response;
      }

      let timeout;
      try {
        return await new Promise((resolveResponse, rejectResponse) => {
          timeout = setTimeout(() => {
            rejectResponse(
              new Error(
                formatCommandFailure({
                  ...process.snapshot(),
                  reason: `Timed out after ${timeoutMs} ms waiting for JSON-RPC response ${JSON.stringify(
                    request.id,
                  )}`,
                }),
              ),
            );
          }, timeoutMs);
          response.then(resolveResponse, rejectResponse);
        });
      } finally {
        clearTimeout(timeout);
        pending.delete(key);
      }
    },
    closeInput() {
      process.closeInput();
    },
    async waitForExit(timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS) {
      const result = await process.waitForExit(timeoutMs);
      const exitError =
        protocolError ??
        (result.code !== 0
          ? new Error(
              formatCommandFailure({
                ...process.snapshot(),
                reason: `Exited with code ${result.code ?? "null"}${
                  result.signal ? ` (${result.signal})` : ""
                }`,
              }),
            )
          : undefined);

      if (exitError) {
        rejectPending(exitError);
      } else if (pending.size > 0) {
        rejectPending(
          new Error(
            formatCommandFailure({
              ...process.snapshot(),
              reason: "Exited before pending JSON-RPC requests completed",
            }),
          ),
        );
      }

      releaseListeners();
      if (exitError) {
        throw exitError;
      }
      return result;
    },
    async dispose() {
      releaseListeners();
      rejectPending(new Error("JSON-RPC client disposed"));
      return process.stop();
    },
  };
}

export function startJsonRpcClient(command, args, cwd, options = {}) {
  return createJsonRpcClient(startCommand(command, args, cwd, options), options);
}

export function run(command, args, cwd, options = {}) {
  const result = spawnSync(resolveCommandExecutable(command), args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
    ...options,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        stdout ? `stdout:\n${stdout}` : "",
        stderr ? `stderr:\n${stderr}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return typeof result.stdout === "string" ? result.stdout.trim() : "";
}

export function packPackage(packageDir, outputDir) {
  const output = run(
    "pnpm",
    ["pack", "--pack-destination", outputDir],
    packageDir,
  );
  const lines = output.split("\n").map((line) => line.trim()).filter(Boolean);
  const tarballPath = lines
    .slice()
    .reverse()
    .find((line) => line.endsWith(".tgz"));

  if (!tarballPath) {
    throw new Error(`Tarball path not found from pnpm pack output at ${packageDir}`);
  }

  return resolve(tarballPath);
}

export function startMcpSmoke(consumerDir) {
  const command = "pnpm";
  const result = spawnSync(
    resolveCommandExecutable(command),
    ["exec", "lunatest-mcp", "--empty"],
    {
      cwd: consumerDir,
      encoding: "utf8",
      stdio: "pipe",
      input: `${JSON.stringify({ id: "empty-list", method: "scenario.list" })}\n`,
      timeout: DEFAULT_TIMEOUT_MS,
    },
  );

  if (result.status !== 0) {
    throw new Error(
      formatCommandFailure({
        command,
        args: ["exec", "lunatest-mcp", "--empty"],
        reason: result.error?.message ?? `Exited with code ${result.status ?? "null"}`,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
      }),
    );
  }

  let response;
  try {
    response = JSON.parse(result.stdout.trim());
  } catch {
    throw new Error(
      formatCommandFailure({
        command,
        args: ["exec", "lunatest-mcp", "--empty"],
        reason: "Expected a JSON-RPC response",
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
      }),
    );
  }

  if (response.id !== "empty-list" || !Array.isArray(response.result) || response.result.length > 0) {
    throw new Error("lunatest-mcp --empty did not return an empty scenario list");
  }
}
