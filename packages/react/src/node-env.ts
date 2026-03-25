export function resolveNodeEnv(explicit?: string): string | undefined {
  if (explicit) {
    return explicit;
  }

  const modeFromImportMeta =
    (import.meta as { env?: { MODE?: unknown } } | undefined)?.env?.MODE;
  if (typeof modeFromImportMeta === "string" && modeFromImportMeta.length > 0) {
    return modeFromImportMeta;
  }

  if (typeof process !== "undefined") {
    return process.env.NODE_ENV;
  }

  return undefined;
}
