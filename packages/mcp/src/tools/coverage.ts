import {
  buildCoverageSnapshot,
  loadLunaConfig,
  resolveCoverageMetadata,
} from "@lunatest/core";
import type {
  CoverageCatalog,
  CoverageMetadata,
  CoverageSnapshot,
} from "@lunatest/contracts";

type ScenarioCoverageLike = {
  id: string;
  name: string;
  lua?: string;
  coverage?: CoverageMetadata;
};

export type CoverageGap = {
  kind: "feature" | "state" | "component";
  id: string;
  reason: "scenario not covered";
};

export function createCoverageTools(options: {
  seed?: Partial<CoverageSnapshot>;
  getScenarios?: () => Promise<ScenarioCoverageLike[]> | ScenarioCoverageLike[];
  coverageCatalog?: Partial<CoverageCatalog>;
} = {}) {
  const seed: CoverageSnapshot = {
    total: options.seed?.total ?? 0,
    covered: options.seed?.covered ?? 0,
    ratio: options.seed?.ratio ?? 1,
    known: options.seed?.known ?? { features: [], states: [], components: [] },
    coveredTargets: options.seed?.coveredTargets ?? { features: [], states: [], components: [] },
    missing: options.seed?.missing ?? { features: [], states: [], components: [] },
  };

  const resolveReport = async (): Promise<CoverageSnapshot> => {
    if (!options.getScenarios) {
      return seed;
    }

    const scenarios = await options.getScenarios();
    if (scenarios.length === 0) {
      return seed;
    }

    const items = await Promise.all(
      scenarios.map(async (scenario) => {
        if (scenario.coverage) {
          return {
            coverage: scenario.coverage,
          };
        }

        if (!scenario.lua) {
          return {
            coverage: {},
          };
        }

        const config = await loadLunaConfig(scenario.lua);
        return {
          ...config,
          coverage: resolveCoverageMetadata(config),
        };
      }),
    );

    return buildCoverageSnapshot({
      items,
      coverageCatalog: options.coverageCatalog,
    });
  };

  const toGaps = (report: CoverageSnapshot): CoverageGap[] => {
    const explicit = [
      ...report.missing.features.map((id: string) => ({
        kind: "feature" as const,
        id,
        reason: "scenario not covered" as const,
      })),
      ...report.missing.states.map((id: string) => ({
        kind: "state" as const,
        id,
        reason: "scenario not covered" as const,
      })),
      ...report.missing.components.map((id: string) => ({
        kind: "component" as const,
        id,
        reason: "scenario not covered" as const,
      })),
    ];

    if (explicit.length > 0) {
      return explicit;
    }

    const fallbackMissing = Math.max(0, report.total - report.covered);
    return Array.from({ length: fallbackMissing }, (_, index) => ({
      kind: "feature" as const,
      id: `gap-${index + 1}`,
      reason: "scenario not covered" as const,
    }));
  };

  return {
    async report() {
      return resolveReport();
    },

    async gaps() {
      return toGaps(await resolveReport());
    },

    async suggest() {
      return toGaps(await resolveReport()).map((gap, index) => ({
        id: `suggestion-${index + 1}`,
        title: `Add scenario for ${gap.kind}:${gap.id}`,
        target: gap,
      }));
    },
  };
}
