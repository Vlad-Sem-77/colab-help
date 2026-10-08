import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const systemChromiumPath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
  (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined);

export default defineConfig({
  testDir: "./e2e",
  outputDir: "/tmp/notebook-ui-playwright-results",
  fullyParallel: true,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4261",
    browserName: "chromium",
    headless: true,
    viewport: { width: 1280, height: 900 },
    launchOptions: {
      ...(systemChromiumPath ? { executablePath: systemChromiumPath } : {}),
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "pnpm run dev",
    url: "http://127.0.0.1:4261/notebook/",
    env: {
      PORT: "4261",
      BASE_PATH: "/notebook/",
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
