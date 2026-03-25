export function improveCoveragePrompt(gaps: string[]): string {
  return `Suggest scenarios to cover these gaps: ${gaps.join(", ")}`;
}
