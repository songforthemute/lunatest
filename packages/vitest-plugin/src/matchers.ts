export type LunaMatcherResult = {
  pass: boolean;
  message: () => string;
};

export function toLunaPass(received: { pass: boolean }): LunaMatcherResult {
  return {
    pass: received.pass,
    message: () =>
      received.pass
        ? "expected scenario to fail"
        : "expected scenario to pass",
  };
}
