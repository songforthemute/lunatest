export type AssertionResult = {
  pass: boolean;
  diff: string;
  expected: unknown;
  actual: unknown;
};

function format(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function assertUI(expected: unknown, actual: unknown): AssertionResult {
  const pass = JSON.stringify(expected) === JSON.stringify(actual);

  if (pass) {
    return {
      pass: true,
      diff: "",
      expected,
      actual,
    };
  }

  return {
    pass: false,
    diff: `expected ${format(expected)} but got ${format(actual)}`,
    expected,
    actual,
  };
}
