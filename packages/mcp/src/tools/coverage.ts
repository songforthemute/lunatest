export type CoverageReport = {
  total: number;
  covered: number;
  ratio: number;
};

export function createCoverageTools(seed?: Partial<CoverageReport>) {
  const report: CoverageReport = {
    total: seed?.total ?? 0,
    covered: seed?.covered ?? 0,
    ratio:
      seed?.ratio ??
      ((seed?.total ?? 0) === 0
        ? 1
        : Number(((seed?.covered ?? 0) / (seed?.total ?? 0)).toFixed(4))),
  };

  return {
    async report() {
      return report;
    },

    async gaps() {
      const missing = Math.max(0, report.total - report.covered);
      return Array.from({ length: missing }, (_, index) => ({
        id: `gap-${index + 1}`,
        reason: "scenario not covered",
      }));
    },

    async suggest() {
      const missing = Math.max(0, report.total - report.covered);
      return Array.from({ length: missing }, (_, index) => ({
        id: `suggestion-${index + 1}`,
        title: `Add edge case scenario ${index + 1}`,
      }));
    },
  };
}
