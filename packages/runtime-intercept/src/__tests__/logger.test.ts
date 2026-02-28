import { describe, expect, it } from "vitest";

import { createLogger } from "../logger";

describe("runtime logger", () => {
  it("does not log when debug is false", () => {
    const logs: string[] = [];
    const logger = createLogger(false, (line) => logs.push(line));

    logger.debug("hit", { a: 1 });

    expect(logs).toHaveLength(0);
  });

  it("logs structured payload when debug is true", () => {
    const logs: string[] = [];
    const logger = createLogger(true, (line) => logs.push(line));

    logger.debug("fetch.hit", { key: "quote" });

    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain("[lunatest:runtime-intercept] fetch.hit");
    expect(logs[0]).toContain('"key":"quote"');
  });
});
