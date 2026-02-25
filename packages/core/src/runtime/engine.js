import { createSandbox } from "./sandbox.js";

const LUA_FUNCTION_RE = /function\s+([A-Za-z_][A-Za-z0-9_]*)\(([^)]*)\)\s*return\s+([^\n]+?)\s*end/g;
const LUA_ASSIGNMENT_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/;

function evaluateExpression(expression, scope) {
  const evaluator = new Function("scope", `with (scope) { return (${expression}); }`);
  return evaluator(scope);
}

function registerFunctions(code, functions) {
  LUA_FUNCTION_RE.lastIndex = 0;

  let cleanedCode = code;
  let match = LUA_FUNCTION_RE.exec(code);

  while (match) {
    const [fullSource, name, argsPart, body] = match;
    const paramNames = argsPart
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const jsFunction = new Function(...paramNames, `return ${body};`);
    functions.set(name, { paramNames, jsFunction });

    cleanedCode = cleanedCode.replace(fullSource, "");
    match = LUA_FUNCTION_RE.exec(code);
  }

  return cleanedCode;
}

function applyAssignments(code, sandbox, state) {
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

export async function createRuntime(options = {}) {
  const functions = new Map();
  const sandbox = createSandbox(options);
  const state = Object.create(null);

  return {
    async eval(code) {
      const codeWithoutFunctions = registerFunctions(code, functions);
      applyAssignments(codeWithoutFunctions, sandbox, state);
    },

    async call(name, args = {}) {
      const registered = functions.get(name);
      if (!registered) {
        throw new Error(`Function not found: ${name}`);
      }

      const orderedArgs = registered.paramNames.map((param) => args[param]);
      return registered.jsFunction(...orderedArgs);
    },

    async getState(keys) {
      if (!Array.isArray(keys) || keys.length === 0) {
        return { ...state };
      }

      const snapshot = {};
      for (const key of keys) {
        snapshot[key] = state[key];
      }
      return snapshot;
    },
  };
}
