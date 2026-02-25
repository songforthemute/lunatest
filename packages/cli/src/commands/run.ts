export function runCommand(filter?: string): string {
  const target = filter ?? "all";
  return `Scenario Summary\nfilter=${target}\npassed=1\nfailed=0`;
}
