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
        components: {
          known: options.coverageCatalog?.components ?? [],
          covered: [] as string[],
          missing: options.coverageCatalog?.components ?? [],
        },
        states: [] as string[],
      };
    }

    const scenarios = await options.getScenarios();
    const coveredComponents = new Set<string>();
    const coveredStates = new Set<string>();

    for (const scenario of scenarios) {
      const metadata =
        scenario.coverage ??
        (scenario.lua
          ? resolveCoverageMetadata(await loadLunaConfig(scenario.lua))
          : { components: [], states: [] });

      for (const component of metadata.components ?? []) {
        coveredComponents.add(component);
      }

      for (const state of metadata.states ?? []) {
        coveredStates.add(state);
      }
    }

    const known = new Set<string>([
      ...(options.coverageCatalog?.components ?? []),
      ...Object.keys(states),
      ...coveredComponents,
    ]);

    return {
      components: {
        known: Array.from(known).sort(),
        covered: Array.from(coveredComponents).sort(),
        missing: Array.from(known).filter((item) => !coveredComponents.has(item)),
      },
      states: Array.from(coveredStates).sort(),
    };
  };

  return {
    async tree() {
      return tree;
    },

    async states(name: string) {
      const resolved = await resolveCoverage();
      const known = Array.from(new Set(states[name] ?? [])).sort();
      const covered = known.filter((state) => resolved.states.includes(state));

      return {
        component: name,
        known,
        covered,
        missing: known.filter((state) => !covered.includes(state)),
        componentCoverage: {
          known: resolved.components.known.includes(name),
          covered: resolved.components.covered.includes(name),
          missing: resolved.components.missing.includes(name),
        },
      };
    },
  };
}
