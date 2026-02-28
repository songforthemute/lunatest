export function coverageCommand(): string {
  return JSON.stringify(
    {
      total: 1,
      covered: 1,
      ratio: 1,
    },
    null,
    2,
  );
}
