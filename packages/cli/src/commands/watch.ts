import { watch } from "node:fs/promises";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

import type { ResolvedLunaCliConfig } from "../config.js";
import { runCommand } from "./run.js";
import { loadScenarioCatalog } from "../scenario-catalog.js";

export type WatchCommandOptions = {
  config: ResolvedLunaCliConfig;
  filter?: string;
  signal?: AbortSignal;
  debounceMs?: number;
  onUpdate?: (output: string) => void;
};

export async function watchCommand(options: WatchCommandOptions): Promise<string> {
  const debounceMs = options.debounceMs ?? 300;
  const history: string[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = Promise.resolve();

  const emit = async () => {
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
      return watch(options.config.resolvedLuaConfigPath, {
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
      return watch(options.config.resolvedScenarioDir, {
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

  await Promise.race([
    Promise.all([consume(configWatcher), consume(scenarioWatcher)]),
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
