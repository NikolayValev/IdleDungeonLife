import { defineConfig } from "@playwright/test";

const edgeChannel = process.platform === "win32" ? "msedge" : undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: "http://127.0.0.1:5174",
    channel: edgeChannel,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: {
      width: 1400,
      height: 1000,
    },
  },
});
