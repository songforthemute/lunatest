import type { CoverageCatalog, CoverageMetadata } from "@lunatest/contracts";
import { loadLunaConfig, resolveCoverageMetadata } from "@lunatest/core";

type ComponentStateMap = Record<string, string[]>;

type ComponentNode = {
  name: string;
  children?: ComponentNode[];
};

type ScenarioCoverageLike = {
  name: string;
  lua?: string;
  coverage?: CoverageMetadata;
};

export function createComponentTools(
  tree: ComponentNode[] = [],
  states: ComponentStateMap = {},
  options: {
    getScenarios?: () => Promise<ScenarioCoverageLike[]> | ScenarioCoverageLike[];
    coverageCatalog?: Partial<CoverageCatalog>;
  } = {},
) {
  const resolveCoverage = async () => {
    if (!options.getScenarios) {
      return {
        known: options.coverageCatalog?.components ?? [],
        covered: [] as string[],
        missing: options.coverageCatalog?.components ?? [],
      };
    }

    const scenarios = await options.getScenarios();
    const covered = new Set<string>();

    for (const scenario of scenarios) {
      const metadata =
        scenario.coverage ??
        (scenario.lua
          ? resolveCoverageMetadata(await loadLunaConfig(scenario.lua))
          : { components: [] });

      for (const component of metadata.components ?? []) {
        covered.add(component);
      }
    }

    const known = new Set<string>([
      ...(options.coverageCatalog?.components ?? []),
      ...Object.keys(states),
      ...covered,
    ]);

    return {
      known: Array.from(known).sort(),
      covered: Array.from(covered).sort(),
      missing: Array.from(known).filter((item) => !covered.has(item)),
    };
  };

  return {
    async tree() {
      return tree;
    },

    async states(name: string) {
      const resolved = await resolveCoverage();
      const known = Array.from(
        new Set([
          ...(states[name] ?? []),
          ...(resolved.known.includes(name) ? [name] : []),
        ]),
      ).sort();

      return {
        known,
        covered: resolved.covered.includes(name) ? [name] : [],
        missing: resolved.missing.includes(name) ? [name] : [],
      };
    },
  };
}
