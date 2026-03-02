function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function collectDiff(
  before: unknown,
  after: unknown,
  path: string,
  lines: string[],
): void {
  const left = asRecord(before);
  const right = asRecord(after);

  if (!left || !right) {
    const leftJson = JSON.stringify(before);
    const rightJson = JSON.stringify(after);
    if (leftJson !== rightJson) {
      lines.push(`${path || "root"}: ${leftJson} -> ${rightJson}`);
    }
    return;
  }

  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    collectDiff(left[key], right[key], path ? `${path}.${key}` : key, lines);
  }
}

export function diffState(
  previous: Record<string, unknown>,
  current: Record<string, unknown>,
): string[] {
  const lines: string[] = [];
  collectDiff(previous, current, "", lines);
  return lines;
}
