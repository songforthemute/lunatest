export function coverageResource(report: Record<string, unknown>) {
  return {
    uri: "lunatest://coverage",
    content: report,
  };
}
