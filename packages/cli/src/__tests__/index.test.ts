import { afterEach, expect, it, vi } from "vitest";

const { executeCommandMock } = vi.hoisted(() => ({
  executeCommandMock: vi.fn(),
}));

vi.mock("../cli.js", () => ({
  executeCommand: executeCommandMock,
}));

const originalArgv = process.argv;
const originalExitCode = process.exitCode;

afterEach(() => {
  process.argv = originalArgv;
  process.exitCode = originalExitCode;
  vi.resetModules();
  executeCommandMock.mockReset();
});

it("converts SIGINT into an abort signal for watch and removes its process listener", async () => {
  const signalListenerCount = process.listenerCount("SIGINT");
  process.argv = ["node", "lunatest", "watch"];
  let receivedOptions: { signal?: AbortSignal } | undefined;

  executeCommandMock.mockImplementation(async (_args, options) => {
    receivedOptions = options;
    if (options.signal) {
      await new Promise<void>((resolve) => {
        options.signal.addEventListener("abort", () => resolve(), { once: true });
      });
    }

    return { exitCode: 0, output: "" };
  });

  const entrypoint = import("../index");
  await vi.waitFor(() => expect(receivedOptions).toBeDefined());
  process.emit("SIGINT");
  await entrypoint;

  expect(receivedOptions?.signal).toBeInstanceOf(AbortSignal);
  expect(receivedOptions?.signal?.aborted).toBe(true);
  expect(process.listenerCount("SIGINT")).toBe(signalListenerCount);
});

it("does not intercept SIGINT while a non-watch command is running", async () => {
  const signalListenerCount = process.listenerCount("SIGINT");
  process.argv = ["node", "lunatest", "run"];
  let finishCommand!: () => void;

  executeCommandMock.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishCommand = () => resolve({ exitCode: 0, output: "" });
      }),
  );

  const entrypoint = import("../index");
  await vi.waitFor(() => expect(executeCommandMock).toHaveBeenCalledTimes(1));
  expect(process.listenerCount("SIGINT")).toBe(signalListenerCount);
  finishCommand();
  await entrypoint;
});
