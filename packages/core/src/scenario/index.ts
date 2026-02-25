import { z } from "zod";

const RecordValueSchema = z.record(z.string(), z.unknown());

const StageSchema = z.object({
  name: z.string().min(1),
  on: z.string().min(1).optional(),
});

const ScenarioSchema = z
  .object({
    name: z.string().min(1),
    given: RecordValueSchema,
    when: z
      .object({
        action: z.string().min(1),
      })
      .passthrough(),
    then_ui: RecordValueSchema,
    then_state: RecordValueSchema.optional(),
    stages: z.array(StageSchema).optional(),
    not_present: z.array(z.string().min(1)).optional(),
    timing_ms: z.number().int().nonnegative().optional(),
  })
  .passthrough();

export type ScenarioStage = z.infer<typeof StageSchema>;
export type ParsedScenario = z.infer<typeof ScenarioSchema>;

export type StageMachine = {
  current: () => ScenarioStage;
  next: () => ScenarioStage;
  done: () => boolean;
  index: () => number;
  path: () => string[];
};

export type VirtualClockEvent = {
  atMs: number;
  payload: Record<string, unknown>;
};

export type VirtualClock = {
  now: () => number;
  advance: (deltaMs: number) => number;
  schedule: (afterMs: number, payload: Record<string, unknown>) => void;
  drainDue: () => Record<string, unknown>[];
};

export function parseScenario(input: unknown): ParsedScenario {
  if (!input || typeof input !== "object" || !("given" in input)) {
    throw new Error("given is required");
  }

  return ScenarioSchema.parse(input);
}

export function createStageMachine(stages: ScenarioStage[]): StageMachine {
  if (stages.length === 0) {
    throw new Error("stages must contain at least one stage");
  }

  let cursor = 0;
  const path: string[] = [stages[0].name];

  return {
    current() {
      return stages[cursor] as ScenarioStage;
    },

    next() {
      if (cursor >= stages.length - 1) {
        return stages[cursor] as ScenarioStage;
      }

      cursor += 1;
      path.push(stages[cursor]!.name);
      return stages[cursor] as ScenarioStage;
    },

    done() {
      return cursor >= stages.length - 1;
    },

    index() {
      return cursor;
    },

    path() {
      return [...path];
    },
  };
}

export function createVirtualClock(initialMs = 0): VirtualClock {
  let current = Math.max(0, Math.trunc(initialMs));
  let queue: VirtualClockEvent[] = [];

  const sortQueue = () => {
    queue.sort((left, right) => left.atMs - right.atMs);
  };

  return {
    now() {
      return current;
    },

    advance(deltaMs) {
      current += Math.max(0, Math.trunc(deltaMs));
      return current;
    },

    schedule(afterMs, payload) {
      queue.push({
        atMs: current + Math.max(0, Math.trunc(afterMs)),
        payload: { ...payload },
      });
      sortQueue();
    },

    drainDue() {
      const due = queue.filter((event) => event.atMs <= current);
      queue = queue.filter((event) => event.atMs > current);
      return due.map((event) => ({ ...event.payload }));
    },
  };
}
