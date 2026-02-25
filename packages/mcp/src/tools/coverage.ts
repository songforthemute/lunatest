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
  };
}
