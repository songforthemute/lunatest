export function regressionFromDiffPrompt(diffSummary: string): string {
  return `Generate regression scenarios from this code diff summary:\n${diffSummary}`;
}
