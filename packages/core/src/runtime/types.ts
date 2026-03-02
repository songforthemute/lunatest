import { z } from "zod";

export const RuntimeOptionsSchema = z
  .object({
    seed: z.number().finite().optional(),
    now: z.number().finite().optional(),
    instructionLimit: z.number().int().positive().optional(),
    memoryLimit: z.number().int().positive().optional(),
  })
  .strict();

export type RuntimeOptions = z.infer<typeof RuntimeOptionsSchema>;

export interface Runtime {
  eval(code: string): Promise<void>;
  call(name: string, args?: Record<string, unknown>): Promise<unknown>;
  register(name: string, hostFn: (...args: unknown[]) => unknown): void;
  getState(keys?: string[]): Promise<Record<string, unknown>>;
  setInstructionLimit(n: number): void;
  setMemoryLimit(bytes: number): void;
  reset(): Promise<void>;
}
