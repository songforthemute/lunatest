import { watch } from "node:fs/promises";
import { access, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

import type { ResolvedLunaCliConfig } from "../config.js";
import { runCommand } from "./run.js";
import { loadScenarioCatalog } from "../scenario-catalog.js";
import { resolveScenarioSources } from "./scenario-sources.js";

type WatchImpl = typeof watch;

export type WatchCommandOptions = {
  config: ResolvedLunaCliConfig;
  filter?: string;
  signal?: AbortSignal;
  debounceMs?: number;
  pollIntervalMs?: number;
  onUpdate?: (output: string) => void;
  watchImpl?: WatchImpl;
};

function formatWatchError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return ["Watch mode", "status=error", `message=${message}`].join("\n");
}

async function resolveWatchFingerprint(config: ResolvedLunaCliConfig): Promise<string> {
  let sources: string[];
  try {
    sources = await resolveScenarioSources({
      luaConfigPath: config.resolvedLuaConfigPath,
      scenarioDir: config.resolvedScenarioDir,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Scenario source not found")) {
      return "__empty__";
    }
    throw error;
  }

  const fingerprint = await Promise.all(
    sources.map(async (source) => {
      try {
        const snapshot = await stat(source);
        return `${source}:${snapshot.size}:${snapshot.mtimeMs}`;
      } catch {
        return `${source}:missing`;
      }
    }),
  );

  return fingerprint.sort().join("|");
}

export async function watchCommand(options: WatchCommandOptions): Promise<string> {
  const debounceMs = options.debounceMs ?? 300;
  const pollIntervalMs = options.pollIntervalMs ?? 250;
  const watchImpl = options.watchImpl ?? watch;
  const history: string[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = Promise.resolve();

  const emit = async () => {
    try {
      const existing = await loadScenarioCatalog({
        config: options.config,
        allowEmpty: true,
      });

      const output =
        existing.length === 0
          ? "Watch mode\nstatus=idle"
          : await runCommand({
              filter: options.filter,
              config: options.config,
            });
      history.push(output);
      options.onUpdate?.(output);
    } catch (error) {
      const output = formatWatchError(error);
      history.push(output);
      options.onUpdate?.(output);
    }
  };

  const schedule = () => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      running = emit();
    }, debounceMs);
  };

  await emit();

  const configWatcher = await (async () => {
    try {
      if (!(await canAccess(options.config.resolvedLuaConfigPath))) {
        return undefined;
      }
      return watchImpl(options.config.resolvedLuaConfigPath, {
        signal: options.signal,
      });
    } catch {
      return undefined;
    }
  })();

  const scenarioWatcher = await (async () => {
    try {
      if (!(await canAccess(options.config.resolvedScenarioDir))) {
        return undefined;
      }
      return watchImpl(options.config.resolvedScenarioDir, {
        recursive: true,
        signal: options.signal,
      });
    } catch {
      return undefined;
    }
  })();

  const consume = async (iterator: AsyncIterable<unknown> | undefined) => {
    if (!iterator) {
      return;
    }

    try {
      for await (const _event of iterator) {
        schedule();
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        throw error;
      }
    }
  };

  const pollForChanges = async () => {
    let previous = await resolveWatchFingerprint(options.config);

    await new Promise<void>((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const next = await resolveWatchFingerprint(options.config);
          if (next !== previous) {
            previous = next;
            schedule();
          }
        } catch (error) {
          clearInterval(interval);
          reject(error);
        }
      }, pollIntervalMs);

      const stop = () => {
        clearInterval(interval);
        resolve();
      };

      options.signal?.addEventListener("abort", stop, { once: true });
    });
  };

  await Promise.race([
    Promise.all([
      consume(configWatcher),
      consume(scenarioWatcher),
      !configWatcher || !scenarioWatcher ? pollForChanges() : Promise.resolve(),
    ]),
    new Promise<void>((resolve) => {
      options.signal?.addEventListener("abort", () => resolve(), { once: true });
    }),
  ]);

  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  try {
    await running;
  } catch (error) {
    if (!(error instanceof Error && error.name === "AbortError")) {
      throw error;
    }
  }
  return history.join("\n\n");
}
  const canAccess = async (path: string): Promise<boolean> => {
    try {
      await access(path, fsConstants.F_OK);
      return true;
    } catch {
      return false;
    }
  };
