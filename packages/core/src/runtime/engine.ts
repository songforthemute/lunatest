import { LuaFactory, type LuaEngine } from "wasmoon";

import { fromLuaValue, toLuaArgs } from "./bridge";
import { applySandbox } from "./sandbox";
import { RuntimeOptionsSchema, type Runtime, type RuntimeOptions } from "./types";

const FUNCTION_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const DEFAULT_MEMORY_LIMIT = 16 * 1024 * 1024;

function normalizeFunctionName(name: string): string {
  if (!FUNCTION_NAME_RE.test(name)) {
    throw new Error(`Invalid function name: ${name}`);
  }

  return name;
}

export async function createRuntime(rawOptions: RuntimeOptions = {}): Promise<Runtime> {
  const options = RuntimeOptionsSchema.parse(rawOptions);
  const factory = new LuaFactory();
  const hostFunctions = new Map<string, (...args: unknown[]) => unknown>();

  let instructionLimit = options.instructionLimit;
  let memoryLimit = options.memoryLimit ?? DEFAULT_MEMORY_LIMIT;
  let engine: LuaEngine;

  const bindHostFunction = (name: string, hostFn: (...args: unknown[]) => unknown): void => {
    engine.global.set(name, (...values: unknown[]) => {
      const normalizedValues = fromLuaValue(values) as unknown[];
      const result = hostFn(...normalizedValues);
      return toLuaArgs(result);
    });
  };

  const bootstrapEngine = async (): Promise<void> => {
    if (engine) {
      engine.global.close();
    }

    engine = await factory.createEngine({
      functionTimeout: instructionLimit,
      traceAllocations: true,
    });

    engine.global.setMemoryMax(memoryLimit);
    await applySandbox(engine, {
      ...options,
      instructionLimit,
      memoryLimit,
    });

    for (const [name, hostFn] of hostFunctions.entries()) {
      bindHostFunction(name, hostFn);
    }
  };

  await bootstrapEngine();

  return {
    async eval(code: string): Promise<void> {
      await engine.doString(code);
    },

    async call(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
      const targetName = normalizeFunctionName(name);
      const target = engine.global.get(targetName);

      if (typeof target !== "function") {
        throw new Error(`Function not found: ${targetName}`);
      }

      const normalizedArgs = toLuaArgs(args) as Record<string, unknown>;
      const orderedArgs = Object.values(normalizedArgs);
      const result = await Promise.resolve(target(...orderedArgs));

      return fromLuaValue(result);
    },

    register(name: string, hostFn: (...args: unknown[]) => unknown): void {
      const targetName = normalizeFunctionName(name);
      hostFunctions.set(targetName, hostFn);
      bindHostFunction(targetName, hostFn);
    },

    async getState(keys: string[] = []): Promise<Record<string, unknown>> {
      const snapshot: Record<string, unknown> = {};
      for (const key of keys) {
        snapshot[key] = fromLuaValue(engine.global.get(key));
      }
      return snapshot;
    },

    setInstructionLimit(n: number): void {
      instructionLimit = Math.max(1, Math.trunc(n));
      engine.global.setTimeout(instructionLimit);
    },

    setMemoryLimit(bytes: number): void {
      memoryLimit = Math.max(1, Math.trunc(bytes));
      engine.global.setMemoryMax(memoryLimit);
    },

    async reset(): Promise<void> {
      await bootstrapEngine();
    },
  };
}
