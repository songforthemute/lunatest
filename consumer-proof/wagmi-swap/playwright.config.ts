import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    headless: true,
  },
  webServer: {
    command: "pnpm preview --host 127.0.0.1 --port 4173 --strictPort",
    reuseExistingServer: false,
    url: "http://127.0.0.1:4173",
  },
});
