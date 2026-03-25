export type AssertionResult = {
  pass: boolean;
  diff: string;
  expected: unknown;
  actual: unknown;
};

function format(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }

    return left.every((item, index) => deepEqual(item, right[index]));
  }

  if (
    typeof left === "object" &&
    left !== null &&
    typeof right === "object" &&
    right !== null
  ) {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord).sort();
    const rightKeys = Object.keys(rightRecord).sort();

    if (!deepEqual(leftKeys, rightKeys)) {
      return false;
    }

    return leftKeys.every((key) => deepEqual(leftRecord[key], rightRecord[key]));
  }

  return false;
}

function buildResult(expected: unknown, actual: unknown): AssertionResult {
  const pass = deepEqual(expected, actual);
  return {
    pass,
    diff: pass ? "" : `expected ${format(expected)} but got ${format(actual)}`,
    expected,
    actual,
  };
}

function hasPath(input: Record<string, unknown>, path: string): boolean {
  const parts = path.split(".").filter(Boolean);
  let cursor: unknown = input;

  for (const part of parts) {
    if (!cursor || typeof cursor !== "object" || !(part in cursor)) {
      return false;
    }
    cursor = (cursor as Record<string, unknown>)[part];
  }

  return true;
}

export function assertUI(expected: unknown, actual: unknown): AssertionResult {
  return buildResult(expected, actual);
}

export function assertState(expected: unknown, actual: unknown): AssertionResult {
  return buildResult(expected, actual);
}

export function assertTransition(
  expectedPath: string[],
  actualPath: string[],
): AssertionResult {
  return buildResult(expectedPath, actualPath);
}

export function assertNot(
  forbiddenPaths: string[],
  actual: Record<string, unknown>,
): AssertionResult {
  const found = forbiddenPaths.filter((path) => hasPath(actual, path));
  const pass = found.length === 0;

  return {
    pass,
    diff: pass
      ? ""
      : `forbidden paths found: ${found.join(", ")} in ${format(actual)}`,
    expected: forbiddenPaths,
    actual,
  };
}

export function assertTiming(targetMs: number, actualMs: number): AssertionResult {
  const pass = actualMs <= targetMs;
  return {
    pass,
    diff: pass
      ? ""
      : `expected timing <= ${targetMs}ms but got ${actualMs}ms`,
    expected: targetMs,
    actual: actualMs,
  };
}
