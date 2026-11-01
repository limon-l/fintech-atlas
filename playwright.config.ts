import { defineConfig, devices } from "@playwright/test";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3218",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start -- --port 3218",
    url: "http://localhost:3218/login",
    reuseExistingServer: false,
    env: { DATABASE_PATH: path.join(os.tmpdir(), `atlas-e2e-${randomUUID()}.db`) },
  },
});
