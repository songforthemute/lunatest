import { z } from "zod";

export const RuntimeOptionsSchema = z
  .object({
    seed: z.number().finite().optional(),
    now: z.number().finite().optional(),
  })
  .strict();

export type RuntimeOptions = z.infer<typeof RuntimeOptionsSchema>;

export interface Runtime {
  eval(code: string): Promise<void>;
  call(name: string, args?: Record<string, unknown>): Promise<unknown>;
  getState(keys?: string[]): Promise<Record<string, unknown>>;
}
