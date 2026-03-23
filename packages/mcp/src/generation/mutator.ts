import type { CoverageCatalog } from "@lunatest/contracts";
import type { ScenarioDescriptor } from "../tools/scenario.js";

function mutateNumericToken(token: string, delta: number): string {
  const asNumber = Number(token);
  if (!Number.isFinite(asNumber)) {
    return token;
  }

  return String(asNumber + delta);
}

export function mutateValues(lua: string, variantIndex: number): string {
  let replaced = false;
  const next = lua.replace(/\b\d+(?:\.\d+)?\b/g, (token) => {
    if (replaced) {
      return token;
    }
    replaced = true;
    return mutateNumericToken(token, variantIndex);
  });

  if (replaced) {
    return next;
  }

  return `${lua}\n-- value mutation ${variantIndex}`;
}

export function mutateStages(lua: string, variantIndex: number): string {
  if (!lua.includes("stages")) {
    return lua;
  }

  return `${lua}\n-- stage-order mutation ${variantIndex}`;
}

export function mutateMocks(lua: string, variantIndex: number): string {
  if (!lua.includes("given")) {
    return lua;
  }

  return `${lua}\n-- mock-state mutation ${variantIndex}`;
}

export function mutateScenarioVariants(
  source: ScenarioDescriptor,
  count: number,
  options: {
    missingTargets?: CoverageCatalog;
  } = {},
): ScenarioDescriptor[] {
  const variants: ScenarioDescriptor[] = [];
  const missingFeatures = options.missingTargets?.features ?? [];
  const missingStates = options.missingTargets?.states ?? [];
  const missingComponents = options.missingTargets?.components ?? [];

  for (let index = 1; index <= count; index += 1) {
    const variantLua = source.lua
      ? mutateMocks(mutateStages(mutateValues(source.lua, index), index), index)
      : undefined;
    const feature = missingFeatures[(index - 1) % Math.max(missingFeatures.length, 1)];
    const state = missingStates[(index - 1) % Math.max(missingStates.length, 1)];
    const component = missingComponents[(index - 1) % Math.max(missingComponents.length, 1)];

    const variant: ScenarioDescriptor = {
      ...source,
      id: `${source.id}-mut-${index}`,
      name: `${source.name} mutation ${index}`,
      tags: Array.from(
        new Set([
          ...(source.tags ?? []),
          "mutated",
        ]),
      ),
      coverage: {
        features: Array.from(
          new Set([
            ...(source.coverage?.features ?? []),
            ...(feature ? [feature] : []),
          ]),
        ),
        states: Array.from(
          new Set([
            ...(source.coverage?.states ?? []),
            ...(state ? [state] : []),
          ]),
        ),
        components: Array.from(
          new Set([
            ...(source.coverage?.components ?? []),
            ...(component ? [component] : []),
          ]),
        ),
      },
    };

    if (variantLua !== undefined) {
      variant.lua = variantLua;
    }

    variants.push(variant);
  }

  return variants;
}
