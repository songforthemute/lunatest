export type CombinationSpace = Record<string, unknown[]>;

export function generate(space: CombinationSpace, limit = 256): Array<Record<string, unknown>> {
  const keys = Object.keys(space);

  if (keys.length === 0) {
    return [];
  }

  const combos: Array<Record<string, unknown>> = [];

  const visit = (depth: number, acc: Record<string, unknown>): void => {
    if (combos.length >= limit) {
      return;
    }

    if (depth === keys.length) {
      combos.push({ ...acc });
      return;
    }

    const key = keys[depth];
    if (!key) {
      return;
    }

    const values = space[key] ?? [];
    if (values.length === 0) {
      acc[key] = undefined;
      visit(depth + 1, acc);
      delete acc[key];
      return;
    }

    for (const value of values) {
      if (combos.length >= limit) {
        return;
      }
      acc[key] = value;
      visit(depth + 1, acc);
    }

    delete acc[key];
  };

  visit(0, {});

  return combos;
}
