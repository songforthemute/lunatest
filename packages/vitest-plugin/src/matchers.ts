export type LunaMatcherResult = {
  pass: boolean;
  message: () => string;
};

export type LunaMatcherInput = {
  pass: boolean;
  error?: string;
  diff?: string;
  result?: {
    diff?: string;
  };
};

export function toLunaPass(received: LunaMatcherInput): LunaMatcherResult {
  const details = received.diff ?? received.result?.diff ?? received.error;

  return {
    pass: received.pass,
    message: () =>
      received.pass
        ? "expected scenario to fail"
        : ["expected scenario to pass", details].filter(Boolean).join("\n"),
  };
}
