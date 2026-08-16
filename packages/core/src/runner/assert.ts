export type AssertionResult = {
  pass: boolean;
  diff: string;
  expected: unknown;
  actual: unknown;
  mismatch?: {
    path: string;
    expected: unknown;
    actual: unknown;
    expectedPresent?: boolean;
    actualPresent?: boolean;
  };
};

type AssertionMismatch = NonNullable<AssertionResult["mismatch"]>;

function format(value: unknown): string {
  return value === undefined ? "undefined" : JSON.stringify(value, null, 2);
}

function propertyPath(parent: string, key: string): string {
  return /^[A-Za-z_$][\w$]*$/u.test(key)
    ? `${parent}.${key}`
    : `${parent}[${JSON.stringify(key)}]`;
}

function findFirstMismatch(
  expected: unknown,
  actual: unknown,
  path: string,
): AssertionMismatch | undefined {
  if (Object.is(expected, actual)) {
    return undefined;
  }

  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      return { path, expected, actual };
    }

    const length = Math.max(expected.length, actual.length);
    for (let index = 0; index < length; index += 1) {
      if (index >= expected.length || index >= actual.length) {
        return {
          path: `${path}[${index}]`,
          expected: expected[index],
          actual: actual[index],
          expectedPresent: index < expected.length,
          actualPresent: index < actual.length,
        };
      }
      const mismatch = findFirstMismatch(expected[index], actual[index], `${path}[${index}]`);
      if (mismatch) return mismatch;
    }
    return undefined;
  }

  if (
    typeof expected === "object" &&
    expected !== null &&
    typeof actual === "object" &&
    actual !== null
  ) {
    const expectedRecord = expected as Record<string, unknown>;
    const actualRecord = actual as Record<string, unknown>;
    const keys = Array.from(
      new Set([...Object.keys(expectedRecord), ...Object.keys(actualRecord)]),
    ).sort();

    for (const key of keys) {
      const expectedHasKey = Object.hasOwn(expectedRecord, key);
      const actualHasKey = Object.hasOwn(actualRecord, key);
      if (expectedHasKey !== actualHasKey) {
        return {
          path: propertyPath(path, key),
          expected: expectedRecord[key],
          actual: actualRecord[key],
          expectedPresent: expectedHasKey,
          actualPresent: actualHasKey,
        };
      }
      const mismatch = findFirstMismatch(
        expectedRecord[key],
        actualRecord[key],
        propertyPath(path, key),
      );
      if (mismatch) return mismatch;
    }
    return undefined;
  }

  return { path, expected, actual };
}

function formatMismatch(mismatch: AssertionMismatch): string {
  if (
    mismatch.expectedPresent !== undefined ||
    mismatch.actualPresent !== undefined
  ) {
    const expected = mismatch.expectedPresent
      ? `present with value ${format(mismatch.expected)}`
      : "absent";
    const actual = mismatch.actualPresent
      ? `present with value ${format(mismatch.actual)}`
      : "absent";
    return `expected ${mismatch.path} to be ${expected} but got ${actual}`;
  }

  return `expected ${mismatch.path} to equal ${format(mismatch.expected)} but got ${format(mismatch.actual)}`;
}

function buildResult(expected: unknown, actual: unknown, rootPath: string): AssertionResult {
  const mismatch = findFirstMismatch(expected, actual, rootPath);
  const pass = mismatch === undefined;
  return {
    pass,
    diff: pass ? "" : formatMismatch(mismatch),
    expected,
    actual,
    ...(mismatch ? { mismatch } : {}),
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
  return buildResult(expected, actual, "then_ui");
}

export function assertState(expected: unknown, actual: unknown): AssertionResult {
  return buildResult(expected, actual, "then_state");
}

export function assertTransition(
  expectedPath: string[],
  actualPath: string[],
): AssertionResult {
  return buildResult(expectedPath, actualPath, "stages");
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
