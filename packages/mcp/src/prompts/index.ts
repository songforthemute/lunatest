import { analyzeFailurePrompt } from "./analyze-failure";
import { generateEdgeCasesPrompt } from "./generate-edge-cases";
import { improveCoveragePrompt } from "./improve-coverage";
import { regressionFromDiffPrompt } from "./regression-from-diff";

export type PromptTemplate = {
  id: string;
  render: (input: string | string[]) => string;
};

export function createPromptCatalog(): PromptTemplate[] {
  return [
    {
      id: "generate-edge-cases",
      render: (input) => generateEdgeCasesPrompt(String(input)),
    },
    {
      id: "analyze-failure",
      render: (input) => analyzeFailurePrompt(String(input)),
    },
    {
      id: "improve-coverage",
      render: (input) =>
        improveCoveragePrompt(Array.isArray(input) ? input : [String(input)]),
    },
    {
      id: "regression-from-diff",
      render: (input) => regressionFromDiffPrompt(String(input)),
    },
  ];
}
