import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "runner-integration.browser.test.ts",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    browserName: "chromium",
    headless: true,
  },
});
