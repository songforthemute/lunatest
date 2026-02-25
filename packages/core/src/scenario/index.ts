import { z } from "zod";

const RecordValueSchema = z.record(z.string(), z.unknown());

const ScenarioSchema = z
  .object({
    name: z.string().min(1),
    given: RecordValueSchema,
    when: z.object({
      action: z.string().min(1),
    }).passthrough(),
    then_ui: RecordValueSchema,
  })
  .passthrough();

export type ParsedScenario = z.infer<typeof ScenarioSchema>;

export function parseScenario(input: unknown): ParsedScenario {
  if (!input || typeof input !== "object" || !("given" in input)) {
    throw new Error("given is required");
  }

  return ScenarioSchema.parse(input);
}
