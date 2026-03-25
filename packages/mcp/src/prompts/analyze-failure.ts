export function analyzeFailurePrompt(diff: string): string {
  return `Analyze this deterministic failure diff and identify root cause:\n${diff}`;
}
