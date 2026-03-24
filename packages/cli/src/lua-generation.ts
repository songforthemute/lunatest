import type { CoverageMetadata } from "@lunatest/contracts";

type GeneratedScenarioMetadata = {
  coverage?: CoverageMetadata;
  tags?: string[];
};

function normalizeStringList(values: string[] | undefined): string[] {
  if (!values) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function toLuaString(value: string): string {
  return JSON.stringify(value);
}

function renderLuaStringList(values: string[]): string | null {
  if (values.length === 0) {
    return null;
  }

  return `{ ${values.map((value) => toLuaString(value)).join(", ")} }`;
}

function renderCoverage(metadata: CoverageMetadata | undefined): string[] {
  if (!metadata) {
    return [];
  }

  const features = renderLuaStringList(normalizeStringList(metadata.features));
  const states = renderLuaStringList(normalizeStringList(metadata.states));
  const components = renderLuaStringList(normalizeStringList(metadata.components));

  const fields = [
    features ? `    features = ${features},` : null,
    states ? `    states = ${states},` : null,
    components ? `    components = ${components},` : null,
  ].filter((value): value is string => value !== null);

  if (fields.length === 0) {
    return [];
  }

  return ["  coverage = {", ...fields, "  },"];
}

export function injectGeneratedScenarioMetadata(
  lua: string,
  metadata: GeneratedScenarioMetadata,
): string {
  const tags = renderLuaStringList(normalizeStringList(metadata.tags));
  const sections = [
    ...(/\bcoverage\s*=/.test(lua) ? [] : renderCoverage(metadata.coverage)),
    ...(/\btags\s*=/.test(lua) || !tags ? [] : [`  tags = ${tags},`]),
  ];

  if (sections.length === 0) {
    return lua;
  }

  const closingIndex = lua.lastIndexOf("}");
  if (closingIndex === -1) {
    return lua;
  }

  const beforeClosing = lua.slice(0, closingIndex).trimEnd();
  const separator =
    beforeClosing.endsWith("{") || beforeClosing.endsWith(",") ? "" : ",";

  return `${lua.slice(0, closingIndex)}${separator}\n${sections.join("\n")}\n${lua.slice(
    closingIndex,
  )}`;
}
