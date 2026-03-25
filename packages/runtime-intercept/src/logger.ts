export type LogSink = (line: string) => void;

export type RuntimeLogger = {
  debug: (event: string, details?: Record<string, unknown>) => void;
};

export function createLogger(enabled = false, sink: LogSink = (line) => console.debug(line)): RuntimeLogger {
  return {
    debug(event, details) {
      if (!enabled) {
        return;
      }

      const suffix = details ? ` ${JSON.stringify(details)}` : "";
      sink(`[lunatest:runtime-intercept] ${event}${suffix}`);
    },
  };
}
