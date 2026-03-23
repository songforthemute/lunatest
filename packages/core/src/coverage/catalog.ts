import type {
  CoverageCatalog,
  CoverageMetadata,
  CoverageSnapshot,
} from "@lunatest/contracts";

type CoverageCarrier = {
  when?: Record<string, unknown>;
  then_ui?: Record<string, unknown>;
  then_state?: Record<string, unknown>;
  not_present?: string[];
  coverage?: CoverageMetadata;
};

function normalizeList(values: string[] | undefined): string[] {
  if (!values) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  ).sort();
}

function emptyCatalog(): CoverageCatalog {
  return {
    features: [],
    states: [],
    components: [],
  };
}

function topLevelKeys(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.keys(value);
}

function inferCoverageMetadata(input: CoverageCarrier): CoverageCatalog {
  const inferredStates = new Set<string>([
    ...topLevelKeys(input.then_ui),
    ...topLevelKeys(input.then_state),
    ...(input.not_present ?? []),
  ]);

  return {
    features:
      input.when && typeof input.when.action === "string"
        ? [input.when.action]
        : [],
    states: Array.from(inferredStates).sort(),
    components: topLevelKeys(input.then_ui).sort(),
  };
}

export function resolveCoverageMetadata(input: CoverageCarrier): CoverageCatalog {
  const inferred = inferCoverageMetadata(input);
  const declared = input.coverage ?? {};

  return {
    features:
      declared.features !== undefined
        ? normalizeList(declared.features)
        : inferred.features,
    states:
      declared.states !== undefined
        ? normalizeList(declared.states)
        : inferred.states,
    components:
      declared.components !== undefined
        ? normalizeList(declared.components)
        : inferred.components,
  };
}

function mergeCatalogs(base: CoverageCatalog, next: CoverageCatalog): CoverageCatalog {
  return {
    features: normalizeList([...base.features, ...next.features]),
    states: normalizeList([...base.states, ...next.states]),
    components: normalizeList([...base.components, ...next.components]),
  };
}

function subtractCatalog(known: CoverageCatalog, coveredTargets: CoverageCatalog): CoverageCatalog {
  const coveredFeatures = new Set(coveredTargets.features);
  const coveredStates = new Set(coveredTargets.states);
  const coveredComponents = new Set(coveredTargets.components);

  return {
    features: known.features.filter((feature: string) => !coveredFeatures.has(feature)),
    states: known.states.filter((state: string) => !coveredStates.has(state)),
    components: known.components.filter((component: string) => !coveredComponents.has(component)),
  };
}

export function buildCoverageSnapshot(input: {
  items: CoverageCarrier[];
  coverageCatalog?: Partial<CoverageCatalog>;
}): CoverageSnapshot {
  const knownFromCatalog: CoverageCatalog = {
    features: normalizeList(input.coverageCatalog?.features),
    states: normalizeList(input.coverageCatalog?.states),
    components: normalizeList(input.coverageCatalog?.components),
  };

  const coveredTargets = input.items.reduce<CoverageCatalog>((acc, item) => {
    return mergeCatalogs(acc, resolveCoverageMetadata(item));
  }, emptyCatalog());

  const known = mergeCatalogs(knownFromCatalog, coveredTargets);
  const missing = subtractCatalog(known, coveredTargets);
  const total =
    known.features.length + known.states.length + known.components.length;
  const covered =
    coveredTargets.features.length +
    coveredTargets.states.length +
    coveredTargets.components.length;

  return {
    total,
    covered,
    ratio: total === 0 ? 1 : Number((covered / total).toFixed(4)),
    known,
    coveredTargets,
    missing,
  };
}
