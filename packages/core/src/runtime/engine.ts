import { createSandbox } from "./sandbox";
import { RuntimeOptionsSchema, type Runtime, type RuntimeOptions } from "./types";

const LUA_FUNCTION_RE =
  /function\s+([A-Za-z_][A-Za-z0-9_]*)\(([^)]*)\)\s*return\s+([^\n]+?)\s*end/g;
const LUA_ASSIGNMENT_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/;

function evaluateExpression(
  expression: string,
  scope: Record<string, unknown>,
): unknown {
  const evaluator = new Function(
    "scope",
    `with (scope) { return (${expression}); }`,
  ) as (scope: Record<string, unknown>) => unknown;

  return evaluator(scope);
}

function registerFunctions(code: string, functions: Map<string, FunctionSpec>): string {
  LUA_FUNCTION_RE.lastIndex = 0;

  let cleanedCode = code;
  let match = LUA_FUNCTION_RE.exec(code);

  while (match) {
    const [fullSource, name, argsPart, body] = match;
    const paramNames = argsPart
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const jsFunction = new Function(
      ...paramNames,
      `return ${body};`,
    ) as (...args: unknown[]) => unknown;

    functions.set(name, { paramNames, jsFunction });

    cleanedCode = cleanedCode.replace(fullSource, "");
    match = LUA_FUNCTION_RE.exec(code);
  }

  return cleanedCode;
}

function applyAssignments(
  code: string,
  sandbox: Record<string, unknown>,
  state: Record<string, unknown>,
): void {
  const statements = code
    .split(/[;\n]+/g)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const statement of statements) {
    const assignmentMatch = LUA_ASSIGNMENT_RE.exec(statement);
    if (!assignmentMatch) {
      continue;
    }

    const [, variable, expression] = assignmentMatch;
    const scope = { ...sandbox, ...state };
    state[variable] = evaluateExpression(expression, scope);
  }
}

type FunctionSpec = {
  paramNames: string[];
  jsFunction: (...args: unknown[]) => unknown;
};

export async function createRuntime(rawOptions: RuntimeOptions = {}): Promise<Runtime> {
  const options = RuntimeOptionsSchema.parse(rawOptions);
  const functions = new Map<string, FunctionSpec>();
  const sandbox = createSandbox(options) as Record<string, unknown>;
  const state: Record<string, unknown> = Object.create(null);

  return {
    async eval(code: string): Promise<void> {
      const codeWithoutFunctions = registerFunctions(code, functions);
      applyAssignments(codeWithoutFunctions, sandbox, state);
    },

    async call(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
      const registered = functions.get(name);
      if (!registered) {
        throw new Error(`Function not found: ${name}`);
      }

      const orderedArgs = registered.paramNames.map((param) => args[param]);
      return registered.jsFunction(...orderedArgs);
    },

    async getState(keys: string[] = []): Promise<Record<string, unknown>> {
      if (keys.length === 0) {
        return { ...state };
      }

      const snapshot: Record<string, unknown> = {};
      for (const key of keys) {
        snapshot[key] = state[key];
      }

      return snapshot;
    },
  };
}
